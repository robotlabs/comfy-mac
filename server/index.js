import express from "express";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ComfyClient } from "./comfy.js";

const execFileP = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// This instance is bound to ONE target — "local" (LAN/Tailscale PC) or "runpod" —
// chosen via COMFY_TARGET. Run two processes (two ports) so the local and RunPod
// sessions stay fully isolated: restarting/reloading one never disturbs the other.
const TARGET = (process.env.COMFY_TARGET || "local").toLowerCase();

let config;
// Workflow templates for THIS target, keyed by id. Rebuilt by loadConfig() so new/edited
// workflows are picked up live via POST /api/reload — no restart, no touching the other instance.
const workflows = new Map();
let targetWorkflowDefs = [];
let defaultWorkflowId;

async function loadConfig() {
  config = JSON.parse(await readFile(join(root, "config.json"), "utf8"));
  targetWorkflowDefs = config.workflows.filter((w) => (w.target || "local") === TARGET);
  workflows.clear();
  for (const wf of targetWorkflowDefs) {
    const template = JSON.parse(await readFile(join(root, wf.template), "utf8"));
    workflows.set(wf.id, { ...wf, template });
    // Guard: a WAN template must not mix i2v diffusion models with t2v speed-LoRAs (or vice
    // versa). That copy-paste mismatch fails silently at render with "Value not in list:
    // lora_name ...". Warn loudly at load so it never ships unnoticed again.
    const blob = JSON.stringify(template);
    const modelType = /(i2v|t2v)_(?:high|low)_noise_14B/.exec(blob)?.[1];
    const loraType = /wan2\.2_(i2v|t2v)_lightx2v/.exec(blob)?.[1];
    if (modelType && loraType && modelType !== loraType) {
      console.warn(
        `⚠️  [${wf.id}] LORA/MODEL MISMATCH: diffusion=${modelType} ma lora=${loraType} — il render fallirà ("Value not in list"). Correggi i nomi lora in ${wf.template}`,
      );
    }
  }
  defaultWorkflowId =
    targetWorkflowDefs.find((w) => w.id === config.defaultWorkflow)?.id || targetWorkflowDefs[0]?.id;
}
await loadConfig();

// Connection hosts for this target: local → LAN/Tailscale (host, no url); runpod → the proxy url host.
const allHosts = config.comfy.hosts || [{ label: "ComfyUI", host: config.comfy.host }];
const hosts =
  TARGET === "runpod"
    ? allHosts.filter((h) => h.url !== undefined)
    : allHosts.filter((h) => h.url === undefined);
const comfyPort = config.comfy.port;
let connMode = "auto"; // "auto" or a host index
let activeHostIndex = 0;

// A host targets either a LAN ip+port (http://ip:port) or a full base URL
// (RunPod proxy: https://<pod>-8188.proxy.runpod.net). hostBase() returns the
// full base URL either way ("" if a url-host hasn't been filled in yet).
function hostBase(h) {
  if (!h) return "";
  if (h.url !== undefined) return String(h.url || "").replace(/\/$/, "");
  return `http://${h.host}:${comfyPort}`;
}

// The RunPod proxy URL changes every time a new pod is created, so it's not in
// config.json — it's pasted from the UI and persisted to this file.
const runpodHost = hosts.find((h) => h.url !== undefined);
const runpodUrlFile = join(__dirname, ".runpod-url");
if (runpodHost && existsSync(runpodUrlFile)) {
  runpodHost.url = (await readFile(runpodUrlFile, "utf8")).trim();
}

async function probeHost(h) {
  const base = hostBase(h);
  if (!base) return false;
  try {
    const r = await fetch(`${base}/system_stats`, {
      signal: AbortSignal.timeout(base.startsWith("https") ? 4000 : 1500),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Pick the first reachable host (LAN before Tailscale), falling back to the first.
async function pickAutoHost() {
  for (let i = 0; i < hosts.length; i++) {
    if (await probeHost(hosts[i])) return i;
  }
  return 0;
}

activeHostIndex = await pickAutoHost();
const comfy = new ComfyClient({ base: hostBase(hosts[activeHostIndex]) });
comfy.connect();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(join(root, "public")));

// --- Server-Sent Events: push live generation progress to the browser ---
const sseClients = new Set();

app.get("/api/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(`event: hello\ndata: {"connected":${comfy.connected}}\n\n`);
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

function broadcast(obj) {
  const line = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of sseClients) res.write(line);
}

// Per-prompt context (where to save on this Mac), keyed by ComfyUI prompt id.
const pending = new Map();

// Latest queue depth reported by ComfyUI (running + pending). Surfaced via /api/health.
let queueRemaining = 0;

// Files this app saved on the Mac this session — only these may be deleted.
const savedPaths = new Set();

function expandHome(p) {
  if (!p) return p;
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

// Default save folder: first configured dir that exists, else the last (created on save).
function pickSaveDir() {
  const candidates = (config.output?.saveDirs || ["~/Pictures/comfy-mac"]).map(expandHome);
  return candidates.find((c) => existsSync(c)) || candidates[candidates.length - 1];
}
const defaultSaveDir = pickSaveDir();

// Pull the rendered image(s) from ComfyUI and write them to the chosen Mac folder.
async function saveImages(promptId, comfyImages) {
  const job = pending.get(promptId);
  if (!job?.saveDir) return;
  const dir = expandHome(job.saveDir.trim());
  try {
    await mkdir(dir, { recursive: true });
    for (const img of comfyImages) {
      const r = await fetch(comfy.imageUrl(img));
      if (!r.ok) continue;
      const dest = join(dir, img.filename);
      await writeFile(dest, Buffer.from(await r.arrayBuffer()));
      savedPaths.add(dest);
      broadcast({ type: "saved", path: dest, promptId });
    }
  } catch (e) {
    broadcast({ type: "saveError", message: String(e.message || e), promptId });
  }
}

// Save the last-frame PNG NEXT TO the video, with the SAME base name (e.g. clip_00007_.mp4
// → clip_00007_.png), so the still always sits beside its clip in the folder.
async function saveLastframe(promptId, item, videoBase) {
  const job = pending.get(promptId);
  if (!job?.saveDir) return;
  const dir = expandHome(job.saveDir.trim());
  try {
    await mkdir(dir, { recursive: true });
    const r = await fetch(comfy.imageUrl(item));
    if (!r.ok) return;
    const dest = join(dir, `${videoBase}.png`);
    await writeFile(dest, Buffer.from(await r.arrayBuffer()));
    savedPaths.add(dest);
    broadcast({ type: "saved", path: dest, promptId });
  } catch (e) {
    broadcast({ type: "saveError", message: String(e.message || e), promptId });
  }
}

// Translate ComfyUI websocket events into compact frontend events.
comfy.onMessage((msg) => {
  const { type, data = {} } = msg;
  switch (type) {
    case "_socket":
      broadcast({ type: "socket", connected: data.connected });
      break;
    case "progress":
      broadcast({ type: "progress", value: data.value, max: data.max, promptId: data.prompt_id });
      break;
    case "executing":
      if (data.node === null) {
        broadcast({ type: "done", promptId: data.prompt_id });
        pending.delete(data.prompt_id);
      } else {
        broadcast({ type: "executing", node: data.node, promptId: data.prompt_id });
      }
      break;
    case "executed":
      if (data.output?.images?.length) {
        const items = data.output.images;
        const isVideo =
          !!data.output.animated?.[0] || items.some((im) => /\.(mp4|webm|mov|gif)$/i.test(im.filename));
        const images = items.map(
          (img) =>
            "/api/image?" +
            new URLSearchParams({
              filename: img.filename,
              subfolder: img.subfolder ?? "",
              type: img.type ?? "output",
            }),
        );
        // The last-frame PNG (either our injected "__lastframe_save" node, or a workflow
        // that natively saves a "lastframe" SaveImage — e.g. the RunPod WAN i2v): save it
        // but don't let it replace the mp4 in the viewer.
        const secondary =
          data.node === "__lastframe_save" ||
          (!isVideo && items.some((im) => /lastframe/i.test(im.filename || "")));
        broadcast({ type: "image", images, isVideo, promptId: data.prompt_id, secondary });
        const job = pending.get(data.prompt_id);
        if (secondary) {
          // Last-frame PNG: save it named after the video. The video event may not have
          // arrived yet, so stash it and flush once we know the video's base name.
          if (job?.videoBase) saveLastframe(data.prompt_id, items[0], job.videoBase);
          else if (job) job.pendingLastframe = items[0];
        } else {
          saveImages(data.prompt_id, items);
          if (isVideo && job) {
            job.videoBase = items[0].filename.replace(/\.[^.]+$/, "");
            if (job.pendingLastframe) {
              saveLastframe(data.prompt_id, job.pendingLastframe, job.videoBase);
              job.pendingLastframe = null;
            }
          }
        }
      }
      break;
    case "execution_error":
      broadcast({
        type: "error",
        message: data.exception_message || "Execution error",
        promptId: data.prompt_id,
      });
      pending.delete(data.prompt_id);
      break;
    case "status":
      queueRemaining = data.status?.exec_info?.queue_remaining ?? 0;
      broadcast({ type: "status", queue: queueRemaining });
      break;
  }
});

// --- Workflow injection ---
// map can be a single {node,field} or an array of them (e.g. WAN's two samplers share one seed).
function setField(graph, map, value) {
  if (!map) return;
  for (const m of Array.isArray(map) ? map : [map]) {
    const node = graph[m.node];
    if (!node) throw new Error(`Workflow is missing node "${m.node}" — re-export it from ComfyUI.`);
    node.inputs[m.field] = value;
  }
}

function randomSeed() {
  return Math.floor(Math.random() * 1e15);
}

app.get("/api/config", (req, res) => {
  res.json({
    connection: {
      mode: connMode,
      activeHostIndex,
      hosts: hosts.map((h) => ({
        label: h.label,
        editable: h.url !== undefined,
        url: h.url !== undefined ? h.url || "" : undefined,
      })),
    },
    defaultSaveDir,
    target: TARGET,
    defaultWorkflow: defaultWorkflowId,
    workflows: targetWorkflowDefs.map((w) => {
      const tmpl = workflows.get(w.id)?.template;
      const neg = w.fields.negative;
      const defaultNegative = neg && tmpl?.[neg.node]?.inputs?.[neg.field];
      const pre = w.fields.prefix;
      const defaultPrefix = pre && tmpl?.[pre.node]?.inputs?.[pre.field];
      return {
      id: w.id,
      name: w.name,
      type: w.type || "text2img",
      target: w.target || "local",
      promptMode: w.promptMode,
      defaults: w.defaults,
      defaultNegative: defaultNegative || "",
      defaultPrefix: defaultPrefix || "",
      exportChoice: !!w.exportFramesNode,
      toggles: (w.toggles || []).map((t) => ({ key: t.key, label: t.label, default: !!t.default })),
      has: {
        prompt: !!(w.fields.positive || w.fields.prompt),
        seed: !!w.fields.seed,
        negative: !!w.fields.negative,
        cfg: !!w.fields.cfg,
        steps: !!w.fields.steps,
        sampler: !!w.fields.sampler,
        scheduler: !!w.fields.scheduler,
        denoise: !!w.fields.denoise,
        width: !!w.fields.width,
        height: !!w.fields.height,
        image: !!w.fields.image,
        image2: !!w.fields.image2,
        resolution: !!w.fields.resolution,
        frames: !!w.fields.frames,
        fps: !!w.fields.fps,
        duration: !!w.fields.duration,
        shift: !!w.fields.shift,
        loraHigh: !!w.fields.loraHigh,
        loraLow: !!w.fields.loraLow,
      },
      };
    }),
  });
});

app.get("/api/health", async (req, res) => {
  try {
    const stats = await comfy.systemStats();
    const gpu = stats.devices?.[0];
    // Read the real queue depth from ComfyUI (authoritative); fall back to the
    // last websocket-reported value if the extra call fails.
    try { queueRemaining = await comfy.queueCount(); } catch {}
    res.json({
      ok: true,
      connected: comfy.connected,
      hostLabel: hosts[activeHostIndex]?.label,
      comfyui: stats.system?.comfyui_version,
      gpu: gpu ? { name: gpu.name, vramTotal: gpu.vram_total, vramFree: gpu.vram_free } : null,
      queue: queueRemaining,
    });
  } catch (e) {
    res.json({ ok: false, connected: false, hostLabel: hosts[activeHostIndex]?.label, error: String(e.message || e) });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const {
      workflow: wfId,
      positive = "",
      negative = "",
      image,
      image2,
      seed,
      steps,
      cfg,
      sampler,
      scheduler,
      denoise,
      width,
      height,
      resolution,
      frames,
      fps,
      duration,
      shift,
      loraHigh,
      loraLow,
      prefix,
      saveDir,
    } = req.body;
    const wf = workflows.get(wfId) || workflows.get(defaultWorkflowId);
    if (!wf) return res.status(400).json({ error: "No workflow configured" });
    const f = wf.fields;
    const graph = structuredClone(wf.template);

    // positive/negative for split-prompt workflows; prompt for single-prompt ones.
    setField(graph, f.positive, String(positive));
    setField(graph, f.negative, String(negative));
    setField(graph, f.prompt, String(positive));
    if (f.image) {
      if (!image) return res.status(400).json({ error: "This workflow needs an input image." });
      setField(graph, f.image, String(image));
    }
    if (f.image2) {
      if (image2) {
        setField(graph, f.image2, String(image2));
      } else {
        // 2nd image is OPTIONAL: none given → drop its LoadImage node and any input wired to it
        // (e.g. the encoder's image2), so the edit runs single-image instead of failing on a
        // missing file. API-format equivalent of bypassing the 2nd LoadImage node.
        const n2 = String(f.image2.node);
        delete graph[n2];
        for (const node of Object.values(graph)) {
          if (!node || typeof node.inputs !== "object") continue;
          for (const [k, v] of Object.entries(node.inputs)) {
            if (Array.isArray(v) && String(v[0]) === n2) delete node.inputs[k];
          }
        }
      }
    }
    if (prefix && String(prefix).trim()) setField(graph, f.prefix, String(prefix).trim());

    const usedSeed =
      seed === undefined || seed === null || seed === "" ? randomSeed() : Math.floor(Number(seed));
    setField(graph, f.seed, usedSeed);

    if (steps) setField(graph, f.steps, Math.floor(Number(steps)));
    // WAN 2.2 splits steps between a high-noise and a low-noise sampler at a boundary; keep the
    // boundary < steps so neither sampler ends up with 0 steps (which crashes the WAN node).
    if (f.stepsBoundary && steps) {
      const st = Math.floor(Number(steps));
      const ratio = wf.defaults?.stepsBoundaryRatio || 0.65;
      setField(graph, f.stepsBoundary, Math.max(1, Math.min(st - 1, Math.round(st * ratio))));
    }
    if (cfg !== undefined && cfg !== "") setField(graph, f.cfg, Number(cfg));
    if (sampler) setField(graph, f.sampler, String(sampler));
    if (scheduler) setField(graph, f.scheduler, String(scheduler));
    if (denoise !== undefined && denoise !== "") setField(graph, f.denoise, Number(denoise));
    if (width) setField(graph, f.width, Math.floor(Number(width)));
    if (height) setField(graph, f.height, Math.floor(Number(height)));
    if (resolution) setField(graph, f.resolution, Math.floor(Number(resolution)));
    if (frames) setField(graph, f.frames, Math.floor(Number(frames)));
    if (fps) setField(graph, f.fps, Number(fps));
    if (duration) setField(graph, f.duration, Number(duration));
    if (shift !== undefined && shift !== "") setField(graph, f.shift, Number(shift));
    if (loraHigh !== undefined && loraHigh !== "") setField(graph, f.loraHigh, Number(loraHigh));
    if (loraLow !== undefined && loraLow !== "") setField(graph, f.loraLow, Number(loraLow));

    // VRAM-safe auto-engage for high-res video, split by cost:
    //  - VAE tiling (tilingThreshold): cheap on time, big OOM help at the decode — engage early.
    //  - block swap (swapThreshold): big OOM help during sampling but a heavy SPEED cost (every
    //    swapped block is offloaded/reloaded each step) — engage only at genuinely high res.
    // Low/mid-res renders (e.g. 480) keep the template's light block_swap = fast.
    if (wf.vramSafe && resolution) {
      const vs = wf.vramSafe;
      const r = Math.floor(Number(resolution));
      if (vs.vaeTilingNode && r >= (vs.tilingThreshold || 400)) {
        setField(graph, { node: vs.vaeTilingNode, field: "enable_vae_tiling" }, true);
      }
      if (vs.blockSwapNode && r >= (vs.swapThreshold || 640)) {
        setField(graph, { node: vs.blockSwapNode, field: "blocks_to_swap" }, vs.blocksHigh || 30);
      }
    }

    // Boolean toggles (e.g. Qwen's 4-step LoRA switch).
    for (const t of wf.toggles || []) {
      const v = req.body.toggles?.[t.key];
      setField(graph, { node: t.node, field: t.field }, v === undefined ? !!t.default : !!v);
    }

    // Export options for video workflows (use the clean decoded frames, node `exportFramesNode`):
    //  - "png":     drop the mp4, save the full raw frame sequence as lossless PNG.
    //  - "mp4+png": keep the mp4, ALSO save just the last decoded frame as a lossless PNG —
    //               so you can chain segments (last frame → next i2v input) without the quality
    //               loss of extracting a frame from the compressed video.
    const ef = req.body.exportFormat;
    if ((ef === "png" || ef === "mp4+png") && wf.exportFramesNode) {
      const pfx = (prefix && String(prefix).trim()) || "frames/ComfyUI";
      if (ef === "png") {
        if (wf.videoSaveNode) delete graph[wf.videoSaveNode];
        graph["__pngseq"] = {
          class_type: "SaveImage",
          inputs: { filename_prefix: pfx, images: [String(wf.exportFramesNode), 0] },
          _meta: { title: "PNG sequence" },
        };
      } else {
        // Keep the mp4 (videoSaveNode untouched) and add a last-frame PNG branch.
        const nFrames = Math.floor(Number(frames) || wf.defaults?.frames || 1);
        graph["__lastframe_pick"] = {
          class_type: "ImageFromBatch",
          inputs: { image: [String(wf.exportFramesNode), 0], batch_index: Math.max(0, nFrames - 1), length: 1 },
          _meta: { title: "Last frame" },
        };
        graph["__lastframe_save"] = {
          class_type: "SaveImage",
          inputs: { filename_prefix: `${pfx}_lastframe`, images: ["__lastframe_pick", 0] },
          _meta: { title: "Last frame PNG" },
        };
      }
    }

    const result = await comfy.queue(graph);
    if (result.node_errors && Object.keys(result.node_errors).length) {
      return res.status(400).json({ error: "Workflow node errors", node_errors: result.node_errors });
    }
    pending.set(result.prompt_id, { saveDir, seed: usedSeed });
    res.json({ promptId: result.prompt_id, seed: usedSeed });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e), detail: e.detail });
  }
});

// Delete a Mac-saved copy. Restricted to files this app saved this session.
app.post("/api/delete", async (req, res) => {
  const { path: p } = req.body;
  if (!p) return res.json({ ok: true, deleted: false });
  if (!savedPaths.has(p)) return res.status(403).json({ ok: false, error: "not a saved file" });
  try {
    await unlink(p);
  } catch (e) {
    // already gone is fine — fall through
  }
  savedPaths.delete(p);
  res.json({ ok: true, deleted: true });
});

app.post("/api/interrupt", async (req, res) => {
  try {
    await comfy.interrupt();
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

// Cancel everything on ComfyUI: drop pending prompts + stop the one running.
app.post("/api/cancel", async (req, res) => {
  try {
    await comfy.clearQueue();
    await comfy.interrupt();
    queueRemaining = 0;
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

// Switch connection target: { mode: "auto" } re-probes, { mode: <index> } forces a host.
app.post("/api/host", async (req, res) => {
  try {
    const { mode } = req.body;
    if (mode === "auto") {
      connMode = "auto";
      activeHostIndex = await pickAutoHost();
    } else {
      const idx = Number(mode);
      if (!hosts[idx]) return res.status(400).json({ error: "bad host index" });
      connMode = idx;
      activeHostIndex = idx;
    }
    comfy.setBase(hostBase(hosts[activeHostIndex]));
    res.json({ ok: true, mode: connMode, activeHostIndex, label: hosts[activeHostIndex].label });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Set/persist the RunPod ComfyUI proxy URL (it changes per pod). Reconnects live
// if RunPod is the active target. Pass { url: "" } to clear it.
app.post("/api/runpod-url", async (req, res) => {
  try {
    if (!runpodHost) return res.status(400).json({ error: "no RunPod host configured" });
    const url = String(req.body?.url || "").trim().replace(/\/$/, "");
    runpodHost.url = url;
    try {
      await writeFile(runpodUrlFile, url, "utf8");
    } catch {}
    if (hosts[activeHostIndex] === runpodHost) comfy.setBase(hostBase(runpodHost));
    res.json({ ok: true, url });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Hot-reload this instance's workflow registry from config.json + the template files.
// Lets new/edited workflows be picked up WITHOUT a restart — so adding a RunPod workflow
// never forces a refresh of the separate local instance (and vice-versa). Connection/host
// state is left untouched on purpose.
app.post("/api/reload", async (req, res) => {
  try {
    await loadConfig();
    res.json({ ok: true, target: TARGET, workflows: targetWorkflowDefs.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Open a native macOS folder picker (the server runs on the Mac, so the Finder dialog appears
// on screen). Returns the chosen POSIX path, or { canceled: true } if dismissed. Browsers can't
// hand a real filesystem path to the server, so this native dialog is the way to do it.
app.post("/api/pick-folder", async (req, res) => {
  try {
    const cur = expandHome(String(req.body?.current || "").trim());
    const defaultClause = cur && existsSync(cur) ? ` default location (POSIX file ${JSON.stringify(cur)})` : "";
    const script = `POSIX path of (choose folder with prompt "Scegli la cartella di salvataggio"${defaultClause})`;
    const { stdout } = await execFileP("osascript", ["-e", "tell application \"System Events\" to activate", "-e", script]);
    res.json({ path: stdout.trim().replace(/\/$/, "") });
  } catch (e) {
    // user canceled (-128) or no GUI available — not a real error
    res.json({ canceled: true });
  }
});

// Save a "package": a folder with the rendered file + recipe.json (full params + input image),
// so a render can be recreated exactly later by importing the recipe.
app.post("/api/package", async (req, res) => {
  try {
    const { name, params, output, isVideo, saveDir, workflowName } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const safe = String(name).replace(/[^\w\-. ]/g, "_").trim() || "package";
    const base = saveDir && saveDir.trim() ? expandHome(saveDir.trim()) : defaultSaveDir;
    const dir = join(base, "packages", safe);
    await mkdir(dir, { recursive: true });

    let renderName = null;
    if (output?.filename) {
      const r = await fetch(comfy.imageUrl(output));
      if (r.ok) {
        const ext = output.filename.split(".").pop() || (isVideo ? "mp4" : "png");
        renderName = `render.${ext}`;
        await writeFile(join(dir, renderName), Buffer.from(await r.arrayBuffer()));
      }
    }

    async function bundleInput(filename, basename) {
      if (!filename) return null;
      const r = await fetch(comfy.imageUrl({ filename, type: "input" }));
      if (!r.ok) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      const ext = filename.split(".").pop() || "png";
      await writeFile(join(dir, `${basename}.${ext}`), buf);
      return { filename: `${basename}.${ext}`, dataBase64: buf.toString("base64") };
    }
    const input = await bundleInput(params?.image, "input");
    const input2 = await bundleInput(params?.image2, "input2");

    const recipe = {
      app: "comfy-mac",
      version: 1,
      savedAt: new Date().toISOString(),
      workflow: params?.workflow,
      workflowName,
      params,
      input,
      input2,
    };
    await writeFile(join(dir, "recipe.json"), JSON.stringify(recipe, null, 2));
    res.json({ ok: true, dir, render: renderName });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/free", async (req, res) => {
  try {
    await comfy.free();
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

// Retrieve the most recent renders straight from ComfyUI's history (on the PC).
// Lets you recover a batch's results after the Mac was asleep/closed while it ran.
// Note: ComfyUI's history is in-memory — it only covers renders since ComfyUI last started.
app.get("/api/history", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 10));
    const r = await fetch(`${comfy.base}/history?max_items=${limit}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`ComfyUI /history returned ${r.status}`);
    const hist = await r.json();
    const items = [];
    for (const [promptId, entry] of Object.entries(hist)) {
      let isVideo = false;
      const images = [];
      for (const node of Object.values(entry.outputs || {})) {
        for (const im of node.images || []) {
          if (/\.(mp4|webm|mov|gif)$/i.test(im.filename || "")) isVideo = true;
          images.push(
            "/api/image?" +
              new URLSearchParams({
                filename: im.filename,
                subfolder: im.subfolder ?? "",
                type: im.type ?? "output",
                v: promptId, // cache-bust: ComfyUI recycles filenames after its output folder is cleared
              }),
          );
        }
      }
      if (images.length) items.push({ promptId, images, isVideo });
    }
    items.reverse(); // newest first
    res.json({ items });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

// Status of one prompt — the frontend watchdog uses this to recover when a
// completion event was missed (websocket/SSE blip, ComfyUI restart, Mac asleep),
// so the UI never stays frozen on "Loading model…".
app.get("/api/prompt-status", async (req, res) => {
  const id = String(req.query.id || "");
  if (!id) return res.status(400).json({ error: "id required" });
  try {
    // Still queued or running?
    const q = await (await fetch(`${comfy.base}/queue`, { signal: AbortSignal.timeout(4000) })).json();
    const live = [...(q.queue_running || []), ...(q.queue_pending || [])].some((e) => e?.[1] === id);
    if (live) return res.json({ state: "running" });

    // Finished — look it up in history.
    let entry = null;
    try {
      const hr = await fetch(`${comfy.base}/history/${id}`, { signal: AbortSignal.timeout(4000) });
      if (hr.ok) entry = (await hr.json())?.[id] || null;
    } catch {}
    if (entry) {
      let isVideo = false;
      const images = [];
      for (const node of Object.values(entry.outputs || {})) {
        for (const im of node.images || []) {
          if (/\.(mp4|webm|mov|gif)$/i.test(im.filename || "")) isVideo = true;
          images.push(
            "/api/image?" +
              new URLSearchParams({ filename: im.filename, subfolder: im.subfolder ?? "", type: im.type ?? "output", v: id }),
          );
        }
      }
      if (images.length) return res.json({ state: "done", images, isVideo });
    }
    return res.json({ state: "missing" });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

// Receive an image from the Mac (raw bytes) and forward it to ComfyUI's input folder.
app.post("/api/upload", express.raw({ type: () => true, limit: "30mb" }), async (req, res) => {
  try {
    const filename = (req.query.filename || "upload.png").toString();
    const r = await comfy.uploadImage(req.body, filename, req.headers["content-type"]);
    const name = r.subfolder ? `${r.subfolder}/${r.name}` : r.name;
    res.json({ name });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

// Proxy the rendered image/video from ComfyUI so the browser never talks to the PC directly.
// Relays Range requests so <video> playback/seeking works.
app.get("/api/image", async (req, res) => {
  const { filename, subfolder = "", type = "output" } = req.query;
  if (!filename) return res.status(400).send("filename required");
  try {
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await fetch(comfy.imageUrl({ filename, subfolder, type }), { headers });
    if (!upstream.ok && upstream.status !== 206) return res.status(upstream.status).end();
    res.status(upstream.status);
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.status(502).send(String(e.message || e));
  }
});

const port = Number(process.env.PORT) || config.server.port;
app.listen(port, () => {
  console.log(`\n  comfy-mac [${TARGET}] → http://localhost:${port}`);
  console.log(`  ComfyUI   → ${comfy.base}\n`);
});

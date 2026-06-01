const $ = (id) => document.getElementById(id);

const el = {
  modeTabs: $("modeTabs"),
  emptyMode: $("emptyMode"),
  genArea: $("genArea"),
  workflow: $("workflow"),
  imageField: $("imageField"),
  dropzone: $("dropzone"),
  imageInput: $("imageInput"),
  dzHint: $("dzHint"),
  imagePreview: $("imagePreview"),
  imageClear: $("imageClear"),
  sizeField: $("sizeField"),
  positive: $("positive"),
  positiveLabel: $("positiveLabel"),
  negative: $("negative"),
  negativeField: $("negativeField"),
  cfgField: $("cfgField"),
  seed: $("seed"),
  randomBtn: $("randomBtn"),
  count: $("count"),
  sampler: $("sampler"),
  scheduler: $("scheduler"),
  toggles: $("toggles"),
  denoise: $("denoise"),
  denoiseRange: $("denoiseRange"),
  denoiseHint: $("denoiseHint"),
  samplerField: $("samplerField"),
  schedulerField: $("schedulerField"),
  denoiseField: $("denoiseField"),
  prefix: $("prefix"),
  saveDir: $("saveDir"),
  steps: $("steps"),
  cfg: $("cfg"),
  width: $("width"),
  height: $("height"),
  swap: $("swap"),
  presets: $("presets"),
  resolution: $("resolution"),
  resolutionField: $("resolutionField"),
  frames: $("frames"),
  framesField: $("framesField"),
  fps: $("fps"),
  fpsField: $("fpsField"),
  resultVideo: $("resultVideo"),
  tabs: $("tabs"),
  addToQueue: $("addToQueue"),
  queue: $("queue"),
  runQueue: $("runQueue"),
  clearQueue: $("clearQueue"),
  generate: $("generate"),
  placeholder: $("placeholder"),
  result: $("result"),
  progress: $("progress"),
  bar: $("bar"),
  progressText: $("progressText"),
  resultbar: $("resultbar"),
  resultMeta: $("resultMeta"),
  useSeed: $("useSeed"),
  savePackage: $("savePackage"),
  importBtn: $("importBtn"),
  importFile: $("importFile"),
  download: $("download"),
  openFull: $("openFull"),
  history: $("history"),
  dot: $("dot"),
  statusText: $("statusText"),
  connSelect: $("connSelect"),
  freeVram: $("freeVram"),
  toast: $("toast"),
};

let randomize = true;
let currentPromptId = null;
let lastPromptId = null;
let lastSeed = null;
let metaBase = "";
let currentUrl = null;
let pendingParams = null;
let rendering = false;
let currentLabel = "";
let currentWrap = null; // the result currently shown in the canvas
let onRenderDone = null; // resolves when the in-flight single render completes
const imageWraps = new Map(); // promptId -> history thumbnail element

// Workflows
let workflowsList = [];
let currentWorkflow = null;
let currentMode = "text2img";
let toggleState = JSON.parse(localStorage.getItem("comfy-mac") || "{}").toggles || {};
let uploadedImage = null; // filename in ComfyUI's input folder (for img2img)

// Batch queue
let queue = []; // { positive, negative }
const batchJobs = new Map(); // promptId -> { item, params, seed, row, wrap, _path }
let batchActive = 0;

// ---- Persistence ----
const saved = JSON.parse(localStorage.getItem("comfy-mac") || "{}");
el.positive.value = saved.positive || "";
el.negative.value = saved.negative || "";
if (saved.seed) el.seed.value = saved.seed;
el.prefix.value = saved.prefix || "";
// Only keep a genuinely-custom save folder; the old hardcoded default migrates to config's default.
if (saved.saveDir && saved.saveDir !== "~/Pictures/comfy-mac") el.saveDir.value = saved.saveDir;
if (saved.width) el.width.value = saved.width;
if (saved.height) el.height.value = saved.height;
if (saved.steps) el.steps.value = saved.steps;
if (saved.cfg) el.cfg.value = saved.cfg;
if (saved.count) el.count.value = saved.count;
if (saved.sampler) el.sampler.value = saved.sampler;
if (saved.scheduler) el.scheduler.value = saved.scheduler;
if (saved.denoise) el.denoise.value = saved.denoise;
if (saved.resolution) el.resolution.value = saved.resolution;
if (saved.frames) el.frames.value = saved.frames;
if (saved.fps) el.fps.value = saved.fps;
if (saved.randomize === false) setRandomize(false);
queue = (saved.queue || []).map((q) => ({ positive: q.positive, negative: q.negative }));

function persist() {
  localStorage.setItem(
    "comfy-mac",
    JSON.stringify({
      positive: el.positive.value,
      negative: el.negative.value,
      seed: el.seed.value,
      prefix: el.prefix.value,
      saveDir: el.saveDir.value,
      width: el.width.value,
      height: el.height.value,
      steps: el.steps.value,
      cfg: el.cfg.value,
      count: el.count.value,
      sampler: el.sampler.value,
      scheduler: el.scheduler.value,
      denoise: el.denoise.value,
      resolution: el.resolution.value,
      frames: el.frames.value,
      fps: el.fps.value,
      randomize,
      mode: currentMode,
      workflow: currentWorkflow?.id,
      toggles: toggleState,
      queue: queue.map((q) => ({ positive: q.positive, negative: q.negative })),
    }),
  );
}
[
  el.positive, el.negative, el.seed, el.prefix, el.saveDir, el.width, el.height,
  el.steps, el.cfg, el.count, el.sampler, el.scheduler, el.denoise,
  el.resolution, el.frames, el.fps,
].forEach((n) => n.addEventListener(n.tagName === "SELECT" ? "change" : "input", persist));

// ---- Denoise slider <-> number ----
function syncDenoiseRange() {
  el.denoiseRange.value = el.denoise.value || 1;
  const v = parseFloat(el.denoise.value);
  el.denoiseHint.textContent = isNaN(v)
    ? ""
    : v <= 0.45
      ? "· stays close to the input"
      : v >= 0.8
        ? "· changes a lot"
        : "· balanced";
}
el.denoiseRange.addEventListener("input", () => {
  el.denoise.value = el.denoiseRange.value;
  syncDenoiseRange();
  persist();
});
el.denoise.addEventListener("input", syncDenoiseRange);

// ---- Size: swap + aspect presets ----
function syncPreset() {
  const w = el.width.value,
    h = el.height.value;
  for (const b of el.presets.children) {
    b.classList.toggle("active", b.dataset.w === w && b.dataset.h === h);
  }
}
el.swap.addEventListener("click", () => {
  [el.width.value, el.height.value] = [el.height.value, el.width.value];
  persist();
  syncPreset();
});
el.presets.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  el.width.value = b.dataset.w;
  el.height.value = b.dataset.h;
  persist();
  syncPreset();
});
[el.width, el.height].forEach((n) => n.addEventListener("input", syncPreset));

// ---- Seed toggle ----
function setRandomize(on) {
  randomize = on;
  el.randomBtn.classList.toggle("is-on", on);
  el.seed.disabled = on;
  el.seed.placeholder = on ? "random" : "enter a seed";
  persist();
}
el.randomBtn.addEventListener("click", () => setRandomize(!randomize));

// Switch top-level mode (text2img / img2img / img2vid): filter workflows, pick one.
function setMode(mode, { workflowId = null, applyDefaults = true } = {}) {
  currentMode = mode;
  for (const b of el.modeTabs.children) b.classList.toggle("is-active", b.dataset.mode === mode);

  const list = workflowsList.filter((w) => (w.type || "text2img") === mode);
  const empty = list.length === 0;
  el.emptyMode.classList.toggle("hidden", !empty);
  el.genArea.classList.toggle("hidden", empty);
  if (empty) {
    currentWorkflow = null;
    persist();
    return;
  }

  el.workflow.innerHTML = "";
  for (const w of list) {
    const opt = document.createElement("option");
    opt.value = w.id;
    opt.textContent = w.name;
    el.workflow.append(opt);
  }
  const id = list.some((w) => w.id === workflowId) ? workflowId : list[0].id;
  applyWorkflow(id, applyDefaults);
}

// Render boolean toggle checkboxes for the current workflow (e.g. Qwen's 4-step LoRA).
function renderToggles() {
  el.toggles.innerHTML = "";
  for (const t of currentWorkflow?.toggles || []) {
    const row = document.createElement("label");
    row.className = "toggle-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = toggleState[t.key] ?? t.default;
    cb.addEventListener("change", () => {
      toggleState[t.key] = cb.checked;
      persist();
    });
    const span = document.createElement("span");
    span.textContent = t.label;
    row.append(cb, span);
    el.toggles.append(row);
  }
}

// Adapt the controls to the chosen workflow and (optionally) load its defaults.
function applyWorkflow(id, applyDefaults) {
  currentWorkflow = workflowsList.find((w) => w.id === id) || null;
  if (!currentWorkflow) return;
  el.workflow.value = currentWorkflow.id;

  const has = currentWorkflow.has || {};
  el.negativeField.classList.toggle("hidden", !has.negative);
  el.positiveLabel.textContent = has.negative ? "Positive prompt" : "Prompt";
  el.cfgField.classList.toggle("hidden", !has.cfg);
  el.samplerField.classList.toggle("hidden", !has.sampler);
  el.schedulerField.classList.toggle("hidden", !has.scheduler);
  el.denoiseField.classList.toggle("hidden", !has.denoise);
  el.imageField.classList.toggle("hidden", !has.image);
  el.sizeField.classList.toggle("hidden", !has.width);
  el.resolutionField.classList.toggle("hidden", !has.resolution);
  el.framesField.classList.toggle("hidden", !has.frames);
  el.fpsField.classList.toggle("hidden", !has.fps);
  renderToggles();

  if (applyDefaults) {
    if (has.negative && currentWorkflow.defaultNegative) el.negative.value = currentWorkflow.defaultNegative;
    const d = currentWorkflow.defaults || {};
    if (d.steps != null) el.steps.value = d.steps;
    if (d.cfg != null) el.cfg.value = d.cfg;
    if (d.sampler != null) el.sampler.value = d.sampler;
    if (d.scheduler != null) el.scheduler.value = d.scheduler;
    if (d.denoise != null) el.denoise.value = d.denoise;
    if (d.width != null) el.width.value = d.width;
    if (d.height != null) el.height.value = d.height;
    if (d.resolution != null) el.resolution.value = d.resolution;
    if (d.frames != null) el.frames.value = d.frames;
    if (d.fps != null) el.fps.value = d.fps;
    syncPreset();
  }
  syncDenoiseRange();
  persist();
}

el.modeTabs.addEventListener("click", (e) => {
  const t = e.target.closest(".modetab");
  if (t) setMode(t.dataset.mode);
});
el.workflow.addEventListener("change", () => applyWorkflow(el.workflow.value, true));

// ---- Input image (img2img) ----
async function uploadImageFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    toast("Choose an image file");
    return;
  }
  el.imagePreview.src = URL.createObjectURL(file);
  el.imagePreview.classList.remove("hidden");
  el.imageClear.classList.remove("hidden");
  el.dzHint.classList.add("hidden");
  uploadedImage = null;
  try {
    const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name || "upload.png")}`, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "upload failed");
    uploadedImage = data.name;
  } catch (e) {
    toast("Upload failed: " + (e.message || e));
    clearImage();
  }
}

function clearImage() {
  uploadedImage = null;
  el.imagePreview.src = "";
  el.imagePreview.classList.add("hidden");
  el.imageClear.classList.add("hidden");
  el.dzHint.classList.remove("hidden");
  el.imageInput.value = "";
}

el.dropzone.addEventListener("click", () => el.imageInput.click());
el.imageInput.addEventListener("change", () => uploadImageFile(el.imageInput.files[0]));
el.imageClear.addEventListener("click", (e) => {
  e.stopPropagation();
  clearImage();
});
["dragover", "dragenter"].forEach((ev) =>
  el.dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    el.dropzone.classList.add("dragover");
  }),
);
["dragleave", "drop"].forEach((ev) =>
  el.dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    el.dropzone.classList.remove("dragover");
  }),
);
el.dropzone.addEventListener("drop", (e) => uploadImageFile(e.dataTransfer.files[0]));

// ---- Init defaults + status ----
async function init() {
  try {
    const cfg = await (await fetch("/api/config")).json();
    workflowsList = cfg.workflows || [];
    if (!el.saveDir.value && cfg.defaultSaveDir) el.saveDir.value = cfg.defaultSaveDir;

    const conn = cfg.connection;
    if (conn && conn.hosts?.length) {
      el.connSelect.innerHTML = "";
      const auto = document.createElement("option");
      auto.value = "auto";
      auto.textContent = "Auto";
      el.connSelect.append(auto);
      conn.hosts.forEach((h, i) => {
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = h.label;
        el.connSelect.append(o);
      });
      el.connSelect.value = conn.mode === "auto" ? "auto" : String(conn.activeHostIndex);
    }

    const wid = workflowsList.some((w) => w.id === saved.workflow) ? saved.workflow : cfg.defaultWorkflow;
    const initialWf = workflowsList.find((w) => w.id === wid);
    const initialMode = saved.mode || initialWf?.type || "text2img";
    setMode(initialMode, { workflowId: wid, applyDefaults: false });

    const d = currentWorkflow?.defaults || {};
    el.steps.value ||= d.steps ?? 4;
    el.cfg.value ||= d.cfg ?? 1;
    el.width.value ||= d.width ?? 1024;
    el.height.value ||= d.height ?? 1024;
    if (!saved.sampler && d.sampler) el.sampler.value = d.sampler;
    if (!saved.scheduler && d.scheduler) el.scheduler.value = d.scheduler;
    if (!saved.denoise && d.denoise != null) el.denoise.value = d.denoise;
    if (!saved.resolution && d.resolution != null) el.resolution.value = d.resolution;
    if (!saved.frames && d.frames != null) el.frames.value = d.frames;
    if (!saved.fps && d.fps != null) el.fps.value = d.fps;
  } catch {}
  syncPreset();
  syncDenoiseRange();
  refreshHealth();
}

async function refreshHealth() {
  try {
    const h = await (await fetch("/api/health")).json();
    if (h.ok && h.connected) {
      const name = (h.gpu?.name || "")
        .replace(/^cuda:\d+\s*/, "")
        .replace(/\s*:.*$/, "")
        .trim();
      const vram = h.gpu ? ` · ${gb(h.gpu.vramTotal - h.gpu.vramFree)}/${gb(h.gpu.vramTotal)} GB used` : "";
      const host = h.hostLabel ? ` · ${h.hostLabel}` : "";
      setStatus("ok", (name || `ComfyUI ${h.comfyui || ""}`) + vram + host);
    } else {
      setStatus("bad", "ComfyUI unreachable" + (h.hostLabel ? ` (${h.hostLabel})` : ""));
    }
  } catch {
    setStatus("bad", "server offline");
  }
}

const gb = (b) => (b / 1024 ** 3).toFixed(1);

function setStatus(kind, text) {
  el.dot.className = "dot " + (kind === "ok" ? "ok" : kind === "bad" ? "bad" : "");
  el.statusText.textContent = text;
}

// ---- Live event stream ----
function connectStream() {
  const es = new EventSource("/api/stream");
  es.onmessage = (e) => handleEvent(JSON.parse(e.data));
  es.onerror = () => setStatus("bad", "reconnecting…");
}

function handleEvent(msg) {
  switch (msg.type) {
    case "socket":
      if (msg.connected) refreshHealth();
      else setStatus("bad", "ComfyUI disconnected");
      break;
    case "progress": {
      const job = batchJobs.get(msg.promptId);
      if (job) {
        if (msg.max) setItemStatus(job.item, `rendering ${msg.value}/${msg.max}`, "rendering");
        if (job.item._thumb && !job.completed) job.item._thumb.innerHTML = '<div class="spinner"></div>';
        break;
      }
      if (msg.promptId === currentPromptId && msg.max) {
        el.bar.style.width = (msg.value / msg.max) * 100 + "%";
        const p = currentLabel ? currentLabel + " · " : "";
        el.progressText.textContent = `${p}Step ${msg.value} / ${msg.max}`;
      }
      break;
    }
    case "executing": {
      const job = batchJobs.get(msg.promptId);
      if (job) {
        if (!job.completed) {
          setItemStatus(job.item, "rendering…", "rendering");
          if (job.item._thumb) job.item._thumb.innerHTML = '<div class="spinner"></div>';
        }
        break;
      }
      if (msg.promptId === currentPromptId)
        el.progressText.textContent = (currentLabel ? currentLabel + " · " : "") + "Rendering…";
      break;
    }
    case "image": {
      const job = batchJobs.get(msg.promptId);
      if (job) {
        completeJob(job, msg.images[0], msg.isVideo);
        break;
      }
      if (msg.promptId === currentPromptId) showImage(msg.images[0], msg.promptId, msg.isVideo);
      break;
    }
    case "saved": {
      const job = batchJobs.get(msg.promptId);
      if (job) {
        job._path = msg.path;
        if (job.wrap) job.wrap._path = msg.path;
        break;
      }
      const wrap = imageWraps.get(msg.promptId);
      if (wrap) {
        wrap._path = msg.path;
        if (wrap._url === currentUrl) {
          el.resultMeta.textContent = (wrap._meta || metaBase) + " · ✓ saved";
          el.resultMeta.title = msg.path;
        }
      }
      break;
    }
    case "saveError": {
      if (batchJobs.has(msg.promptId)) break;
      if (msg.promptId === lastPromptId) toast("Couldn't save: " + msg.message);
      break;
    }
    case "done": {
      const job = batchJobs.get(msg.promptId);
      if (job) {
        if (!job.completed) finishJob(job, {});
        break;
      }
      if (msg.promptId === currentPromptId) renderStepDone();
      break;
    }
    case "error": {
      const job = batchJobs.get(msg.promptId);
      if (job) {
        finishJob(job, { error: msg.message });
        break;
      }
      if (msg.promptId === currentPromptId || (!msg.promptId && rendering)) {
        toast(msg.message);
        renderStepDone();
      }
      break;
    }
  }
}

// ---- Generate ----
function buildBody(positive, negative, seed) {
  return {
    workflow: currentWorkflow?.id,
    positive,
    negative,
    image: uploadedImage,
    seed,
    prefix: el.prefix.value,
    saveDir: el.saveDir.value,
    steps: el.steps.value,
    cfg: el.cfg.value,
    sampler: el.sampler.value,
    scheduler: el.scheduler.value,
    denoise: el.denoise.value,
    width: el.width.value,
    height: el.height.value,
    resolution: el.resolution.value,
    frames: el.frames.value,
    fps: el.fps.value,
    toggles: { ...toggleState },
  };
}

function paramsFrom(body, seed) {
  return {
    workflow: body.workflow,
    positive: body.positive,
    negative: body.negative,
    image: body.image,
    steps: body.steps,
    cfg: body.cfg,
    sampler: body.sampler,
    scheduler: body.scheduler,
    denoise: body.denoise,
    width: body.width,
    height: body.height,
    resolution: body.resolution,
    frames: body.frames,
    fps: body.fps,
    toggles: body.toggles,
    prefix: body.prefix,
    seed,
  };
}

// img2img needs an uploaded image first.
function needsImageButMissing() {
  if (currentWorkflow?.has?.image && !uploadedImage) {
    toast("Carica un'immagine di input prima");
    return true;
  }
  return false;
}

function imageCount() {
  return Math.max(1, Math.min(50, parseInt(el.count.value) || 1));
}

// img2img follows the input size; img2vid shows its resolution; text2img shows w×h.
function metaText(seed, steps, w, h) {
  const has = currentWorkflow?.has || {};
  const size = has.width ? ` · ${w}×${h}` : has.resolution ? ` · ${el.resolution.value}p` : "";
  return `seed ${seed} · ${steps} steps${size}`;
}

async function generate() {
  if (rendering || batchActive) return;
  if (needsImageButMissing()) return;
  rendering = true;
  el.generate.disabled = true;
  el.progress.classList.remove("hidden");
  el.resultbar.classList.add("hidden");

  const count = imageCount();
  const base = parseInt(el.seed.value) || 0;
  for (let i = 0; i < count; i++) {
    const seed = randomize ? "" : String(base + i);
    currentLabel = count > 1 ? `Image ${i + 1}/${count}` : "";
    await generateOne(buildBody(el.positive.value, el.negative.value, seed));
  }

  rendering = false;
  currentLabel = "";
  el.generate.disabled = false;
  el.progress.classList.add("hidden");
}

// Submit one render; resolves when it finishes (or errors), so the count loop is sequential.
function generateOne(body) {
  return new Promise((resolve) => {
    onRenderDone = resolve;
    el.bar.style.width = "0%";
    el.progressText.textContent = currentLabel ? `${currentLabel} · queued…` : "Queued…";
    // If nothing has moved after a few seconds, the model is loading (WAN's first run is slow).
    setTimeout(() => {
      if (/queued/i.test(el.progressText.textContent)) {
        el.progressText.textContent = "Loading model… (first run can take 1–2 min)";
      }
    }, 5000);
    (async () => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed");
        currentPromptId = data.promptId;
        lastPromptId = data.promptId;
        lastSeed = data.seed;
        pendingParams = paramsFrom(body, data.seed);
      } catch (e) {
        toast(String(e.message || e));
        renderStepDone();
      }
    })();
  });
}

function renderStepDone() {
  currentPromptId = null;
  const r = onRenderDone;
  onRenderDone = null;
  if (r) r();
}

function showImage(url, promptId, isVideo) {
  metaBase = metaText(lastSeed, el.steps.value, el.width.value, el.height.value);
  const wrap = addHistory(url, metaBase, lastSeed, pendingParams, isVideo);
  if (promptId) imageWraps.set(promptId, wrap);
  view(wrap);
  refreshHealth();
}

function resetCanvas() {
  el.result.classList.add("hidden");
  el.resultVideo.classList.add("hidden");
  el.resultVideo.pause();
  el.placeholder.classList.remove("hidden");
  el.resultbar.classList.add("hidden");
  currentUrl = null;
  currentWrap = null;
}

// Display a history item (image or video) in the main canvas.
function view(wrap) {
  el.placeholder.classList.add("hidden");
  currentUrl = wrap._url;
  currentWrap = wrap;

  if (wrap._isVideo) {
    el.resultVideo.src = wrap._url;
    el.resultVideo.classList.remove("hidden");
    el.result.classList.add("hidden");
    el.resultVideo.play().catch(() => {});
  } else {
    el.result.src = wrap._url;
    el.result.classList.remove("hidden");
    el.resultVideo.classList.add("hidden");
    el.resultVideo.pause();
  }

  el.resultMeta.textContent = wrap._meta + (wrap._path ? " · ✓ saved" : "");
  el.resultMeta.title = wrap._path || "";
  el.resultbar.classList.remove("hidden");
  el.download.href = wrap._url;
  el.download.setAttribute("download", `comfy-${wrap._seed}.${wrap._isVideo ? "mp4" : "png"}`);
  el.openFull.href = wrap._url;
}

// Restore the prompt + settings that produced a past image, ready to re-edit.
function loadParams(p) {
  if (!p) return;
  if (p.workflow) {
    const w = workflowsList.find((x) => x.id === p.workflow);
    if (w) setMode(w.type || "text2img", { workflowId: p.workflow, applyDefaults: false });
  }
  if (p.toggles) {
    toggleState = { ...toggleState, ...p.toggles };
    renderToggles();
  }
  if (p.image) {
    uploadedImage = p.image;
    el.imagePreview.src = "/api/image?" + new URLSearchParams({ filename: p.image, type: "input" });
    el.imagePreview.classList.remove("hidden");
    el.imageClear.classList.remove("hidden");
    el.dzHint.classList.add("hidden");
  }
  el.positive.value = p.positive ?? "";
  el.negative.value = p.negative ?? "";
  if (p.prefix != null) el.prefix.value = p.prefix;
  if (p.width) el.width.value = p.width;
  if (p.height) el.height.value = p.height;
  if (p.steps) el.steps.value = p.steps;
  if (p.cfg !== undefined && p.cfg !== "") el.cfg.value = p.cfg;
  if (p.sampler) el.sampler.value = p.sampler;
  if (p.scheduler) el.scheduler.value = p.scheduler;
  if (p.denoise !== undefined && p.denoise !== "") el.denoise.value = p.denoise;
  if (p.resolution) el.resolution.value = p.resolution;
  if (p.frames) el.frames.value = p.frames;
  if (p.fps) el.fps.value = p.fps;
  if (p.seed != null) {
    el.seed.value = p.seed;
    setRandomize(false);
  }
  persist();
  syncPreset();
  syncDenoiseRange();
}

// ---- History (session only) ----
function addHistory(url, meta, seed, params, isVideo) {
  const wrap = document.createElement("div");
  wrap.className = "thumb";
  wrap._url = url;
  wrap._path = null;
  wrap._meta = meta;
  wrap._seed = seed;
  wrap._params = params;
  wrap._isVideo = isVideo;

  let media;
  if (isVideo) {
    media = document.createElement("video");
    media.src = url;
    media.muted = true;
    media.loop = true;
    media.playsInline = true;
    media.addEventListener("mouseenter", () => media.play().catch(() => {}));
    media.addEventListener("mouseleave", () => media.pause());
  } else {
    media = document.createElement("img");
    media.src = url;
  }
  media.title = "Click to load this prompt · seed " + seed;
  media.addEventListener("click", () => {
    view(wrap);
    loadParams(wrap._params);
  });

  const del = document.createElement("button");
  del.className = "thumb-del";
  del.textContent = "×";
  del.title = "Delete this (and its saved copy on this Mac)";
  del.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteThumb(wrap);
  });

  wrap.append(media, del);
  el.history.prepend(wrap);
  while (el.history.children.length > 12) el.history.lastChild.remove();
  return wrap;
}

async function deleteThumb(wrap) {
  const path = wrap._path;
  if (wrap._url === currentUrl) resetCanvas();
  wrap.remove();
  if (!path) return;
  try {
    const r = await fetch("/api/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast("Couldn't delete file: " + (d.error || r.status));
    }
  } catch {
    toast("Couldn't delete file");
  }
}

// ---- Tabs ----
let currentTab = "render";
el.tabs.addEventListener("click", (e) => {
  const t = e.target.closest(".tab");
  if (!t) return;
  currentTab = t.dataset.tab;
  for (const b of el.tabs.children) b.classList.toggle("is-active", b === t);
  const batch = currentTab === "batch";
  document.querySelectorAll(".batch-only").forEach((n) => n.classList.toggle("hidden", !batch));
  document.querySelectorAll(".render-only").forEach((n) => n.classList.toggle("hidden", batch));
});

// ---- Batch queue ----
function renderQueue() {
  el.queue.innerHTML = "";
  queue.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "q-item";

    const thumb = document.createElement("div");
    thumb.className = "q-thumb";
    thumb.innerHTML = `<span class="q-num">${i + 1}</span>`;

    const body = document.createElement("div");
    body.className = "q-body";
    const text = document.createElement("div");
    text.className = "q-text";
    text.textContent = item.positive || "(empty prompt)";
    const status = document.createElement("div");
    status.className = "q-status" + (item.statusKind ? " " + item.statusKind : "");
    status.textContent = item.status || "queued";
    body.append(text, status);

    const del = document.createElement("button");
    del.className = "q-del";
    del.textContent = "×";
    del.title = "Remove from queue";
    del.addEventListener("click", () => {
      if (batchActive) return;
      queue.splice(i, 1);
      persist();
      renderQueue();
      updateRunButton();
    });

    row.append(thumb, body, del);
    item.row = row;
    item._thumb = thumb;
    item._statusEl = status;
    el.queue.append(row);
  });
}

function updateRunButton() {
  el.runQueue.textContent = batchActive ? `Rendering… ${batchActive} left` : `Run queue${queue.length ? ` (${queue.length})` : ""}`;
  el.runQueue.disabled = batchActive > 0 || queue.length === 0;
  el.addToQueue.disabled = batchActive > 0;
  el.clearQueue.disabled = batchActive > 0;
}

function setItemStatus(item, text, kind) {
  item.status = text;
  item.statusKind = kind;
  if (item._statusEl) {
    item._statusEl.textContent = text;
    item._statusEl.className = "q-status" + (kind ? " " + kind : "");
  }
}

function addToQueue() {
  const positive = el.positive.value.trim();
  if (!positive) {
    toast("Type a positive prompt first");
    return;
  }
  queue.push({ positive, negative: el.negative.value });
  el.positive.value = "";
  persist();
  el.positive.focus();
  renderQueue();
  updateRunButton();
}

function clearQueueFn() {
  if (batchActive) return;
  queue = [];
  batchJobs.clear();
  persist();
  renderQueue();
  updateRunButton();
}

async function runQueue() {
  if (batchActive || rendering || !queue.length) return;
  if (needsImageButMissing()) return;
  batchJobs.clear();
  const count = imageCount();
  queue.forEach((it) => {
    it.status = "queued";
    it.statusKind = "";
    it.count = count;
    it.settled = 0;
    it.ok = 0;
  });
  renderQueue();
  batchActive = queue.length * count;
  updateRunButton();

  const base = parseInt(el.seed.value) || 0;
  for (const item of queue) {
    for (let k = 0; k < count; k++) {
      const seed = randomize ? "" : String(base + k);
      const body = buildBody(item.positive, item.negative, seed);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "queue failed");
        batchJobs.set(data.promptId, { item, params: paramsFrom(body, data.seed), seed: data.seed, completed: false });
      } catch (e) {
        settleItem(item, false);
        batchActive = Math.max(0, batchActive - 1);
        updateRunButton();
      }
    }
  }
}

function settleItem(item, ok) {
  item.settled = (item.settled || 0) + 1;
  if (ok) item.ok = (item.ok || 0) + 1;
  const n = item.count || 1;
  if (item.settled < n) {
    setItemStatus(item, `${item.ok || 0}/${n} done`, "rendering");
  } else if (item.ok > 0) {
    setItemStatus(item, n > 1 ? `✓ done (${item.ok})` : "✓ done", "done");
  } else {
    setItemStatus(item, "error", "error");
  }
}

function completeJob(job, url, isVideo) {
  if (job.completed) return;
  job.completed = true;
  if (job.item._thumb) {
    job.item._thumb.innerHTML = isVideo
      ? `<video src="${url}" muted loop playsinline></video>`
      : `<img src="${url}" alt="" />`;
  }

  lastSeed = job.seed;
  metaBase = metaText(job.seed, job.params.steps, job.params.width, job.params.height);
  const wrap = addHistory(url, metaBase, job.seed, job.params, isVideo);
  job.wrap = wrap;
  if (job._path) wrap._path = job._path;
  view(wrap);

  settleItem(job.item, true);
  batchActive = Math.max(0, batchActive - 1);
  updateRunButton();
}

function finishJob(job, { error }) {
  if (job.completed) return;
  job.completed = true;
  settleItem(job.item, false);
  batchActive = Math.max(0, batchActive - 1);
  updateRunButton();
}

el.addToQueue.addEventListener("click", addToQueue);
el.runQueue.addEventListener("click", runQueue);
el.clearQueue.addEventListener("click", clearQueueFn);

// ---- Use-seed button ----
el.useSeed.addEventListener("click", () => {
  if (lastSeed == null) return;
  setRandomize(false);
  el.seed.value = lastSeed;
  persist();
});

// ---- Save package (snapshot) ----
el.savePackage.addEventListener("click", async () => {
  if (!currentWrap) return;
  const def = `${el.prefix.value || "snapshot"}-${currentWrap._seed ?? ""}`;
  const name = prompt("Package name (folder):", def);
  if (!name) return;
  const u = new URL(currentWrap._url, location.origin);
  const output = {
    filename: u.searchParams.get("filename"),
    subfolder: u.searchParams.get("subfolder") || "",
    type: u.searchParams.get("type") || "output",
  };
  el.savePackage.disabled = true;
  el.savePackage.textContent = "Saving…";
  try {
    const r = await fetch("/api/package", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        params: currentWrap._params,
        output,
        isVideo: !!currentWrap._isVideo,
        saveDir: el.saveDir.value,
        workflowName: currentWorkflow?.name,
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "save failed");
    toast("Package saved → " + d.dir);
  } catch (e) {
    toast("Save failed: " + (e.message || e));
  }
  el.savePackage.textContent = "Save package";
  el.savePackage.disabled = false;
});

// ---- Import package (recipe.json) ----
el.importBtn.addEventListener("click", () => el.importFile.click());
el.importFile.addEventListener("change", async () => {
  const file = el.importFile.files[0];
  if (!file) return;
  try {
    const recipe = JSON.parse(await file.text());
    const params = recipe.params || recipe;
    loadParams(params);
    if (recipe.input?.dataBase64) {
      const bin = atob(recipe.input.dataBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await uploadImageFile(new File([bytes], recipe.input.filename || "input.png", { type: "image/png" }));
    }
    toast("Imported: " + (recipe.workflowName || params.workflow || "package"));
  } catch (e) {
    toast("Import failed: " + (e.message || e));
  }
  el.importFile.value = "";
});

// ---- Connection selector (Auto / LAN / Tailscale) ----
el.connSelect.addEventListener("change", async () => {
  const v = el.connSelect.value;
  setStatus("", "switching…");
  try {
    await fetch("/api/host", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: v === "auto" ? "auto" : Number(v) }),
    });
  } catch {}
  setTimeout(refreshHealth, 1500);
});

// ---- Free VRAM button ----
el.freeVram.addEventListener("click", async () => {
  el.freeVram.disabled = true;
  el.freeVram.textContent = "Freeing…";
  try {
    await fetch("/api/free", { method: "POST" });
  } catch {}
  el.freeVram.textContent = "Free VRAM";
  el.freeVram.disabled = false;
  setTimeout(refreshHealth, 700);
});

// ---- Wiring ----
el.generate.addEventListener("click", generate);
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    if (currentTab === "batch") addToQueue();
    else generate();
  }
});

function toast(text) {
  el.toast.textContent = text;
  el.toast.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.add("hidden"), 5000);
}

init();
renderQueue();
updateRunButton();
connectStream();
setInterval(refreshHealth, 15000);

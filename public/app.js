const $ = (id) => document.getElementById(id);

const el = {
  modeSelect: $("modeSelect"),
  emptyMode: $("emptyMode"),
  genArea: $("genArea"),
  workflow: $("workflow"),
  imageField: $("imageField"),
  imageLabel: $("imageLabel"),
  dropzone: $("dropzone"),
  imageInput: $("imageInput"),
  dzHint: $("dzHint"),
  imagePreview: $("imagePreview"),
  imageClear: $("imageClear"),
  imageField2: $("imageField2"),
  dropzone2: $("dropzone2"),
  imageInput2: $("imageInput2"),
  dzHint2: $("dzHint2"),
  imagePreview2: $("imagePreview2"),
  imageClear2: $("imageClear2"),
  sizeField: $("sizeField"),
  positive: $("positive"),
  positiveField: $("positiveField"),
  positiveLabel: $("positiveLabel"),
  negative: $("negative"),
  negativeField: $("negativeField"),
  cfgField: $("cfgField"),
  stepsField: $("stepsField"),
  seed: $("seed"),
  seedField: $("seedField"),
  countField: $("countField"),
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
  exportFormat: $("exportFormat"),
  exportFormatField: $("exportFormatField"),
  saveDir: $("saveDir"),
  pickFolder: $("pickFolder"),
  helpBtn: $("helpBtn"),
  helpModal: $("helpModal"),
  helpClose: $("helpClose"),
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
  secsSlider: $("secsSlider"),
  secsLabel: $("secsLabel"),
  fps: $("fps"),
  fpsField: $("fpsField"),
  duration: $("duration"),
  durationField: $("durationField"),
  shift: $("shift"),
  shiftField: $("shiftField"),
  loraHigh: $("loraHigh"),
  loraHighField: $("loraHighField"),
  resultVideo: $("resultVideo"),
  tabs: $("tabs"),
  controls: $("controls"),
  addToQueue: $("addToQueue"),
  queue: $("queue"),
  runQueue: $("runQueue"),
  clearQueue: $("clearQueue"),
  sbDrop: $("sbDrop"),
  sbFiles: $("sbFiles"),
  sbList: $("sbList"),
  sbRun: $("sbRun"),
  sbClear: $("sbClear"),
  sbOverrideEnable: $("sbOverrideEnable"),
  sbOverrideCount: $("sbOverrideCount"),
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
  lastFrame: $("lastFrame"),
  lastFrameImg: $("lastFrameImg"),
  history: $("history"),
  loadRecent: $("loadRecent"),
  recentN: $("recentN"),
  dot: $("dot"),
  statusText: $("statusText"),
  connSelect: $("connSelect"),
  runpodUrl: $("runpodUrl"),
  targetBadge: $("targetBadge"),
  freeVram: $("freeVram"),
  queueStatus: $("queueStatus"),
  cancelQueue: $("cancelQueue"),
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
let stopRequested = false; // set by "Annulla" to break out of a multi-image single render
let lastProgressAt = 0; // ms of last event for the in-flight render (watchdog)
let currentLabel = "";

// --- ETA: estimate time left from the rate of ComfyUI step/frame progress ---
// Keyed by promptId. Uses a smoothed time-per-step; resets when the step counter goes
// backwards (e.g. WAN's high→low-noise sampler split restarts the count, or a new phase).
const etaTrack = new Map();
function etaRemainingMs(promptId, value, max) {
  const now = Date.now();
  let s = etaTrack.get(promptId);
  if (!s || value < s.lastVal) {
    etaTrack.set(promptId, { perStep: 0, lastVal: value, lastT: now });
    return null;
  }
  const dv = value - s.lastVal;
  if (dv > 0) {
    const per = (now - s.lastT) / dv;
    s.perStep = s.perStep ? s.perStep * 0.6 + per * 0.4 : per; // EMA, smooth jitter
    s.lastVal = value;
    s.lastT = now;
  }
  if (!s.perStep || value >= max) return null;
  return (max - value) * s.perStep;
}
function fmtEta(ms) {
  if (ms == null) return "";
  const s = Math.round(ms / 1000);
  if (s < 1) return "";
  if (s < 60) return `~${s}s rimasti`;
  const m = Math.floor(s / 60), r = s % 60;
  return `~${m}m${r ? " " + r + "s" : ""} rimasti`;
}
let currentWrap = null; // the result currently shown in the canvas
let onRenderDone = null; // resolves when the in-flight single render completes
const imageWraps = new Map(); // promptId -> history thumbnail element

// Workflows
let workflowsList = [];
let currentWorkflow = null;
let currentMode = "text2img";
// This instance's target ("local" or "runpod"), set from /api/config. The server already
// sends only this target's workflows, so filtering is by mode, not by the connection dropdown.
let appTarget = "local";
let toggleState = JSON.parse(localStorage.getItem("comfy-mac") || "{}").toggles || {};

// Input image slots — workflows can declare one or two. Each slot owns its dropzone
// and the filename that came back from ComfyUI after upload.
const imageSlots = [
  { key: "image",  field: el.imageField,  dropzone: el.dropzone,  input: el.imageInput,  hint: el.dzHint,  preview: el.imagePreview,  clear: el.imageClear,  uploaded: null },
  { key: "image2", field: el.imageField2, dropzone: el.dropzone2, input: el.imageInput2, hint: el.dzHint2, preview: el.imagePreview2, clear: el.imageClear2, uploaded: null },
];
const imgSlot = (k) => imageSlots.find((s) => s.key === k);

// Batch queue
let queue = []; // { positive, negative, prefix }
let superEntries = []; // Super Batch: [{ name, workflow, positive, negative, count, format, width, height, saveDir }]
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
if (saved.duration) el.duration.value = saved.duration;
if (saved.shift) el.shift.value = saved.shift;
if (saved.loraHigh) el.loraHigh.value = saved.loraHigh;
if (saved.fps) el.fps.value = saved.fps;
if (saved.exportFormat) el.exportFormat.value = saved.exportFormat;
if (saved.randomize === false) setRandomize(false);
if (saved.sbOverrideEnable) el.sbOverrideEnable.checked = true;
if (saved.sbOverrideCount) el.sbOverrideCount.value = saved.sbOverrideCount;
queue = (saved.queue || []).map((q) => ({ positive: q.positive, negative: q.negative, prefix: q.prefix || "" }));

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
      duration: el.duration.value,
      shift: el.shift.value,
      loraHigh: el.loraHigh.value,
      randomize,
      mode: currentMode,
      workflow: currentWorkflow?.id,
      toggles: toggleState,
      exportFormat: el.exportFormat.value,
      sbOverrideEnable: el.sbOverrideEnable.checked,
      sbOverrideCount: el.sbOverrideCount.value,
      queue: queue.map((q) => ({ positive: q.positive, negative: q.negative, prefix: q.prefix })),
    }),
  );
}
[
  el.positive, el.negative, el.seed, el.prefix, el.saveDir, el.width, el.height,
  el.steps, el.cfg, el.count, el.sampler, el.scheduler, el.denoise,
  el.resolution, el.frames, el.fps, el.exportFormat,
].forEach((n) => n.addEventListener(n.tagName === "SELECT" ? "change" : "input", persist));

// Enforce the per-workflow minimum steps (WAN >= 15) when the user types a value.
el.steps.addEventListener("change", () => {
  const m = parseInt(el.steps.min) || 1;
  if ((parseInt(el.steps.value) || 0) < m) { el.steps.value = m; persist(); }
});

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
  let matchIdx = 0; // 0 == "Custom"
  for (let i = 0; i < el.presets.options.length; i++) {
    const o = el.presets.options[i];
    if (o.dataset.w === w && o.dataset.h === h) { matchIdx = i; break; }
  }
  el.presets.selectedIndex = matchIdx;
}
el.swap.addEventListener("click", () => {
  [el.width.value, el.height.value] = [el.height.value, el.width.value];
  persist();
  syncPreset();
});
el.presets.addEventListener("change", () => {
  const o = el.presets.selectedOptions[0];
  if (!o || !o.dataset.w) return; // "Custom" — leave W/H untouched
  el.width.value = o.dataset.w;
  el.height.value = o.dataset.h;
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

// Switch top-level mode (text2img / text2img-img / img2img / img2vid): filter workflows, pick one.
function setMode(mode, { workflowId = null, applyDefaults = true } = {}) {
  currentMode = mode;
  el.modeSelect.value = mode;

  // The server already scoped workflowsList to this instance's target, so filter by mode only.
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
      updateConditionalControls();
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
  el.samplerField.classList.toggle("hidden", !has.sampler);
  el.schedulerField.classList.toggle("hidden", !has.scheduler);
  // Denoise only does something when there's an input image to partially preserve
  // (img2img / image-edit). For pure text2img it's always 1.0, so hide it.
  el.denoiseField.classList.toggle("hidden", !(has.denoise && has.image));
  el.imageField.classList.toggle("hidden", !has.image);
  el.imageField2.classList.toggle("hidden", !has.image2);
  const isUpscale = currentWorkflow.type === "video-upscale";
  el.imageLabel.textContent = isUpscale ? "Input video" : has.image2 ? "Image 1" : "Input image";
  // Workflows with no prompt (e.g. video upscale) hide the prompt box entirely.
  el.positiveField.classList.toggle("hidden", has.prompt === false);
  // Seed + "images per prompt" only matter for sampler-based workflows. A deterministic
  // pass (GAN upscale, no seed field) ignores the seed, and re-running it N times yields N
  // identical files — so hide both and pin count to 1.
  el.seedField.classList.toggle("hidden", has.seed === false);
  // "Images per prompt" is hidden for deterministic passes (no seed) AND for text-to-video,
  // where batching multiple clips per prompt isn't wanted.
  const noCount = has.seed === false || currentWorkflow.type === "text2vid";
  el.countField.classList.toggle("hidden", noCount);
  if (noCount) el.count.value = "1";
  // Show the workflow's real save prefix as the placeholder (used when the field is left blank).
  el.prefix.placeholder = currentWorkflow.defaultPrefix || currentWorkflow.id;
  el.sizeField.classList.toggle("hidden", !has.width);
  el.resolutionField.classList.toggle("hidden", !has.resolution);
  el.durationField.classList.toggle("hidden", !has.duration);
  el.shiftField.classList.toggle("hidden", !has.shift);
  el.loraHighField.classList.toggle("hidden", !has.loraHigh);
  el.framesField.classList.toggle("hidden", !has.frames);
  el.fpsField.classList.toggle("hidden", !has.fps);
  // The WAN-video notes "?" is specific to that workflow for now — show it only there.
  el.helpBtn.classList.toggle("hidden", currentWorkflow.id !== "wan2.2-t2v");
  // Export format chooser (mp4 / PNG sequence) — only for workflows that support it (img2vid).
  el.exportFormatField.classList.toggle("hidden", !currentWorkflow.exportChoice);
  // Per-workflow minimum steps (WAN needs >= 15 or its high/low-noise split breaks).
  el.steps.min = currentWorkflow.defaults?.minSteps || 1;
  // The workflow's declared steps/cfg are authoritative and always applied — otherwise a
  // value left over from another workflow (e.g. a 20-step test) leaks in across switches.
  const wd0 = currentWorkflow.defaults || {};
  if (wd0.steps != null) el.steps.value = wd0.steps;
  if (wd0.cfg != null) el.cfg.value = wd0.cfg;
  if (wd0.fps != null) el.fps.value = wd0.fps;
  if (wd0.frames != null) el.frames.value = wd0.frames;
  if (wd0.shift != null) el.shift.value = wd0.shift;
  if (wd0.loraHigh != null) el.loraHigh.value = wd0.loraHigh;
  if ((parseInt(el.steps.value) || 0) < el.steps.min) el.steps.value = el.steps.min;
  renderToggles();

  if (applyDefaults) {
    if (has.negative && currentWorkflow.defaultNegative) el.negative.value = currentWorkflow.defaultNegative;
    const d = currentWorkflow.defaults || {};
    if (d.sampler != null) el.sampler.value = d.sampler;
    if (d.scheduler != null) el.scheduler.value = d.scheduler;
    if (d.denoise != null) el.denoise.value = d.denoise;
    if (d.width != null) el.width.value = d.width;
    if (d.height != null) el.height.value = d.height;
    if (d.resolution != null) el.resolution.value = d.resolution;
    if (d.frames != null) el.frames.value = d.frames;
    if (d.duration != null) el.duration.value = d.duration;
    if (d.shift != null) el.shift.value = d.shift;
    if (d.loraHigh != null) el.loraHigh.value = d.loraHigh;
    if (d.fps != null) el.fps.value = d.fps;
    syncPreset();
  }
  updateConditionalControls();
  syncDenoiseRange();
  syncSecsFromFrames();
  persist();
}

// Hide the negative ONLY where it's truly inert: workflows whose cfg is <= 1 (turbo models,
// e.g. z-image-turbo), where classifier-free guidance is off. Everywhere cfg > 1 (Qwen,
// img2img, wan) the negative is shown. cfg and steps stay visible on every workflow.
// (Qwen "4-step fast mode" cosmetically overrides steps/cfg, but the fields are kept visible
// on purpose — the user wants them.)
// A "fast" Lightning toggle forces cfg to 1 via the workflow's switch nodes → negative inert.
function fastToggleOn() {
  for (const t of currentWorkflow?.toggles || []) {
    if ((toggleState[t.key] ?? t.default) && t.key === "fast") return true;
  }
  return false;
}
function updateConditionalControls() {
  const has = currentWorkflow?.has || {};
  const cfg = parseFloat(el.cfg.value);
  // Negative is inert when cfg <= 1 — either the workflow's own cfg, or because a fast
  // toggle pins cfg to 1. Hide it there.
  const negInert = (has.cfg && !isNaN(cfg) && cfg <= 1) || fastToggleOn();
  const negOk = !!has.negative && !negInert;
  el.negativeField.classList.toggle("hidden", !negOk);
  el.positiveLabel.textContent = negOk ? "Positive prompt" : "Prompt";
  el.cfgField.classList.toggle("hidden", !has.cfg);
  // Steps stay visible on every sampler-based model (they matter even on turbo). A
  // non-sampler workflow (GAN upscale) has no steps field — hide the dead control there.
  el.stepsField.classList.toggle("hidden", !has.steps);
}

// ---- Duration slider (1–5 s) ----
// Video length is driven by a seconds slider; WAN needs frame counts on the 4k+1 grid (its
// native 16fps clip lengths). The slider is the visible control; `#frames` stays the hidden
// source of truth that save/restore and the request body already read.
const FRAMES_BY_SEC = { 1: 17, 2: 33, 3: 49, 4: 65, 5: 81 };
function framesForSecs(s) { return FRAMES_BY_SEC[s] || 81; }
function secsForFrames(f) {
  const n = Number(f);
  for (const s of [1, 2, 3, 4, 5]) if (FRAMES_BY_SEC[s] === n) return s;
  return 5; // off-grid (e.g. a legacy value) → default to 5s
}
// Slider moved → set frames + label.
function applySecsSlider() {
  const s = Number(el.secsSlider.value);
  el.frames.value = framesForSecs(s);
  el.secsLabel.textContent = `${s} s · ${el.frames.value} frames`;
  persist();
}
// frames changed elsewhere (workflow default / restore) → move slider + label to match.
function syncSecsFromFrames() {
  const s = secsForFrames(el.frames.value);
  el.secsSlider.value = String(s);
  el.secsLabel.textContent = `${s} s · ${FRAMES_BY_SEC[s]} frames`;
}
el.secsSlider.addEventListener("input", applySecsSlider);

// ---- Help modal (WAN video notes) ----
function toggleHelp(show) { el.helpModal.classList.toggle("hidden", !show); }
el.helpBtn.addEventListener("click", () => toggleHelp(true));
el.helpClose.addEventListener("click", () => toggleHelp(false));
el.helpModal.addEventListener("click", (e) => { if (e.target === el.helpModal) toggleHelp(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggleHelp(false); });

// ---- Folder picker (native Finder dialog via the local server) ----
el.pickFolder.addEventListener("click", async () => {
  el.pickFolder.disabled = true;
  try {
    const r = await fetch("/api/pick-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: el.saveDir.value }),
    });
    const d = await r.json();
    if (d.path) {
      el.saveDir.value = d.path;
      persist();
    }
  } catch {}
  el.pickFolder.disabled = false;
});

el.modeSelect.addEventListener("change", () => setMode(el.modeSelect.value));
el.workflow.addEventListener("change", () => applyWorkflow(el.workflow.value, true));
el.cfg.addEventListener("input", updateConditionalControls);

// ---- Input image slots (img2img / img2vid / text2img-img) ----
async function uploadImageFile(slot, file) {
  const isVideo = !!file && file.type.startsWith("video/");
  if (!file || (!file.type.startsWith("image/") && !isVideo)) {
    toast("Choose an image or video file");
    return;
  }
  if (isVideo) {
    // <img> can't preview a video — show the filename in the hint instead.
    slot.preview.classList.add("hidden");
    slot.hint.textContent = file.name;
    slot.hint.classList.remove("hidden");
  } else {
    slot.preview.src = URL.createObjectURL(file);
    slot.preview.classList.remove("hidden");
    slot.hint.classList.add("hidden");
  }
  slot.clear.classList.remove("hidden");
  slot.uploaded = null;
  try {
    const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name || "upload.png")}`, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "upload failed");
    slot.uploaded = data.name;
  } catch (e) {
    toast("Upload failed: " + (e.message || e));
    clearImage(slot);
  }
}

// Re-show a previously-uploaded image (when restoring history or importing a recipe).
function restoreImageSlot(slot, filename) {
  if (!filename) return;
  slot.uploaded = filename;
  slot.preview.src = "/api/image?" + new URLSearchParams({ filename, type: "input" });
  slot.preview.classList.remove("hidden");
  slot.clear.classList.remove("hidden");
  slot.hint.classList.add("hidden");
}

function clearImage(slot) {
  slot.uploaded = null;
  slot.preview.src = "";
  slot.preview.classList.add("hidden");
  slot.clear.classList.add("hidden");
  if (slot.hintDefault) slot.hint.textContent = slot.hintDefault;
  slot.hint.classList.remove("hidden");
  slot.input.value = "";
}

for (const slot of imageSlots) {
  slot.hintDefault = slot.hint.textContent; // restored by clearImage after a video filename overwrite
  slot.dropzone.addEventListener("click", () => slot.input.click());
  slot.input.addEventListener("change", () => uploadImageFile(slot, slot.input.files[0]));
  slot.clear.addEventListener("click", (e) => {
    e.stopPropagation();
    clearImage(slot);
  });
  ["dragover", "dragenter"].forEach((ev) =>
    slot.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      slot.dropzone.classList.add("dragover");
    }),
  );
  ["dragleave", "drop"].forEach((ev) =>
    slot.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      slot.dropzone.classList.remove("dragover");
    }),
  );
  slot.dropzone.addEventListener("drop", (e) => uploadImageFile(slot, e.dataTransfer.files[0]));
}

// ---- Init defaults + status ----
async function init() {
  try {
    const cfg = await (await fetch("/api/config")).json();
    workflowsList = cfg.workflows || [];
    appTarget = cfg.target || "local";
    applyTargetBadge();
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
        if (h.editable) {
          runpodHostIndex = i;
          if (h.url) el.runpodUrl.value = h.url;
        }
      });
      el.connSelect.value = conn.mode === "auto" ? "auto" : String(conn.activeHostIndex);
      updateRunpodField();
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
    if (!saved.duration && d.duration != null) el.duration.value = d.duration;
    if (!saved.shift && d.shift != null) el.shift.value = d.shift;
    if (!saved.loraHigh && d.loraHigh != null) el.loraHigh.value = d.loraHigh;
    if (!saved.fps && d.fps != null) el.fps.value = d.fps;
  } catch {}
  syncPreset();
  syncDenoiseRange();
  updateConditionalControls();
  syncSecsFromFrames();
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
    updateQueueStatus(h.queue || 0);
  } catch {
    setStatus("bad", "server offline");
    updateQueueStatus(0);
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

// Make an /api/image URL unique per render so the browser's long-lived cache can never
// serve a stale image when ComfyUI recycles a filename.
function bustCache(url, promptId) {
  if (!url || !promptId) return url;
  return url + (url.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(promptId);
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
        if (msg.max) {
          const eta = fmtEta(etaRemainingMs(msg.promptId, msg.value, msg.max));
          setItemStatus(job.item, `rendering ${msg.value}/${msg.max}${eta ? " · " + eta : ""}`, "rendering");
        }
        if (job.item._thumb && !job.completed) job.item._thumb.innerHTML = '<div class="spinner"></div>';
        break;
      }
      if (msg.promptId === currentPromptId) {
        lastProgressAt = Date.now();
        if (msg.max) {
          el.bar.style.width = (msg.value / msg.max) * 100 + "%";
          const p = currentLabel ? currentLabel + " · " : "";
          const eta = fmtEta(etaRemainingMs(msg.promptId, msg.value, msg.max));
          el.progressText.textContent = `${p}Step ${msg.value} / ${msg.max}${eta ? " · " + eta : ""}`;
        }
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
      if (msg.promptId === currentPromptId) {
        lastProgressAt = Date.now();
        el.progressText.textContent = (currentLabel ? currentLabel + " · " : "") + "Rendering…";
      }
      break;
    }
    case "image": {
      // ComfyUI restarts its filename counter at _00001_ whenever its output folder is
      // cleared, so a fresh render can reuse an old filename → identical /api/image URL.
      // The server caches that URL for a year, so the browser would serve the STALE image.
      // Append the unique promptId so every render gets a distinct, never-before-cached URL.
      const url = bustCache(msg.images[0], msg.promptId);
      // The last-frame PNG comes back as a "secondary" still alongside the video — it's saved
      // on the Mac AND surfaced as a "⬇ Last frame" link (full-quality frame to chain clips),
      // but it must not replace the video in the viewer.
      if (msg.secondary) {
        if (msg.promptId === currentPromptId) {
          el.lastFrameImg.src = url;
          el.lastFrame.href = url;
          el.lastFrame.setAttribute("download", `lastframe-${lastSeed}.png`);
          el.lastFrame.classList.remove("hidden");
        }
        break;
      }
      etaTrack.delete(msg.promptId); // render done — drop its ETA state
      const job = batchJobs.get(msg.promptId);
      if (job) {
        completeJob(job, url, msg.isVideo);
        break;
      }
      if (msg.promptId === currentPromptId) showImage(url, msg.promptId, msg.isVideo);
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
    case "status":
      updateQueueStatus(msg.queue || 0);
      break;
  }
}

// Always show "⧗ N in coda" (running + pending on ComfyUI); highlight + show the
// cancel button only when there's actually something queued.
function updateQueueStatus(n) {
  el.queueStatus.textContent = `⧗ ${n} in coda`;
  el.queueStatus.classList.remove("hidden");
  el.queueStatus.classList.toggle("busy", n > 0);
  el.cancelQueue.classList.toggle("hidden", n <= 0);
}

// ---- Generate ----
function buildBody(positive, negative, seed, prefixOverride) {
  return {
    workflow: currentWorkflow?.id,
    positive,
    negative,
    image: imgSlot("image").uploaded,
    image2: imgSlot("image2").uploaded,
    seed,
    // Batch items carry their own filename prefix; fall back to the global field when blank.
    prefix: (prefixOverride && prefixOverride.trim()) || el.prefix.value,
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
    duration: el.duration.value,
    shift: el.shift.value,
    loraHigh: el.loraHigh.value,
    toggles: { ...toggleState },
    exportFormat: el.exportFormat.value,
  };
}

function paramsFrom(body, seed) {
  return {
    workflow: body.workflow,
    positive: body.positive,
    negative: body.negative,
    image: body.image,
    image2: body.image2,
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
    duration: body.duration,
    shift: body.shift,
    loraHigh: body.loraHigh,
    toggles: body.toggles,
    prefix: body.prefix,
    seed,
  };
}

// Workflows that need input images: warn if the user hasn't uploaded them yet.
function needsImageButMissing() {
  const has = currentWorkflow?.has || {};
  if (has.image && !imgSlot("image").uploaded) {
    toast("Carica un'immagine di input prima");
    return true;
  }
  // 2nd image is OPTIONAL: if omitted the server runs single-image edit (drops the 2nd LoadImage).
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
  stopRequested = false;
  el.generate.disabled = true;
  el.progress.classList.remove("hidden");
  el.resultbar.classList.add("hidden");
  el.lastFrame.classList.add("hidden"); // reset last-frame link for the new render

  const count = imageCount();
  const base = parseInt(el.seed.value) || 0;
  for (let i = 0; i < count; i++) {
    if (stopRequested) break;
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
        lastProgressAt = Date.now();
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
  restoreImageSlot(imgSlot("image"), p.image);
  restoreImageSlot(imgSlot("image2"), p.image2);
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
  if (p.duration) el.duration.value = p.duration;
  if (p.shift) el.shift.value = p.shift;
  if (p.loraHigh) el.loraHigh.value = p.loraHigh;
  if (p.fps) el.fps.value = p.fps;
  if (p.seed != null) {
    el.seed.value = p.seed;
    setRandomize(false);
  }
  persist();
  syncPreset();
  syncDenoiseRange();
  syncSecsFromFrames();
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
  while (el.history.children.length > 50) el.history.lastChild.remove();
  return wrap;
}

// Pull the last N renders straight from ComfyUI (the PC) and drop them into the
// history strip. Recovers a batch's results when the Mac was asleep during the run.
async function loadRecentFromComfy() {
  const n = Math.max(1, Math.min(50, parseInt(el.recentN.value) || 10));
  el.loadRecent.disabled = true;
  const label = el.loadRecent.textContent;
  el.loadRecent.textContent = "Recupero…";
  try {
    const r = await fetch("/api/history?limit=" + n);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "retrieve failed");
    if (!data.items || !data.items.length) {
      toast("Nessuna render trovata su ComfyUI (PC spento o ComfyUI riavviato?)");
      return;
    }
    // Server returns newest-first; addHistory prepends, so add oldest-first to keep newest on top.
    let newest = null;
    for (let i = data.items.length - 1; i >= 0; i--) {
      const it = data.items[i];
      newest = addHistory(it.images[0], "dal PC", null, null, it.isVideo);
      imageWraps.set(it.promptId, newest);
    }
    if (newest) view(newest);
    toast(`Recuperate ${data.items.length} render dal PC`);
  } catch (e) {
    toast("Recupero fallito: " + (e.message || e));
  } finally {
    el.loadRecent.disabled = false;
    el.loadRecent.textContent = label;
  }
}
el.loadRecent.addEventListener("click", loadRecentFromComfy);

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
  // Each *-only block shows only in its own tab.
  document.querySelectorAll(".render-only").forEach((n) => n.classList.toggle("hidden", currentTab !== "render"));
  document.querySelectorAll(".batch-only").forEach((n) => n.classList.toggle("hidden", currentTab !== "batch"));
  document.querySelectorAll(".super-only").forEach((n) => n.classList.toggle("hidden", currentTab !== "super"));
  // Super mode hides the manual single-shot controls (entries come from dropped files).
  el.controls.classList.toggle("mode-super", currentTab === "super");
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

    // Per-item filename prefix — each queue item saves under its own name.
    const name = document.createElement("input");
    name.className = "q-name";
    name.type = "text";
    name.value = item.prefix || "";
    name.placeholder = el.prefix.value || currentWorkflow?.defaultPrefix || "filename prefix";
    name.title = "Filename prefix for this item (blank = use the global prefix)";
    name.disabled = batchActive > 0;
    name.addEventListener("click", (e) => e.stopPropagation());
    name.addEventListener("input", () => {
      item.prefix = name.value.trim();
      persist();
    });

    const status = document.createElement("div");
    status.className = "q-status" + (item.statusKind ? " " + item.statusKind : "");
    status.textContent = item.status || "queued";
    body.append(text, name, status);

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
  // Super Batch run button mirrors the same in-flight counter (the two are mutually exclusive).
  const sbTotal = superEntries.reduce((n, e) => n + sbCountFor(e), 0);
  el.sbRun.textContent = batchActive ? `Rendering… ${batchActive} left` : `Run Super Batch${sbTotal ? ` (${sbTotal})` : ""}`;
  el.sbRun.disabled = batchActive > 0 || superEntries.length === 0;
  el.sbClear.disabled = batchActive > 0;
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
  queue.push({ positive, negative: el.negative.value, prefix: el.prefix.value.trim() });
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
      const body = buildBody(item.positive, item.negative, seed, item.prefix);
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

// ---- Super Batch: drop prompt .json files, each describing one full batch ----
// File schema (one object, or an array / {batch:[...]} of them):
//   { name, prompt, negative?, count, format: square|story|post, workflow?, saveDir? }
const SB_FORMATS = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1350 },
};
const SB_DEFAULT_WORKFLOW = "z-image-turbo";

// Turn one parsed JSON object into a super-batch entry; null if it has no prompt.
function sbNormalize(obj, fileName) {
  if (!obj || typeof obj !== "object") return null;
  const positive = (obj.prompt ?? obj.positive ?? "").toString().trim();
  if (!positive) return null;
  const fmtKey = (obj.format || "story").toString().toLowerCase();
  const fmt = SB_FORMATS[fmtKey] || SB_FORMATS.story;
  const count = Math.max(1, Math.min(50, parseInt(obj.count ?? obj.renders ?? 1) || 1));
  const name = (obj.name || obj.prefix || (fileName || "").replace(/\.json$/i, "") || "superbatch").toString().trim();
  return {
    name,
    workflow: (obj.workflow || SB_DEFAULT_WORKFLOW).toString(),
    positive,
    negative: (obj.negative || "").toString(),
    count,
    _fileCount: count,
    format: SB_FORMATS[fmtKey] ? fmtKey : "story",
    width: parseInt(obj.width) || fmt.w,
    height: parseInt(obj.height) || fmt.h,
    saveDir: (obj.saveDir || obj.folder || "").toString().trim(),
    // Optional per-file render params — when present they override the workflow defaults,
    // so a batch reproduces exactly what the single workflow would render.
    steps: sbNum(obj.steps),
    cfg: sbNum(obj.cfg),
    sampler: obj.sampler ? String(obj.sampler) : undefined,
    scheduler: obj.scheduler ? String(obj.scheduler) : undefined,
    denoise: sbNum(obj.denoise),
    toggles: (obj.toggles && typeof obj.toggles === "object")
      ? obj.toggles
      : (obj.fast !== undefined ? { fast: !!obj.fast } : undefined),
    status: "ready",
    statusKind: "",
  };
}
function sbNum(v) { return v === undefined || v === null || v === "" ? undefined : Number(v); }

async function sbAddFiles(fileList) {
  const files = [...(fileList || [])].filter((f) => /\.json$/i.test(f.name) || f.type === "application/json");
  let added = 0, bad = 0;
  for (const f of files) {
    try {
      const data = JSON.parse(await f.text());
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.batch) ? data.batch
        : Array.isArray(data.prompts) ? data.prompts
        : [data];
      for (const o of list) {
        const e = sbNormalize(o, f.name);
        if (e) { superEntries.push(e); added++; } else bad++;
      }
    } catch { bad++; }
  }
  toast(added ? `Added ${added} batch${added > 1 ? "es" : ""}${bad ? ` · ${bad} skipped` : ""}` : bad ? "No valid prompt JSON found" : "Drop .json files");
  renderSuperList();
  updateRunButton();
}

function renderSuperList() {
  el.sbList.innerHTML = "";
  superEntries.forEach((e, i) => {
    const row = document.createElement("div");
    row.className = "sb-item";

    const thumb = document.createElement("div");
    thumb.className = "q-thumb";
    thumb.innerHTML = `<span class="q-num">${i + 1}</span>`;

    const main = document.createElement("div");
    main.className = "sb-main";
    const name = document.createElement("div");
    name.className = "sb-name";
    name.textContent = e.name;
    const prompt = document.createElement("div");
    prompt.className = "sb-prompt";
    prompt.textContent = e.positive;
    const meta = document.createElement("div");
    meta.className = "sb-meta";
    const folder = e.saveDir ? " · " + e.saveDir.split("/").filter(Boolean).slice(-2).join("/") : "";
    const effCount = sbCountFor(e);
    const countLbl = el.sbOverrideEnable?.checked ? `${effCount}×*` : `${effCount}×`;
    meta.textContent = `${countLbl} · ${e.format} ${e.width}×${e.height} · ${e.workflow}${folder}`;
    const status = document.createElement("div");
    status.className = "q-status" + (e.statusKind ? " " + e.statusKind : "");
    status.textContent = e.status || "ready";
    main.append(name, prompt, meta, status);

    const del = document.createElement("button");
    del.className = "sb-del";
    del.textContent = "×";
    del.title = "Remove";
    del.addEventListener("click", () => {
      if (batchActive) return;
      superEntries.splice(i, 1);
      renderSuperList();
      updateRunButton();
    });

    row.append(thumb, main, del);
    e.row = row;
    e._thumb = thumb;
    e._statusEl = status;
    el.sbList.append(row);
  });
}

// Render exactly like picking this workflow with its defaults, but with the entry's
// prompt / size / name / folder. Seed left blank → server randomizes every render.
function buildSuperBody(entry, seed) {
  const wf = workflowsList.find((w) => w.id === entry.workflow) || {};
  const d = wf.defaults || {};
  return {
    workflow: entry.workflow,
    positive: entry.positive,
    negative: entry.negative || "",
    seed,
    prefix: entry.name,
    saveDir: entry.saveDir || el.saveDir.value,
    width: entry.width,
    height: entry.height,
    steps: entry.steps ?? d.steps,
    cfg: entry.cfg ?? d.cfg,
    sampler: entry.sampler ?? d.sampler,
    scheduler: entry.scheduler ?? d.scheduler,
    denoise: entry.denoise ?? d.denoise,
    // Pass the workflow's boolean toggles (e.g. Qwen's "4-step fast mode" Lightning LoRA),
    // so a batch matches the single render where that toggle is ON. Falls back to the
    // workflow defaults on the server when omitted.
    toggles: entry.toggles || undefined,
  };
}

// Effective images-per-prompt for a Super Batch entry: the global override (when its
// checkbox is ticked) wins over the per-file count; otherwise use the file's own count.
function sbOverrideValue() {
  return Math.max(1, Math.min(50, parseInt(el.sbOverrideCount?.value) || 1));
}
function sbCountFor(e) {
  if (el.sbOverrideEnable?.checked) return sbOverrideValue();
  return e._fileCount || e.count || 1;
}

async function runSuperBatch() {
  if (batchActive || rendering || !superEntries.length) return;
  batchJobs.clear();
  superEntries.forEach((e) => {
    e.count = sbCountFor(e);
    e.settled = 0;
    e.ok = 0;
    setItemStatus(e, "queued", "");
  });
  batchActive = superEntries.reduce((n, e) => n + e.count, 0);
  updateRunButton();
  for (const entry of superEntries) {
    for (let k = 0; k < entry.count; k++) {
      const body = buildSuperBody(entry, ""); // always random seed
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "queue failed");
        batchJobs.set(data.promptId, { item: entry, params: paramsFrom(body, data.seed), seed: data.seed, completed: false });
      } catch (err) {
        settleItem(entry, false);
        batchActive = Math.max(0, batchActive - 1);
        updateRunButton();
      }
    }
  }
}

function clearSuperFn() {
  if (batchActive) return;
  superEntries = [];
  renderSuperList();
  updateRunButton();
}

el.sbDrop.addEventListener("click", () => el.sbFiles.click());
el.sbFiles.addEventListener("change", () => { sbAddFiles(el.sbFiles.files); el.sbFiles.value = ""; });
["dragover", "dragenter"].forEach((ev) =>
  el.sbDrop.addEventListener(ev, (e) => { e.preventDefault(); el.sbDrop.classList.add("dragover"); }),
);
["dragleave"].forEach((ev) =>
  el.sbDrop.addEventListener(ev, (e) => { e.preventDefault(); el.sbDrop.classList.remove("dragover"); }),
);
el.sbDrop.addEventListener("drop", (e) => {
  e.preventDefault();
  el.sbDrop.classList.remove("dragover");
  sbAddFiles(e.dataTransfer.files);
});
el.sbRun.addEventListener("click", runSuperBatch);
el.sbClear.addEventListener("click", clearSuperFn);

// ---- Super Batch images-per-prompt override ----
function sbOverrideChanged() {
  renderSuperList();
  updateRunButton();
  persist();
}
el.sbOverrideEnable.addEventListener("change", sbOverrideChanged);
el.sbOverrideCount.addEventListener("input", sbOverrideChanged);

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
    async function uploadFromRecipe(slotKey, entry) {
      if (!entry?.dataBase64) return;
      const bin = atob(entry.dataBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await uploadImageFile(imgSlot(slotKey), new File([bytes], entry.filename || `${slotKey}.png`, { type: "image/png" }));
    }
    await uploadFromRecipe("image", recipe.input);
    await uploadFromRecipe("image2", recipe.input2);
    toast("Imported: " + (recipe.workflowName || params.workflow || "package"));
  } catch (e) {
    toast("Import failed: " + (e.message || e));
  }
  el.importFile.value = "";
});

// ---- Connection selector ----
// On the runpod instance the editable proxy-URL host exists; its dropdown index is tracked so
// pasting a new pod URL persists to the right host. Workflow scoping is by instance target now,
// not by this dropdown (the server only sends this target's workflows).
let runpodHostIndex = -1;
function updateRunpodField() {
  // The RunPod URL field belongs to the runpod instance — always show it there, never on local.
  el.runpodUrl.classList.toggle("hidden", appTarget !== "runpod");
}

// Make it unmistakable which instance this tab is — badge + title + body class for theming.
function applyTargetBadge() {
  const isRunpod = appTarget === "runpod";
  document.title = `comfy-mac · ${isRunpod ? "RunPod" : "Local"}`;
  document.body.classList.toggle("target-runpod", isRunpod);
  document.body.classList.toggle("target-local", !isRunpod);
  if (el.targetBadge) {
    el.targetBadge.textContent = isRunpod ? "RunPod" : "Local";
    el.targetBadge.classList.remove("hidden");
  }
}

async function saveRunpodUrl() {
  const url = el.runpodUrl.value.trim();
  try {
    await fetch("/api/runpod-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {}
  setTimeout(refreshHealth, 800);
}
el.runpodUrl.addEventListener("change", saveRunpodUrl);

el.connSelect.addEventListener("change", async () => {
  const v = el.connSelect.value;
  updateRunpodField();
  // Re-filter the workflow list for the new target (local PC vs RunPod).
  setMode(currentMode);
  // Switching to RunPod with an empty URL: persist whatever is typed first.
  if (runpodHostIndex >= 0 && v === String(runpodHostIndex) && el.runpodUrl.value.trim()) {
    await saveRunpodUrl();
  }
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

// ---- Cancel queue button ----
el.cancelQueue.addEventListener("click", async () => {
  el.cancelQueue.disabled = true;
  try {
    const r = await fetch("/api/cancel", { method: "POST" });
    if (!r.ok) throw new Error();
    // Cleared/pending jobs emit no further events — settle anything in-flight locally.
    for (const [, job] of batchJobs) {
      if (!job.completed) {
        job.completed = true;
        setItemStatus(job.item, "annullato", "error");
      }
    }
    batchJobs.clear();
    batchActive = 0;
    updateRunButton();
    if (rendering) {
      stopRequested = true;
      renderStepDone(); // unstick the in-flight single render
    }
    updateQueueStatus(0);
    toast("Coda annullata");
  } catch {
    toast("Annullamento fallito");
  }
  el.cancelQueue.disabled = false;
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
    else if (currentTab === "super") runSuperBatch();
    else generate();
  }
});

function toast(text) {
  el.toast.textContent = text;
  el.toast.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.add("hidden"), 5000);
}

// ---- Render watchdog ----
// If the in-flight render goes silent (missed completion event from a websocket/SSE
// blip, ComfyUI restart, or the Mac sleeping), reconcile against ComfyUI directly so
// the UI never stays frozen on "Loading model…".
let watchdogBusy = false;
async function checkInflightRender() {
  if (!rendering || !currentPromptId || watchdogBusy) return;
  if (Date.now() - lastProgressAt < 20000) return; // recent activity — leave it alone
  watchdogBusy = true;
  const id = currentPromptId;
  try {
    const d = await (await fetch("/api/prompt-status?id=" + encodeURIComponent(id))).json();
    if (id !== currentPromptId) return; // already moved on
    if (d.state === "done" && d.images?.length) {
      showImage(d.images[0], id, d.isVideo); // recovered the missed result
      renderStepDone();
    } else if (d.state === "missing") {
      toast("Render perso (ComfyUI riavviato o errore) — sblocco la UI");
      renderStepDone();
    } else if (/queued|loading|caricamento/i.test(el.progressText.textContent)) {
      el.progressText.textContent = "Loading model… (ancora in corso)"; // confirmed alive, keep waiting
    }
  } catch {
    // transient — retry next tick
  } finally {
    watchdogBusy = false;
  }
}

init();
renderQueue();
updateRunButton();
connectStream();
setInterval(refreshHealth, 15000);
setInterval(checkInflightRender, 8000);

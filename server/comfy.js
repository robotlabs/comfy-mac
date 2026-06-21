import WebSocket from "ws";
import { randomUUID } from "node:crypto";

// Thin client for a remote ComfyUI server: queues prompts over HTTP and
// listens to the execution WebSocket so we can relay live progress.
export class ComfyClient {
  constructor({ base, host, port }) {
    this._applyBase(base || `http://${host}:${port}`);
    this.clientId = randomUUID();
    this.ws = null;
    this.listeners = new Set();
    this.connected = false;
  }

  // `base` is a full base URL: http://ip:port (LAN/Tailscale) or
  // https://<pod>-8188.proxy.runpod.net (RunPod proxy). The websocket scheme
  // follows the http scheme: http→ws, https→wss.
  _applyBase(base) {
    this.base = String(base || "").replace(/\/$/, "");
    this.wsBase = this.base.replace(/^http/, "ws");
  }

  connect() {
    const url = `${this.wsBase}/ws?clientId=${this.clientId}`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on("open", () => {
      this.connected = true;
      this.emit({ type: "_socket", data: { connected: true } });
    });

    ws.on("message", (raw, isBinary) => {
      if (isBinary) return; // latent preview frames — ignored
      try {
        this.emit(JSON.parse(raw.toString()));
      } catch {
        /* ignore non-JSON frames */
      }
    });

    ws.on("close", () => {
      this.connected = false;
      this.emit({ type: "_socket", data: { connected: false } });
      setTimeout(() => this.connect(), 2000);
    });

    ws.on("error", () => ws.close());
  }

  // Point at a different ComfyUI (LAN / Tailscale / RunPod) and reconnect the websocket.
  setBase(base) {
    const norm = String(base || "").replace(/\/$/, "");
    if (!norm || norm === this.base) return;
    this._applyBase(norm);
    if (this.ws) {
      const old = this.ws;
      this.ws = null;
      old.removeAllListeners();
      // Closing a socket that's still CONNECTING (e.g. when the old host was unreachable)
      // emits an async 'error' — keep a no-op listener so it can't crash the process.
      old.on("error", () => {});
      try {
        old.terminate();
      } catch {}
    }
    this.connected = false;
    this.connect();
  }

  onMessage(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(msg) {
    for (const fn of this.listeners) fn(msg);
  }

  async queue(promptGraph) {
    const res = await fetch(`${this.base}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptGraph, client_id: this.clientId }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body?.error?.message || `ComfyUI returned ${res.status}`);
      err.detail = body;
      throw err;
    }
    return body; // { prompt_id, number, node_errors }
  }

  async interrupt() {
    await fetch(`${this.base}/interrupt`, { method: "POST" });
  }

  // Drop all pending prompts from ComfyUI's queue (does not stop the one already running).
  async clearQueue() {
    await fetch(`${this.base}/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear: true }),
      signal: AbortSignal.timeout(8000),
    });
  }

  // Authoritative current queue depth (running + pending), polled straight from ComfyUI.
  // More reliable than the websocket "status" count, which goes stale if we miss events
  // (e.g. the Mac slept mid-batch).
  async queueCount() {
    const res = await fetch(`${this.base}/queue`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`queue ${res.status}`);
    const d = await res.json();
    return (d.queue_running?.length || 0) + (d.queue_pending?.length || 0);
  }

  // Ask ComfyUI to unload models and free VRAM (no restart needed).
  async free() {
    await fetch(`${this.base}/free`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unload_models: true, free_memory: true }),
      signal: AbortSignal.timeout(8000),
    });
  }

  // Upload an input image into ComfyUI's input folder. Returns { name, subfolder, type }.
  async uploadImage(buffer, filename, contentType) {
    const form = new FormData();
    form.append("image", new Blob([buffer], { type: contentType || "image/png" }), filename || "upload.png");
    form.append("overwrite", "true");
    const res = await fetch(`${this.base}/upload/image`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`ComfyUI upload returned ${res.status}`);
    return res.json();
  }

  async systemStats() {
    const res = await fetch(`${this.base}/system_stats`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`system_stats ${res.status}`);
    return res.json();
  }

  imageUrl({ filename, subfolder = "", type = "output" }) {
    const q = new URLSearchParams({ filename, subfolder, type });
    return `${this.base}/view?${q}`;
  }
}

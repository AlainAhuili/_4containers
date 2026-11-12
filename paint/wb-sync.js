/*
 * Whiteboard mirror for miniPaint.
 *
 * The dashboard (port 8080) forwards the whiteboard's ink (transparent image) every time
 * something is written or erased there. Paint keeps one layer named "Whiteboard".
 *
 * Only CHANGES are applied: Paint remembers the last whiteboard image it received and
 * compares it with the new one, pixel by pixel.
 *   - pixel changed and now has ink  -> that ink is drawn into the layer
 *   - pixel changed and is now empty -> that pixel is erased in the layer
 *   - pixel unchanged                -> the layer keeps whatever it has
 * So anything you erase (or draw) in Paint stays that way; only new writing or
 * erasing on the whiteboard reaches Paint.
 *
 * While a whiteboard stroke is in progress, live frames are shown through the layer's
 * link_canvas (no undo history); the finished stroke is then saved as one normal update.
 */
(function () {
  "use strict";
  var LAYER_NAME = "Whiteboard";
  var DASHBOARD_ORIGIN = location.protocol + "//" + location.hostname + ":8080";
  var DIFF = 40;           // summed RGBA difference that counts as "changed" (ignores tiny smoothing noise)
  var layerId = null;
  var prevWB = null;       // last committed whiteboard image (ImageData, fitted to the paint canvas)
  var liveBase = null;     // layer content at the start of the current live stroke (ImageData)
  var liveCanvas = document.createElement("canvas");
  var busy = false, pending = null;

  function ready() { return window.Layers && window.AppConfig && window.AppConfig.layers; }
  function dims() { var d = window.Layers.get_dimensions(); return { w: d.width, h: d.height }; }

  function findLayer() {
    var ls = window.AppConfig.layers || [];
    for (var i = 0; i < ls.length; i++) if (ls[i].id === layerId) return ls[i];
    for (var j = 0; j < ls.length; j++) if (ls[j].name === LAYER_NAME && ls[j].type === "image") return ls[j];
    return null;
  }

  function loadImage(src) {
    return new Promise(function (res, rej) { var img = new Image(); img.onload = function () { res(img); }; img.onerror = rej; img.src = src; });
  }

  // Whiteboard image (Image or ImageBitmap) fitted into the paint canvas size, as ImageData.
  function fittedData(img) {
    var d = dims(), c = document.createElement("canvas");
    c.width = d.w; c.height = d.h;
    var s = Math.min(d.w / img.width, d.h / img.height), w = img.width * s, h = img.height * s;
    var g = c.getContext("2d");
    g.drawImage(img, (d.w - w) / 2, (d.h - h) / 2, w, h);
    return g.getImageData(0, 0, d.w, d.h);
  }

  // What the Whiteboard layer currently shows (including your edits in Paint), as ImageData.
  function layerData(layer) {
    var d = dims(), c = document.createElement("canvas");
    c.width = d.w; c.height = d.h;
    var g = c.getContext("2d");
    if (layer && layer.link && layer.link.complete !== false) g.drawImage(layer.link, layer.x || 0, layer.y || 0, layer.width || d.w, layer.height || d.h);
    return g.getImageData(0, 0, d.w, d.h);
  }

  // out = base, with every pixel that changed between prev and next replaced by next.
  function applyDelta(base, prev, next) {
    var out = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
    var o = out.data, p = prev.data, n = next.data, changed = 0;
    for (var i = 0; i < n.length; i += 4) {
      if (Math.abs(n[i] - p[i]) + Math.abs(n[i + 1] - p[i + 1]) + Math.abs(n[i + 2] - p[i + 2]) + Math.abs(n[i + 3] - p[i + 3]) > DIFF) {
        o[i] = n[i]; o[i + 1] = n[i + 1]; o[i + 2] = n[i + 2]; o[i + 3] = n[i + 3];
        changed++;
      }
    }
    return { data: out, changed: changed };
  }

  function sameSize(a, b) { return a && b && a.width === b.width && a.height === b.height; }
  function toCanvas(imageData) { var c = document.createElement("canvas"); c.width = imageData.width; c.height = imageData.height; c.getContext("2d").putImageData(imageData, 0, 0); return c; }

  /* ---------- committed updates (stroke finished, undo, wipe, ...) ---------- */
  async function commit(msg) {
    var next = fittedData(await loadImage(msg.png));
    var layer = findLayer();
    var cfg = window.AppConfig;

    if (!layer) {
      prevWB = next; liveBase = null;
      if (!msg.strokes) return; // empty board: don't add an empty layer
      var currentId = cfg.layer ? cfg.layer.id : null;
      var c = toCanvas(next);
      await window.Layers.insert({ type: "image", name: LAYER_NAME, data: c.toDataURL("image/png"), x: 0, y: 0, width: c.width, height: c.height });
      layer = findLayer();
      if (!layer) return;
      layerId = layer.id;
      var stillThere = (cfg.layers || []).some(function (l) { return l.id === currentId; });
      if (stillThere && currentId !== layerId) await window.Layers.select(currentId);
      window.Layers.render();
      return;
    }
    layerId = layer.id;

    var result;
    if (!sameSize(prevWB, next)) {
      // first update after Paint loaded, or the canvas size changed: take the whole board once
      result = { data: next, changed: 1 };
    } else {
      result = applyDelta(layerData(layer), prevWB, next);
    }
    prevWB = next; liveBase = null;
    if (layer.link_canvas === liveCanvas) layer.link_canvas = null;
    if (result.changed) {
      await window.Layers.update_layer_image(toCanvas(result.data), layer.id);
      layer.x = 0; layer.y = 0; layer.width = result.data.width; layer.height = result.data.height;
    }
    window.Layers.render();
  }

  async function run(msg) {
    if (busy) { pending = msg; return; }   // only the newest committed board matters
    busy = true;
    try { await commit(msg); } catch (err) { console.warn("[whiteboard sync]", err); }
    busy = false;
    if (pending) { var next = pending; pending = null; run(next); }
  }

  /* ---------- live frames while a whiteboard stroke is in progress ---------- */
  function live(msg) {
    var bmp = msg.bmp;
    try {
      if (!ready() || busy) return;
      var layer = findLayer();
      if (!layer || !prevWB) return;       // nothing to compare with yet; the committed update follows
      var frame = fittedData(bmp);
      if (!sameSize(prevWB, frame)) return;
      if (!liveBase) liveBase = layerData(layer); // snapshot once per stroke, keeps your Paint edits
      var out = applyDelta(liveBase, prevWB, frame).data;
      if (liveCanvas.width !== out.width || liveCanvas.height !== out.height) { liveCanvas.width = out.width; liveCanvas.height = out.height; }
      liveCanvas.getContext("2d").putImageData(out, 0, 0);
      layer.link_canvas = liveCanvas;
      window.Layers.render();
    } finally {
      if (bmp && bmp.close) bmp.close();
    }
  }

  // If you edit the Whiteboard layer in Paint between strokes, start the next live stroke from that.
  ["mouseup", "touchend", "pointerup", "keyup"].forEach(function (t) { window.addEventListener(t, function () { liveBase = null; }, true); });

  window.addEventListener("message", function (e) {
    if (e.origin !== DASHBOARD_ORIGIN || !e.data) return;
    if (e.data.type === "wb-live" && e.data.bmp) { live(e.data); return; }
    if (e.data.type !== "wb-ink") return;
    if (!ready()) { var d = e.data; setTimeout(function () { window.dispatchEvent(new MessageEvent("message", { data: d, origin: e.origin })); }, 300); return; }
    run(e.data);
  });

  // Tell the dashboard we are ready, so it can send the current board.
  function announce() {
    if (!ready()) return setTimeout(announce, 300);
    if (window.parent !== window) window.parent.postMessage({ type: "paint-ready" }, DASHBOARD_ORIGIN);
  }
  window.addEventListener("load", announce);
})();

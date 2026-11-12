/*
 * Disable miniPaint's drawing tools.
 *
 * Paint becomes a viewer for what comes from the whiteboard: the tool column and the
 * tool options bar are hidden, and mouse / touch / pen input on the canvas is blocked,
 * so nothing can be drawn, erased, filled, moved or cropped there.
 * Still available: zooming (mouse wheel, Preview panel), the menus (File > Save/Export,
 * View, Layer, ...) and the side panels.
 */
(function () {
  "use strict";

  var css = document.createElement("style");
  css.textContent =
    "#tools_container{display:none!important}" +
    "#action_attributes{visibility:hidden!important}" +
    "#canvas_wrapper,#canvas_minipaint{cursor:default!important}" +
    "#mouse{display:none!important}";
  document.head.appendChild(css);

  // The canvas area: block every press there before miniPaint's tool handlers see it.
  var AREA = "#middle_area, #main_wrapper, #canvas_wrapper, #canvas_minipaint, #ruler_left, #ruler_top";
  ["mousedown", "mouseup", "click", "dblclick", "contextmenu", "touchstart", "touchend", "pointerdown", "pointerup"].forEach(function (type) {
    window.addEventListener(type, function (e) {
      if (e.target && e.target.closest && e.target.closest(AREA)) {
        e.stopImmediatePropagation();
        if (type !== "pointerdown" && type !== "pointerup") e.preventDefault();
      }
    }, true);
  });
  // A drag that never started can't draw, but also stop moves over the canvas from reaching the tools.
  ["mousemove", "touchmove"].forEach(function (type) {
    window.addEventListener(type, function (e) {
      if (e.target && e.target.closest && e.target.closest(AREA)) e.stopImmediatePropagation();
    }, true);
  });

  // Single-key tool shortcuts (and Delete/arrows that edit the selected layer) are switched off;
  // typing in menus, dialogs and inputs still works, and Ctrl/Cmd shortcuts (save, undo...) stay.
  window.addEventListener("keydown", function (e) {
    var t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
    if (t && t.closest && t.closest("#main_menu, .popup, [role=dialog], [role=menu]")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.stopImmediatePropagation();
  }, true);

  // Keep a harmless tool selected, in case something switches tools programmatically.
  setInterval(function () {
    var cfg = window.AppConfig;
    if (cfg && cfg.TOOL && cfg.TOOL.name !== "select") {
      var btn = document.getElementById("select");
      if (btn) btn.click();
    }
  }, 500);
})();

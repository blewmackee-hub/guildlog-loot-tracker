"use client";

import { useEffect } from "react";

/* Glass panels lean a hair toward the pointer: the edge nearest the cursor
   dips away, the opposite edge lifts, anchored on the panel's centre, and the
   vertical glass stripe (see "Pointer tilt" in globals.css) follows it:
   it slides toward the cursor, stretches on that side and shrinks on the
   other, and leans a few degrees when the cursor is in a corner. One document-level listener sets CSS
   variables on whichever .panel is under the pointer; the transform itself
   lives in CSS and only applies while `.is-tilting`, so panels are untouched
   at rest. Fine pointers on desktop-width screens only - phones and touch
   devices get the static stripe - and never with reduced motion. */
const VARS = ["--tilt-x", "--tilt-y", "--band", "--grow", "--lean"];
const MAX_DEG = 0.9;

export default function PanelTilt() {
  useEffect(() => {
    // Same condition as the CSS in globals.css; checked on every move so resizing across it just works.
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 861px) and (prefers-reduced-motion: no-preference)");

    let active = null;
    let frame = 0;
    let last = null;

    function release() {
      if (active) {
        active.classList.remove("is-tilting");
        VARS.forEach((v) => active.style.removeProperty(v)); // back to the resting shine, eased
      }
      active = null;
    }

    function paint() {
      frame = 0;
      if (!active || !last) return;
      const r = active.getBoundingClientRect();
      // -1..1 from the panel's centre (clamped: the tilted box drifts a pixel or two)
      const nx = Math.max(-1, Math.min(1, ((last.x - r.left) / r.width) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, ((last.y - r.top) / r.height) * 2 - 1));
      active.style.setProperty("--tilt-x", `${(-ny * MAX_DEG).toFixed(2)}deg`);
      active.style.setProperty("--tilt-y", `${(nx * MAX_DEG).toFixed(2)}deg`);
      active.style.setProperty("--band", (42 + nx * 10).toFixed(1));
      active.style.setProperty("--grow", nx.toFixed(2));
      // top-right / bottom-left lean one way, top-left / bottom-right the other; none along the axes
      active.style.setProperty("--lean", (-nx * ny * 5).toFixed(1));
    }

    function onMove(e) {
      if (!mq.matches) {
        release();
        return;
      }
      const panel = e.target instanceof Element ? e.target.closest(".panel") : null;
      if (panel !== active) {
        release();
        if (panel) {
          active = panel;
          panel.classList.add("is-tilting");
        }
      }
      if (!active) return;
      last = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    }

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", release);
    window.addEventListener("blur", release);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", release);
      window.removeEventListener("blur", release);
      if (frame) cancelAnimationFrame(frame);
      release();
    };
  }, []);

  return null;
}

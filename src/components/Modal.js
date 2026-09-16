"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/* Generic popup dialog - click the backdrop, press Escape, or hit the X
   to close. stopPropagation on the panel keeps a backdrop click from
   also firing on whatever's underneath it. Escape is the keyboard
   equivalent of that backdrop click - without it, a keyboard-only user
   would have no way to dismiss the dialog other than tabbing to the X.

   Portaled to document.body rather than rendered in place: a caller
   like ProfileBar sits inside <header> (position:relative; z-index:1
   - its own stacking context), so a plain z-index on the overlay only
   wins *within* that context and still loses to the page content that
   comes after the header in the DOM. Escaping to body sidesteps any
   ancestor's stacking context or overflow clipping entirely. */
export default function Modal({ title, onClose, children, className, tone }) {
  const titleId = useId();

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-panel ${className || ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <div className={`modal-panel__header ${tone === "danger" ? "modal-panel__header--danger" : ""}`}>
          <h3 id={titleId}>{title}</h3>
          <button className="modal-panel__close" onClick={onClose} title="Close" aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="modal-panel__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

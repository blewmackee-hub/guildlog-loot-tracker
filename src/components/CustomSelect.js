"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/* Native <select> popups follow the OS theme on Windows, not the
   page's CSS (color-scheme is unreliable there) - so anywhere the
   dropdown list itself needs to match our dark UI, this renders its
   own listbox instead of relying on the browser's native popup. */
export default function CustomSelect({ value, onChange, options, placeholder, className, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`custom-select ${className || ""}`} ref={ref}>
      <button
        type="button"
        className="custom-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? "" : "custom-select__placeholder"}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={12} strokeWidth={2} />
      </button>
      {open && (
        <ul className="custom-select__list" role="listbox">
          <li
            role="option"
            aria-selected={!value}
            className={`custom-select__option ${!value ? "custom-select__option--active" : ""}`}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            {placeholder}
          </li>
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={value === o.value}
              className={`custom-select__option ${value === o.value ? "custom-select__option--active" : ""}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

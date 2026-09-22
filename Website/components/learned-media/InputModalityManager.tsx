"use client";

import { useEffect } from "react";

const keyboardNavigationKeys = new Set([
  "Tab",
  "Enter",
  " ",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp"
]);

export function InputModalityManager() {
  useEffect(() => {
    const root = document.documentElement;
    const markPointer = () => {
      if (root.dataset.inputModality !== "pointer") root.dataset.inputModality = "pointer";
    };
    const markKeyboard = (event: KeyboardEvent) => {
      if (keyboardNavigationKeys.has(event.key)) root.dataset.inputModality = "keyboard";
    };

    document.addEventListener("pointerdown", markPointer, true);
    document.addEventListener("pointermove", markPointer, true);
    document.addEventListener("keydown", markKeyboard, true);
    return () => {
      document.removeEventListener("pointerdown", markPointer, true);
      document.removeEventListener("pointermove", markPointer, true);
      document.removeEventListener("keydown", markKeyboard, true);
    };
  }, []);

  return null;
}

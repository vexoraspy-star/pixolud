"use client";

import { useEffect, useRef } from "react";
import { unlockSecret } from "@/lib/fun";

const CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

export default function KonamiCode() {
  const progress = useRef(0);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const expected = CODE[progress.current];
      if (key === expected) {
        progress.current += 1;
        if (progress.current === CODE.length) {
          progress.current = 0;
          unlockSecret();
        }
      } else {
        progress.current = key === CODE[0] ? 1 : 0;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return null;
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  instrumentColor,
  scaleNotes,
  type InstrumentId,
  type MelodieStroke,
  type ScaleId,
} from "@/lib/melodie";

/**
 * La zone de dessin, partagee par l'editeur et le lecteur.
 *
 * Elle ne connait rien au jeu : on lui donne des traits a afficher, elle
 * renvoie les traits dessines. C'est ce qui evite d'ecrire deux fois la
 * meme gestion de pointeur et de grille.
 */
export default function MelodieCanvas({
  strokes,
  ghost = [],
  scale,
  beats,
  instrument = "piano",
  drawable = false,
  playhead = null,
  onStroke,
  className = "",
}: {
  strokes: MelodieStroke[];
  /** Traits affiches en transparence : la reference, pendant une tentative. */
  ghost?: MelodieStroke[];
  scale: ScaleId;
  beats: number;
  instrument?: InstrumentId;
  drawable?: boolean;
  /** Position de la tete de lecture, de 0 a 1, ou null. */
  playhead?: number | null;
  onStroke?: (stroke: MelodieStroke) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<[number, number][] | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  // Les props changent a chaque image pendant la lecture : on passe par des
  // refs pour que le dessin n'ait pas a reabonner ses ecouteurs.
  const stateRef = useRef({ strokes, ghost, scale, beats, instrument, playhead });

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w === 0 || h === 0) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const s = stateRef.current;

    // Fond
    ctx.fillStyle = "#0b0a12";
    ctx.fillRect(0, 0, w, h);

    // Lignes de notes : plus claires sur les toniques, pour qu'on voie la gamme.
    const notes = scaleNotes(s.scale);
    const degrees = notes.length - 1;
    for (let i = 0; i <= degrees; i++) {
      const y = (1 - i / degrees) * h;
      const isOctave = (notes[i] - notes[0]) % 12 === 0;
      ctx.strokeStyle = isOctave ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }

    // Lignes de temps, accentuees toutes les 4 (une mesure).
    for (let b = 0; b <= s.beats; b++) {
      const x = (b / s.beats) * w;
      ctx.strokeStyle = b % 4 === 0 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }

    const drawStroke = (stroke: MelodieStroke, alpha: number, dashed: boolean) => {
      if (!stroke.points || stroke.points.length < 2) return;
      const color = instrumentColor(stroke.instrument);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.setLineDash(dashed ? [6, 6] : []);
      ctx.lineWidth = dashed ? 2 : 3;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = color;
      if (!dashed) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
      }
      ctx.beginPath();
      stroke.points.forEach(([px, py], i) => {
        const x = px * w;
        const y = py * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    };

    for (const stroke of s.ghost) drawStroke(stroke, 0.28, true);
    for (const stroke of s.strokes) drawStroke(stroke, 1, false);

    // Trait en cours
    const live = currentRef.current;
    if (live && live.length >= 2) {
      drawStroke({ instrument: s.instrument, points: live }, 1, false);
    }

    // Tete de lecture
    if (s.playhead !== null && s.playhead >= 0) {
      const x = s.playhead * w;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }, []);

  // Redessine a chaque changement de props, et quand la zone change de taille.
  // La synchro du ref se fait ici et pas pendant le rendu : ecrire un ref
  // pendant le rendu est interdit, et de toute facon les gestionnaires de
  // pointeur n ont besoin que de la derniere valeur COMMITEE.
  useEffect(() => {
    stateRef.current = { strokes, ghost, scale, beats, instrument, playhead };
    paint();
  });

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => paint());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [paint]);

  useEffect(() => {
    if (!drawable) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toLocal = (e: PointerEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      return [
        Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
        Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
      ];
    };

    const onDown = (e: PointerEvent) => {
      if (pointerIdRef.current !== null) return;
      pointerIdRef.current = e.pointerId;
      currentRef.current = [toLocal(e)];
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      paint();
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerIdRef.current) return;
      const pts = currentRef.current;
      if (!pts) return;
      const [x, y] = toLocal(e);
      // Une melodie est une fonction du temps : le trait ne peut pas revenir
      // en arriere. On ignore donc tout point dont l'abscisse recule, ce qui
      // garantit aussi l'ordre croissant attendu par strokeValueAt.
      const lastX = pts[pts.length - 1][0];
      if (x <= lastX) return;
      pts.push([x, y]);
      paint();
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerIdRef.current) return;
      pointerIdRef.current = null;
      const pts = currentRef.current;
      currentRef.current = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (pts && pts.length >= 2) {
        onStroke?.({ instrument: stateRef.current.instrument, points: pts });
      }
      paint();
    };

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [drawable, onStroke, paint]);

  return (
    <div
      ref={wrapRef}
      className={`relative aspect-[2/1] w-full overflow-hidden rounded-xl ring-1 ring-white/10 ${className}`}
    >
      <canvas
        ref={canvasRef}
        className={`h-full w-full ${drawable ? "cursor-crosshair" : ""}`}
      />
      {!drawable && strokes.length === 0 && ghost.length === 0 && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
          Rien de dessiné
        </p>
      )}
    </div>
  );
}

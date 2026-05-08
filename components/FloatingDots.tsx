"use client";

import { useMemo } from "react";

type Phase = "idle" | "recording" | "busy";

type Dot = {
  left: string;
  top: string;
  size: number;
  color: string;
  duration: string;
  delay: string;
  fromX: string;
  fromY: string;
};

const COLORS = ["var(--peach-main)", "var(--leaf-green)", "var(--peach-deep)"];

function makeDots(count: number): Dot[] {
  const dots: Dot[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 60 + Math.random() * 120;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    dots.push({
      left: `calc(50% + ${x.toFixed(0)}px)`,
      top: `calc(50% + ${y.toFixed(0)}px)`,
      size: 4 + Math.round(Math.random() * 5),
      color: COLORS[i % COLORS.length],
      duration: `${(3 + Math.random() * 4).toFixed(2)}s`,
      delay: `${(Math.random() * 3).toFixed(2)}s`,
      fromX: `${x.toFixed(0)}px`,
      fromY: `${y.toFixed(0)}px`,
    });
  }
  return dots;
}

export default function FloatingDots({ phase, count = 12 }: { phase: Phase; count?: number }) {
  const dots = useMemo(() => makeDots(count), [count]);
  return (
    <div className="dots-layer" data-phase={phase} aria-hidden>
      {dots.map((d, i) => (
        <span
          key={i}
          className="dot"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            background: d.color,
            // @ts-expect-error CSS custom properties
            "--dot-dur": d.duration,
            "--dot-delay": d.delay,
            "--from-x": d.fromX,
            "--from-y": d.fromY,
          }}
        />
      ))}
    </div>
  );
}

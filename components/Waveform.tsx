"use client";

import { useEffect, useRef } from "react";

const BAR_COUNT = 9;

type Props = {
  analyser: AnalyserNode | null;
  active: boolean;
};

export default function Waveform({ analyser, active }: Props) {
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !analyser) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      barsRef.current.forEach((bar) => {
        if (bar) bar.style.height = "";
      });
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      for (let i = 0; i < BAR_COUNT; i++) {
        const v = data[i] ?? 0;
        const h = Math.max(8, (v / 255) * 80);
        const bar = barsRef.current[i];
        if (bar) bar.style.height = `${h}px`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [analyser, active]);

  const liveDriven = active && !!analyser;

  return (
    <div className="waveform" aria-hidden>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <span
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          className={"waveform-bar" + (liveDriven ? "" : " idle")}
          style={liveDriven ? undefined : { animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}

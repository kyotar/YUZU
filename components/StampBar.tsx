"use client";

import { useState } from "react";
import { STAMPS, type Stamp } from "@/lib/stamps";

type Props = {
  postId: string;
  reactions: Record<Stamp, number>;
  reacted: Stamp[];
};

export default function StampBar({ postId, reactions, reacted }: Props) {
  const [counts, setCounts] = useState<Record<Stamp, number>>(reactions);
  const [mine, setMine] = useState<Set<Stamp>>(new Set(reacted));
  const [pending, setPending] = useState<Set<Stamp>>(new Set());

  const toggle = async (stamp: Stamp) => {
    if (pending.has(stamp)) return;

    const wasReacted = mine.has(stamp);
    const optimisticCount = Math.max(0, (counts[stamp] ?? 0) + (wasReacted ? -1 : 1));

    setPending((s) => new Set(s).add(stamp));
    setCounts((c) => ({ ...c, [stamp]: optimisticCount }));
    setMine((m) => {
      const n = new Set(m);
      if (wasReacted) n.delete(stamp); else n.add(stamp);
      return n;
    });

    try {
      const res = await fetch(`/api/posts/${postId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stamp }),
      });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { reacted: boolean; count: number };
      setCounts((c) => ({ ...c, [stamp]: data.count }));
      setMine((m) => {
        const n = new Set(m);
        if (data.reacted) n.add(stamp); else n.delete(stamp);
        return n;
      });
    } catch {
      // revert
      setCounts((c) => ({ ...c, [stamp]: counts[stamp] ?? 0 }));
      setMine((m) => {
        const n = new Set(m);
        if (wasReacted) n.add(stamp); else n.delete(stamp);
        return n;
      });
    } finally {
      setPending((s) => {
        const n = new Set(s);
        n.delete(stamp);
        return n;
      });
    }
  };

  return (
    <div className="stamp-bar">
      {STAMPS.map(({ stamp, label }) => {
        const count = counts[stamp] ?? 0;
        const isMine = mine.has(stamp);
        return (
          <button
            key={stamp}
            type="button"
            aria-label={`${label} ${count}`}
            aria-pressed={isMine}
            className={`stamp-btn${isMine ? " reacted" : ""}`}
            onClick={() => toggle(stamp)}
          >
            <span className="stamp-emoji">{stamp}</span>
            {count > 0 && <span className="stamp-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

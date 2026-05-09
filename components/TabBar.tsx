"use client";

import { ChatCircle, Microphone, User } from "@phosphor-icons/react";

export type Tab = "timeline" | "speak" | "mypage";

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
  compact?: boolean;
};

export default function TabBar({ active, onChange, compact = false }: Props) {
  return (
    <nav className="tab-bar" data-compact={compact} aria-label="メイン">
      <button
        type="button"
        className={`tab-item${active === "timeline" ? " active" : ""}`}
        aria-pressed={active === "timeline"}
        aria-label="タイムライン"
        onClick={() => onChange("timeline")}
      >
        <span className="tab-icon" aria-hidden><ChatCircle size={24} weight="bold" /></span>
        <span className="tab-label">タイムライン</span>
      </button>

      <button
        type="button"
        className={`tab-item center${active === "speak" ? " active" : ""}`}
        aria-pressed={active === "speak"}
        aria-label="はなす"
        onClick={() => onChange("speak")}
      >
        <span className="tab-icon" aria-hidden><Microphone size={24} weight="bold" /></span>
      </button>

      <button
        type="button"
        className={`tab-item${active === "mypage" ? " active" : ""}`}
        aria-pressed={active === "mypage"}
        aria-label="マイページ"
        onClick={() => onChange("mypage")}
      >
        <span className="tab-icon" aria-hidden><User size={24} weight="bold" /></span>
        <span className="tab-label">マイページ</span>
      </button>
    </nav>
  );
}

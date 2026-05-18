"use client";

import { House, Microphone, User } from "@phosphor-icons/react";

export type MainTab = "home" | "me";

type Props = {
  tab: MainTab;
  onChange: (tab: MainTab) => void;
  onOpenRecord: () => void;
  hidden?: boolean;
};

export default function TabBar({ tab, onChange, onOpenRecord, hidden }: Props) {
  return (
    <nav className="tab-bar" role="tablist" aria-label="メインナビ" data-hidden={hidden ? "true" : undefined}>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "home"}
        className="tab-item"
        onClick={() => onChange("home")}
      >
        <House size={24} weight={tab === "home" ? "fill" : "regular"} />
        <span className="tab-label font-display">HOME</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={false}
        className="tab-item tab-item--center mic-fab"
        aria-label="録音を開く"
        onClick={onOpenRecord}
      >
        <Microphone size={28} weight="fill" />
        <span className="tab-label font-display">TALK</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "me"}
        className="tab-item"
        onClick={() => onChange("me")}
      >
        <User size={24} weight={tab === "me" ? "fill" : "regular"} />
        <span className="tab-label font-display">ME</span>
      </button>
    </nav>
  );
}

"use client";

export type Tab = "timeline" | "speak" | "mypage";

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
  compact?: boolean;
};

const TABS: { id: Tab; icon: string; label: string; center?: boolean }[] = [
  { id: "timeline", icon: "💬", label: "タイムライン" },
  { id: "speak", icon: "🎤", label: "はなす", center: true },
  { id: "mypage", icon: "👤", label: "マイページ" },
];

export default function TabBar({ active, onChange, compact = false }: Props) {
  return (
    <nav className="tab-bar" data-compact={compact} aria-label="メイン">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tab-item${t.center ? " center" : ""}${active === t.id ? " active" : ""}`}
          aria-pressed={active === t.id}
          aria-label={t.label}
          onClick={() => onChange(t.id)}
        >
          <span className="tab-icon" aria-hidden>{t.icon}</span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

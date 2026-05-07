export type Stamp = "🍑" | "🍋" | "🌱" | "🫐" | "🍒";

export const STAMPS: { stamp: Stamp; label: string }[] = [
  { stamp: "🍑", label: "わかる" },
  { stamp: "🍋", label: "ちょっとすっぱい" },
  { stamp: "🌱", label: "育ちそう" },
  { stamp: "🫐", label: "じんわりくる" },
  { stamp: "🍒", label: "好き" },
];

export const STAMP_SET: Set<string> = new Set(STAMPS.map((s) => s.stamp));

export const isStamp = (v: unknown): v is Stamp =>
  typeof v === "string" && STAMP_SET.has(v);

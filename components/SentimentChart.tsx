"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type SentimentPoint = { date: string; score: number };

type Props = { data: SentimentPoint[] };

const POS_COLOR = "#F5A623";
const NEG_COLOR = "#5B9BD5";

function scoreLabel(score: number): string {
  if (score >= 0.5) return "ポジティブ";
  if (score >= 0.15) return "ややポジティブ";
  if (score > -0.15) return "穏やか";
  if (score > -0.5) return "ややネガティブ";
  return "ネガティブ";
}

export default function SentimentChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="sentiment-empty">
        まだ感情の揺らぎを描けない。<br />もう少し声を残してね。
      </p>
    );
  }

  return (
    <div className="sentiment-chart-wrap">
      <svg
        width="1"
        height="1"
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        aria-hidden
      >
        <defs>
          <linearGradient id="sentiGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={POS_COLOR} stopOpacity={0.9} />
            <stop offset="50%" stopColor={POS_COLOR} stopOpacity={0.15} />
            <stop offset="50%" stopColor={NEG_COLOR} stopOpacity={0.15} />
            <stop offset="100%" stopColor={NEG_COLOR} stopOpacity={0.9} />
          </linearGradient>
        </defs>
      </svg>
      <div className="sentiment-legend" aria-hidden>
        <span className="sentiment-legend-pos">↑ ポジ</span>
        <span className="sentiment-legend-sep">／</span>
        <span className="sentiment-legend-neg">↓ ネガ</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--surface-border)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
            stroke="var(--surface-border)"
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis domain={[-1, 1]} hide />
          <Tooltip
            contentStyle={{
              background: "var(--surface-card)",
              border: "1px solid var(--surface-border)",
              borderRadius: 12,
              fontSize: 12,
              color: "var(--ink)",
            }}
            formatter={(v: number) => [scoreLabel(v), "気分"]}
          />
          <ReferenceLine y={0} stroke="var(--ink-muted)" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="score"
            stroke="none"
            fill="url(#sentiGrad)"
            fillOpacity={1}
            baseValue={0}
            tooltipType="none"
            isAnimationActive={true}
            animationDuration={500}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--ink)"
            strokeOpacity={0.3}
            strokeWidth={1.5}
            dot={{ fill: "var(--ink)", fillOpacity: 0.5, r: 2.5, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "var(--ink)" }}
            isAnimationActive={true}
            animationDuration={500}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

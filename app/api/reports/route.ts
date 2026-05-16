import { NextResponse } from "next/server";
import { listPosts } from "@/lib/kv";
import { getOrCreateSessionId, setSessionCookie } from "@/lib/session";
import { getReport, listReportKeys } from "@/lib/reports";
import {
  parsePeriodKey,
  periodLabel,
  recentClosedPeriods,
  type PeriodMeta,
} from "@/lib/period";
import type { ReportMeta } from "@/lib/reportTypes";

export const runtime = "nodejs";

const KV_MISSING = !process.env.KV_REDIS_URL && !process.env.REDIS_URL;

// GET /api/reports?scope=recent (default) | all
export async function GET(req: Request) {
  if (KV_MISSING) {
    return NextResponse.json(
      { error: "kv_not_configured", reports: [] },
      { status: 503 },
    );
  }

  const { id: sid, isNew } = getOrCreateSessionId();
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") === "all" ? "all" : "recent";

  try {
    const [posts, savedKeys] = await Promise.all([
      listPosts(sid, 1000),
      listReportKeys(sid),
    ]);

    let candidates: PeriodMeta[];
    if (scope === "recent") {
      candidates = recentClosedPeriods();
    } else {
      // 確定済み + 過去に保存されたものすべて。重複を避けてマージ。
      const recent = recentClosedPeriods(Date.now(), 12);
      const saved: PeriodMeta[] = savedKeys
        .map((key) => {
          const p = parsePeriodKey(key);
          if (!p) return null;
          return { key, kind: p.kind, start: p.start, end: p.end, label: periodLabel(key) };
        })
        .filter((x): x is PeriodMeta => x !== null);
      const map = new Map<string, PeriodMeta>();
      for (const m of [...recent, ...saved]) map.set(m.key, m);
      candidates = [...map.values()].sort((a, b) => b.end - a.end);
    }

    const metas: ReportMeta[] = await Promise.all(
      candidates.map(async (c): Promise<ReportMeta> => {
        const cached = await getReport(sid, c.key);
        const postCount = posts.filter(
          (p) => p.createdAt >= c.start && p.createdAt < c.end,
        ).length;
        return {
          periodKey: c.key,
          kind: c.kind,
          rangeStart: c.start,
          rangeEnd: c.end,
          label: c.label,
          generated: !!cached,
          headline: cached?.payload.headline,
          topics: cached?.payload.topics,
          postCount,
        };
      }),
    );

    // 投稿0件かつ未生成のものは除外（カードを出さない）
    const filtered = metas.filter((m) => m.generated || m.postCount > 0);

    const res = NextResponse.json({ reports: filtered, sessionId: sid });
    if (isNew) setSessionCookie(res, sid);
    return res;
  } catch (e) {
    console.error("listReports failed", e);
    const res = NextResponse.json(
      { error: "kv_error", reports: [] },
      { status: 500 },
    );
    if (isNew) setSessionCookie(res, sid);
    return res;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { listPosts } from "@/lib/kv";
import { getOrCreateSessionId, setSessionCookie } from "@/lib/session";
import { generateReport, getReport } from "@/lib/reports";
import { isClosed, parsePeriodKey } from "@/lib/period";

export const runtime = "nodejs";

const KV_MISSING = !process.env.KV_REDIS_URL && !process.env.REDIS_URL;

type Params = { params: { periodKey: string } };

// GET /api/reports/[periodKey]?scores=postId:0.4,postId:-0.2
// クライアントが localStorage に持っている感情スコアを query で渡す（POST にしてもよいが GET で十分）。
function parseScoresParam(value: string | null): Record<string, number> {
  if (!value) return {};
  const out: Record<string, number> = {};
  for (const pair of value.split(",")) {
    const [id, raw] = pair.split(":");
    if (!id || raw === undefined) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) out[id] = Math.max(-1, Math.min(1, n));
  }
  return out;
}

async function handle(req: NextRequest, { params }: Params, scores: Record<string, number>) {
  const periodKey = params.periodKey;
  const period = parsePeriodKey(periodKey);
  if (!period) {
    return NextResponse.json({ error: "invalid_period_key" }, { status: 400 });
  }
  if (!isClosed(periodKey)) {
    return NextResponse.json({ error: "period_in_progress" }, { status: 422 });
  }

  if (KV_MISSING) {
    return NextResponse.json({ error: "kv_not_configured" }, { status: 503 });
  }

  const { id: sid, isNew } = getOrCreateSessionId();

  try {
    const cached = await getReport(sid, periodKey);
    if (cached) {
      const res = NextResponse.json({ report: cached });
      if (isNew) setSessionCookie(res, sid);
      return res;
    }

    const posts = await listPosts(sid, 1000);
    const inRange = posts.filter(
      (p) => p.createdAt >= period.start && p.createdAt < period.end,
    );
    if (inRange.length === 0) {
      const res = NextResponse.json({ error: "no_posts" }, { status: 404 });
      if (isNew) setSessionCookie(res, sid);
      return res;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "llm_not_configured" }, { status: 503 });
    }

    try {
      const report = await generateReport({
        sessionId: sid,
        periodKey,
        posts,
        scores,
      });
      const res = NextResponse.json({ report });
      if (isNew) setSessionCookie(res, sid);
      return res;
    } catch (e) {
      console.error("generateReport failed", e);
      const res = NextResponse.json({ error: "llm_failed" }, { status: 502 });
      if (isNew) setSessionCookie(res, sid);
      return res;
    }
  } catch (e) {
    console.error("report fetch failed", e);
    const res = NextResponse.json({ error: "kv_error" }, { status: 500 });
    if (isNew) setSessionCookie(res, sid);
    return res;
  }
}

export async function GET(req: NextRequest, ctx: Params) {
  const url = new URL(req.url);
  const scores = parseScoresParam(url.searchParams.get("scores"));
  return handle(req, ctx, scores);
}

// クライアントは scores を body 経由で渡せる（GET の URL 長制限回避）
export async function POST(req: NextRequest, ctx: Params) {
  let body: { scores?: Record<string, number> } = {};
  try {
    body = await req.json();
  } catch {}
  const scores = body.scores && typeof body.scores === "object" ? body.scores : {};
  return handle(req, ctx, scores);
}

import { NextRequest, NextResponse } from "next/server";
import { postExists, toggleReaction } from "@/lib/kv";
import { getOrCreateSessionId, setSessionCookie } from "@/lib/session";
import { isStamp } from "@/lib/stamps";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id: sid, isNew } = getOrCreateSessionId();
  const body = await req.json().catch(() => null);
  const stamp = body?.stamp;

  if (!isStamp(stamp)) {
    return NextResponse.json({ error: "invalid stamp" }, { status: 400 });
  }
  if (!(await postExists(params.id))) {
    return NextResponse.json({ error: "post not found" }, { status: 404 });
  }

  const result = await toggleReaction(params.id, sid, stamp);
  const res = NextResponse.json(result);
  if (isNew) setSessionCookie(res, sid);
  return res;
}

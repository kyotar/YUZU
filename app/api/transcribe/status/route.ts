import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const API = "https://api.assemblyai.com/v2";

export async function GET(req: NextRequest) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "missing api key" }, { status: 500 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const res = await fetch(`${API}/transcript/${id}`, {
    headers: { authorization: apiKey },
  });
  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: `poll failed: ${body}` }, { status: 500 });
  }
  const data = await res.json();
  return NextResponse.json({ status: data.status, text: data.text ?? "", error: data.error });
}

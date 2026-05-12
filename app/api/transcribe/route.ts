import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";
const MODEL_ID = "scribe_v2";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "missing api key" }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "no audio" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("file", file, "recording.webm");
  upstream.append("model_id", MODEL_ID);
  upstream.append("language_code", "ja");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: upstream,
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: `transcribe failed: ${body}` }, { status: 500 });
  }

  const data = await res.json();
  const cleanText = ((data.text as string | undefined) ?? "").replace(/\[.*?\]/g, "").trim();
  return NextResponse.json({ text: cleanText });
}

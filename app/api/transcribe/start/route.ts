import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const API = "https://api.assemblyai.com/v2";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "missing api key" }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "no audio" }, { status: 400 });
  }

  const audioBuffer = Buffer.from(await file.arrayBuffer());

  const uploadRes = await fetch(`${API}/upload`, {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/octet-stream",
    },
    body: audioBuffer,
  });
  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    return NextResponse.json({ error: `upload failed: ${body}` }, { status: 500 });
  }
  const { upload_url } = await uploadRes.json();

  const createRes = await fetch(`${API}/transcript`, {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      audio_url: upload_url,
      speech_models: ["universal-2"],
      language_code: "ja",
    }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    return NextResponse.json({ error: `create failed: ${body}` }, { status: 500 });
  }
  const { id } = await createRes.json();
  return NextResponse.json({ id });
}

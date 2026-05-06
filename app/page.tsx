"use client";

import { useEffect, useRef, useState } from "react";

type Post = { id: string; text: string; createdAt: number };
type Phase = "idle" | "holding" | "recording" | "busy";

const STORAGE_KEY = "voice-blog-posts";
const HOLD_MS = 2000; // 2秒未満はキャンセル
const RING_R = 68;
const RING_CIRC = 2 * Math.PI * RING_R; // ≈ 427

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [shortTap, setShortTap] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // refs — press end ハンドラが最新値を参照できるよう phase も ref で持つ
  const phaseRef = useRef<Phase>("idle");
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<number>(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const setPhaseSync = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPosts(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (next: Post[]) => {
    setPosts(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  // ---- MediaRecorder ----
  const startMediaRecorder = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start();
      recorderRef.current = mr;
      return true;
    } catch {
      setError("マイクへのアクセスに失敗しました");
      setPhaseSync("idle");
      return false;
    }
  };

  const stopAndGetBlob = (): Promise<Blob> =>
    new Promise((resolve) => {
      const mr = recorderRef.current;
      if (!mr || mr.state === "inactive") { resolve(new Blob([])); return; }
      mr.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        resolve(new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" }));
        recorderRef.current = null;
      };
      mr.stop();
    });

  const cancelRecorder = () => {
    const mr = recorderRef.current;
    if (mr && mr.state !== "inactive") { mr.onstop = null; mr.stop(); }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  };

  // ---- Press handlers ----
  const handlePressStart = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (phaseRef.current !== "idle") return;

    setError(null);
    setShortTap(false);
    pressStartRef.current = Date.now();
    setPhaseSync("holding");

    const ok = await startMediaRecorder();
    if (!ok) return;

    // 2秒後に録音フェーズへ昇格
    pressTimerRef.current = setTimeout(() => {
      if (phaseRef.current === "holding") setPhaseSync("recording");
    }, HOLD_MS);
  };

  const handlePressEnd = async () => {
    const cur = phaseRef.current;
    if (cur === "idle" || cur === "busy") return;

    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }

    const held = Date.now() - pressStartRef.current;

    if (held < HOLD_MS) {
      // 短すぎる → キャンセル
      cancelRecorder();
      setPhaseSync("idle");
      setShortTap(true);
      setTimeout(() => setShortTap(false), 2500);
      return;
    }

    // 2秒以上 → 文字起こしへ
    setPhaseSync("busy");
    const blob = await stopAndGetBlob();
    if (blob.size === 0) { setPhaseSync("idle"); return; }
    await transcribeAndSave(blob);
  };

  const handlePressCancel = () => {
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
    cancelRecorder();
    setPhaseSync("idle");
  };

  // ---- Transcription ----
  const transcribeAndSave = async (blob: Blob) => {
    setStatusMsg("音声をアップロード中...");
    try {
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      const startRes = await fetch("/api/transcribe/start", { method: "POST", body: fd });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || "アップロード失敗");

      setStatusMsg("文字起こし中...");
      const text = await pollUntilDone(startData.id);
      if (!text.trim()) { setError("文字起こしの結果が空でした"); return; }

      persist([{ id: crypto.randomUUID(), text, createdAt: Date.now() }, ...posts]);
      setStatusMsg(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setStatusMsg(null);
    } finally {
      setPhaseSync("idle");
    }
  };

  const pollUntilDone = (id: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const deadline = Date.now() + 120_000;
      const tick = async () => {
        if (Date.now() > deadline) { reject(new Error("タイムアウトしました")); return; }
        try {
          const res = await fetch(`/api/transcribe/status?id=${id}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "ステータス確認失敗");
          if (data.status === "completed") return resolve(data.text ?? "");
          if (data.status === "error") return reject(new Error(data.error ?? "文字起こしエラー"));
          setTimeout(tick, 2000);
        } catch (e) { reject(e); }
      };
      tick();
    });

  // ---- Render ----
  const isHolding = phase === "holding";
  const isRecording = phase === "recording";
  const isBusy = phase === "busy";

  const buttonBg = isRecording ? "#e53935" : isBusy ? "#bbb" : "#1a1a1a";

  const hint =
    isBusy ? (statusMsg ?? "処理中...") :
    isRecording ? "録音中（指を離すと送信）" :
    isHolding ? "そのまま押し続けてください..." :
    "長押しして話す";

  return (
    <main style={styles.main}>
      <h1 style={styles.title}>Voice Blog</h1>

      <div style={styles.buttonWrap}>
        {/* ボタン + プログレスリング */}
        <div style={{ position: "relative", width: 148, height: 148 }}>
          {isHolding && (
            <svg
              width={148} height={148}
              style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)", pointerEvents: "none" }}
            >
              <circle
                cx={74} cy={74} r={RING_R}
                fill="none"
                stroke="#e53935"
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={RING_CIRC}
                style={{ animation: `fillRing ${HOLD_MS}ms linear forwards` }}
              />
            </svg>
          )}
          <button
            aria-label="長押しで録音"
            disabled={isBusy}
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={() => { if (isHolding || isRecording) handlePressEnd(); }}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            onTouchCancel={handlePressCancel}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              ...styles.micButton,
              background: buttonBg,
              transform: isRecording ? "scale(1.06)" : "scale(1)",
              cursor: isBusy ? "not-allowed" : "pointer",
            }}
          >
            {isBusy ? "⏳" : "🎤"}
          </button>
        </div>

        <p style={styles.hint}>{hint}</p>

        {shortTap && (
          <p style={styles.shortTapMsg}>
            📌 2秒以上長押しして話してください
          </p>
        )}
        {error && <p style={styles.error}>{error}</p>}
      </div>

      <section style={styles.list}>
        {posts.map((p) => (
          <article key={p.id} style={styles.post}>
            <time style={styles.time}>{formatDate(p.createdAt)}</time>
            <p style={styles.text}>{p.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 640, margin: "0 auto", padding: "48px 20px 80px", minHeight: "100vh" },
  title: { textAlign: "center", fontSize: 22, fontWeight: 600, margin: "0 0 32px", letterSpacing: 1 },
  buttonWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 56 },
  micButton: {
    width: 140, height: 140,
    borderRadius: "50%",
    border: "none",
    color: "#fff",
    fontSize: 56,
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
    transition: "transform 150ms ease, background 150ms ease",
    userSelect: "none",
    WebkitUserSelect: "none",
    touchAction: "none",
    position: "relative",
  },
  hint: { color: "#888", fontSize: 14, margin: 0, textAlign: "center" },
  shortTapMsg: {
    color: "#e53935",
    fontSize: 13,
    margin: 0,
    textAlign: "center",
    fontWeight: 500,
    animation: "fadeIn 200ms ease",
  },
  error: { color: "#e53935", fontSize: 13, margin: 0, textAlign: "center", maxWidth: 320 },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  post: { background: "#fff", borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  time: { display: "block", fontSize: 12, color: "#888", marginBottom: 6 },
  text: { margin: 0, fontSize: 15, lineHeight: 1.7, whiteSpace: "pre-wrap" },
};

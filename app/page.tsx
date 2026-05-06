"use client";

import { useEffect, useRef, useState } from "react";

type Post = { id: string; text: string; createdAt: number };

const STORAGE_KEY = "voice-blog-posts";

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPosts(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (next: Post[]) => {
    setPosts(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const startRecording = async () => {
    if (busy || recording) return;
    setError(null);
    setStatusMsg(null);
    cancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (cancelledRef.current) return;
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size === 0) return;
        await transcribeAndSave(blob);
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch {
      setError("マイクへのアクセスに失敗しました");
    }
  };

  const stopRecording = (cancel = false) => {
    if (!recording) return;
    cancelledRef.current = cancel;
    setRecording(false);
    const mr = recorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    recorderRef.current = null;
  };

  const transcribeAndSave = async (blob: Blob) => {
    setBusy(true);
    setStatusMsg("音声をアップロード中...");
    try {
      // Step 1: アップロード & 文字起こし開始
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      const startRes = await fetch("/api/transcribe/start", { method: "POST", body: fd });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || "アップロード失敗");

      const { id } = startData;
      setStatusMsg("文字起こし中...");

      // Step 2: クライアントでポーリング
      const text = await pollUntilDone(id);
      if (!text.trim()) {
        setError("文字起こしの結果が空でした");
        return;
      }
      const post: Post = { id: crypto.randomUUID(), text, createdAt: Date.now() };
      persist([post, ...posts]);
      setStatusMsg(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setStatusMsg(null);
    } finally {
      setBusy(false);
    }
  };

  const pollUntilDone = (id: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const max = 120_000;
      const start = Date.now();
      const tick = async () => {
        if (Date.now() - start > max) {
          reject(new Error("文字起こしがタイムアウトしました"));
          return;
        }
        try {
          const res = await fetch(`/api/transcribe/status?id=${id}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "ステータス確認失敗");
          if (data.status === "completed") return resolve(data.text ?? "");
          if (data.status === "error") return reject(new Error(data.error ?? "文字起こしエラー"));
          setTimeout(tick, 2000);
        } catch (e) {
          reject(e);
        }
      };
      tick();
    });

  return (
    <main style={styles.main}>
      <h1 style={styles.title}>Voice Blog</h1>

      <div style={styles.buttonWrap}>
        <button
          aria-label="長押しで録音"
          disabled={busy}
          onMouseDown={startRecording}
          onMouseUp={() => stopRecording(false)}
          onMouseLeave={() => recording && stopRecording(false)}
          onTouchStart={(e) => {
            e.preventDefault();
            startRecording();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            stopRecording(false);
          }}
          onTouchCancel={() => stopRecording(true)}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            ...styles.micButton,
            background: recording ? "#e53935" : busy ? "#bbb" : "#1a1a1a",
            transform: recording ? "scale(1.08)" : "scale(1)",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "⏳" : "🎤"}
        </button>
        <p style={styles.hint}>
          {busy
            ? statusMsg ?? "処理中..."
            : recording
            ? "録音中（指を離すと送信）"
            : "ボタンを長押しして話す"}
        </p>
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
  main: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "48px 20px 80px",
    minHeight: "100vh",
  },
  title: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: 600,
    margin: "0 0 32px",
    letterSpacing: 1,
  },
  buttonWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    marginBottom: 56,
  },
  micButton: {
    width: 140,
    height: 140,
    borderRadius: "50%",
    border: "none",
    color: "#fff",
    fontSize: 56,
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
    transition: "transform 120ms ease, background 120ms ease",
    userSelect: "none",
    WebkitUserSelect: "none",
    touchAction: "none",
  },
  hint: {
    color: "#666",
    fontSize: 14,
    margin: 0,
    textAlign: "center",
  },
  error: {
    color: "#e53935",
    fontSize: 13,
    margin: 0,
    textAlign: "center",
    maxWidth: 320,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  post: {
    background: "#fff",
    borderRadius: 12,
    padding: "16px 18px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  time: {
    display: "block",
    fontSize: 12,
    color: "#888",
    marginBottom: 6,
  },
  text: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
  },
};

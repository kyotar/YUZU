"use client";

import { useEffect, useRef, useState } from "react";
import StampBar from "@/components/StampBar";
import { type Stamp } from "@/lib/stamps";

type Post = {
  id: string;
  text: string;
  createdAt: number;
  emoji: string;
  blob: [string, string, string];
  reactions: Record<Stamp, number>;
  reacted: Stamp[];
};
type Phase = "idle" | "recording" | "busy";

const EMOJI_KEY = "peach-emoji";
const MIN_RECORD_MS = 300;

const FRUITS = ["🍑","🍋","🍇","🥝","🍓","🫐","🍈","🍊","🍍","🥭","🍌","🍒","🍎","🍐","🫒"];

const pickFruit = () => FRUITS[Math.floor(Math.random() * FRUITS.length)];

function randomEllipse(): string {
  const r = () => 38 + Math.round(Math.random() * 26);
  return `${r()}% ${r()}% ${r()}% ${r()}% / ${r()}% ${r()}% ${r()}% ${r()}%`;
}
const randomBlob = (): [string, string, string] => [randomEllipse(), randomEllipse(), randomEllipse()];

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [shortTap, setShortTap] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myEmoji, setMyEmoji] = useState<string>("🍑");
  const [newPostId, setNewPostId] = useState<string | null>(null);

  const phaseRef = useRef<Phase>("idle");
  const pressStartRef = useRef<number>(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const setPhaseSync = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  useEffect(() => {
    let e: string | null = null;
    try {
      e = localStorage.getItem(EMOJI_KEY);
      if (!e) {
        e = pickFruit();
        localStorage.setItem(EMOJI_KEY, e);
      }
    } catch {}
    if (e) setMyEmoji(e);

    fetch("/api/posts")
      .then((r) => r.json())
      .then((data: { posts: Post[] }) => setPosts(data.posts ?? []))
      .catch(() => {});
  }, []);

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

  const handlePressStart = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (phaseRef.current !== "idle") return;

    setError(null);
    setShortTap(false);
    pressStartRef.current = Date.now();
    setPhaseSync("recording");

    const ok = await startMediaRecorder();
    if (!ok) return;
  };

  const handlePressEnd = async () => {
    if (phaseRef.current !== "recording") return;

    const held = Date.now() - pressStartRef.current;

    if (held < MIN_RECORD_MS) {
      cancelRecorder();
      setPhaseSync("idle");
      setShortTap(true);
      setTimeout(() => setShortTap(false), 2500);
      return;
    }

    setPhaseSync("busy");
    const blob = await stopAndGetBlob();
    if (blob.size === 0) { setPhaseSync("idle"); return; }
    await transcribeAndSave(blob);
  };

  const handlePressCancel = () => {
    cancelRecorder();
    setPhaseSync("idle");
  };

  const transcribeAndSave = async (blob: Blob) => {
    setStatusMsg("言葉にしてるよ…");
    try {
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "文字起こし失敗");

      const text: string = data.text ?? "";
      if (!text.trim()) { setError("声を聴き取れなかった"); return; }

      const blobShape = randomBlob();
      const saveRes = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, emoji: myEmoji, blob: blobShape }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "保存に失敗しました");

      const newPost: Post = saveData.post;
      setPosts((prev) => [newPost, ...prev]);
      setNewPostId(newPost.id);
      setStatusMsg(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setStatusMsg(null);
    } finally {
      setPhaseSync("idle");
    }
  };

  const isRecording = phase === "recording";
  const isBusy = phase === "busy";

  const micClass = "mic-button" + (isRecording ? " recording" : "");

  const hint =
    isBusy ? (statusMsg ?? "処理中…") :
    isRecording ? "聴いてるよ…" :
    "長押しして、話す";

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <span className="font-display" style={styles.logo}>🍑 PEACH</span>
        <span style={styles.tagline}>声は、種。つぶやきは、実る。</span>
      </header>

      <section style={styles.heroSection}>
        <div className="mic-wrap">
          <button
            aria-label="長押しで録音"
            aria-pressed={isRecording}
            disabled={isBusy}
            className={micClass}
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={() => { if (isRecording) handlePressEnd(); }}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            onTouchCancel={handlePressCancel}
            onContextMenu={(e) => e.preventDefault()}
          >
            {isBusy ? "🌱" : "🎤"}
          </button>
        </div>

        <p style={styles.hint}>{hint}</p>

        {shortTap && <p style={styles.shortTapMsg}>もう少し長く押してね</p>}
        {error && <p style={styles.error}>{error}</p>}
      </section>

      <section style={styles.list}>
        {posts.length === 0 && !error && (
          <p style={styles.empty}>まだ誰も話していない。<br />最初の声を植えよう。</p>
        )}
        {posts.map((p) => (
          <article
            key={p.id}
            className={`post-card${p.id === newPostId ? " new" : ""}`}
            style={p.blob ? ({ '--blob-soft-1': p.blob[0], '--blob-soft-2': p.blob[1], '--blob-soft-3': p.blob[2] } as React.CSSProperties) : undefined}
          >
            <div className="post-emoji" aria-hidden>{p.emoji ?? "🍑"}</div>
            <div className="post-body">
              <time className="post-time">{formatDate(p.createdAt)}</time>
              <p className="post-text">{p.text}</p>
              <StampBar postId={p.id} reactions={p.reactions} reacted={p.reacted} />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function formatDate(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles: Record<string, React.CSSProperties> = {
  main: { maxWidth: 640, margin: "0 auto", padding: "32px 20px 96px", minHeight: "100vh" },
  header: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 48 },
  logo: { fontSize: 26, color: "var(--text-primary)" },
  tagline: { fontSize: 12, color: "var(--text-secondary)", letterSpacing: "0.05em" },
  heroSection: { display: "flex", flexDirection: "column", alignItems: "center", gap: 18, marginBottom: 64 },
  hint: { color: "var(--text-secondary)", fontSize: 14, margin: 0, textAlign: "center", letterSpacing: "0.02em" },
  shortTapMsg: { color: "var(--peach-deep)", fontSize: 13, margin: 0, textAlign: "center", fontWeight: 500, animation: "fadeIn 200ms ease" },
  error: { color: "var(--peach-deep)", fontSize: 13, margin: 0, textAlign: "center", maxWidth: 320 },
  list: { display: "flex", flexDirection: "column", gap: 14 },
  empty: { color: "var(--text-muted)", fontSize: 14, textAlign: "center", lineHeight: 1.8, margin: "32px 0" },
};

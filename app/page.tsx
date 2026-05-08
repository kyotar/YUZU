"use client";

import { useEffect, useRef, useState } from "react";
import TabBar, { type Tab } from "@/components/TabBar";
import SpeakView from "@/components/SpeakView";
import TimelineView, { type Post } from "@/components/TimelineView";
import MyPageView from "@/components/MyPageView";

type Phase = "idle" | "recording" | "busy";

const EMOJI_KEY = "peach-emoji";
const MIN_RECORD_MS = 300;
const FRUITS = ["🍑","🍋","🍇","🥝","🍓","🫐","🍈","🍊","🍍","🥭","🍌","🍒","🍎","🍐","🫒"];
const pickFruit = () => FRUITS[Math.floor(Math.random() * FRUITS.length)];

function randomEllipse(): string {
  const r = () => 30 + Math.round(Math.random() * 40); // 30–70 (more distorted)
  return `${r()}% ${r()}% ${r()}% ${r()}% / ${r()}% ${r()}% ${r()}% ${r()}%`;
}
const randomBlob = (): [string, string, string] => [randomEllipse(), randomEllipse(), randomEllipse()];

export default function Home() {
  const [tab, setTab] = useState<Tab>("speak");
  const [posts, setPosts] = useState<Post[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [shortTap, setShortTap] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myEmoji, setMyEmoji] = useState<string>("🍑");
  const [newPostId, setNewPostId] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

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
      .then(safeJson)
      .then((data) => setPosts(data?.posts ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Reset scroll state on tab change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    setScrolled(false);
  }, [tab]);

  const pickRecorderMime = (): string | undefined => {
    if (typeof MediaRecorder === "undefined") return undefined;
    const candidates = [
      "audio/mp4",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
    ];
    for (const m of candidates) {
      try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {}
    }
    return undefined;
  };

  const startMediaRecorder = async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setError("このブラウザは録音に対応していません");
        setPhaseSync("idle");
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start();
      recorderRef.current = mr;
      return true;
    } catch (err) {
      console.error("startMediaRecorder failed", err);
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
      const ext = blob.type.includes("mp4") ? "mp4"
        : blob.type.includes("ogg") ? "ogg"
        : "webm";
      const fd = new FormData();
      fd.append("audio", blob, `recording.${ext}`);
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "文字起こしに失敗しました");

      const text: string = data?.text ?? "";
      if (!text.trim()) { setError("声を聴き取れなかった"); return; }

      const blobShape = randomBlob();
      const saveRes = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, emoji: myEmoji, blob: blobShape }),
      });
      const saveData = await safeJson(saveRes);
      if (!saveRes.ok) {
        if (saveData?.error === "kv_not_configured") {
          throw new Error("サーバーの保存先が未設定です（KV未接続）");
        }
        throw new Error(saveData?.error || "保存に失敗しました");
      }

      const newPost: Post | undefined = saveData?.post;
      if (!newPost) throw new Error("保存に失敗しました");
      setPosts((prev) => [newPost, ...prev]);
      setNewPostId(newPost.id);
      setStatusMsg(null);
      // Auto-jump to timeline so the user sees their new post
      setTab("timeline");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setStatusMsg(null);
    } finally {
      setPhaseSync("idle");
    }
  };

  return (
    <main className="app-shell">
      <header className="app-header" data-hidden={scrolled}>
        <span className="app-logo font-display">🍑 PEACH</span>
        <span className="app-tagline">声は、種。つぶやきは、実る。</span>
      </header>

      {tab === "speak" && (
        <SpeakView
          phase={phase}
          shortTap={shortTap}
          statusMsg={statusMsg}
          error={error}
          onPressStart={handlePressStart}
          onPressEnd={handlePressEnd}
          onPressCancel={handlePressCancel}
        />
      )}

      {tab === "timeline" && (
        <TimelineView posts={posts} newPostId={newPostId} />
      )}

      {tab === "mypage" && (
        <MyPageView myEmoji={myEmoji} postCount={posts.length} />
      )}

      <TabBar active={tab} onChange={setTab} compact={scrolled} />
    </main>
  );
}

async function safeJson(res: Response): Promise<any | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

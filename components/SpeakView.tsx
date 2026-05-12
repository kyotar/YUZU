"use client";

import { Microphone } from "@phosphor-icons/react";
import FloatingDots from "./FloatingDots";

type Phase = "idle" | "recording" | "busy";

type Props = {
  phase: Phase;
  shortTap: boolean;
  statusMsg: string | null;
  error: string | null;
  hint: string | null;
  onPressStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onPressEnd: () => void;
  onPressCancel: () => void;
};

export default function SpeakView({
  phase,
  shortTap,
  statusMsg,
  error,
  hint,
  onPressStart,
  onPressEnd,
  onPressCancel,
}: Props) {
  const isRecording = phase === "recording";
  const isBusy = phase === "busy";

  const status =
    error ? error :
    isBusy ? (statusMsg ?? "言葉にしてるよ…") :
    isRecording ? "聴いてるよ…" :
    shortTap ? "もう少し長く押してね" : "";

  return (
    <section className="speak-view">
      <p className="speak-guide" data-hidden={phase !== "idle"}>
        長押しして、話す
      </p>

      <div className="speak-stage">
        <FloatingDots phase={phase} />
        {isRecording && (
          <div className="rings-layer" aria-hidden>
            <span className="recording-ring" />
            <span className="recording-ring" />
            <span className="recording-ring" />
          </div>
        )}
        <div className="mic-wrap" style={{ position: "relative", zIndex: 1 }}>
          <p className="speak-hint" data-show={hint ? "true" : "false"} aria-live="polite">
            {hint ?? ""}
          </p>
          <button
            aria-label="長押しで録音"
            aria-pressed={isRecording}
            disabled={isBusy}
            className={"mic-button" + (isRecording ? " recording" : "")}
            onMouseDown={onPressStart}
            onMouseUp={onPressEnd}
            onMouseLeave={() => { if (isRecording) onPressEnd(); }}
            onTouchStart={onPressStart}
            onTouchEnd={onPressEnd}
            onTouchCancel={onPressCancel}
            onContextMenu={(e) => e.preventDefault()}
          >
            {isBusy ? "🌱" : <Microphone size={36} weight="fill" />}
          </button>
        </div>
      </div>

      <p className={`speak-status${error ? " error" : ""}`}>{status}</p>
    </section>
  );
}

"use client";

import { Microphone } from "@phosphor-icons/react";
import FloatingDots from "./FloatingDots";
import Waveform from "./Waveform";

type Phase = "idle" | "recording" | "busy" | "complete";

type Props = {
  phase: Phase;
  shortTap: boolean;
  statusMsg: string | null;
  error: string | null;
  hint: string | null;
  analyser: AnalyserNode | null;
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
  analyser,
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
    shortTap ? "もう少し長く押してね" : "長押しして、話す";

  return (
    <section className="speak-view">
      <p className="speak-top">{status}</p>

      <div className="speak-stage">
        {phase === "idle" && <FloatingDots phase={phase} />}
        {isRecording && <Waveform analyser={analyser} active />}
        {isBusy && (
          <div className="speak-spinner" aria-hidden>
            <span className="spinner-ring" />
          </div>
        )}
        <p className="speak-hint" data-show={hint ? "true" : "false"} aria-live="polite">
          {hint ?? ""}
        </p>
      </div>

      <div className="speak-bottom">
        <button
          aria-label="長押しで録音"
          aria-pressed={isRecording}
          disabled={isBusy}
          className={"mic-button-large" + (isRecording ? " recording" : "")}
          onMouseDown={onPressStart}
          onMouseUp={onPressEnd}
          onMouseLeave={() => { if (isRecording) onPressEnd(); }}
          onTouchStart={onPressStart}
          onTouchEnd={onPressEnd}
          onTouchCancel={onPressCancel}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Microphone size={40} weight="fill" />
        </button>
      </div>
    </section>
  );
}

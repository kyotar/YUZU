"use client";

import { useEffect } from "react";
import SpeakView from "./SpeakView";

type Phase = "idle" | "recording" | "busy";

type Props = {
  open: boolean;
  onClose: () => void;
  phase: Phase;
  shortTap: boolean;
  statusMsg: string | null;
  error: string | null;
  onPressStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onPressEnd: () => void;
  onPressCancel: () => void;
};

export default function RecordModal({
  open,
  onClose,
  phase,
  shortTap,
  statusMsg,
  error,
  onPressStart,
  onPressEnd,
  onPressCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const canClose = phase === "idle";

  return (
    <div className="record-modal" role="dialog" aria-modal="true" aria-label="録音">
      <button
        type="button"
        className="record-modal-close"
        aria-label="閉じる"
        onClick={onClose}
        disabled={!canClose}
      >
        ×
      </button>
      <SpeakView
        phase={phase}
        shortTap={shortTap}
        statusMsg={statusMsg}
        error={error}
        onPressStart={onPressStart}
        onPressEnd={onPressEnd}
        onPressCancel={onPressCancel}
      />
    </div>
  );
}

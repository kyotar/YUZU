"use client";

import { useEffect, useState } from "react";
import SpeakView from "./SpeakView";

type Phase = "idle" | "recording" | "busy";
type AnimState = "opening" | "open" | "closing";

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
  const [mounted, setMounted] = useState(false);
  const [animState, setAnimState] = useState<AnimState>("opening");

  useEffect(() => {
    if (open) {
      setMounted(true);
      setAnimState("opening");
    } else if (mounted) {
      setAnimState("closing");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    // only react to the modal's own animation, not children
    if (e.target !== e.currentTarget) return;
    if (animState === "opening") {
      setAnimState("open");
    } else if (animState === "closing") {
      setMounted(false);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mounted]);

  if (!mounted) return null;

  const canClose = phase === "idle";

  return (
    <div
      className="record-modal"
      data-anim={animState}
      onAnimationEnd={handleAnimationEnd}
      role="dialog"
      aria-modal="true"
      aria-label="録音"
    >
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

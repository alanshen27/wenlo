"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/core/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (file: File) => void | Promise<void>;
};

type Phase = "idle" | "requesting" | "recording" | "review" | "denied";

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecorderModal({ open, onOpenChange, onSave }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<File | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopTracks();
    recorderRef.current = null;
    chunksRef.current = [];
    fileRef.current = null;
    setElapsed(0);
    setSaving(false);
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setPhase("idle");
  }, [stopTracks]);

  const startRecording = useCallback(async () => {
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
        fileRef.current = file;
        setPreviewUrl(URL.createObjectURL(blob));
        setPhase("review");
      };
      recorderRef.current = recorder;
      recorder.start();
      startedAtRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startedAtRef.current);
      }, 250);
      setPhase("recording");
    } catch {
      setPhase("denied");
    }
  }, [stopTracks]);

  // Auto-start when the modal opens; clean up everything on close/unmount.
  useEffect(() => {
    if (open && phase === "idle") void startRecording();
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => reset, [reset]);

  function stop() {
    recorderRef.current?.stop();
  }

  async function save() {
    if (!fileRef.current) return;
    setSaving(true);
    try {
      await onSave(fileRef.current);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Voice note</DialogTitle>
          <DialogDescription>
            {phase === "review"
              ? "Review your recording, then save it to your library."
              : phase === "denied"
                ? "Microphone access is required to record."
                : "Recording from your microphone."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {phase === "denied" ? (
            <p className="text-sm text-muted-foreground">
              Allow microphone access in your browser and try again.
            </p>
          ) : phase === "review" && previewUrl ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mic className="size-4" />
                {formatElapsed(elapsed)} recorded
              </div>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={previewUrl} className="w-full" />
            </>
          ) : (
            <>
              <span className="relative flex size-16 items-center justify-center">
                <span
                  className={cn(
                    "absolute inset-0 rounded-full",
                    phase === "recording" ? "animate-ping bg-destructive/20" : "bg-muted"
                  )}
                />
                <span
                  className={cn(
                    "relative flex size-16 items-center justify-center rounded-full",
                    phase === "recording" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Mic className="size-6" />
                </span>
              </span>
              <div className="flex items-center gap-2 text-sm">
                {phase === "recording" && (
                  <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
                )}
                <span className="tabular-nums font-medium">
                  {phase === "requesting" ? "Starting…" : formatElapsed(elapsed)}
                </span>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {phase === "recording" && (
            <Button type="button" variant="destructive" onClick={stop} className="gap-1.5">
              <Square className="size-3.5" />
              Stop
            </Button>
          )}
          {phase === "review" && (
            <>
              <Button type="button" variant="ghost" onClick={() => void startRecording()}>
                Re-record
              </Button>
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save voice note"}
              </Button>
            </>
          )}
          {phase === "denied" && (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

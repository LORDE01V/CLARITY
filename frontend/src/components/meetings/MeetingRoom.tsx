import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Copy, ExternalLink, Mic, Square, Video, X } from "lucide-react";
import type { MeetingRecap, TeamMeeting } from "@/types";
import { Button } from "@/components/ui/Button";
import {
  formatElapsed,
  useMeetingRecorder,
} from "@/hooks/useMeetingRecorder";

interface MeetingRoomProps {
  meeting: TeamMeeting;
  creating?: boolean;
  transcribing: boolean;
  error: string | null;
  onClose: () => void;
  onEnd: () => Promise<void>;
  onTranscribe: (file: File) => Promise<{ transcript: string }>;
  onCreateRecap: (transcript: string) => Promise<MeetingRecap>;
  onRecapReady: (recap: MeetingRecap) => void;
}

export function MeetingRoom({
  meeting,
  transcribing,
  error,
  onClose,
  onEnd,
  onTranscribe,
  onCreateRecap,
  onRecapReady,
}: MeetingRoomProps) {
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<
    "live" | "finishing" | "transcribing" | "recapping"
  >("live");
  const [localError, setLocalError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const finishingRef = useRef(false);

  const recorder = useMeetingRecorder(meeting.status !== "ended");

  useEffect(() => {
    if (recorder.error) setLocalError(recorder.error);
  }, [recorder.error]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(meeting.meeting_url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setLocalError("Could not copy link");
    }
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setLocalError(null);
    setPhase("transcribing");
    try {
      const result = await onTranscribe(file);
      setTranscript(result.transcript);
      setPhase("live");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Transcription failed");
      setPhase("live");
    }
  }

  async function finishMeeting(generateRecap: boolean) {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setLocalError(null);
    setPhase("finishing");

    try {
      const recording = await recorder.stop();
      let text = transcript.trim();

      if (recording && recording.size > 0) {
        setPhase("transcribing");
        const result = await onTranscribe(recording);
        text = result.transcript.trim();
        setTranscript(text);
      }

      if (generateRecap) {
        if (text.length < 20) {
          setLocalError(
            "Not enough audio to build a recap. Share this tab with audio next time, or upload a file / paste notes."
          );
          await onEnd();
          setPhase("live");
          return;
        }
        setPhase("recapping");
        const recap = await onCreateRecap(text);
        await onEnd();
        onRecapReady(recap);
        return;
      }

      await onEnd();
      setPhase("live");
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Could not finish meeting"
      );
      setPhase("live");
      try {
        await onEnd();
      } catch {
        /* still try to close server-side meeting */
      }
    } finally {
      finishingRef.current = false;
    }
  }

  async function handleRecap(event: FormEvent) {
    event.preventDefault();
    if (transcript.trim().length < 20) {
      setLocalError("Transcript needs at least 20 characters");
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      const recap = await onCreateRecap(transcript.trim());
      onRecapReady(recap);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not create recap");
    } finally {
      setBusy(false);
    }
  }

  const recordingLive = recorder.mode === "tab" || recorder.mode === "mic";
  const statusLabel =
    phase === "finishing"
      ? "Stopping recording…"
      : phase === "transcribing" || transcribing
        ? "Transcribing full meeting with Whisper…"
        : phase === "recapping"
          ? "Drafting key takeaways…"
          : recorder.mode === "starting"
            ? "Starting recorder — share this tab and enable audio"
            : recorder.mode === "tab"
              ? `Recording tab audio · ${formatElapsed(recorder.elapsedSec)}`
              : recorder.mode === "mic"
                ? `Recording mic · ${formatElapsed(recorder.elapsedSec)}`
                : "Recorder idle";

  return (
    <div
      className="clarity-modal-overlay"
      data-open="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[var(--radius-md)] border border-border bg-popover shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-primary">
              <Video className="size-4" aria-hidden />
              <span className="text-[11px] font-semibold tracking-[0.04em]">
                Live meeting · Jitsi
              </span>
              {recordingLive && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                  <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
                  REC {formatElapsed(recorder.elapsedSec)}
                </span>
              )}
            </div>
            <h2
              id={titleId}
              className="mt-1 truncate text-lg font-semibold text-card-foreground"
            >
              {meeting.title}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => void copyLink()}>
              <Copy className="size-3.5" aria-hidden />
              {copied ? "Copied Jitsi link" : "Copy Jitsi link"}
            </Button>
            <a
              href={meeting.meeting_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex"
            >
              <Button type="button" variant="secondary" size="sm">
                <ExternalLink className="size-3.5" aria-hidden />
                Open tab
              </Button>
            </a>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void finishMeeting(true)}
              disabled={
                meeting.status === "ended" ||
                phase !== "live" ||
                busy ||
                transcribing
              }
            >
              <Square className="size-3.5" aria-hidden />
              End &amp; transcribe
            </Button>
            <button
              type="button"
              aria-label="Close meeting"
              onClick={onClose}
              className="clarity-focus flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1.35fr_0.85fr]">
          <div className="min-h-[320px] bg-black lg:min-h-[520px]">
            <iframe
              title={`Jitsi meeting ${meeting.title}`}
              src={meeting.meeting_url}
              allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
              className="h-full min-h-[320px] w-full border-0 lg:min-h-[520px]"
              allowFullScreen
            />
          </div>

          <form
            onSubmit={(e) => void handleRecap(e)}
            className="flex min-h-0 flex-col gap-3 overflow-auto border-t border-border p-4 lg:border-l lg:border-t-0"
          >
            <h3 className="text-[12px] font-semibold text-card-foreground">
              Auto record → Whisper → key takeaways
            </h3>
            <p className="text-[11px] leading-5 text-muted-light">
              When prompted, choose <strong className="font-medium text-text-body">this tab</strong>{" "}
              and turn on <strong className="font-medium text-text-body">tab audio</strong>. Clarity
              records the call, then on <strong className="font-medium text-text-body">End &amp;
              transcribe</strong> runs Whisper and drafts takeaways automatically.
            </p>

            <div className="rounded-[var(--radius-sm)] border border-border-subtle bg-row-hover/80 px-3 py-2.5">
              <p className="text-[11px] font-medium text-card-foreground">{statusLabel}</p>
              {recorder.mode === "starting" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => void recorder.start()}
                >
                  Retry share / record
                </Button>
              )}
              {(recorder.mode === "idle" || recorder.mode === "stopped") &&
                meeting.status !== "ended" && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    onClick={() => void recorder.start()}
                  >
                    Start recording
                  </Button>
                )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="audio/*,video/webm,video/mp4,.mp3,.wav,.m4a,.webm"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit"
              disabled={transcribing || phase !== "live"}
              onClick={() => fileRef.current?.click()}
            >
              <Mic className="size-3.5" aria-hidden />
              {transcribing ? "Transcribing…" : "Upload backup audio"}
            </Button>

            <label className="block text-[12px] font-semibold text-card-foreground">
              Full transcript
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="clarity-input mt-2 min-h-40 resize-y text-[12px] leading-5"
                placeholder="Appears automatically after End & transcribe — or paste notes."
              />
            </label>

            {(error || localError) && (
              <p className="text-[12px] text-destructive">{error || localError}</p>
            )}

            <div className="mt-auto flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                disabled={
                  meeting.status === "ended" ||
                  phase !== "live" ||
                  busy ||
                  transcribing
                }
                onClick={() => void finishMeeting(true)}
              >
                {phase === "transcribing" || transcribing
                  ? "Transcribing…"
                  : phase === "recapping"
                    ? "Drafting takeaways…"
                    : "End & transcribe"}
              </Button>
              <Button
                type="submit"
                variant="secondary"
                disabled={busy || transcript.trim().length < 20 || phase !== "live"}
              >
                {busy ? "Drafting…" : "Recap from transcript"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={meeting.status === "ended" || phase !== "live"}
                onClick={() => void finishMeeting(false)}
              >
                End without recap
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface StartMeetingFormProps {
  creating: boolean;
  error: string | null;
  onCancel: () => void;
  onStart: (title: string) => Promise<void>;
}

export function StartMeetingForm({
  creating,
  error,
  onCancel,
  onStart,
}: StartMeetingFormProps) {
  const [title, setTitle] = useState("Team sync");

  return (
    <div
      className="clarity-modal-overlay"
      data-open="true"
      role="dialog"
      aria-modal="true"
    >
      <form
        className="w-full max-w-md rounded-[var(--radius-md)] border border-border bg-card p-6 shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          void onStart(title.trim());
        }}
      >
        <h2 className="text-lg font-semibold text-card-foreground">New meeting</h2>
        <p className="mt-2 text-[12px] leading-5 text-muted-light">
          Creates a Jitsi room. Clarity will ask to share this tab with audio so the
          full call can be transcribed when you end.
        </p>
        <label className="mt-4 block text-[12px] font-semibold text-card-foreground">
          Title
          <input
            className="clarity-input mt-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
          />
        </label>
        {error && <p className="mt-3 text-[12px] text-destructive">{error}</p>}
        <div className="mt-5 flex gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={creating}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={creating || !title.trim()}>
            {creating ? "Creating room…" : "Start meeting"}
          </Button>
        </div>
      </form>
    </div>
  );
}

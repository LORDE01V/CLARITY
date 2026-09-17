import { useId, useRef, useState, type FormEvent } from "react";
import { Copy, ExternalLink, Mic, Square, Video, X } from "lucide-react";
import type { MeetingRecap, TeamMeeting } from "@/types";
import { Button } from "@/components/ui/Button";

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
  const [localError, setLocalError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    try {
      const result = await onTranscribe(file);
      setTranscript(result.transcript);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Transcription failed");
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
            <div className="flex items-center gap-2 text-primary">
              <Video className="size-4" aria-hidden />
              <span className="text-[11px] font-semibold tracking-[0.04em]">
                Live meeting · Jitsi
              </span>
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
              {copied ? "Copied" : "Copy link"}
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
              variant="secondary"
              size="sm"
              onClick={() => void onEnd()}
              disabled={meeting.status === "ended"}
            >
              <Square className="size-3.5" aria-hidden />
              End
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
              After the call → Whisper → AI recap
            </h3>
            <p className="text-[11px] leading-5 text-muted-light">
              Public Jitsi does not push recordings into Clarity automatically.
              Upload a short audio/video clip (or paste notes) to transcribe with
              Whisper, then draft the recap.
            </p>

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
              disabled={transcribing}
              onClick={() => fileRef.current?.click()}
            >
              <Mic className="size-3.5" aria-hidden />
              {transcribing ? "Transcribing…" : "Upload audio for Whisper"}
            </Button>

            <label className="block text-[12px] font-semibold text-card-foreground">
              Transcript
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="clarity-input mt-2 min-h-40 resize-y text-[12px] leading-5"
                placeholder="Whisper output appears here, or paste notes manually."
              />
            </label>

            {(error || localError) && (
              <p className="text-[12px] text-destructive">{error || localError}</p>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={busy || transcript.trim().length < 20}
            >
              {busy ? "Drafting recap…" : "Generate AI recap"}
            </Button>
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
          Creates a private-ish Jitsi room on meet.jit.si and embeds it in Clarity.
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

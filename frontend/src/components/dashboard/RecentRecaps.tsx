import { useState, type FormEvent } from "react";
import { ChevronRight, Plus, Sparkles } from "lucide-react";
import type { MeetingRecap } from "@/types";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface RecentRecapsProps {
  recaps: MeetingRecap[];
  loading: boolean;
  error: string | null;
  hasTeam: boolean;
  onOpenRecap: (recap: MeetingRecap) => void;
  onCreate: () => void;
  onClearError?: () => void;
}

function statusLabel(status: MeetingRecap["status"]): string {
  if (status === "sent") return "Sent to chat";
  if (status === "reviewed") return "Reviewed · ready to send";
  return "Drafted by AI · awaiting review";
}

function formatMeta(recap: MeetingRecap): string {
  const when = new Date(recap.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${when}${recap.model ? ` · ${recap.model}` : ""}`;
}

export function RecentRecaps({
  recaps,
  loading,
  error,
  hasTeam,
  onOpenRecap,
  onCreate,
  onClearError,
}: RecentRecapsProps) {
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <SectionHeader title="Recent recaps to review" />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCreate}
          disabled={!hasTeam}
        >
          <Plus className="size-3.5" aria-hidden />
          New recap
        </Button>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-3">
          <p className="text-[12px] text-destructive">{error}</p>
          {onClearError && (
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline"
              onClick={onClearError}
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {!hasTeam ? (
        <p className="px-5 py-6 text-[12px] text-muted-light">
          Create or join a workspace to generate meeting recaps.
        </p>
      ) : loading ? (
        <p className="px-5 py-6 text-[12px] text-muted-light">Loading recaps…</p>
      ) : recaps.length === 0 ? (
        <div className="flex flex-col gap-3 px-5 py-6">
          <p className="text-[12px] leading-5 text-muted-light">
            Paste a transcript or notes, draft with GPT-4o-mini, review, then send to
            #general.
          </p>
          <Button type="button" variant="primary" size="sm" className="w-fit" onClick={onCreate}>
            <Sparkles className="size-3.5" aria-hidden />
            Generate first recap
          </Button>
        </div>
      ) : (
        <div className="flex flex-col">
          {recaps.map((recap) => (
            <button
              key={recap.id}
              type="button"
              onClick={() => onOpenRecap(recap)}
              className="clarity-row clarity-focus flex items-center gap-3 border-b border-border-subtle px-5 py-3.5 text-left last:border-b-0"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <Sparkles className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-text-body">
                  {recap.title}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-light">
                  {formatMeta(recap)}
                </p>
              </div>
              <span className="hidden rounded-full bg-[var(--badge-neutral)] px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm sm:block">
                {statusLabel(recap.status)}
              </span>
              <ChevronRight className="size-4 text-[var(--text-icon-muted)]" />
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

interface NewRecapFormProps {
  generating: boolean;
  error: string | null;
  onSubmit: (input: {
    title: string;
    transcript: string;
    meeting_url?: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export function NewRecapForm({
  generating,
  error,
  onSubmit,
  onCancel,
}: NewRecapFormProps) {
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await onSubmit({
      title: title.trim(),
      transcript: transcript.trim(),
      meeting_url: meetingUrl.trim() || undefined,
    });
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
      <label className="block text-[12px] font-semibold text-card-foreground">
        Meeting title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="clarity-input mt-2"
          placeholder="Meeting title"
          required
          maxLength={200}
        />
      </label>
      <label className="block text-[12px] font-semibold text-card-foreground">
        Transcript or notes
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          className="clarity-input mt-2 min-h-48 resize-y text-[13px] leading-6"
          placeholder="Paste the meeting transcript or your notes (min ~20 characters)."
          required
          minLength={20}
        />
      </label>
      <label className="block text-[12px] font-semibold text-card-foreground">
        Meeting link (optional)
        <input
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          className="clarity-input mt-2"
          placeholder="https://meet.jit.si/your-room"
        />
      </label>
      {error && <p className="text-[12px] text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={generating}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={generating || title.trim().length < 1 || transcript.trim().length < 20}
        >
          {generating ? "Drafting with GPT-4o-mini…" : "Generate AI draft"}
        </Button>
      </div>
    </form>
  );
}

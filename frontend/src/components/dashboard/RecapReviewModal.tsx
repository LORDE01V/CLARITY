import { useEffect, useId, useRef, useState } from "react";
import { Check, Hash, Sparkles, X } from "lucide-react";
import type { MeetingRecap, RecapActionItem } from "@/types";
import { Button } from "@/components/ui/Button";
import { NewRecapForm } from "@/components/dashboard/RecentRecaps";

interface RecapReviewModalProps {
  mode: "create" | "review";
  recap: MeetingRecap | null;
  generating: boolean;
  error: string | null;
  onClose: () => void;
  onGenerate: (input: {
    title: string;
    transcript: string;
    meeting_url?: string;
  }) => Promise<MeetingRecap>;
  onSave: (input: {
    summary: string;
    action_items: RecapActionItem[];
  }) => Promise<MeetingRecap>;
  onSend: () => Promise<MeetingRecap>;
}

export function RecapReviewModal({
  mode,
  recap,
  generating,
  error,
  onClose,
  onGenerate,
  onSave,
  onSend,
}: RecapReviewModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [summary, setSummary] = useState(recap?.summary ?? "");
  const [items, setItems] = useState<RecapActionItem[]>(recap?.action_items ?? []);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [sent, setSent] = useState(recap?.status === "sent");
  const [active, setActive] = useState<MeetingRecap | null>(recap);

  useEffect(() => {
    setActive(recap);
    setSummary(recap?.summary ?? "");
    setItems(recap?.action_items ?? []);
    setSent(recap?.status === "sent");
  }, [recap]);

  useEffect(() => {
    document.body.classList.add("clarity-modal-open");
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("clarity-modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  function toggleAction(index: number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, done: !item.done } : item))
    );
  }

  async function handleSaveAndSend(editFirst: boolean) {
    if (!active) return;
    setBusy(true);
    setLocalError(null);
    try {
      if (editFirst || active.status !== "reviewed") {
        await onSave({ summary, action_items: items });
      }
      await onSend();
      setSent(true);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not send recap");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div
        className="clarity-modal-overlay"
        data-open="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-border bg-card p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-primary">
            <Check className="size-6" aria-hidden />
          </div>
          <h2 id={titleId} className="text-lg font-semibold text-card-foreground">
            Recap sent
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your meeting summary was posted to team chat.
          </p>
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={onClose}
            className="mt-6"
            ref={closeRef}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  const showCreate = mode === "create" && !active;

  return (
    <div
      className="clarity-modal-overlay"
      data-open="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-warm)] bg-popover shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden />
              <span className="text-[11px] font-semibold tracking-[0.04em] text-primary">
                AI recap
              </span>
            </div>
            <h2
              id={titleId}
              className="mt-1 truncate text-lg font-semibold text-card-foreground"
            >
              {showCreate ? "New meeting recap" : active?.title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="clarity-focus flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-card-foreground"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        {showCreate ? (
          <div className="overflow-auto p-6">
            <NewRecapForm
              generating={generating}
              error={error || localError}
              onCancel={onClose}
              onSubmit={async (input) => {
                setLocalError(null);
                try {
                  const created = await onGenerate(input);
                  setActive(created);
                  setSummary(created.summary);
                  setItems(created.action_items);
                } catch (err) {
                  setLocalError(
                    err instanceof Error ? err.message : "Could not generate recap"
                  );
                }
              }}
            />
          </div>
        ) : (
          <>
            <div className="grid min-h-0 flex-1 gap-6 overflow-auto p-6 md:grid-cols-[0.92fr_1.08fr]">
              <div className="min-h-0">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[12px] font-semibold text-card-foreground">
                    Transcript
                  </h3>
                </div>
                <div className="h-72 overflow-auto whitespace-pre-wrap rounded-[var(--radius-sm)] border border-border bg-card p-4 text-[12px] leading-6 text-text-chat md:h-[410px]">
                  {active?.transcript}
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <div>
                  <label
                    htmlFor="recap-summary"
                    className="mb-3 block text-[12px] font-semibold text-card-foreground"
                  >
                    Summary
                  </label>
                  <textarea
                    id="recap-summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="clarity-input min-h-44 resize-y text-[13px] leading-6"
                    disabled={active?.status === "sent"}
                  />
                </div>

                <fieldset>
                  <legend className="mb-3 text-[12px] font-semibold text-card-foreground">
                    Action items
                  </legend>
                  <div className="flex flex-col gap-2">
                    {items.length === 0 ? (
                      <p className="text-[12px] text-muted-light">No action items.</p>
                    ) : (
                      items.map((action, index) => (
                        <label
                          key={`${action.text}-${index}`}
                          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-[12px] text-text-subtle shadow-card"
                        >
                          <input
                            type="checkbox"
                            checked={action.done}
                            onChange={() => toggleAction(index)}
                            className="size-4 accent-primary"
                            disabled={active?.status === "sent"}
                          />
                          {action.text}
                        </label>
                      ))
                    )}
                  </div>
                </fieldset>

                <div>
                  <h3 className="mb-3 text-[12px] font-semibold text-card-foreground">
                    Send to
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] text-text-subtle shadow-card">
                      <Hash className="size-3.5 text-primary" aria-hidden />
                      #general
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <footer className="flex flex-col gap-4 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-muted-light">
                Drafted by{" "}
                <strong className="font-medium text-text-chat">
                  {active?.model ?? "Clarity AI"}
                </strong>
                {" · "}
                Review before sending
              </p>
              <div className="flex flex-wrap gap-2">
                {(error || localError) && (
                  <p className="w-full text-[12px] text-destructive sm:w-auto">
                    {error || localError}
                  </p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || active?.status === "sent"}
                  onClick={() => void handleSaveAndSend(false)}
                >
                  {busy ? "Sending…" : "Send as-is"}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy || active?.status === "sent"}
                  onClick={() => void handleSaveAndSend(true)}
                >
                  {busy ? "Sending…" : "Edit and send"}
                </Button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

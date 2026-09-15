import { useEffect, useId, useRef, useState } from "react";
import { Check, Hash, Plus, Sparkles, Users, X } from "lucide-react";
import {
  DEFAULT_RECAP_SUMMARY,
  RECAP_ACTION_ITEMS,
} from "@/data/dashboard";
import { Button } from "@/components/ui/Button";

interface RecapReviewModalProps {
  onClose: () => void;
}

export function RecapReviewModal({ onClose }: RecapReviewModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [summary, setSummary] = useState(DEFAULT_RECAP_SUMMARY);
  const [checked, setChecked] = useState([true, false, false]);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.body.classList.add("clarity-modal-open");
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("clarity-modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  function toggleAction(index: number) {
    setChecked((prev) => prev.map((item, i) => (i === index ? !item : item)));
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
            Your meeting summary has been shared with the team.
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
              Q3 planning sync
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

        <div className="grid min-h-0 flex-1 gap-6 overflow-auto p-6 md:grid-cols-[0.92fr_1.08fr]">
          <div className="min-h-0">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[12px] font-semibold text-card-foreground">Transcript</h3>
              <span className="tabular-nums text-[11px] text-muted-light">42:18</span>
            </div>
            <div className="h-72 overflow-auto rounded-[var(--radius-sm)] border border-border bg-card p-4 text-[12px] leading-6 text-text-chat md:h-[410px]">
              <p>
                <strong className="text-card-foreground">Maya Chen · 10:32</strong>
                <br />
                Okay, let&apos;s start with activation. We&apos;ve seen a meaningful
                drop-off after the first session, and I think we can make the
                handoff much clearer.
              </p>
              <p className="mt-4">
                <strong className="text-card-foreground">James Wilson · 10:35</strong>
                <br />
                Agreed. The data suggests most people understand the value, but
                they don&apos;t know what to do next. I&apos;ll pull the funnel apart
                and share the segments.
              </p>
              <p className="mt-4">
                <strong className="text-card-foreground">Maya Chen · 10:41</strong>
                <br />
                Perfect. I&apos;ll take the first pass at a refreshed welcome flow.
                Let&apos;s bring concepts to the group on Friday.
              </p>
              <p className="mt-4">
                <strong className="text-card-foreground">You · 10:45</strong>
                <br />
                That sounds good. Let&apos;s keep the scope tight and focus on getting
                new users to their first win.
              </p>
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
              />
            </div>

            <fieldset>
              <legend className="mb-3 text-[12px] font-semibold text-card-foreground">
                Action items
              </legend>
              <div className="flex flex-col gap-2">
                {RECAP_ACTION_ITEMS.map((action, index) => (
                  <label
                    key={action}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-[12px] text-text-subtle shadow-card"
                  >
                    <input
                      type="checkbox"
                      checked={checked[index]}
                      onChange={() => toggleAction(index)}
                      className="size-4 accent-primary"
                    />
                    {action}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <h3 className="mb-3 text-[12px] font-semibold text-card-foreground">
                Send to
              </h3>
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] text-text-subtle shadow-card">
                  <Users className="size-3.5 text-primary" aria-hidden />
                  Product team
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] text-text-subtle shadow-card">
                  <Hash className="size-3.5 text-primary" aria-hidden />
                  #product-updates
                </span>
                <button
                  type="button"
                  aria-label="Add recipient"
                  className="clarity-focus flex size-11 items-center justify-center rounded-full border border-dashed border-[var(--border-dashed)] text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-4 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-light">
            Drafted by <strong className="font-medium text-text-chat">Clarity AI</strong>
            {" · "}Reviewed by you just now
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setSent(true)}>
              Send as-is
            </Button>
            <Button type="button" variant="primary" onClick={() => setSent(true)}>
              Edit and send
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

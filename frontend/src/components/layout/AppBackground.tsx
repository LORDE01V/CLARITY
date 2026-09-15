import { MARK_URL } from "@/lib/brand";

/**
 * Soft page atmosphere + large Clarity marks (no wordmark).
 */
export function AppBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background"
    >
      {/* Soft color atmosphere */}
      <div className="absolute -right-40 -top-44 size-[760px] rounded-full bg-[var(--glow-teal)]" />
      <div className="absolute -left-52 bottom-[-280px] size-[620px] rounded-full border-[72px] border-[var(--ring-teal)]" />
      <div className="absolute left-[20%] top-[48%] size-[420px] rounded-full bg-[var(--glow-teal)] opacity-70 blur-3xl" />

      {/* One large mark — top right */}
      <img
        src={MARK_URL}
        alt=""
        className="clarity-brand-mark absolute -right-[12%] -top-[8%] w-[min(72vw,640px)] max-w-none opacity-[0.28]"
      />

      {/* One large mark — bottom left */}
      <img
        src={MARK_URL}
        alt=""
        className="clarity-brand-mark absolute -bottom-[18%] -left-[14%] w-[min(78vw,720px)] max-w-none rotate-[16deg] opacity-[0.22]"
      />

      {/* Subtle structural accents */}
      <div className="clarity-dot-grid absolute right-10 top-0 h-72 w-72 opacity-60" />
      <div className="clarity-contours absolute bottom-0 right-0 h-80 w-[460px] opacity-70" />
    </div>
  );
}

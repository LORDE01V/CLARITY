/**
 * Clarity mark as “people around a table”:
 * center disc = table; three outer discs = chairs seating.
 */
export function AnimatedMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`clarity-splash-mark ${className}`}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Clarity logo"
    >
      <circle className="clarity-splash-chair clarity-splash-chair--top" cx="60" cy="42" r="34" fill="#0F6C73" />
      <circle className="clarity-splash-chair clarity-splash-chair--left" cx="42" cy="72" r="34" fill="#9ED4D8" />
      <circle className="clarity-splash-chair clarity-splash-chair--right" cx="78" cy="72" r="34" fill="#147D85" />
      <circle className="clarity-splash-table" cx="60" cy="62" r="16" fill="#FFFFFF" />
      <circle className="clarity-splash-table-dot" cx="60" cy="62" r="7" fill="#0F6C73" />
    </svg>
  );
}

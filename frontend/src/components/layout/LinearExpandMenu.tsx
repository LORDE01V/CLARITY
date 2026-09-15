import { useEffect, useId, type CSSProperties } from "react";
import { LogOut, Menu, Settings, X } from "lucide-react";
import { NAV_ITEMS } from "@/data/dashboard";
import { cn } from "@/lib/utils";

interface LinearExpandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeItem: string;
  onNavigate: (label: string) => void;
  onLogout: () => void;
  /** Optional live badge overrides keyed by nav label (e.g. Tasks open count). */
  counts?: Record<string, string>;
}

/** Vertical drop distance from the toggle center for each item. */
const ITEM_OFFSET = 56;

export function LinearExpandMenu({
  open,
  onOpenChange,
  activeItem,
  onNavigate,
  onLogout,
  counts,
}: LinearExpandMenuProps) {
  const labelId = useId();
  const items = [
    ...NAV_ITEMS.map((item) => ({
      key: item.label,
      label: item.label,
      icon: item.icon,
      count: counts?.[item.label] ?? item.count,
      active: activeItem === item.label,
      onSelect: () => {
        onNavigate(item.label);
        onOpenChange(false);
      },
    })),
    {
      key: "settings",
      label: "Settings",
      icon: Settings,
      active: false,
      onSelect: () => onOpenChange(false),
    },
    {
      key: "logout",
      label: "Sign out",
      icon: LogOut,
      active: false,
      onSelect: () => {
        onLogout();
        onOpenChange(false);
      },
    },
  ];

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-[#292724]/22 backdrop-blur-[2px]"
          aria-label="Close navigation"
          onClick={() => onOpenChange(false)}
        />
      )}

      <nav
        className="pointer-events-none fixed left-4 top-4 z-50"
        aria-labelledby={labelId}
      >
        <span id={labelId} className="sr-only">
          Workspace navigation
        </span>

        <div className="relative flex size-12 items-center justify-start">
          <div
            aria-hidden="true"
            className={cn(
              "clarity-linear-bloom absolute left-6 top-6",
              open && "clarity-linear-bloom--open"
            )}
            style={
              {
                "--bloom-length": `${items.length * ITEM_OFFSET + 24}px`,
              } as CSSProperties
            }
          />

          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                tabIndex={open ? 0 : -1}
                aria-hidden={!open}
                aria-current={item.active ? "page" : undefined}
                aria-label={item.label}
                onClick={item.onSelect}
                className={cn(
                  "clarity-linear-item absolute left-0 top-0 flex min-h-12 items-center gap-3 rounded-full border border-white/70 bg-white/95 py-2 pl-2.5 pr-4 text-left text-[13px] font-medium text-secondary-foreground shadow-card backdrop-blur-md",
                  open && "clarity-linear-item--open",
                  item.active && "border-primary/30 bg-accent text-primary shadow-button"
                )}
                style={
                  {
                    "--linear-y": `${(index + 1) * ITEM_OFFSET}px`,
                    "--linear-delay": `${index * 40}ms`,
                  } as CSSProperties
                }
                title={item.label}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    item.active ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.85} aria-hidden />
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  {item.label}
                  {"count" in item && item.count != null && (
                    <span className="tabular-nums text-[11px] text-muted-light">
                      {item.count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            aria-expanded={open}
            aria-controls={labelId}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => onOpenChange(!open)}
            className={cn(
              "clarity-linear-toggle pointer-events-auto relative z-20 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-button",
              open && "clarity-linear-toggle--open"
            )}
          >
            <span className="relative size-5">
              <Menu
                className={cn(
                  "absolute inset-0 size-5 transition-all duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  open ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
                )}
                strokeWidth={2}
                aria-hidden
              />
              <X
                className={cn(
                  "absolute inset-0 size-5 transition-all duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
                )}
                strokeWidth={2}
                aria-hidden
              />
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

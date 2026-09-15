import { MoreHorizontal, Settings } from "lucide-react";
import { NAV_ITEMS } from "@/data/dashboard";
import type { AuthUser } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeItem: string;
  onNavigate: (label: string) => void;
  user: AuthUser;
  onLogout: () => void;
}

function getInitials(user: AuthUser): string {
  if (user.full_name) {
    const parts = user.full_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

export function Sidebar({ activeItem, onNavigate, user, onLogout }: SidebarProps) {
  const displayName = user.full_name ?? user.email;
  const initials = getInitials(user);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-sidebar-border bg-sidebar/90 px-3 py-5 shadow-card backdrop-blur-md lg:flex">
      <div className="mb-9 px-3">
        <BrandLogo />
      </div>

      <nav className="flex flex-col gap-1" aria-label="Primary">
        {NAV_ITEMS.map(({ label, icon: Icon, count }) => {
          const isActive = activeItem === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onNavigate(label)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "clarity-nav-item clarity-focus w-full min-h-11",
                isActive ? "clarity-nav-item--active" : "clarity-nav-item--inactive"
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="size-[17px]" strokeWidth={1.8} aria-hidden />
                {label}
              </span>
              {count && (
                <span
                  className={cn(
                    "tabular-nums text-[10px]",
                    isActive ? "text-primary" : "text-muted-light"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <Button
          type="button"
          variant="ghost"
          className="mb-4 h-11 w-full justify-start gap-3 px-3 text-[12px] font-medium text-secondary-foreground"
        >
          <Settings className="size-[17px]" strokeWidth={1.8} aria-hidden />
          Settings
        </Button>

        <div className="flex items-center gap-3 border-t border-border px-3 pt-4">
          <Avatar initials={initials} className="bg-accent text-primary shadow-card" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-text-body">
              {displayName}
            </p>
            <p className="truncate text-[10px] text-muted-light">Product · Online</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out"
            className="clarity-focus flex size-11 items-center justify-center rounded-md text-muted-light transition-colors hover:bg-secondary hover:text-card-foreground"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}

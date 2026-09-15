import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppBackground } from "@/components/layout/AppBackground";
import { BrandLogo } from "@/components/ui/BrandLogo";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  footer?: ReactNode;
}

export function AuthLayout({ children, title, subtitle, footer }: AuthLayoutProps) {
  return (
    <div className="clarity-auth relative z-10 flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-foreground">
      <AppBackground />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/login">
            <BrandLogo size="md" />
          </Link>
        </div>

        <div className="clarity-panel p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold tracking-[-0.03em] text-card-foreground">
              {title}
            </h1>
            <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{subtitle}</p>
          </div>

          {children}
        </div>

        {footer && (
          <div className="mt-6 text-center text-[13px] text-muted-foreground">{footer}</div>
        )}
      </div>
    </div>
  );
}

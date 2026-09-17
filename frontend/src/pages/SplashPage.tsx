import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { AnimatedMark } from "@/components/splash/AnimatedMark";
import { BRAND_NAME } from "@/lib/brand";

type SplashPhase = "gather" | "brand" | "ready";

/**
 * Entry splash: chairs gather around the table, then Clarity + auth CTAs.
 * Visual language matches the approved splash mock (soft teal arcs, dots, mark).
 */
export function SplashPage() {
  const { user, loading } = useAuth();
  const [phase, setPhase] = useState<SplashPhase>("gather");

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setPhase("ready");
      return;
    }

    const brandTimer = window.setTimeout(() => setPhase("brand"), 1400);
    const readyTimer = window.setTimeout(() => setPhase("ready"), 2200);
    return () => {
      window.clearTimeout(brandTimer);
      window.clearTimeout(readyTimer);
    };
  }, []);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const showBrand = phase === "brand" || phase === "ready";
  const showActions = phase === "ready";

  return (
    <div
      className={`clarity-splash ${phase === "ready" ? "clarity-splash--ready" : ""}`}
      data-phase={phase}
    >
      <div className="clarity-splash-atmosphere" aria-hidden="true">
        <div className="clarity-splash-wash clarity-splash-wash--tl" />
        <div className="clarity-splash-wash clarity-splash-wash--br" />
        <div className="clarity-splash-arc clarity-splash-arc--tl" />
        <div className="clarity-splash-arc clarity-splash-arc--br" />
        <div className="clarity-splash-curve clarity-splash-curve--tl" />
        <div className="clarity-splash-curve clarity-splash-curve--br" />
        <div className="clarity-dot-grid clarity-splash-dots clarity-splash-dots--tr" />
        <div className="clarity-dot-grid clarity-splash-dots clarity-splash-dots--bl" />
      </div>

      <main className="clarity-splash-stage">
        <div className="clarity-splash-mark-wrap">
          <AnimatedMark />
        </div>

        <h1
          className={`clarity-splash-wordmark ${showBrand ? "is-visible" : ""}`}
          aria-hidden={!showBrand}
        >
          {BRAND_NAME}
        </h1>

        <div
          className={`clarity-splash-progress ${showActions ? "is-done" : ""} ${showBrand ? "is-visible" : ""}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={showActions ? "Ready" : "Loading"}
          aria-hidden={showActions}
        >
          <span className="clarity-splash-progress-fill" />
        </div>

        <div
          className={`clarity-splash-actions ${showActions ? "is-visible" : ""}`}
          aria-hidden={!showActions}
        >
          <Link
            to="/login"
            className="clarity-splash-btn clarity-splash-btn--primary"
            tabIndex={showActions ? 0 : -1}
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="clarity-splash-btn clarity-splash-btn--secondary"
            tabIndex={showActions ? 0 : -1}
          >
            Sign up
          </Link>
        </div>
      </main>
    </div>
  );
}

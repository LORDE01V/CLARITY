import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { hasApiBaseUrl, hasSupabaseEnv, isAuthBypassFlagFalse } from "@/lib/auth/config";

export function LoginPage() {
  const { login, enterDemo, user, isBypassMode } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const envGap =
    isAuthBypassFlagFalse() && (!hasSupabaseEnv() || !hasApiBaseUrl())
      ? "VITE_AUTH_BYPASS is false, but Supabase and/or VITE_API_BASE_URL are missing. Copy frontend/.env.example to frontend/.env and fill real values."
      : null;

  useEffect(() => {
    if (user) {
      navigate(nextPath, { replace: true });
    }
  }, [user, navigate, nextPath]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login({ email, password });
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDemoEntry() {
    enterDemo();
    navigate("/");
  }

  return (
    <AuthLayout
      title="Sign in to Clarity"
      subtitle="Access your workspace for tasks, chat, meetings, and GitHub activity."
      footer={
        <>
          No account?{" "}
          <Link
            to={
              nextPath.startsWith("/invites/")
                ? `/register?next=${encodeURIComponent(nextPath)}`
                : "/register"
            }
            className="font-medium text-primary hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      {isBypassMode && (
        <div className="clarity-info-banner mb-5">
          Demo mode is on. No database or backend is required. Use any credentials
          below, or skip straight into the app. Set VITE_AUTH_BYPASS=false for real
          auth.
        </div>
      )}

      {envGap && <div className="clarity-info-banner mb-5">{envGap}</div>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-body">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="clarity-input"
            required
            autoComplete="email"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-body">
          Password
          <span className="relative block">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="clarity-input pr-11"
              required
              minLength={8}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-text-body"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <EyeOff size={18} strokeWidth={1.75} />
              ) : (
                <Eye size={18} strokeWidth={1.75} />
              )}
            </button>
          </span>
        </label>

        {error && <p className="clarity-error">{error}</p>}

        <Button type="submit" variant="primary" size="lg" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      {isBypassMode && (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={handleDemoEntry}
          className="mt-3"
        >
          Enter demo workspace
        </Button>
      )}
    </AuthLayout>
  );
}

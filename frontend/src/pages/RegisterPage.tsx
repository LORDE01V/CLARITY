import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { hasApiBaseUrl, hasSupabaseEnv, isAuthBypassFlagFalse } from "@/lib/auth/config";

export function RegisterPage() {
  const { register, enterDemo, user, isBypassMode } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const [fullName, setFullName] = useState("Jordan Davis");
  const [email, setEmail] = useState("jordan@example.com");
  const [password, setPassword] = useState("password123");
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
      await register({ email, password, full_name: fullName });
      navigate(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
      title="Create your account"
      subtitle="Join your team workspace and keep tasks, chat, and meetings in one place."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to={
              nextPath.startsWith("/invites/")
                ? `/login?next=${encodeURIComponent(nextPath)}`
                : "/login"
            }
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      {isBypassMode && (
        <div className="clarity-info-banner mb-5">
          Demo mode is on. Registration will not hit a server. Set
          VITE_AUTH_BYPASS=false for real auth.
        </div>
      )}

      {envGap && <div className="clarity-info-banner mb-5">{envGap}</div>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-body">
          Full name
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="clarity-input"
            required
            autoComplete="name"
          />
        </label>

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
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="clarity-input"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>

        {error && <p className="clarity-error">{error}</p>}

        <Button type="submit" variant="primary" size="lg" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
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

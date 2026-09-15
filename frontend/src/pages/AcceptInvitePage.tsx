import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import type { Invite } from "@/types";

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const { adoptTeam } = useWorkspace();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const loginHref = token
    ? `/login?next=${encodeURIComponent(`/invites/${token}`)}`
    : "/login";

  useEffect(() => {
    if (!token) return;

    api.invites
      .get(token)
      .then(setInvite)
      .catch((err) => setError(err instanceof Error ? err.message : "Invite not found"));
  }, [token]);

  async function handleAccept(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    setAccepting(true);
    setError(null);

    try {
      const result = await api.invites.accept(token);
      await adoptTeam(result.team_id);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  }

  if (!user) {
    return (
      <AuthLayout
        title="Team invitation"
        subtitle="Sign in to accept this invite and join the team."
        footer={
          <Link to={loginHref} className="font-medium text-primary hover:underline">
            Sign in to continue
          </Link>
        }
      >
        <p className="text-center text-[13px] text-muted-foreground">
          You need to be signed in before accepting a team invite.
        </p>
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="primary" size="lg" onClick={() => navigate(loginHref)}>
            Sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (error && !invite) {
    return (
      <AuthLayout title="Invite unavailable" subtitle={error}>
        <p className="text-center text-[13px] text-muted-foreground">
          This invite may have expired or already been used.
        </p>
      </AuthLayout>
    );
  }

  if (!invite) {
    return (
      <AuthLayout title="Loading invitation" subtitle="Please wait while we verify your invite.">
        <p className="text-center text-[13px] text-muted-foreground">Loading invite details...</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="You have been invited"
      subtitle={`Join as ${invite.role.replace("_", " ")} on this team.`}
    >
      <form onSubmit={handleAccept} className="flex flex-col gap-4">
        <div className="rounded-[var(--radius-sm)] border border-border bg-row-hover px-4 py-3 text-[13px] text-text-subtle">
          <p>
            Sent to: <strong className="text-card-foreground">{invite.email}</strong>
          </p>
        </div>

        {error && <p className="clarity-error">{error}</p>}

        <Button type="submit" variant="primary" size="lg" disabled={accepting}>
          {accepting ? "Accepting..." : "Accept invitation"}
        </Button>
      </form>
    </AuthLayout>
  );
}

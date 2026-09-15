import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { api } from "@/lib/api";
import { hasMinimumRole, type Invite, type Role } from "@/types";

const INVITE_ROLES: { value: Role; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "project_manager", label: "Project manager" },
  { value: "guest", label: "Guest" },
];

interface InviteCreateFormProps {
  /** Owner/PM can invite; guests/members see a read-only note. */
  actorRole?: Role;
}

export function InviteCreateForm({ actorRole = "owner" }: InviteCreateFormProps) {
  const { isBypassMode } = useAuth();
  const { team, org } = useWorkspace();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);

  const canInvite = hasMinimumRole(actorRole, "project_manager");

  const inviteUrl = useMemo(() => {
    if (!created) return null;
    return `${window.location.origin}/invites/${created.token}`;
  }, [created]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!team || !canInvite) return;

    setError(null);
    setSubmitting(true);
    setCopied(false);

    try {
      const invite = await api.invites.create(team.id, { email: email.trim(), role });
      setCreated(invite);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
      setCreated(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (!team || !org) {
    return null;
  }

  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeader title="Invite teammates" />
      <p className="mb-1 text-[12px] leading-5 text-muted-foreground">
        Send a link for {team.name} in {org.name}. Requires project manager or owner.
      </p>

      {isBypassMode && (
        <div className="clarity-info-banner mt-4">
          Demo mode cannot create real invites. Set VITE_AUTH_BYPASS=false and
          configure Supabase + API env to use this form.
        </div>
      )}

      {!canInvite ? (
        <p className="mt-4 text-[13px] leading-6 text-muted-foreground">
          You do not have permission to invite members to this team.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-body">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="clarity-input"
              placeholder="teammate@company.com"
              required
              autoComplete="email"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-body">
            Role
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="clarity-input"
            >
              {INVITE_ROLES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="clarity-error">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !email.trim() || isBypassMode}
          >
            {submitting ? "Creating invite..." : "Create invite"}
          </Button>
        </form>
      )}

      {created && inviteUrl && (
        <div className="mt-5 rounded-[var(--radius-sm)] border border-border bg-row-hover px-4 py-3">
          <p className="text-[12px] font-medium text-text-body">Invite created</p>
          <p className="mt-1 break-all text-[12px] leading-5 text-muted-foreground">{inviteUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? "Copied" : "Copy link"}
            </Button>
            <p className="self-center text-[11px] text-muted-light">
              Expires {new Date(created.expires_at).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}

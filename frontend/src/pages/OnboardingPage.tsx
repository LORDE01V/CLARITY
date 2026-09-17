import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace, slugifyOrgName } from "@/components/WorkspaceProvider";
import { Button } from "@/components/ui/Button";

export function OnboardingPage() {
  const { user } = useAuth();
  const { createOrganization, needsOnboarding, loading, org } = useWorkspace();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const suggestedSlug = useMemo(() => slugifyOrgName(name), [name]);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(suggestedSlug);
    }
  }, [suggestedSlug, slugTouched]);

  useEffect(() => {
    if (!loading && org && !needsOnboarding) {
      navigate("/", { replace: true });
    }
  }, [loading, org, needsOnboarding, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await createOrganization({
        name: name.trim(),
        slug: (slug || suggestedSlug).trim(),
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <AuthLayout title="Preparing workspace" subtitle="Checking your organization membership.">
        <p className="text-center text-[13px] text-muted-foreground">Loading...</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your organization"
      subtitle="Set up a workspace. A default General team is created for you automatically."
      footer={
        <span className="text-muted-foreground">
          Already have an invite? Open the invite link from your email after signing in.
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-body">
          Organization name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="clarity-input"
            placeholder="Acme Labs"
            required
            minLength={2}
            maxLength={80}
            autoComplete="organization"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-body">
          Slug
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            className="clarity-input"
            placeholder="acme-labs"
            required
            minLength={2}
            maxLength={48}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            title="Lowercase letters, numbers, and hyphens"
          />
          <span className="text-[11px] font-normal text-muted-light">
            Used in URLs and invites. Auto-filled from the name.
          </span>
        </label>

        {error && <p className="clarity-error">{error}</p>}

        <Button type="submit" variant="primary" size="lg" disabled={submitting || !name.trim()}>
          {submitting ? "Creating..." : "Create organization"}
        </Button>
      </form>
    </AuthLayout>
  );
}

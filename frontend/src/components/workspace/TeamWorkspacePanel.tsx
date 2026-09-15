import { useWorkspace } from "@/components/WorkspaceProvider";
import { InviteCreateForm } from "@/components/workspace/InviteCreateForm";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";

export function TeamWorkspacePanel() {
  const { org, team, teams, selectTeam } = useWorkspace();

  if (!org || !team) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel className="p-5 sm:p-6">
        <SectionHeader title="Active workspace" />
        <dl className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-light">
              Organization
            </dt>
            <dd className="mt-1 font-medium text-card-foreground">
              {org.name}
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                /{org.slug}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-light">
              Team
            </dt>
            <dd className="mt-1 font-medium text-card-foreground">{team.name}</dd>
          </div>
        </dl>

        {teams.length > 1 && (
          <label className="mt-5 flex flex-col gap-1.5 text-[12px] font-medium text-text-body">
            Switch team
            <select
              className="clarity-input"
              value={team.id}
              onChange={(e) => {
                void selectTeam(e.target.value);
              }}
            >
              {teams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </Panel>

      <InviteCreateForm actorRole="owner" />
    </div>
  );
}

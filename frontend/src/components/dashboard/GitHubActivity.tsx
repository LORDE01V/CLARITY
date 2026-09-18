import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useGitHubActivity } from "@/hooks/useGitHubActivity";
import { useGitHubConnect } from "@/hooks/useGitHubConnect";
import type { ActivityItem } from "@/data/dashboard";

interface GitHubActivityProps {
  /** When true, render a denser list for the Code nav view. */
  dense?: boolean;
  limit?: number;
  /** Optional preloaded rows (avoids a second fetch when parent already loaded). */
  items?: ActivityItem[];
  loading?: boolean;
  isDemo?: boolean;
  isBypassMode?: boolean;
  liveCount?: number;
  error?: string | null;
  /** Show Connect GitHub controls in the panel header. */
  showConnect?: boolean;
}

export function GitHubActivity({
  dense = false,
  limit = 8,
  items: itemsProp,
  loading: loadingProp,
  isDemo: isDemoProp,
  isBypassMode: isBypassProp,
  liveCount: liveCountProp,
  error: errorProp,
  showConnect = false,
}: GitHubActivityProps) {
  const hooked = useGitHubActivity(limit, itemsProp === undefined);
  const connect = useGitHubConnect();
  const items = itemsProp ?? hooked.items;
  const loading = loadingProp ?? hooked.loading;
  const isDemo = isDemoProp ?? hooked.isDemo;
  const isBypassMode = isBypassProp ?? hooked.isBypassMode;
  const liveCount = liveCountProp ?? hooked.liveCount;
  const error = errorProp ?? hooked.error;
  const isLive = hooked.isLive;
  const connected = connect.connected;
  const visible = dense ? items : items.slice(0, 5);
  const actionLabel = isDemo
    ? isBypassMode
      ? `Demo feed · live events: ${liveCount}`
      : "Demo feed"
    : isLive
      ? "Live"
      : connected
        ? "Waiting for events"
        : "Not connected";

  const account = connect.status?.account_login;
  const repos = connect.status?.repositories ?? [];
  const repoSummary =
    repos.length === 0
      ? connect.status?.repository_selection === "all"
        ? "all repositories"
        : connect.status?.source === "env"
          ? "env installation"
          : "no repos listed yet"
      : repos.length <= 2
        ? repos.join(", ")
        : `${repos.slice(0, 2).join(", ")} +${repos.length - 2}`;

  return (
    <Panel>
      <div className="border-b border-border-subtle px-5 py-4">
        <SectionHeader title="GitHub activity" action={actionLabel} />
        {showConnect && (
          <div className="mt-3 flex flex-col gap-2">
            {connected ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-primary">
                    Connected
                    {account ? ` · ${account}` : ""}
                  </p>
                  <p className="truncate text-[10px] text-muted-light">
                    {repoSummary}
                    {connect.status?.installation_id
                      ? ` · install ${connect.status.installation_id}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void connect.refresh()}
                  disabled={connect.loading}
                >
                  Refresh
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-text-body">
                    Connect GitHub
                  </p>
                  <p className="text-[10px] text-muted-light">
                    {connect.waitingForInstall
                      ? "Return here after installing the App — status refreshes automatically."
                      : isBypassMode
                        ? "Opens the App install page. Linking to a Clarity user needs a real session."
                        : "Install the Clarity GitHub App on your account or org."}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void connect.connect()}
                  disabled={connect.connecting}
                >
                  {connect.connecting
                    ? "Opening…"
                    : isBypassMode
                      ? "Connect GitHub"
                      : "Connect GitHub"}
                </Button>
              </div>
            )}
            {(connect.error || error) && (
              <p className="text-[10px] text-muted-light">
                {connect.error || error}
              </p>
            )}
          </div>
        )}
        {!showConnect && error && (
          <p className="mt-1 text-[10px] text-muted-light">{error}</p>
        )}
        {loading && (
          <p className="mt-1 text-[10px] text-muted-light">Refreshing…</p>
        )}
      </div>
      <div className="flex flex-col">
        {visible.length === 0 && !loading ? (
          <div className="px-5 py-6">
            <p className="text-[12px] leading-5 text-muted-light">
              {connected
                ? "No webhook events yet. Push a commit, open a PR, or comment on an issue in a connected repo — activity shows up here live. Mention CLR-### in titles to link tasks."
                : "Connect GitHub to stream pushes, PRs, and issues into Clarity for the team."}
            </p>
            {connected && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => void connect.refresh()}
                disabled={connect.loading}
              >
                Refresh
              </Button>
            )}
          </div>
        ) : (
          visible.map(({ icon: Icon, title, desc, time, tone }) => (
            <div
              key={`${title}-${time}-${desc}`}
              className="flex items-center gap-3 border-b border-border-subtle px-5 py-3.5 last:border-b-0"
            >
              <div
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-text-body">
                  {title}
                </p>
                <p className="truncate text-[10px] text-muted-light">{desc}</p>
              </div>
              <span className="text-[10px] text-muted-light">{time}</span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

import { GitHubActivity } from "@/components/dashboard/GitHubActivity";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useGitHubActivity } from "@/hooks/useGitHubActivity";
import { useGitHubConnect } from "@/hooks/useGitHubConnect";

/**
 * Code nav surface — Connect GitHub + live activity when authenticated,
 * demo fixtures when auth bypass is on or the API is empty/unreachable.
 */
export function CodeActivityPanel() {
  const { items, raw, loading, isDemo, isBypassMode, liveCount, error } =
    useGitHubActivity(30);
  const connect = useGitHubConnect();
  const linked = raw.filter((item) => item.task_keys.length > 0).length;
  const account = connect.status?.account_login;
  const repos = connect.status?.repositories ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <div className="px-5 py-4">
          <SectionHeader title="Code" />
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted-light">
            {connect.connected
              ? "Your GitHub App installation is linked. Events appear below as webhooks arrive. Reference CLR-### in PR or issue titles to link work to tasks."
              : isBypassMode && isDemo
                ? "Demo mode shows sample GitHub activity. Connect GitHub to install the App, or keep using the env installation for solo local testing."
                : isDemo
                  ? "Connect GitHub to install the App, then trigger a ping or PR mentioning CLR-###."
                  : "Events arrive from your GitHub App via webhooks. Reference CLR-### in PR or issue titles to link work to tasks."}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {connect.connected ? (
              <>
                <span className="rounded-[var(--radius-sm)] bg-accent px-2.5 py-1 text-[11px] font-semibold text-primary">
                  Connected{account ? ` · ${account}` : ""}
                </span>
                <span className="text-[11px] text-muted-light">
                  {repos.length > 0
                    ? `${repos.length} repo${repos.length === 1 ? "" : "s"}`
                    : connect.status?.source === "env"
                      ? "Using GITHUB_INSTALLATION_ID fallback"
                      : "Repos pending from webhook"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 py-0 text-[11px]"
                  onClick={() => void connect.refresh()}
                >
                  Refresh status
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void connect.connect()}
                  disabled={connect.connecting}
                >
                  {connect.connecting ? "Opening…" : "Connect GitHub"}
                </Button>
                {isBypassMode && (
                  <span className="text-[11px] text-muted-light">
                    Install still opens; team linking needs a real session
                  </span>
                )}
              </>
            )}
          </div>

          {connect.waitingForInstall && !connect.connected && (
            <p className="mt-2 text-[11px] text-muted-light">
              Return here after installing. Status refreshes automatically.
            </p>
          )}
          {connect.error && (
            <p className="mt-2 text-[11px] text-muted-light">{connect.error}</p>
          )}

          {isBypassMode && (
            <p className="mt-2 text-[11px] text-muted-light">
              Demo mode · live events: {liveCount}
            </p>
          )}
          {!isDemo && (
            <p className="mt-2 text-[11px] text-muted-light">
              {raw.length} recent event{raw.length === 1 ? "" : "s"}
              {linked > 0 ? ` · ${linked} linked to tasks` : ""}
            </p>
          )}
        </div>
      </Panel>
      <GitHubActivity
        dense
        limit={30}
        items={items}
        loading={loading}
        isDemo={isDemo}
        isBypassMode={isBypassMode}
        liveCount={liveCount}
        error={error}
      />
    </div>
  );
}

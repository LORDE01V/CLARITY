import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { useWorkspace } from "./WorkspaceProvider";

/**
 * Requires authentication and an active workspace.
 * Users without an org/team are sent to onboarding (skipped in bypass mode).
 */
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const { loading: workspaceLoading, needsOnboarding } = useWorkspace();

  if (loading || (user && workspaceLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-[13px] text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

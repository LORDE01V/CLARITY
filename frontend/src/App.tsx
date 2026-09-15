import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthOnlyRoute } from "@/components/AuthOnlyRoute";
import { AuthProvider } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import { AcceptInvitePage } from "@/pages/AcceptInvitePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { RegisterPage } from "@/pages/RegisterPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <WorkspaceProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/invites/:token" element={<AcceptInvitePage />} />
            <Route element={<AuthOnlyRoute />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<DashboardPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </WorkspaceProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { DataProvider } from "./contexts/DataContext";
import { useAuth } from "./contexts/AuthContext";
import { FullPageLoading } from "./components/States";
import { LoginPage } from "./pages/LoginPage";
import { SetupRequiredPage } from "./pages/SetupRequiredPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SessionsPage } from "./pages/SessionsPage";
import { SessionEditorPage } from "./pages/SessionEditorPage";
import { SessionDetailPage } from "./pages/SessionDetailPage";
import { NextDayPage } from "./pages/NextDayPage";
import { LibrariesPage } from "./pages/LibrariesPage";
import { LibraryEditorPage } from "./pages/LibraryEditorPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export function App() {
  const { user, isLoading, isAllowed, isConfigured } = useAuth();

  if (isLoading) {
    return <FullPageLoading label="ログイン状態を確認しています" />;
  }
  if (!isConfigured) {
    return <SetupRequiredPage />;
  }
  if (!user) {
    return <LoginPage />;
  }
  if (!isAllowed) {
    return <UnauthorizedPage />;
  }

  return (
    <DataProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="sessions/new" element={<SessionEditorPage />} />
          <Route path="sessions/:sessionId" element={<SessionDetailPage />} />
          <Route
            path="sessions/:sessionId/edit"
            element={<SessionEditorPage />}
          />
          <Route
            path="sessions/:sessionId/next-day"
            element={<NextDayPage />}
          />
          <Route path="libraries" element={<LibrariesPage />} />
          <Route path="libraries/new" element={<LibraryEditorPage />} />
          <Route
            path="libraries/:libraryId/edit"
            element={<LibraryEditorPage />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </DataProvider>
  );
}

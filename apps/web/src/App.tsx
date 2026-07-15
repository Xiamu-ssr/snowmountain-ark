import { Navigate, Route, Routes } from "react-router-dom";
import { AuthGate } from "./components/Auth";
import { useAuth } from "./components/Auth";
import { Shell } from "./components/Shell";
import { AgentCreatePage, AgentDetailPage, AgentEditPage, AgentsPage } from "./pages/Agents";
import { DependenciesPage } from "./pages/Dependencies";
import { MarketPage } from "./pages/Market";
import { EnvironmentDetailPage, EnvironmentsPage, MemoryDetailPage, MemoryPage, VaultDetailPage, VaultsPage } from "./pages/Resources";
import { SpecViewerPage } from "./pages/Specs";
import { SessionDetailPage, SessionsPage } from "./pages/Sessions";
import { SettingsPage } from "./pages/Settings";
import type { ReactNode } from "react";

function AdminOnly({ children }: { children: ReactNode }) {
  return useAuth().role === "admin" ? children : <Navigate to="/agents" replace />;
}

export function App() {
  return <AuthGate><Routes>
    <Route path="specs" element={<AdminOnly><SpecViewerPage /></AdminOnly>} />
    <Route element={<Shell />}>
      <Route index element={<Navigate to="/agents" replace />} />
      <Route path="agents" element={<AgentsPage />} />
      <Route path="agents/create" element={<AgentCreatePage />} />
      <Route path="agents/:id" element={<AgentDetailPage />} />
      <Route path="agents/:id/edit" element={<AgentEditPage />} />
      <Route path="sessions" element={<SessionsPage />} />
      <Route path="sessions/:id" element={<SessionDetailPage />} />
      <Route path="environments" element={<EnvironmentsPage />} />
      <Route path="environments/:id" element={<EnvironmentDetailPage />} />
      <Route path="vaults" element={<VaultsPage />} />
      <Route path="vaults/:id" element={<VaultDetailPage />} />
      <Route path="memory" element={<MemoryPage />} />
      <Route path="memory/:id" element={<MemoryDetailPage />} />
      <Route path="market" element={<MarketPage />} />
      <Route path="dependencies" element={<DependenciesPage />} />
      <Route path="admin" element={<AdminOnly><SettingsPage /></AdminOnly>} />
      <Route path="settings" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/agents" replace />} />
    </Route>
  </Routes></AuthGate>;
}

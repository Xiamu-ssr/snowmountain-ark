import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { AgentCreatePage, AgentDetailPage, AgentsPage } from "./pages/Agents";
import { DependenciesPage } from "./pages/Dependencies";
import { MarketPage } from "./pages/Market";
import { EnvironmentsPage, MemoryPage, VaultsPage } from "./pages/Resources";
import { SessionDetailPage, SessionsPage } from "./pages/Sessions";

export function App() {
  return <Routes>
    <Route element={<Shell />}>
      <Route index element={<Navigate to="/agents" replace />} />
      <Route path="agents" element={<AgentsPage />} />
      <Route path="agents/create" element={<AgentCreatePage />} />
      <Route path="agents/:id" element={<AgentDetailPage />} />
      <Route path="sessions" element={<SessionsPage />} />
      <Route path="sessions/:id" element={<SessionDetailPage />} />
      <Route path="environments" element={<EnvironmentsPage />} />
      <Route path="vaults" element={<VaultsPage />} />
      <Route path="memory" element={<MemoryPage />} />
      <Route path="market" element={<MarketPage />} />
      <Route path="dependencies" element={<DependenciesPage />} />
      <Route path="*" element={<Navigate to="/agents" replace />} />
    </Route>
  </Routes>;
}

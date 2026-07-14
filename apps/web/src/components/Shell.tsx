import {
  Bot, BookOpenCheck, Box, Brain, ChevronDown, CircleHelp, Fingerprint, GitFork,
  KeyRound, Layers3, Library, MountainSnow, Search, Settings, Store, Workflow
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const nav = [
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/sessions", label: "Sessions", icon: Workflow },
  { to: "/environments", label: "Environments", icon: Box },
  { to: "/vaults", label: "Credentials Vault", icon: KeyRound },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/sdd", label: "SDD", icon: BookOpenCheck },
  { to: "/market", label: "雪山 Market", icon: Store },
  { to: "/dependencies", label: "Dependencies", icon: GitFork },
  { to: "/settings", label: "系统设置", icon: Settings }
];

export function Shell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><MountainSnow size={22} /></span>
          <span>雪山方舟</span>
          <span className="brand-divider" />
          <button className="product-switch">Managed Agents <ChevronDown size={14} /></button>
        </div>
        <div className="global-search"><Search size={16} /><input aria-label="全局搜索" placeholder="搜索 Agent、Session 或文档" /></div>
        <div className="top-actions">
          <button className="icon-button" aria-label="知识库"><Library size={18} /></button>
          <button className="icon-button" aria-label="帮助"><CircleHelp size={18} /></button>
          <button className="account"><Fingerprint size={17} /><span>本地组织</span><ChevronDown size={14} /></button>
        </div>
      </header>
      <aside className="sidebar">
        <div className="sidebar-title"><Layers3 size={17} /><span>Managed Agents</span></div>
        <nav>
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Icon size={17} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="control-badge"><span className="pulse" /><span>Control plane</span><strong>healthy</strong></div>
          <small>Durable event log · SQLite<br />Sandbox runtime · API control plane</small>
        </div>
      </aside>
      <main className="main-content"><Outlet /></main>
    </div>
  );
}

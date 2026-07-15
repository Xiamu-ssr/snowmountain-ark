import {
  Bot, Box, Brain, ChevronDown, CircleHelp, FileCode2, Fingerprint, GitFork,
  KeyRound, Layers3, MountainSnow, Search, ServerCog, Store, Workflow
} from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "./Auth";

const managedNav = [
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/sessions", label: "Sessions", icon: Workflow },
  { to: "/environments", label: "Environments", icon: Box },
  { to: "/vaults", label: "Credentials Vault", icon: KeyRound },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/market", label: "雪山 Market", icon: Store }
];

export function Shell() {
  const auth = useAuth();
  const nav = auth.role === "admin"
    ? [...managedNav, { to: "/dependencies", label: "Dependencies", icon: GitFork }, { to: "/admin", label: "平台管理", icon: ServerCog }]
    : managedNav;
  const logout = async () => { await api.logout(); window.location.reload(); };
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
          {auth.role === "admin" && <Link className="icon-button" to="/specs" aria-label="规范查看器" title="开发者规范查看器"><FileCode2 size={18} /></Link>}
          <button className="icon-button" aria-label="帮助"><CircleHelp size={18} /></button>
          <button className="account" onClick={() => void logout()} title="退出登录"><Fingerprint size={17} /><span>{auth.role === "admin" ? "平台管理员" : auth.user ?? "用户"}</span><ChevronDown size={14} /></button>
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
          <small>{auth.role === "admin" ? "Platform control · tenants · models" : `Tenant · ${auth.tenantId ?? "default"}`}<br />Durable Session · Sandbox as tool</small>
        </div>
      </aside>
      <main className="main-content"><Outlet /></main>
    </div>
  );
}

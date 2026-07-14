import { AlertTriangle, Check, ChevronRight, LoaderCircle, Search, X } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

export function Toolbar({ search, onSearch, children }: { search: string; onSearch(value: string): void; children?: ReactNode }) {
  return <div className="toolbar"><label className="table-search"><Search size={16} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="搜索名称 / ID" /></label><div className="toolbar-actions">{children}</div></div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span className="empty-symbol">✦</span><strong>{title}</strong><p>{description}</p></div>;
}

export function Status({ value }: { value: string }) {
  const tone = value === "idle" || value === "healthy" ? "success" : value === "running" || value === "waiting_approval" ? "running" : value === "failed" ? "danger" : "neutral";
  return <span className={`status ${tone}`}><span />{value}</span>;
}

export function Modal({ title, open, onClose, children, footer }: { title: string; open: boolean; onClose(): void; children: ReactNode; footer: ReactNode }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-label={title}><header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button></header><div className="modal-body">{children}</div><footer>{footer}</footer></section></div>;
}

export function Drawer({ title, open, onClose, children, footer }: { title: string; open: boolean; onClose(): void; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null;
  return <div className="drawer-backdrop" role="presentation"><aside className="drawer" role="dialog" aria-label={title}><header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button></header><div className="drawer-body">{children}</div>{footer && <footer>{footer}</footer>}</aside></div>;
}

export function ErrorBanner({ error }: { error: string }) {
  return <div className="error-banner"><AlertTriangle size={16} />{error}</div>;
}

export function Loading() {
  return <div className="loading"><LoaderCircle size={22} className="spin" />加载中</div>;
}

export function StepTitle({ number, title, description }: { number: string; title: string; description?: string }) {
  return <div className="step-title"><span>{number}</span><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>;
}

export function SelectCard({ selected, title, description, onClick }: { selected: boolean; title: string; description: string; onClick(): void }) {
  return <button type="button" className={`select-card ${selected ? "selected" : ""}`} onClick={onClick}><span className="select-check">{selected && <Check size={13} />}</span><div><strong>{title}</strong><p>{description}</p></div><ChevronRight size={16} /></button>;
}

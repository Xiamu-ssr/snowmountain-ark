import {
  ArrowLeft, Braces, CheckCircle2, ChevronRight, CircleDot, Code2, FileCode2,
  GitBranch, Link2, Search, ShieldCheck, TestTube2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { SpecBundle, SpecDocument, SpecStatus } from "@snowmountain/contracts";
import { api } from "../api";
import { ErrorBanner, Loading } from "../components/UI";

const statuses: SpecStatus[] = ["planned", "partial", "implemented", "verified", "deprecated"];
const statusLabels: Record<SpecStatus | "all", string> = { all: "全部", planned: "规划中", partial: "部分实现", implemented: "已实现", verified: "已验证", deprecated: "已废弃" };
const kindLabels: Record<SpecDocument["kind"], string> = { "state-machine": "状态机", "capability-policy": "能力策略", component: "组件", "data-lifecycle": "数据生命周期", integration: "集成" };

export function SpecViewerPage() {
  const [bundle, setBundle] = useState<SpecBundle>();
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | SpecStatus>("all");
  const [error, setError] = useState("");
  useEffect(() => { void api.specs().then((value) => { setBundle(value); setSelectedId(value.items[0]?.metadata.id ?? ""); }).catch((reason: Error) => setError(reason.message)); }, []);
  const filtered = useMemo(() => (bundle?.items ?? []).filter((item) => {
    const haystack = `${item.metadata.title} ${item.metadata.id} ${item.metadata.tags.join(" ")} ${item.intent.summary}`.toLowerCase();
    return (status === "all" || item.metadata.status === status) && haystack.includes(search.toLowerCase());
  }), [bundle, search, status]);
  const selected = bundle?.items.find((item) => item.metadata.id === selectedId) ?? filtered[0];
  if (error) return <div className="spec-viewer-error"><ErrorBanner error={error} /><Link to="/agents">返回控制台</Link></div>;
  if (!bundle) return <Loading />;

  return <div className="spec-viewer-shell">
    <header className="spec-viewer-topbar">
      <div><span className="spec-viewer-mark"><FileCode2 size={19} /></span><div><strong>规范查看器</strong><small>{bundle.project.name} · {bundle.format}</small></div></div>
      <Link className="button secondary" to="/agents"><ArrowLeft size={14} />返回托管 Agent 中台</Link>
    </header>
    <main className="spec-viewer-main">
      <section className="spec-viewer-intro">
        <div><span className="eyebrow">意图 → 契约 → 代码 → 证据</span><h1>{bundle.project.name} 高密度规范</h1><p>{bundle.project.description}</p></div>
        <div className="spec-summary-cards"><Metric label="规范" value={bundle.summary.specs} /><Metric label="能力点" value={bundle.summary.features} /><Metric label="已验证" value={bundle.summary.statuses.verified} /><Metric label="部分实现" value={bundle.summary.statuses.partial} /></div>
      </section>
      <section className="spec-runtime-facts">
        {(bundle.runtimeFacts ?? []).map((fact) => <div key={fact.id}><small>{fact.label}</small><strong>{typeof fact.value === "boolean" ? (fact.value ? "是" : "否") : String(fact.value)}</strong><span>{fact.source}</span></div>)}
      </section>
      <div className="spec-viewer-toolbar">
        <label><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索 Spec、意图或标签" /></label>
        <div>{(["all", ...statuses] as const).map((value) => <button key={value} className={status === value ? "active" : ""} onClick={() => setStatus(value)}>{statusLabels[value]}</button>)}</div>
      </div>
      <div className="spec-viewer-workbench">
        <aside className="spec-index">
          <div className="spec-index-title"><strong>可执行契约</strong><span>{filtered.length}/{bundle.items.length}</span></div>
          {filtered.map((item) => <button key={item.metadata.id} className={selected?.metadata.id === item.metadata.id ? "active" : ""} onClick={() => setSelectedId(item.metadata.id)}><span className={`spec-dot ${item.metadata.status}`} /><div><strong>{item.metadata.title}</strong><small>{kindLabels[item.kind]} · {item.metadata.id}</small></div><ChevronRight size={14} /></button>)}
        </aside>
        {selected ? <SpecDetail item={selected} /> : <section className="spec-detail-empty">没有匹配的 Spec</section>}
      </div>
    </main>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function SpecDetail({ item }: { item: SpecDocument }) {
  return <article className="spec-detail">
    <header><div><span className="spec-kind"><Braces size={13} />{kindLabels[item.kind]}</span><h2>{item.metadata.title}</h2><code>{item.metadata.id}</code></div><span className={`spec-status-pill ${item.metadata.status}`}><CircleDot size={12} />{statusLabels[item.metadata.status]}</span></header>
    <section className="spec-intent"><span><FileCode2 size={15} />意图</span><p>{item.intent.summary}</p><div>{item.intent.outcomes.map((outcome) => <em key={outcome}><CheckCircle2 size={13} />{outcome}</em>)}</div></section>
    <Projection item={item} />
    <div className="spec-coverage-grid">
      <section><h3><Code2 size={15} />实现位置</h3>{item.implementation.code.map((path) => <code key={path}>{path}</code>)}{item.implementation.notes.map((note) => <p key={note}>{note}</p>)}</section>
      <section><h3><TestTube2 size={15} />验证证据</h3>{item.verification.tests.map((path) => <code key={path}>{path}</code>)}{item.verification.assertions.map((value) => <p key={value.id}><strong>{value.id}</strong>{value.assertion}</p>)}</section>
      <section><h3><Link2 size={15} />知识与依赖</h3>{item.knowledge.map((path) => <code key={path}>{path}</code>)}{(item.specRefs ?? []).map((ref) => <span key={ref}>{ref}</span>)}</section>
    </div>
    <details className="spec-source"><summary><GitBranch size={14} />YAML 单一事实源 · {item.sourcePath}</summary><pre>{item.source}</pre></details>
  </article>;
}

function Projection({ item }: { item: SpecDocument }) {
  if (item.kind === "state-machine") return <StateMachine contract={item.contract} />;
  if (item.kind === "capability-policy") return <CapabilityPolicy contract={item.contract} />;
  if (item.kind === "component") return <ComponentProjection contract={item.contract} />;
  if (item.kind === "data-lifecycle") return <DataLifecycle contract={item.contract} />;
  return <IntegrationProjection contract={item.contract} />;
}

function StateMachine({ contract }: { contract: Record<string, unknown> }) {
  const states = contract.states as Array<{ id: string; label: string }>;
  const transitions = contract.transitions as Array<{ from: string; event: string; to: string; effect?: string }>;
  return <section className="spec-projection"><h3><GitBranch size={15} />状态投影</h3><div className="state-strip">{states.map((state) => <span key={state.id} className={state.id === contract.initial ? "initial" : ""}><strong>{state.label}</strong><small>{state.id}</small></span>)}</div><div className="transition-table">{transitions.map((item) => <div key={`${item.from}-${item.event}`}><code>{item.from}</code><span>{item.event}</span><ChevronRight size={13} /><code>{item.to}</code><small>{item.effect ?? "-"}</small></div>)}</div></section>;
}

function CapabilityPolicy({ contract }: { contract: Record<string, unknown> }) {
  const subjects = contract.subjects as Array<{ id: string; label: string }>;
  const resources = contract.resources as Array<{ id: string; label: string }>;
  const grants = contract.grants as Array<{ subject: string; resource: string; access: string }>;
  return <section className="spec-projection"><h3><ShieldCheck size={15} />能力矩阵</h3><div className="table-wrap"><table className="capability-matrix"><thead><tr><th>主体</th>{resources.map((resource) => <th key={resource.id}>{resource.label}</th>)}</tr></thead><tbody>{subjects.map((subject) => <tr key={subject.id}><td>{subject.label}</td>{resources.map((resource) => { const access = grants.find((grant) => grant.subject === subject.id && grant.resource === resource.id)?.access ?? "none"; return <td key={resource.id}><code className={access}>{access}</code></td>; })}</tr>)}</tbody></table></div></section>;
}

function ComponentProjection({ contract }: { contract: Record<string, unknown> }) {
  const features = contract.features as Array<{ id: string; label: string; status: SpecStatus; evidence?: string }>;
  const adapters = contract.adapters as Array<{ id: string; label: string }>;
  return <section className="spec-projection"><h3><Code2 size={15} />组件投影</h3><div className="component-meta"><span>角色<strong>{String(contract.role)}</strong></span><span>运行时<strong>{String(contract.runtime)}</strong></span></div>{adapters.length > 0 && <div className="adapter-row">{adapters.map((adapter) => <span key={adapter.id}><strong>{adapter.id}</strong>{adapter.label}</span>)}</div>}<div className="feature-list">{features.map((feature) => <div key={feature.id}><span className={`spec-dot ${feature.status}`} /><strong>{feature.label}</strong><small>{statusLabels[feature.status]}</small><code>{feature.evidence ?? "尚未关联证据"}</code></div>)}</div></section>;
}

function DataLifecycle({ contract }: { contract: Record<string, unknown> }) {
  const writes = contract.writes as Array<{ actor: string; action: string; condition: string }>;
  const reads = contract.reads as Array<{ actor: string; action: string; condition: string }>;
  const extraction = contract.extraction as { mode: string; policy: string };
  return <section className="spec-projection"><h3><GitBranch size={15} />数据生命周期</h3><div className="lifecycle-flow"><span><small>单一事实源</small><strong>{String(contract.sourceOfTruth)}</strong></span><ChevronRight size={15} /><span><small>实体</small><strong>{String(contract.entity)}</strong></span><ChevronRight size={15} /><span><small>抽取</small><strong>{extraction.mode}</strong></span></div><div className="lifecycle-actions">{[...writes, ...reads].map((value) => <div key={`${value.actor}-${value.action}`}><strong>{value.actor}</strong><code>{value.action}</code><span>{value.condition}</span></div>)}</div><p>{extraction.policy}</p></section>;
}

function IntegrationProjection({ contract }: { contract: Record<string, unknown> }) {
  const endpoints = contract.endpoints as Array<{ id: string; purpose: string; visibility: string }>;
  const health = contract.health as { timeoutMs: number; success: string };
  return <section className="spec-projection"><h3><Link2 size={15} />集成投影</h3><div className="component-meta"><span>提供方<strong>{String(contract.provider)}</strong></span><span>单一事实源<strong>{String(contract.sourceOfTruth)}</strong></span><span>超时<strong>{health.timeoutMs} ms</strong></span></div><div className="feature-list">{endpoints.map((endpoint) => <div key={endpoint.id}><span className="spec-dot implemented" /><strong>{endpoint.id}</strong><small>{endpoint.visibility}</small><code>{endpoint.purpose}</code></div>)}</div><p>{health.success}</p></section>;
}

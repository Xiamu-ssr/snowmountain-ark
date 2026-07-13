import { ArrowRight, Bot, Box, Brain, GitFork, KeyRound, MessageSquareText, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Agent, Environment, MemoryStore, Session, Vault } from "@snowmountain/contracts";
import { api } from "../api";
import { ErrorBanner, PageHeader } from "../components/UI";

export function DependenciesPage() {
  const [edges, setEdges] = useState<Array<{ source: string; target: string; relation: string }>>([]);
  const [names, setNames] = useState<Record<string,string>>({});
  const [error, setError] = useState("");
  const load = async () => { try { const [graph, agents, sessions, environments, memories, vaults] = await Promise.all([api.dependencies(), api.list<Agent>("agents"), api.list<Session>("sessions"), api.list<Environment>("environments"), api.list<MemoryStore>("memory-stores"), api.list<Vault>("vaults")]); setEdges(graph.edges); setNames(Object.fromEntries([...agents.items,...sessions.items,...environments.items,...memories.items,...vaults.items].map((item) => [item.id,item.name]))); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  useEffect(() => { void load(); }, []);
  const groups = useMemo(() => Object.entries(edges.reduce<Record<string, Array<{ source: string; target: string; relation: string }>>>((result, edge) => {
    (result[edge.source] ??= []).push(edge);
    return result;
  }, {})), [edges]);
  const label = (id: string) => names[id] ?? id.replace("model:", "Model · ");
  const iconFor = (id: string) => id.startsWith("agent") ? Bot : id.startsWith("sesn") ? MessageSquareText : id.startsWith("env") ? Box : id.startsWith("mem") ? Brain : id.startsWith("vlt") ? KeyRound : GitFork;
  return <div className="page"><PageHeader title="Dependencies" description="把删除保护、运行绑定和能力来源画成控制面事实，而不是依赖人脑记住。" action={<button className="button secondary" onClick={() => void load()}><RefreshCw size={15} />刷新图</button>} />{error && <ErrorBanner error={error} />}<div className="dependency-summary"><div><strong>{Object.keys(names).length}</strong><span>Resources</span></div><div><strong>{edges.length}</strong><span>Edges</span></div><div><strong>{edges.filter((edge) => edge.relation === "delegates-to").length}</strong><span>Delegations</span></div><div><strong>{edges.filter((edge) => edge.relation === "stored-in").length}</strong><span>Secrets</span></div></div><section className="dependency-canvas">{groups.map(([source, sourceEdges]) => { const SourceIcon = iconFor(source); return <article key={source} className="dependency-group"><div className="dependency-source"><span className="resource-icon violet"><SourceIcon size={16} /></span><div><strong>{label(source)}</strong><small>{source}</small></div></div><div className="dependency-targets">{sourceEdges?.map((edge) => { const TargetIcon = iconFor(edge.target); return <div key={`${edge.source}-${edge.target}-${edge.relation}`}><span className="relation"><ArrowRight size={14} />{edge.relation}</span><span className="resource-icon small blue"><TargetIcon size={13} /></span><span><strong>{label(edge.target)}</strong><small>{edge.target}</small></span></div>; })}</div></article>; })}</section></div>;
}

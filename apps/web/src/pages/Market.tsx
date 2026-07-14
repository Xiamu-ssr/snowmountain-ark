import { AlertTriangle, Bot, Boxes, Download, ExternalLink, Filter, PackageCheck, Search, ShieldCheck, Sparkles, Store, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MarketEntry, MarketSource } from "@snowmountain/contracts";
import { api } from "../api";
import { EmptyState, ErrorBanner, PageHeader } from "../components/UI";

const typeIcon = { skill: Sparkles, mcp: Boxes, tool: Wrench, agent: Bot };

export function MarketPage() {
  const [items, setItems] = useState<MarketEntry[]>([]);
  const [sources, setSources] = useState<MarketSource[]>([]);
  const [offline, setOffline] = useState(false);
  const [source, setSource] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | MarketEntry["type"]>("all");
  const [category, setCategory] = useState("all");
  const [registry, setRegistry] = useState("all");
  const [visible, setVisible] = useState(60);
  const [error, setError] = useState("");

  useEffect(() => {
    api.market().then((result) => {
      setItems(result.items);
      setSources(result.sources ?? []);
      setOffline(Boolean(result.offline));
      setSource(result.source ?? "");
      setEndpoint(result.endpoint ?? "");
    }).catch((reason: Error) => setError(reason.message));
  }, []);

  const categories = useMemo(() => [...new Set(items.map((item) => item.category ?? "未分类"))].sort(), [items]);
  const filtered = useMemo(() => items.filter((item) => {
    const haystack = `${item.title} ${item.description} ${item.category ?? ""} ${item.provider ?? ""} ${item.registry ?? ""} ${item.tags.join(" ")}`.toLowerCase();
    return (type === "all" || item.type === type)
      && (category === "all" || (item.category ?? "未分类") === category)
      && (registry === "all" || item.registry === registry)
      && haystack.includes(search.toLowerCase());
  }), [items, search, type, category, registry]);

  useEffect(() => setVisible(60), [search, type, category, registry]);

  return <div className="page">
    <PageHeader title="雪山 Market" description={`连接 Git-first Market 快照；当前加载 ${items.length} 条 Skill、MCP、Tool 与 Agent 元数据。`} action={<a className="button secondary" href={source || "#"} target="_blank" rel="noreferrer"><ExternalLink size={15} />打开 Market</a>} />
    {error && <ErrorBanner error={error} />}
    {offline && <div className="offline-banner"><Store size={18} /><div><strong>Market 实例暂不可达</strong><p>Ark 无法读取 {endpoint || "配置的 catalog endpoint"}；这代表集成故障，不代表 Market 尚未创建。</p></div></div>}
    <div className="market-source-strip">{sources.filter((item) => item.itemCount > 0).map((item) => <button className={registry === item.id ? "active" : ""} onClick={() => setRegistry(registry === item.id ? "all" : item.id)} key={item.id}><strong>{item.itemCount}</strong><span>{item.name}</span></button>)}</div>
    <section className="market-toolbar">
      <label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索能力、分类、标签、发布方" /></label>
      <div className="type-filter"><Filter size={15} />{(["all", "skill", "mcp", "tool", "agent"] as const).map((item) => <button key={item} className={type === item ? "active" : ""} onClick={() => setType(item)}>{item}</button>)}</div>
      <select aria-label="分类" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">全部分类</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
    </section>
    {filtered.length ? <>
      <p className="market-result-count">显示 {Math.min(visible, filtered.length)} / {filtered.length} 条；Registry 收录不代表雪山安全背书。</p>
      <div className="market-grid">{filtered.slice(0, visible).map((item) => { const Icon = typeIcon[item.type]; return <article className="market-card" key={item.id}>
        <header><span className={`resource-icon ${item.type === "skill" ? "aqua" : item.type === "mcp" ? "blue" : item.type === "agent" ? "violet" : "green"}`}><Icon size={17} /></span><span className="market-type">{item.type}</span><span className="version-pill">{item.version}</span></header>
        <small className="market-origin">{item.category ?? "未分类"} · {item.provider ?? item.registry ?? "unknown"}</small>
        <h3>{item.title}</h3><p>{item.description}</p>
        <div className="tag-row">{item.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>
        <div className="permission-list"><ShieldCheck size={15} /><span>{item.verification ?? "unreviewed"}</span>{(item.risk?.length ?? 0) > 0 && <small><AlertTriangle size={12} />{item.risk?.length} risks</small>}</div>
        <footer><span><PackageCheck size={14} />{item.runtime}</span><a href={item.downloadUrl} target="_blank" rel="noreferrer"><Download size={15} />详情</a></footer>
      </article>; })}</div>
      {visible < filtered.length && <button className="button secondary market-more" onClick={() => setVisible((value) => value + 60)}>继续显示 · 尚有 {filtered.length - visible} 条</button>}
    </> : <EmptyState title="没有匹配能力" description={offline ? "Market 恢复连接后会显示 Git catalog。" : "调整搜索、类型、分类或来源筛选。"} />}
  </div>;
}

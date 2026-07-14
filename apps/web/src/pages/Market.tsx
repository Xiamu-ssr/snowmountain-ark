import { Bot, Boxes, Download, ExternalLink, Filter, PackageCheck, Search, ShieldCheck, Sparkles, Store, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MarketEntry } from "@snowmountain/contracts";
import { api } from "../api";
import { EmptyState, ErrorBanner, PageHeader } from "../components/UI";

const typeIcon = { skill: Sparkles, mcp: Boxes, tool: Wrench, agent: Bot };

export function MarketPage() {
  const [items, setItems] = useState<MarketEntry[]>([]);
  const [offline, setOffline] = useState(false);
  const [source, setSource] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | MarketEntry["type"]>("all");
  const [error, setError] = useState("");
  useEffect(() => { api.market().then((result) => { setItems(result.items); setOffline(Boolean(result.offline)); setSource(result.source ?? ""); setEndpoint(result.endpoint ?? ""); }).catch((reason: Error) => setError(reason.message)); }, []);
  const filtered = useMemo(() => items.filter((item) => (type === "all" || item.type === type) && `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase().includes(search.toLowerCase())), [items, search, type]);

  return <div className="page"><PageHeader title="雪山 Market" description="连接独立部署的 Git-first Market 实例，发现 Skill、MCP、Tool 与 Agent。" action={<a className="button secondary" href={source || "#"} target="_blank" rel="noreferrer"><ExternalLink size={15} />打开 Market</a>} />{error && <ErrorBanner error={error} />}{offline && <div className="offline-banner"><Store size={18} /><div><strong>Market 实例暂不可达</strong><p>Ark 无法读取 {endpoint || "配置的 catalog endpoint"}；这代表集成故障，不代表 Market 尚未创建。</p></div></div>}<section className="market-toolbar"><label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索能力、标签或运行时" /></label><div className="type-filter"><Filter size={15} />{(["all","skill","mcp","tool","agent"] as const).map((item) => <button key={item} className={type === item ? "active" : ""} onClick={() => setType(item)}>{item}</button>)}</div></section>{filtered.length ? <div className="market-grid">{filtered.map((item) => { const Icon = typeIcon[item.type]; return <article className="market-card" key={item.id}><header><span className={`resource-icon ${item.type === "skill" ? "aqua" : item.type === "mcp" ? "blue" : item.type === "agent" ? "violet" : "green"}`}><Icon size={17} /></span><span className="market-type">{item.type}</span><span className="version-pill">{item.version}</span></header><h3>{item.title}</h3><p>{item.description}</p><div className="tag-row">{item.tags.slice(0,4).map((tag) => <span key={tag}>{tag}</span>)}</div><div className="permission-list"><ShieldCheck size={15} /><span>{item.permissions.join(" · ") || "无需额外权限"}</span></div><footer><span><PackageCheck size={14} />{item.runtime}</span><a href={item.downloadUrl} target="_blank" rel="noreferrer"><Download size={15} />详情</a></footer></article>; })}</div> : <EmptyState title="没有匹配能力" description={offline ? "Market 恢复连接后会显示 Git catalog。" : "调整搜索和类型筛选。"} />}</div>;
}

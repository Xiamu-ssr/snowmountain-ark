import { BookOpenCheck, CheckCircle2, CircleDot, FileCode2, GitBranch, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { ErrorBanner, PageHeader } from "../components/UI";

interface SpecItem { id: string; title: string; type: string; status: string; path: string }

export function SddPage() {
  const [items, setItems] = useState<SpecItem[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { void api.specs().then((result) => setItems(result.items as unknown as SpecItem[])).catch((reason: Error) => setError(reason.message)); }, []);
  return <div className="page">
    <PageHeader title="SDD 对齐面" description="OKF 保存叙事知识，DSL/契约定义可验证边界；运行态事实仍来自数据库、事件流和监控。" />
    {error && <ErrorBanner error={error} />}
    <section className="sdd-principle panel"><BookOpenCheck size={24} /><div><strong>Spec 是对齐介质，不是雪山方舟的运行时数据库</strong><p>程序实现、事件回放与验收结果引用这些文档；文档不能替代控制面、Sandbox、Harness、Vault 或 Session 状态机。</p></div></section>
    <div className="sdd-flow">
      <div><FileCode2 size={18} /><strong>Intent / OKF</strong><span>背景、决策、解释</span></div><GitBranch size={18} /><div><ShieldCheck size={18} /><strong>Contract / DSL</strong><span>类型、状态、权限</span></div><GitBranch size={18} /><div><CheckCircle2 size={18} /><strong>Runtime evidence</strong><span>事件、测试、监控</span></div>
    </div>
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>规格</th><th>类型</th><th>状态</th><th>OKF 路径</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><span className="resource-link"><span className="resource-icon violet"><BookOpenCheck size={16} /></span><span><strong>{item.title}</strong><small>{item.id}</small></span></span></td><td><span className="model-pill">{item.type}</span></td><td><span className={`spec-status ${item.status}`}><CircleDot size={13} />{item.status}</span></td><td><code>{item.path}</code></td></tr>)}</tbody></table></div></section>
  </div>;
}

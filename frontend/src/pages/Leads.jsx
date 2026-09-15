import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Phone, RefreshCw, Trash2, MessageCircle, CheckCircle2, X, TrendingUp, Target, Send } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";

const STATUS = [
  { v: "novo",         label: "Novo",         color: "bg-sky-100 text-sky-700 border-sky-200" },
  { v: "em_contato",   label: "Em contato",   color: "bg-amber-100 text-amber-700 border-amber-200" },
  { v: "convertido",   label: "Convertido",   color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { v: "perdido",      label: "Perdido",      color: "bg-slate-100 text-slate-500 border-slate-200" },
];

const ORIGEM_COLORS = {
  "Google":"#4285f4", "Instagram":"#e1306c", "Facebook":"#1877f2",
  "LinkedIn":"#0a66c2", "YouTube":"#ff0000", "TikTok":"#010101",
  "Indicação":"#059669", "E-mail marketing":"#f59e0b", "Anúncio pago":"#7c3aed",
  "Direto":"#64748b", "Outro":"#94a3b8"
};
const originColor = (o) => ORIGEM_COLORS[o] || "#64748b";

export default function Leads() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("todos");
  const [origemFilter, setOrigemFilter] = useState("todas");
  const [goal, setGoal] = useState(5);
  const [goalDraft, setGoalDraft] = useState("5");
  const [savingGoal, setSavingGoal] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const [l, s, g] = await Promise.all([
        api.get("/leads"),
        api.get("/leads/stats"),
        api.get("/settings/weekly-goal"),
      ]);
      setItems(l.data); setStats(s.data);
      setGoal(g.data.value); setGoalDraft(String(g.data.value));
    } catch { toast.error("Erro ao carregar leads"); }
  };
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);

  const saveGoal = async () => {
    const v = parseInt(goalDraft, 10);
    if (isNaN(v) || v < 0) { toast.error("Meta inválida"); return; }
    setSavingGoal(true);
    try {
      const { data } = await api.put("/settings/weekly-goal", { value: v });
      setGoal(data.value);
      toast.success(`Meta semanal definida: ${data.value} convertido(s)`);
    } catch { toast.error("Erro ao salvar meta"); }
    finally { setSavingGoal(false); }
  };

  const sendTestRanking = async () => {
    setSending(true);
    try {
      const { data } = await api.post("/leads/send-test-ranking");
      if (data.ok) toast.success("Mensagem enviada pro seu WhatsApp!");
      else toast.warning(data.reason || "CallMeBot não configurado");
    } catch { toast.error("Erro ao enviar"); }
    finally { setSending(false); }
  };

  const setStatus = async (id, status) => {
    try { await api.patch(`/leads/${id}`, { status }); toast.success("Status atualizado"); load(); }
    catch { toast.error("Erro"); }
  };
  const remove = async (id) => {
    if (!window.confirm("Excluir lead?")) return;
    try { await api.delete(`/leads/${id}`); toast.success("Excluído"); load(); }
    catch { toast.error("Erro"); }
  };

  const fmt = (iso) => { try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso; } };

  const origens = useMemo(() => Array.from(new Set(items.map(l => l.origem || "Direto"))), [items]);

  const filtered = items.filter(l =>
    (filter === "todos" || l.status === filter) &&
    (origemFilter === "todas" || (l.origem || "Direto") === origemFilter)
  );

  const counts = STATUS.reduce((acc, s) => ({ ...acc, [s.v]: items.filter(l => l.status === s.v).length }), {});
  const chartData = (stats?.por_origem || []).map(o => ({ name: o.origem, total: o.total, convertido: o.convertido, taxa: o.taxa_conversao }));

  // Weekly (last 7 days) conversions for goal tracking
  const weekAgo = Date.now() - 7*24*3600*1000;
  const weekLeads = items.filter(l => { try { return new Date(l.created_at).getTime() >= weekAgo; } catch { return false; } });
  const weekConverted = weekLeads.filter(l => l.status === "convertido").length;
  const goalHit = weekConverted >= goal;
  const pct = goal > 0 ? Math.min(100, Math.round((weekConverted / goal) * 100)) : 100;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-600 font-bold">Comercial</div>
          <h1 className="text-3xl font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>Leads capturados</h1>
          <p className="text-slate-600 mt-1">Contatos vindos da landing, com origem e taxa de conversão por canal.</p>
        </div>
        <div className="flex gap-2">
          <Button data-testid="send-test-ranking-btn" onClick={sendTestRanking} disabled={sending} variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
            <Send className="w-4 h-4 mr-2"/> {sending ? "Enviando…" : "Enviar teste WhatsApp"}
          </Button>
          <Button data-testid="refresh-leads-btn" onClick={load} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2"/> Atualizar
          </Button>
        </div>
      </div>

      {/* Meta semanal */}
      <div className={`rounded-2xl border p-6 ${goalHit ? "border-emerald-300 bg-emerald-50" : "border-amber-200 bg-amber-50/40"}`} data-testid="meta-semanal-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl grid place-items-center text-2xl ${goalHit ? "bg-emerald-600" : "bg-amber-500"}`}>
              <span>{goalHit ? "🎯" : "🚧"}</span>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest font-bold text-slate-600">Meta semanal · últimos 7 dias</div>
              <div className="mt-1 text-3xl font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>
                {weekConverted} <span className="text-slate-400 text-2xl">/ {goal} convertidos</span>
              </div>
              <div className="text-sm text-slate-600 mt-1">
                {goalHit
                  ? `Bateu a meta em +${weekConverted-goal}! 🚀 Continue nesse ritmo.`
                  : `Faltam ${Math.max(0, goal - weekConverted)} conversões para bater a meta.`}
              </div>
              <div className="mt-3 h-2 w-full max-w-md bg-white rounded-full overflow-hidden border border-slate-200">
                <div className={`h-full transition-all ${goalHit ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }}/>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <Label htmlFor="goal-input" className="text-xs">Definir meta</Label>
              <Input data-testid="meta-input" id="goal-input" type="number" min={0} max={1000}
                value={goalDraft} onChange={e=>setGoalDraft(e.target.value)}
                className="mt-1 w-28"/>
            </div>
            <Button data-testid="save-meta-btn" onClick={saveGoal} disabled={savingGoal}
              className="bg-emerald-600 hover:bg-emerald-700">
              <Target className="w-4 h-4 mr-2"/> Salvar
            </Button>
          </div>
        </div>
      </div>

      {/* KPI status cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUS.map(s => (
          <button key={s.v} onClick={()=>setFilter(filter===s.v?"todos":s.v)} className={`rounded-xl p-4 text-left border transition ${filter===s.v?"ring-2 ring-emerald-500 border-emerald-300":"border-slate-200 bg-white hover:border-emerald-300"}`}>
            <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">{s.label}</div>
            <div className="text-3xl font-extrabold text-slate-900 mt-1" style={{fontFamily:'Outfit'}}>{counts[s.v] || 0}</div>
          </button>
        ))}
      </div>

      {/* Origem breakdown */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900" style={{fontFamily:'Outfit'}}>Leads por canal de origem</h2>
              <p className="text-sm text-slate-500">Onde seus clientes te acharam</p>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold">total {stats?.total || 0}</span>
          </div>
          <div className="h-64" data-testid="chart-origem">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12}/>
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false}/>
                <Tooltip contentStyle={{ background:"white", border:"1px solid #e2e8f0", borderRadius:12 }}/>
                <Bar dataKey="total" name="Total" radius={[6,6,0,0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={originColor(d.name)}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900" style={{fontFamily:'Outfit'}}>Taxa de conversão</h2>
          <p className="text-sm text-slate-500">Canais que mais convertem</p>
          <div className="mt-4 space-y-3" data-testid="taxa-conversao-list">
            {(stats?.por_origem || []).slice(0, 8).map(o => (
              <div key={o.origem} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: originColor(o.origem) }}/>
                  <span className="font-medium text-slate-800">{o.origem}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-xs">{o.convertido}/{o.total}</span>
                  <span className={`font-bold ${o.taxa_conversao >= 20 ? "text-emerald-600" : o.taxa_conversao >= 10 ? "text-amber-600" : "text-slate-500"}`}>
                    {o.taxa_conversao}%
                  </span>
                </div>
              </div>
            ))}
            {(!stats || stats.por_origem.length === 0) && (
              <div className="text-sm text-slate-400 py-6 text-center">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 opacity-40"/>Nenhum lead capturado ainda.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={filter==="todos"?"default":"outline"} onClick={()=>setFilter("todos")}
          className={filter==="todos"?"bg-emerald-600 hover:bg-emerald-700":""}>
          Todos ({items.length})
        </Button>
        <div className="h-6 w-px bg-slate-200 mx-1"/>
        <Button size="sm" variant={origemFilter==="todas"?"default":"outline"} onClick={()=>setOrigemFilter("todas")}
          className={origemFilter==="todas"?"bg-slate-800 hover:bg-slate-900":""}>
          Todas as origens
        </Button>
        {origens.map(o => (
          <Button key={o} size="sm" variant={origemFilter===o?"default":"outline"} onClick={()=>setOrigemFilter(o)}
            data-testid={`filter-origem-${o}`}
            style={origemFilter===o ? { background: originColor(o), color: 'white' } : { borderColor: originColor(o), color: originColor(o) }}>
            {o}
          </Button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left p-4">Recebido</th>
                <th className="text-left p-4">Lead</th>
                <th className="text-left p-4">WhatsApp</th>
                <th className="text-left p-4">Estabelecimento</th>
                <th className="text-left p-4">Origem</th>
                <th className="text-left p-4">Envio</th>
                <th className="text-left p-4">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody data-testid="leads-table-body">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-10 text-center text-slate-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40"/>
                  Nenhum lead {filter!=="todos" || origemFilter!=="todas" ? "com esses filtros" : "capturado ainda"}.
                </td></tr>
              )}
              {filtered.map(l => {
                const st = STATUS.find(s => s.v === l.status) || STATUS[0];
                const waMe = `https://wa.me/${l.whatsapp.replace(/\D/g,"")}`;
                const origem = l.origem || "Direto";
                return (
                  <tr key={l.id} className="border-b border-slate-50 hover:bg-emerald-50/30">
                    <td className="p-4 text-slate-500 text-xs">{fmt(l.created_at)}</td>
                    <td className="p-4">
                      <div className="font-semibold text-slate-900">{l.name}</div>
                      {l.email && <div className="text-xs text-slate-500">{l.email}</div>}
                      {l.mensagem && <div className="text-xs text-slate-400 italic mt-1">"{l.mensagem}"</div>}
                    </td>
                    <td className="p-4">
                      <a href={waMe} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline font-mono text-xs inline-flex items-center gap-1">
                        <Phone className="w-3 h-3"/>{l.whatsapp}
                      </a>
                    </td>
                    <td className="p-4 text-slate-700">
                      {l.estabelecimento || "—"}
                      {l.tipo && <div className="text-xs text-slate-500">{l.tipo}</div>}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border" style={{ borderColor: originColor(origem), color: originColor(origem), background: originColor(origem)+"15" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: originColor(origem) }}/>
                        {origem}
                      </span>
                      {(l.utm_source || l.utm_campaign) && (
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          {l.utm_source && `src:${l.utm_source}`}{l.utm_campaign && ` · ${l.utm_campaign}`}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-xs">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                        l.whatsapp_welcome_status === "sent" ? "bg-emerald-100 text-emerald-700" :
                        l.whatsapp_welcome_status === "skipped" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-500"
                      }`}>
                        {l.whatsapp_welcome_status === "sent" ? "✓ WhatsApp enviado" :
                         l.whatsapp_welcome_status === "skipped" ? "aguardando config" : "na fila"}
                      </span>
                      {l.admin_notified && <div className="mt-1 text-emerald-700">✓ admin avisado</div>}
                    </td>
                    <td className="p-4">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button data-testid={`lead-contato-${l.id}`} variant="ghost" size="sm" onClick={()=>setStatus(l.id,"em_contato")} title="Marcar em contato" className="text-amber-600"><MessageCircle className="w-4 h-4"/></Button>
                        <Button data-testid={`lead-convertido-${l.id}`} variant="ghost" size="sm" onClick={()=>setStatus(l.id,"convertido")} title="Convertido" className="text-emerald-600"><CheckCircle2 className="w-4 h-4"/></Button>
                        <Button data-testid={`lead-perdido-${l.id}`} variant="ghost" size="sm" onClick={()=>setStatus(l.id,"perdido")} title="Perdido"><X className="w-4 h-4"/></Button>
                        <Button data-testid={`lead-delete-${l.id}`} variant="ghost" size="sm" onClick={()=>remove(l.id)} className="text-rose-600"><Trash2 className="w-4 h-4"/></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

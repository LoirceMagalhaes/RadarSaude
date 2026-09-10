import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AlertTriangle, TrendingUp, CheckCircle2, Clock, RefreshCw, Building2, FileCheck2, CalendarRange, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Bar, BarChart,
} from "recharts";

const KPI = ({ label, value, sub, icon: Icon, color, testid }) => (
  <div data-testid={testid} className={`rounded-2xl border p-6 bg-white transition-all hover:shadow-md ${color.border}`}>
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs uppercase tracking-widest font-bold text-slate-500">{label}</div>
        <div className={`mt-2 text-4xl font-extrabold ${color.text}`} style={{fontFamily:'Outfit'}}>{value}</div>
        <div className="mt-1 text-xs text-slate-500">{sub}</div>
      </div>
      <div className={`w-10 h-10 rounded-xl grid place-items-center ${color.bg}`}>
        <Icon className={`w-5 h-5 ${color.text}`} />
      </div>
    </div>
  </div>
);

const statusColor = {
  vencido: "bg-rose-100 text-rose-700 border-rose-200",
  critico_30d: "bg-amber-100 text-amber-700 border-amber-200",
  atencao_90d: "bg-sky-100 text-sky-700 border-sky-200",
  vigente: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
const statusLabel = {
  vencido: "Vencido", critico_30d: "≤ 30 dias", atencao_90d: "31–90 dias", vigente: "Vigente"
};

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/dashboard/summary");
      setData(data);
    } catch (e) {
      toast.error("Erro ao carregar painel");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const seed = async () => {
    try {
      await api.post("/dev/seed");
      toast.success("Dados de exemplo carregados");
      load();
    } catch (e) { toast.error("Não foi possível carregar exemplos"); }
  };

  const kpi = data?.kpi || { vencidos:0, criticos:0, atencao:0, vigentes:0 };

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-600 font-bold">Painel</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>
            Olá, {user?.name?.split(" ")[0] || "bem-vindo(a)"} 👋
          </h1>
          <p className="text-slate-600 mt-1">Visão geral da compliance sanitária dos seus estabelecimentos.</p>
        </div>
        <div className="flex gap-2">
          {user?.role === 'admin' && (
            <Button data-testid="seed-demo-btn" variant="outline" onClick={seed}>
              <Sparkles className="w-4 h-4 mr-2" /> Carregar dados de exemplo
            </Button>
          )}
          <Button data-testid="refresh-dashboard-btn" onClick={load} className="bg-emerald-600 hover:bg-emerald-700">
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI testid="kpi-vencidos" label="Vencidos" value={kpi.vencidos} sub="renovação imediata" icon={AlertTriangle} color={{bg:"bg-rose-50",text:"text-rose-600",border:"border-rose-200"}} />
        <KPI testid="kpi-criticos" label="≤ 30 dias" value={kpi.criticos} sub="prioridade alta" icon={Clock} color={{bg:"bg-amber-50",text:"text-amber-600",border:"border-amber-200"}} />
        <KPI testid="kpi-atencao" label="31–90 dias" value={kpi.atencao} sub="planejar renovação" icon={TrendingUp} color={{bg:"bg-sky-50",text:"text-sky-600",border:"border-sky-200"}} />
        <KPI testid="kpi-vigentes" label="Vigentes" value={kpi.vigentes} sub="mais de 90 dias" icon={CheckCircle2} color={{bg:"bg-emerald-50",text:"text-emerald-600",border:"border-emerald-200"}} />
      </div>

      {/* Chart 12 meses */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900" style={{fontFamily:'Outfit'}}>Tendência dos últimos 12 meses</h2>
              <p className="text-sm text-slate-500">Vencimentos x renovações por mês</p>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold">últimos 12m</span>
          </div>
          <div className="h-72" data-testid="chart-12-months">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.history || []}>
                <defs>
                  <linearGradient id="gradEmerald" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background:"white", border:"1px solid #e2e8f0", borderRadius:12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="vencimentos" name="Vencimentos" stroke="#f59e0b" strokeWidth={2} fill="url(#gradAmber)" />
                <Area type="monotone" dataKey="renovacoes" name="Renovações" stroke="#10b981" strokeWidth={2} fill="url(#gradEmerald)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Checklist da semana */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900" style={{fontFamily:'Outfit'}}>Esta semana</h2>
          <p className="text-sm text-slate-500">O que precisa de ação até 7 dias</p>
          <div className="mt-4 space-y-3 max-h-72 overflow-auto pr-2" data-testid="weekly-checklist">
            {(data?.checklist || []).length === 0 && <div className="text-sm text-slate-400 py-8 text-center">Nada urgente esta semana 🎉</div>}
            {(data?.checklist || []).map((c) => (
              <div key={c.id} className="p-3 rounded-lg border border-slate-200 hover:border-emerald-300 bg-slate-50">
                <div className="text-sm font-semibold text-slate-900">{c.titulo}</div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Validade: {c.validade}</span>
                  <span className={`font-bold ${c.dias < 0 ? "text-rose-600" : c.dias <= 3 ? "text-amber-600" : "text-slate-700"}`}>
                    {c.dias < 0 ? `${Math.abs(c.dias)}d vencido` : `${c.dias}d`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alertas prioritários */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900" style={{fontFamily:'Outfit'}}>Alertas prioritários</h2>
            <p className="text-sm text-slate-500">Vencidos e a vencer em até 30 dias</p>
          </div>
          <span className="pulse-dot" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left p-4 font-semibold">Estabelecimento</th>
                <th className="text-left p-4 font-semibold">Documento</th>
                <th className="text-left p-4 font-semibold">Nº</th>
                <th className="text-left p-4 font-semibold">Validade</th>
                <th className="text-left p-4 font-semibold">Dias</th>
                <th className="text-left p-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody data-testid="alerts-table">
              {(data?.alertas || []).length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum alerta prioritário no momento.</td></tr>
              )}
              {(data?.alertas || []).map((a) => (
                <tr key={a.id} className="border-b border-slate-50 hover:bg-emerald-50/30">
                  <td className="p-4 font-medium text-slate-900">{a.estabelecimento_nome}</td>
                  <td className="p-4 text-slate-700">{a.tipo}</td>
                  <td className="p-4 text-slate-500 font-mono text-xs">{a.numero}</td>
                  <td className="p-4 text-slate-700">{a.validade}</td>
                  <td className="p-4 font-bold">{a.dias_para_vencer}</td>
                  <td className="p-4">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${statusColor[a.status]}`}>
                      {statusLabel[a.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white border border-slate-200 p-5 flex items-center gap-3">
          <Building2 className="w-6 h-6 text-emerald-600" />
          <div><div className="text-xs text-slate-500">Estabelecimentos</div><div className="text-xl font-bold" data-testid="total-estab">{data?.totais?.estabelecimentos || 0}</div></div>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-5 flex items-center gap-3">
          <FileCheck2 className="w-6 h-6 text-emerald-600" />
          <div><div className="text-xs text-slate-500">Documentos</div><div className="text-xl font-bold" data-testid="total-docs">{data?.totais?.documentos || 0}</div></div>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-5 flex items-center gap-3">
          <CalendarRange className="w-6 h-6 text-emerald-600" />
          <div><div className="text-xs text-slate-500">Visitas</div><div className="text-xl font-bold" data-testid="total-visitas">{data?.totais?.visitas || 0}</div></div>
        </div>
      </div>
    </div>
  );
}

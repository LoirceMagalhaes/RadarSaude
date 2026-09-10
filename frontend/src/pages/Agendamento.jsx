import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CalendarRange, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

const TIPOS = ["Coleta de Resíduos Infectantes","Coleta de Perfurocortantes","Coleta de Resíduos Químicos","Inspeção Sanitária","Visita Consultiva","Auditoria Interna"];
const STATUS = [
  { v: "agendada", label: "Agendada", color: "bg-sky-100 text-sky-700 border-sky-200" },
  { v: "concluida", label: "Concluída", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { v: "cancelada", label: "Cancelada", color: "bg-slate-100 text-slate-500 border-slate-200" },
];

const emptyForm = { estabelecimento_id:"", data:"", tipo:TIPOS[0], responsavel:"", observacoes:"", status:"agendada" };

export default function Agendamento() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [estabs, setEstabs] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      const [v,e] = await Promise.all([api.get("/visitas"), api.get("/estabelecimentos")]);
      setItems(v.data); setEstabs(e.data);
    } catch { toast.error("Erro ao carregar"); }
  };
  useEffect(()=>{ load(); },[]);

  const openNew = () => {
    setForm({ ...emptyForm, estabelecimento_id: user?.role !== "admin" ? user?.estabelecimento_id : estabs[0]?.id || "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.estabelecimento_id || !form.data) { toast.error("Preencha estabelecimento e data"); return; }
    try {
      await api.post("/visitas", form);
      toast.success("Visita agendada");
      setOpen(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
  };

  const setStatus = async (v, status) => {
    try {
      await api.put(`/visitas/${v.id}`, {
        estabelecimento_id: v.estabelecimento_id, data: v.data, tipo: v.tipo,
        responsavel: v.responsavel || "", observacoes: v.observacoes || "", status
      });
      toast.success("Status atualizado"); load();
    } catch { toast.error("Erro"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir visita?")) return;
    try { await api.delete(`/visitas/${id}`); toast.success("Excluído"); load(); } catch { toast.error("Erro"); }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-600 font-bold">Rotas & inspeções</div>
          <h1 className="text-3xl font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>Agendamento</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-visita-btn" onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" /> Nova visita
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Agendar visita</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              {user?.role === "admin" && (
                <div>
                  <Label>Estabelecimento</Label>
                  <Select value={form.estabelecimento_id} onValueChange={v=>setForm({...form,estabelecimento_id:v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                    <SelectContent>{estabs.map(e=><SelectItem key={e.id} value={e.id}>{e.nome_fantasia}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div><Label>Data</Label><Input data-testid="visita-data-input" type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v=>setForm({...form,tipo:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{TIPOS.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Responsável</Label><Input value={form.responsavel} onChange={e=>setForm({...form,responsavel:e.target.value})}/></div>
              <div><Label>Observações</Label><Input value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})}/></div>
            </div>
            <DialogFooter>
              <Button data-testid="visita-save-btn" onClick={save} className="bg-emerald-600 hover:bg-emerald-700">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">A periodicidade sugerida segue o tipo de estabelecimento — hospitais toda semana, clínicas odontológicas e veterinárias a cada 15 dias, centros de estética a cada 30 dias.</p>
      </div>

      <div className="grid gap-3" data-testid="visitas-list">
        {items.length === 0 && (
          <div className="p-10 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <CalendarRange className="w-8 h-8 mx-auto mb-2 opacity-40"/>Nenhuma visita agendada ainda.
          </div>
        )}
        {items.map(v => {
          const st = STATUS.find(s => s.v === v.status) || STATUS[0];
          return (
            <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-widest text-emerald-600 font-bold">{v.data}</div>
                <div className="text-lg font-bold text-slate-900" style={{fontFamily:'Outfit'}}>{v.estabelecimento_nome}</div>
                <div className="text-sm text-slate-600">{v.tipo} • {v.responsavel || "sem responsável"}</div>
                {v.observacoes && <div className="text-xs text-slate-400 mt-1">{v.observacoes}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${st.color}`}>{st.label}</span>
                {v.status === "agendada" && <>
                  <Button data-testid={`visita-concluir-${v.id}`} variant="outline" size="sm" onClick={()=>setStatus(v,"concluida")}><Check className="w-4 h-4 mr-1"/> Concluir</Button>
                  <Button data-testid={`visita-cancelar-${v.id}`} variant="outline" size="sm" onClick={()=>setStatus(v,"cancelada")}><X className="w-4 h-4 mr-1"/> Cancelar</Button>
                </>}
                <Button data-testid={`visita-delete-${v.id}`} variant="ghost" size="sm" onClick={()=>remove(v.id)} className="text-rose-600"><Trash2 className="w-4 h-4"/></Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

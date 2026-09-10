import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, RefreshCw, FileCheck2 } from "lucide-react";
import { toast } from "sonner";

const TIPOS_DOC = [
  "Alvará Sanitário",
  "Autorização de Funcionamento AFE",
  "Plano de Gerenciamento RSS (PGRSS)",
  "Manifesto de Transporte de Resíduos (MTR)",
  "Contrato de Coleta e Destinação RSS",
  "Licença Ambiental de Operação",
  "Certificado de Vistoria do Corpo de Bombeiros",
];

const statusColor = {
  vencido: "bg-rose-100 text-rose-700 border-rose-200",
  critico_30d: "bg-amber-100 text-amber-700 border-amber-200",
  atencao_90d: "bg-sky-100 text-sky-700 border-sky-200",
  vigente: "bg-emerald-100 text-emerald-700 border-emerald-200",
};
const statusLabel = { vencido:"Vencido", critico_30d:"≤ 30 dias", atencao_90d:"31–90 dias", vigente:"Vigente" };

const emptyForm = { estabelecimento_id:"", tipo:TIPOS_DOC[0], numero:"", emissao:"", validade:"", observacoes:"" };

export default function Documentos() {
  const { user } = useAuth();
  const [docs, setDocs] = useState([]);
  const [estabs, setEstabs] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterEstab, setFilterEstab] = useState("todos");

  const load = async () => {
    try {
      const [d, e] = await Promise.all([api.get("/documentos"), api.get("/estabelecimentos")]);
      setDocs(d.data); setEstabs(e.data);
    } catch { toast.error("Erro ao carregar"); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return docs.filter(d => (filterStatus==="todos" || d.status===filterStatus) && (filterEstab==="todos" || d.estabelecimento_id===filterEstab));
  }, [docs, filterStatus, filterEstab]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, estabelecimento_id: user?.role !== "admin" ? user?.estabelecimento_id : estabs[0]?.id || "" });
    setOpen(true);
  };
  const openEdit = (d) => { setEditing(d); setForm({ ...emptyForm, ...d }); setOpen(true); };

  const save = async () => {
    if (!form.estabelecimento_id || !form.tipo || !form.validade) { toast.error("Preencha os campos obrigatórios"); return; }
    try {
      if (editing) await api.put(`/documentos/${editing.id}`, form);
      else await api.post("/documentos", form);
      toast.success(editing ? "Atualizado" : "Cadastrado");
      setOpen(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
  };

  const renovar = async (id) => {
    try { await api.post(`/documentos/${id}/renovar?meses=12`); toast.success("Renovado por 12 meses"); load(); }
    catch { toast.error("Erro"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir documento?")) return;
    try { await api.delete(`/documentos/${id}`); toast.success("Excluído"); load(); } catch { toast.error("Erro"); }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-600 font-bold">Compliance documental</div>
          <h1 className="text-3xl font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>Documentos & Licenças</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-doc-btn" onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" /> Novo documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} documento</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 gap-4 mt-2">
              {user?.role === "admin" && (
                <div>
                  <Label>Estabelecimento</Label>
                  <Select value={form.estabelecimento_id} onValueChange={v=>setForm({...form,estabelecimento_id:v})}>
                    <SelectTrigger data-testid="doc-estab-select"><SelectValue placeholder="Selecione"/></SelectTrigger>
                    <SelectContent>{estabs.map(e=><SelectItem key={e.id} value={e.id}>{e.nome_fantasia}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Tipo de documento</Label>
                <Select value={form.tipo} onValueChange={v=>setForm({...form,tipo:v})}>
                  <SelectTrigger data-testid="doc-tipo-select"><SelectValue/></SelectTrigger>
                  <SelectContent>{TIPOS_DOC.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Número</Label><Input data-testid="doc-numero-input" value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})}/></div>
                <div><Label>Emissão</Label><Input data-testid="doc-emissao-input" type="date" value={form.emissao} onChange={e=>setForm({...form,emissao:e.target.value})}/></div>
              </div>
              <div>
                <Label>Validade *</Label>
                <Input data-testid="doc-validade-input" type="date" value={form.validade} onChange={e=>setForm({...form,validade:e.target.value})}/>
              </div>
              <div><Label>Observações</Label><Input value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})}/></div>
            </div>
            <DialogFooter>
              <Button data-testid="doc-save-btn" onClick={save} className="bg-emerald-600 hover:bg-emerald-700">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger data-testid="filter-status-select" className="w-56"><SelectValue placeholder="Status"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="vencido">Vencidos</SelectItem>
            <SelectItem value="critico_30d">A vencer (≤30d)</SelectItem>
            <SelectItem value="atencao_90d">A vencer (31–90d)</SelectItem>
            <SelectItem value="vigente">Vigentes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEstab} onValueChange={setFilterEstab}>
          <SelectTrigger data-testid="filter-estab-select" className="w-64"><SelectValue placeholder="Estabelecimento"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os estabelecimentos</SelectItem>
            {estabs.map(e=><SelectItem key={e.id} value={e.id}>{e.nome_fantasia}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left p-4">Estabelecimento</th>
                <th className="text-left p-4">Tipo</th>
                <th className="text-left p-4">Nº</th>
                <th className="text-left p-4">Emissão</th>
                <th className="text-left p-4">Validade</th>
                <th className="text-left p-4">Dias</th>
                <th className="text-left p-4">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody data-testid="documentos-table-body">
              {filtered.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-slate-400"><FileCheck2 className="w-8 h-8 mx-auto mb-2 opacity-40"/>Nenhum documento encontrado.</td></tr>}
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-slate-50 hover:bg-emerald-50/30">
                  <td className="p-4 font-medium text-slate-900">{d.estabelecimento_nome}</td>
                  <td className="p-4 text-slate-700">{d.tipo}</td>
                  <td className="p-4 font-mono text-xs text-slate-500">{d.numero}</td>
                  <td className="p-4 text-slate-700">{d.emissao}</td>
                  <td className="p-4 text-slate-700">{d.validade}</td>
                  <td className="p-4 font-bold">{d.dias_para_vencer}</td>
                  <td className="p-4"><span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${statusColor[d.status]}`}>{statusLabel[d.status]}</span></td>
                  <td className="p-4 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button data-testid={`renovar-doc-${d.id}`} variant="ghost" size="sm" onClick={()=>renovar(d.id)} title="Renovar +12 meses" className="text-emerald-700"><RefreshCw className="w-4 h-4"/></Button>
                      <Button data-testid={`edit-doc-${d.id}`} variant="ghost" size="sm" onClick={()=>openEdit(d)}><Pencil className="w-4 h-4"/></Button>
                      <Button data-testid={`delete-doc-${d.id}`} variant="ghost" size="sm" onClick={()=>remove(d.id)} className="text-rose-600"><Trash2 className="w-4 h-4"/></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

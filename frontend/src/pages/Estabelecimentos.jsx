import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";

const TIPOS = ["Hospital","Clínica Médica","Clínica Odontológica","Clínica Veterinária","Centro de Estética","Laboratório de Análises Clínicas","Laboratório Veterinário"];
const RISCOS = ["I","II","III"];
const emptyForm = { nome_fantasia:"", razao_social:"", tipo:"Clínica Odontológica", cnpj:"", cidade:"", uf:"", responsavel_tecnico:"", telefone:"", email:"", grau_risco:"II", ativo:true };

export default function Estabelecimentos() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try { const { data } = await api.get("/estabelecimentos"); setItems(data); } catch { toast.error("Erro ao carregar"); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (e) => { setEditing(e); setForm({ ...emptyForm, ...e }); setOpen(true); };

  const save = async () => {
    try {
      if (editing) await api.put(`/estabelecimentos/${editing.id}`, form);
      else await api.post(`/estabelecimentos`, form);
      toast.success(editing ? "Atualizado" : "Cadastrado");
      setOpen(false); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erro"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir estabelecimento? Isso remove seus documentos e visitas.")) return;
    try { await api.delete(`/estabelecimentos/${id}`); toast.success("Excluído"); load(); }
    catch (e) { toast.error("Erro"); }
  };

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-600 font-bold">Cadastro</div>
          <h1 className="text-3xl font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>Estabelecimentos</h1>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="new-estab-btn" onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" /> Novo estabelecimento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} estabelecimento</DialogTitle></DialogHeader>
              <div className="grid md:grid-cols-2 gap-4 mt-2">
                <div><Label>Nome fantasia</Label><Input data-testid="estab-nome-input" value={form.nome_fantasia} onChange={e=>setForm({...form,nome_fantasia:e.target.value})} /></div>
                <div><Label>Razão social</Label><Input value={form.razao_social} onChange={e=>setForm({...form,razao_social:e.target.value})} /></div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={v=>setForm({...form,tipo:v})}>
                    <SelectTrigger data-testid="estab-tipo-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={e=>setForm({...form,cnpj:e.target.value})} /></div>
                <div><Label>Cidade</Label><Input value={form.cidade} onChange={e=>setForm({...form,cidade:e.target.value})} /></div>
                <div><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={e=>setForm({...form,uf:e.target.value.toUpperCase()})} /></div>
                <div><Label>Responsável técnico</Label><Input value={form.responsavel_tecnico} onChange={e=>setForm({...form,responsavel_tecnico:e.target.value})} /></div>
                <div><Label>Telefone</Label><Input value={form.telefone} onChange={e=>setForm({...form,telefone:e.target.value})} /></div>
                <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
                <div>
                  <Label>Grau de risco</Label>
                  <Select value={form.grau_risco} onValueChange={v=>setForm({...form,grau_risco:v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RISCOS.map(r=><SelectItem key={r} value={r}>Grau {r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button data-testid="estab-save-btn" onClick={save} className="bg-emerald-600 hover:bg-emerald-700">Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left p-4">Nome fantasia</th>
                <th className="text-left p-4">Tipo</th>
                <th className="text-left p-4">CNPJ</th>
                <th className="text-left p-4">Cidade/UF</th>
                <th className="text-left p-4">Resp. técnico</th>
                <th className="text-left p-4">Risco</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody data-testid="estab-table-body">
              {items.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-slate-400"><Building2 className="w-8 h-8 mx-auto mb-2 opacity-40"/>Nenhum estabelecimento cadastrado.</td></tr>}
              {items.map(e => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-emerald-50/30">
                  <td className="p-4">
                    <div className="font-semibold text-slate-900">{e.nome_fantasia}</div>
                    <div className="text-xs text-slate-500">{e.razao_social}</div>
                  </td>
                  <td className="p-4 text-slate-700">{e.tipo}</td>
                  <td className="p-4 text-slate-500 font-mono text-xs">{e.cnpj}</td>
                  <td className="p-4 text-slate-700">{e.cidade}{e.uf?`/${e.uf}`:""}</td>
                  <td className="p-4 text-slate-700">{e.responsavel_tecnico}</td>
                  <td className="p-4"><span className="inline-flex px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-xs font-bold">Grau {e.grau_risco}</span></td>
                  <td className="p-4 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button data-testid={`edit-estab-${e.id}`} variant="ghost" size="sm" onClick={()=>openEdit(e)}><Pencil className="w-4 h-4"/></Button>
                      {isAdmin && <Button data-testid={`delete-estab-${e.id}`} variant="ghost" size="sm" onClick={()=>remove(e.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="w-4 h-4"/></Button>}
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

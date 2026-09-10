import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Radar, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", nome_fantasia: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const r = await register(form);
    setLoading(false);
    if (r.ok) {
      toast.success("Conta criada com sucesso!");
      nav("/dashboard");
    } else {
      toast.error(r.error);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 hero-gradient relative overflow-hidden">
        <div className="absolute inset-0 radar-grid opacity-40" />
        <Link to="/" className="relative flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white grid place-items-center">
            <Radar className="w-5 h-5" />
          </div>
          <div className="font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>Radar Sanitário</div>
        </Link>
        <div className="relative">
          <h1 className="text-4xl font-extrabold text-slate-900 leading-tight" style={{fontFamily:'Outfit'}}>
            Comece grátis. Blinde sua clínica em 14 dias.
          </h1>
          <p className="mt-4 text-slate-600 text-lg max-w-md">
            Cadastre-se e importe seus documentos. Nós avisamos antes que qualquer prazo vença.
          </p>
        </div>
        <div className="relative text-sm text-slate-500">Sem cartão de crédito • LGPD</div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>Criar conta</h2>
          <p className="mt-2 text-slate-600">Comece seu teste grátis de 14 dias.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <Label htmlFor="name">Seu nome</Label>
              <Input data-testid="register-name-input" id="name" value={form.name} onChange={update("name")} required className="mt-2" placeholder="Ex.: Dra. Ana Souza" />
            </div>
            <div>
              <Label htmlFor="nome_fantasia">Nome do estabelecimento</Label>
              <Input data-testid="register-estab-input" id="nome_fantasia" value={form.nome_fantasia} onChange={update("nome_fantasia")} required className="mt-2" placeholder="Ex.: Clínica Sorriso" />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input data-testid="register-email-input" id="email" type="email" value={form.email} onChange={update("email")} required className="mt-2" placeholder="voce@empresa.com.br" />
            </div>
            <div>
              <Label htmlFor="password">Senha (mín. 6 caracteres)</Label>
              <Input data-testid="register-password-input" id="password" type="password" value={form.password} onChange={update("password")} required minLength={6} className="mt-2" placeholder="••••••••" />
            </div>
            <Button data-testid="register-submit-btn" type="submit" disabled={loading} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar conta"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-slate-600">
            Já tem conta? <Link to="/login" className="text-emerald-700 font-semibold hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

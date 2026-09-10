import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Radar, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const r = await login(email, password);
    setLoading(false);
    if (r.ok) {
      toast.success("Bem-vindo(a) ao Radar Sanitário");
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
          <div>
            <div className="font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>Radar Sanitário</div>
            <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-semibold">compliance em tempo real</div>
          </div>
        </Link>
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-white/80 border border-emerald-200 rounded-full px-3 py-1.5 text-xs font-semibold text-emerald-700 mb-6">
            <span className="pulse-dot" /> ao vivo
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 leading-tight" style={{fontFamily:'Outfit'}}>
            Sua central de compliance sanitário.
          </h1>
          <p className="mt-4 text-slate-600 text-lg max-w-md">
            Entre no painel e acompanhe todos os vencimentos de licenças, PGRSS, MTR e coletas em um só lugar.
          </p>
        </div>
        <div className="relative text-sm text-slate-500">© {new Date().getFullYear()} Radar Sanitário</div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Link to="/" className="flex items-center gap-2">
              <Radar className="w-6 h-6 text-emerald-600" />
              <span className="font-bold text-slate-900">Radar Sanitário</span>
            </Link>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>Entrar</h2>
          <p className="mt-2 text-slate-600">Acesse sua conta para gerenciar suas licenças.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input data-testid="login-email-input" id="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required className="mt-2" placeholder="voce@empresa.com.br" />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input data-testid="login-password-input" id="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required className="mt-2" placeholder="••••••••" />
            </div>
            <Button data-testid="login-submit-btn" type="submit" disabled={loading} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-slate-600">
            Ainda não tem conta? <Link to="/cadastro" className="text-emerald-700 font-semibold hover:underline">Criar conta grátis</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

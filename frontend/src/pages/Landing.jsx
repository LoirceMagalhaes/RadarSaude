import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Radar, ShieldCheck, BellRing, CalendarRange, FileCheck2, TrendingUp, Building2, ArrowRight, CheckCircle2, Zap } from "lucide-react";

const features = [
  { icon: BellRing, title: "Alertas em tempo real", desc: "Notificações imediatas por WhatsApp, e-mail e in-app assim que um documento se aproxima do vencimento." },
  { icon: FileCheck2, title: "Controle de licenças e PGRSS", desc: "Alvará, AFE, PGRSS, MTR, contratos de coleta RSS e licenças ambientais em um painel único." },
  { icon: CalendarRange, title: "Agenda de coletas e visitas", desc: "Rotas de coleta de resíduos infectantes, químicos e perfurocortantes com confirmação do MTR." },
  { icon: TrendingUp, title: "Dashboard 12 meses", desc: "Acompanhe a conformidade da rede ao longo do último ano — o que venceu, o que foi renovado, o que vem." },
  { icon: ShieldCheck, title: "Nível de risco sanitário", desc: "Cada estabelecimento recebe grau I, II ou III para priorizar visitas e evitar autuações." },
  { icon: Building2, title: "Multi-estabelecimento", desc: "Hospitais, clínicas odontológicas, veterinárias, laboratórios e centros de estética — tudo integrado." },
];

const planos = [
  { nome: "Essencial", preco: "R$ 149", per: "/mês", pra: "Consultório individual", features: ["1 estabelecimento", "Até 20 documentos", "Alertas por e-mail e in-app", "Dashboard básico"], destaque: false },
  { nome: "Pro Clínica", preco: "R$ 349", per: "/mês", pra: "Clínicas e labs", features: ["Até 5 estabelecimentos", "Documentos ilimitados", "WhatsApp + E-mail", "Dashboard 12 meses", "Agenda de coletas"], destaque: true },
  { nome: "Hospitalar", preco: "Sob consulta", per: "", pra: "Redes e hospitais", features: ["Estabelecimentos ilimitados", "API + integrações", "SLA dedicado", "Consultoria de PGRSS", "Onboarding assistido"], destaque: false },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white grid place-items-center">
              <Radar className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>Radar Sanitário</div>
              <div className="text-[10px] uppercase tracking-widest text-emerald-600 font-semibold">compliance em tempo real</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <a href="#recursos" className="hover:text-slate-900">Recursos</a>
            <a href="#como-funciona" className="hover:text-slate-900">Como funciona</a>
            <a href="#planos" className="hover:text-slate-900">Planos</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button data-testid="nav-login-btn" variant="ghost" size="sm">Entrar</Button></Link>
            <Link to="/cadastro"><Button data-testid="nav-signup-btn" className="bg-emerald-600 hover:bg-emerald-700" size="sm">Teste grátis</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden">
        <div className="absolute inset-0 radar-grid opacity-40 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 bg-white border border-emerald-200 rounded-full px-3 py-1.5 text-xs font-semibold text-emerald-700 mb-6">
                <span className="pulse-dot" /> Monitorando conformidade em tempo real
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.05]" style={{fontFamily:'Outfit'}}>
                Nunca mais perca <span className="text-emerald-600">um vencimento</span> de licença ou coleta de resíduos.
              </h1>
              <p className="mt-6 text-lg text-slate-600 max-w-2xl">
                O Radar Sanitário centraliza o controle de <strong>Alvarás, PGRSS, MTR, AFE</strong> e contratos de coleta de resíduos de serviços de saúde e dispara alertas em tempo real para sua equipe antes que qualquer documento vença.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/cadastro">
                  <Button data-testid="hero-cta-primary" size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-base h-12 px-6">
                    Começar teste grátis <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button data-testid="hero-cta-secondary" size="lg" variant="outline" className="text-base h-12 px-6 border-slate-300">
                    Ver painel demo
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-6 text-sm text-slate-500">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> 14 dias grátis</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Sem cartão de crédito</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> LGPD & sigilo total</div>
              </div>
            </div>

            {/* Preview card */}
            <div className="lg:col-span-5">
              <div className="relative">
                <div className="absolute -inset-4 bg-emerald-500/10 rounded-3xl blur-2xl" />
                <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="pulse-dot" />
                      <span className="text-sm font-semibold text-slate-900">Alertas prioritários</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-semibold">ao vivo</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {[
                      { est: "Clínica Sorriso", tipo: "Contrato de Coleta RSS", dias: -20, cor: "rose" },
                      { est: "Hospital Vida Plena", tipo: "PGRSS 2025", dias: 7, cor: "amber" },
                      { est: "Laboratório Analisa", tipo: "Alvará Sanitário", dias: 22, cor: "amber" },
                      { est: "Vet Amigo Fiel", tipo: "MTR Trimestre", dias: 60, cor: "sky" },
                    ].map((a, i) => (
                      <div key={i} className="p-4 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{a.est}</div>
                          <div className="text-xs text-slate-500">{a.tipo}</div>
                        </div>
                        <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          a.cor === 'rose' ? 'bg-rose-100 text-rose-700' :
                          a.cor === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                        }`}>
                          {a.dias < 0 ? `${Math.abs(a.dias)}d vencido` : `${a.dias}d restantes`}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-600">
                    <Zap className="w-3.5 h-3.5 text-emerald-600" /> Notifica automaticamente por WhatsApp, e-mail e app.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-widest text-emerald-600 font-bold mb-3">Recursos</div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>
              Tudo para blindar sua clínica contra multas sanitárias.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Da fiscalização diária ao relatório anual — o Radar Sanitário automatiza a rotina de compliance do seu negócio de saúde.
            </p>
          </div>
          <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="p-7 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-lg transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center mb-5">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900" style={{fontFamily:'Outfit'}}>{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="py-20 lg:py-24 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-widest text-emerald-600 font-bold mb-3">Como funciona</div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>
              Sua clínica no radar em 3 passos.
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              { n: "01", t: "Cadastre seus estabelecimentos", d: "Adicione hospitais, clínicas ou laboratórios com CNPJ e responsável técnico." },
              { n: "02", t: "Suba documentos e prazos", d: "Alvarás, PGRSS, contratos de coleta e MTR — com data de validade e nº do documento." },
              { n: "03", t: "Receba alertas em tempo real", d: "A equipe é notificada dias antes do vencimento e cada empresa vê o que precisa fazer." },
            ].map((s) => (
              <div key={s.n} className="p-8 rounded-2xl bg-white border border-slate-200 relative">
                <div className="text-6xl font-black text-emerald-100" style={{fontFamily:'Outfit'}}>{s.n}</div>
                <h3 className="text-xl font-bold text-slate-900 mt-2" style={{fontFamily:'Outfit'}}>{s.t}</h3>
                <p className="mt-2 text-slate-600">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-widest text-emerald-600 font-bold mb-3">Planos</div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>
              Escolha o plano ideal para o tamanho da sua operação.
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {planos.map((p) => (
              <div key={p.nome} className={`p-8 rounded-2xl border ${p.destaque ? "border-emerald-500 bg-emerald-50/30 shadow-xl relative" : "border-slate-200 bg-white"}`}>
                {p.destaque && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full">Mais popular</div>}
                <div className="text-xs uppercase tracking-widest text-emerald-700 font-bold">{p.pra}</div>
                <h3 className="mt-2 text-2xl font-bold text-slate-900" style={{fontFamily:'Outfit'}}>{p.nome}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>{p.preco}</span>
                  <span className="text-slate-500">{p.per}</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/cadastro" className="block mt-8">
                  <Button data-testid={`plan-cta-${p.nome.toLowerCase().replace(/\s/g,'-')}`} className={`w-full ${p.destaque ? "bg-emerald-600 hover:bg-emerald-700" : ""}`} variant={p.destaque ? "default" : "outline"}>
                    Começar agora
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-emerald-700 to-emerald-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold" style={{fontFamily:'Outfit'}}>
            Pronto para colocar sua clínica no radar?
          </h2>
          <p className="mt-4 text-emerald-100 text-lg">Comece agora, sem cartão. Em minutos você já vê o primeiro alerta.</p>
          <Link to="/cadastro" className="inline-block mt-8">
            <Button data-testid="footer-cta" size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50 h-12 px-8 text-base font-semibold">
              Criar conta grátis <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-10 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Radar className="w-4 h-4 text-emerald-600" />
            <span>© {new Date().getFullYear()} Radar Sanitário. Compliance sanitário inteligente.</span>
          </div>
          <div className="flex gap-6">
            <a href="#recursos" className="hover:text-slate-900">Recursos</a>
            <a href="#planos" className="hover:text-slate-900">Planos</a>
            <Link to="/login" className="hover:text-slate-900">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

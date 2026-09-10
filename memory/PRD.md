# Radar Sanitário — PRD

## Original problem statement
Melhorar o site "Radar Sanitário" para venda: SaaS de controle de licenças sanitárias e recolhimento de resíduos (RSS/PGRSS/MTR/AFE) com alertas em tempo real, responsivo, e dashboard 12 meses.

## Stack
- Backend: FastAPI + Motor (MongoDB) + JWT httpOnly cookies + bcrypt
- Frontend: React 19 + React Router + Shadcn UI + Tailwind + Recharts + Sonner
- Auth: multi-tenant (admin vê tudo; empresa vê próprios dados)

## Implementado (2026-02)
- Landing comercial (hero + recursos + como funciona + planos + CTA)
- Login/Cadastro com JWT em cookie httpOnly
- Dashboard: KPIs, gráfico 12 meses (vencimentos x renovações), checklist da semana, alertas prioritários, totais
- CRUD Estabelecimentos (admin)
- CRUD Documentos + renovação rápida +12 meses + filtros por status/estabelecimento
- Agendamento de visitas com status agendada/concluida/cancelada
- Seed demo (admin): 4 estabelecimentos, 24 documentos, 4 visitas
- Auto-refresh do dashboard a cada 30s (tempo real)
- Design verde-esmeralda + neutros, fonts Outfit + Plus Jakarta Sans

## Backlog / próximos
- P1: Notificações e-mail (Resend) e WhatsApp (Twilio) — chaves pendentes
- P1: Exportar relatório PDF de conformidade
- P1: Upload de PDF do documento (object storage)
- P2: Roles adicionais (consultor com acesso a múltiplas empresas)
- P2: Página comercial com calculadora de risco sanitário

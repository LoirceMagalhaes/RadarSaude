import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Radar, LayoutDashboard, Building2, FileCheck2, CalendarRange, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/estabelecimentos", label: "Estabelecimentos", icon: Building2, testid: "nav-estabelecimentos" },
  { to: "/documentos", label: "Documentos & Licenças", icon: FileCheck2, testid: "nav-documentos" },
  { to: "/agendamento", label: "Agendamento", icon: CalendarRange, testid: "nav-agendamento" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav_ = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    nav_("/");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Topbar mobile */}
      <div className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Radar className="w-6 h-6 text-emerald-600" />
          <span className="font-bold text-slate-900" style={{fontFamily:'Outfit'}}>Radar Sanitário</span>
        </div>
        <button data-testid="mobile-menu-btn" onClick={() => setOpen(!open)} className="p-2">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${open ? "block" : "hidden"} lg:block w-full lg:w-64 lg:fixed lg:h-screen border-r border-slate-200 bg-white`}>
          <div className="hidden lg:flex items-center gap-2 px-6 py-5 border-b border-slate-100">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white grid place-items-center">
              <Radar className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 leading-tight" style={{fontFamily:'Outfit'}}>Radar Sanitário</div>
              <div className="text-[11px] uppercase tracking-widest text-emerald-600 font-semibold">Compliance em tempo real</div>
            </div>
          </div>
          <nav className="p-3 space-y-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                data-testid={n.testid}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? "bg-emerald-50 text-emerald-800 font-semibold"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                <n.icon className="w-4 h-4" />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-white">
            <div className="text-xs text-slate-500 truncate">Logado como</div>
            <div className="text-sm font-semibold text-slate-900 truncate" data-testid="current-user-email">{user?.email}</div>
            <div className="text-[11px] uppercase tracking-widest text-emerald-600 font-semibold mb-3">{user?.role === 'admin' ? 'Administrador' : 'Empresa'}</div>
            <Button data-testid="logout-btn" onClick={handleLogout} variant="outline" size="sm" className="w-full">
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </div>
        </aside>

        <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-10 pb-32">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

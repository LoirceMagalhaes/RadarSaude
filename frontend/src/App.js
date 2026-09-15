import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Estabelecimentos from "@/pages/Estabelecimentos";
import Documentos from "@/pages/Documentos";
import Agendamento from "@/pages/Agendamento";
import Suporte from "@/pages/Suporte";
import Leads from "@/pages/Leads";
import AppLayout from "@/components/AppLayout";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-slate-500">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Register />} />
          <Route element={<Protected><AppLayout /></Protected>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/estabelecimentos" element={<Estabelecimentos />} />
            <Route path="/documentos" element={<Documentos />} />
            <Route path="/agendamento" element={<Agendamento />} />
            <Route path="/suporte" element={<Suporte />} />
            <Route path="/leads" element={<Leads />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

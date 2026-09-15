import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, RefreshCw, Bot, User } from "lucide-react";
import { toast } from "sonner";

export default function Suporte() {
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const loadThreads = async () => {
    try { const { data } = await api.get("/support/threads"); setThreads(data); }
    catch { toast.error("Erro ao carregar conversas"); }
  };

  const loadMessages = async (key) => {
    try {
      const { data } = await api.get(`/support/threads/${encodeURIComponent(key)}`);
      setMsgs(data);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch { toast.error("Erro ao carregar mensagens"); }
  };

  useEffect(() => { loadThreads(); const t = setInterval(loadThreads, 15000); return () => clearInterval(t); }, []);
  useEffect(() => { if (active) { loadMessages(active); const t = setInterval(() => loadMessages(active), 10000); return () => clearInterval(t); } }, [active]);

  const send = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !active) return;
    setLoading(true);
    try {
      const { data } = await api.post("/support/reply", { thread_key: active, body: reply });
      setReply("");
      if (data.sent) toast.success("Enviado no WhatsApp");
      else toast.warning("Registrado (Twilio ainda não configurado)");
      loadMessages(active); loadThreads();
    } catch { toast.error("Erro ao enviar"); }
    finally { setLoading(false); }
  };

  const fmt = (iso) => {
    try { return new Date(iso).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }); }
    catch { return iso; }
  };

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-600 font-bold">Atendimento</div>
          <h1 className="text-3xl font-extrabold text-slate-900" style={{fontFamily:'Outfit'}}>Suporte WhatsApp</h1>
          <p className="text-slate-600 mt-1">Conversas recebidas dos seus clientes com respostas automáticas de FAQ.</p>
        </div>
        <Button data-testid="refresh-threads-btn" variant="outline" onClick={loadThreads}>
          <RefreshCw className="w-4 h-4 mr-2"/> Atualizar
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 h-[calc(100vh-220px)]">
        {/* Threads */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 text-sm font-bold text-slate-700">
            Conversas ({threads.length})
          </div>
          <div className="flex-1 overflow-auto" data-testid="threads-list">
            {threads.length === 0 && (
              <div className="p-10 text-center text-slate-400 text-sm">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40"/>
                Nenhuma conversa ainda. Quando um cliente enviar WhatsApp para o seu número Twilio, aparecerá aqui.
              </div>
            )}
            {threads.map(t => (
              <button
                key={t.thread_key}
                data-testid={`thread-${t.thread_key}`}
                onClick={() => setActive(t.thread_key)}
                className={`w-full text-left p-4 border-b border-slate-50 hover:bg-emerald-50/30 transition ${active===t.thread_key?"bg-emerald-50":""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900 truncate">{t.thread_key.replace("whatsapp:","")}</div>
                  <div className="text-[10px] text-slate-400">{fmt(t.last_at)}</div>
                </div>
                <div className="text-xs text-slate-500 truncate mt-1">
                  {t.last_direction === "in" ? "➡️" : "⬅️"} {t.last_message}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col">
          {!active ? (
            <div className="flex-1 grid place-items-center text-slate-400">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30"/>
                Selecione uma conversa
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
                  <User className="w-4 h-4"/>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{active.replace("whatsapp:","")}</div>
                  <div className="text-xs text-slate-500">Conversa via WhatsApp</div>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-3 bg-slate-50" data-testid="messages-list">
                {msgs.map(m => {
                  const inbound = m.direction === "in";
                  return (
                    <div key={m.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                        inbound ? "bg-white border border-slate-200 text-slate-800" : "bg-emerald-600 text-white"
                      }`}>
                        <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                        <div className={`text-[10px] mt-1 flex items-center gap-1 ${inbound?"text-slate-400":"text-emerald-100"}`}>
                          {m.auto && !inbound && <Bot className="w-3 h-3"/>}
                          {fmt(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef}/>
              </div>

              <form onSubmit={send} className="p-4 border-t border-slate-100 flex gap-2">
                <Input
                  data-testid="reply-input"
                  value={reply}
                  onChange={e=>setReply(e.target.value)}
                  placeholder="Digite sua resposta…"
                  disabled={loading}
                />
                <Button data-testid="reply-send-btn" type="submit" disabled={loading || !reply.trim()} className="bg-emerald-600 hover:bg-emerald-700">
                  <Send className="w-4 h-4"/>
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

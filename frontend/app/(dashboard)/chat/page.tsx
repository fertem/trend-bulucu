"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "Bu hafta hangi konuda yazsam?",
  "Sayfa 2'de bekleyen kelimelerimden en hızlı kazanç hangisi?",
  "Mevsimselliğe göre önümüzdeki ay için strateji öner",
  "Sitede olmayan en yüksek değerli içerik fırsatı ne?",
  "CTR'ı düşük başlıklarımı nasıl iyileştiririm?",
  "Hangi kategoride güçlüyüm, hangisinde zayıf?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const newMessages: Msg[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const resp = await api.aiChat(newMessages);
      setMessages([...newMessages, { role: "assistant", content: resp.content }]);
    } catch (e: any) {
      setError(e.message || "AI cevap alınamadı");
      setMessages(newMessages); // user mesajını koru
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <PageHeader
        title="🤖 AI Sohbet"
        subtitle="Verinle doğrudan konuş — trend, GSC, içerik boşluğu hepsi context'te"
        actions={messages.length > 0 ? (
          <button className="btn-ghost text-sm" onClick={reset}>Sıfırla</button>
        ) : null}
      />

      {messages.length === 0 && (
        <div className="card card-pad mb-4">
          <h3 className="font-medium text-ink-900 mb-3">Örnek sorular</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="text-left text-sm p-3 rounded-md border border-ink-200 hover:border-brand-200 hover:bg-brand-50/30 transition"
                disabled={loading}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
        {messages.map((m, i) => (
          <Message key={i} role={m.role} content={m.content} />
        ))}
        {loading && <Message role="assistant" content="" loading />}
        {error && (
          <div className="text-sm text-red-600 p-3 bg-red-50 rounded">{error}</div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex gap-2 border-t border-ink-200 pt-3"
      >
        <input
          className="input flex-1"
          placeholder="Verine sor… (örn: hangi kelimeden başlasam?)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          autoFocus
        />
        <button className="btn-primary" disabled={loading || !input.trim()}>
          {loading ? "…" : "Gönder"}
        </button>
      </form>
    </div>
  );
}

function Message({ role, content, loading }: { role: "user" | "assistant"; content: string; loading?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] p-4 rounded-lg ${
          isUser
            ? "bg-brand-600 text-white"
            : "bg-ink-100 text-ink-900"
        }`}
      >
        {loading ? (
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-ink-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 rounded-full bg-ink-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 rounded-full bg-ink-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{content}</div>
        )}
      </div>
    </div>
  );
}

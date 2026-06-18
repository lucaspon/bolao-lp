"use client";

import { useState } from "react";
import { Copy, Check, Eye, EyeOff, Code, X } from "lucide-react";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-mute hover:border-neon/60 hover:text-neon"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {label ?? (copied ? "Copiado" : "Copiar")}
    </button>
  );
}

function Code_({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border border-line bg-base p-3 pr-12 text-[11px] leading-relaxed text-ink">
        <code>{children}</code>
      </pre>
      <div className="absolute right-2 top-2">
        <CopyButton text={children} label="" />
      </div>
    </div>
  );
}

export function ApiAccess({ token, baseUrl }: { token: string; baseUrl: string }) {
  const [revealed, setRevealed] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  const masked = `${token.slice(0, 8)}${"•".repeat(16)}`;

  const getExample = `curl ${baseUrl}/api/v1/bets \\
  -H "Authorization: Bearer ${token}"`;

  const putExample = `curl -X PUT ${baseUrl}/api/v1/bets \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"matchId": 110, "home": 2, "away": 1}'`;

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold tracking-wide">Acesso via API</h2>
        <button
          type="button"
          onClick={() => setDocsOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-mute hover:border-neon/60 hover:text-neon"
        >
          <Code size={14} /> Documentação
        </button>
      </div>
      <p className="mb-3 text-sm text-mute">
        Atualize seus palpites de jogos abertos sem passar pela tela, com seu token pessoal.
        Não compartilhe — quem tiver ele pode alterar seus palpites.
      </p>
      <div className="flex items-center gap-2">
        <code className="tabular min-w-0 flex-1 truncate rounded-lg border border-line bg-base px-3 py-2 text-xs text-ink">
          {revealed ? token : masked}
        </code>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? "Ocultar" : "Mostrar"}
          className="flex shrink-0 items-center rounded-md border border-line px-2 py-2 text-mute hover:text-ink"
        >
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <CopyButton text={token} />
      </div>

      {docsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDocsOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-panel p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold tracking-wide">API de palpites</h3>
              <button
                type="button"
                onClick={() => setDocsOpen(false)}
                aria-label="Fechar"
                className="rounded-md p-1 text-mute hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mb-4 text-sm text-mute">
              Autentique com o cabeçalho{" "}
              <code className="rounded bg-base px-1 py-0.5 text-xs text-ink">
                Authorization: Bearer SEU_TOKEN
              </code>
              . Só funciona para jogos ainda abertos (fecham 10 min antes do apito).
            </p>

            <div className="mb-4">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink">
                <span className="rounded bg-neon/15 px-1.5 py-0.5 font-mono text-xs text-neon">GET</span>
                Listar seus jogos abertos
              </div>
              <p className="mb-2 text-xs text-mute">
                Retorna os jogos abertos com seu palpite atual (ou{" "}
                <code className="text-ink">null</code>) e o <code className="text-ink">matchId</code>.
              </p>
              <Code_>{getExample}</Code_>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink">
                <span className="rounded bg-gold/15 px-1.5 py-0.5 font-mono text-xs text-gold">PUT</span>
                Definir o palpite de um jogo
              </div>
              <p className="mb-2 text-xs text-mute">
                Corpo: <code className="text-ink">matchId</code>,{" "}
                <code className="text-ink">home</code> e <code className="text-ink">away</code>{" "}
                (placares de 0 a 30).
              </p>
              <Code_>{putExample}</Code_>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

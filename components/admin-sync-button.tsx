"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Check } from "lucide-react";
import { adminSyncAction } from "@/app/actions/admin";
import { cn } from "@/lib/utils";

export function AdminSyncButton() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await adminSyncAction();
      if (!result.ok) {
        setError(result.error ?? "Erro ao sincronizar.");
        return;
      }
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-sm text-danger">{error}</span>}
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium transition hover:border-neon/60 hover:text-neon disabled:opacity-50",
          done && "border-neon/60 text-neon",
        )}
      >
        {done ? <Check size={15} /> : <RefreshCw size={15} className={pending ? "animate-spin" : ""} />}
        {pending ? "Sincronizando…" : done ? "Atualizado" : "Sincronizar agora"}
      </button>
    </div>
  );
}

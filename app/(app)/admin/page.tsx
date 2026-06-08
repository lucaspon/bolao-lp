import { requireAdmin } from "@/lib/auth/session";
import { getPaymentsForAdmin, getPotTotalCents } from "@/lib/db/queries";
import { AdminSyncButton } from "@/components/admin-sync-button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const brl = (cents: number) => `R$${(cents / 100).toFixed(0)}`;

export default async function AdminPage() {
  await requireAdmin();
  const [paymentRows, potCents] = await Promise.all([
    getPaymentsForAdmin(),
    getPotTotalCents(),
  ]);
  const paidCount = paymentRows.filter((row) => row.stakeCents > 0).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-wide">Admin</h1>
        <AdminSyncButton />
      </div>
      <p className="mb-6 text-sm text-mute">
        Tabela, horários, times do mata-mata e resultados são sincronizados
        automaticamente da football-data.org a cada 5 minutos. Use “Sincronizar agora”
        para forçar uma atualização.
      </p>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold tracking-wide">Pagamentos</h2>
        <span className="text-sm text-mute">
          Pote <span className="font-semibold text-gold">{brl(potCents)}</span> · {paidCount}/
          {paymentRows.length} pagaram
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel text-xs uppercase tracking-wide text-mute">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold">Jogador</th>
              <th className="px-3 py-2.5 text-right font-semibold">Aposta</th>
              <th className="px-3 py-2.5 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {paymentRows.map((row, index) => (
              <tr
                key={row.userId}
                className={cn("border-t border-line", index % 2 ? "bg-panel/40" : "")}
              >
                <td className="px-3 py-2.5 font-medium text-ink">{row.username}</td>
                <td className="tabular px-3 py-2.5 text-right">
                  {row.stakeCents > 0 ? brl(row.stakeCents) : "–"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {row.stakeCents > 0 ? (
                    <span className="text-neon">pagou</span>
                  ) : (
                    <span className="text-mute">pendente</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { requireUser } from "@/lib/auth/session";
import { getMatchCountsByStage } from "@/lib/db/queries";
import { STAGES, STAGE_WEIGHT, BRAZIL_POINTS_MULTIPLIER } from "@/lib/match";
import { ENTRY_MIN_CENTS, ENTRY_MAX_TOTAL_CENTS } from "@/lib/staking";

const brl = (cents: number) => `R$${(cents / 100).toFixed(0)}`;
const MAX_PER_MATCH = 3; // exact score

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="mb-3 font-display text-lg font-bold tracking-wide text-neon">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

export default async function RegrasPage() {
  await requireUser();
  const counts = await getMatchCountsByStage();
  const maxPoints = (stageKey: (typeof STAGES)[number]["key"]) =>
    (counts[stageKey] ?? 0) * MAX_PER_MATCH * STAGE_WEIGHT[stageKey];
  const totalMaxPoints = STAGES.reduce((sum, stage) => sum + maxPoints(stage.key), 0);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-bold tracking-wide">Regras do Bolão</h1>
      <p className="mb-6 text-sm text-mute">
        Copa do Mundo 2026 · tudo o que você precisa saber em um lugar só.
      </p>

      <div className="space-y-4">
        <Section title="A ideia">
          <p>
            Você dá um palpite no <strong>placar</strong> de cada jogo e ganha pontos por acerto.
            No fim, os <strong>3 melhores</strong> dividem o bolo de dinheiro (o “pote”). Quanto
            melhor você prevê — e quanto mais aposta — maior o prêmio.
          </p>
        </Section>

        <Section title="Pontuação">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-gold">+3</strong> — placar exato (ex.: você cravou 2–1 e
              terminou 2–1).
            </li>
            <li>
              <strong className="text-neon">+1</strong> — resultado certo (acertou o vencedor, ou
              previu empate e deu empate), sem o placar exato.
            </li>
            <li>
              <strong>0</strong> — errou o resultado.
            </li>
          </ul>
          <p>
            Você pode criar e editar seus palpites até <strong>1 hora antes</strong> de cada jogo
            começar. Depois disso, o palpite tranca.
          </p>
        </Section>

        <Section title="Cada fase vale mais">
          <p>
            O mata-mata pesa mais que a fase de grupos. Os pontos de cada jogo são multiplicados
            conforme a fase:
          </p>
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-base text-xs uppercase tracking-wide text-mute">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Fase</th>
                  <th className="px-3 py-2 text-right font-semibold">Jogos</th>
                  <th className="px-3 py-2 text-right font-semibold">Mult.</th>
                  <th className="px-3 py-2 text-right font-semibold">Máx. pontos</th>
                </tr>
              </thead>
              <tbody>
                {STAGES.map((stage) => (
                  <tr key={stage.key} className="border-t border-line">
                    <td className="px-3 py-2 text-mute">{stage.label}</td>
                    <td className="tabular px-3 py-2 text-right text-mute">
                      {counts[stage.key] ?? 0}
                    </td>
                    <td className="tabular px-3 py-2 text-right font-display font-bold text-ink">
                      ×{STAGE_WEIGHT[stage.key]}
                    </td>
                    <td className="tabular px-3 py-2 text-right font-display font-bold text-gold">
                      {maxPoints(stage.key)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-line bg-base/60">
                  <td className="px-3 py-2 font-semibold text-ink">Total</td>
                  <td className="tabular px-3 py-2 text-right text-mute">
                    {STAGES.reduce((sum, stage) => sum + (counts[stage.key] ?? 0), 0)}
                  </td>
                  <td className="px-3 py-2"></td>
                  <td className="tabular px-3 py-2 text-right font-display font-bold text-gold">
                    {totalMaxPoints}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-mute">
            “Máx. pontos” = jogos × 3 (placar exato) × multiplicador. Ex.: um placar exato na{" "}
            <strong>final</strong> vale 3 × {STAGE_WEIGHT.final} ={" "}
            <strong className="text-ink">{3 * STAGE_WEIGHT.final} pontos</strong>. A fase de grupos
            vale {Math.round((maxPoints("group") / totalMaxPoints) * 100)}% de todos os pontos —
            o resto sai no mata-mata. (A tabela mostra o multiplicador base, antes do bônus do
            Brasil abaixo.)
          </p>
          <p className="rounded-lg border border-neon/30 bg-neon/10 p-3">
            🇧🇷 <strong className="text-neon">Jogos do Brasil valem dobro.</strong> Sempre que a
            Seleção joga, o multiplicador da fase é multiplicado por {BRAZIL_POINTS_MULTIPLIER}.
            Ex.: cravar um jogo do Brasil na fase de grupos vale 3 × {STAGE_WEIGHT.group} ×{" "}
            {BRAZIL_POINTS_MULTIPLIER} ={" "}
            <strong className="text-ink">
              {3 * STAGE_WEIGHT.group * BRAZIL_POINTS_MULTIPLIER} pontos
            </strong>
            ; na final, 3 × {STAGE_WEIGHT.final} × {BRAZIL_POINTS_MULTIPLIER} ={" "}
            <strong className="text-ink">
              {3 * STAGE_WEIGHT.final * BRAZIL_POINTS_MULTIPLIER}
            </strong>
            .
          </p>
        </Section>

        <Section title="A aposta (PIX)">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Aposte de <strong>{brl(ENTRY_MIN_CENTS)}</strong> a{" "}
              <strong>{brl(ENTRY_MAX_TOTAL_CENTS)}</strong> no total, via PIX, na aba{" "}
              <strong>Minhas Apostas</strong>.
            </li>
            <li>
              <strong>Duas janelas:</strong> aposte livremente <strong>antes</strong> da fase de
              grupos começar; depois, há uma janela de <strong>reforço</strong> entre o fim da fase
              de grupos e o início do mata-mata (respeitando o limite total).
            </li>
            <li>
              <strong>Aposta travada por fase:</strong> o que você apostou{" "}
              <strong>antes dos grupos</strong> vale para seus <strong>pontos de grupos</strong>; o
              reforço vale para seus <strong>pontos de mata-mata</strong>. Aumentar a aposta depois{" "}
              <em>não</em> infla os pontos que você já fez nos grupos — então vale a pena apostar
              firme desde o começo, e não esperar para ver como você se sai.
            </li>
            <li>
              O pagamento é confirmado <strong>automaticamente</strong> — assim que o PIX cai, sua
              aposta aparece atualizada.
            </li>
          </ul>
          <p className="rounded-lg bg-base p-3 text-mute">
            ✅ O PIX é por QR Code estático (Asaas), <strong>sem taxas</strong> — o valor cheio da
            sua aposta entra no pote.
          </p>
        </Section>

        <Section title="Prêmios — top 3 (ou mais, se houver empate)">
          <p>
            Normalmente, os <strong>3 primeiros colocados</strong> (em pontos, entre quem apostou)
            levam prêmio. Os demais recebem <strong>R$0</strong>. O dinheiro <em>não</em> compra
            posição no pódio — só os melhores palpiteiros sobem.
          </p>
          <p className="rounded-lg border border-gold/30 bg-gold/10 p-3">
            ⚖️ <strong className="text-gold">Empate de pontos expande o pódio.</strong> Se dois ou
            mais jogadores empatarem em pontos na borda do pódio (ex.: dois jogadores com o mesmo
            total de pontos brigando pela 3ª posição), <strong>todos os empatados entram no
            pote</strong> — o grupo de premiados se expande automaticamente. Em caso de empate, a
            ordem de desempate para exibição é: total apostado (maior primeiro), depois cravadas,
            depois nome.
          </p>
          <p>
            O pote é dividido entre os premiados proporcionalmente ao seu <strong>peso</strong>,
            que trava a aposta por fase:
          </p>
          <p className="rounded-lg bg-base p-3 text-center font-mono text-xs text-ink">
            peso = (pts de grupos × aposta pré-grupos) + (pts de mata-mata × aposta total)
            <br />
            prêmio = pote × peso ÷ soma dos pesos do top 3
          </p>
          <p className="text-mute">
            Exemplo (apostas únicas, sem reforço) — pote de R$500, top 3: Ana (50 pts, R$50), Bia
            (45 pts, R$30), Caio (40 pts, R$100). Pesos 2500 / 1350 / 4000. Prêmios ≈{" "}
            <strong>R$159</strong> / <strong>R$86</strong> / <strong>R$255</strong>. Apostar mais
            aumenta seu prêmio — desde que você termine no pódio.
          </p>
        </Section>

        <Section title="Pagamento e transparência">
          <p>
            O pote fica na conta Asaas do organizador e é distribuído aos 3 vencedores ao fim do
            torneio. O placar de quem pagou (e quanto) e o pote total ficam visíveis para todos.
          </p>
          <p className="text-mute">
            É um bolão interno e voluntário entre colegas — sem comissão para o organizador.
          </p>
        </Section>
      </div>
    </div>
  );
}

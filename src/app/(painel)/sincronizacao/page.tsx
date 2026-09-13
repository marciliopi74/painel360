import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { podeDispararSincronizacao } from "@/lib/rbac";
import { Icon } from "@/components/Icon";
import { BotaoSincronizar } from "./BotaoSincronizar";
import { Paginacao } from "../cadastros/Paginacao";
import { formatarDataHora } from "@/lib/ui/data";

const ITENS_POR_PAGINA = 10;

export default async function SincronizacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const usuario = session!.user;
  const pagina = Number(params.pagina ?? "1") || 1;

  const [historico, total] = await Promise.all([
    prisma.sincronizacao.findMany({
      orderBy: { iniciadoEm: "desc" },
      skip: (pagina - 1) * ITENS_POR_PAGINA,
      take: ITENS_POR_PAGINA,
      include: { usuario: { select: { nome: true } } },
    }),
    prisma.sincronizacao.count(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg text-on-surface">Sincronização com o e-SUS</h1>
        <p className="text-body-sm text-on-surface-variant mt-0.5">
          Automática a cada 10 minutos via pg_cron, ou disparada manualmente abaixo.
        </p>
      </div>

      <BotaoSincronizar podeDisparar={podeDispararSincronizacao(usuario)} />

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-outline-variant/30 pb-3">
          <Icon name="history" className="text-primary" />
          <h2 className="text-headline-sm text-on-surface">Histórico de Sincronizações</h2>
        </div>

        <div className="space-y-3">
          {historico.length === 0 && <p className="text-body-sm text-on-surface-variant text-center py-4">Nenhuma sincronização registrada ainda.</p>}
          {historico.map((s) => {
            const sucesso = s.status === "concluida";
            const falha = s.status === "erro" || s.status === "parcial";
            const emAndamento = s.status === "em_andamento";
            return (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg bg-surface-container-low/60 border border-outline-variant/30 gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      sucesso ? "bg-[#EAF8F1] text-[#1E824C]" : falha ? "bg-error-container text-error" : "bg-surface-container text-primary"
                    }`}
                  >
                    <Icon name={sucesso ? "check_circle" : falha ? "error" : "sync"} className={`text-body-lg ${emAndamento ? "sync-spinning" : ""}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-on-surface text-body-md">{s.tipo === "manual" ? "Sincronização manual" : "Sincronização automática"}</span>
                      <span className="text-label-sm text-on-surface-variant">• {formatarDataHora(s.iniciadoEm)}</span>
                    </div>
                    <div className="text-body-sm text-on-surface-variant flex items-center gap-3 mt-0.5 flex-wrap">
                      <span>Disparada por: <strong className="text-on-surface">{s.usuario.nome}</strong></span>
                      <span>•</span>
                      <span>{s.processados} registro(s) processado(s)</span>
                      {s.etapaAtual && emAndamento && (
                        <>
                          <span>•</span>
                          <span>Etapa: {s.etapaAtual}</span>
                        </>
                      )}
                    </div>
                    {s.erroMensagem && <p className="text-label-sm text-error mt-1">{s.erroMensagem}</p>}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-semibold self-end sm:self-center shrink-0 ${
                    sucesso ? "bg-[#EAF8F1] text-[#1E824C]" : falha ? "bg-error-container text-error" : "bg-surface-container text-primary"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${sucesso ? "bg-[#2FBF71]" : falha ? "bg-error" : "bg-primary"}`} />
                  {sucesso ? "Sucesso" : s.status === "erro" ? "Erro" : s.status === "parcial" ? "Parcial" : "Em andamento"}
                </span>
              </div>
            );
          })}
        </div>

        <Paginacao
          pagina={pagina}
          totalPaginas={Math.max(1, Math.ceil(total / ITENS_POR_PAGINA))}
          total={total}
          itensNaPagina={historico.length}
          itensPorPagina={ITENS_POR_PAGINA}
          paramNome="pagina"
          outrosParams={new URLSearchParams()}
        />
      </div>
    </div>
  );
}

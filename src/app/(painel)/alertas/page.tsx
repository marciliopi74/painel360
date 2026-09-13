import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { equipeIdPermitido } from "@/lib/data/escopo";
import { Icon } from "@/components/Icon";
import { formatarDataHora } from "@/lib/ui/data";

export default async function AlertasPage() {
  const session = await auth();
  const equipeId = await equipeIdPermitido(session!.user);
  const where = equipeId ? { profissional: { equipeId } } : {};

  const alertas = await prisma.alerta.findMany({
    where,
    include: {
      profissional: { select: { nome: true, usuarios: { select: { telefone: true }, take: 1 } } },
      indicador: { select: { codigo: true, nome: true } },
    },
    orderBy: { criadoEm: "desc" },
    take: 100,
  });

  const enviados = alertas.filter((a) => a.enviadoSms).length;
  const pendentes = alertas.length - enviados;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg text-on-surface">Alertas de Indicadores</h1>
        <p className="text-body-sm text-on-surface-variant mt-0.5">
          Disparados automaticamente quando um indicador fica classificado como Regular ou abaixo do mínimo esperado — enviados por SMS ao
          profissional responsável.
        </p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-label-md text-on-surface-variant block">Total de Alertas</span>
            <span className="text-headline-lg font-bold text-on-surface">{alertas.length}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
            <Icon name="notifications" />
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-label-md text-on-surface-variant block">SMS Enviados</span>
            <span className="text-headline-lg font-bold text-secondary">{enviados}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-secondary-container/30 flex items-center justify-center text-secondary">
            <Icon name="mark_email_read" />
          </div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-label-md text-on-surface-variant block">Pendentes de Envio</span>
            <span className={`text-headline-lg font-bold ${pendentes > 0 ? "text-tertiary-container" : "text-on-surface"}`}>{pendentes}</span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#FEF6EE] flex items-center justify-center text-[#B25E16]">
            <Icon name="schedule_send" />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        {alertas.length === 0 && (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 text-center text-body-sm text-on-surface-variant">
            Nenhum alerta gerado até o momento.
          </div>
        )}
        {alertas.map((a) => {
          const telefone = a.profissional.usuarios[0]?.telefone;
          return (
            <article key={a.id} className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${a.enviadoSms ? "bg-secondary-container/30 text-secondary" : "bg-[#FEF6EE] text-[#B25E16]"}`}>
                  <Icon name={a.enviadoSms ? "mark_email_read" : "schedule_send"} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-on-surface text-body-md">{a.profissional.nome}</span>
                    <Link href="/indicadores-qualidade" className="text-label-sm text-primary font-semibold hover:underline">
                      {a.indicador.codigo}
                    </Link>
                    <span className="text-label-sm text-on-surface-variant">• {formatarDataHora(a.criadoEm)}</span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">{a.mensagem}</p>
                  {!telefone && (
                    <p className="text-label-sm text-error mt-1 flex items-center gap-1">
                      <Icon name="phone_disabled" className="text-body-md" />
                      Profissional sem usuário/telefone vinculado — SMS não pode ser enviado.
                    </p>
                  )}
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-semibold self-start sm:self-center shrink-0 ${
                  a.enviadoSms ? "bg-secondary-container/40 text-secondary" : "bg-[#FEF6EE] text-[#B25E16]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${a.enviadoSms ? "bg-secondary" : "bg-[#F4A261]"}`} />
                {a.enviadoSms ? `Enviado ${a.enviadoEm ? formatarDataHora(a.enviadoEm) : ""}` : "Pendente"}
              </span>
            </article>
          );
        })}
      </div>
    </div>
  );
}

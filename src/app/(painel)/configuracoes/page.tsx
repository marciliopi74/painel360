import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { rotuloPapel } from "@/lib/rbac";
import { Icon } from "@/components/Icon";
import { obterStatusServidor, obterResumoUsuarios } from "@/lib/data/administracao";
import { ForcarSincronizacaoBotao } from "./ForcarSincronizacaoBotao";
import { formatarDataHora } from "@/lib/ui/data";

const ROTULO_SCHEDULE: Record<string, string> = {
  "*/10 * * * *": "a cada 10 minutos",
  "*/15 * * * *": "a cada 15 minutos",
};

const ROTULO_JOB: Record<string, string> = {
  "sincronizacao-automatica-esus": "Sincronização automática com o e-SUS",
  "detectar-erros-cadastros": "Detecção de erros em cadastros",
  "detectar-erros-atendimentos": "Detecção de erros em atendimentos",
};

function relativo(data: Date): string {
  const min = Math.round((Date.now() - data.getTime()) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `há ${horas} h`;
  return `há ${Math.round(horas / 24)} d`;
}

export default async function ConfiguracoesPage() {
  const [status, resumoUsuarios, ultimasSincronizacoes] = await Promise.all([
    obterStatusServidor(),
    obterResumoUsuarios(),
    prisma.sincronizacao.findMany({
      orderBy: { iniciadoEm: "desc" },
      take: 5,
      include: { usuario: { select: { nome: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-outline-variant/40 pb-4">
        <div>
          <h1 className="text-headline-lg text-on-surface">Administração & Servidor Local</h1>
          <p className="text-body-sm text-on-surface-variant">Status operacional do painel, conexão com o e-SUS e gestão de usuários.</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-semibold ${
              status.esusFdwConectado ? "bg-[#EAF8F1] text-[#1E824C]" : "bg-error-container text-on-error-container"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${status.esusFdwConectado ? "bg-[#2FBF71] animate-pulse" : "bg-error"}`} />
            {status.esusFdwConectado ? "e-SUS Conectado (FDW)" : "e-SUS Inacessível"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status do servidor e banco */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant/40 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/30 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <Icon name="database" />
              </div>
              <div>
                <h2 className="text-headline-sm text-on-surface">Status do Banco e Conexão e-SUS</h2>
                <p className="text-label-sm text-on-surface-variant">
                  FDW: {status.esusFdw.usuario}@{status.esusFdw.host}:{status.esusFdw.porta}/{status.esusFdw.banco}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
              <span className="text-label-sm text-on-surface-variant block">Latência do Banco</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-headline-sm font-bold text-secondary">{status.bancoLatenciaMs}ms</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
              <span className="text-label-sm text-on-surface-variant block">Memória do Processo</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-headline-sm font-bold text-on-surface">{status.memoriaProcessoMb} MB</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
              <span className="text-label-sm text-on-surface-variant block">Última Sincronização</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-headline-sm font-bold text-on-surface">
                  {ultimasSincronizacoes[0] ? relativo(ultimasSincronizacoes[0].iniciadoEm) : "Nunca"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-surface p-4 rounded-xl border border-surface-container space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-label-lg text-on-surface block font-semibold">Rotinas Automáticas (pg_cron)</span>
                <span className="text-body-sm text-on-surface-variant">Jobs agendados diretamente no Postgres — status real da última execução.</span>
              </div>
              <ForcarSincronizacaoBotao />
            </div>
            <div className="space-y-2 pt-1">
              {status.cronJobs.map((job) => (
                <div key={job.jobid} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 rounded-lg bg-surface-container-low/60 text-body-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      name={job.ultimoStatus === "failed" ? "error" : job.ultimoStatus ? "check_circle" : "help"}
                      className={`text-body-lg shrink-0 ${job.ultimoStatus === "failed" ? "text-error" : job.ultimoStatus ? "text-secondary" : "text-outline"}`}
                    />
                    <span className="font-medium text-on-surface truncate">{ROTULO_JOB[job.nome] ?? job.nome}</span>
                  </div>
                  <div className="flex items-center gap-2 text-label-sm text-on-surface-variant shrink-0">
                    <span>{ROTULO_SCHEDULE[job.schedule] ?? job.schedule}</span>
                    <span>•</span>
                    <span>{job.ultimaExecucao ? relativo(job.ultimaExecucao) : "nunca executado"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resumo de usuários */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
              <h3 className="text-label-lg text-on-surface font-semibold">Usuários do Sistema</h3>
              <Icon name="group" className="text-outline" />
            </div>
            <div className="flex items-baseline gap-2 mt-4">
              <span className="text-4xl font-extrabold text-on-surface">{resumoUsuarios.total}</span>
              <span className="text-body-sm text-on-surface-variant">cadastrados</span>
            </div>
            <div className="mt-3 space-y-2">
              {resumoUsuarios.porPapel.map((p) => (
                <div key={p.papel} className="flex justify-between items-center text-body-sm">
                  <span className="text-on-surface-variant">{rotuloPapel(p.papel)}</span>
                  <span className="font-medium text-on-surface">{p.contagem}</span>
                </div>
              ))}
              <div className="flex justify-between items-center text-body-sm pt-2 border-t border-outline-variant/20">
                <span className="text-on-surface-variant">Ativos</span>
                <span className="font-medium text-secondary">{resumoUsuarios.ativos} de {resumoUsuarios.total}</span>
              </div>
            </div>
          </div>
          <Link
            href="/usuarios"
            className="mt-4 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-container transition-colors"
          >
            <Icon name="manage_accounts" className="text-body-lg" />
            Gerenciar Usuários
          </Link>
        </div>
      </div>

      {/* Histórico de sincronizações */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/30 pb-3">
          <div className="flex items-center gap-2">
            <Icon name="history" className="text-primary" />
            <h2 className="text-headline-sm text-on-surface">Histórico das Últimas Sincronizações</h2>
          </div>
          <Link href="/sincronizacao" className="text-primary text-label-md font-semibold hover:underline flex items-center gap-1">
            Ver histórico completo
            <Icon name="arrow_forward" className="text-body-md" />
          </Link>
        </div>
        <div className="space-y-3">
          {ultimasSincronizacoes.length === 0 && <p className="text-body-sm text-on-surface-variant">Nenhuma sincronização registrada ainda.</p>}
          {ultimasSincronizacoes.map((s) => {
            const sucesso = s.status === "concluida";
            const falha = s.status === "erro";
            return (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg bg-surface-container-low/60 border border-surface-container gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${sucesso ? "bg-[#EAF8F1] text-[#1E824C]" : falha ? "bg-error-container text-error" : "bg-surface-container text-primary"}`}>
                    <Icon name={sucesso ? "check_circle" : falha ? "error" : "sync"} className={`text-body-lg ${!sucesso && !falha ? "sync-spinning" : ""}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-on-surface text-body-md">{s.tipo === "manual" ? "Sincronização manual" : "Sincronização automática"}</span>
                      <span className="text-label-sm text-on-surface-variant">• {formatarDataHora(s.iniciadoEm)}</span>
                    </div>
                    <div className="text-body-sm text-on-surface-variant flex items-center gap-3 mt-0.5 flex-wrap">
                      <span>Disparada por: <strong>{s.usuario.nome}</strong></span>
                      <span>•</span>
                      <span>{s.processados} registro(s) processado(s)</span>
                    </div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-semibold self-end sm:self-center ${sucesso ? "bg-[#EAF8F1] text-[#1E824C]" : falha ? "bg-error-container text-error" : "bg-surface-container text-primary"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sucesso ? "bg-[#2FBF71]" : falha ? "bg-error" : "bg-primary"}`} />
                  {sucesso ? "Sucesso" : falha ? "Erro" : "Em andamento"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

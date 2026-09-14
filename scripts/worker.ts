// Processo de segundo plano (serviço `worker` no docker-compose) responsável pelo que o
// Postgres não pode fazer sozinho: geração de arquivos de relatório (requisitos 22-23). A
// sincronização periódica com o e-SUS continua no pg_cron (ver sql/05_sincronizacao_automatica.sql)
// — este worker só drena o trabalho que sobrou para o lado da aplicação.
// Imports relativos (não "@/...") de propósito: `tsx` não resolve o path alias `@/` do
// tsconfig.json — só o bundler do Next.js faz isso. Usar o alias aqui derrubava o worker em
// crash loop silencioso (MODULE_NOT_FOUND) desde sempre; nenhum relatório automático chegou a
// rodar até este fix (2026-09-13).
import { prisma } from "../src/lib/prisma";
import { gerarRelatorioDiario, gerarRelatorioSemanal, gerarAvaliacaoQuadrimestral } from "../src/lib/relatorios";

const INTERVALO_MS = 60_000;

async function jaGerado(tipo: "diario" | "semanal" | "quadrimestral", periodoReferencia: string) {
  const existente = await prisma.relatorioGerado.findFirst({ where: { tipo, periodoReferencia } });
  return existente !== null;
}

async function gerarRelatoriosAgendados() {
  const agora = new Date();
  if (agora.getHours() < 6) return; // só gera relatórios do dia a partir das 06h

  const periodoDiario = agora.toISOString().slice(0, 10);
  if (!(await jaGerado("diario", periodoDiario))) {
    await gerarRelatorioDiario(agora);
    console.log(`[worker] relatório diário ${periodoDiario} gerado.`);
  }

  if (agora.getDay() === 1) {
    const inicioSemana = new Date(agora);
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(fimSemana.getDate() + 7);
    const periodoSemanal = `${inicioSemana.toISOString().slice(0, 10)}_a_${fimSemana.toISOString().slice(0, 10)}`;
    if (!(await jaGerado("semanal", periodoSemanal))) {
      await gerarRelatorioSemanal(agora);
      console.log(`[worker] relatório semanal ${periodoSemanal} gerado.`);
    }
  }

  // requisito 23: avaliação no primeiro dia após o fim de cada quadrimestre (1/mai, 1/set, 1/jan).
  const mes = agora.getMonth() + 1;
  const dia = agora.getDate();
  const fechamentos: { mes: number; dia: number; quadrimestre: "Q1" | "Q2" | "Q3"; ano: number }[] = [
    { mes: 5, dia: 1, quadrimestre: "Q1", ano: agora.getFullYear() },
    { mes: 9, dia: 1, quadrimestre: "Q2", ano: agora.getFullYear() },
    { mes: 1, dia: 1, quadrimestre: "Q3", ano: agora.getFullYear() - 1 },
  ];
  const fechamento = fechamentos.find((f) => f.mes === mes && f.dia === dia);
  if (fechamento) {
    const periodo = `${fechamento.quadrimestre}-${fechamento.ano}`;
    if (!(await jaGerado("quadrimestral", periodo))) {
      await gerarAvaliacaoQuadrimestral(fechamento.quadrimestre, fechamento.ano);
      console.log(`[worker] avaliação quadrimestral ${periodo} gerada.`);
    }
  }
}

async function tick() {
  try {
    await gerarRelatoriosAgendados();
  } catch (erro) {
    console.error("[worker] erro no ciclo:", erro);
  }
}

console.log("[worker] iniciado — ciclo a cada", INTERVALO_MS / 1000, "s");
void tick();
setInterval(tick, INTERVALO_MS);

import { prisma } from "@/lib/prisma";

export type StatusCronJob = {
  jobid: number;
  nome: string;
  schedule: string;
  ativo: boolean;
  ultimoStatus: string | null;
  ultimaExecucao: Date | null;
  ultimaMensagem: string | null;
};

export type StatusServidor = {
  bancoLatenciaMs: number;
  esusFdwConectado: boolean;
  esusFdw: { host: string; porta: string; banco: string; usuario: string };
  memoriaProcessoMb: number;
  cronJobs: StatusCronJob[];
};

// requisito 4: painel de administração — só dados que dá pra medir de verdade a partir do
// container Node/Postgres. Nada de telemetria de host/SO inventada (RAM/disco "do servidor",
// versão do e-SUS, driver JDBC — este painel nem usa JDBC) nem números de exemplo do mockup.
// Checagem ao vivo do link FDW com o e-SUS — usada tanto na Administração quanto na tela de
// login (pré-autenticação, mas seguro: só consulta o próprio Postgres do painel).
export async function verificarConexaoEsus(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe(`SELECT 1 FROM esus.tb_equipe LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

export async function obterStatusServidor(): Promise<StatusServidor> {
  const inicio = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  const bancoLatenciaMs = Math.round(performance.now() - inicio);

  const esusFdwConectado = await verificarConexaoEsus();

  const cronJobs = await prisma.$queryRaw<
    { jobid: bigint; jobname: string; schedule: string; active: boolean; status: string | null; start_time: Date | null; return_message: string | null }[]
  >`
    SELECT j.jobid, j.jobname, j.schedule, j.active,
           r.status, r.start_time, r.return_message
    FROM cron.job j
    LEFT JOIN LATERAL (
      SELECT status, start_time, return_message
      FROM cron.job_run_details d
      WHERE d.jobid = j.jobid
      ORDER BY start_time DESC
      LIMIT 1
    ) r ON true
    ORDER BY j.jobid
  `;

  return {
    bancoLatenciaMs,
    esusFdwConectado,
    esusFdw: {
      host: process.env.ESUS_FDW_HOST ?? "—",
      porta: process.env.ESUS_FDW_PORT ?? "—",
      banco: process.env.ESUS_FDW_DBNAME ?? "—",
      usuario: process.env.ESUS_FDW_USER ?? "—",
    },
    memoriaProcessoMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    cronJobs: cronJobs.map((j) => ({
      jobid: Number(j.jobid),
      nome: j.jobname,
      schedule: j.schedule,
      ativo: j.active,
      ultimoStatus: j.status,
      ultimaExecucao: j.start_time,
      ultimaMensagem: j.return_message,
    })),
  };
}

export async function obterResumoUsuarios() {
  const [total, ativos, porPapel] = await Promise.all([
    prisma.usuario.count({ where: { id: { not: "00000000-0000-0000-0000-000000000001" } } }),
    prisma.usuario.count({ where: { id: { not: "00000000-0000-0000-0000-000000000001" }, ativo: true } }),
    prisma.usuario.groupBy({
      by: ["papel"],
      where: { id: { not: "00000000-0000-0000-0000-000000000001" } },
      _count: { _all: true },
    }),
  ]);

  return { total, ativos, porPapel: porPapel.map((p) => ({ papel: p.papel, contagem: p._count._all })) };
}

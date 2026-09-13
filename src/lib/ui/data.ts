// Formata um instante (campo `@db.Timestamptz`) no horário de Brasília. O container roda em
// UTC (`show timezone` do Postgres = Etc/UTC, sem TZ setado no processo Node) — sem passar
// `timeZone` explícito, `toLocaleString()` usa o timezone do container e mostra a hora 3h à
// frente da hora real de Brasília, mesmo com a data certa (bug real reportado pelo usuário em
// 2026-09-13, na tela de Sincronização). Não usar para campos `@db.Date` (só data, sem hora,
// ex. `dataCadastro`/`dataAtendimento`) — esses já são meia-noite UTC representando o dia
// calendário e forçar America/Sao_Paulo neles voltaria a data em 1 dia.
export function formatarDataHora(data: Date): string {
  return data.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Mesmo cuidado de formatarDataHora, mas só a data (dia) — para quando um campo `@db.Timestamptz`
// é exibido sem hora (ex.: "Atualizado em" na Central de Pendências, que usa `atualizado_em`).
// Também não usar em campos `@db.Date`, pelo mesmo motivo do comentário acima.
export function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

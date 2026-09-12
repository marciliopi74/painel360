# Integração com o e-SUS via postgres_fdw

## Status: schema confirmado contra uma instalação real (2026-09-12)

Testado contra um e-SUS AB PEC **9.6.13-4** real (Windows, serviço `e-SUS-AB-PostgreSQL`, porta
**5433**), conectando como o usuário somente-leitura `esus_leitura` (criado pelo próprio
instalador do e-SUS — ver `C:\Program Files\e-SUS\webserver\config\credenciais.txt` na máquina
onde o e-SUS está instalado). Isso confirmou 3 erros reais no SQL original (agora corrigidos em
`sql/02_fdw_esus.sql`/`sql/03_sync_functions.sql`) e permitiu implementar de verdade as etapas de
cadastros individuais/domiciliares que antes estavam como TODO:

1. **`tb_tipo_equipe` é referenciada por `tb_equipe.tp_equipe` via `co_seq_tipo_equipe`**, não
   `co_tipo_equipe` (coluna que não existe). Confirmado com um join real (57 tipos de equipe na
   base de teste, resolvendo corretamente ESF/ESB/EMULTI).
2. **`tb_cds_prof` não tem coluna de nome** — só `nu_cns`/`nu_ine`/`nu_cbo_2002`/`nu_cnes`. O nome
   do profissional vem de `tb_prof` (join por `nu_cns`), priorizando
   `no_social_profissional` sobre `no_civil_profissional` (nome social primeiro, como o e-SUS
   faz). `tb_prof` foi adicionada à lista de tabelas importadas em `sql/02_fdw_esus.sql`.
3. **A coluna de CBO em `tb_cds_prof` é `nu_cbo_2002`**, não `co_cbo`. Confirmado formato real
   `"515105"` para um ACS, batendo com o prefixo `'5151%'` já usado na detecção de ACS.

Cadastros individuais/domiciliares agora sincronizam de verdade:

- `tb_cds_cad_individual.nu_cns_cidadao` (CNS do cidadão) e `dt_cad_individual` (data) existem e
  vêm preenchidos; `co_cds_prof_cadastrante` (bigint) referencia `tb_cds_prof.co_seq_cds_prof`.
- `tb_cds_cad_domiciliar` não tem uma coluna única de "endereço" — é composto por
  `no_logradouro`, `nu_domicilio`, `ds_complemento`, `no_bairro`, concatenados em
  `sql/03_sync_functions.sql` para preencher `cadastros_domiciliares.endereco_referencia`.

## O que ainda pode variar entre instalações

O teste foi contra uma única instalação (versão 9.6.13-4, dataset pequeno/de teste —
`tb_fat_atendimento_individual` estava vazia nela, então a etapa de atendimentos não pôde ser
validada com dados reais, só a de equipes/profissionais/cadastros). Antes de rodar contra outro
município/instalação, vale reconferir pelo menos:

```sql
select * from information_schema.columns where table_schema = 'esus' and table_name = 'tb_prof';
select * from information_schema.columns where table_schema = 'esus' and table_name = 'tb_fat_atendimento_individual';
```

especialmente se a versão do e-SUS for muito diferente (customizações municipais podem remover
colunas como `no_civil_profissional`/`no_social_profissional`).

## atendimentos.profissional_id continua opcional

`tb_fat_atendimento_individual` resolve equipe e CBO (`co_dim_equipe_1`/`co_dim_cbo_1`) mas não
tem uma coluna direta de profissional individual — por isso `atendimentos.profissional_id`
continua opcional no schema, diferente do enunciado original do requisito 13. A tela de
Atendimentos só mostra "atendimentos por profissional" para lançamentos manuais.

## Ampliando a lista de tabelas importadas

Indicadores C2-C7/B1-B6/M1-M2 (ver `docs/indicadores-qualidade.md`) vão precisar consultar
diretamente as tabelas do data warehouse do e-SUS (`esus.tb_fat_*`/`esus.tb_dim_*`) já
importadas por `sql/02_fdw_esus.sql` — elas não são espelhadas localmente, só ficam acessíveis
via FDW para os `calcular_*` fazerem join em tempo de cálculo.

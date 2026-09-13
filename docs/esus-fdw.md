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

## Nome do cidadão (2026-09-13) e uma pegadinha real com `nu_cns_cidadao`

`tb_cds_cad_individual` já traz `no_cidadao`/`no_social_cidadao` diretamente na própria linha —
confirmado populado (nomes reais) contra a instalação real. Não precisa (e não dá certo) juntar
com `tb_cidadao` por CNS: nesta instalação, **100% dos `nu_cns_cidadao` reais sincronizados são
hashes de 32 caracteres hexadecimais**, não o CNS de 15 dígitos que `tb_cidadao.nu_cns` usa — um
join por igualdade de CNS não retorna nenhuma linha (testado: 15 de 15 sem match). Isso também
explica por que **100% dos cadastros individuais reais sincronizados hoje aparecem com
`tipo_erro = 'cns_invalido'`** no painel: a regra em `sql/06_deteccao_erros.sql` espera 15 dígitos
numéricos, e um hash não bate. Pode ser um comportamento real do e-SUS (CNS pendente de validação
CADSUS vira um identificador provisório) ou uma particularidade desta base de
teste/homologação — não dá pra saber sem comparar com uma segunda instalação. Enquanto isso não
for confirmado, tratar o indicador "cadastros com CNS inválido" no painel como potencialmente
superestimado nesta instalação.

## Resolvendo o CNS real a partir do hash de `nu_cns_cidadao` (2026-09-13)

O hash de 32 caracteres descrito acima não é joinável por igualdade de CNS, mas existe uma chave
exata (não uma heurística) para ligar um `tb_cds_cad_individual` ao `tb_cidadao` correspondente:
**`tb_cds_cad_individual.co_unico_ficha` == `tb_cidadao.co_unico_ultima_ficha`**. `co_unico_ficha`
é o GUID desta ficha específica; `co_unico_ultima_ficha` é o GUID da ficha mais recente que
atualizou aquele registro de cidadão — quando a última ficha a tocar o cidadão foi este próprio
cadastro individual, os dois batem exatamente. Confirmado 16/16 (100%) contra a instalação real,
inclusive resolvendo corretamente para NULL o único cidadão sem CNS ainda validado (em vez de um
match errado). `co_unico_ficha_origem` (ficha de origem, quando esta é uma versão/correção de outra)
é uma segunda tentativa razoável quando `co_unico_ficha` não bate.

Usado em `sql/03_sync_functions.sql` para popular `cadastros_individuais.cidadao_cns_real` durante
a sincronização (via `LEFT JOIN LATERAL` com `LIMIT 1`, para nunca duplicar a linha do cadastro
mesmo se os dois GUIDs batessem em pessoas diferentes). Esse é o único campo desta tabela seguro
para cruzar com `boas_praticas_pontuacao_pessoa.cidadao_cns`/`cidadaos_vinculados_equipe()` — nunca
o `cidadao_cns` (hash) puro. Quando `cidadao_cns_real` fica NULL, trate como "identidade não
resolvida", não como "sem dado" — pode ser um cidadão cujo cadastro não foi a última ficha a
atualizá-lo em `tb_cidadao` (ex.: uma visita domiciliar mais recente), não necessariamente ausência
de CNS real.

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

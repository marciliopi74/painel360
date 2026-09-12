# Motor de cálculo dos Indicadores de Qualidade — estado e próximos passos

## C1-C7: implementados a partir das Notas Metodológicas oficiais (2026-09-12)

Todas as 7 Notas Metodológicas (C1 "Mais Acesso", C2 desenvolvimento infantil, C3 gestação e
puerpério, C4 diabetes, C5 hipertensão, C6 pessoa idosa, C7 mulher/homem trans na prevenção do
câncer) foram obtidas em `saude.gov.br/saps` e lidas integralmente nesta sessão — documentos
assinados eletronicamente em jun/2026, revogando versões anteriores. Os códigos CBO, SIGTAP,
CID-10/CIAP-2, vacina e os pontos de cada critério em `sql/07_seed_indicadores.sql` e
`sql/08_indicadores_c2_c7.sql` vêm literalmente dessas notas — nada foi inventado.

**Correção importante feita durante esta implementação:** a versão anterior de `calcular_c1`
(escrita antes de ler a nota oficial) tinha o numerador invertido — contava demanda
*espontânea* quando a nota define o numerador como demanda *programada*. Também não filtrava
por CBO. Ambos corrigidos em `sql/04_indicadores_motor_calculo.sql`.

### O que foi validado de verdade

- Todas as tabelas do data warehouse do e-SUS necessárias (`tb_fat_atd_ind_problemas`,
  `tb_fat_atd_ind_procedimentos`, `tb_fat_vacinacao`/`tb_fat_vacinacao_vacina`,
  `tb_fat_visita_domiciliar`, `tb_fat_atendimento_odonto`, `tb_dim_tempo`,
  `tb_cidadao_vinculacao_equipe`, `tb_dim_sexo`, `tb_dim_identidade_genero`) foram confirmadas
  **existentes com o schema esperado** contra uma instalação real de e-SUS AB PEC 9.6.13-4.
- `tb_dim_tipo_atendimento` tem uma estrutura hierárquica (pai/filho) confirmada: os 5 valores
  reais usados pelo C1 são `'Consulta agendada programada / Cuidado continuado'` e
  `'Consulta agendada'` (programada), `'Escuta inicial / Orientação'`, `'Consulta no dia'` e
  `'Atendimento de urgência'` (espontânea) — outros valores (`'Atendimento programado'` genérico,
  `'Visita domiciliar pós-óbito'` etc.) ficam de fora do cálculo, como a nota exige.
- `tb_cidadao.no_sexo`/`tp_identidade_genero` são texto direto (`'FEMININO'`/`'Homem transgênero'`),
  sem precisar de join com `tb_dim_*` — confirmado.

### O que NÃO pôde ser validado (fact tables vazias na instalação de teste)

A instalação real usada para verificar nomes de tabela/coluna tinha `0` linhas em todas as
tabelas de fato clínicas (`tb_fat_atd_ind_problemas`, `tb_fat_atd_ind_procedimentos`,
`tb_fat_vacinacao`, `tb_fat_visita_domiciliar`, `tb_fat_atendimento_odonto`) — parece ser uma
base de teste/homologação, não produção real. Isso significa que **o SQL de
`sql/08_indicadores_c2_c7.sql` foi revisado estaticamente (tipos, nomes de coluna, balanceamento
de sintaxe) mas nunca executado contra dados reais** — diferente de C1/sincronização, que
tiveram um dry-run real. Antes de confiar nos números de C2-C7 em produção, rode
`recalcular_indicadores_qualidade` contra dados reais e sancheque a distribuição de resultados
(um valor travado em 0 ou 100 para todas as equipes é sinal de bug, não de metodologia — mesma
lição documentada em `esus_sync_integration`).

### Simplificações de escopo conscientes (ver cabeçalho de `sql/08_indicadores_c2_c7.sql`)

1. Só as fontes de registro mais comuns de cada nota foram implementadas (Atendimento
   Individual, Procedimentos, Visita Domiciliar, Vacinação) — a fonte "Atividade Coletiva"
   (MIAC), citada como alternativa em várias boas práticas, não foi implementada.
2. Os "códigos rápidos" ABP/ABEX (via alternativa de registro mais rápida que o código SIGTAP
   completo) não foram implementados — dependem de um campo/tabela não localizado nesta sessão.
3. C3 (gestação/puerpério): em vez de calcular a janela exata de 294 dias de gestação / 42 dias
   de puerpério a partir da Data de Última Menstruação (que exigiria `tb_pre_natal`/
   `tb_fat_rel_op_gestante`, não explorados nesta sessão), uma pessoa é considerada
   gestante/puérpera enquanto sua condição CID-10/CIAP-2 correspondente estiver marcada como
   "ativa" no e-SUS.
4. C2 boa prática (E) (esquema vacinal): conta doses por família de vacina sem validar o
   intervalo mínimo de 30 dias entre doses nem excluir doses de SCR antes dos 12 meses de vida.
5. eSF tipo 70 vs. eAP tipo 76 continuam indistinguíveis no schema atual — todas as equipes
   `ESF`/`EAP` entram no cálculo (gap já documentado desde a primeira versão de C1).

## B1-B6 (eSB): implementados a partir das Notas Metodológicas oficiais (2026-09-12)

O usuário forneceu localmente os 6 PDFs oficiais (B1 Primeira consulta programada, B2
Tratamento concluído, B3 Taxa de exodontia, B4 Escovação supervisionada, B5 Procedimentos
preventivos, B6 Tratamento Restaurador Atraumático), assinados eletronicamente em 12-13/05/2026.
Implementados em `sql/09_indicadores_b1_b6.sql`, com bandas reais em `sql/07_seed_indicadores.sql`.

**Particularidades reais descobertas nestas notas** (ver cabeçalho de `sql/09_indicadores_b1_b6.sql`):
- **B1 e B4 são razões brutas**, não percentuais 0-100 — o numerador conta pessoas atendidas
  independente de vinculação à eSF/eAP, mas o denominador só conta vinculadas, então a razão
  pode legitimamente passar de 1,0 (ex.: banda "Ótimo: > 1,25"). Precisou de uma variante nova,
  `upsert_resultado_indicador_razao`, que não multiplica por 100.
- **B3 e B5 têm "Regular" nas duas pontas** (ex. B3: Regular se <3 OU ≥14), apesar de a nota
  rotular a polaridade como "menor-melhor"/"maior-melhor" — tratadas como `neutra` no catálogo
  para classificar corretamente (mesmo padrão de C1).
- **Regra de vinculação eSB↔eSF/eAP por carga horária** (ex.: 2 eSB de 20h dividem a população
  de 1 eSF de 40h) exige saber a carga horária da eSB — campo novo
  `equipes.carga_horaria_semanal`, que **não vem do e-SUS** e precisa ser preenchido manualmente
  pelo coordenador (junto com `equipe_referencia_id`) — ainda sem tela própria (mesmo gap já
  documentado para `equipe_referencia_id` isoladamente).
- Corrigido de quebra: `tb_dim_tempo` era usado por `datas_visitas_domiciliares` (C2-C7) mas
  nunca tinha sido importado em `sql/02_fdw_esus.sql` — bug real encontrado ao revisar a lista de
  tabelas para B4 (que também precisa de `tb_dim_tempo`). `tb_fat_atividade_coletiva` também foi
  adicionada (necessária para o filtro de "prática em saúde" de B4).
- **Não validado contra dados reais** — mesma ressalva de C2-C7: a instalação de teste usada
  para confirmar `tb_fat_atendimento_odonto`/`tb_fat_atend_odonto_proced`/
  `tb_fat_atvdd_coletiva_part`/`tb_fat_atividade_coletiva` tem 0 linhas nessas tabelas.

## M1-M2 (eMulti): implementados a partir das Notas Metodológicas oficiais (2026-09-12)

PDFs fornecidos localmente pelo usuário (Notas Técnicas nº 43 e 44/2026-CGIAD, assinadas
eletronicamente em 10-12/06/2026). Implementados em `sql/10_indicadores_m1_m2.sql`, bandas reais
em `sql/07_seed_indicadores.sql`.

- **M1** (média de atendimentos por pessoa): implementação fiel — numerador (atendimentos
  individuais + participações em atividade coletiva da eMulti) e denominador (pessoas distintas
  atendidas) batem 1:1 com a nota. É razão bruta (média), não percentual — usa
  `upsert_resultado_indicador_razao`.
- **M2** (ações interprofissionais): **parcialmente implementado** — mesma limitação já
  registrada na versão anterior deste projeto (Supabase): detectar "ação compartilhada" exige um
  campo de profissional *secundário* por ação. Isso existe em `tb_fat_atendimento_individual`
  (`co_dim_profissional_2`/`co_dim_cbo_2`, confirmado contra o e-SUS real) mas **não existe** em
  `tb_fat_atvdd_coletiva_part`/`tb_fat_atividade_coletiva` (só um profissional por registro) —
  não há como saber, só com essas tabelas, se uma atividade coletiva foi conduzida por 2+
  profissionais simultaneamente. Por isso o numerador só conta atendimentos individuais
  compartilhados + Módulo Compartilhamento do Cuidado do PEC (`tb_fat_cuidado_compartilhado`,
  que por definição já é uma ação compartilhada); atividades coletivas compartilhadas ficam de
  fora do numerador, mas entram no denominador — então o indicador tende a **subestimar** o
  percentual real. Corrigir exigiria encontrar (se existir) uma tabela de profissionais
  participantes por atividade coletiva além da tabela de cidadãos participantes já usada.
- A nota M2 rotula "Polaridade: Neutra" mas as bandas não têm teto superior (só "Ótimo: > 5"),
  então funciona como `maior_melhor` de fato — sem a inconsistência de classificação que existe
  em C1/B3/B5 (onde valores altos demais também viram "Regular").

## eAP tipo 76 vs. eAP genérica

Ver item 5 da lista de simplificações acima — sem coluna própria para distinguir, todas as
equipes `EAP` recebem o mesmo tratamento.

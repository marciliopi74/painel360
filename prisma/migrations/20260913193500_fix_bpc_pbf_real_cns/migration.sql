-- AlterTable
-- beneficiario_bpc_pbf estava chaveado por cadastros_individuais.cidadao_cns, que nesta
-- instalação é um hash não joinável com o CNS real usado pelo restante do cálculo de Vínculo e
-- Acompanhamento (ver comentário em CadastroIndividual/BeneficiarioVulneravel no schema.prisma).
-- Removida antes de qualquer uso em produção.
ALTER TABLE "cadastros_individuais" DROP COLUMN "beneficiario_bpc_pbf";

-- CreateTable
CREATE TABLE "beneficiarios_vulneraveis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cidadao_cns" TEXT NOT NULL,
    "cidadao_nome" TEXT,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficiarios_vulneraveis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "beneficiarios_vulneraveis_cidadao_cns_key" ON "beneficiarios_vulneraveis"("cidadao_cns");

-- AlterTable
ALTER TABLE "cadastros_individuais" ALTER COLUMN "cidadao_cns" DROP NOT NULL;
ALTER TABLE "cadastros_individuais" ADD COLUMN     "cidadao_cpf" TEXT;

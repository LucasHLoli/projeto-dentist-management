-- AlterTable
ALTER TABLE "Insumo" ADD COLUMN "unidadeUso" TEXT;

-- AlterTable
ALTER TABLE "Lote" ADD COLUMN "fatorConversao" REAL;
ALTER TABLE "Lote" ADD COLUMN "quantidadeCompra" REAL;
ALTER TABLE "Lote" ADD COLUMN "unidadeCompra" TEXT;

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cnpj" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NFeImport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chaveAcesso" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "dataEmissao" DATETIME NOT NULL,
    "valorTotal" REAL NOT NULL,
    "xmlPath" TEXT,
    "fornecedorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NFeImport_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Insumo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "unidadeMedida" TEXT NOT NULL DEFAULT 'UN',
    "fotoUrl" TEXT,
    "usosMin" REAL NOT NULL DEFAULT 1,
    "usosMax" REAL NOT NULL DEFAULT 1,
    "grupoCategoria" TEXT,
    "estoqueMinimo" REAL NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "insumoId" INTEGER NOT NULL,
    "nfeImportId" INTEGER,
    "fornecedorId" INTEGER,
    "codigoLote" TEXT,
    "quantidade" REAL NOT NULL,
    "quantidadeAtual" REAL NOT NULL,
    "custoUnitario" REAL,
    "validade" DATETIME,
    "validadeConfirmada" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "fotoNotaUrl" TEXT,
    "aiMatchConfianca" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lote_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lote_nfeImportId_fkey" FOREIGN KEY ("nfeImportId") REFERENCES "NFeImport" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lote_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContagemEstoque" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,
    "criadoPor" TEXT
);

-- CreateTable
CREATE TABLE "ContagemItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contagemId" INTEGER NOT NULL,
    "loteId" INTEGER NOT NULL,
    "quantidadeContada" REAL NOT NULL,
    "validade" DATETIME,
    "observacoes" TEXT,
    CONSTRAINT "ContagemItem_contagemId_fkey" FOREIGN KEY ("contagemId") REFERENCES "ContagemEstoque" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContagemItem_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcedimentoInsumo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "procedimentoId" TEXT NOT NULL,
    "insumoId" INTEGER NOT NULL,
    "quantidadePorUso" REAL NOT NULL DEFAULT 1,
    "observacoes" TEXT,
    "fonte" TEXT NOT NULL DEFAULT 'MANUAL',
    CONSTRAINT "ProcedimentoInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConsumoInsumo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "atendimentoId" TEXT NOT NULL,
    "insumoId" INTEGER NOT NULL,
    "loteId" INTEGER,
    "quantidade" REAL NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsumoInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConsumoInsumo_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_cnpj_key" ON "Fornecedor"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "NFeImport_chaveAcesso_key" ON "NFeImport"("chaveAcesso");

-- CreateIndex
CREATE UNIQUE INDEX "ProcedimentoInsumo_procedimentoId_insumoId_key" ON "ProcedimentoInsumo"("procedimentoId", "insumoId");

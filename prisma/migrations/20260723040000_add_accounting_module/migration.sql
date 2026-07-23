-- CreateEnum
CREATE TYPE "AccContactType" AS ENUM ('CUSTOMER', 'VENDOR', 'BOTH');

-- CreateEnum
CREATE TYPE "AccDocType" AS ENUM ('QUOTATION', 'INVOICE', 'RECEIPT', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccDocStatus" AS ENUM ('DRAFT', 'AWAITING_PAYMENT', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "AccContact" (
    "id" TEXT NOT NULL,
    "type" "AccContactType" NOT NULL DEFAULT 'CUSTOMER',
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "branch" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccDocument" (
    "id" TEXT NOT NULL,
    "docType" "AccDocType" NOT NULL,
    "docNumber" TEXT NOT NULL,
    "status" "AccDocStatus" NOT NULL DEFAULT 'DRAFT',
    "contactId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 7,
    "vatAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "whtRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "whtAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "note" TEXT,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "refDocId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccDocumentItem" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "AccDocumentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccDocCounter" (
    "id" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AccDocCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccDocument_docNumber_key" ON "AccDocument"("docNumber");

-- AddForeignKey
ALTER TABLE "AccDocument" ADD CONSTRAINT "AccDocument_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "AccContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccDocumentItem" ADD CONSTRAINT "AccDocumentItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AccDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

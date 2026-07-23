-- CreateTable
CREATE TABLE "AccAttachment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccAttachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AccAttachment" ADD CONSTRAINT "AccAttachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AccDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

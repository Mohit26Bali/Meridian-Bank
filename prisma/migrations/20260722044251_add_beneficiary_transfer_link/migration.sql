-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "receiverBeneficiaryId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_receiverBeneficiaryId_idx" ON "transactions"("receiverBeneficiaryId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receiverBeneficiaryId_fkey" FOREIGN KEY ("receiverBeneficiaryId") REFERENCES "beneficiaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

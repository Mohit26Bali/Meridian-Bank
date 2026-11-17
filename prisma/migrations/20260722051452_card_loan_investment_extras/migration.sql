-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'CARD_PIN_CHANGE';

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "pinHash" TEXT;

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "paidInstallments" INTEGER NOT NULL DEFAULT 0;

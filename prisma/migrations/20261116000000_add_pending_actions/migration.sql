-- CreateEnum
CREATE TYPE "PendingActionType" AS ENUM ('TRANSFER', 'PIN_CHANGE');

-- CreateTable
CREATE TABLE "pending_actions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PendingActionType" NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_actions_userId_type_idx" ON "pending_actions"("userId", "type");

-- AddForeignKey
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

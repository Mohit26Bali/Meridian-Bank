import "server-only";
import { Prisma, type AccountType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { generateAccountNumber, generateIfsc } from "./identifiers";

const MAX_ATTEMPTS = 5;

async function createAccountWithUniqueNumber(userId: string, accountType: AccountType) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.account.create({
        data: {
          userId,
          accountNumber: generateAccountNumber(),
          ifsc: generateIfsc(),
          accountType,
        },
      });
    } catch (error) {
      const isCollision =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";
      if (!isCollision || attempt === MAX_ATTEMPTS - 1) throw error;
    }
  }
  throw new Error("Failed to allocate a unique account number");
}

/** Opens the standard starter accounts for a newly verified customer. */
export async function provisionDefaultAccounts(userId: string) {
  const [checking, savings] = await Promise.all([
    createAccountWithUniqueNumber(userId, "CURRENT"),
    createAccountWithUniqueNumber(userId, "SAVINGS"),
  ]);
  return { checking, savings };
}

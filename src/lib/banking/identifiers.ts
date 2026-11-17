import "server-only";
import { randomInt } from "crypto";

const BRANCH_CODE = "0001";
const BANK_IFSC_PREFIX = "MRDN";

/** 12-digit numeric account number. Uniqueness is enforced by the caller via retry-on-conflict. */
export function generateAccountNumber() {
  let number = "";
  for (let i = 0; i < 12; i++) {
    number += randomInt(0, 10).toString();
  }
  return number;
}

export function generateIfsc() {
  return `${BANK_IFSC_PREFIX}0${BRANCH_CODE}`;
}

const TYPE_PREFIX: Record<string, string> = {
  DEPOSIT: "DEP",
  WITHDRAWAL: "WDL",
  TRANSFER: "TRF",
  BILL_PAYMENT: "BIL",
  INTEREST: "INT",
  REFUND: "REF",
  CHARGE: "CHG",
};

export function generateReferenceNumber(type: keyof typeof TYPE_PREFIX) {
  const prefix = TYPE_PREFIX[type] ?? "TXN";
  const datePart = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const randomPart = randomInt(0, 1_000_000).toString().padStart(6, "0");
  return `${prefix}-${datePart}-${randomPart}`;
}

const MOCK_CARD_BIN = "450123"; // clearly fictitious mock BIN, not a real issuer range

function luhnCheckDigit(digits: string) {
  let sum = 0;
  let shouldDouble = true; // rightmost of the existing digits doubles first
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return (10 - (sum % 10)) % 10;
}

/** 16-digit mock PAN with a valid Luhn checksum, on a clearly fictitious BIN. */
export function generateCardNumber() {
  let body = MOCK_CARD_BIN;
  for (let i = 0; i < 9; i++) {
    body += randomInt(0, 10).toString();
  }
  return `${body}${luhnCheckDigit(body)}`;
}

export function generateCvv() {
  return randomInt(0, 1000).toString().padStart(3, "0");
}

export function generateCardExpiry() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() + 4 };
}

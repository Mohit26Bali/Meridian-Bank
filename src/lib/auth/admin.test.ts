import { describe, it, expect } from "vitest";
import { isStaffRole, canManageUsers, canManageRoles, canViewAuditLogs } from "./admin";
import type { UserRole } from "@prisma/client";

const ALL_ROLES: UserRole[] = ["CUSTOMER", "SUPPORT_AGENT", "AUDITOR", "ADMIN", "SUPER_ADMIN"];

describe("isStaffRole", () => {
  it("treats CUSTOMER as the only non-staff role", () => {
    expect(isStaffRole("CUSTOMER")).toBe(false);
    for (const role of ALL_ROLES.filter((r) => r !== "CUSTOMER")) {
      expect(isStaffRole(role)).toBe(true);
    }
  });
});

describe("canManageUsers", () => {
  it("only allows ADMIN and SUPER_ADMIN", () => {
    expect(canManageUsers("ADMIN")).toBe(true);
    expect(canManageUsers("SUPER_ADMIN")).toBe(true);
    expect(canManageUsers("SUPPORT_AGENT")).toBe(false);
    expect(canManageUsers("AUDITOR")).toBe(false);
    expect(canManageUsers("CUSTOMER")).toBe(false);
  });
});

describe("canManageRoles", () => {
  it("only allows SUPER_ADMIN", () => {
    expect(canManageRoles("SUPER_ADMIN")).toBe(true);
    for (const role of ALL_ROLES.filter((r) => r !== "SUPER_ADMIN")) {
      expect(canManageRoles(role)).toBe(false);
    }
  });
});

describe("canViewAuditLogs", () => {
  it("allows AUDITOR, ADMIN, and SUPER_ADMIN only", () => {
    expect(canViewAuditLogs("AUDITOR")).toBe(true);
    expect(canViewAuditLogs("ADMIN")).toBe(true);
    expect(canViewAuditLogs("SUPER_ADMIN")).toBe(true);
    expect(canViewAuditLogs("SUPPORT_AGENT")).toBe(false);
    expect(canViewAuditLogs("CUSTOMER")).toBe(false);
  });
});

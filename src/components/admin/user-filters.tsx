"use client";

import { useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLE_OPTIONS = [
  { value: "CUSTOMER", label: "Customer" },
  { value: "SUPPORT_AGENT", label: "Support Agent" },
  { value: "AUDITOR", label: "Auditor" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

const STATUS_OPTIONS = [
  { value: "PENDING_VERIFICATION", label: "Pending Verification" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "LOCKED", label: "Locked" },
  { value: "CLOSED", label: "Closed" },
];

export function UserFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="text-foreground-muted absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search by name, email, or phone"
          defaultValue={searchParams.get("search") ?? ""}
          className="pl-8"
          onChange={(e) => setParam("search", e.target.value || null)}
        />
      </div>

      <Select
        defaultValue={searchParams.get("role") ?? "all"}
        onValueChange={(v) => setParam("role", v)}
      >
        <SelectTrigger className="w-[160px]" aria-label="Filter by role">
          <SelectValue placeholder="All roles" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All roles</SelectItem>
          {ROLE_OPTIONS.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("status") ?? "all"}
        onValueChange={(v) => setParam("status", v)}
      >
        <SelectTrigger className="w-[170px]" aria-label="Filter by status">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

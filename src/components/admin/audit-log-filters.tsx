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

export function AuditLogFilters({
  actions,
  entityTypes,
}: {
  actions: string[];
  entityTypes: string[];
}) {
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
          placeholder="Search by staff or user name/email"
          defaultValue={searchParams.get("search") ?? ""}
          className="pl-8"
          onChange={(e) => setParam("search", e.target.value || null)}
        />
      </div>

      <Select
        defaultValue={searchParams.get("action") ?? "all"}
        onValueChange={(v) => setParam("action", v)}
      >
        <SelectTrigger className="w-[200px]" aria-label="Filter by action">
          <SelectValue placeholder="All actions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All actions</SelectItem>
          {actions.map((a) => (
            <SelectItem key={a} value={a}>
              {a.toLowerCase().replaceAll("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("entityType") ?? "all"}
        onValueChange={(v) => setParam("entityType", v)}
      >
        <SelectTrigger className="w-[160px]" aria-label="Filter by entity type">
          <SelectValue placeholder="All entities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All entities</SelectItem>
          {entityTypes.map((e) => (
            <SelectItem key={e} value={e}>
              {e}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

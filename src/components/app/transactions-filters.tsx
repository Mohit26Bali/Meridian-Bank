"use client";

import { useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Download, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TRANSACTION_TYPE_LABEL,
  TRANSACTION_STATUS_LABEL,
} from "@/lib/banking/format";

interface TransactionsFiltersProps {
  accounts: { id: string; label: string }[];
}

export function TransactionsFilters({ accounts }: TransactionsFiltersProps) {
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

  const exportHref = `/api/transactions/export?${searchParams.toString()}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="text-foreground-muted absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search by reference or description"
          defaultValue={searchParams.get("search") ?? ""}
          className="pl-8"
          onChange={(e) => {
            const value = e.target.value;
            setParam("search", value || null);
          }}
        />
      </div>

      <Select
        defaultValue={searchParams.get("accountId") ?? "all"}
        onValueChange={(v) => setParam("accountId", v)}
      >
        <SelectTrigger className="w-[160px]" aria-label="Filter by account">
          <SelectValue placeholder="All accounts" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All accounts</SelectItem>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("type") ?? "all"}
        onValueChange={(v) => setParam("type", v)}
      >
        <SelectTrigger className="w-[150px]" aria-label="Filter by transaction type">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {Object.entries(TRANSACTION_TYPE_LABEL).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("status") ?? "all"}
        onValueChange={(v) => setParam("status", v)}
      >
        <SelectTrigger className="w-[150px]" aria-label="Filter by status">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {Object.entries(TRANSACTION_STATUS_LABEL).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button asChild variant="outline">
        <a href={exportHref} download>
          <Download className="size-4" />
          Export CSV
        </a>
      </Button>
    </div>
  );
}

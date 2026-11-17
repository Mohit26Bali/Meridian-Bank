"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateUserRoleAction } from "@/actions/admin/users";
import type { UserRole } from "@prisma/client";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "CUSTOMER", label: "Customer" },
  { value: "SUPPORT_AGENT", label: "Support Agent" },
  { value: "AUDITOR", label: "Auditor" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
];

export function UserRoleSelect({ userId, role }: { userId: string; role: UserRole }) {
  const router = useRouter();
  const [value, setValue] = useState(role);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(next: string) {
    const previous = value;
    setValue(next as UserRole);
    setError(null);
    startTransition(async () => {
      const result = await updateUserRoleAction({ userId, role: next as UserRole });
      if (!result.success) {
        setError(result.error);
        setValue(previous);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onChange} disabled={isPending}>
        <SelectTrigger className="w-[200px]" aria-label="Change user role">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <SelectValue />}
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

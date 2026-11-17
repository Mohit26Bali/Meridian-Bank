"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOAN_TERMS, calculateEmi } from "@/lib/banking/loans";
import { formatCurrency } from "@/lib/banking/format";

const LOAN_TYPE_LABEL: Record<string, string> = {
  PERSONAL: "Personal",
  HOME: "Home",
  AUTO: "Auto",
  EDUCATION: "Education",
  BUSINESS: "Business",
};

export function EmiCalculator() {
  const [type, setType] = useState("PERSONAL");
  const [principal, setPrincipal] = useState(10_000);
  const [termMonths, setTermMonths] = useState(24);

  const terms = LOAN_TERMS[type];

  const { emi, totalPayment, totalInterest } = useMemo(() => {
    const monthlyEmi = calculateEmi(principal, terms.aprPercent, termMonths);
    const total = monthlyEmi * termMonths;
    return { emi: monthlyEmi, totalPayment: total, totalInterest: total - principal };
  }, [principal, termMonths, terms.aprPercent]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <Label>Loan type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(LOAN_TERMS).map((key) => (
                <SelectItem key={key} value={key}>
                  {LOAN_TYPE_LABEL[key]} &bull; {LOAN_TERMS[key].aprPercent}% APR
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="emi-principal">Loan amount</Label>
          <Input
            id="emi-principal"
            type="number"
            className="mt-1.5"
            min={terms.minPrincipal}
            max={terms.maxPrincipal}
            value={principal}
            onChange={(e) => setPrincipal(Number(e.target.value) || 0)}
          />
          <p className="text-foreground-muted mt-1 text-xs">
            {formatCurrency(terms.minPrincipal)} – {formatCurrency(terms.maxPrincipal)}
          </p>
        </div>

        <div>
          <Label htmlFor="emi-term">Term (months)</Label>
          <Input
            id="emi-term"
            type="number"
            className="mt-1.5"
            min={terms.minTermMonths}
            max={terms.maxTermMonths}
            value={termMonths}
            onChange={(e) => setTermMonths(Number(e.target.value) || 0)}
          />
          <p className="text-foreground-muted mt-1 text-xs">
            {terms.minTermMonths} – {terms.maxTermMonths} months
          </p>
        </div>
      </div>

      <div className="bg-muted flex flex-col justify-center gap-4 rounded-xl p-6">
        <div>
          <p className="text-foreground-secondary text-xs">Monthly EMI</p>
          <p className="text-3xl font-semibold tracking-tight">
            {formatCurrency(Number.isFinite(emi) ? emi : 0)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-foreground-secondary text-xs">Total interest</p>
            <p className="font-medium">
              {formatCurrency(Number.isFinite(totalInterest) ? totalInterest : 0)}
            </p>
          </div>
          <div>
            <p className="text-foreground-secondary text-xs">Total payment</p>
            <p className="font-medium">
              {formatCurrency(Number.isFinite(totalPayment) ? totalPayment : 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

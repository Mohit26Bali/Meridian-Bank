"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { kycSubmissionSchema, type KycSubmissionInput } from "@/lib/validations/kyc";
import { submitKycAction } from "@/actions/kyc";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const DOCUMENT_FIELDS = [
  { name: "panDocument" as const, label: "PAN card photo" },
  { name: "aadhaarDocument" as const, label: "Aadhaar card photo" },
  { name: "selfie" as const, label: "Selfie" },
  { name: "addressProof" as const, label: "Address proof" },
];

export function KycDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<KycSubmissionInput>({
    resolver: zodResolver(kycSubmissionSchema),
    defaultValues: {
      pan: "",
      aadhaar: "",
      panDocument: "",
      aadhaarDocument: "",
      selfie: "",
      addressProof: "",
    },
  });

  function onSubmit(values: KycSubmissionInput) {
    setError(null);
    startTransition(async () => {
      const result = await submitKycAction(values);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset();
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <ShieldCheck />
          Complete verification
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Identity verification</DialogTitle>
          <DialogDescription>
            Submit your PAN and Aadhaar details along with photos. This demo
            simulates OCR extraction — a reviewer approves or rejects it
            afterward.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="pan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PAN number</FormLabel>
                  <FormControl>
                    <Input placeholder="ABCDE1234F" className="uppercase" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="aadhaar"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aadhaar number</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" placeholder="123412341234" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {DOCUMENT_FIELDS.map((doc) => (
              <FormField
                key={doc.name}
                control={form.control}
                name={doc.name}
                render={({ field: { onChange, value, ...field } }) => (
                  <FormItem>
                    <FormLabel>{doc.label}</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const dataUrl = await fileToDataUrl(file);
                            onChange(dataUrl);
                          }}
                          {...field}
                          value={undefined}
                        />
                        {value ? <Upload className="text-success size-4 shrink-0" /> : null}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <DialogFooter>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="animate-spin" />}
                Submit for review
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

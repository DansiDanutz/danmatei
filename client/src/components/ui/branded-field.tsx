import { type ReactNode } from "react";
import { Label } from "@/components/ui/label";

export interface BrandedFieldProps {
  label: ReactNode;
  htmlFor?: string;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
}

export function BrandedField({ label, htmlFor, error, hint, required, children }: BrandedFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="font-heading text-[11px] uppercase tracking-[0.18em] text-white/70">
        {label}
        {required && <span className="ml-1 text-rose-300">*</span>}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-white/45">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-rose-300">{error}</p>
      )}
    </div>
  );
}

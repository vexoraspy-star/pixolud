"use client";
import { useFormStatus } from "react-dom";
export default function ResendEmailButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending} aria-label={label} className="bg-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">{pending ? "…" : label}</button>;
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none select-none",
  {
    variants: {
      variant: {
        primary: "bg-pandan text-on-brand hover:brightness-95",
        secondary: "bg-surface text-ink border border-line hover:bg-paper",
        ghost: "text-ink-soft hover:bg-line/60 hover:text-ink",
        danger: "bg-chili text-white hover:brightness-95",
        amber: "bg-teh text-white hover:brightness-95",
        dark: "bg-ink text-on-ink hover:bg-ink-soft",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        xl: "h-14 px-6 text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

const fieldBase =
  "w-full rounded-lg border border-line bg-surface px-3 text-ink placeholder:text-mute focus:border-pandan focus:outline-none focus:ring-2 focus:ring-pandan/20";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "py-2 min-h-20", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, "h-10 pr-8", className)} {...props} />;
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-mute">{hint}</span> : null}
    </label>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-surface", className)} {...props} />;
}

const badgeTone = {
  neutral: "bg-line/70 text-ink-soft",
  green: "bg-pandan-soft text-pandan-dark",
  amber: "bg-teh-soft text-teh",
  red: "bg-chili-soft text-chili",
  dark: "bg-ink text-on-ink",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold", badgeTone[tone], className)}
      {...props}
    />
  );
}

export function PageHeader({ title, actions, sub }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {sub ? <p className="mt-1 text-sm text-ink-soft">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children ? <div className="mt-2 text-sm text-ink-soft">{children}</div> : null}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg bg-chili-soft px-3 py-2 text-sm text-chili">{message}</p>;
}

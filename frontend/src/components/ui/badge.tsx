import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-slate-800 text-slate-200",
        seen:
          "border-sky-500/40 bg-sky-950/60 text-sky-300 font-mono",
        said:
          "border-orange-500/40 bg-orange-950/60 text-orange-300 font-mono",
        why:
          "border-emerald-500/50 bg-emerald-950/70 text-emerald-300 shadow-[0_0_8px_rgba(34,197,94,0.2)] font-mono",
        missed:
          "border-red-500/40 bg-red-950/60 text-red-300 font-mono",
        info:
          "border-slate-700 bg-slate-900/80 text-slate-300 font-mono",
        outline:
          "border-[#262c3c] text-slate-400 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-slate-100 text-slate-800",
        seen:
          "border-sky-300 bg-sky-50 text-sky-700 font-mono",
        said:
          "border-orange-300 bg-orange-50 text-orange-700 font-mono",
        why:
          "border-emerald-300 bg-emerald-50 text-emerald-700 font-mono",
        missed:
          "border-red-300 bg-red-50 text-red-700 font-mono",
        info:
          "border-slate-200 bg-slate-50 text-slate-600 font-mono",
        outline:
          "border-slate-200 text-slate-500 bg-transparent",
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

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-slate-900 text-white shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all",
        why:
          "bg-slate-900 text-white font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all",
        seen:
          "bg-sky-600 text-white shadow-sm hover:bg-sky-500 active:scale-[0.98]",
        said:
          "bg-orange-600 text-white shadow-sm hover:bg-orange-500 active:scale-[0.98]",
        secondary:
          "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 hover:text-slate-900",
        outline:
          "border border-slate-200 bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900",
        ghost:
          "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
        destructive:
          "bg-red-600 text-white hover:bg-red-500 shadow-sm",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-xl px-6 text-base font-semibold",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };

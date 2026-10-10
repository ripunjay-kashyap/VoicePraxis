import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 active:scale-[0.98] transition-all",
        why:
          "bg-emerald-500 text-black font-semibold shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:bg-emerald-400 active:scale-[0.98] transition-all",
        seen:
          "bg-sky-600/90 text-white shadow-sm hover:bg-sky-500 active:scale-[0.98]",
        said:
          "bg-orange-600/90 text-white shadow-sm hover:bg-orange-500 active:scale-[0.98]",
        secondary:
          "bg-[#1a202c] text-slate-200 border border-[#2d3748] hover:bg-[#242c3d] hover:text-white",
        outline:
          "border border-[#232734] bg-transparent text-slate-300 hover:bg-[#161a24] hover:text-white",
        ghost:
          "text-slate-400 hover:bg-[#1a1f2c] hover:text-slate-200",
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

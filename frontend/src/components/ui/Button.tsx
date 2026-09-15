import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "clarity-focus inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap font-semibold outline-none transition-all duration-200 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "rounded-[var(--radius-sm)] bg-primary text-primary-foreground shadow-button hover:bg-primary-hover hover:shadow-button-hover active:shadow-button",
        secondary:
          "rounded-[var(--radius-sm)] border border-[var(--border-warm)] bg-card text-text-subtle shadow-card hover:bg-secondary hover:shadow-card-hover",
        ghost:
          "rounded-[var(--radius-sm)] text-muted-foreground hover:bg-secondary hover:text-card-foreground",
        icon: "clarity-icon-btn min-h-11 min-w-11",
      },
      size: {
        default: "px-4 py-2.5 text-xs",
        sm: "min-h-11 px-3.5 py-2 text-xs",
        lg: "mt-2 w-full px-4 py-2.5 text-xs",
        icon: "size-11 rounded-md p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, size, type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);

export { buttonVariants };

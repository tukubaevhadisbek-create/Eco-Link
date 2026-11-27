import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-eco-500 text-white hover:bg-eco-600 shadow-sm shadow-eco-500/20",
        dark: "bg-eco-700 text-white hover:bg-eco-900",
        outline: "border border-line bg-white text-ink hover:bg-eco-50 hover:border-eco-200",
        ghost: "text-ink hover:bg-eco-50",
        danger: "bg-danger text-white hover:opacity-90",
        soft: "bg-eco-100 text-eco-700 hover:bg-eco-200",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-[15px]",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";

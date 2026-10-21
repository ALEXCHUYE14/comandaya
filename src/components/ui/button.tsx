import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/core/lib/cn";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[transform,background-color,box-shadow,color] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-ink shadow-[0_1px_0_0_rgba(0,0,0,.12),inset_0_1px_0_0_rgba(255,255,255,.18)] hover:bg-accent-strong",
        secondary: "bg-surface-2 text-ink hover:bg-line",
        outline: "border border-line bg-surface text-ink hover:bg-surface-2",
        ghost: "text-ink hover:bg-surface-2",
        success: "bg-olive text-white hover:brightness-110 dark:text-[#10140a]",
        danger: "bg-danger text-white hover:brightness-110 dark:text-[#200806]",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-12 px-4 text-[15px]",          // 48px: objetivo táctil mínimo
        lg: "h-14 px-6 text-base",
        xl: "h-16 px-6 text-lg",
        icon: "size-12",
        "icon-sm": "size-9",
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

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

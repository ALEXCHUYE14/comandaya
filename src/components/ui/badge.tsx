import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/core/lib/cn";

const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold [&_svg]:size-3.5", {
  variants: {
    tone: {
      neutral: "bg-surface-2 text-muted",
      accent: "bg-accent/12 text-accent",
      amber: "bg-amber-soft text-amber",
      olive: "bg-olive-soft text-olive",
      danger: "bg-danger-soft text-danger",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

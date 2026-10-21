"use client";

import * as S from "@radix-ui/react-switch";
import { cn } from "@/core/lib/cn";

export function Switch({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-line transition-colors data-[state=checked]:bg-olive disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <S.Thumb className="block size-5 translate-x-1 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-6" />
    </S.Root>
  );
}

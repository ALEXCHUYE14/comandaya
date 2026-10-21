import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <Brand />
      <p className="font-mono text-6xl font-extrabold text-accent">#404</p>
      <p className="text-muted">Esta página no está en la carta.</p>
      <Button asChild><Link href="/">Volver al inicio</Link></Button>
    </div>
  );
}

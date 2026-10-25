import { Suspense } from "react";
import { AuthForm } from "@/features/auth/auth-form";
import { AuthHeading } from "@/features/auth/auth-heading";

export const metadata = {
  title: "Iniciar sesión",
  description: "Ingresa a MAFC Comanda para abrir la caja, la cocina y la carta QR de tu restaurante.",
  alternates: { canonical: "/login" },
};

const TITLE = "Bienvenido de vuelta";
const SUBTITLE = "Ingresa para abrir la caja.";

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthHeading title={TITLE} subtitle={SUBTITLE} />}>
      <AuthForm mode="login" title={TITLE} subtitle={SUBTITLE} />
    </Suspense>
  );
}

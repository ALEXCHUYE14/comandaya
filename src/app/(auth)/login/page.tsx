import { Suspense } from "react";
import { AuthForm } from "@/features/auth/auth-form";
import { AuthHeading } from "@/features/auth/auth-heading";

export const metadata = { title: "Iniciar sesión" };

const TITLE = "Bienvenido de vuelta";
const SUBTITLE = "Ingresa para abrir la caja.";

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthHeading title={TITLE} subtitle={SUBTITLE} />}>
      <AuthForm mode="login" title={TITLE} subtitle={SUBTITLE} />
    </Suspense>
  );
}

import { Suspense } from "react";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Bienvenido de vuelta</h1>
      <p className="mb-8 mt-1 text-muted">Ingresa para abrir la caja.</p>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </>
  );
}

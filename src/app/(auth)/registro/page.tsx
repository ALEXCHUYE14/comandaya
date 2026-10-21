import { Suspense } from "react";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Crea tu cuenta</h1>
      <p className="mb-8 mt-1 text-muted">
        Dueños: luego registras tu negocio. Personal: tu jefe te vincula con tu correo.
      </p>
      <Suspense>
        <AuthForm mode="register" />
      </Suspense>
    </>
  );
}

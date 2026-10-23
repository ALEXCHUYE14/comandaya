import { Suspense } from "react";
import { AuthForm } from "@/features/auth/auth-form";
import { AuthHeading } from "@/features/auth/auth-heading";

export const metadata = { title: "Crear cuenta" };

const TITLE = "Crea tu cuenta";
const SUBTITLE = "Dueños: luego registras tu negocio. Personal: tu jefe te vincula con tu correo.";

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthHeading title={TITLE} subtitle={SUBTITLE} />}>
      <AuthForm mode="register" title={TITLE} subtitle={SUBTITLE} />
    </Suspense>
  );
}

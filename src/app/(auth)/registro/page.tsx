import { Suspense } from "react";
import { AuthForm } from "@/features/auth/auth-form";
import { AuthHeading } from "@/features/auth/auth-heading";

export const metadata = {
  title: "Crea tu cuenta gratis",
  description: "Prueba gratis MAFC Comanda, el sistema POS para restaurantes en Perú: caja, cocina y carta QR en tiempo real. Sin tarjeta para empezar.",
  alternates: { canonical: "/registro" },
};

const TITLE = "Crea tu cuenta";
const SUBTITLE = "Dueños: luego registras tu negocio. Personal: tu jefe te vincula con tu correo.";

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthHeading title={TITLE} subtitle={SUBTITLE} />}>
      <AuthForm mode="register" title={TITLE} subtitle={SUBTITLE} />
    </Suspense>
  );
}

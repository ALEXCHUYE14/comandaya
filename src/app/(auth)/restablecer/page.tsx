import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth/password-reset";

export const metadata = { title: "Nueva contraseña", robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Crea tu nueva contraseña</h1>
      <p className="mb-8 mt-1 text-muted">Después entrarás directo a tu caja.</p>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}

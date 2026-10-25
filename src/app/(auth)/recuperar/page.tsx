import { ForgotPasswordForm } from "@/features/auth/password-reset";

export const metadata = { title: "Recuperar contraseña", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">¿Olvidaste tu contraseña?</h1>
      <p className="mb-8 mt-1 text-muted">Te enviamos un enlace a tu correo para crear una nueva.</p>
      <ForgotPasswordForm />
    </>
  );
}

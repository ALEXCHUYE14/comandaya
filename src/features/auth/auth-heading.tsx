/** Título de las pantallas de acceso (también se usa como contenido inicial mientras carga el formulario). */
export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1 className="text-3xl font-extrabold">{title}</h1>
      <p className="mb-8 mt-1 text-muted">{subtitle}</p>
    </>
  );
}

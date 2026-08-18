// Fondo atmosférico global de la app: degradado radial profundo,
// halos de color difuminados y grano sutil (textura noise del theme).
// Fijo detrás de todo el contenido; no intercepta clicks.
export function FondoClub() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden>
      {/* Degradado radial profundo */}
      <div className="absolute inset-0 bg-gradient-hero" />
      {/* Halos de marca */}
      <div className="absolute top-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full bg-club-dorado/5 blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-club-verde-claro/20 blur-[120px]" />
      {/* Grano sutil */}
      <div className="absolute inset-0 bg-noise" />
    </div>
  );
}

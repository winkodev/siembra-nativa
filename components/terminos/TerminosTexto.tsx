import { TERMINOS_ENCABEZADO, TERMINOS_INTRO, TERMINOS_SECCIONES } from './terminos-contenido';

// Render del texto completo de los T&C. Se usa dentro del panel de
// aceptación (perfil) y dentro del modal de consulta.
export function TerminosTexto() {
  return (
    <div className="space-y-5 text-sm text-foreground/80 leading-relaxed">
      <div>
        <p className="font-semibold text-foreground">{TERMINOS_ENCABEZADO.organizacion}</p>
        <p className="text-xs text-muted-foreground">{TERMINOS_ENCABEZADO.datos}</p>
      </div>

      <p>{TERMINOS_INTRO}</p>

      {TERMINOS_SECCIONES.map(seccion => (
        <section key={seccion.titulo} className="space-y-2">
          <h3 className="font-semibold text-foreground">{seccion.titulo}</h3>
          {seccion.parrafos.map((parrafo, i) =>
            Array.isArray(parrafo) ? (
              <ul key={i} className="list-disc pl-5 space-y-1">
                {parrafo.map(item => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p key={i}>{parrafo}</p>
            )
          )}
        </section>
      ))}
    </div>
  );
}

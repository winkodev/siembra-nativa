'use client';

import { useEffect } from 'react';

// Mientras un panel lateral o modal está abierto, la página de fondo no
// scrollea (si no, quedan dos barras de scroll pegadas). Compensa el ancho
// de la barra para que el contenido no "salte" al ocultarla.
export function useBloquearScroll(activo = true) {
  useEffect(() => {
    if (!activo) return;
    const body = document.body;
    const anchoBarra = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (anchoBarra > 0) body.style.paddingRight = `${anchoBarra}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [activo]);
}

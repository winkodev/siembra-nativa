'use client';

import { useState } from 'react';
import { AnuncioPopup } from './AnuncioPopup';
import { CuponPopup } from './CuponPopup';

// Popups al entrar, en orden: primero los anuncios del club, después el regalo
// del cupón. Nunca se muestran dos a la vez.
export function PopupsSocio() {
  const [anunciosListos, setAnunciosListos] = useState(false);
  return (
    <>
      <AnuncioPopup onDone={() => setAnunciosListos(true)} />
      {anunciosListos && <CuponPopup />}
    </>
  );
}

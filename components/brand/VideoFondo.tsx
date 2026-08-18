'use client';

import { useState } from 'react';

// Video de fondo en loop (login). Si el archivo no existe o falla,
// desaparece en silencio y queda el fondo decorativo de siempre.
export function VideoFondo({ src }: { src: string }) {
  const [error, setError] = useState(false);
  if (error) return null;

  return (
    <video
      autoPlay
      muted
      loop
      playsInline
      onError={() => setError(true)}
      className="absolute inset-0 w-full h-full object-cover"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface Props {
  url:   string;   // signed URL de corta duración al certificado
  esPdf: boolean;  // si es PDF se renderiza la primera página como imagen
}

// Muestra el certificado REPROCANN real dentro de la hoja imprimible.
// Un <embed> de PDF no sale en la impresión del navegador, así que los PDF
// se rasterizan con pdf.js a una imagen (que sí se imprime).
export function CertificadoReprocann({ url, esPdf }: Props) {
  const [imgSrc, setImgSrc] = useState<string | null>(esPdf ? null : url);
  const [error, setError]   = useState(false);

  useEffect(() => {
    if (!esPdf) return;
    let cancelado = false;

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();

        const doc  = await pdfjs.getDocument(url).promise;
        const page = await doc.getPage(1);

        // Escala 2x para que la impresión no salga pixelada
        const viewport = page.getViewport({ scale: 2 });
        const canvas   = document.createElement('canvas');
        canvas.width   = viewport.width;
        canvas.height  = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;

        if (!cancelado) setImgSrc(canvas.toDataURL('image/png'));
      } catch {
        if (!cancelado) setError(true);
      }
    })();

    return () => { cancelado = true; };
  }, [url, esPdf]);

  if (error) {
    return (
      <p className="text-neutral-500 text-[11px] italic">
        No se pudo cargar el certificado para imprimir. Podés verlo desde la ficha del socio.
      </p>
    );
  }

  if (!imgSrc) {
    return <p className="text-neutral-400 text-[11px] italic">Cargando certificado…</p>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    // A hoja completa y en escala de grises. max-h + object-contain: la imagen
    // se achica lo justo para no desbordar la zona imprimible (evita hojas en blanco)
    <img
      src={imgSrc}
      alt="Certificado REPROCANN del socio"
      className="w-full max-h-[235mm] object-contain object-left-top grayscale"
    />
  );
}

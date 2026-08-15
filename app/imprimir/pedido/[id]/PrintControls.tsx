'use client';

import { Printer, X } from 'lucide-react';

// Controles flotantes de la vista imprimible (ocultos al imprimir)
export function PrintControls() {
  return (
    <div className="print:hidden fixed top-4 right-4 flex gap-2 z-10">
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-700 transition-colors shadow-lg"
      >
        <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
      </button>
      <button
        onClick={() => window.close()}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-neutral-300 text-neutral-600 text-sm hover:bg-neutral-100 transition-colors shadow-lg"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

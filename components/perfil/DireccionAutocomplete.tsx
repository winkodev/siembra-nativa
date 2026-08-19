'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, CheckCircle2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/types/database';

// Respuesta de la API Georef (apis.datos.gob.ar) para /direcciones
interface DireccionGeoref {
  nomenclatura: string;
  calle: { nombre: string | null };
  altura: { valor: number | null };
  piso: string | null;
  localidad_censal: { nombre: string | null };
  provincia: { nombre: string | null };
  ubicacion: { lat: number | null; lon: number | null };
}

interface Seleccion {
  direccion: string;
  localidad: string;
  provincia: string;
  normalizada: string;
  lat: number | null;
  lon: number | null;
}

// Autocompletado de direcciones contra Georef (Estado argentino).
// Es gratuito, no requiere API key y no comparte datos con privados.
export function DireccionAutocomplete({ profile }: { profile: Profile }) {
  const [query, setQuery]         = useState(profile.direccion ?? '');
  const [opciones, setOpciones]   = useState<DireccionGeoref[]>([]);
  const [buscando, setBuscando]   = useState(false);
  const [abierto, setAbierto]     = useState(false);
  const [sel, setSel]             = useState<Seleccion | null>(
    profile.direccion_validada_at
      ? {
          direccion:  profile.direccion ?? '',
          localidad:  profile.localidad ?? '',
          provincia:  profile.provincia ?? '',
          normalizada: profile.direccion_normalizada ?? '',
          lat: profile.latitud, lon: profile.longitud,
        }
      : null
  );
  const contenedor = useRef<HTMLDivElement>(null);

  // Cerrar el desplegable al hacer click afuera
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  // Búsqueda con debounce: espera a que el socio deje de tipear
  useEffect(() => {
    const texto = query.trim();
    if (texto.length < 5 || (sel && texto === sel.direccion)) { setOpciones([]); return; }

    const id = setTimeout(async () => {
      setBuscando(true);
      try {
        const url = `https://apis.datos.gob.ar/georef/api/direcciones?direccion=${encodeURIComponent(texto)}&max=6&campos=estandar`;
        const res = await fetch(url);
        const json = await res.json();
        setOpciones(json.direcciones ?? []);
        setAbierto(true);
      } catch {
        setOpciones([]);
      } finally {
        setBuscando(false);
      }
    }, 450);

    return () => clearTimeout(id);
  }, [query, sel]);

  const elegir = (d: DireccionGeoref) => {
    const calle = [d.calle?.nombre, d.altura?.valor].filter(Boolean).join(' ');
    const nueva: Seleccion = {
      direccion:  calle || d.nomenclatura,
      localidad:  d.localidad_censal?.nombre ?? '',
      provincia:  d.provincia?.nombre ?? '',
      normalizada: d.nomenclatura,
      lat: d.ubicacion?.lat ?? null,
      lon: d.ubicacion?.lon ?? null,
    };
    setSel(nueva);
    setQuery(nueva.direccion);
    setAbierto(false);
    setOpciones([]);
  };

  return (
    <div className="space-y-3">
      <div ref={contenedor} className="space-y-1.5 relative">
        <label className="text-sm text-foreground/80 font-medium flex items-center gap-2">
          <MapPin className="w-4 h-4 text-club-dorado" />
          Calle y número
        </label>

        <div className="relative">
          <input
            name="direccion"
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSel(null); }}
            onFocus={() => opciones.length > 0 && setAbierto(true)}
            autoComplete="off"
            className="input-club w-full pr-10"
            placeholder="Empezá a escribir: San Martín 222"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {buscando
              ? <Loader2 className="w-4 h-4 animate-spin text-club-dorado" />
              : sel
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              : <Search className="w-4 h-4 text-muted-foreground" />}
          </span>
        </div>

        {/* Sugerencias */}
        {abierto && opciones.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 top-full mt-1 rounded-xl border border-club-verde-claro/40 bg-club-verde shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
            {opciones.map((d, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => elegir(d)}
                  className="w-full text-left px-4 py-2.5 hover:bg-club-verde-claro/25 transition-colors border-b border-club-verde-claro/15 last:border-0"
                >
                  <span className="block text-sm text-foreground">{d.nomenclatura}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {sel
          ? <p className="text-xs text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Dirección validada: {sel.normalizada}
            </p>
          : <p className="text-xs text-muted-foreground">
              Elegí una opción de la lista para validar tu dirección.
            </p>
        }
      </div>

      {/* Localidad y provincia se completan solas al validar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm text-foreground/80 font-medium">Localidad</label>
          <input
            name="localidad" type="text" readOnly
            value={sel?.localidad ?? profile.localidad ?? ''}
            className={cn('input-club w-full', sel && 'text-emerald-300')}
            placeholder="Se completa sola"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-foreground/80 font-medium">Provincia</label>
          <input
            name="provincia" type="text" readOnly
            value={sel?.provincia ?? profile.provincia ?? ''}
            className={cn('input-club w-full', sel && 'text-emerald-300')}
            placeholder="Se completa sola"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm text-foreground/80 font-medium">Código postal</label>
          <input
            name="codigo_postal" type="text"
            defaultValue={profile.codigo_postal ?? ''}
            className="input-club w-full" placeholder="C1043"
          />
        </div>
      </div>

      {/* Datos de validación que viajan con el formulario */}
      <input type="hidden" name="latitud"  value={sel?.lat ?? ''} />
      <input type="hidden" name="longitud" value={sel?.lon ?? ''} />
      <input type="hidden" name="direccion_normalizada" value={sel?.normalizada ?? ''} />
    </div>
  );
}

'use client';

import { createContext, useContext, useReducer, useEffect, useState } from 'react';
import type { CarritoItem, ItemRef } from '@/lib/types/database';

// Reexport para que los consumidores importen el tipo desde el contexto si quieren
export type { CarritoItem, CarritoItemGenetica, CarritoItemProducto, ItemRef } from '@/lib/types/database';

// Clave única de un item (combina tipo + id, porque una genética y un producto
// podrían compartir id en teoría y son entidades distintas)
export function itemKey(ref: ItemRef): string {
  return `${ref.tipo_item}:${ref.id}`;
}

// Cantidad actual de un item según su tipo
export function cantidadItem(item: CarritoItem): number {
  return item.tipo_item === 'genetica' ? item.cantidad_gramos : item.cantidad_unidades;
}

// Devuelve una copia del item con la cantidad ajustada (clamp 1..stock)
function setCantidad(item: CarritoItem, cantidad: number): CarritoItem {
  const clamp = Math.max(1, Math.min(cantidad, item.stock_disponible));
  return item.tipo_item === 'genetica'
    ? { ...item, cantidad_gramos: clamp }
    : { ...item, cantidad_unidades: clamp };
}

// Suma la cantidad de un item ya existente con la nueva (clamp a stock)
function sumarCantidad(item: CarritoItem, extra: number): CarritoItem {
  return setCantidad(item, cantidadItem(item) + extra);
}

interface CarritoState {
  items:             CarritoItem[];
  contadorAgregados: number;
}

type CarritoAction =
  | { type: 'AGREGAR';    item: CarritoItem }
  | { type: 'QUITAR';     key: string }
  | { type: 'ACTUALIZAR'; key: string; cantidad: number }
  | { type: 'VACIAR' };

function reducer(state: CarritoState, action: CarritoAction): CarritoState {
  switch (action.type) {
    case 'AGREGAR': {
      const nuevoKey = itemKey(action.item);
      const existe = state.items.find(i => itemKey(i) === nuevoKey);
      if (existe) {
        return {
          contadorAgregados: state.contadorAgregados + 1,
          items: state.items.map(i =>
            itemKey(i) === nuevoKey ? sumarCantidad(i, cantidadItem(action.item)) : i
          ),
        };
      }
      return { contadorAgregados: state.contadorAgregados + 1, items: [...state.items, action.item] };
    }
    case 'QUITAR':
      return { ...state, items: state.items.filter(i => itemKey(i) !== action.key) };
    case 'ACTUALIZAR':
      return {
        ...state,
        items: state.items.map(i =>
          itemKey(i) === action.key ? setCantidad(i, action.cantidad) : i
        ),
      };
    case 'VACIAR':
      return { ...state, items: [] };
    default:
      return state;
  }
}

const STORAGE_KEY = 'sn_carrito';

interface CarritoContextValue {
  items:             CarritoItem[];
  totalItems:        number;
  totalGramos:       number; // solo genéticas (para el límite por pedido)
  agregar:           (item: CarritoItem) => void;
  quitar:            (ref: ItemRef) => void;
  actualizar:        (ref: ItemRef, cantidad: number) => void;
  vaciar:            () => void;
  tieneItem:         (ref: ItemRef) => boolean;
  abierto:           boolean;
  setAbierto:        (v: boolean) => void;
  maxGramos:         number;
  // % de descuento sobre flores al alcanzar 20g / 40g (0 = sin descuento)
  descuento20:       number;
  descuento40:       number;
  // Envío: costo configurado y gramos desde los que va bonificado (0 = nunca)
  costoEnvio:        number;
  envioGratisDesde:  number;
  contadorAgregados: number;
}

const CarritoContext = createContext<CarritoContextValue | null>(null);

export function CarritoProvider({
  children,
  maxGramos = 40,
  descuento20 = 0,
  descuento40 = 0,
  costoEnvio = 0,
  envioGratisDesde = 0,
}: {
  children: React.ReactNode;
  maxGramos?: number;
  descuento20?: number;
  descuento40?: number;
  costoEnvio?: number;
  envioGratisDesde?: number;
}) {
  const [state, dispatch] = useReducer(reducer, { items: [], contadorAgregados: 0 });
  const [abierto, setAbierto] = useState(false);

  // Restaurar carrito desde localStorage al montar
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        const items = JSON.parse(guardado) as CarritoItem[];
        // Ignorar items con formato viejo (sin tipo_item) para evitar estados corruptos
        items
          .filter(i => i && (i.tipo_item === 'genetica' || i.tipo_item === 'producto'))
          .forEach(item => dispatch({ type: 'AGREGAR', item }));
      }
    } catch {}
  }, []);

  // Persistir en localStorage al cambiar
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }, [state.items]);

  const totalGramos = state.items.reduce(
    (acc, i) => acc + (i.tipo_item === 'genetica' ? i.cantidad_gramos : 0),
    0
  );

  const value: CarritoContextValue = {
    items:             state.items,
    totalItems:        state.items.length,
    totalGramos,
    agregar:           (item) => dispatch({ type: 'AGREGAR', item }),
    quitar:            (ref)  => dispatch({ type: 'QUITAR', key: itemKey(ref) }),
    actualizar:        (ref, cantidad) => dispatch({ type: 'ACTUALIZAR', key: itemKey(ref), cantidad }),
    vaciar:            ()     => dispatch({ type: 'VACIAR' }),
    tieneItem:         (ref)  => state.items.some(i => itemKey(i) === itemKey(ref)),
    abierto,
    setAbierto,
    maxGramos,
    descuento20,
    descuento40,
    costoEnvio,
    envioGratisDesde,
    contadorAgregados: state.contadorAgregados,
  };

  return <CarritoContext.Provider value={value}>{children}</CarritoContext.Provider>;
}

export function useCarrito() {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de CarritoProvider');
  return ctx;
}

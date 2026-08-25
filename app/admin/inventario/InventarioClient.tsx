'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Leaf } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GeneticasTab } from './GeneticasTab';
import { StockTab } from './StockTab';
import type { Genetica, Stock, Ubicacion } from '@/lib/types/database';
import { cn } from '@/lib/utils';

type StockConGenetica = Stock & { geneticas: { nombre: string; tipo: string } };

interface Props {
  geneticas:   Genetica[];
  stock:       StockConGenetica[];
  ubicaciones: Ubicacion[];
  reservas:    Record<string, number>;  // gramos en pedidos pendientes, por genética
  superadmin:  boolean;                 // habilita editar/eliminar ingresos de stock
}

const tabs = [
  { id: 'stock',     label: 'Stock',     icon: <Package className="w-4 h-4" /> },
  { id: 'geneticas', label: 'Genéticas', icon: <Leaf className="w-4 h-4" /> },
];

const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export function InventarioClient({ geneticas, stock, ubicaciones, reservas, superadmin }: Props) {
  const [tab, setTab] = useState<'geneticas' | 'stock'>('stock');

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-6">

      <PageHeader
        icon={<Package className="w-5 h-5" />}
        title="Inventario"
        subtitle="Stock e ingresos por lote"
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 glass-card w-fit rounded-xl">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'geneticas' | 'stock')}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
              tab === t.id
                ? 'bg-club-dorado text-club-verde shadow-dorado-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido del tab activo */}
      {tab === 'geneticas' ? (
        <GeneticasTab geneticas={geneticas} />
      ) : (
        <StockTab stock={stock} geneticas={geneticas} ubicaciones={ubicaciones} reservas={reservas} superadmin={superadmin} />
      )}

    </motion.div>
  );
}

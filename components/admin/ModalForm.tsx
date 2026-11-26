'use client';

import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Modal genérico
export function Modal({ titulo, icono, onClose, children }: { titulo: string; icono: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()} className="glass-card w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-avigea text-xl text-foreground flex items-center gap-2">{icono} {titulo}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm text-foreground/70 font-medium mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

export function BotonGuardar({ pending, label, color = 'btn-primary' }: { pending: boolean; label: string; color?: string }) {
  return (
    <button type="submit" disabled={pending} className={cn(color, 'flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl font-semibold')}>
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : label}
    </button>
  );
}

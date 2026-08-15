'use client';

import { motion } from 'framer-motion';
import { Shield, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { cn, badgeReprocann, labelReprocann, labelCategoria, formatFecha, diasHasta } from '@/lib/utils';
import type { Profile } from '@/lib/types/database';

interface ReprocannStatusProps {
  profile: Pick<Profile,
    'reprocann_estado' | 'reprocann_numero' | 'reprocann_categoria' |
    'reprocann_vencimiento' | 'reprocann_certificado_path'
  >;
  className?: string;
}

const iconoEstado = {
  pendiente: <Clock className="w-5 h-5" />,
  aprobado:  <CheckCircle2 className="w-5 h-5" />,
  rechazado: <XCircle className="w-5 h-5" />,
  vencido:   <AlertTriangle className="w-5 h-5" />,
};

export function ReprocannStatus({ profile, className }: ReprocannStatusProps) {
  const { reprocann_estado, reprocann_numero, reprocann_categoria, reprocann_vencimiento } = profile;
  const diasRestantes = reprocann_vencimiento ? diasHasta(reprocann_vencimiento) : null;
  const porVencer = diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 90;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('glass-card p-5', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Shield className="w-5 h-5 text-club-dorado" />
          Estado REPROCANN
        </div>
        <span className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
          badgeReprocann(reprocann_estado)
        )}>
          {iconoEstado[reprocann_estado]}
          {labelReprocann(reprocann_estado)}
        </span>
      </div>

      {/* Datos — solo si hay info cargada por el admin */}
      {(reprocann_numero || reprocann_vencimiento) ? (
        <div className="space-y-2.5">
          {reprocann_numero && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Número</span>
              <span className="text-foreground font-mono">{reprocann_numero}</span>
            </div>
          )}
          {reprocann_categoria && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Categoría</span>
              <span className="text-foreground">{labelCategoria(reprocann_categoria)}</span>
            </div>
          )}
          {reprocann_vencimiento && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vencimiento</span>
              <span className={cn(
                'font-medium',
                diasRestantes !== null && diasRestantes < 0 ? 'text-red-400' :
                porVencer ? 'text-amber-400' : 'text-foreground'
              )}>
                {formatFecha(reprocann_vencimiento)}
              </span>
            </div>
          )}
        </div>
      ) : reprocann_estado !== 'aprobado' ? (
        <p className="text-sm text-amber-400/80">
          Subí tu certificado REPROCANN para que el equipo lo pueda revisar.
        </p>
      ) : null}

      {/* Alerta de vencimiento próximo */}
      {porVencer && reprocann_vencimiento && (
        <div className="mt-4 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Tu REPROCANN vence en {diasRestantes} días. Renovalo para seguir haciendo pedidos.
        </div>
      )}

      {/* Alerta si rechazado */}
      {reprocann_estado === 'rechazado' && (
        <div className="mt-4 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          Tu certificado fue rechazado. Actualizá los datos y volvé a cargar el documento.
        </div>
      )}

      {/* Pendiente de revisión */}
      {reprocann_estado === 'pendiente' && reprocann_numero && (
        <div className="mt-4 px-3 py-2 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-xs flex items-center gap-2">
          <Clock className="w-4 h-4 flex-shrink-0" />
          Tu certificado está siendo revisado por el equipo del club.
        </div>
      )}
    </motion.div>
  );
}

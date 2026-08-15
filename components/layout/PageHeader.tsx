'use client';

import { motion } from 'framer-motion';

/* Encabezado de página unificado — mismo tamaño, jerarquía y espaciado en todos los módulos */
interface PageHeaderProps {
  icon:      React.ReactNode;
  title:     string;
  subtitle?: string;
  action?:   React.ReactNode; // botón principal (ej: "Nuevo producto")
}

export function PageHeader({ icon, title, subtitle, action }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start justify-between gap-4"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-club-dorado/15 border border-club-dorado/25 flex items-center justify-center text-club-dorado shrink-0">
            {icon}
          </div>
          <div>
            <h1 className="font-avigea text-2xl sm:text-3xl text-foreground leading-tight">{title}</h1>
            {subtitle && <p className="text-muted-foreground text-xs mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="divider-dorado mt-3" />
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </motion.div>
  );
}

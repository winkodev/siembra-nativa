// ============================================================
// Tipos TypeScript generados del esquema de Supabase
// Sincronizar con: supabase gen types typescript --project-id TU_PROJECT_ID
// ============================================================

export type RolUsuario = 'socio' | 'admin';
export type EstadoUsuario = 'activo' | 'inactivo';
export type ReprocannCategoria = 'paciente_cultiva' | 'tercero_cultivador' | 'ong';
export type ReprocannEstado = 'pendiente' | 'aprobado' | 'rechazado' | 'vencido';
export type TipoGenetica = 'indica' | 'sativa' | 'hibrida';
export type CalidadGenetica = 'regular' | 'premium';
export type CultivoGenetica = 'indoor' | 'outdoor';
export type EstadoPedido = 'pendiente' | 'aprobado' | 'entregado' | 'cancelado';

export interface Profile {
  id: string;
  nombre: string;
  rol: RolUsuario;
  estado: EstadoUsuario;
  fecha_alta: string;

  // Datos de contacto
  email: string | null;
  telefono: string | null;
  dni: string | null;
  fecha_nacimiento: string | null;

  // Dirección (validada contra Georef: guarda coordenadas)
  direccion: string | null;
  piso_depto: string | null;
  localidad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
  latitud: number | null;
  longitud: number | null;
  direccion_normalizada: string | null;
  direccion_validada_at: string | null;

  // REPROCANN
  reprocann_numero: string | null;
  reprocann_categoria: ReprocannCategoria | null;
  reprocann_estado: ReprocannEstado;
  reprocann_vencimiento: string | null;
  reprocann_certificado_path: string | null;

  // Solo admin
  notas_admin: string | null;
  compra_habilitada: boolean;

  created_at: string;
  updated_at: string;
}

export interface Genetica {
  id: string;
  nombre: string;
  tipo: TipoGenetica;
  thc: number | null;
  cbd: number | null;
  descripcion: string | null;
  imagen_url: string | null;
  calidad: CalidadGenetica | null;
  cultivo: CultivoGenetica | null;
  precio_gramo: number | null;
  banco: string | null;   // semillera (se muestra "Nombre by Banco")
  novedad: boolean;       // cinta "NOVEDAD" en el catálogo
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Stock {
  id: string;
  genetica_id: string;
  cantidad_gramos: number;   // RESTANTE del lote (el FIFO descuenta de acá)
  cantidad_inicial: number;  // lo ingresado originalmente (inmutable)
  ubicacion: string | null;
  lote: string | null;
  fecha_ingreso: string;
  created_at: string;
  updated_at: string;
}

export interface StockPublico {
  genetica_id: string;
  nombre: string;
  tipo: TipoGenetica;
  thc: number | null;
  cbd: number | null;
  descripcion: string | null;
  imagen_url: string | null;
  stock_total_gramos: number;
  calidad: CalidadGenetica | null;
  cultivo: CultivoGenetica | null;
  precio_gramo: number | null;
  banco: string | null;
  novedad: boolean;
}

export interface Pedido {
  id: string;
  // Número de orden secuencial, asignado por la base al crear el pedido
  numero: number;
  socio_id: string;
  estado: EstadoPedido;
  fecha: string;
  notas: string | null;
  // Comprobante de pago (path interno en bucket privado, nunca URL)
  comprobante_path: string | null;
  comprobante_subido_at: string | null;
  // Momento real de la dispensa (se fija al marcar entregado)
  fecha_entregado: string | null;
  // Foto del horario de entrega elegido (ej: "Sábados · 09:00–18:00 hs")
  entrega_franja: string | null;
  // Foto de los montos al confirmar (precios de ese momento)
  monto_total: number | null;
  monto_envio: number | null;
  monto_descuento: number | null;
  // Controles previos a la aprobación (quién y cuándo)
  armado_por: string | null;
  armado_at: string | null;
  comprobante_ok_por: string | null;
  comprobante_ok_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PedidoItem {
  id: string;
  pedido_id: string;
  // Un item es una genética (gramos) O un producto (unidades), nunca ambos
  genetica_id: string | null;
  cantidad_gramos: number | null;
  producto_id: string | null;
  cantidad_unidades: number | null;
  created_at: string;
}

export interface PedidoConItems extends Pedido {
  pedido_items: (PedidoItem & {
    geneticas: Pick<Genetica, 'nombre' | 'tipo'> | null;
    productos: Pick<Producto, 'nombre' | 'categoria'> | null;
  })[];
}

export type CategoriaProducto = 'aceite' | 'merchandising' | 'otro';

// Franja horaria de retiro de pedidos (ej: Sábados 09:00–18:00)
export interface FranjaHoraria {
  id: string;
  dia: string;
  hora_desde: string;   // formato TIME "09:00:00"
  hora_hasta: string;
  activa: boolean;
  created_at: string;
}

export interface Ubicacion {
  id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: CategoriaProducto;
  precio: number | null;
  imagen_url: string | null;
  activo: boolean;
  stock: number;
  created_at: string;
  updated_at: string;
}

export interface Newsletter {
  id: string;
  titulo: string;
  contenido: string;
  imagen_url: string | null;
  publicado: boolean;
  fecha_publicacion: string | null;
  created_at: string;
  updated_at: string;
}

// Notificación in-app para el socio (pedido confirmado/entregado, avisos)
export interface Notificacion {
  id: string;
  socio_id: string;
  tipo: string;   // 'general' | 'reprocann_aviso' | 'reprocann_vencido' | ...
  titulo: string;
  mensaje: string | null;
  leida: boolean;
  created_at: string;
}

// Log de notas internas por socio (solo admin; puede contener datos de salud)
export type TipoNotaSocio = 'general' | 'consulta_medica' | 'reprocann' | 'pago';

export interface SocioNota {
  id: string;
  socio_id: string;
  admin_id: string | null;
  tipo: TipoNotaSocio;
  contenido: string;
  created_at: string;
}

// Ficha de actividad de un socio (drawer de admin)
export interface FichaSocio {
  pedidos_total: number;
  pedidos_entregados: number;
  gramos_retirados: number;
  unidades_retiradas: number;
  promedio_gramos: number;      // por pedido entregado
  ultimo_pedido: string | null; // fecha del pedido más reciente
  notas: SocioNota[];
}

export interface AuditLog {
  id: string;
  admin_id: string;
  accion: string;
  recurso: string;
  socio_afectado_id: string | null;
  metadata: Record<string, unknown> | null;
  fecha: string;
}

// Tipos para el estado del carrito (solo client-side)
// Un item del carrito es una genética (gramos) o un producto (unidades)
export interface CarritoItemGenetica {
  tipo_item: 'genetica';
  id: string;                 // genetica_id
  nombre: string;
  tipo: TipoGenetica;
  cantidad_gramos: number;
  stock_disponible: number;   // en gramos
  precio_gramo?: number | null;
}

export interface CarritoItemProducto {
  tipo_item: 'producto';
  id: string;                 // producto_id
  nombre: string;
  categoria: CategoriaProducto;
  precio: number | null;
  cantidad_unidades: number;
  stock_disponible: number;   // en unidades
}

export type CarritoItem = CarritoItemGenetica | CarritoItemProducto;

// Referencia mínima para identificar un item dentro del carrito
export interface ItemRef {
  tipo_item: 'genetica' | 'producto';
  id: string;
}

// Tipo para las métricas del dashboard admin
export interface MetricasAdmin {
  stock_total_gramos: number;
  pedidos_pendientes: number;
  socios_activos: number;
  reprocann_por_vencer: number;
  reprocann_vencidos: number;
}

// Tipo de respuesta genérica
export type ActionResponse<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Resultado de la función SQL estadisticas_club (solo admin)
export interface EstadisticasClub {
  gramos_dispensados: number;
  unidades_dispensadas: number;
  pedidos_total: number;
  pedidos_por_estado: Partial<Record<EstadoPedido, number>>;
  socios_nuevos: number;
  socios_activos: number;
  serie_dispensado: { periodo: string; gramos: number }[];
  serie_altas: { periodo: string; altas: number }[];
  top_geneticas: { nombre: string; gramos: number }[];
}

// Tipo para formulario de onboarding REPROCANN
export interface ReprocannFormData {
  reprocann_numero: string;
  reprocann_categoria: ReprocannCategoria;
  reprocann_vencimiento: string;
  certificado: File;
}

// Database type completo para Supabase client
// Nota: cada tabla/vista declara `Relationships: []` porque postgrest-js (v2.45+)
// exige esa clave para considerar el schema válido; sin ella, todos los `.from()`
// colapsan a `never`. Los `Insert` se dejan permisivos (Partial) porque las columnas
// con DEFAULT en la DB no se envían desde la app; la integridad la garantiza la DB.
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Omit<Profile, 'created_at' | 'updated_at'>> & { id: string; nombre: string };
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
        Relationships: [];
      };
      geneticas: {
        Row: Genetica;
        Insert: Partial<Omit<Genetica, 'id' | 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<Genetica, 'id' | 'created_at'>>;
        Relationships: [];
      };
      stock: {
        Row: Stock;
        Insert: Partial<Omit<Stock, 'id' | 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<Stock, 'id' | 'created_at'>>;
        Relationships: [];
      };
      pedidos: {
        Row: Pedido;
        Insert: Partial<Omit<Pedido, 'id' | 'numero' | 'created_at' | 'updated_at'>> & { socio_id: string };
        Update: Partial<Omit<Pedido, 'id' | 'numero' | 'created_at'>>;
        Relationships: [];
      };
      pedido_items: {
        Row: PedidoItem;
        Insert: {
          pedido_id: string;
          genetica_id?: string | null;
          cantidad_gramos?: number | null;
          producto_id?: string | null;
          cantidad_unidades?: number | null;
        };
        Update: Partial<Omit<PedidoItem, 'id' | 'created_at'>>;
        Relationships: [];
      };
      ubicaciones: {
        Row: Ubicacion;
        Insert: Partial<Omit<Ubicacion, 'id' | 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<Ubicacion, 'id' | 'created_at'>>;
        Relationships: [];
      };
      franjas_horarias: {
        Row: FranjaHoraria;
        Insert: Partial<Omit<FranjaHoraria, 'id' | 'created_at'>> & { dia: string; hora_desde: string; hora_hasta: string };
        Update: Partial<Omit<FranjaHoraria, 'id' | 'created_at'>>;
        Relationships: [];
      };
      productos: {
        Row: Producto;
        Insert: Partial<Omit<Producto, 'id' | 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<Producto, 'id' | 'created_at'>>;
        Relationships: [];
      };
      newsletter: {
        Row: Newsletter;
        Insert: Partial<Omit<Newsletter, 'id' | 'created_at' | 'updated_at'>>;
        Update: Partial<Omit<Newsletter, 'id' | 'created_at'>>;
        Relationships: [];
      };
      audit_log: {
        Row: AuditLog;
        Insert: Partial<Omit<AuditLog, 'id' | 'fecha'>> & { admin_id: string; accion: string; recurso: string };
        Update: never;
        Relationships: [];
      };
      socio_notas: {
        Row: SocioNota;
        Insert: Partial<Omit<SocioNota, 'id' | 'created_at'>> & { socio_id: string; contenido: string };
        Update: Partial<Omit<SocioNota, 'id' | 'created_at'>>;
        Relationships: [];
      };
      notificaciones: {
        Row: Notificacion;
        Insert: Partial<Omit<Notificacion, 'id' | 'created_at'>> & { socio_id: string; titulo: string };
        Update: Partial<Omit<Notificacion, 'id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views: {
      stock_publico: {
        Row: StockPublico;
        Relationships: [];
      };
      // Productos con stock neto de reservas (pedidos pendientes)
      productos_publico: {
        Row: Producto;
        Relationships: [];
      };
    };
    Functions: {
      get_my_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      descontar_stock_pedido: {
        Args: { p_pedido_id: string };
        Returns: void;
      };
      restaurar_stock_pedido: {
        Args: { p_pedido_id: string };
        Returns: void;
      };
      estadisticas_club: {
        Args: { p_desde: string; p_hasta: string; p_agrupacion: string };
        Returns: EstadisticasClub;
      };
      crear_pedido: {
        Args: {
          p_items: { tipo: string; id: string; cantidad: number }[];
          p_notas: string | null;
          p_franja_id: string | null;
        };
        Returns: { pedido_id: string; numero: number };
      };
    };
  };
}

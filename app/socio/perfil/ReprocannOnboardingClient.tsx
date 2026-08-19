'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Upload, Save, Loader2, FileText, CheckCircle2, User,
  MapPin, Sparkles, AlertCircle, Clock, ExternalLink
} from 'lucide-react';
import { useState, useRef } from 'react';
import { subirCertificado, verMiCertificado } from '@/app/actions/reprocann';
import { guardarPerfil } from '@/app/actions/perfil';
import { extraerDatosReprocann, type DatosExtraidos } from '@/app/actions/extraerReprocann';
import { ReprocannStatus } from '@/components/reprocann/ReprocannStatus';
import type { Profile, ActionResponse } from '@/lib/types/database';
import { cn } from '@/lib/utils';
import { DireccionAutocomplete } from '@/components/perfil/DireccionAutocomplete';

const initial: ActionResponse = { ok: true, data: undefined };

function SaveButton({ label = 'Guardar' }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2">
      {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> {label}</>}
    </button>
  );
}

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2">
      {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</> : <><Upload className="w-4 h-4" /> Subir certificado</>}
    </button>
  );
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };
const fadeUp  = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export function ReprocannOnboardingClient({ profile }: { profile: Profile }) {
  const [perfilState, perfilAction] = useFormState(guardarPerfil, initial);
  const [certState, certAction]     = useFormState(subirCertificado, initial);

  const [fileName, setFileName]               = useState<string | null>(null);
  const [extrayendo, setExtrayendo]           = useState(false);
  const [extraido, setExtraido]               = useState(false);
  const [datos, setDatos]                     = useState<DatosExtraidos | null>(null);
  const [errorExtraccion, setErrorExtraccion] = useState<string | null>(null);
  const [verCertLoading, setVerCertLoading]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleVerCertificado() {
    setVerCertLoading(true);
    try {
      const res = await verMiCertificado();
      if (res.ok) window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } finally {
      setVerCertLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setExtraido(false);
    setDatos(null);
    setErrorExtraccion(null);

    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;

    setExtrayendo(true);
    try {
      const fd = new FormData();
      fd.append('certificado', file);
      const res = await extraerDatosReprocann(fd);
      if (res.ok) {
        setDatos(res.data);       // guardamos lo leído del PDF para pre-llenar los campos
        setExtraido(true);
      } else {
        setErrorExtraccion(res.error);
      }
    } finally {
      setExtrayendo(false);
    }
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="max-w-2xl mx-auto space-y-6"
    >
      <motion.div variants={fadeUp}>
        <h1 className="font-avigea text-3xl text-foreground mb-1">Mi Perfil</h1>
        <div className="divider-dorado mb-4" />
        <p className="text-muted-foreground text-sm">
          Completá tus datos personales y tu REPROCANN para poder realizar pedidos.
        </p>
      </motion.div>

      {/* Datos personales */}
      <motion.div variants={fadeUp} className="glass-card p-6">
        <h2 className="font-avigea text-xl text-foreground mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-club-dorado" />
          Datos personales
        </h2>

        {perfilState && !perfilState.ok && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
            {perfilState.error}
          </div>
        )}
        {perfilState?.ok && perfilState !== initial && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Datos guardados correctamente.
          </motion.div>
        )}

        <form action={perfilAction} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80 font-medium">Nombre completo *</label>
              <input name="nombre" type="text" required defaultValue={profile.nombre}
                className="input-club w-full" placeholder="Juan García" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80 font-medium">DNI</label>
              <input name="dni" type="text" defaultValue={profile.dni ?? ''}
                className="input-club w-full" placeholder="12.345.678" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80 font-medium">Email de contacto</label>
              <input name="email" type="email" defaultValue={profile.email ?? ''}
                className="input-club w-full" placeholder="tu@email.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-foreground/80 font-medium">Teléfono / WhatsApp</label>
              <input name="telefono" type="tel" defaultValue={profile.telefono ?? ''}
                className="input-club w-full" placeholder="+54 9 11 1234-5678" />
            </div>
          </div>

          <div className="space-y-1.5 sm:w-1/2">
            <label className="text-sm text-foreground/80 font-medium">Fecha de nacimiento</label>
            <input name="fecha_nacimiento" type="date" defaultValue={profile.fecha_nacimiento ?? ''}
              className="input-club w-full" />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <MapPin className="w-4 h-4 text-club-dorado flex-shrink-0" />
            <span className="text-sm text-foreground/60 font-medium">Dirección</span>
            <div className="flex-1 h-px bg-club-verde-claro/30" />
          </div>

          {/* Autocompletado validado contra Georef (Estado argentino) */}
          <DireccionAutocomplete profile={profile} />

          <div className="flex justify-end pt-2">
            <SaveButton />
          </div>
        </form>
      </motion.div>

      {/* Estado actual */}
      <motion.div variants={fadeUp}>
        <ReprocannStatus profile={profile} />
      </motion.div>

      {/* Certificado REPROCANN */}
      <motion.div variants={fadeUp} className="glass-card p-6">
        <h2 className="font-avigea text-xl text-foreground mb-1 flex items-center gap-2">
          <FileText className="w-5 h-5 text-club-dorado" />
          Certificado REPROCANN
        </h2>
        <p className="text-muted-foreground text-xs mb-5">
          Subí tu certificado y el equipo lo revisará para habilitarte el acceso a pedidos.
        </p>

        {/* Estado de revisión */}
        {profile.reprocann_estado === 'pendiente' && profile.reprocann_certificado_path && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-yellow-300 text-sm mb-5">
            <Clock className="w-4 h-4 shrink-0" />
            Tu documentación está siendo revisada. Te avisaremos cuando esté aprobada.
          </div>
        )}
        {profile.reprocann_estado === 'aprobado' && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-sm mb-5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Documentación aprobada. Podés hacer pedidos.
          </div>
        )}
        {profile.reprocann_estado === 'rechazado' && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm mb-5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Tu documentación fue rechazada. Subí un certificado válido o contactate con el club.
          </div>
        )}

        {/* Certificado ya cargado — ver */}
        {profile.reprocann_certificado_path && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 mb-3">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <FileText className="w-4 h-4 text-club-dorado shrink-0" />
              Certificado cargado
            </div>
            <button
              type="button"
              onClick={handleVerCertificado}
              disabled={verCertLoading}
              className="flex items-center gap-1.5 text-xs text-club-dorado hover:text-club-dorado/80 transition-colors disabled:opacity-50"
            >
              {verCertLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
              Ver certificado
            </button>
          </div>
        )}

        {/* Formulario único de carga/reemplazo + datos del certificado */}
        <form action={certAction} className="space-y-3">
            {certState && !certState.ok && (
              <div className="px-4 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
                {certState.error}
              </div>
            )}
            {certState?.ok && certState !== initial && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="px-4 py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Certificado subido. El equipo lo revisará pronto.
              </motion.div>
            )}

            <label
              htmlFor="certificado"
              className={cn(
                'flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200',
                fileName
                  ? 'border-club-dorado/50 bg-club-dorado/5'
                  : 'border-club-verde-claro/50 bg-club-verde-claro/10 hover:border-club-dorado/40 hover:bg-club-dorado/5'
              )}
            >
              {extrayendo ? (
                <>
                  <Loader2 className="w-8 h-8 text-club-dorado animate-spin" />
                  <span className="text-foreground text-sm font-medium">Procesando...</span>
                </>
              ) : fileName ? (
                <>
                  <CheckCircle2 className="w-8 h-8 text-club-dorado" />
                  <span className="text-foreground text-sm font-medium">{fileName}</span>
                  <span className="text-muted-foreground text-xs">Clic para cambiar</span>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-foreground text-sm font-medium">
                    {profile.reprocann_certificado_path ? 'Reemplazar certificado' : 'Subir certificado'}
                  </span>
                  <span className="text-muted-foreground text-xs">PDF, JPG, PNG · Máximo 10 MB</span>
                </>
              )}
            </label>

            <input
              id="certificado"
              name="certificado"
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              required
              className="sr-only"
              onChange={handleFileChange}
            />

            {errorExtraccion && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                No pudimos leer el certificado automáticamente. Completá los datos a mano.
              </div>
            )}

            {/* Datos del certificado — pre-llenados con lo leído del PDF y editables */}
            {fileName && !extrayendo && (
              <motion.div
                key={JSON.stringify(datos)}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 p-4 rounded-xl bg-club-dorado/5 border border-club-dorado/20"
              >
                {datos && (extraido) && (
                  <div className="flex items-center gap-2 text-club-dorado text-xs font-medium">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    Leímos estos datos del certificado. Revisalos antes de subir.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-foreground/80 font-medium">Fecha de vencimiento</label>
                    <input
                      type="date"
                      name="reprocann_vencimiento"
                      defaultValue={datos?.reprocann_vencimiento ?? profile.reprocann_vencimiento ?? ''}
                      className="input-club w-full"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-foreground/80 font-medium">Número de registro</label>
                    <input
                      type="text"
                      name="reprocann_numero"
                      defaultValue={datos?.reprocann_numero ?? profile.reprocann_numero ?? ''}
                      placeholder="Ej: 123456"
                      className="input-club w-full"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-foreground/80 font-medium">Categoría</label>
                  <select
                    name="reprocann_categoria"
                    defaultValue={datos?.reprocann_categoria ?? profile.reprocann_categoria ?? ''}
                    className="input-club w-full bg-club-verde-medio appearance-none cursor-pointer"
                  >
                    <option value="">Seleccioná</option>
                    <option value="paciente_cultiva">Paciente que cultiva</option>
                    <option value="tercero_cultivador">Tercero cultivador</option>
                    <option value="ong">ONG</option>
                  </select>
                </div>
              </motion.div>
            )}

            <div className="flex justify-end">
              <UploadButton />
            </div>
          </form>
      </motion.div>
    </motion.div>
  );
}

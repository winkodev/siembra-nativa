'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Eye, EyeOff, UserPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { registro } from '@/app/actions/auth';
import type { ActionResponse } from '@/lib/types/database';

const initialState: ActionResponse = { ok: true, data: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full py-3.5 text-base">
      {pending ? (
        <><Loader2 className="w-5 h-5 animate-spin" /> Creando cuenta...</>
      ) : (
        <><UserPlus className="w-5 h-5" /> Crear cuenta</>
      )}
    </button>
  );
}

export default function RegistroPage() {
  const [state, formAction] = useFormState(registro, initialState);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Estado de éxito: pedir al usuario que confirme su email
  if (state?.ok && (state as { ok: true; data: undefined }).data === undefined && !initialState) {
    return null;
  }

  // Mostrar confirmación si el servidor retornó ok:true
  const registroExitoso = state?.ok === true && state?.data === undefined && state !== initialState;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >

      {registroExitoso ? (
        // Pantalla de confirmación de email
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="font-avigea text-2xl text-foreground mb-3">¡Cuenta creada!</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-xs mx-auto">
            Te enviamos un email de confirmación. Hacé clic en el link para activar tu cuenta y luego iniciá sesión.
          </p>
          <Link href="/login" className="btn-secondary text-sm">
            Ir al login
          </Link>
        </motion.div>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="font-avigea text-3xl text-foreground mb-2">Crear cuenta</h1>
            <p className="text-muted-foreground text-sm">Completá los datos para registrarte como socio</p>
            <div className="divider-dorado mt-3" />
          </div>

          {/* Error global */}
          {state && !state.ok && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-5 px-4 py-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm"
            >
              {state.error}
            </motion.div>
          )}

          <form action={formAction} className="space-y-5">

            {/* Nombre */}
            <div className="space-y-1.5">
              <label htmlFor="nombre" className="text-sm text-foreground/80 font-medium">
                Nombre completo
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                autoComplete="name"
                required
                placeholder="Juan García"
                className="input-club w-full"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm text-foreground/80 font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="tu@email.com"
                className="input-club w-full"
              />
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm text-foreground/80 font-medium">
                Contraseña <span className="text-muted-foreground font-normal">(mínimo 8 caracteres)</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  className="input-club w-full pr-12"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirmar contraseña */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-sm text-foreground/80 font-medium">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  className="input-club w-full pr-12"
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Aviso privacidad */}
            <p className="text-xs text-muted-foreground leading-relaxed bg-club-verde-claro/20 rounded-lg p-3 border border-club-verde-claro/30">
              Al registrarte aceptás que tus datos son tratados conforme a la Ley 25.326 de Protección de Datos Personales de Argentina.
              Solo el personal autorizado del club accede a tu información.
            </p>

            <SubmitButton />

          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="text-club-dorado hover:text-club-dorado-claro underline underline-offset-2 transition-colors">
              Iniciar sesión
            </Link>
          </p>
        </>
      )}

    </motion.div>
  );
}

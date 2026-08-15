'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { login } from '@/app/actions/auth';
import type { ActionResponse } from '@/lib/types/database';

const initialState: ActionResponse = { ok: true, data: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full py-3.5 text-base">
      {pending ? (
        <><Loader2 className="w-5 h-5 animate-spin" /> Ingresando...</>
      ) : (
        <><LogIn className="w-5 h-5" /> Ingresar</>
      )}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(login, initialState);
  const [showPass, setShowPass] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-8">
        <h1 className="font-avigea text-3xl text-foreground mb-2">Bienvenido de vuelta</h1>
        <p className="text-muted-foreground text-sm">Ingresá con tu cuenta de socio</p>
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
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="input-club w-full pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <SubmitButton />

      </form>

      {/* Registro */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿No tenés cuenta?{' '}
        <Link href="/registro" className="text-club-dorado hover:text-club-dorado-claro underline underline-offset-2 transition-colors">
          Registrate
        </Link>
      </p>

    </motion.div>
  );
}

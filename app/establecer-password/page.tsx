'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Página a la que llega un usuario invitado por el admin:
// define su contraseña y entra a la app según su rol
export default function EstablecerPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const handleGuardar = async () => {
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return; }
    if (password !== confirmar) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updError } = await supabase.auth.updateUser({ password });
    if (updError) {
      setLoading(false);
      setError('No se pudo guardar la contraseña. Volvé a abrir el link del email.');
      return;
    }

    // Redirigir según el rol del perfil
    const { data: { user } } = await supabase.auth.getUser();
    let destino = '/socio/dashboard';
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
      if (profile?.rol === 'admin') destino = '/admin/dashboard';
    }

    setExito(true);
    setTimeout(() => router.replace(destino), 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full max-w-sm p-8 space-y-5"
      >
        {exito ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
            <h1 className="font-avigea text-2xl text-foreground mb-1">¡Listo!</h1>
            <p className="text-muted-foreground text-sm">Entrando al club...</p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-club-dorado/15 border border-club-dorado/25 flex items-center justify-center text-club-dorado mx-auto mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h1 className="font-avigea text-2xl text-foreground">Bienvenido al club</h1>
              <p className="text-muted-foreground text-sm mt-1">Elegí tu contraseña para empezar.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Contraseña</label>
                <input
                  type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-club w-full" placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div>
                <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Repetir contraseña</label>
                <input
                  type="password" value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  className="input-club w-full"
                  onKeyDown={e => e.key === 'Enter' && handleGuardar()}
                />
              </div>
            </div>

            {error && (
              <div className="px-3 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{error}</div>
            )}

            <button onClick={handleGuardar} disabled={loading} className="btn-primary w-full py-3">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar y entrar'}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Card de cambio de contraseña: verifica la actual re-autenticando
// y guarda la nueva. Sirve para socios (perfil) y admins (configuración).
export function CambiarPassword() {
  const [actual, setActual]     = useState('');
  const [nueva, setNueva]       = useState('');
  const [repetir, setRepetir]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [exito, setExito]       = useState(false);

  const handleGuardar = async () => {
    setError(null);
    if (nueva.length < 8) { setError('La nueva contraseña debe tener al menos 8 caracteres'); return; }
    if (nueva !== repetir) { setError('Las contraseñas nuevas no coinciden'); return; }
    if (nueva === actual)  { setError('La nueva contraseña debe ser distinta de la actual'); return; }

    setLoading(true);
    const supabase = createClient();

    // Verificar la contraseña actual re-autenticando al usuario
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      setLoading(false);
      setError('No se pudo verificar tu sesión. Volvé a iniciar sesión.');
      return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: actual,
    });
    if (authError) {
      setLoading(false);
      setError('La contraseña actual es incorrecta');
      return;
    }

    const { error: updError } = await supabase.auth.updateUser({ password: nueva });
    setLoading(false);
    if (updError) {
      setError('No se pudo actualizar la contraseña. Intentá de nuevo.');
      return;
    }

    setActual(''); setNueva(''); setRepetir('');
    setExito(true);
    setTimeout(() => setExito(false), 3000);
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-club-dorado" />
        <p className="text-foreground font-medium text-sm">Cambiar contraseña</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Contraseña actual</label>
          <input type="password" value={actual} onChange={e => setActual(e.target.value)}
            className="input-club w-full" autoComplete="current-password" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Nueva contraseña</label>
            <input type="password" value={nueva} onChange={e => setNueva(e.target.value)}
              className="input-club w-full" placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
          </div>
          <div>
            <label className="text-sm text-foreground/70 font-medium mb-1.5 block">Repetir nueva</label>
            <input type="password" value={repetir} onChange={e => setRepetir(e.target.value)}
              className="input-club w-full" autoComplete="new-password"
              onKeyDown={e => e.key === 'Enter' && handleGuardar()} />
          </div>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleGuardar}
          disabled={loading || !actual || !nueva || !repetir}
          className="btn-primary px-5 py-2.5 text-sm"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
            : exito
            ? <><CheckCircle2 className="w-4 h-4" /> Contraseña actualizada</>
            : 'Actualizar contraseña'}
        </button>
      </div>
    </div>
  );
}

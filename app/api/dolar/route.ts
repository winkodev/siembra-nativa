import { NextResponse } from 'next/server';
import { getProfile } from '@/lib/supabase/server';
import { obtenerCotizaciones } from '@/lib/dolar';

// Cotización del dólar para las pantallas de admin
export async function GET() {
  const profile = await getProfile();
  if (!profile || profile.rol !== 'admin') return NextResponse.json(null, { status: 403 });
  return NextResponse.json(await obtenerCotizaciones());
}

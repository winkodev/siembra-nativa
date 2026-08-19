'use server';

// Georef (Estado argentino) valida la calle pero no devuelve código
// postal. Se completa por reverse geocoding contra Nominatim/OSM,
// desde el servidor para identificar la app como pide su política.
export async function buscarCodigoPostal(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SiembraNativaClub/1.0 (club de cannabis medicinal, Argentina)' },
      // El CP de una coordenada no cambia: se cachea un día
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.address?.postcode ?? null;
  } catch {
    return null;
  }
}

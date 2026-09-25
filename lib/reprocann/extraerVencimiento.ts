import Anthropic from '@anthropic-ai/sdk';

type MimeCertificado = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

// Esquema de la herramienta: obliga al modelo a devolver la estructura exacta
// (tool use forzado) en vez de texto que después haya que parsear con regex.
const HERRAMIENTA_EXTRACCION: Anthropic.Tool = {
  name: 'registrar_vencimiento_reprocann',
  description: 'Registra la fecha de vencimiento leída de una credencial/certificado REPROCANN argentino.',
  input_schema: {
    type: 'object',
    properties: {
      reprocann_vencimiento: {
        type: ['string', 'null'],
        description:
          'Fecha de "Fecha vencimiento" en formato YYYY-MM-DD. La credencial suele mostrarla como dd/mm/aaaa (ej: "25/04/2029" => "2029-04-25"). null si no aparece.',
      },
    },
    required: ['reprocann_vencimiento'],
  },
};

// Lee la fecha de vencimiento de un certificado REPROCANN (PDF o imagen).
// Lo usa el admin como sugerencia: la fecha definitiva la confirma él a mano.
export async function extraerVencimientoReprocann(
  bytes: ArrayBuffer,
  mime: string
): Promise<{ ok: true; vencimiento: string | null } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: 'API key de Anthropic no configurada' };

  const base64 = Buffer.from(bytes).toString('base64');
  const isPdf  = mime === 'application/pdf';

  // Bloque de documento (PDF) o imagen, según el tipo de archivo. Va ANTES del texto.
  const sourceBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mime as Exclude<MimeCertificado, 'application/pdf'>, data: base64 } };

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      tools: [HERRAMIENTA_EXTRACCION],
      // Forzamos el uso de la herramienta => respuesta estructurada garantizada
      tool_choice: { type: 'tool', name: 'registrar_vencimiento_reprocann' },
      messages: [
        {
          role: 'user',
          content: [
            sourceBlock as never,
            {
              type: 'text',
              text:
                'Esta es una credencial/certificado REPROCANN argentino (Registro del Programa de Cannabis). ' +
                'Buscá el campo "Fecha vencimiento" y registralo con la herramienta. Si no aparece claramente, registralo como null.',
            },
          ],
        },
      ],
    });

    const toolBlock = msg.content.find(b => b.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      return { ok: false, error: 'No se pudo leer el certificado' };
    }

    const { reprocann_vencimiento } = toolBlock.input as { reprocann_vencimiento: string | null };
    return { ok: true, vencimiento: reprocann_vencimiento };
  } catch (e) {
    const detalle = e instanceof Error ? e.message : 'Error desconocido';
    return { ok: false, error: `Error al procesar el certificado: ${detalle}` };
  }
}

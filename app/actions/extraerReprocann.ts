'use server';

import Anthropic from '@anthropic-ai/sdk';
import type { ActionResponse, ReprocannCategoria } from '@/lib/types/database';

export interface DatosExtraidos {
  reprocann_numero:      string | null;
  reprocann_categoria:   ReprocannCategoria | null;
  reprocann_vencimiento: string | null; // YYYY-MM-DD
}

// Esquema de la herramienta: obliga al modelo a devolver la estructura exacta
// (tool use forzado) en vez de texto que después haya que parsear con regex.
const HERRAMIENTA_EXTRACCION: Anthropic.Tool = {
  name: 'registrar_datos_reprocann',
  description: 'Registra los datos extraídos de una credencial/certificado REPROCANN argentino.',
  input_schema: {
    type: 'object',
    properties: {
      reprocann_numero: {
        type: ['string', 'null'],
        description: 'Número de "Id trámite" de la credencial (ej: "375537"). null si no aparece.',
      },
      reprocann_categoria: {
        type: ['string', 'null'],
        enum: ['paciente_cultiva', 'tercero_cultivador', 'ong', null],
        description:
          'Categoría del titular. "Paciente con autocultivo"/"paciente que cultiva" => paciente_cultiva; ' +
          '"tercero cultivador"/"cultivador solidario" => tercero_cultivador; "ONG"/"asociación civil" => ong. null si no se puede determinar.',
      },
      reprocann_vencimiento: {
        type: ['string', 'null'],
        description:
          'Fecha de "Fecha vencimiento" en formato YYYY-MM-DD. La credencial suele mostrarla como dd/mm/aaaa (ej: "25/04/2029" => "2029-04-25"). null si no aparece.',
      },
    },
    required: ['reprocann_numero', 'reprocann_categoria', 'reprocann_vencimiento'],
  },
};

export async function extraerDatosReprocann(
  formData: FormData
): Promise<ActionResponse<DatosExtraidos>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: 'API key de Anthropic no configurada' };

  const archivo = formData.get('certificado') as File | null;
  if (!archivo || archivo.size === 0) return { ok: false, error: 'Sin archivo' };

  try {
    const bytes  = await archivo.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const isPdf  = archivo.type === 'application/pdf';

    const client = new Anthropic({ apiKey });

    // Bloque de documento (PDF) o imagen, según el tipo de archivo. Va ANTES del texto.
    const sourceBlock = isPdf
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: archivo.type as 'image/jpeg' | 'image/png' | 'image/webp', data: base64 } };

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [HERRAMIENTA_EXTRACCION],
      // Forzamos el uso de la herramienta => respuesta estructurada garantizada
      tool_choice: { type: 'tool', name: 'registrar_datos_reprocann' },
      messages: [
        {
          role: 'user',
          content: [
            sourceBlock as never,
            {
              type: 'text',
              text:
                'Esta es una credencial/certificado REPROCANN argentino (Registro del Programa de Cannabis). ' +
                'Extraé los datos del titular y registralos con la herramienta. ' +
                'Prestá atención a los campos "Id trámite", "Fecha vencimiento" y a la categoría del paciente ' +
                '(por ejemplo "Paciente con autocultivo"). Si un campo no aparece claramente, registralo como null.',
            },
          ],
        },
      ],
    });

    // Buscar el bloque tool_use con los datos
    const toolBlock = msg.content.find(b => b.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      return { ok: false, error: 'No se pudo leer el certificado' };
    }

    const datos = toolBlock.input as DatosExtraidos;
    return { ok: true, data: datos };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    return { ok: false, error: `Error al procesar el certificado: ${msg}` };
  }
}

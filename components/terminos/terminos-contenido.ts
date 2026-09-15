// ============================================================
// Texto de los Términos y Condiciones del club.
// Fuente única: se muestra en el perfil del socio (aceptación y consulta).
// Un párrafo puede ser un string o un array de strings (lista con viñetas).
// Si el club cambia el texto y quiere que todos vuelvan a aceptar, ver
// supabase/terminos-y-condiciones.sql.
// ============================================================

export type ParrafoTerminos = string | string[];

export interface SeccionTerminos {
  titulo:   string;
  parrafos: ParrafoTerminos[];
}

export const TERMINOS_ENCABEZADO = {
  organizacion: 'Asociación Civil Maria Nativa Club de Cultivo',
  datos:        'CUIT 30-71848590-4 · Resolución IPJ N° 113 C/24',
};

export const TERMINOS_INTRO =
  'Estos términos son exclusivos para socios y socias mayores de 18 años de la Asociación Civil Maria Nativa Club de Cultivo, ' +
  'CUIT 30-71848590-4, Resolución IPJ N° 113 C/24, con sede legal en Lote UNO, Manzana UNO, Sección "E", del Camino "Cerro Los Linderos", ' +
  'Km 3 ½, Villa Yacanto de Calamuchita, Departamento de Calamuchita, Provincia de Córdoba, Argentina, en adelante la "ONG" o "la Asociación". ' +
  'Al aceptar estos términos, declarás ser mayor de edad y contar con vínculo asociativo vigente con la ONG en el marco del programa REPROCANN (Ley 27.350).';

export const TERMINOS_SECCIONES: SeccionTerminos[] = [
  {
    titulo: '1. Marco legal: cultivo solidario bajo REPROCANN',
    parrafos: [
      'La Ley Nacional de Cannabis Medicinal N° 27.350 y su reglamentación (REPROCANN) reconocen el derecho de cada paciente a cultivar su propio cannabis medicinal, y prevén que una organización civil inscripta cultive en su nombre, de forma solidaria, cuando, por el motivo que sea, la persona no pueda ejercer ese derecho en su domicilio.',
      'Para retirar en el club, cada socio o socia debe contar con su propio trámite REPROCANN vigente, que designe a la Asociación como su cultivadora.',
      'Convertirte en socio o socia implica más que acceder a tu propio cultivo: tu aporte sostiene el funcionamiento de la Asociación, sus prácticas agroecológicas y su misión de acceso a la fitoterapia con cannabis medicinal para toda la comunidad de socios. Ser parte de Maria Nativa Club de Cultivo es asumir un rol activo como socio aportante, no el de un cliente que adquiere un producto.',
    ],
  },
  {
    titulo: '2. Declaración jurada del socio o socia',
    parrafos: [
      'Al registrarte como Socio o Socia Terapéutico/a y usuario/a de cannabis medicinal de la ONG, manifestás tu interés en darte de alta y declarás bajo juramento que:',
      [
        'Sos mayor de edad y estás en pleno uso de tus facultades legales e individuales.',
        'La información que proporcionás en el formulario de alta es precisa y verdadera, y entendés que constituye una declaración jurada, asumiendo todas las responsabilidades que esto conlleva.',
        'Tu solicitud se basa en la Ley 27.350 y en tu necesidad de acceder a opciones de salud que satisfagan tus necesidades integrales, reconociendo que tus recursos para el autocultivo son limitados en términos de continuidad y acceso a variedades terapéuticas.',
        'Reconocés que la ONG te ofrece un producto seguro, rastreable y probado, y te comprometés a cumplir con todas las regulaciones legales e institucionales establecidas.',
        'Te comprometés a utilizar tu membresía exclusivamente para uso personal y con fines terapéuticos, bajo la supervisión del equipo de salud de la organización y según lo establece REPROCANN.',
        'Confirmás que el personal de salud de la ONG te ha proporcionado toda la información necesaria, incluida la obligación de poseer el permiso REPROCANN vigente, el cual adjuntás como comprobante al momento de tu registro.',
        'Das tu consentimiento para ser contactado/a por email a fin de recibir información relevante que la ONG considere oportuna.',
      ],
    ],
  },
  {
    titulo: '3. Qué es (y qué no es) este servicio',
    parrafos: [
      'Lo que reservás no es una compra: es la entrega de tu propio cultivo, amparado por tu vínculo REPROCANN con la Asociación. Podés retirarlo en la sede del club o, si tu membresía lo incluye, pedir que te lo llevemos a tu domicilio. El traslado lo hace la Asociación con la carta de porte que exige la normativa vigente, y la cantidad que se traslada nunca supera lo que ampara tu credencial.',
      'Este sitio no procesa pagos: tu aporte se coordina aparte.',
    ],
  },
  {
    titulo: '4. Tus datos personales',
    parrafos: [
      'El formulario de solicitud pide tu nombre, correo electrónico, celular y DNI, y te ofrece adjuntar una foto o PDF de tu REPROCANN, que puede ser tu credencial o tu certificado de trámite. El DNI lo pedimos porque es el dato con el que el REPROCANN identifica a cada persona, y sin él no podemos vincular tu trámite con el de la asociación.',
      'Mientras sos socio:',
      [
        'Tu ficha en el padrón: nombre, DNI, teléfono, plan y aportes.',
        'El estado de tu trámite de REPROCANN, su código de vinculación y su fecha de vencimiento.',
        'El documento de tu REPROCANN, la credencial o el certificado, si lo cargaste vos o lo cargó el equipo, para que puedas descargarlo desde tu cuenta.',
        'Tus reservas y tus retiros, con fecha, cantidades y las notas que escribas.',
      ],
      'Cuando navegás:',
      'Guardamos una cookie de sesión propia para mantenerte identificado dentro del portal, y registramos visitas y clics de forma agregada para saber qué partes del sitio se usan. Ese registro no arma un perfil tuyo ni se cruza con tu ficha de socio.',
      'Para qué los usamos:',
      [
        'Vincular tu REPROCANN con el de la asociación, que es la razón de ser del club.',
        'Preparar y entregarte lo que reservás, y avisarte cuando está listo.',
        'Avisarte si tu REPROCANN está por vencer.',
        'Llevar la contabilidad de la asociación y cumplir con las obligaciones que nos exige la normativa del REPROCANN.',
      ],
      'No usamos tus datos para publicidad, no armamos perfiles de consumo y no vendemos ni cedemos tu información a nadie.',
    ],
  },
  {
    titulo: '5. Tus derechos sobre tus datos',
    parrafos: [
      'La Ley 25.326 de Protección de Datos Personales te da derecho a pedirnos, en cualquier momento y sin tener que justificarlo:',
      [
        'Acceso: que te contemos qué datos tuyos tenemos.',
        'Rectificación: que corrijamos lo que esté mal.',
        'Actualización: que pongamos al día lo que cambió.',
        'Supresión: que borremos lo que ya no corresponda conservar.',
      ],
      'Para ejercer cualquiera de estos derechos, podés escribirnos a través del formulario de contacto de la web o a hola@siembranativa.com.ar.',
    ],
  },
  {
    titulo: '6. La información del catálogo es orientativa',
    parrafos: [
      'THC, CBD y demás datos publicados son de referencia y pueden variar de lote a lote. Las fotos son ilustrativas, gentileza de los bancos de semillas de las genéticas que cultivamos, y no reflejan necesariamente la cosecha exacta que vas a retirar. Nada de lo publicado acá reemplaza la indicación de tu médica o médico tratante.',
    ],
  },
  {
    titulo: '7. Disponibilidad, baja del servicio e inactividad',
    parrafos: [
      'La disponibilidad de cada genética puede cambiar entre tu reserva y el retiro; te avisamos si hay cambios.',
      'El club puede, a su criterio, dar de baja el acceso de un socio o socia a la carta ante un uso indebido del servicio.',
      'Asimismo, si un socio o socia no solicita dispensa durante un período de inactividad a determinar por la ONG, la Asociación podrá dar de baja su membresía, previa notificación al socio o socia por los medios de contacto registrados.',
      'Si tu REPROCANN vence y no es renovado dentro de un plazo razonable notificado por la Asociación, tu acceso a la carta quedará suspendido hasta regularizar la situación. Esta suspensión no implica automáticamente la baja de tu membresía, salvo que la falta de renovación se extienda más allá del período de inactividad mencionado en el párrafo anterior.',
      'El socio o socia puede solicitar su desvinculación de la Asociación en cualquier momento, sin necesidad de expresar los motivos, escribiendo a través del formulario de contacto de la web o a hola@siembranativa.com.ar.',
    ],
  },
  {
    titulo: '8. Cambios a estos términos',
    parrafos: [
      'Podemos actualizar este texto. Si el cambio es importante, te vamos a pedir que lo aceptes de nuevo la próxima vez que entres.',
    ],
  },
  {
    titulo: '9. Ley aplicable',
    parrafos: [
      'Estos términos se rigen por las leyes de la República Argentina. Ante cualquier consulta, escribinos a través del formulario de contacto de la web o a hola@siembranativa.com.ar.',
    ],
  },
];

// Define TODO lo editable del sitio. El dashboard se dibuja a partir de este archivo,
// así que para agregar un campo nuevo solo lo agregas aquí y en el HTML (data-cms="clave").
// type: text | textarea | image | url | list
const SECTIONS = [
  {
    id: 'general', title: 'General', icon: '◈', link: '/',
    desc: 'Nombre, fondo animado del sitio y pie de página.',
    fields: [
      { key: 'site_name', label: 'Nombre / logo (navbar)', type: 'text', max: 20, def: 'ICCA' },
      { key: 'artist_name', label: 'Nombre de la artista (se muestra en la galería)', type: 'text', max: 80, def: 'ICCA' },
      { key: 'bg_image', label: 'Imagen de fondo animado', type: 'image', help: 'Se ve detrás de todo el inicio. Mejor una imagen oscura y horizontal.' },
      { key: 'footer_tagline', label: 'Frase del pie de página', type: 'text', max: 120, def: 'Galería de Arte Místico & Atalaya Visual' },
      { key: 'footer_copy', label: 'Texto de derechos', type: 'text', max: 120, def: '© 2026 ICCA. Todos los derechos reservados.' },
      { key: 'toast_text', label: 'Aviso de protección de imágenes', type: 'text', max: 120, def: '🔒 Contenido protegido por derechos de autor - ICCA' },
    ],
  },
  {
    id: 'hero', title: 'Inicio (portada)', icon: '✦', link: '/#inicio',
    desc: 'Lo primero que ve la gente al entrar.',
    fields: [
      { key: 'hero_tag', label: 'Etiqueta superior', type: 'text', max: 40, def: 'OBRA DE ARTE & ATALAYA' },
      { key: 'hero_title_1', label: 'Título — línea 1', type: 'text', max: 40, def: 'EL ARTE ES LA' },
      { key: 'hero_title_2', label: 'Título — línea 2 (color destacado)', type: 'text', max: 40, def: 'SOMBRA Y LA LUZ' },
      { key: 'hero_title_3', label: 'Título — línea 3', type: 'text', max: 40, def: 'DE LA MENTE' },
      { key: 'hero_desc', label: 'Descripción', type: 'textarea', max: 300, def: 'Sumérgete en el universo místico e inmersivo de ICCA. Un recorrido visual donde cada trazo desafía lo cotidiano.' },
      { key: 'hero_button', label: 'Texto del botón', type: 'text', max: 30, def: 'Explorar Galería' },
      { key: 'hero_image', label: 'Obra principal (tarjeta 3D)', type: 'image' },
    ],
  },
  {
    id: 'featured', title: 'Obras destacadas', icon: '▣', link: '/#galeria',
    desc: 'Las 3 obras de la selección del inicio.',
    fields: [
      { key: 'featured_subtitle', label: 'Subtítulo de sección', type: 'text', max: 40, def: 'SELECCIÓN EXCLUSIVA' },
      { key: 'featured_title', label: 'Título de sección', type: 'text', max: 40, def: 'OBRAS DESTACADAS' },
      { key: 'featured_1_image', label: 'Obra 1 — imagen', type: 'image' },
      { key: 'featured_1_title', label: 'Obra 1 — título', type: 'text', max: 60, def: 'El Vuelo de la Noche' },
      { key: 'featured_1_sub', label: 'Obra 1 — técnica / nota', type: 'text', max: 60, def: 'Tinta & óleo sobre lienzo' },
      { key: 'featured_2_image', label: 'Obra 2 — imagen', type: 'image' },
      { key: 'featured_2_title', label: 'Obra 2 — título', type: 'text', max: 60, def: 'El Aquelarre Rojo' },
      { key: 'featured_2_sub', label: 'Obra 2 — técnica / nota', type: 'text', max: 60, def: 'Edición Limitada 2024' },
      { key: 'featured_3_image', label: 'Obra 3 — imagen', type: 'image' },
      { key: 'featured_3_title', label: 'Obra 3 — título', type: 'text', max: 60, def: 'La Atalaya Silenciosa' },
      { key: 'featured_3_sub', label: 'Obra 3 — técnica / nota', type: 'text', max: 60, def: 'Técnica Mixta Mística' },
    ],
  },
  {
    id: 'marquee', title: 'Franja en movimiento', icon: '≋', link: '/',
    desc: 'La franja inclinada con texto que se repite.',
    fields: [
      { key: 'marquee_text', label: 'Texto que se repite', type: 'text', max: 40, def: 'ARTE MODERNO' },
    ],
  },
  {
    id: 'secrets', title: 'Secretos y conceptos', icon: '❖', link: '/#revelaciones',
    desc: 'Las cartas que se voltean al hacer clic.',
    fields: [
      { key: 'secrets_subtitle', label: 'Subtítulo', type: 'text', max: 50, def: 'REVELACIONES DEL ARTISTA' },
      { key: 'secrets_title', label: 'Título', type: 'text', max: 50, def: 'SECRETOS & CONCEPTOS' },
      { key: 'secrets_desc', label: 'Descripción', type: 'textarea', max: 250, def: 'Haz clic sobre cualquier carta para voltearla y descubrir los fundamentos detrás de la obra.' },
      {
        key: 'secrets_cards', label: 'Cartas', type: 'list', max: 8, addLabel: 'Agregar carta',
        itemFields: [
          { key: 'title', label: 'Título', type: 'text', max: 40 },
          { key: 'subtitle', label: 'Subtítulo', type: 'text', max: 50 },
          { key: 'text', label: 'Texto', type: 'textarea', max: 300 },
        ],
        def: [
          { title: 'FILOSOFÍA MÍSTICA', subtitle: 'Visión & Espiritualidad', text: 'ICCA explora la frontera entre la penumbra y la revelación en cada lienzo, transformando el mito en un reflejo del alma humana.' },
          { title: 'TÉCNICA & ÓLEO', subtitle: 'Proceso Creativo', text: 'Aplica capas traslúcidas de pigmento volcánico y tinta china para crear profundidades tridimensionales únicas.' },
          { title: 'SÍMBOLOS OCULTOS', subtitle: 'Iconografía Ritual', text: 'Las criaturas místicas en sus obras encarnan los instintos primitivos y la búsqueda insaciable de conocimiento.' },
          { title: 'PALETA DE PENUMBRA', subtitle: 'Selección Cromática', text: 'Predominan los tonos borgoña, carmesí oscuro y negros profundos para intensificar el dramatismo de cada composición.' },
          { title: 'GALERÍAS PRIVADAS', subtitle: 'Colecciones Exclusivas', text: 'Sus piezas forman parte de exhibiciones privadas alrededor del mundo, reservadas para apasionados del arte conceptual.' },
          { title: 'ATALAYA CONCEPTUAL', subtitle: 'Punto de Observación', text: 'Cada obra actúa como una ventana hacia un observatorio donde el espectador es invitado a cuestionar su realidad.' },
        ],
      },
    ],
  },
  {
    id: 'experience', title: 'Lienzo oculto (rasca-rasca)', icon: '◉', link: '/#experiencia',
    desc: 'La obra que se revela al pasar el cursor.',
    fields: [
      { key: 'exp_image', label: 'Obra oculta', type: 'image' },
      { key: 'exp_subtitle', label: 'Subtítulo', type: 'text', max: 40, def: 'EXPERIENCIA TÁCTIL' },
      { key: 'exp_title', label: 'Título', type: 'text', max: 40, def: 'EL LIENZO OCULTO' },
      { key: 'exp_text_1', label: 'Párrafo 1', type: 'textarea', max: 500, def: 'El proceso pictórico de ICCA es una superposición constante de capas donde cada pigmento esconde un significado latente. Esta pieza representa la velación del misterio y la revelación a través del contacto con el espectador.' },
      { key: 'exp_text_2', label: 'Párrafo 2', type: 'textarea', max: 500, def: 'Al interactuar con la superficie digital, remueves el velo de la penumbra para descubrir la esencia cromática que subyace en la composición original.' },
      { key: 'exp_technique', label: 'Técnica', type: 'text', max: 60, def: 'Óleo & Pigmento Volcánico' },
      { key: 'exp_dimensions', label: 'Dimensiones', type: 'text', max: 40, def: '120 x 160 cm' },
    ],
  },
  {
    id: 'contact', title: 'Contacto', icon: '✉', link: '/#contacto',
    desc: 'Redes, WhatsApp y a qué correo llegan los mensajes del formulario.',
    fields: [
      { key: 'contact_subtitle', label: 'Subtítulo', type: 'text', max: 40, def: 'CONECTA CON LA ARTISTA' },
      { key: 'contact_title', label: 'Título', type: 'text', max: 40, def: 'CONTÁCTANOS' },
      { key: 'contact_desc', label: 'Descripción', type: 'textarea', max: 250, def: '¿Interesado en adquirir obras, encargos privados o exposiciones? Escríbenos directamente.' },
      { key: 'instagram_url', label: 'Instagram — enlace', type: 'url', max: 200, def: 'https://instagram.com' },
      { key: 'instagram_handle', label: 'Instagram — usuario', type: 'text', max: 40, def: '@icca.art' },
      { key: 'whatsapp_number', label: 'WhatsApp — número (solo dígitos con lada, ej. 5213121234567)', type: 'text', max: 20, def: '1234567890' },
      { key: 'whatsapp_display', label: 'WhatsApp — cómo se muestra', type: 'text', max: 30, def: '+52 (123) 456-7890' },
      { key: 'contact_email', label: 'Correo (se muestra y recibe los mensajes del formulario)', type: 'text', max: 100, def: 'contacto@icca-art.com' },
    ],
  },
];

const ARTWORK_FIELDS = [
  { key: 'title', label: 'Título', type: 'text', max: 100, required: true },
  { key: 'image', label: 'Imagen de la obra', type: 'image', required: true },
  { key: 'year', label: 'Año', type: 'text', max: 30 },
  { key: 'category', label: 'Técnica / categoría', type: 'text', max: 60 },
  { key: 'location', label: 'Ubicación / colección', type: 'text', max: 100 },
  { key: 'context', label: 'Contexto', type: 'textarea', max: 1200 },
  { key: 'technique', label: 'Técnica (detalle)', type: 'textarea', max: 1200 },
  { key: 'symbolism', label: 'Simbolismo', type: 'textarea', max: 1200 },
  { key: 'secrets', label: 'Secretos / curiosidades', type: 'textarea', max: 1200 },
  { key: 'audio_text', label: 'Texto de la audioguía (lo lee la voz del navegador)', type: 'textarea', max: 1500 },
];

const FIELD_INDEX = {};
for (const s of SECTIONS) for (const f of s.fields) FIELD_INDEX[f.key] = f;

module.exports = { SECTIONS, ARTWORK_FIELDS, FIELD_INDEX };

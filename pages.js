"use strict";

// ==========================================
// DIRECCIÓN DE LA WEB
// Hoy: https://nappix.onrender.com
// Cuando compres tu dominio, solo cambia la variable BASE_URL en Render
// (por ejemplo https://nappix.com). No hace falta tocar el código.
// ==========================================

const BASE_URL = (process.env.BASE_URL || "https://nappix.onrender.com").replace(/\/+$/, "");
const SITE = "ÑAPPIX";

let CANONICAL_HOST = "";
try {
  CANONICAL_HOST = new URL(BASE_URL).hostname;
} catch (e) {
  console.error("BASE_URL no es una dirección válida:", BASE_URL);
}

// Opcional: cuando el dominio nuevo ya funcione, pon REDIRECT_TO_BASE=1 en Render
// y cualquier visita a otra dirección (como onrender.com) se redirige al dominio nuevo.
function canonicalRedirect(req, res, next) {
  if (
    process.env.REDIRECT_TO_BASE === "1" &&
    CANONICAL_HOST &&
    (req.method === "GET" || req.method === "HEAD") &&
    req.hostname !== CANONICAL_HOST &&
    !req.path.startsWith("/api/")
  ) {
    return res.redirect(301, BASE_URL + req.originalUrl);
  }
  next();
}

// ==========================================
// DATOS DE LAS HERRAMIENTAS
// ==========================================

const CATEGORIES = [
  { id: "images", icon: "🖼️", title: "Herramientas de imágenes" },
  { id: "pdf", icon: "📄", title: "Herramientas PDF" },
  { id: "extra", icon: "🧰", title: "Herramientas adicionales" },
  { id: "media", icon: "🎬", title: "Herramientas de audio y video" }
];

const opt = (value, label, selected) => ({
  value,
  label: label || String(value).toUpperCase(),
  selected: Boolean(selected)
});
const opts = list => list.map(v => opt(v));

const imageFile = {
  type: "file", name: "file", label: "Selecciona una imagen",
  accept: "image/jpeg,image/png,image/webp", required: true,
  hint: "JPG, PNG o WEBP · máximo 15 MB"
};
const pdfFile = label => ({
  type: "file", name: "file", label: label || "Selecciona un PDF",
  accept: "application/pdf", required: true, hint: "Máximo 25 MB"
});
const mediaFile = (label, accept) => ({
  type: "file", name: "file", label,
  accept: accept || "audio/*,video/*", required: true, hint: "Máximo 50 MB"
});

const TOOLS = [
  // ---------------- IMÁGENES ----------------
  {
    slug: "convertir-imagenes", category: "images", icon: "🔄",
    name: "Convertir imágenes", short: "Convierte JPG, PNG y WEBP.",
    metaTitle: "Convertir imágenes online gratis: JPG, PNG, WEBP | ÑAPPIX",
    metaDescription: "Convierte tus imágenes entre JPG, PNG y WEBP en segundos, gratis y sin registrarte. Sube tu archivo, elige el formato y descárgalo.",
    description: "Transforma tus imágenes a otro formato.",
    endpoint: "/api/convert/image",
    fields: [imageFile, { type: "select", name: "format", label: "Formato de salida", options: opts(["png", "jpg", "webp"]) }],
    intro: "Cambia el formato de una imagen sin instalar programas. Puedes pasar de PNG a JPG para que pese menos, de JPG a WEBP para tu página web, o de WEBP a PNG cuando necesites que otro programa la reconozca.",
    steps: ["Selecciona la imagen (JPG, PNG o WEBP).", "Elige el formato de salida.", "Pulsa «Procesar archivo» y la descarga comenzará automáticamente."],
    tip: "El tamaño máximo es de 15 MB por imagen. El formato JPG no admite transparencia, así que si conviertes un PNG transparente a JPG perderás esa transparencia."
  },
  {
    slug: "comprimir-imagenes", category: "images", icon: "📉",
    name: "Comprimir imágenes", short: "Reduce el peso de tus imágenes.",
    metaTitle: "Comprimir imágenes online gratis: JPG, PNG, WEBP | ÑAPPIX",
    metaDescription: "Reduce el peso de tus fotos e imágenes JPG, PNG y WEBP sin complicarte. Gratis, rápido y sin registro. Súbela y descarga la versión comprimida.",
    description: "Reduce el tamaño del archivo de imagen.",
    endpoint: "/api/compress/image",
    fields: [imageFile],
    intro: "Las imágenes pesadas hacen lentas las páginas web y llenan el correo y el almacenamiento. Esta herramienta reduce el peso de tu imagen manteniendo su formato original, para que sea más fácil de enviar, subir o publicar.",
    steps: ["Selecciona una imagen JPG, PNG o WEBP.", "Pulsa «Procesar archivo».", "Descarga la imagen comprimida; el nombre termina en «-comprimida»."],
    tip: "En JPG y WEBP se aplica una compresión con una ligera pérdida de calidad; en PNG la compresión no pierde calidad. Si la imagen ya estaba optimizada, es normal que cambie poco. Tamaño máximo: 15 MB."
  },
  {
    slug: "cambiar-tamano-imagen", category: "images", icon: "📐",
    name: "Cambiar tamaño", short: "Ajusta las dimensiones de una imagen.",
    metaTitle: "Cambiar el tamaño de una imagen online gratis | ÑAPPIX",
    metaDescription: "Redimensiona tus imágenes indicando el ancho y el alto en píxeles. Mantiene las proporciones, es gratis y no necesitas registrarte.",
    description: "Ajusta las dimensiones de tu imagen.",
    endpoint: "/api/resize/image",
    fields: [
      imageFile,
      { type: "number", name: "width", label: "Ancho en píxeles", value: 800 },
      { type: "number", name: "height", label: "Alto en píxeles", value: 800 }
    ],
    intro: "Redimensiona una imagen para redes sociales, tiendas online, documentos o formularios que piden un tamaño máximo. Indica el ancho y el alto en píxeles y ÑAPPIX ajusta la imagen dentro de esas medidas.",
    steps: ["Selecciona la imagen.", "Escribe el ancho y el alto en píxeles.", "Pulsa «Procesar archivo» y descarga la imagen redimensionada."],
    tip: "La imagen conserva sus proporciones: cabe dentro del ancho y el alto indicados sin deformarse, y nunca se agranda por encima de su tamaño original. El resultado se descarga en PNG. Máximo 5000 píxeles por lado."
  },

  // ---------------- PDF ----------------
  {
    slug: "unir-pdf", category: "pdf", icon: "📚",
    name: "Unir PDF", short: "Combina varios documentos PDF.",
    metaTitle: "Unir PDF online gratis: combina varios PDF en uno | ÑAPPIX",
    metaDescription: "Une varios archivos PDF en un solo documento en segundos. Gratis, sin registro y sin instalar programas. Sube tus PDF y descarga el resultado.",
    description: "Selecciona dos o más documentos PDF.",
    endpoint: "/api/pdf/merge",
    fields: [{
      type: "file", name: "files", label: "Selecciona los PDF",
      accept: "application/pdf", multiple: true, required: true,
      hint: "Entre 2 y 10 archivos · máximo 25 MB cada uno"
    }],
    intro: "Combina contratos, facturas, certificados o trabajos escaneados en un único archivo PDF para enviarlo o archivarlo con más facilidad.",
    steps: ["Selecciona dos o más archivos PDF (hasta 10).", "Pulsa «Procesar archivo».", "Descarga el PDF unido."],
    tip: "Cada PDF puede pesar hasta 25 MB. Si un archivo está protegido con contraseña, ábrelo antes y guárdalo sin protección para poder unirlo."
  },
  {
    slug: "dividir-pdf", category: "pdf", icon: "✂️",
    name: "Dividir PDF", short: "Extrae un rango de páginas.",
    metaTitle: "Dividir PDF online gratis: extrae páginas | ÑAPPIX",
    metaDescription: "Extrae un rango de páginas de un PDF y guárdalas como un nuevo documento. Gratis, rápido y sin registrarte.",
    description: "Extrae un rango de páginas de un documento.",
    endpoint: "/api/pdf/split",
    fields: [
      pdfFile(),
      { type: "number", name: "start", label: "Página inicial", value: 1 },
      { type: "number", name: "end", label: "Página final", value: 2 }
    ],
    intro: "¿Solo necesitas algunas páginas de un documento largo? Indica la página inicial y la final y obtén un nuevo PDF únicamente con ese rango.",
    steps: ["Selecciona el PDF.", "Escribe la página inicial y la página final.", "Pulsa «Procesar archivo» y descarga el nuevo PDF."],
    tip: "Si quieres una sola página, escribe el mismo número en la inicial y en la final. Tamaño máximo: 25 MB."
  },
  {
    slug: "eliminar-paginas-pdf", category: "pdf", icon: "🗑️",
    name: "Eliminar páginas PDF", short: "Quita las páginas que no necesitas.",
    metaTitle: "Eliminar páginas de un PDF online gratis | ÑAPPIX",
    metaDescription: "Quita páginas de un PDF indicando los números o rangos que no necesitas. Gratis, sin registro y sin instalar nada.",
    description: "Indica las páginas que deseas quitar. Puedes escribir 2, 4 o 6-8.",
    endpoint: "/api/pdf/delete-pages",
    fields: [
      pdfFile(),
      { type: "text", name: "pages", label: "Páginas que deseas eliminar", placeholder: "Ejemplo: 2, 4, 6-8", required: true }
    ],
    intro: "Elimina páginas en blanco, portadas o anexos que no necesitas de un documento PDF. Escribe los números de página separados por comas, o un rango con guion.",
    steps: ["Selecciona el PDF.", "Escribe las páginas a eliminar, por ejemplo: 2, 4, 6-8.", "Descarga el PDF sin esas páginas."],
    tip: "No es posible eliminar todas las páginas del documento. Tamaño máximo: 25 MB."
  },
  {
    slug: "rotar-pdf", category: "pdf", icon: "🔃",
    name: "Rotar PDF", short: "Gira las páginas de tu documento.",
    metaTitle: "Rotar PDF online gratis: gira las páginas | ÑAPPIX",
    metaDescription: "Gira todas las páginas de tu PDF 90, 180 o 270 grados. Corrige documentos escaneados al revés, gratis y sin registro.",
    description: "Gira todas las páginas del documento.",
    endpoint: "/api/pdf/rotate",
    fields: [
      pdfFile(),
      { type: "select", name: "degrees", label: "Rotación", options: [opt("90", "90°"), opt("180", "180°"), opt("270", "270°")] }
    ],
    intro: "Si escaneaste un documento al revés o de lado, esta herramienta lo corrige girando todas las páginas del PDF en el ángulo que elijas.",
    steps: ["Selecciona el PDF.", "Elige cuántos grados quieres girarlo.", "Pulsa «Procesar archivo» y descarga el PDF rotado."],
    tip: "La rotación se aplica a todas las páginas del documento. Tamaño máximo: 25 MB."
  },
  {
    slug: "pdf-a-word", category: "pdf", icon: "📝",
    name: "PDF a Word", short: "Extrae texto y crea un documento DOCX.",
    metaTitle: "PDF a Word online gratis: convierte PDF a DOCX | ÑAPPIX",
    metaDescription: "Convierte el texto de tu PDF en un documento de Word (DOCX) editable. Gratis y sin registro. Funciona con PDF que tengan texto seleccionable.",
    description: "Extrae texto seleccionable y crea un documento DOCX. Los PDF escaneados pueden necesitar OCR.",
    endpoint: "/api/pdf/to-word",
    fields: [pdfFile()],
    intro: "Extrae el texto de un PDF y genera un documento de Word que puedes editar, copiar o reutilizar.",
    steps: ["Selecciona el PDF.", "Pulsa «Procesar archivo».", "Descarga el documento de Word (DOCX)."],
    tip: "La herramienta extrae el texto, pero no conserva el diseño original: no se mantienen imágenes, tablas ni formatos. Los PDF escaneados son imágenes, no tienen texto seleccionable y no se pueden convertir. Tamaño máximo: 25 MB."
  },
  {
    slug: "pdf-a-jpg-png", category: "pdf", icon: "🖼️",
    name: "PDF a JPG / PNG", short: "Convierte las páginas en imágenes.",
    metaTitle: "PDF a JPG y PNG online gratis: páginas a imágenes | ÑAPPIX",
    metaDescription: "Convierte cada página de un PDF en una imagen JPG o PNG y descárgalas juntas en un ZIP. Gratis y sin registro.",
    description: "Convierte cada página en JPG o PNG y las descarga juntas en un ZIP.",
    endpoint: "/api/pdf/to-images",
    fields: [
      pdfFile("Selecciona un PDF (máximo 30 páginas)"),
      { type: "select", name: "format", label: "Formato de imagen", options: opts(["jpg", "png"]) }
    ],
    intro: "Convierte las páginas de un PDF en imágenes para publicarlas en redes sociales, insertarlas en una presentación o compartirlas por mensaje. Cada página se guarda como una imagen.",
    steps: ["Selecciona el PDF.", "Elige el formato de imagen: JPG o PNG.", "Descarga el ZIP con una imagen por página."],
    tip: "Se admiten hasta 30 páginas por PDF y 25 MB. Las imágenes se descargan juntas en un archivo ZIP."
  },

  // ---------------- ADICIONALES ----------------
  {
    slug: "crear-codigo-qr", category: "extra", icon: "🔳",
    name: "Crear código QR", short: "Genera un QR para un texto o enlace.",
    metaTitle: "Crear código QR gratis para enlaces y texto | ÑAPPIX",
    metaDescription: "Genera un código QR para cualquier enlace o texto y descárgalo en PNG de alta calidad. Gratis, sin registro y sin marcas de agua.",
    description: "Crea un código QR para un enlace o texto.",
    endpoint: "/api/qr", json: true, button: "Generar código QR",
    fields: [{ type: "text", name: "text", label: "Escribe un enlace o texto", placeholder: "https://ejemplo.com", required: true }],
    intro: "Crea un código QR para tu página web, tu perfil de Instagram, el menú de un restaurante, un chat de WhatsApp o cualquier texto. Se descarga como imagen PNG de 800 píxeles, lista para imprimir o compartir.",
    steps: ["Escribe o pega el enlace o el texto.", "Pulsa «Generar código QR».", "Descarga tu código QR en PNG."],
    tip: "Puedes usar hasta 2.000 caracteres. El código se genera con un alto nivel de corrección de errores, lo que ayuda a que se lea bien aunque se imprima pequeño o se ensucie un poco."
  },
  {
    slug: "comprimir-archivos-zip", category: "extra", icon: "🗜️",
    name: "Comprimir archivos ZIP", short: "Guarda varios archivos en un ZIP.",
    metaTitle: "Crear ZIP online gratis: comprime varios archivos | ÑAPPIX",
    metaDescription: "Agrupa varios archivos en un solo ZIP en segundos. Gratis, sin registro y sin instalar programas.",
    description: "Agrupa hasta cinco archivos en un solo ZIP.",
    endpoint: "/api/zip",
    fields: [{
      type: "file", name: "files", label: "Selecciona tus archivos",
      multiple: true, required: true, hint: "Hasta 5 archivos · máximo 50 MB cada uno"
    }],
    intro: "Reúne varios archivos en un único ZIP para enviarlos por correo o subirlos a una plataforma de forma más cómoda.",
    steps: ["Selecciona hasta 5 archivos.", "Pulsa «Procesar archivo».", "Descarga el ZIP con tus archivos."],
    tip: "El ZIP no siempre reduce mucho el peso, sobre todo con archivos que ya vienen comprimidos, como JPG, MP3 o MP4. Puedes agregar hasta 5 archivos de 50 MB cada uno."
  },

  // ---------------- AUDIO Y VIDEO ----------------
  {
    slug: "convertir-audio-video", category: "media", icon: "🔄",
    name: "Convertir audio y video", short: "Convierte MP4, WEBM, MP3, WAV y OGG.",
    metaTitle: "Convertir audio y video online gratis | ÑAPPIX",
    metaDescription: "Convierte tus archivos de audio y video a MP4, WEBM, MP3, WAV u OGG. Gratis y sin registro, hasta 50 MB.",
    description: "Convierte archivos multimedia a formatos compatibles.",
    endpoint: "/api/media/convert",
    fields: [
      mediaFile("Selecciona un archivo multimedia"),
      { type: "select", name: "format", label: "Formato de salida", options: opts(["mp4", "webm", "mp3", "wav", "ogg"]) }
    ],
    intro: "Cambia el formato de un video o de un audio para reproducirlo en tu celular, subirlo a una plataforma o editarlo. Puedes sacar un MP3 de un video, pasar un audio a WAV o convertir a MP4 o WEBM.",
    steps: ["Selecciona el archivo de audio o video.", "Elige el formato de salida.", "Pulsa «Procesar archivo» y descarga el resultado."],
    tip: "Tamaño máximo de 50 MB por archivo. Los videos pueden tardar un poco más: si hay muchas personas usando la herramienta, tu archivo esperará su turno."
  },
  {
    slug: "recortar-video", category: "media", icon: "🎞️",
    name: "Recortar video", short: "Extrae un fragmento de un video.",
    metaTitle: "Recortar video online gratis: corta un fragmento | ÑAPPIX",
    metaDescription: "Corta un fragmento de tu video indicando el segundo de inicio y la duración. Gratis, sin registro y con resultado en MP4.",
    description: "Extrae un fragmento de tu video. El resultado se guarda en MP4.",
    endpoint: "/api/media/cut",
    fields: [
      mediaFile("Selecciona un video", "video/*"),
      { type: "number", name: "start", label: "Inicio en segundos", value: 0 },
      { type: "number", name: "duration", label: "Duración en segundos", value: 10 }
    ],
    intro: "Quédate solo con la parte del video que te interesa. Indica en qué segundo empieza el fragmento y cuánto dura, y descarga el recorte listo para compartir.",
    steps: ["Selecciona el video.", "Indica el segundo de inicio y la duración del fragmento.", "Pulsa «Procesar archivo» y descarga el recorte en MP4."],
    tip: "Tamaño máximo: 50 MB. La duración del fragmento puede ser de hasta 60 minutos."
  },
  {
    slug: "extraer-audio", category: "media", icon: "🎵",
    name: "Extraer audio", short: "Obtén el audio de un video.",
    metaTitle: "Extraer audio de un video online gratis (MP3) | ÑAPPIX",
    metaDescription: "Extrae el audio de un video y descárgalo en MP3. Gratis, sin registro y sin instalar programas.",
    description: "Extrae la pista de audio de un archivo multimedia y guárdala en MP3.",
    endpoint: "/api/media/audio",
    fields: [mediaFile("Selecciona un archivo multimedia")],
    intro: "Saca la pista de audio de un video para guardar una charla, una canción propia o una grabación en formato MP3.",
    steps: ["Selecciona el video o el audio.", "Pulsa «Procesar archivo».", "Descarga el audio en MP3."],
    tip: "Usa únicamente videos propios o sobre los que tengas autorización. Tamaño máximo: 50 MB."
  },
  {
    slug: "cortar-audio", category: "media", icon: "✂️",
    name: "Cortar audio", short: "Recorta un fragmento y guárdalo en MP3.",
    metaTitle: "Cortar audio online gratis: recorta un MP3 | ÑAPPIX",
    metaDescription: "Corta un fragmento de un audio indicando el segundo de inicio y la duración. Gratis, sin registro y con resultado en MP3.",
    description: "Indica desde qué segundo comienza el corte y cuánto debe durar. El resultado será MP3.",
    endpoint: "/api/media/audio-cut",
    fields: [
      mediaFile("Selecciona un archivo de audio o video"),
      { type: "number", name: "start", label: "Inicio en segundos", value: 0 },
      { type: "number", name: "duration", label: "Duración en segundos", value: 10 }
    ],
    intro: "Recorta un fragmento de un audio, o del audio de un video, para usarlo como nota de voz, intro, muestra o tono.",
    steps: ["Selecciona el archivo.", "Indica el segundo de inicio y la duración del corte.", "Pulsa «Procesar archivo» y descarga el MP3."],
    tip: "El resultado se guarda en MP3 a 192 kbps. Tamaño máximo: 50 MB y hasta 60 minutos de duración."
  },
  {
    slug: "comprimir-audio", category: "media", icon: "📉",
    name: "Comprimir audio", short: "Reduce el tamaño de archivos de audio.",
    metaTitle: "Comprimir audio online gratis: reduce el peso | ÑAPPIX",
    metaDescription: "Reduce el peso de tus audios convirtiéndolos a MP3 con la calidad que elijas. Gratis, sin registro y hasta 50 MB.",
    description: "Reduce el peso del audio convirtiéndolo a MP3. Una tasa menor suele generar un archivo más pequeño.",
    endpoint: "/api/media/audio-compress",
    fields: [
      mediaFile("Selecciona un archivo de audio"),
      {
        type: "select", name: "bitrate", label: "Calidad de audio",
        options: [opt("64k", "64 kbps · más pequeño"), opt("96k", "96 kbps"), opt("128k", "128 kbps · equilibrado", true), opt("192k", "192 kbps · más calidad")]
      }
    ],
    intro: "Reduce el peso de un audio convirtiéndolo a MP3 con la calidad que elijas. Una calidad menor genera un archivo más pequeño, ideal para enviarlo por WhatsApp o correo.",
    steps: ["Selecciona el archivo de audio.", "Elige la calidad.", "Pulsa «Procesar archivo» y descarga el MP3 comprimido."],
    tip: "64 kbps es la opción más ligera y 192 kbps conserva más calidad. Para grabaciones de voz, 64 o 96 kbps suelen ser suficientes. Tamaño máximo: 50 MB."
  },
  {
    slug: "comprimir-video", category: "media", icon: "📦",
    name: "Comprimir video", short: "Reduce el peso de videos y exporta MP4.",
    metaTitle: "Comprimir video online gratis: reduce el peso | ÑAPPIX",
    metaDescription: "Reduce el peso de tus videos y expórtalos en MP4. Ideal para enviarlos por correo o WhatsApp. Gratis y sin registro, hasta 50 MB.",
    description: "Reduce el tamaño del video y lo exporta en MP4. Una compresión mayor puede reducir la calidad.",
    endpoint: "/api/media/video-compress",
    fields: [
      mediaFile("Selecciona un video", "video/*"),
      {
        type: "select", name: "quality", label: "Nivel de compresión",
        options: [opt("23", "Más calidad (23)"), opt("28", "Equilibrado (28)", true), opt("32", "Más pequeño (32)")]
      }
    ],
    intro: "Reduce el peso de un video para enviarlo por correo o WhatsApp, o para subirlo más rápido. El resultado se exporta en MP4 y, si el video es más ancho que 1280 píxeles, se reduce a ese ancho.",
    steps: ["Selecciona el video.", "Elige el nivel de compresión.", "Pulsa «Procesar archivo» y descarga el MP4 comprimido."],
    tip: "El nivel 23 conserva más calidad y el 32 genera el archivo más pequeño. Tamaño máximo: 50 MB. Los videos largos pueden tardar varios minutos."
  }
];

// ==========================================
// UTILIDADES DE HTML
// ==========================================

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeJson(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function card(tool) {
  return `<a class="tool" href="/${tool.slug}"><div class="emoji">${tool.icon}</div><strong>${esc(tool.name)}</strong><small>${esc(tool.short)}</small></a>`;
}

function fieldHtml(field) {
  const id = "f-" + field.name;
  let control;
  if (field.type === "select") {
    const options = field.options
      .map(o => `<option value="${esc(o.value)}"${o.selected ? " selected" : ""}>${esc(o.label)}</option>`)
      .join("");
    control = `<select id="${id}" name="${esc(field.name)}">${options}</select>`;
  } else {
    control = `<input id="${id}" type="${field.type}" name="${esc(field.name)}"` +
      (field.accept ? ` accept="${esc(field.accept)}"` : "") +
      (field.multiple ? " multiple" : "") +
      (field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : "") +
      (field.value !== undefined ? ` value="${esc(field.value)}"` : "") +
      (field.required ? " required" : "") + ">";
  }
  const hint = field.hint ? `<small>${esc(field.hint)}</small>` : "";
  return `<div class="field"><label for="${id}">${esc(field.label)}</label>${control}${hint}</div>`;
}

function relatedTools(tool) {
  const same = TOOLS.filter(t => t.category === tool.category && t !== tool);
  const others = TOOLS.filter(t => t.category !== tool.category);
  return [...same, ...others].slice(0, 6);
}

// ==========================================
// ESTILOS Y SCRIPTS
// ==========================================

const CSS = `
:root{--purple:#7046e8;--dark:#4321a5;--turquoise:#23c9bb;--ink:#201b35;--muted:#77738a;--bg:#f7f6fb;--white:#fff;--border:#ebe8f4}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'DM Sans',Arial,sans-serif}
a{color:inherit}
header{background:#fff;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10}
.nav{max-width:1150px;margin:auto;padding:17px 22px;display:flex;align-items:center;justify-content:space-between}
.nav a{text-decoration:none}
.logo{font-size:27px;font-weight:800;letter-spacing:-1.5px;color:var(--purple)}
.logo span{color:var(--turquoise)}
.nav small{color:var(--muted)}
main{max-width:1150px;margin:auto;padding:35px 22px 65px}
.hero{text-align:center;padding:35px 0 25px}
.hero h1{font-size:clamp(30px,5vw,48px);margin:0 0 12px;letter-spacing:-1.8px}
.hero h1 span{color:var(--purple)}
.hero p{color:var(--muted);margin:0;font-size:16px}
.hero a{color:var(--purple);font-weight:700}
.search{max-width:600px;margin:28px auto 35px}
.search input{width:100%;padding:17px 20px;border:1px solid var(--border);border-radius:15px;font:inherit;outline:none;background:white}
.search input:focus{border-color:var(--purple);box-shadow:0 0 0 3px #7046e81a}
.section{margin:30px 0}
.section h2{font-size:19px;margin:0 0 15px}
.tools{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}
.tool{display:block;text-decoration:none;background:#fff;border:1px solid var(--border);border-radius:16px;padding:19px;text-align:left;cursor:pointer;transition:.2s;min-height:120px;color:var(--ink);font:inherit}
.tool:hover{transform:translateY(-3px);border-color:#bcaafa;box-shadow:0 8px 24px #3920780c}
.tool .emoji{font-size:25px;margin-bottom:10px}
.tool strong{display:block;font-size:15px;margin-bottom:5px}
.tool small{color:var(--muted);font-size:12px;line-height:1.5}
.top{max-width:720px;margin:0 auto}
.back{display:inline-block;text-decoration:none;border:0;background:#f1edfc;color:var(--purple);font-weight:700;padding:10px 14px;border-radius:10px;cursor:pointer;margin-bottom:20px}
.workspace{display:none;background:white;border:1px solid var(--border);border-radius:20px;padding:25px;max-width:720px;margin:0 auto 30px}
.workspace.active{display:block}
.workspace h1{margin:0 0 8px;font-size:28px;letter-spacing:-.8px}
.description{color:var(--muted);font-size:14px;margin:0 0 24px}
.field{margin:17px 0}
.field label{display:block;font-weight:700;font-size:13px;margin-bottom:8px}
.field input,.field select{width:100%;padding:13px;border:1px solid var(--border);border-radius:10px;font:inherit;background:white;max-width:100%}
.field input[type=file]{background:#faf9fd}
.field small{display:block;color:var(--muted);margin-top:6px;font-size:12px}
.primary{border:0;background:var(--purple);color:white;padding:14px 20px;border-radius:11px;font:inherit;font-weight:700;cursor:pointer;width:100%;margin-top:12px}
.primary:hover{background:var(--dark)}
.primary:disabled{opacity:.6;cursor:wait}
.message{margin-top:16px;padding:13px;border-radius:10px;font-size:13px;display:none;white-space:pre-wrap}
.message.error{display:block;background:#fff0f0;color:#a32323}
.message.success{display:block;background:#eafaf5;color:#087b60}
.empty{text-align:center;color:var(--muted);padding:30px;display:none}
.info{max-width:720px;margin:0 auto 30px}
.info h2{font-size:20px;margin:26px 0 10px;letter-spacing:-.4px}
.info p,.info ol{color:#4a4560;line-height:1.7;font-size:15px;margin:0 0 14px}
.info ol{padding-left:22px}
.info .tip{background:#f0edfc;border-radius:12px;padding:14px 16px;font-size:14px}
.more{max-width:1150px;margin:40px auto 0}
.more h2{font-size:19px;margin:0 0 15px}
.all{text-align:center;margin-top:18px}
.all a{color:var(--purple);font-weight:700;text-decoration:none}
.notice{background:#f0edfc;border-radius:13px;padding:16px;color:#55428c;font-size:12px;line-height:1.6;margin-top:35px}
footer{text-align:center;padding:25px;color:var(--muted);font-size:12px;border-top:1px solid var(--border);background:white}
@media(max-width:850px){.tools{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.tools{grid-template-columns:1fr}.hero{padding-top:20px}main{padding:22px 15px 45px}.workspace{padding:18px}.nav{padding:14px 16px}}
`;

const NOTICE = `<div class="notice">
<strong>Uso responsable:</strong> utiliza únicamente archivos propios o aquellos sobre los que tengas autorización. Respeta los derechos de autor, las licencias y la privacidad de terceros. ÑAPPIX no permite ni promueve la distribución no autorizada de contenido protegido.
<br><br>Los archivos se procesan temporalmente para generar el resultado. No subas documentos confidenciales o información sensible.
<br><br>Los límites de carga pueden variar según la herramienta y la capacidad del servidor.
</div>`;

// Este código se ejecuta en el navegador (se inserta en la página como texto)
function clientSearch() {
  const search = document.getElementById("search");
  search.addEventListener("input", () => {
    const query = search.value.toLowerCase().trim();
    let visible = 0;
    document.querySelectorAll(".section").forEach(section => {
      let sectionVisible = 0;
      section.querySelectorAll(".tool").forEach(link => {
        const match = link.textContent.toLowerCase().includes(query);
        link.style.display = match ? "" : "none";
        if (match) sectionVisible++;
      });
      section.style.display = sectionVisible ? "" : "none";
      visible += sectionVisible;
    });
    document.getElementById("empty").style.display = visible ? "none" : "block";
  });
}

// Este código se ejecuta en el navegador (se inserta en la página como texto)
function clientTool() {
  const form = document.getElementById("toolForm");
  const message = document.getElementById("message");
  const button = document.getElementById("submit");
  const label = button.dataset.label || "Procesar archivo";

  form.addEventListener("submit", async event => {
    event.preventDefault();
    button.disabled = true;
    button.textContent = "Procesando...";
    message.className = "message";
    message.textContent = "";

    try {
      let response;
      if (form.dataset.json === "1") {
        const data = {};
        new FormData(form).forEach((value, key) => { data[key] = value; });
        response = await fetch(form.dataset.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
      } else {
        response = await fetch(form.dataset.endpoint, {
          method: "POST",
          body: new FormData(form)
        });
      }

      if (!response.ok) {
        let error = "No se pudo procesar el archivo.";
        try {
          const data = await response.json();
          if (data.error) error = data.error;
        } catch (e) {}
        throw new Error(error);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match ? match[1] : "nappix-archivo";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      message.className = "message success";
      message.textContent = "¡Listo! Tu archivo se ha procesado y la descarga ha comenzado.";
    } catch (error) {
      message.className = "message error";
      message.textContent = error.message || "Ocurrió un error.";
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
}

// ==========================================
// PLANTILLA GENERAL
// ==========================================

function layout({ title, description, path, robots, jsonLd, body, script }) {
  const url = path === undefined ? null : BASE_URL + path;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="google-site-verification" content="e76-GL-WwZdNeNp3KjC-Q9IgxNVP_lvLdqhBBVgR1Pw">
<meta name="theme-color" content="#6428d9">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${robots ? `<meta name="robots" content="${robots}">` : ""}
${url ? `<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:locale" content="es_CO">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary">` : ""}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
${jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>` : ""}
<style>${CSS}</style>
</head>
<body>
<header><div class="nav"><a class="logo" href="/" aria-label="ÑAPPIX, inicio">ÑAPP<span>IX</span></a><a href="/"><small>Herramientas digitales</small></a></div></header>
<main>
${body}
${NOTICE}
</main>
<footer>© ${new Date().getFullYear()} ÑAPPIX · Más herramientas. Más posibilidades.</footer>
${script ? `<script>(${script.toString()})();</script>` : ""}
</body>
</html>`;
}

// ==========================================
// PÁGINAS
// ==========================================

const HOME_TITLE = "ÑAPPIX: herramientas gratis para PDF, imágenes, audio y video";
const HOME_DESCRIPTION = "ÑAPPIX reúne herramientas digitales gratuitas: convierte y comprime imágenes, une y divide PDF, crea códigos QR y edita audio y video, sin registro.";

function renderHome() {
  const sections = CATEGORIES.map(category => `<div class="section">
<h2>${category.icon} ${esc(category.title)}</h2>
<div class="tools">
${TOOLS.filter(t => t.category === category.id).map(card).join("\n")}
</div>
</div>`).join("\n");

  const body = `<section class="hero">
<h1>Todo lo que necesitas, <span>en un solo lugar.</span></h1>
<p>Convierte, comprime, organiza y crea con ÑAPPIX.</p>
</section>
<div class="search"><input id="search" type="search" placeholder="¿Qué herramienta estás buscando?" aria-label="Buscar herramienta"></div>
<section id="catalog">
${sections}
<div class="empty" id="empty">No encontramos herramientas con esa búsqueda.</div>
</section>`;

  return layout({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: "/",
    jsonLd: { "@context": "https://schema.org", "@type": "WebSite", name: SITE, url: BASE_URL + "/", inLanguage: "es" },
    body,
    script: clientSearch
  });
}

function renderTool(tool) {
  const label = tool.button || "Procesar archivo";
  const body = `<div class="top"><a class="back" href="/">← Volver a las herramientas</a></div>
<section class="workspace active" id="workspace">
<h1 id="toolTitle">${esc(tool.name)}</h1>
<p class="description">${esc(tool.description)}</p>
<form id="toolForm" data-endpoint="${esc(tool.endpoint)}"${tool.json ? ' data-json="1"' : ""}>
<div id="fields">${tool.fields.map(fieldHtml).join("")}</div>
<button class="primary" id="submit" type="submit" data-label="${esc(label)}">${esc(label)}</button>
<div class="message" id="message" role="status"></div>
</form>
</section>
<section class="info">
<h2>¿Para qué sirve?</h2>
<p>${esc(tool.intro)}</p>
<h2>Cómo usarla en 3 pasos</h2>
<ol>${tool.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
<p class="tip"><strong>Buen saber:</strong> ${esc(tool.tip)}</p>
</section>
<section class="more">
<h2>Más herramientas</h2>
<div class="tools">
${relatedTools(tool).map(card).join("\n")}
</div>
<p class="all"><a href="/">Ver todas las herramientas →</a></p>
</section>`;

  return layout({
    title: tool.metaTitle,
    description: tool.metaDescription,
    path: "/" + tool.slug,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: tool.name,
      url: BASE_URL + "/" + tool.slug,
      description: tool.metaDescription,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      inLanguage: "es",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      provider: { "@type": "Organization", name: SITE, url: BASE_URL + "/" }
    },
    body,
    script: clientTool
  });
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#7046e8"/><text x="32" y="47" font-size="42" font-weight="800" text-anchor="middle" fill="#ffffff" font-family="Arial,Helvetica,sans-serif">Ñ</text></svg>`;

// ==========================================
// RUTAS
// ==========================================

function registerPages(app) {
  app.get("/robots.txt", (req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.type("text/plain").send(
      `User-agent: *\nAllow: /\n\nSitemap: ${BASE_URL}/sitemap.xml\n`
    );
  });

  app.get("/sitemap.xml", (req, res) => {
    const urls = ["/", ...TOOLS.map(t => "/" + t.slug)];
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${BASE_URL}${u}</loc></url>`).join("\n")}
</urlset>
`);
  });

  app.get("/favicon.svg", (req, res) => {
    res.set("Cache-Control", "public, max-age=86400");
    res.type("image/svg+xml").send(FAVICON);
  });
  app.get("/favicon.ico", (req, res) => res.redirect(301, "/favicon.svg"));

  app.get("/", (req, res) => res.send(renderHome()));
  TOOLS.forEach(tool => {
    app.get("/" + tool.slug, (req, res) => res.send(renderTool(tool)));
  });
}

function notFoundHandler(req, res) {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Recurso no encontrado." });
  }
  res.status(404).send(layout({
    title: "Página no encontrada | ÑAPPIX",
    description: "La página que buscas no existe en ÑAPPIX.",
    robots: "noindex",
    body: `<section class="hero"><h1>Página no encontrada</h1><p>La página que buscas no existe. <a href="/">Ver todas las herramientas</a></p></section>`
  }));
}

module.exports = { registerPages, notFoundHandler, canonicalRedirect, TOOLS, BASE_URL };

// ==========================================
// ÑAPPIX 2.0 - SERVIDOR PRINCIPAL
// Herramientas digitales multifuncionales
// ==========================================

const express = require("express");
const path = require("path");
const multer = require("multer");
const sharp = require("sharp");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { PDFDocument } = require("pdf-lib");
const pdfParse = require("pdf-parse");
const { Document, Packer, Paragraph } = require("docx");
const QRCode = require("qrcode");
const archiver = require("archiver");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");

// FFmpeg
let ffmpegPath = null;

try {
  ffmpegPath = require("ffmpeg-static");
} catch (error) {
  console.log("FFmpeg no está disponible.");
}

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);

app.use(express.json({ limit: "1mb" }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// ==========================================
// CONFIGURACIÓN DE ARCHIVOS
// ==========================================

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    cb(null, allowed.includes(file.mimetype));
  }
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === "application/pdf");
  }
});

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 5
  }
});

// ==========================================
// FUNCIONES GENERALES
// ==========================================

function sendBuffer(res, buffer, filename, type) {
  res.setHeader("Content-Type", type);

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );

  res.send(buffer);
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      return reject(
        new Error("FFmpeg no está disponible en el servidor.")
      );
    }

    const process = spawn(ffmpegPath, args);

    let errorOutput = "";

    process.stderr.on("data", data => {
      errorOutput += data.toString();
    });

    process.on("error", reject);

    process.on("close", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            errorOutput.slice(-1200) ||
            "No se pudo procesar el archivo."
          )
        );
      }
    });
  });
}

function safeName(name) {
  return path
    .basename(name || "archivo")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

function tempDir() {
  const directory = path.join(
    os.tmpdir(),
    "nappix-" + crypto.randomBytes(8).toString("hex")
  );

  fs.mkdirSync(directory, {
    recursive: true
  });

  return directory;
}

function cleanup(directory) {
  try {
    fs.rmSync(directory, {
      recursive: true,
      force: true
    });
  } catch (error) {
    console.error("Error limpiando archivos temporales:", error);
  }
}

// ==========================================
// COMPROBAR SERVIDOR
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "ÑAPPIX",
    version: "2.0.0",
    tools: [
      "convert-image",
      "compress-image",
      "resize-image",
      "merge-pdf",
      "split-pdf",
      "delete-pdf-pages",
      "rotate-pdf",
      "pdf-to-word",
      "qr-code",
      "zip-create",
      "media-convert",
      "media-cut",
      "media-audio"
    ]
  });
});

// ==========================================
// CONVERTIR IMÁGENES
// ==========================================

app.post(
  "/api/convert/image",
  imageUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Selecciona una imagen JPG, PNG o WEBP."
        });
      }

      const format = String(
        req.body.format || "png"
      ).toLowerCase();

      if (!["jpg", "jpeg", "png", "webp"].includes(format)) {
        return res.status(400).json({
          error: "Formato no permitido."
        });
      }

      const outputFormat =
        format === "jpg" ? "jpeg" : format;

      const output = await sharp(req.file.buffer)
        .rotate()
        .toFormat(outputFormat)
        .toBuffer();

      sendBuffer(
        res,
        output,
        `nappix-convertida.${format === "jpeg" ? "jpg" : format}`,
        `image/${outputFormat}`
      );

    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// COMPRIMIR IMÁGENES
// ==========================================

app.post(
  "/api/compress/image",
  imageUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Selecciona una imagen."
        });
      }

      const metadata = await sharp(req.file.buffer).metadata();

      let output;
      let extension;

      if (metadata.format === "png") {
        output = await sharp(req.file.buffer)
          .jpeg({ quality: 72, mozjpeg: true })
          .toBuffer();

        extension = "jpg";

      } else if (metadata.format === "webp") {
        output = await sharp(req.file.buffer)
          .webp({ quality: 72 })
          .toBuffer();

        extension = "webp";

      } else {
        output = await sharp(req.file.buffer)
          .jpeg({ quality: 72, mozjpeg: true })
          .toBuffer();

        extension = "jpg";
      }

      sendBuffer(
        res,
        output,
        `nappix-comprimida.${extension}`,
        extension === "jpg" ? "image/jpeg" : "image/webp"
      );

    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// REDIMENSIONAR IMÁGENES
// ==========================================

app.post(
  "/api/resize/image",
  imageUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Selecciona una imagen."
        });
      }

      const width = Number(req.body.width);
      const height = Number(req.body.height);

      if (
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width < 1 ||
        height < 1 ||
        width > 5000 ||
        height > 5000
      ) {
        return res.status(400).json({
          error: "Ancho y alto deben estar entre 1 y 5000 píxeles."
        });
      }

      const output = await sharp(req.file.buffer)
        .resize({
          width,
          height,
          fit: "inside",
          withoutEnlargement: true
        })
        .toBuffer();

      sendBuffer(
        res,
        output,
        "nappix-redimensionada.png",
        "image/png"
      );

    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// UNIR ARCHIVOS PDF
// ==========================================

app.post(
  "/api/pdf/merge",
  pdfUpload.array("files", 10),
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length < 2) {
        return res.status(400).json({
          error: "Selecciona al menos dos archivos PDF."
        });
      }

      const mergedPdf = await PDFDocument.create();

      for (const file of req.files) {
        const pdf = await PDFDocument.load(file.buffer);

        const pages = await mergedPdf.copyPages(
          pdf,
          pdf.getPageIndices()
        );

        pages.forEach(page => mergedPdf.addPage(page));
      }

      const output = await mergedPdf.save();

      sendBuffer(
        res,
        Buffer.from(output),
        "nappix-pdf-unido.pdf",
        "application/pdf"
      );

    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// EXTRAER PÁGINAS DE UN PDF
// ==========================================

app.post(
  "/api/pdf/split",
  pdfUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Selecciona un archivo PDF."
        });
      }

      const original = await PDFDocument.load(req.file.buffer);

      const start = Number(req.body.start || 1);
      const end = Number(
        req.body.end || original.getPageCount()
      );

      const totalPages = original.getPageCount();

      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < start ||
        end > totalPages
      ) {
        return res.status(400).json({
          error: `El rango debe estar entre 1 y ${totalPages}.`
        });
      }

      const outputPdf = await PDFDocument.create();

      const pageIndexes = Array.from(
        { length: end - start + 1 },
        (_, index) => start - 1 + index
      );

      const pages = await outputPdf.copyPages(
        original,
        pageIndexes
      );

      pages.forEach(page => outputPdf.addPage(page));

      const output = await outputPdf.save();

      sendBuffer(
        res,
        Buffer.from(output),
        "nappix-paginas-extraidas.pdf",
        "application/pdf"
      );

    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// ELIMINAR PÁGINAS DE UN PDF
// ==========================================

app.post(
  "/api/pdf/delete-pages",
  pdfUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Selecciona un PDF."
        });
      }

      const pdf = await PDFDocument.load(req.file.buffer);

      const totalPages = pdf.getPageCount();

      const pagesToDelete = String(
        req.body.pages || ""
      )
        .split(",")
        .map(Number)
        .filter(page =>
          Number.isInteger(page) &&
          page >= 1 &&
          page <= totalPages
        );

      const uniquePages = [...new Set(pagesToDelete)];

      if (
        uniquePages.length === 0 ||
        uniquePages.length >= totalPages
      ) {
        return res.status(400).json({
          error: "Indica páginas válidas y conserva al menos una página. Ejemplo: 2,4."
        });
      }

      uniquePages
        .sort((a, b) => b - a)
        .forEach(page => {
          pdf.removePage(page - 1);
        });

      const output = await pdf.save();

      sendBuffer(
        res,
        Buffer.from(output),
        "nappix-pdf-sin-paginas.pdf",
        "application/pdf"
      );

    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// ROTAR PÁGINAS DE UN PDF
// ==========================================

app.post(
  "/api/pdf/rotate",
  pdfUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Selecciona un PDF."
        });
      }

      const pdf = await PDFDocument.load(req.file.buffer);

      const degrees = Number(req.body.degrees || 90);

      if (![90, 180, 270].includes(degrees)) {
        return res.status(400).json({
          error: "Selecciona 90, 180 o 270 grados."
        });
      }

      pdf.getPages().forEach(page => {
        const current = page.getRotation().angle;

        page.setRotation({
          angle: (current + degrees) % 360
        });
      });

      const output = await pdf.save();

      sendBuffer(
        res,
        Buffer.from(output),
        "nappix-pdf-rotado.pdf",
        "application/pdf"
      );

    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// CONVERTIR PDF A WORD
// ==========================================

app.post(
  "/api/pdf/to-word",
  pdfUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Selecciona un archivo PDF."
        });
      }

      const parsed = await pdfParse(req.file.buffer);

      if (!parsed.text || !parsed.text.trim()) {
        return res.status(422).json({
          error: "No se encontró texto. Si es un PDF escaneado, necesita OCR."
        });
      }

      const paragraphs = parsed.text
        .split(/\n+/)
        .map(text => new Paragraph(text));

      const document = new Document({
        sections: [
          {
            children: paragraphs
          }
        ]
      });

      const output = await Packer.toBuffer(document);

      sendBuffer(
        res,
        output,
        "nappix-documento.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );

    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// GENERADOR DE CÓDIGOS QR
// ==========================================

app.post(
  "/api/qr",
  async (req, res, next) => {
    try {
      const text = String(req.body.text || "").trim();

      if (!text || text.length > 2000) {
        return res.status(400).json({
          error: "Escribe un texto o enlace de máximo 2000 caracteres."
        });
      }

      const qr = await QRCode.toBuffer(text, {
        type: "png",
        width: 700,
        margin: 2
      });

      sendBuffer(
        res,
        qr,
        "nappix-codigo-qr.png",
        "image/png"
      );

    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// CREAR ARCHIVOS ZIP
// ==========================================

app.post(
  "/api/zip",
  mediaUpload.array("files", 5),
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: "Selecciona archivos para comprimir."
        });
      }

      res.setHeader("Content-Type", "application/zip");

      res.setHeader(
        "Content-Disposition",
        'attachment; filename="nappix-archivos.zip"'
      );

      const archive = archiver("zip", {
        zlib: { level: 8 }
      });

      archive.on("error", next);

      archive.pipe(res);

      req.files.forEach(file => {
        archive.append(file.buffer, {
          name: safeName(file.originalname)
        });
      });

      await archive.finalize();

    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// PROCESAMIENTO DE AUDIO Y VIDEO
// ==========================================

async function mediaJob(req, res, mode) {
  if (!req.file) {
    return res.status(400).json({
      error: "Selecciona un archivo de audio o video."
    });
  }

  const directory = tempDir();

  try {
    const input = path.join(
      directory,
      safeName(req.file.originalname)
    );

    const format = String(
      req.body.format || (mode === "audio" ? "mp3" : "mp4")
    ).toLowerCase();

    if (!["mp4", "webm", "mp3", "wav"].includes(format)) {
      throw new Error("Formato de salida no permitido.");
    }

    const output = path.join(
      directory,
      "resultado." + format
    );

    fs.writeFileSync(input, req.file.buffer);

    let args = ["-y", "-i", input];

    if (mode === "cut") {
      const start = Math.max(
        0,
        Number(req.body.start || 0)
      );

      const duration = Number(
        req.body.duration || 15
      );

      if (
        !Number.isFinite(start) ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > 300
      ) {
        throw new Error(
          "La duración debe estar entre 1 y 300 segundos."
        );
      }

      args = [
        "-y",
        "-ss", String(start),
        "-i", input,
        "-t", String(duration),
        "-c", "copy",
        output
      ];

    } else if (mode === "audio") {
      args.push(
        "-vn",
        "-b:a", "192k",
        output
      );

    } else {
      args.push(
        "-t", "300",
        output
      );
    }

    await runFfmpeg(args);

    const data = fs.readFileSync(output);

    sendBuffer(
      res,
      data,
      "nappix-procesado." + format,
      "application/octet-stream"
    );

  } finally {
    cleanup(directory);
  }
}

app.post(
  "/api/media/convert",
  mediaUpload.single("file"),
  (req, res, next) => {
    mediaJob(req, res, "convert").catch(next);
  }
);

app.post(
  "/api/media/cut",
  mediaUpload.single("file"),
  (req, res, next) => {
    mediaJob(req, res, "cut").catch(next);
  }
);

app.post(
  "/api/media/audio",
  mediaUpload.single("file"),
  (req, res, next) => {
    mediaJob(req, res, "audio").catch(next);
  }
);

// ==========================================
// INTERFAZ PRINCIPAL DE ÑAPPIX
// ==========================================

app.get("/", (req, res) => {

  res.type("html").send(`<!DOCTYPE html>
<html lang="es">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#6428d9">

<meta name="description" content="ÑAPPIX: herramientas digitales gratuitas para convertir, comprimir y organizar archivos.">

<title>ÑAPPIX | Herramientas digitales</title>

<style>

@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

:root {
  --purple: #7046e8;
  --purple-dark: #4321a5;
  --turquoise: #23c9bb;
  --ink: #201b35;
  --muted: #77718a;
  --background: #f7f5fc;
  --white: #ffffff;
  --border: #e9e4f2;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'DM Sans', Arial, sans-serif;
  background: var(--background);
  color: var(--ink);
}

header {
  background: white;
  padding: 18px 6%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}

.logo {
  font-size: 30px;
  font-weight: 800;
  color: var(--purple);
  letter-spacing: -1px;
}

.logo span {
  color: var(--turquoise);
}

.tagline {
  font-size: 12px;
  color: var(--muted);
}

.hero {
  text-align: center;
  padding: 65px 20px 40px;
}

.hero h1 {
  font-size: clamp(32px, 5vw, 52px);
  margin: 0 0 15px;
  font-weight: 800;
}

.hero h1 span {
  color: var(--purple);
}

.hero p {
  color: var(--muted);
  font-size: 16px;
}

.search {
  max-width: 550px;
  margin: 25px auto 0;
}

.search input {
  width: 100%;
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  font-size: 15px;
  outline: none;
}

main {
  max-width: 1150px;
  margin: auto;
  padding: 15px 20px 60px;
}

.category {
  margin: 35px 0 15px;
}

.category h2 {
  font-size: 23px;
  margin-bottom: 6px;
}

.category p {
  color: var(--muted);
  font-size: 14px;
}

.tools {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(245px, 1fr));
  gap: 18px;
}

.card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 23px;
  transition: .2s;
}

.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 30px #39207810;
}

.card h3 {
  margin: 0 0 8px;
  font-size: 18px;
}

.card p {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.6;
}

.field {
  display: block;
  font-size: 13px;
  color: var(--muted);
  margin: 13px 0;
}

input[type="file"],
input[type="number"],
input[type="text"],
select {
  width: 100%;
  margin-top: 7px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: white;
  font-family: inherit;
}

button {
  width: 100%;
  background: var(--purple);
  color: white;
  border: none;
  padding: 13px 17px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: .2s;
}

button:hover {
  background: var(--purple-dark);
}

button:disabled {
  opacity: .55;
  cursor: wait;
}

.message {
  min-height: 20px;
  font-size: 12px;
  color: var(--purple);
  margin-top: 12px;
}

.note {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
}

footer {
  background: white;
  border-top: 1px solid var(--border);
  text-align: center;
  padding: 30px 15px;
  color: var(--muted);
  font-size: 13px;
}

footer strong {
  color: var(--purple);
}

@media(max-width:600px) {
  header {
    padding: 15px 5%;
  }

  .hero {
    padding-top: 45px;
  }

  .tools {
    grid-template-columns: 1fr;
  }
}

</style>
</head>

<body>

<header>

  <div>
    <div class="logo">ÑAPP<span>IX</span></div>
    <div class="tagline">Más herramientas. Más posibilidades.</div>
  </div>

  <div class="tagline">Tu espacio digital</div>

</header>

<section class="hero">

  <h1>Todo lo que necesitas, <span>en un solo lugar.</span></h1>

  <p>Convierte, comprime, edita y organiza tus archivos fácilmente.</p>

  <div class="search">
    <input
      type="text"
      id="searchTools"
      placeholder="Buscar una herramienta..."
    >
  </div>

</section>

<main>

  <div class="category">
    <h2>Herramientas de imágenes</h2>
    <p>Convierte y optimiza tus fotografías e imágenes.</p>
  </div>

  <div class="tools">

    <section class="card" data-search="imagen convertir jpg png webp">

      <h3>Convertir imágenes</h3>
      <p>Convierte tus imágenes entre JPG, PNG y WEBP.</p>

      <form data-api="/api/convert/image">

        <label class="field">
          Selecciona tu imagen
          <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required>
        </label>

        <label class="field">
          Formato de salida
          <select name="format">
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="webp">WEBP</option>
          </select>
        </label>

        <button>Convertir imagen</button>
        <div class="message"></div>

      </form>

    </section>

    <section class="card" data-search="comprimir reducir peso imagen">

      <h3>Comprimir imágenes</h3>
      <p>Reduce el peso de tus imágenes.</p>

      <form data-api="/api/compress/image">

        <label class="field">
          Selecciona una imagen
          <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required>
        </label>

        <button>Comprimir imagen</button>
        <div class="message"></div>

      </form>

    </section>

    <section class="card" data-search="redimensionar cambiar tamaño imagen">

      <h3>Redimensionar imágenes</h3>
      <p>Cambia las dimensiones de tus imágenes.</p>

      <form data-api="/api/resize/image">

        <label class="field">
          Imagen
          <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required>
        </label>

        <label class="field">
          Ancho en píxeles
          <input type="number" name="width" value="1200" min="1" max="5000">
        </label>

        <label class="field">
          Alto en píxeles
          <input type="number" name="height" value="1200" min="1" max="5000">
        </label>

        <button>Redimensionar</button>
        <div class="message"></div>

      </form>

    </section>

  </div>

  <div class="category">
    <h2>Herramientas PDF</h2>
    <p>Organiza, modifica y convierte tus documentos.</p>
  </div>

  <div class="tools">

    <section class="card" data-search="unir combinar juntar pdf">

      <h3>Unir PDF</h3>
      <p>Combina varios documentos PDF en uno solo.</p>

      <form data-api="/api/pdf/merge">

        <label class="field">
          Selecciona tus PDF
          <input type="file" name="files" accept="application/pdf" multiple required>
        </label>

        <button>Unir documentos</button>
        <div class="message"></div>

      </form>

    </section>

    <section class="card" data-search="dividir separar extraer paginas pdf">

      <h3>Extraer páginas PDF</h3>
      <p>Selecciona las páginas que deseas conservar.</p>

      <form data-api="/api/pdf/split">

        <label class="field">
          Documento PDF
          <input type="file" name="file" accept="application/pdf" required>
        </label>

        <label class="field">
          Página inicial
          <input type="number" name="start" value="1" min="1">
        </label>

        <label class="field">
          Página final
          <input type="number" name="end" value="1" min="1">
        </label>

        <button>Extraer páginas</button>
        <div class="message"></div>

      </form>

    </section>

    <section class="card" data-search="eliminar borrar quitar paginas pdf">

      <h3>Eliminar páginas PDF</h3>
      <p>Elimina las páginas que no necesitas.</p>

      <form data-api="/api/pdf/delete-pages">

        <label class="field">
          Documento PDF
          <input type="file" name="file" accept="application/pdf" required>
        </label>

        <label class="field">
          Páginas a eliminar
          <input type="text" name="pages" placeholder="Ejemplo: 2,4,6" required>
        </label>

        <button>Eliminar páginas</button>
        <div class="message"></div>

      </form>

    </section>

    <section class="card" data-search="rotar girar pdf">

      <h3>Rotar PDF</h3>
      <p>Gira las páginas de tu documento.</p>

      <form data-api="/api/pdf/rotate">

        <label class="field">
          Documento PDF
          <input type="file" name="file" accept="application/pdf" required>
        </label>

        <label class="field">
          Grados
          <select name="degrees">
            <option value="90">90 grados</option>
            <option value="180">180 grados</option>
            <option value="270">270 grados</option>
          </select>
        </label>

        <button>Rotar documento</button>
        <div class="message"></div>

      </form>

    </section>

    <section class="card" data-search="pdf word docx convertir documento">

      <h3>PDF a Word</h3>
      <p>Extrae el texto de tu PDF y crea un documento Word.</p>

      <form data-api="/api/pdf/to-word">

        <label class="field">
          Documento PDF
          <input type="file" name="file" accept="application/pdf" required>
        </label>

        <button>Convertir a Word</button>
        <div class="message"></div>

      </form>

      <p class="note">
        Esta conversión extrae texto y no conserva exactamente el diseño original.
        Los PDF escaneados necesitan OCR.
      </p>

    </section>

  </div>

  <div class="category">
    <h2>Herramientas adicionales</h2>
    <p>Más utilidades para tus tareas y proyectos.</p>
  </div>

  <div class="tools">

    <section class="card" data-search="generador crear codigo qr enlace">

      <h3>Generador de códigos QR</h3>
      <p>Crea códigos QR a partir de textos o enlaces.</p>

      <form data-api="/api/qr" data-json="true">

        <label class="field">
          Texto o enlace
          <input type="text" name="text" placeholder="https://..." required>
        </label>

        <button>Generar código QR</button>
        <div class="message"></div>

      </form>

    </section>

    <section class="card" data-search="zip comprimir archivos carpeta">

      <h3>Comprimir archivos ZIP</h3>
      <p>Reúne varios archivos en un archivo ZIP.</p>

      <form data-api="/api/zip">

        <label class="field">
          Selecciona archivos
          <input type="file" name="files" multiple required>
        </label>

        <button>Crear ZIP</button>
        <div class="message"></div>

      </form>

    </section>

    <section class="card" data-search="video audio convertir mp4 mp3 webm wav">

      <h3>Convertir audio y video</h3>
      <p>Convierte archivos multimedia a otros formatos.</p>

      <form data-api="/api/media/convert">

        <label class="field">
          Archivo de audio o video
          <input type="file" name="file" required>
        </label>

        <label class="field">
          Formato de salida
          <select name="format">
            <option value="mp4">MP4</option>
            <option value="webm">WEBM</option>
            <option value="mp3">MP3</option>
            <option value="wav">WAV</option>
          </select>
        </label>

        <button>Convertir archivo</button>
        <div class="message"></div>

      </form>

      <p class="note">
        Requiere FFmpeg disponible en el servidor. Límite de 50 MB por archivo.
      </p>

    </section>

    <section class="card" data-search="cortar recortar video audio">

      <h3>Cortar audio y video</h3>
      <p>Selecciona el fragmento que deseas obtener.</p>

      <form data-api="/api/media/cut">

        <label class="field">
          Archivo
          <input type="file" name="file" required>
        </label>

        <label class="field">
          Inicio en segundos
          <input type="number" name="start" value="0" min="0">
        </label>

        <label class="field">
          Duración en segundos
          <input type="number" name="duration" value="15" min="1" max="300">
        </label>

        <button>Cortar archivo</button>
        <div class="message"></div>

      </form>

    </section>

    <section class="card" data-search="extraer musica audio mp3 video">

      <h3>Extraer audio de video</h3>
      <p>Obtén el audio de un video en formato MP3.</p>

      <form data-api="/api/media/audio">

        <label class="field">
          Selecciona un video
          <input type="file" name="file" accept="video/*" required>
        </label>

        <button>Extraer audio</button>
        <div class="message"></div>

      </form>

    </section>

  </div>

  <p class="note">
    ÑAPPIX está diseñado para procesar archivos propios o autorizados.
    No utilices estas herramientas para infringir derechos de autor,
    eliminar marcas de agua ajenas o distribuir contenido sin permiso.
  </p>

</main>

<footer>

  <strong>ÑAPPIX</strong><br>
  Más herramientas. Más posibilidades.<br><br>
  © ${new Date().getFullYear()} ÑAPPIX. Todos los derechos reservados.

</footer>

<script>

// ==========================================
// BUSCADOR DE HERRAMIENTAS
// ==========================================

const searchInput = document.getElementById("searchTools");

searchInput.addEventListener("input", function() {

  const search = this.value.toLowerCase().trim();

  document.querySelectorAll(".card").forEach(card => {

    const content = (
      card.innerText + " " + (card.dataset.search || "")
    ).toLowerCase();

    card.style.display = content.includes(search)
      ? ""
      : "none";

  });

});

// ==========================================
// PROCESAMIENTO Y DESCARGA DE ARCHIVOS
// ==========================================

document.querySelectorAll("form[data-api]").forEach(form => {

  form.addEventListener("submit", async event => {

    event.preventDefault();

    const button = form.querySelector("button");
    const message = form.querySelector(".message");

    button.disabled = true;
    message.textContent = "Procesando archivo...";

    try {

      let body;
      const headers = {};

      if (form.dataset.json === "true") {

        body = JSON.stringify(
          Object.fromEntries(new FormData(form))
        );

        headers["Content-Type"] = "application/json";

      } else {

        body = new FormData(form);

      }

      const response = await fetch(
        form.dataset.api,
        {
          method: "POST",
          body,
          headers
        }
      );

      if (!response.ok) {

        let result = {};

        try {
          result = await response.json();
        } catch (error) {}

        throw new Error(
          result.error || "No se pudo procesar el archivo."
        );

      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);

      const disposition = response.headers.get(
        "Content-Disposition"
      ) || "";

      const match = disposition.match(
        /filename="([^"]+)"/
      );

      const filename = match
        ? match[1]
        : "nappix-archivo";

      const link = document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      message.textContent =
        "¡Proceso terminado! Tu archivo se ha descargado.";

    } catch (error) {

      message.textContent = error.message;

    } finally {

      button.disabled = false;

    }

  });

});

</script>

</body>
</html>`);

});

// ==========================================
// RUTAS NO ENCONTRADAS
// ==========================================

app.use((req, res) => {

  res.status(404).json({
    error: "La herramienta o ruta solicitada no existe."
  });

});

// ==========================================
// MANEJO DE ERRORES
// ==========================================

app.use((error, req, res, next) => {

  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  let message = error.message ||
    "Ocurrió un error al procesar el archivo.";

  if (error.code === "LIMIT_FILE_SIZE") {
    message = "El archivo supera el límite permitido.";
  }

  if (error.code === "LIMIT_FILE_COUNT") {
    message = "Has seleccionado demasiados archivos.";
  }

  res.status(400).json({
    error: message
  });

});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {

  console.log("--------------------------------");
  console.log("ÑAPPIX está funcionando");
  console.log("Puerto:", PORT);
  console.log("--------------------------------");

});

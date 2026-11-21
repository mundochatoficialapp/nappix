
const express = require("express");
const path = require("path");
const multer = require("multer");
const sharp = require("sharp");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { PDFDocument } = require("pdf-lib");
const pdfParse = require("pdf-parse");
const { Document, Paragraph, Packer } = require("docx");
const QRCode = require("qrcode");
const archiver = require("archiver");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { createCanvas } = require("@napi-rs/canvas");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public"), { index: false }));

app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false
}));

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  }
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf"));
  }
});

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 }
});

function safeName(name) {
  return String(name || "archivo")
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 60) || "archivo";
}

function sendBuffer(res, buffer, filename, type) {
  res.setHeader("Content-Type", type || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename.replace(/["\\]/g, "_")}"`
  );
  res.setHeader("Content-Length", buffer.length);
  res.send(buffer);
}

function tempDir() {
  const dir = path.join(os.tmpdir(), "nappix-" + crypto.randomUUID());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    console.error("No se pudo limpiar temporal:", e.message);
  }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("FFmpeg no está disponible."));
    const process = spawn(ffmpegPath, args);
    let errorText = "";

    process.stderr.on("data", data => {
      errorText += data.toString();
    });

    process.on("error", reject);
    process.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(errorText.slice(-1500) || "Error al procesar el medio."));
    });
  });
}

function requireFile(req, res, field = "file") {
  if (!req.file) {
    res.status(400).json({ error: "Selecciona un archivo válido." });
    return false;
  }
  return true;
}

function pageNumbers(value, total) {
  const pages = new Set();
  String(value || "")
    .split(",")
    .forEach(part => {
      const p = part.trim();
      if (/^\d+$/.test(p)) {
        const n = Number(p);
        if (n >= 1 && n <= total) pages.add(n - 1);
      } else {
        const match = p.match(/^(\d+)-(\d+)$/);
        if (match) {
          const start = Number(match[1]);
          const end = Number(match[2]);
          if (start <= end && start >= 1 && end <= total) {
            for (let i = start; i <= end; i++) pages.add(i - 1);
          }
        }
      }
    });
  return [...pages].sort((a, b) => a - b);
}

// ==========================================
// INFORMACIÓN Y ESTADO
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "ÑAPPIX",
    version: "2.1.0",
    tools: [
      "image-convert",
      "image-compress",
      "image-resize",
      "pdf-merge",
      "pdf-split",
      "pdf-delete-pages",
      "pdf-rotate",
      "pdf-to-word",
      "pdf-to-images",
      "qr",
      "zip",
      "media-convert",
      "media-cut",
      "media-audio"
    ]
  });
});

// ==========================================
// HERRAMIENTAS DE IMÁGENES
// ==========================================

app.post("/api/convert/image", imageUpload.single("file"), async (req, res) => {
  try {
    if (!requireFile(req, res)) return;

    const format = String(req.body.format || "png").toLowerCase();
    const formats = ["png", "jpg", "webp"];
    if (!formats.includes(format)) {
      return res.status(400).json({ error: "Formato no permitido." });
    }

    let image = sharp(req.file.buffer, { failOn: "none" }).rotate();
    let output;
    let mime;
    let ext;

    if (format === "jpg") {
      output = await image.jpeg({ quality: 90 }).toBuffer();
      mime = "image/jpeg";
      ext = "jpg";
    } else if (format === "webp") {
      output = await image.webp({ quality: 90 }).toBuffer();
      mime = "image/webp";
      ext = "webp";
    } else {
      output = await image.png().toBuffer();
      mime = "image/png";
      ext = "png";
    }

    sendBuffer(res, output, safeName(req.file.originalname) + "." + ext, mime);
  } catch (e) {
    res.status(500).json({ error: "No se pudo convertir la imagen." });
  }
});

app.post("/api/compress/image", imageUpload.single("file"), async (req, res) => {
  try {
    if (!requireFile(req, res)) return;

    const meta = await sharp(req.file.buffer).metadata();
    let image = sharp(req.file.buffer).rotate();
    let output;
    let ext;
    let mime;

    if (meta.format === "png") {
      output = await image.png({ compressionLevel: 9, effort: 8 }).toBuffer();
      ext = "png";
      mime = "image/png";
    } else if (meta.format === "webp") {
      output = await image.webp({ quality: 65 }).toBuffer();
      ext = "webp";
      mime = "image/webp";
    } else {
      output = await image.jpeg({ quality: 65, mozjpeg: true }).toBuffer();
      ext = "jpg";
      mime = "image/jpeg";
    }

    sendBuffer(res, output, safeName(req.file.originalname) + "-comprimida." + ext, mime);
  } catch (e) {
    res.status(500).json({ error: "No se pudo comprimir la imagen." });
  }
});

app.post("/api/resize/image", imageUpload.single("file"), async (req, res) => {
  try {
    if (!requireFile(req, res)) return;

    const width = Math.min(5000, Math.max(1, Number(req.body.width) || 800));
    const height = Math.min(5000, Math.max(1, Number(req.body.height) || 800));

    const output = await sharp(req.file.buffer)
      .rotate()
      .resize(width, height, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();

    sendBuffer(res, output, safeName(req.file.originalname) + "-redimensionada.png", "image/png");
  } catch (e) {
    res.status(500).json({ error: "No se pudo cambiar el tamaño de la imagen." });
  }
});

// ==========================================
// HERRAMIENTAS PDF
// ==========================================

app.post("/api/pdf/merge", pdfUpload.array("files", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ error: "Selecciona al menos 2 archivos PDF." });
    }

    const merged = await PDFDocument.create();

    for (const file of req.files) {
      const pdf = await PDFDocument.load(file.buffer, { ignoreEncryption: false });
      const pages = await merged.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(page => merged.addPage(page));
    }

    const output = Buffer.from(await merged.save());
    sendBuffer(res, output, "nappix-pdf-unido.pdf", "application/pdf");
  } catch (e) {
    res.status(500).json({ error: "No se pudieron unir los PDF. Comprueba que no estén protegidos." });
  }
});

app.post("/api/pdf/split", pdfUpload.single("file"), async (req, res) => {
  try {
    if (!requireFile(req, res)) return;

    const source = await PDFDocument.load(req.file.buffer);
    const total = source.getPageCount();
    const start = Math.max(1, Number(req.body.start) || 1);
    const end = Math.min(total, Number(req.body.end) || total);

    if (start > end || start > total) {
      return res.status(400).json({ error: "El rango de páginas no es válido." });
    }

    const outputPdf = await PDFDocument.create();
    const pages = await outputPdf.copyPages(
      source,
      Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i)
    );
    pages.forEach(p => outputPdf.addPage(p));

    sendBuffer(
      res,
      Buffer.from(await outputPdf.save()),
      "nappix-paginas.pdf",
      "application/pdf"
    );
  } catch (e) {
    res.status(500).json({ error: "No se pudo dividir el PDF." });
  }
});

app.post("/api/pdf/delete-pages", pdfUpload.single("file"), async (req, res) => {
  try {
    if (!requireFile(req, res)) return;

    const pdf = await PDFDocument.load(req.file.buffer);
    const total = pdf.getPageCount();
    const remove = pageNumbers(req.body.pages, total);

    if (!remove.length) {
      return res.status(400).json({ error: "Indica las páginas que deseas eliminar." });
    }
    if (remove.length >= total) {
      return res.status(400).json({ error: "No puedes eliminar todas las páginas." });
    }

    remove.sort((a, b) => b - a).forEach(index => pdf.removePage(index));

    sendBuffer(
      res,
      Buffer.from(await pdf.save()),
      "nappix-pdf-sin-paginas.pdf",
      "application/pdf"
    );
  } catch (e) {
    res.status(500).json({ error: "No se pudieron eliminar las páginas." });
  }
});

app.post("/api/pdf/rotate", pdfUpload.single("file"), async (req, res) => {
  try {
    if (!requireFile(req, res)) return;

    const pdf = await PDFDocument.load(req.file.buffer);
    const degrees = Number(req.body.degrees) || 90;
    if (![90, 180, 270].includes(degrees)) {
      return res.status(400).json({ error: "Elige 90, 180 o 270 grados." });
    }

    pdf.getPages().forEach(page => {
      page.setRotation({
        angle: (page.getRotation().angle + degrees) % 360
      });
    });

    sendBuffer(
      res,
      Buffer.from(await pdf.save()),
      "nappix-pdf-rotado.pdf",
      "application/pdf"
    );
  } catch (e) {
    res.status(500).json({ error: "No se pudo rotar el PDF." });
  }
});

app.post("/api/pdf/to-word", pdfUpload.single("file"), async (req, res) => {
  try {
    if (!requireFile(req, res)) return;

    const parsed = await pdfParse(req.file.buffer);
    const text = String(parsed.text || "").trim();

    if (!text) {
      return res.status(400).json({
        error: "No se encontró texto seleccionable. Este PDF puede ser un documento escaneado."
      });
    }

    const paragraphs = text
      .split(/\n+/)
      .map(line => new Paragraph({ text: line.trim() }))
      .filter(p => p);

    const document = new Document({
      sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph("")] }]
    });

    const output = await Packer.toBuffer(document);
    sendBuffer(
      res,
      output,
      safeName(req.file.originalname) + ".docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  } catch (e) {
    res.status(500).json({ error: "No se pudo convertir el PDF a Word." });
  }
});

// PDF A JPG / PNG
app.post("/api/pdf/to-images", pdfUpload.single("file"), async (req, res) => {
  let dir;

  try {
    if (!requireFile(req, res)) return;

    const format = String(req.body.format || "jpg").toLowerCase();
    if (!["jpg", "png"].includes(format)) {
      return res.status(400).json({ error: "Elige JPG o PNG." });
    }

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(req.file.buffer),
      useSystemFonts: true,
      isEvalSupported: false
    });

    const pdf = await loadingTask.promise;

    if (pdf.numPages > 30) {
      await pdf.destroy();
      return res.status(400).json({
        error: "Este servicio admite hasta 30 páginas por conversión."
      });
    }

    dir = tempDir();
    const zipPath = path.join(dir, "nappix-paginas.zip");
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 6 } });

    const completed = new Promise((resolve, reject) => {
      output.on("close", resolve);
      output.on("error", reject);
      archive.on("error", reject);
    });

    archive.pipe(output);

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height)
      );
      const context = canvas.getContext("2d");

      await page.render({ canvasContext: context, viewport }).promise;

      let imageBuffer = canvas.toBuffer("image/png");
      if (format === "jpg") {
        imageBuffer = await sharp(imageBuffer)
          .jpeg({ quality: 90 })
          .toBuffer();
      }

      archive.append(imageBuffer, {
        name: `pagina-${String(i).padStart(3, "0")}.${format}`
      });
    }

    await archive.finalize();
    await completed;
    await pdf.destroy();

    const zipBuffer = fs.readFileSync(zipPath);
    sendBuffer(res, zipBuffer, "nappix-pdf-a-imagenes.zip", "application/zip");
  } catch (e) {
    console.error("PDF a imágenes:", e.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "No se pudo convertir el PDF a imágenes." });
    }
  } finally {
    if (dir) cleanup(dir);
  }
});

// ==========================================
// HERRAMIENTAS ADICIONALES
// ==========================================

app.post("/api/qr", async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();
    if (!text || text.length > 2000) {
      return res.status(400).json({ error: "Escribe un texto o enlace válido (máximo 2.000 caracteres)." });
    }

    const output = await QRCode.toBuffer(text, {
      type: "png",
      width: 800,
      margin: 2,
      errorCorrectionLevel: "H"
    });

    sendBuffer(res, output, "nappix-codigo-qr.png", "image/png");
  } catch (e) {
    res.status(500).json({ error: "No se pudo generar el código QR." });
  }
});

app.post("/api/zip", mediaUpload.array("files", 5), async (req, res) => {
  let dir;

  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ error: "Selecciona archivos para comprimir." });
    }

    dir = tempDir();
    const zipPath = path.join(dir, "nappix-archivos.zip");
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 6 } });

    const completed = new Promise((resolve, reject) => {
      output.on("close", resolve);
      output.on("error", reject);
      archive.on("error", reject);
    });

    archive.pipe(output);

    req.files.forEach((file, index) => {
      archive.append(file.buffer, {
        name: `${index + 1}-${safeName(file.originalname)}${path.extname(file.originalname).slice(0, 10)}`
      });
    });

    await archive.finalize();
    await completed;

    sendBuffer(
      res,
      fs.readFileSync(zipPath),
      "nappix-archivos.zip",
      "application/zip"
    );
  } catch (e) {
    res.status(500).json({ error: "No se pudo crear el archivo ZIP." });
  } finally {
    if (dir) cleanup(dir);
  }
});

// ==========================================
// HERRAMIENTAS DE AUDIO Y VIDEO
// ==========================================

app.post("/api/media/convert", mediaUpload.single("file"), async (req, res) => {
  let dir;

  try {
    if (!requireFile(req, res)) return;

    const format = String(req.body.format || "mp4").toLowerCase();
    const allowed = ["mp4", "webm", "mp3", "wav", "ogg"];
    if (!allowed.includes(format)) {
      return res.status(400).json({ error: "Formato de salida no permitido." });
    }

    dir = tempDir();
    const input = path.join(dir, "entrada");
    const output = path.join(dir, "salida." + format);

    fs.writeFileSync(input, req.file.buffer);

    const args = ["-y", "-i", input];

    if (format === "mp3") {
      args.push("-vn", "-codec:a", "libmp3lame", "-q:a", "3");
    } else if (format === "wav") {
      args.push("-vn", "-codec:a", "pcm_s16le");
    } else if (format === "ogg") {
      args.push("-vn", "-codec:a", "libvorbis", "-q:a", "5");
    } else if (format === "webm") {
      args.push("-c:v", "libvpx", "-c:a", "libopus");
    } else {
      args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart");
    }

    args.push(output);
    await runFfmpeg(args);

    const mime = {
      mp4: "video/mp4",
      webm: "video/webm",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg"
    }[format];

    sendBuffer(
      res,
      fs.readFileSync(output),
      safeName(req.file.originalname) + "." + format,
      mime
    );
  } catch (e) {
    console.error("Conversión multimedia:", e.message);
    res.status(500).json({ error: "No se pudo convertir el archivo multimedia. Comprueba el formato de origen." });
  } finally {
    if (dir) cleanup(dir);
  }
});

app.post("/api/media/cut", mediaUpload.single("file"), async (req, res) => {
  let dir;

  try {
    if (!requireFile(req, res)) return;

    const start = Math.max(0, Number(req.body.start) || 0);
    const duration = Number(req.body.duration);

    if (!Number.isFinite(duration) || duration <= 0 || duration > 3600) {
      return res.status(400).json({ error: "Indica una duración válida de hasta 60 minutos." });
    }

    dir = tempDir();
    const input = path.join(dir, "entrada");
    const output = path.join(dir, "recorte.mp4");
    fs.writeFileSync(input, req.file.buffer);

    await runFfmpeg([
      "-y",
      "-ss", String(start),
      "-i", input,
      "-t", String(duration),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-c:a", "aac",
      "-movflags", "+faststart",
      output
    ]);

    sendBuffer(
      res,
      fs.readFileSync(output),
      safeName(req.file.originalname) + "-recortado.mp4",
      "video/mp4"
    );
  } catch (e) {
    res.status(500).json({ error: "No se pudo recortar el archivo." });
  } finally {
    if (dir) cleanup(dir);
  }
});

app.post("/api/media/audio", mediaUpload.single("file"), async (req, res) => {
  let dir;

  try {
    if (!requireFile(req, res)) return;

    dir = tempDir();
    const input = path.join(dir, "entrada");
    const output = path.join(dir, "audio.mp3");
    fs.writeFileSync(input, req.file.buffer);

    await runFfmpeg([
      "-y",
      "-i", input,
      "-vn",
      "-codec:a", "libmp3lame",
      "-q:a", "3",
      output
    ]);

    sendBuffer(
      res,
      fs.readFileSync(output),
      safeName(req.file.originalname) + ".mp3",
      "audio/mpeg"
    );
  } catch (e) {
    res.status(500).json({ error: "No se pudo extraer el audio." });
  } finally {
    if (dir) cleanup(dir);
  }
});

// ==========================================
// PÁGINA PRINCIPAL DE ÑAPPIX
// ==========================================

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#6428d9">
<meta name="description" content="ÑAPPIX: herramientas digitales gratuitas para convertir, comprimir y organizar archivos.">
<title>ÑAPPIX - Herramientas digitales</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

:root {
  --purple:#7046e8;
  --dark:#4321a5;
  --turquoise:#23c9bb;
  --ink:#201b35;
  --muted:#77738a;
  --bg:#f7f6fb;
  --white:#fff;
  --border:#ebe8f4;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'DM Sans',Arial,sans-serif}
header{background:#fff;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10}
.nav{max-width:1150px;margin:auto;padding:17px 22px;display:flex;align-items:center;justify-content:space-between}
.logo{font-size:27px;font-weight:800;letter-spacing:-1.5px;color:var(--purple)}
.logo span{color:var(--turquoise)}
.nav small{color:var(--muted)}
main{max-width:1150px;margin:auto;padding:35px 22px 65px}
.hero{text-align:center;padding:35px 0 25px}
.hero h1{font-size:clamp(30px,5vw,48px);margin:0 0 12px;letter-spacing:-1.8px}
.hero h1 span{color:var(--purple)}
.hero p{color:var(--muted);margin:0;font-size:16px}
.search{max-width:600px;margin:28px auto 35px;position:relative}
.search input{width:100%;padding:17px 20px;border:1px solid var(--border);border-radius:15px;font:inherit;outline:none;background:white}
.search input:focus{border-color:var(--purple);box-shadow:0 0 0 3px #7046e81a}
.section{margin:30px 0}
.section h2{font-size:19px;margin:0 0 15px}
.tools{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}
.tool{background:#fff;border:1px solid var(--border);border-radius:16px;padding:19px;text-align:left;cursor:pointer;transition:.2s;min-height:120px;color:var(--ink);font:inherit}
.tool:hover{transform:translateY(-3px);border-color:#bcaafa;box-shadow:0 8px 24px #3920780c}
.tool .emoji{font-size:25px;margin-bottom:10px}
.tool strong{display:block;font-size:15px;margin-bottom:5px}
.tool small{color:var(--muted);font-size:12px;line-height:1.5}
.workspace{display:none;background:white;border:1px solid var(--border);border-radius:20px;padding:25px;max-width:720px;margin:20px auto 40px}
.workspace.active{display:block}
.back{border:0;background:#f1edfc;color:var(--purple);font-weight:700;padding:10px 14px;border-radius:10px;cursor:pointer;margin-bottom:20px}
.workspace h2{margin:0 0 8px;font-size:25px}
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
.notice{background:#f0edfc;border-radius:13px;padding:16px;color:#55428c;font-size:12px;line-height:1.6;margin-top:35px}
footer{text-align:center;padding:25px;color:var(--muted);font-size:12px;border-top:1px solid var(--border);background:white}
@media(max-width:850px){.tools{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.tools{grid-template-columns:1fr}.hero{padding-top:20px}main{padding:22px 15px 45px}.workspace{padding:18px}.nav{padding:14px 16px}}
</style>
</head>
<body>
<header><div class="nav"><div class="logo">ÑAPP<span>IX</span></div><small>Herramientas digitales</small></div></header>

<main>
<section class="hero">
<h1>Todo lo que necesitas, <span>en un solo lugar.</span></h1>
<p>Convierte, comprime, organiza y crea con ÑAPPIX.</p>
</section>

<div class="search">
<input id="search" type="search" placeholder="¿Qué herramienta estás buscando?">
</div>

<section id="catalog">
<div class="section">
<h2>🖼️ Herramientas de imágenes</h2>
<div class="tools">
<button class="tool" data-tool="image-convert"><div class="emoji">🔄</div><strong>Convertir imágenes</strong><small>Convierte JPG, PNG y WEBP.</small></button>
<button class="tool" data-tool="image-compress"><div class="emoji">📉</div><strong>Comprimir imágenes</strong><small>Reduce el peso de tus imágenes.</small></button>
<button class="tool" data-tool="image-resize"><div class="emoji">📐</div><strong>Cambiar tamaño</strong><small>Ajusta las dimensiones de una imagen.</small></button>
</div>
</div>

<div class="section">
<h2>📄 Herramientas PDF</h2>
<div class="tools">
<button class="tool" data-tool="pdf-merge"><div class="emoji">📚</div><strong>Unir PDF</strong><small>Combina varios documentos PDF.</small></button>
<button class="tool" data-tool="pdf-split"><div class="emoji">✂️</div><strong>Dividir PDF</strong><small>Extrae un rango de páginas.</small></button>
<button class="tool" data-tool="pdf-delete"><div class="emoji">🗑️</div><strong>Eliminar páginas PDF</strong><small>Quita las páginas que no necesitas.</small></button>
<button class="tool" data-tool="pdf-rotate"><div class="emoji">🔃</div><strong>Rotar PDF</strong><small>Gira las páginas de tu documento.</small></button>
<button class="tool" data-tool="pdf-word"><div class="emoji">📝</div><strong>PDF a Word</strong><small>Extrae texto y crea un documento DOCX.</small></button>
<button class="tool" data-tool="pdf-images"><div class="emoji">🖼️</div><strong>PDF a JPG / PNG</strong><small>Convierte las páginas en imágenes.</small></button>
</div>
</div>

<div class="section">
<h2>🧰 Herramientas adicionales</h2>
<div class="tools">
<button class="tool" data-tool="qr"><div class="emoji">🔳</div><strong>Crear código QR</strong><small>Genera un QR para un texto o enlace.</small></button>
<button class="tool" data-tool="zip"><div class="emoji">🗜️</div><strong>Comprimir archivos ZIP</strong><small>Guarda varios archivos en un ZIP.</small></button>
<button class="tool" data-tool="media-convert"><div class="emoji">🎬</div><strong>Convertir audio y video</strong><small>Convierte archivos multimedia.</small></button>
<button class="tool" data-tool="media-cut"><div class="emoji">🎞️</div><strong>Recortar video</strong><small>Extrae un fragmento de un video.</small></button>
<button class="tool" data-tool="media-audio"><div class="emoji">🎵</div><strong>Extraer audio</strong><small>Obtén el audio de un archivo multimedia.</small></button>
</div>
</div>
<div class="empty" id="empty">No encontramos herramientas con esa búsqueda.</div>
</section>

<section class="workspace" id="workspace">
<button class="back" id="back">← Volver a las herramientas</button>
<h2 id="toolTitle"></h2>
<p class="description" id="toolDescription"></p>
<form id="toolForm">
<div id="fields"></div>
<button class="primary" id="submit" type="submit">Procesar archivo</button>
<div class="message" id="message"></div>
</form>
</section>

<div class="notice">
<strong>Uso responsable:</strong> utiliza únicamente archivos propios o aquellos sobre los que tengas autorización. Respeta los derechos de autor, las licencias y la privacidad de terceros. ÑAPPIX no permite ni promueve la distribución no autorizada de contenido protegido.
<br><br>
Los archivos se procesan temporalmente para generar el resultado. No subas documentos confidenciales o información sensible.
</div>
</main>

<footer>© 2026 ÑAPPIX · Más herramientas. Más posibilidades.</footer>

<script>
const definitions = {
"image-convert": {
title:"Convertir imágenes",description:"Transforma tus imágenes a otro formato.",
endpoint:"/api/convert/image",fields:[
{type:"file",name:"file",label:"Selecciona una imagen",accept:"image/jpeg,image/png,image/webp",required:true},
{type:"select",name:"format",label:"Formato de salida",options:["png","jpg","webp"]}
]},
"image-compress": {
title:"Comprimir imágenes",description:"Reduce el tamaño del archivo de imagen.",
endpoint:"/api/compress/image",fields:[
{type:"file",name:"file",label:"Selecciona una imagen",accept:"image/jpeg,image/png,image/webp",required:true}
]},
"image-resize": {
title:"Cambiar tamaño de imagen",description:"Ajusta las dimensiones de tu imagen.",
endpoint:"/api/resize/image",fields:[
{type:"file",name:"file",label:"Selecciona una imagen",accept:"image/jpeg,image/png,image/webp",required:true},
{type:"number",name:"width",label:"Ancho en píxeles",value:800},
{type:"number",name:"height",label:"Alto en píxeles",value:800}
]},
"pdf-merge": {
title:"Unir PDF",description:"Selecciona dos o más documentos PDF.",
endpoint:"/api/pdf/merge",fields:[
{type:"file",name:"files",label:"Selecciona los PDF",accept:"application/pdf",multiple:true,required:true}
]},
"pdf-split": {
title:"Dividir PDF",description:"Extrae un rango de páginas de un documento.",
endpoint:"/api/pdf/split",fields:[
{type:"file",name:"file",label:"Selecciona un PDF",accept:"application/pdf",required:true},
{type:"number",name:"start",label:"Página inicial",value:1},
{type:"number",name:"end",label:"Página final",value:2}
]},
"pdf-delete": {
title:"Eliminar páginas PDF",description:"Indica las páginas que deseas quitar. Puedes escribir 2, 4 o 6-8.",
endpoint:"/api/pdf/delete-pages",fields:[
{type:"file",name:"file",label:"Selecciona un PDF",accept:"application/pdf",required:true},
{type:"text",name:"pages",label:"Páginas que deseas eliminar",placeholder:"Ejemplo: 2, 4, 6-8",required:true}
]},
"pdf-rotate": {
title:"Rotar PDF",description:"Gira todas las páginas del documento.",
endpoint:"/api/pdf/rotate",fields:[
{type:"file",name:"file",label:"Selecciona un PDF",accept:"application/pdf",required:true},
{type:"select",name:"degrees",label:"Rotación",options:["90","180","270"]}
]},
"pdf-word": {
title:"Convertir PDF a Word",description:"Extrae el texto de un PDF y crea un documento Word. Los PDF escaneados pueden necesitar OCR.",
endpoint:"/api/pdf/to-word",fields:[
{type:"file",name:"file",label:"Selecciona un PDF",accept:"application/pdf",required:true}
]},
"pdf-images": {
title:"Convertir PDF a imágenes",description:"Convierte cada página en una imagen JPG o PNG y descárgalas juntas en un ZIP.",
endpoint:"/api/pdf/to-images",fields:[
{type:"file",name:"file",label:"Selecciona un PDF (máximo 30 páginas)",accept:"application/pdf",required:true},
{type:"select",name:"format",label:"Formato de imagen",options:["jpg","png"]}
]},
"qr": {
title:"Crear código QR",description:"Crea un código QR para un enlace o texto.",
endpoint:"/api/qr",json:true,fields:[
{type:"text",name:"text",label:"Escribe un enlace o texto",placeholder:"https://ejemplo.com",required:true}
]},
"zip": {
title:"Comprimir archivos ZIP",description:"Agrupa hasta cinco archivos en un solo ZIP.",
endpoint:"/api/zip",fields:[
{type:"file",name:"files",label:"Selecciona tus archivos",multiple:true,required:true}
]},
"media-convert": {
title:"Convertir audio y video",description:"Convierte archivos multimedia a formatos compatibles.",
endpoint:"/api/media/convert",fields:[
{type:"file",name:"file",label:"Selecciona un archivo multimedia",required:true},
{type:"select",name:"format",label:"Formato de salida",options:["mp4","webm","mp3","wav","ogg"]}
]},
"media-cut": {
title:"Recortar video",description:"Extrae un fragmento de tu video. El resultado se guarda en MP4.",
endpoint:"/api/media/cut",fields:[
{type:"file",name:"file",label:"Selecciona un video",required:true},
{type:"number",name:"start",label:"Inicio en segundos",value:0},
{type:"number",name:"duration",label:"Duración en segundos",value:10}
]},
"media-audio": {
title:"Extraer audio",description:"Extrae la pista de audio de un archivo multimedia.",
endpoint:"/api/media/audio",fields:[
{type:"file",name:"file",label:"Selecciona un archivo multimedia",required:true}
]}
};

const catalog = document.getElementById("catalog");
const workspace = document.getElementById("workspace");
const fields = document.getElementById("fields");
const form = document.getElementById("toolForm");
const message = document.getElementById("message");
const search = document.getElementById("search");
let currentTool = null;

function openTool(id) {
  const tool = definitions[id];
  if (!tool) return;
  currentTool = tool;
  document.getElementById("toolTitle").textContent = tool.title;
  document.getElementById("toolDescription").textContent = tool.description;
  fields.innerHTML = "";

  tool.fields.forEach(field => {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    const label = document.createElement("label");
    label.textContent = field.label;
    wrapper.appendChild(label);

    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      field.options.forEach(option => {
        const opt = document.createElement("option");
        opt.value = option;
        opt.textContent = option.toUpperCase();
        input.appendChild(opt);
      });
    } else {
      input = document.createElement("input");
      input.type = field.type;
      if (field.accept) input.accept = field.accept;
      if (field.multiple) input.multiple = true;
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.value !== undefined) input.value = field.value;
    }

    input.name = field.name;
    input.required = Boolean(field.required);
    wrapper.appendChild(input);
    fields.appendChild(wrapper);
  });

  message.className = "message";
  message.textContent = "";
  document.getElementById("submit").disabled = false;
  catalog.style.display = "none";
  document.querySelector(".hero").style.display = "none";
  document.querySelector(".search").style.display = "none";
  workspace.classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
}

function backToCatalog() {
  workspace.classList.remove("active");
  catalog.style.display = "";
  document.querySelector(".hero").style.display = "";
  document.querySelector(".search").style.display = "";
  currentTool = null;
  window.scrollTo({top:0,behavior:"smooth"});
}

document.querySelectorAll(".tool").forEach(button => {
  button.addEventListener("click", () => openTool(button.dataset.tool));
});

document.getElementById("back").addEventListener("click", backToCatalog);

search.addEventListener("input", () => {
  const query = search.value.toLowerCase().trim();
  let visible = 0;

  document.querySelectorAll(".section").forEach(section => {
    let sectionVisible = 0;
    section.querySelectorAll(".tool").forEach(button => {
      const match = button.innerText.toLowerCase().includes(query);
      button.style.display = match ? "" : "none";
      if (match) sectionVisible++;
    });
    section.style.display = sectionVisible ? "" : "none";
    visible += sectionVisible;
  });

  document.getElementById("empty").style.display = visible ? "none" : "block";
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentTool) return;

  const button = document.getElementById("submit");
  button.disabled = true;
  button.textContent = "Procesando...";
  message.className = "message";
  message.textContent = "";

  try {
    let response;

    if (currentTool.json) {
      const data = {};
      new FormData(form).forEach((value, key) => data[key] = value);
      response = await fetch(currentTool.endpoint, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(data)
      });
    } else {
      response = await fetch(currentTool.endpoint, {
        method:"POST",
        body:new FormData(form)
      });
    }

    if (!response.ok) {
      let error = "No se pudo procesar el archivo.";
      try {
        const data = await response.json();
        if (data.error) error = data.error;
      } catch {}
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
    button.textContent = "Procesar archivo";
  }
});
</script>
</body>
</html>`);
});

// ==========================================
// MANEJO DE ERRORES
// ==========================================

app.use((err, req, res, next) => {
  console.error("Error:", err.message);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: err.code === "LIMIT_FILE_SIZE"
        ? "El archivo supera el tamaño máximo permitido."
        : "La carga del archivo no pudo completarse."
    });
  }

  if (err.message === "File type not allowed") {
    return res.status(400).json({ error: "Tipo de archivo no permitido." });
  }

  if (!res.headersSent) {
    res.status(500).json({ error: "Ocurrió un error interno al procesar la solicitud." });
  }
});

app.listen(PORT, () => {
  console.log(`ÑAPPIX 2.1.0 funcionando en el puerto ${PORT}`);
});

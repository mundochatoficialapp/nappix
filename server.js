
const express = require('express');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PDFDocument } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const { Document, Packer, Paragraph } = require('docx');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

app.use('/api/', limiter);

const storage = multer.memoryStorage();

const imageUpload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Formato no permitido. Usa JPG, PNG o WEBP.'));
    }

    cb(null, true);
  }
});

const pdfUpload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 10
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Solo se permiten archivos PDF.'));
    }

    cb(null, true);
  }
});

function sendImage(res, buffer, mime, filename) {
  res.setHeader('Content-Type', mime);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}

function sendPdf(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );
  res.setHeader('Cache-Control', 'no-store');
  res.send(Buffer.from(buffer));
}

function createImage(buffer) {
  return sharp(buffer, {
    limitInputPixels: 40000000
  }).rotate();
}

// ESTADO DEL SERVIDOR
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'ÑAPPIX',
    tools: [
      'convert-image',
      'compress-image',
      'resize-image',
      'merge-pdf',
      'split-pdf',
      'pdf-to-word'
    ]
  });
});

// CONVERTIR IMÁGENES
app.post('/api/convert/image', imageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Selecciona una imagen.' });
    }

    const format = String(req.body.format || 'png').toLowerCase();

    const formats = {
      jpg: { format: 'jpeg', mime: 'image/jpeg', ext: 'jpg' },
      jpeg: { format: 'jpeg', mime: 'image/jpeg', ext: 'jpg' },
      png: { format: 'png', mime: 'image/png', ext: 'png' },
      webp: { format: 'webp', mime: 'image/webp', ext: 'webp' }
    };

    const selected = formats[format];

    if (!selected) {
      return res.status(400).json({ error: 'Formato de salida no válido.' });
    }

    const output = await createImage(req.file.buffer)
      .toFormat(selected.format)
      .toBuffer();

    sendImage(res, output, selected.mime, `nappix-convertida.${selected.ext}`);
  } catch (error) {
    next(error);
  }
});

// COMPRIMIR IMÁGENES
app.post('/api/compress/image', imageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Selecciona una imagen.' });
    }

    const quality = Math.max(
      20,
      Math.min(100, Number(req.body.quality) || 75)
    );

    const image = createImage(req.file.buffer);
    const metadata = await image.metadata();

    let output;
    let mime;
    let extension;

    if (metadata.format === 'jpeg') {
      output = await image.jpeg({
        quality,
        mozjpeg: true
      }).toBuffer();

      mime = 'image/jpeg';
      extension = 'jpg';

    } else if (metadata.format === 'png') {
      output = await image.png({
        compressionLevel: 9,
        palette: true
      }).toBuffer();

      mime = 'image/png';
      extension = 'png';

    } else {
      output = await image.webp({ quality }).toBuffer();

      mime = 'image/webp';
      extension = 'webp';
    }

    sendImage(res, output, mime, `nappix-comprimida.${extension}`);
  } catch (error) {
    next(error);
  }
});

// CAMBIAR TAMAÑO DE IMÁGENES
app.post('/api/resize/image', imageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Selecciona una imagen.' });
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
        error: 'Introduce un ancho y alto válidos, hasta 5000 píxeles.'
      });
    }

    const image = createImage(req.file.buffer);

    const output = await image.resize({
      width,
      height,
      fit: 'inside',
      withoutEnlargement: true
    }).toBuffer();

    const metadata = await sharp(output).metadata();

    const formats = {
      jpeg: { mime: 'image/jpeg', ext: 'jpg' },
      png: { mime: 'image/png', ext: 'png' },
      webp: { mime: 'image/webp', ext: 'webp' }
    };

    const selected = formats[metadata.format] || formats.jpeg;

    sendImage(
      res,
      output,
      selected.mime,
      `nappix-redimensionada.${selected.ext}`
    );
  } catch (error) {
    next(error);
  }
});

// UNIR ARCHIVOS PDF
app.post('/api/pdf/merge', pdfUpload.array('files', 10), async (req, res, next) => {
  try {
    const files = req.files || [];

    if (files.length < 2) {
      return res.status(400).json({
        error: 'Selecciona al menos dos archivos PDF.'
      });
    }

    const mergedPdf = await PDFDocument.create();

    for (const file of files) {
      const sourcePdf = await PDFDocument.load(file.buffer);

      const pages = await mergedPdf.copyPages(
        sourcePdf,
        sourcePdf.getPageIndices()
      );

      pages.forEach(page => mergedPdf.addPage(page));
    }

    const output = await mergedPdf.save();

    sendPdf(res, output, 'nappix-pdf-unido.pdf');
  } catch (error) {
    next(error);
  }
});

// DIVIDIR ARCHIVOS PDF
app.post('/api/pdf/split', pdfUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Selecciona un archivo PDF.'
      });
    }

    const sourcePdf = await PDFDocument.load(req.file.buffer);
    const totalPages = sourcePdf.getPageCount();

    const start = Number(req.body.start);
    const end = Number(req.body.end);

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end < start ||
      end > totalPages
    ) {
      return res.status(400).json({
        error: `Introduce un rango válido entre 1 y ${totalPages}.`
      });
    }

    const newPdf = await PDFDocument.create();

    const pageIndices = Array.from(
      { length: end - start + 1 },
      (_, index) => start - 1 + index
    );

    const pages = await newPdf.copyPages(sourcePdf, pageIndices);

    pages.forEach(page => newPdf.addPage(page));

    const output = await newPdf.save();

    sendPdf(res, output, 'nappix-pdf-dividido.pdf');
  } catch (error) {
    next(error);
  }
});

// CONVERTIR PDF A WORD
app.post('/api/pdf/to-word', pdfUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Selecciona un archivo PDF.'
      });
    }

    // Extraer texto del PDF
    const parsed = await pdfParse(req.file.buffer);

    const extractedText = String(parsed.text || '').trim();

    if (!extractedText) {
      return res.status(400).json({
        error: 'No encontramos texto en este PDF. Si es un documento escaneado, necesitará OCR.'
      });
    }

    // Organizar el texto en párrafos de Word
    const paragraphs = extractedText
      .replace(/\r/g, '')
      .split(/\n+/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => new Paragraph({
        children: [{
          text: line
        }]
      }));

    const document = new Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    });

    // Crear documento DOCX
    const output = await Packer.toBuffer(document);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="nappix-convertido.docx"'
    );

    res.setHeader('Cache-Control', 'no-store');

    res.send(output);

  } catch (error) {
    next(error);
  }
});

// ARCHIVOS PÚBLICOS
app.use(express.static(path.join(__dirname, 'public')));

// PÁGINA PRINCIPAL
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }

  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// MANEJO DE ERRORES
app.use((error, req, res, next) => {
  console.error('Error en ÑAPPIX:', error);

  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: error.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el límite permitido.'
        : 'No se pudo procesar el archivo.'
    });
  }

  res.status(400).json({
    error: error.message || 'Ocurrió un error al procesar el archivo.'
  });
});

// INICIAR SERVIDOR
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ÑAPPIX funcionando en el puerto ${PORT}`);
});

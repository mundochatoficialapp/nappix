
const express = require('express');
const http = require('http');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PDFDocument } = require('pdf-lib');

const app = express();

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
      return cb(new Error('Formato de imagen no permitido.'));
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

function sendImage(res, buffer, filename, contentType) {
  res.setHeader('Content-Type', contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );
  res.send(buffer);
}

function sendPdf(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );
  res.send(Buffer.from(buffer));
}

// Estado del servidor
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'ÑAPPIX',
    tools: ['convert', 'compress', 'resize', 'merge-pdf', 'split-pdf']
  });
});

// CONVERTIR IMÁGENES
app.post('/api/convert/image', imageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Selecciona una imagen.' });
    }

    const format = String(req.body.format || 'png').toLowerCase();
    const formats = ['png', 'jpeg', 'webp'];

    if (!formats.includes(format)) {
      return res.status(400).json({ error: 'Formato no válido.' });
    }

    const output = await sharp(req.file.buffer)
      .toFormat(format)
      .toBuffer();

    const extension = format === 'jpeg' ? 'jpg' : format;

    sendImage(
      res,
      output,
      `nappix-convertida.${extension}`,
      `image/${format}`
    );
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

    const metadata = await sharp(req.file.buffer).metadata();
    let pipeline = sharp(req.file.buffer);

    if (metadata.format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    } else if (metadata.format === 'png') {
      pipeline = pipeline.png({ compressionLevel: 9, palette: true });
    } else {
      pipeline = pipeline.webp({ quality });
    }

    const output = await pipeline.toBuffer();

    sendImage(
      res,
      output,
      `nappix-comprimida.${metadata.format === 'jpeg' ? 'jpg' : metadata.format}`,
      `image/${metadata.format}`
    );
  } catch (error) {
    next(error);
  }
});

// CAMBIAR TAMAÑO
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

    const output = await sharp(req.file.buffer)
      .resize({
        width,
        height,
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    const metadata = await sharp(output).metadata();
    const format = metadata.format || 'jpeg';

    sendImage(
      res,
      output,
      `nappix-redimensionada.${format === 'jpeg' ? 'jpg' : format}`,
      `image/${format}`
    );
  } catch (error) {
    next(error);
  }
});

// UNIR PDF
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

// DIVIDIR PDF
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

// Archivos públicos
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejo de errores
app.use((error, req, res, next) => {
  console.error(error);

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`ÑAPPIX funcionando en el puerto ${PORT}`);
});


const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(express.json({ limit: '1mb' }));

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}));

// ==========================================
// CONFIGURACIÓN DE ARCHIVOS
// ==========================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no permitido. Usa JPG, PNG o WEBP.'));
    }
  }
});

const formats = {
  jpg: { format: 'jpeg', mime: 'image/jpeg', extension: 'jpg' },
  jpeg: { format: 'jpeg', mime: 'image/jpeg', extension: 'jpg' },
  png: { format: 'png', mime: 'image/png', extension: 'png' },
  webp: { format: 'webp', mime: 'image/webp', extension: 'webp' }
};

function safeName(filename) {
  return path.parse(filename)
    .name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80) || 'imagen';
}

function sendImage(res, buffer, mime, filename) {
  res.setHeader('Content-Type', mime);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}

function createImage(buffer) {
  return sharp(buffer, {
    limitInputPixels: 40000000
  }).rotate();
}

// ==========================================
// ESTADO DEL SERVIDOR
// ==========================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    project: 'ÑAPPIX',
    message: 'Servidor funcionando correctamente',
    tools: [
      'convert-image',
      'compress-image',
      'resize-image'
    ]
  });
});

// ==========================================
// CONVERTIR IMÁGENES
// ==========================================

app.post('/api/convert/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Selecciona una imagen.'
      });
    }

    const format = String(req.body.format || '').toLowerCase();
    const selected = formats[format];

    if (!selected) {
      return res.status(400).json({
        error: 'Formato de salida no válido.'
      });
    }

    const image = createImage(req.file.buffer);

    let converted;

    if (selected.format === 'jpeg') {
      converted = await image.jpeg({ quality: 85 }).toBuffer();
    } else if (selected.format === 'png') {
      converted = await image.png().toBuffer();
    } else {
      converted = await image.webp({ quality: 85 }).toBuffer();
    }

    const filename = safeName(req.file.originalname);

    sendImage(
      res,
      converted,
      selected.mime,
      `${filename}.${selected.extension}`
    );

  } catch (error) {
    console.error('Error convirtiendo imagen:', error.message);

    res.status(400).json({
      error: 'No pudimos convertir esta imagen. Intenta con otro archivo.'
    });
  }
});

// ==========================================
// COMPRIMIR IMÁGENES
// ==========================================

app.post('/api/compress/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Selecciona una imagen.'
      });
    }

    const quality = Math.min(
      95,
      Math.max(20, Number(req.body.quality) || 70)
    );

    const mime = req.file.mimetype;
    const image = createImage(req.file.buffer);

    let compressed;
    let extension;

    if (mime === 'image/jpeg') {
      compressed = await image.jpeg({
        quality,
        mozjpeg: true
      }).toBuffer();
      extension = 'jpg';

    } else if (mime === 'image/png') {
      compressed = await image.png({
        compressionLevel: 9,
        palette: true,
        quality
      }).toBuffer();
      extension = 'png';

    } else {
      compressed = await image.webp({
        quality
      }).toBuffer();
      extension = 'webp';
    }

    const filename = safeName(req.file.originalname);

    sendImage(
      res,
      compressed,
      mime,
      `${filename}-comprimida.${extension}`
    );

  } catch (error) {
    console.error('Error comprimiendo imagen:', error.message);

    res.status(400).json({
      error: 'No pudimos comprimir esta imagen.'
    });
  }
});

// ==========================================
// REDIMENSIONAR IMÁGENES
// ==========================================

app.post('/api/resize/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Selecciona una imagen.'
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
        error: 'Introduce un ancho y alto entre 1 y 5000 píxeles.'
      });
    }

    const mime = req.file.mimetype;
    const image = createImage(req.file.buffer);

    let resized = image.resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true
    });

    let output;

    if (mime === 'image/jpeg') {
      output = await resized.jpeg({ quality: 85 }).toBuffer();
    } else if (mime === 'image/png') {
      output = await resized.png().toBuffer();
    } else {
      output = await resized.webp({ quality: 85 }).toBuffer();
    }

    const extension = mime === 'image/jpeg'
      ? 'jpg'
      : mime === 'image/png'
        ? 'png'
        : 'webp';

    const filename = safeName(req.file.originalname);

    sendImage(
      res,
      output,
      mime,
      `${filename}-redimensionada.${extension}`
    );

  } catch (error) {
    console.error('Error redimensionando imagen:', error.message);

    res.status(400).json({
      error: 'No pudimos redimensionar esta imagen.'
    });
  }
});

// ==========================================
// ARCHIVOS PÚBLICOS
// ==========================================

app.use(express.static(path.join(__dirname, 'public')));

app.get('*path', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// MANEJO DE ERRORES
// ==========================================

app.use((error, req, res, next) => {
  console.error(error.message);

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: 'El archivo supera el límite permitido de 15 MB.'
    });
  }

  res.status(400).json({
    error: error.message || 'Ha ocurrido un error.'
  });
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ÑAPPIX funcionando en el puerto ${PORT}`);
});

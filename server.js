
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

const storage = multer.memoryStorage();

const upload = multer({
  storage,
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

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    project: 'ÑAPPIX',
    message: 'Servidor funcionando correctamente'
  });
});

app.post('/api/convert/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Selecciona una imagen.'
      });
    }

    const format = String(req.body.format || '').toLowerCase();

    const formats = {
      jpg: { format: 'jpeg', mime: 'image/jpeg' },
      jpeg: { format: 'jpeg', mime: 'image/jpeg' },
      png: { format: 'png', mime: 'image/png' },
      webp: { format: 'webp', mime: 'image/webp' }
    };

    const selected = formats[format];

    if (!selected) {
      return res.status(400).json({
        error: 'Formato de salida no válido.'
      });
    }

    const image = sharp(req.file.buffer, {
      limitInputPixels: 40000000
    }).rotate();

    let converted;

    if (selected.format === 'jpeg') {
      converted = await image.jpeg({ quality: 85 }).toBuffer();
    } else if (selected.format === 'png') {
      converted = await image.png().toBuffer();
    } else {
      converted = await image.webp({ quality: 85 }).toBuffer();
    }

    const originalName = path.parse(req.file.originalname).name
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 80) || 'imagen';

    res.setHeader('Content-Type', selected.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${originalName}.${format === 'jpeg' ? 'jpg' : format}"`
    );

    res.send(converted);
  } catch (error) {
    console.error('Error convirtiendo imagen:', error.message);

    res.status(400).json({
      error: 'No pudimos convertir esta imagen. Intenta con otro archivo.'
    });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*path', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ÑAPPIX funcionando en el puerto ${PORT}`);
});

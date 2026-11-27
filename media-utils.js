"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const ffmpegPath = require("ffmpeg-static");

// ==========================================
// CONFIGURACIÓN (ajustable con variables de entorno en Render)
// ==========================================

const MAX_JOBS = Number(process.env.FFMPEG_JOBS) || 1;          // trabajos de ffmpeg a la vez
const MAX_QUEUE = Number(process.env.FFMPEG_QUEUE) || 4;        // personas esperando turno
const TIMEOUT_MS = (Number(process.env.FFMPEG_TIMEOUT_MIN) || 5) * 60 * 1000;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

// ==========================================
// COLA DE FFMPEG CON TIMEOUT
// ==========================================

let running = 0;
const waiting = [];

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("FFmpeg no está disponible."));

    const start = () => {
      running++;
      let finished = false;
      let timedOut = false;
      let errorText = "";

      // -protocol_whitelist file: ffmpeg solo lee archivos locales (no URLs ni redes)
      const proc = spawn(ffmpegPath, [
        "-hide_banner", "-nostdin", "-protocol_whitelist", "file", ...args
      ]);

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill("SIGKILL");
      }, TIMEOUT_MS);

      const finish = err => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        running--;
        if (waiting.length) waiting.shift()();
        err ? reject(err) : resolve();
      };

      proc.stderr.on("data", data => {
        errorText = (errorText + data.toString()).slice(-1500);
      });
      proc.on("error", finish);
      proc.on("close", code => {
        if (code === 0) return finish(null);
        finish(new Error(timedOut
          ? "El proceso tardó demasiado y se canceló."
          : errorText || "Error al procesar el medio."));
      });
    };

    running < MAX_JOBS ? start() : waiting.push(start);
  });
}

// Si la fila ya está llena, responde antes de recibir el archivo
function busyGuard(req, res, next) {
  if (waiting.length >= MAX_QUEUE) {
    return res.status(503).json({
      error: "Estamos procesando muchos archivos de audio y video. Inténtalo de nuevo en un minuto."
    });
  }
  next();
}

// ==========================================
// SUBIDAS A DISCO (en vez de memoria)
// ==========================================

const UPLOAD_DIR = path.join(os.tmpdir(), "nappix-uploads");
fs.rmSync(UPLOAD_DIR, { recursive: true, force: true }); // limpia restos de reinicios anteriores
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, crypto.randomUUID())
});

const MEDIA_EXTENSIONS = new Set([
  "mp4", "m4v", "mov", "mkv", "avi", "webm", "wmv", "mpg", "mpeg", "3gp",
  "mp3", "m4a", "aac", "wav", "ogg", "oga", "opus", "flac", "wma"
]);

function isMedia(file) {
  if (/^(audio|video)\//.test(file.mimetype)) return true;
  const ext = path.extname(file.originalname || "").slice(1).toLowerCase();
  return MEDIA_EXTENSIONS.has(ext);
}

const mediaUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => cb(null, isMedia(file))
});

const zipUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: 5 }
});

// Borra los archivos subidos cuando termina la respuesta (con éxito o con error)
function cleanupUploads(req, res, next) {
  res.on("close", () => {
    let files = [];
    if (Array.isArray(req.files)) files = req.files;
    else if (req.files) files = Object.values(req.files).flat();
    else if (req.file) files = [req.file];
    files.forEach(file => fs.unlink(file.path, () => {}));
  });
  next();
}

// ==========================================
// LÍMITE ESTRICTO PARA AUDIO Y VIDEO
// ==========================================

const mediaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Has usado muchas herramientas de audio y video. Espera unos minutos e inténtalo de nuevo." }
});

module.exports = {
  runFfmpeg,
  busyGuard,
  mediaUpload,
  zipUpload,
  cleanupUploads,
  mediaLimiter
};

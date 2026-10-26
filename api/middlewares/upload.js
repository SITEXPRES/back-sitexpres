import multer from "multer";
import path from "path";
import fs from "fs";

// Criar pasta se não existir
const uploadDir = "uploads/logos";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const uniqueName = uniqueSuffix + ext;
    cb(null, uniqueName);
  },
});

// Validação de tipo de arquivo abrangente (MIME type ou extensão)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /\.(jpeg|jpg|png|gif|webp|svg|ico|bmp|avif)$/i;
  const isImageMime = file.mimetype && (file.mimetype.startsWith("image/") || /jpeg|jpg|png|gif|webp|svg|ico|bmp/i.test(file.mimetype));
  const hasImageExt = allowedExtensions.test(file.originalname || "");

  if (isImageMime || hasImageExt) {
    return cb(null, true);
  } else {
    cb(new Error("Apenas imagens são permitidas (jpeg, jpg, png, gif, webp, svg, ico, bmp, avif)"));
  }
};

export const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 30 * 1024 * 1024 } // Limite de 30MB
});
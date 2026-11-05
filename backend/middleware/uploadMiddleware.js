const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/medical-reports');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname).toLowerCase();
        const sanitizedBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${Date.now()}_${sanitizedBase}_${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const allowedMimeTypes = [
        'application/pdf',
        'image/jpeg',
        'image/pjpeg',
        'image/png'
    ];

    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file format. Only PDF, JPG, JPEG, and PNG files are allowed.'), false);
    }
};

const uploadReport = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_UPLOAD_SIZE, 10) || 10 * 1024 * 1024 // 10MB
    }
});

module.exports = { uploadReport };

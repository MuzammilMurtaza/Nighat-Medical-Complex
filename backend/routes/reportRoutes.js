const { protectAdmin } = require('../middleware/authMiddleware');
const express = require('express');
const router = express.Router();
const {
    uploadMedicalReport,
    getReports,
    markReportReviewed,
    downloadReportFile
} = require('../controllers/reportController');
const { uploadReport } = require('../middleware/uploadMiddleware');

router.post('/', uploadReport.single('reportFile'), uploadMedicalReport);
router.get('/', protectAdmin, getReports);
router.patch('/:id/review', protectAdmin, markReportReviewed);
router.get('/:id/download', protectAdmin, downloadReportFile);

module.exports = router;

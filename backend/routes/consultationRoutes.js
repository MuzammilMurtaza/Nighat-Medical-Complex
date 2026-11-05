const { protectAdmin } = require('../middleware/authMiddleware');
const express = require('express');
const router = express.Router();
const {
    createConsultationRequest,
    getConsultations,
    updateConsultationStatus
} = require('../controllers/consultationController');

router.post('/', createConsultationRequest);
router.get('/', protectAdmin, getConsultations);
router.patch('/:id/status', protectAdmin, updateConsultationStatus);

module.exports = router;

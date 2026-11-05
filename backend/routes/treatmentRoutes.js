const { protectAdmin } = require('../middleware/authMiddleware');
const express = require('express');
const router = express.Router();
const { getTreatments, createTreatment } = require('../controllers/treatmentController');

router.get('/', getTreatments);
router.post('/', protectAdmin, createTreatment);

module.exports = router;

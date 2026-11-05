const { protectAdmin } = require('../middleware/authMiddleware');
const express = require('express');
const router = express.Router();
const { getPatients } = require('../controllers/patientController');

router.get('/', protectAdmin, getPatients);

module.exports = router;

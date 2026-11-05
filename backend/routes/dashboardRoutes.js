const { protectAdmin } = require('../middleware/authMiddleware');
const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');

router.get('/stats', protectAdmin, getDashboardStats);

module.exports = router;

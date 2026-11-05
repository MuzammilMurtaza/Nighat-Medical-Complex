const express = require('express');
const router = express.Router();
const { adminLogin, getMe, adminLogout } = require('../controllers/adminController');
const { validateAdminLogin } = require('../middleware/validationMiddleware');
const { protectAdmin } = require('../middleware/authMiddleware');

router.post('/login', validateAdminLogin, adminLogin);
router.get('/me', protectAdmin, getMe);
router.post('/logout', adminLogout);

module.exports = router;

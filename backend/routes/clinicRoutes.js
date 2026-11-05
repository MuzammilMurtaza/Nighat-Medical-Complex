const { protectAdmin } = require('../middleware/authMiddleware');
const express = require('express');
const router = express.Router();
const {
    getClinics,
    updateClinic,
    getOffDays,
    addOffDay,
    deleteOffDay,
    getBlockedSlots,
    addBlockedSlot,
    deleteBlockedSlot,
    getSpecialSchedules,
    addSpecialSchedule
} = require('../controllers/clinicController');

router.get('/', getClinics);
router.patch('/:id', protectAdmin, updateClinic);

router.get('/off-days', getOffDays);
router.post('/off-days', protectAdmin, addOffDay);
router.delete('/off-days/:id', protectAdmin, deleteOffDay);

router.get('/blocked-slots', getBlockedSlots);
router.post('/blocked-slots', protectAdmin, addBlockedSlot);
router.delete('/blocked-slots/:id', protectAdmin, deleteBlockedSlot);

router.get('/special-schedules', getSpecialSchedules);
router.post('/special-schedules', protectAdmin, addSpecialSchedule);

module.exports = router;

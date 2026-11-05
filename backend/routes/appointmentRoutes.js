const express = require('express');
const router = express.Router();
const {
    getAvailableSlots,
    createAppointment,
    getAppointments,
    searchAppointments,
    confirmAppointment,
    cancelAppointment,
    updateAppointmentStatus,
    rescheduleAppointment
} = require('../controllers/appointmentController');
const { validateBookingInput } = require('../middleware/validationMiddleware');
const { protectAdmin } = require('../middleware/authMiddleware');

router.get('/slots', getAvailableSlots);
router.post('/', validateBookingInput, createAppointment);
router.get('/', protectAdmin, getAppointments);
router.get('/search', searchAppointments);
router.patch('/:id/confirm', confirmAppointment);
router.patch('/:id/cancel', cancelAppointment);
router.patch('/:id/status', protectAdmin, updateAppointmentStatus);
router.patch('/:id/reschedule', rescheduleAppointment);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/authMiddleware');
const {
    verifyWebhook,
    handleWebhook,
    simulateIncomingLead,
    createLead,
    getLeads,
    getLeadStats,
    getLeadById,
    updateLead,
    updateLeadMode,
    getLeadMessages,
    sendMessage,
    scheduleFollowUp,
    bookLeadAppointment,
    convertLead,
    deleteLead,
    leadStream
} = require('../controllers/leadController');

// 1. Meta Webhook & Public Simulator Endpoints
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);
router.post('/incoming-test', simulateIncomingLead);
router.get('/stream', leadStream);

// 2. Admin Protected Lead Management & Unified Inbox Endpoints
router.get('/stats', protectAdmin, getLeadStats);
router.get('/', protectAdmin, getLeads);
router.post('/', protectAdmin, createLead);
router.get('/:id', protectAdmin, getLeadById);
router.patch('/:id', protectAdmin, updateLead);
router.patch('/:id/mode', protectAdmin, updateLeadMode);
router.get('/:id/messages', protectAdmin, getLeadMessages);
router.post('/:id/messages', protectAdmin, sendMessage);
router.post('/:id/follow-up', protectAdmin, scheduleFollowUp);
router.post('/:id/book-appointment', protectAdmin, bookLeadAppointment);
router.post('/:id/convert', protectAdmin, convertLead);
router.delete('/:id', protectAdmin, deleteLead);

module.exports = router;

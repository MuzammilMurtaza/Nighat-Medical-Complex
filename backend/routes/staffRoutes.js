const express = require('express');
const router = express.Router();
const {
    handlePatientMessage,
    syncPatientChat,
    requestHandover,
    getStaffInbox,
    getStaffConversation,
    takeoverConversation,
    returnToAI,
    sendManualReply,
    updateStaffMessageStatus,
    createEmergencyAlert,
    getEmergencyAlerts,
    updateEmergencyAlertStatus
} = require('../controllers/staffController');
const { protectAdmin } = require('../middleware/authMiddleware');

// Patient Chat Endpoints (Public for patients)
router.post('/chat/message', require('express-rate-limit').rateLimit({ windowMs: 60000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }), handlePatientMessage);
router.get('/chat/messages', syncPatientChat);
router.get('/chat/sync', syncPatientChat);
router.post('/handover', requestHandover);

// Doctor & Staff Inbox Management Endpoints (Protected for authorized doctor/admin)
router.get('/inbox', protectAdmin, getStaffInbox);
router.get('/inbox/:id', protectAdmin, getStaffConversation);
router.post('/inbox/:id/takeover', protectAdmin, takeoverConversation);
router.post('/inbox/:id/return-ai', protectAdmin, returnToAI);
router.post('/inbox/:id/reply', protectAdmin, sendManualReply);
router.patch('/inbox/:id', protectAdmin, updateStaffMessageStatus);

// Emergency Alert Endpoints
router.post('/emergency', createEmergencyAlert);
router.get('/emergency', protectAdmin, getEmergencyAlerts);
router.patch('/emergency/:id', protectAdmin, updateEmergencyAlertStatus);

module.exports = router;

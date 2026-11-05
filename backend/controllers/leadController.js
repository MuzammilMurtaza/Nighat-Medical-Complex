const AdsLead = require('../models/AdsLead');
const LeadMessage = require('../models/LeadMessage');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const { generateLeadId } = require('../utils/leadIdGenerator');
const { generateAppointmentId } = require('../utils/appointmentIdGenerator');
const { generateTokenNumber } = require('../utils/tokenGenerator');
const { verifyMetaWebhook, handleMetaWebhookEvent } = require('../services/metaWebhookService');
const { processIncomingLeadMessage, sendAiResponse } = require('../services/leadAiService');
const { successResponse, errorResponse } = require('../utils/response');

// Active Server-Sent Events clients for real-time dashboard sync
const sseClients = new Set();

const broadcastSSE = (eventType, data) => {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        try {
            client.write(payload);
        } catch (e) {
            sseClients.delete(client);
        }
    }
};

// 1. GET /api/leads/webhook (Meta Verification)
const verifyWebhook = (req, res) => {
    return verifyMetaWebhook(req, res);
};

// 2. POST /api/leads/webhook (Meta Event Receiver)
const handleWebhook = async (req, res, next) => {
    try {
        const result = await handleMetaWebhookEvent(req.body, (eventData) => {
            broadcastSSE(eventData.type, eventData);
        });
        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

// 3. POST /api/leads/incoming-test (Simulator for Meta/WhatsApp/Web Leads)
const simulateIncomingLead = async (req, res, next) => {
    try {
        const {
            source = 'facebook_lead_ad',
            campaignName = 'FB Pain Relief Campaign',
            patientName = 'Test Patient',
            phone = '+923001234567',
            email = 'test@example.com',
            city = '',
            interestedTreatment = 'Regenerative Joint Therapy (PRP)',
            message = 'Hi',
            conversationMode = 'AI'
        } = req.body;

        const normalizedPhone = phone.trim();

        // Check for existing lead or create new
        let lead = await AdsLead.findOne({ phone: normalizedPhone });

        if (!lead) {
            const leadId = await generateLeadId(AdsLead);
            lead = await AdsLead.create({
                leadId,
                platformLeadId: `sim_${Date.now()}`,
                source,
                campaignName,
                patientName: patientName.trim(),
                phone: normalizedPhone,
                email: (email || '').trim().toLowerCase(),
                city: (city || '').trim(),
                interestedTreatment,
                leadMessage: message,
                leadStatus: 'New',
                priority: 'high',
                conversationMode: conversationMode || 'AI'
            });
        }

        // Process message through AI system
        const aiResult = await processIncomingLeadMessage({
            lead,
            incomingMessageText: message,
            sender: 'lead',
            platformMessageId: `sim_msg_${Date.now()}`
        });

        // Broadcast to admin dashboard
        broadcastSSE('NEW_LEAD', { lead, aiResult });

        return successResponse(res, 201, 'Test lead simulated successfully', { lead, aiResult });
    } catch (error) {
        next(error);
    }
};

// 4. POST /api/leads (Manual Lead Creation by Admin)
const createLead = async (req, res, next) => {
    try {
        const {
            patientName,
            phone,
            email,
            city,
            source = 'manual_entry',
            campaignName = 'Manual Entry',
            interestedTreatment,
            leadMessage,
            priority = 'medium',
            assignedTo,
            conversationMode = 'AI',
            notes,
            followUpAt,
            tags
        } = req.body;

        if (!patientName || !phone) {
            return errorResponse(res, 400, 'Patient Name and Phone Number are required.');
        }

        const normalizedPhone = phone.trim();

        // Prevent unwanted duplicate active leads
        const existing = await AdsLead.findOne({
            phone: normalizedPhone,
            leadStatus: { $nin: ['Closed', 'Not Interested', 'Converted'] }
        });

        if (existing) {
            return errorResponse(res, 409, `An active lead already exists with this phone number (${existing.leadId} - ${existing.patientName}).`);
        }

        const leadId = await generateLeadId(AdsLead);

        const newLead = await AdsLead.create({
            leadId,
            platformLeadId: `manual_${Date.now()}`,
            source,
            campaignName: campaignName || 'Clinic Staff Entry',
            patientName: patientName.trim(),
            phone: normalizedPhone,
            email: (email || '').trim().toLowerCase(),
            city: (city || '').trim(),
            interestedTreatment: interestedTreatment || 'General Consultation',
            leadMessage: leadMessage || '',
            leadStatus: 'New',
            priority,
            assignedTo: assignedTo || (req.admin?.name || 'Unassigned'),
            conversationMode,
            notes: notes || '',
            followUpAt: followUpAt ? new Date(followUpAt) : null,
            followUpStatus: followUpAt ? 'scheduled' : 'none',
            tags: Array.isArray(tags) ? tags : (tags ? [tags] : [])
        });

        // If an initial inquiry message was entered, record it in history
        if (leadMessage) {
            await processIncomingLeadMessage({
                lead: newLead,
                incomingMessageText: leadMessage,
                sender: 'lead'
            });
        }

        broadcastSSE('NEW_LEAD', { lead: newLead });

        return successResponse(res, 201, 'Lead created successfully', newLead);
    } catch (error) {
        next(error);
    }
};

// 5. GET /api/leads (List leads with pagination, search, and multi-filters)
const getLeads = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 50,
            search = '',
            source = '',
            campaign = '',
            status = '',
            mode = '',
            priority = '',
            assignedTo = '',
            treatment = '',
            startDate = '',
            endDate = '',
            sortBy = 'lastMessageAt',
            sortOrder = 'desc'
        } = req.query;

        const filter = {};

        if (source) filter.source = source;
        if (campaign) filter.campaignName = { $regex: campaign, $options: 'i' };
        if (status) filter.leadStatus = status;
        if (mode) filter.conversationMode = mode.toUpperCase();
        if (priority) filter.priority = priority;
        if (assignedTo) filter.assignedTo = { $regex: assignedTo, $options: 'i' };
        if (treatment) filter.interestedTreatment = { $regex: treatment, $options: 'i' };

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        if (search && search.trim()) {
            const cleanSearch = search.trim();
            const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const digitsOnly = cleanSearch.replace(/[^0-9]/g, '');

            filter.$or = [
                { patientName: { $regex: escaped, $options: 'i' } },
                { phone: { $regex: escaped, $options: 'i' } },
                { email: { $regex: escaped, $options: 'i' } },
                { leadId: { $regex: escaped, $options: 'i' } },
                { campaignName: { $regex: escaped, $options: 'i' } },
                { interestedTreatment: { $regex: escaped, $options: 'i' } }
            ];

            if (digitsOnly.length >= 4) {
                filter.$or.push({ phone: { $regex: digitsOnly, $options: 'i' } });
            }
        }

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        const [leads, totalCount] = await Promise.all([
            AdsLead.find(filter).sort(sort).skip(skip).limit(limitNum).populate('linkedAppointment'),
            AdsLead.countDocuments(filter)
        ]);

        return successResponse(res, 200, 'Leads retrieved successfully', {
            leads,
            pagination: {
                totalCount,
                currentPage: pageNum,
                totalPages: Math.ceil(totalCount / limitNum),
                limit: limitNum
            }
        });
    } catch (error) {
        next(error);
    }
};

// 6. GET /api/leads/stats (Dashboard Analytics & Breakdown)
const getLeadStats = async (req, res, next) => {
    try {
        const [
            totalLeads,
            newLeads,
            aiHandledLeads,
            manualLeads,
            qualifiedLeads,
            appointmentsBooked,
            convertedLeads,
            pendingFollowUps
        ] = await Promise.all([
            AdsLead.countDocuments(),
            AdsLead.countDocuments({ leadStatus: 'New' }),
            AdsLead.countDocuments({ conversationMode: 'AI' }),
            AdsLead.countDocuments({ conversationMode: 'MANUAL' }),
            AdsLead.countDocuments({ leadStatus: 'Qualified' }),
            AdsLead.countDocuments({
                $or: [
                    { leadStatus: 'Appointment Booked' },
                    { linkedAppointment: { $ne: null } }
                ]
            }),
            AdsLead.countDocuments({ leadStatus: 'Converted' }),
            AdsLead.countDocuments({
                followUpAt: { $exists: true, $ne: null },
                followUpStatus: 'scheduled'
            })
        ]);

        // Conversion Rate
        const conversionRate = totalLeads > 0
            ? (((convertedLeads + appointmentsBooked) / totalLeads) * 100).toFixed(1)
            : '0.0';

        // Platform Breakdown Aggregation
        const platformCounts = await AdsLead.aggregate([
            { $group: { _id: '$source', count: { $sum: 1 } } }
        ]);

        const platformBreakdown = {
            facebook_lead_ad: 0,
            instagram_lead_ad: 0,
            facebook_messenger: 0,
            instagram_dm: 0,
            whatsapp_ad: 0,
            website_chatbot: 0,
            manual_entry: 0
        };

        platformCounts.forEach(item => {
            if (item._id) platformBreakdown[item._id] = item.count;
        });

        // Campaign Breakdown
        const campaignCounts = await AdsLead.aggregate([
            { $group: { _id: '$campaignName', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 8 }
        ]);

        return successResponse(res, 200, 'Lead analytics metrics fetched', {
            totalLeads,
            newLeads,
            aiHandledLeads,
            manualLeads,
            qualifiedLeads,
            appointmentsBooked,
            convertedLeads,
            pendingFollowUps,
            conversionRate: `${conversionRate}%`,
            platformBreakdown,
            campaignBreakdown: campaignCounts.map(c => ({ campaign: c._id || 'General', count: c.count }))
        });
    } catch (error) {
        next(error);
    }
};

// 7. GET /api/leads/:id (Single Lead Details)
const getLeadById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const lead = await AdsLead.findOne({
            $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { leadId: id }]
        }).populate('linkedAppointment');

        if (!lead) return errorResponse(res, 404, 'Lead not found.');

        return successResponse(res, 200, 'Lead retrieved successfully', lead);
    } catch (error) {
        next(error);
    }
};

// 8. PATCH /api/leads/:id (Update lead fields, status, notes, tags)
const updateLead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Remove protected fields from direct update
        delete updates._id;
        delete updates.leadId;

        const updated = await AdsLead.findOneAndUpdate(
            { $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { leadId: id }] },
            updates,
            { new: true }
        ).populate('linkedAppointment');

        if (!updated) return errorResponse(res, 404, 'Lead not found.');

        broadcastSSE('UPDATE_LEAD', { lead: updated });

        return successResponse(res, 200, 'Lead updated successfully', updated);
    } catch (error) {
        next(error);
    }
};

// 9. PATCH /api/leads/:id/mode (Switch AI Mode vs MANUAL Mode)
const updateLeadMode = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { mode } = req.body;

        if (!['AI', 'MANUAL'].includes(mode)) {
            return errorResponse(res, 400, 'Invalid conversation mode. Must be "AI" or "MANUAL".');
        }

        const lead = await AdsLead.findOne({
            $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { leadId: id }]
        });

        if (!lead) return errorResponse(res, 404, 'Lead not found.');

        const prevMode = lead.conversationMode;
        lead.conversationMode = mode;

        const adminName = req.admin?.name || req.admin?.username || 'Clinic Admin';

        if (mode === 'MANUAL') {
            lead.manualTakenOverAt = new Date();
            lead.manualTakenOverBy = adminName;
        } else if (mode === 'AI') {
            lead.aiResumedAt = new Date();
            lead.aiResumedBy = adminName;
        }

        await lead.save();

        // Add a permanent system event in conversation timeline
        const systemMessageText = mode === 'MANUAL'
            ? `⚡ Switched to Manual Mode by ${adminName}. AI auto-replies are paused.`
            : `🤖 Resumed AI Mode by ${adminName}. AI Assistant will handle future patient responses.`;

        await LeadMessage.create({
            leadId: lead._id,
            leadCode: lead.leadId,
            sender: 'system',
            messageType: 'text',
            message: systemMessageText,
            timestamp: new Date(),
            deliveryStatus: 'delivered',
            sentBy: 'System',
            metadata: { modeChange: { from: prevMode, to: mode, changedBy: adminName } }
        });

        broadcastSSE('MODE_CHANGED', { leadId: lead.leadId, mode, changedBy: adminName });

        return successResponse(res, 200, `Lead conversation mode switched to ${mode}`, {
            leadId: lead.leadId,
            conversationMode: lead.conversationMode,
            manualTakenOverAt: lead.manualTakenOverAt,
            aiResumedAt: lead.aiResumedAt
        });
    } catch (error) {
        next(error);
    }
};

// 10. GET /api/leads/:id/messages (Get permanent chronological conversation history)
const getLeadMessages = async (req, res, next) => {
    try {
        const { id } = req.params;
        const lead = await AdsLead.findOne({
            $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { leadId: id }]
        });

        if (!lead) return errorResponse(res, 404, 'Lead not found.');

        const messages = await LeadMessage.find({ leadId: lead._id }).sort({ timestamp: 1 });

        return successResponse(res, 200, 'Lead conversation history loaded', {
            leadId: lead.leadId,
            patientName: lead.patientName,
            conversationMode: lead.conversationMode,
            messages
        });
    } catch (error) {
        next(error);
    }
};

// 11. POST /api/leads/:id/messages (Send Manual Staff Reply or Simulated Lead Message)
const sendMessage = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { message, sender = 'admin', mediaUrl = '' } = req.body;

        if (!message || !message.trim()) {
            return errorResponse(res, 400, 'Message text is required.');
        }

        const lead = await AdsLead.findOne({
            $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { leadId: id }]
        });

        if (!lead) return errorResponse(res, 404, 'Lead not found.');

        // If sent by staff/admin:
        if (sender === 'admin') {
            const adminName = req.admin?.name || req.admin?.username || 'Clinic Staff';

            const savedMsg = await LeadMessage.create({
                leadId: lead._id,
                leadCode: lead.leadId,
                sender: 'admin',
                messageType: mediaUrl ? 'image' : 'text',
                message: message.trim(),
                mediaUrl: mediaUrl || '',
                platformMessageId: `admin_${Date.now()}`,
                timestamp: new Date(),
                deliveryStatus: 'sent',
                sentBy: adminName,
                metadata: { adminId: req.admin?.id }
            });

            lead.lastMessage = message.trim();
            lead.lastMessageAt = new Date();
            // Automatically record takeover if in AI mode
            if (lead.conversationMode === 'AI') {
                lead.conversationMode = 'MANUAL';
                lead.manualTakenOverAt = new Date();
                lead.manualTakenOverBy = adminName;
            }
            await lead.save();

            broadcastSSE('NEW_MESSAGE', { leadId: lead.leadId, message: savedMsg });

            return successResponse(res, 201, 'Admin reply sent and saved', savedMsg);
        } else {
            // Simulated incoming patient message
            const aiResult = await processIncomingLeadMessage({
                lead,
                incomingMessageText: message.trim(),
                sender: 'lead',
                mediaUrl
            });

            broadcastSSE('NEW_MESSAGE', { leadId: lead.leadId, aiResult });

            return successResponse(res, 201, 'Patient message received and processed', aiResult);
        }
    } catch (error) {
        next(error);
    }
};

// 12. POST /api/leads/:id/follow-up (Schedule Follow-Up Date)
const scheduleFollowUp = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { followUpAt, notes } = req.body;

        if (!followUpAt) {
            return errorResponse(res, 400, 'Follow-up date and time is required.');
        }

        const lead = await AdsLead.findOne({
            $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { leadId: id }]
        });

        if (!lead) return errorResponse(res, 404, 'Lead not found.');

        lead.followUpAt = new Date(followUpAt);
        lead.followUpStatus = 'scheduled';
        lead.followUpNotes = notes || '';
        lead.leadStatus = 'Follow-Up';
        await lead.save();

        await LeadMessage.create({
            leadId: lead._id,
            leadCode: lead.leadId,
            sender: 'system',
            messageType: 'text',
            message: `📅 Follow-up scheduled for ${new Date(followUpAt).toLocaleString()}. Note: ${notes || 'None'}`,
            timestamp: new Date(),
            deliveryStatus: 'delivered',
            sentBy: 'System'
        });

        return successResponse(res, 200, 'Follow-up scheduled successfully', lead);
    } catch (error) {
        next(error);
    }
};

// 13. POST /api/leads/:id/book-appointment (Direct Appointment Booking from Lead View)
const bookLeadAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { date, time, appointmentType, clinic, notes } = req.body;

        if (!date || !time) {
            return errorResponse(res, 400, 'Appointment Date and Time are required.');
        }

        const lead = await AdsLead.findOne({
            $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { leadId: id }]
        });

        if (!lead) return errorResponse(res, 404, 'Lead not found.');

        const newAppt = await require('../services/bookingService').bookAppointment({ patientName: lead.patientName, phone: lead.phone, date, time, appointmentType: appointmentType || 'In-Person Appointment', notes: notes || `Direct booking for Ads Lead ${lead.leadId}`, source: 'admin_lead' });
        const clinicName = newAppt.clinic, appointmentId = newAppt.appointmentId, tokenNumber = newAppt.tokenNumber;

        lead.linkedAppointment = newAppt._id;
        lead.linkedAppointmentId = appointmentId;
        lead.leadStatus = 'Appointment Booked';
        await lead.save();

        await LeadMessage.create({
            leadId: lead._id,
            leadCode: lead.leadId,
            sender: 'system',
            messageType: 'text',
            message: `🎉 Appointment Confirmed: Token #${tokenNumber}, ID: ${appointmentId} on ${date} at ${time} (${clinicName})`,
            timestamp: new Date(),
            deliveryStatus: 'delivered',
            sentBy: 'System'
        });

        broadcastSSE('UPDATE_LEAD', { lead });

        return successResponse(res, 201, 'Appointment booked and linked to lead successfully', {
            lead,
            appointment: newAppt
        });
    } catch (error) {
        next(error);
    }
};

// 14. POST /api/leads/:id/convert (Mark Lead Converted)
const convertLead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const lead = await AdsLead.findOne({
            $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { leadId: id }]
        });

        if (!lead) return errorResponse(res, 404, 'Lead not found.');

        lead.leadStatus = 'Converted';
        if (notes) lead.notes = (lead.notes ? `${lead.notes}\n` : '') + `[Converted]: ${notes}`;
        await lead.save();

        await LeadMessage.create({
            leadId: lead._id,
            leadCode: lead.leadId,
            sender: 'system',
            messageType: 'text',
            message: `🏆 Lead marked as Converted by ${req.admin?.name || 'Staff'}. Note: ${notes || 'Patient attended / registered'}`,
            timestamp: new Date(),
            deliveryStatus: 'delivered',
            sentBy: 'System'
        });

        broadcastSSE('UPDATE_LEAD', { lead });

        return successResponse(res, 200, 'Lead marked as Converted', lead);
    } catch (error) {
        next(error);
    }
};

// 15. DELETE /api/leads/:id (Archive / Delete Lead)
const deleteLead = async (req, res, next) => {
    try {
        const { id } = req.params;

        const lead = await AdsLead.findOneAndDelete({
            $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { leadId: id }]
        });

        if (!lead) return errorResponse(res, 404, 'Lead not found.');

        await LeadMessage.deleteMany({ leadId: lead._id });

        return successResponse(res, 200, 'Lead and conversation records deleted successfully');
    } catch (error) {
        next(error);
    }
};

// 16. GET /api/leads/stream (Server-Sent Events for Real-Time UI Synchronization)
const leadStream = (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);

    const keepAlive = setInterval(() => {
        try {
            res.write(': keep-alive\n\n');
        } catch (e) {
            clearInterval(keepAlive);
            sseClients.delete(res);
        }
    }, 20000);

    req.on('close', () => {
        clearInterval(keepAlive);
        sseClients.delete(res);
    });
};

module.exports = {
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
};

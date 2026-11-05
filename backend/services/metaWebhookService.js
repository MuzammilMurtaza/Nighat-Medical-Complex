const crypto = require('crypto');
const AdsLead = require('../models/AdsLead');
const { generateLeadId } = require('../utils/leadIdGenerator');
const { processIncomingLeadMessage } = require('./leadAiService');

// In-memory set to prevent processing duplicate platform message IDs / webhook events
const processedEvents = new Set();

/**
 * Verifies webhook subscription challenge from Meta (Facebook / Instagram / WhatsApp)
 */
const verifyMetaWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = process.env.META_VERIFY_TOKEN || 'dr_zaheer_meta_verify_token_2026';

    if (mode === 'subscribe' && token === expectedToken) {
        console.log('[Meta Webhook] Webhook verified successfully by Meta challenge handshake');
        return res.status(200).send(challenge);
    } else {
        console.warn('[Meta Webhook] Verification failed. Token mismatch or bad mode:', { mode, token });
        return res.status(403).json({ error: 'Webhook verification token mismatch' });
    }
};

/**
 * Validates Meta X-Hub-Signature-256 HMAC
 */
const verifySignature = (rawBody, signatureHeader, appSecret) => {
    if (!appSecret || !signatureHeader) return true; // Pass if secret not configured in dev
    try {
        const hmac = crypto.createHmac('sha256', appSecret);
        const digest = 'sha256=' + hmac.update(rawBody).digest('hex');
        return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
    } catch (e) {
        return false;
    }
};

/**
 * Ingests and processes incoming Meta Webhook events
 */
const handleMetaWebhookEvent = async (body, notifyCallback = null) => {
    if (!body || !body.entry) {
        return { success: false, message: 'Invalid Meta webhook payload structure' };
    }

    const results = [];

    for (const entry of body.entry) {
        // Case A: Facebook / Instagram Lead Ads Form Submission (`changes` with `leadgen`)
        if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
                if (change.field === 'leadgen' && change.value) {
                    const leadData = change.value;
                    const eventKey = `lead_${leadData.leadgen_id || Date.now()}`;
                    if (processedEvents.has(eventKey)) continue;
                    processedEvents.add(eventKey);

                    const res = await processLeadgenPayload(leadData, notifyCallback);
                    results.push(res);
                }
            }
        }

        // Case B: Direct Messages (Facebook Messenger / Instagram DM / WhatsApp)
        if (entry.messaging && Array.isArray(entry.messaging)) {
            for (const msgEvent of entry.messaging) {
                const eventKey = `msg_${msgEvent.message?.mid || Date.now()}`;
                if (processedEvents.has(eventKey)) continue;
                processedEvents.add(eventKey);

                const res = await processMessagingPayload(msgEvent, 'facebook_messenger', notifyCallback);
                results.push(res);
            }
        }

        // Case C: WhatsApp Cloud API (`entry.changes` with `messages`)
        if (entry.changes && Array.isArray(entry.changes)) {
            for (const change of entry.changes) {
                if (change.field === 'messages' && change.value?.messages) {
                    for (const waMsg of change.value.messages) {
                        const eventKey = `wa_${waMsg.id || Date.now()}`;
                        if (processedEvents.has(eventKey)) continue;
                        processedEvents.add(eventKey);

                        const contact = change.value.contacts?.[0] || {};
                        const res = await processWhatsAppPayload(waMsg, contact, notifyCallback);
                        results.push(res);
                    }
                }
            }
        }
    }

    return { success: true, processedCount: results.length, results };
};

/**
 * Process Meta Leadgen form event
 */
const processLeadgenPayload = async (leadValue, notifyCallback) => {
    const platformLeadId = leadValue.leadgen_id ? String(leadValue.leadgen_id) : `meta_${Date.now()}`;
    const formId = leadValue.form_id || '';
    const pageId = leadValue.page_id || '';
    const adId = leadValue.ad_id || '';
    const adName = leadValue.ad_name || 'Facebook / Instagram Ad';
    const campaignId = leadValue.campaign_id || '';
    const campaignName = leadValue.campaign_name || 'Clinic Pain Relief Campaign';

    // Extract fields if available in payload
    let patientName = leadValue.full_name || leadValue.name || 'Ad Lead';
    let phone = leadValue.phone_number || leadValue.phone || '+923000000000';
    let email = leadValue.email || '';
    let city = leadValue.city || '';
    let interestedTreatment = leadValue.treatment || leadValue.service || 'Pain Management & Regenerative Therapy';
    let leadMessage = leadValue.message || 'Interested in consultation for pain management.';

    // Check if lead already exists by platformLeadId or normalized phone
    let lead = await AdsLead.findOne({
        $or: [
            { platformLeadId: platformLeadId },
            { phone: phone.trim() }
        ]
    });

    if (!lead) {
        const leadId = await generateLeadId(AdsLead);
        lead = await AdsLead.create({
            leadId,
            platformLeadId,
            source: 'facebook_lead_ad',
            campaignId,
            campaignName,
            adId,
            adName,
            patientName: patientName.trim(),
            phone: phone.trim(),
            email: email.trim(),
            city: city.trim(),
            interestedTreatment,
            leadMessage,
            leadStatus: 'New',
            priority: 'high',
            conversationMode: 'AI',
            metadata: { formId, pageId, raw: leadValue }
        });
        console.log(`[Meta Webhook] Created new Ads Lead: ${lead.leadId} (${lead.patientName})`);
    }

    // Process initial message through AI
    const aiResult = await processIncomingLeadMessage({
        lead,
        incomingMessageText: leadMessage,
        sender: 'lead',
        platformMessageId: platformLeadId
    });

    if (notifyCallback) notifyCallback({ type: 'NEW_LEAD', lead, aiResult });
    return { leadId: lead.leadId, aiResult };
};

/**
 * Process Messenger / Instagram DM message
 */
const processMessagingPayload = async (msgEvent, defaultSource = 'facebook_messenger', notifyCallback) => {
    const senderId = msgEvent.sender?.id || `user_${Date.now()}`;
    const messageText = msgEvent.message?.text || 'Hello';
    const messageMid = msgEvent.message?.mid || `mid_${Date.now()}`;

    let lead = await AdsLead.findOne({ platformLeadId: senderId });

    if (!lead) {
        const leadId = await generateLeadId(AdsLead);
        lead = await AdsLead.create({
            leadId,
            platformLeadId: senderId,
            source: defaultSource,
            patientName: `Social Lead (${senderId.slice(-4)})`,
            phone: `Messenger-${senderId.slice(-6)}`,
            leadStatus: 'New',
            conversationMode: 'AI',
            metadata: { senderId }
        });
    }

    const aiResult = await processIncomingLeadMessage({
        lead,
        incomingMessageText: messageText,
        sender: 'lead',
        platformMessageId: messageMid
    });

    if (notifyCallback) notifyCallback({ type: 'NEW_MESSAGE', lead, aiResult });
    return { leadId: lead.leadId, aiResult };
};

/**
 * Process WhatsApp Cloud API payload
 */
const { formatWhatsAppPayload } = require('./conversationEngine');

/**
 * Dispatch outbound reply to WhatsApp Cloud API
 */
const sendWhatsAppCloudMessage = async (toPhone, engineResult) => {
    const token = process.env.META_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneId || token === 'dr_zaheer_access_token_dev') {
        console.log('[WhatsApp Adapter] Outbound simulated for dev. Destination:', toPhone);
        return;
    }

    try {
        const payload = formatWhatsAppPayload(toPhone, engineResult);
        const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log('[WhatsApp Adapter] Cloud API Response:', data);
    } catch (e) {
        console.error('[WhatsApp Adapter] Failed to dispatch Cloud API message:', e.message);
    }
};

/**
 * Process WhatsApp Cloud API payload
 */
const processWhatsAppPayload = async (waMsg, contact, notifyCallback) => {
    const fromPhone = waMsg.from || `wa_${Date.now()}`;
    const interactiveTitle = waMsg.interactive?.button_reply?.title || waMsg.interactive?.list_reply?.title;
    const interactivePayload = waMsg.interactive?.button_reply?.id || waMsg.interactive?.list_reply?.id;
    const messageText = waMsg.text?.body || interactiveTitle || 'Hi';
    const messageId = waMsg.id || `wamid_${Date.now()}`;
    const profileName = contact.profile?.name || 'WhatsApp Patient';

    let lead = await AdsLead.findOne({
        $or: [
            { platformLeadId: fromPhone },
            { phone: fromPhone }
        ]
    });

    if (!lead) {
        const leadId = await generateLeadId(AdsLead);
        lead = await AdsLead.create({
            leadId,
            platformLeadId: fromPhone,
            source: 'whatsapp_ad',
            patientName: profileName,
            phone: fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`,
            leadStatus: 'New',
            conversationMode: 'AI',
            metadata: { waContact: contact }
        });
    }

    const aiResult = await processIncomingLeadMessage({
        lead,
        incomingMessageText: messageText,
        sender: 'lead',
        platformMessageId: messageId,
        metadata: { payload: interactivePayload }
    });

    if (aiResult?.aiMsg?.message) {
        await sendWhatsAppCloudMessage(fromPhone, {
            replyText: aiResult.aiMsg.message,
            options: aiResult.aiMsg.metadata?.options || []
        });
    }

    if (notifyCallback) notifyCallback({ type: 'NEW_MESSAGE', lead, aiResult });
    return { leadId: lead.leadId, aiResult };
};

module.exports = {
    verifyMetaWebhook,
    handleMetaWebhookEvent,
    verifySignature
};

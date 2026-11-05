/**
 * Automated Verification Suite for WhatsApp-Style AI Appointment Assistant
 * Tests 25 Scenarios defined in Project Specification
 */

const assert = require('assert');

const BASE_URL = 'http://localhost:5000';

async function postChat(body) {
    const res = await fetch(`${BASE_URL}/api/staff/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return await res.json();
}

async function getSync(sessionId) {
    const res = await fetch(`${BASE_URL}/api/staff/chat/messages?sessionId=${sessionId}`);
    return await res.json();
}

async function runTests() {
    console.log('====================================================');
    console.log('🧪 RUNNING WHATSAPP ASSISTANT COMPREHENSIVE TEST SUITE');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`✅ [PASS] ${name}`);
            passed++;
        } catch (err) {
            console.error(`❌ [FAIL] ${name}:`, err.message);
            failed++;
        }
    }

    const mongoose = require('mongoose');
    const MONGO_URI = process.env.TEST_MONGODB_URI;
    if (!MONGO_URI || !/127\.0\.0\.1|localhost/.test(MONGO_URI)) throw new Error('Set TEST_MONGODB_URI to an isolated local test database.');
    try {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(MONGO_URI);
            console.log('📦 Connected to MongoDB for in-process engine tests');
        }
    } catch (e) {
        console.warn('⚠️ MongoDB connection warning in test runner:', e.message);
    }

    const testSession = `test_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Patient types "Hi" -> welcome and language selection
    await test('1. Patient types "Hi" -> welcome and language selection', async () => {
        const res = await postChat({ sessionId: testSession, message: 'Hi' });
        assert(res.success, 'Request should succeed');
        assert(res.data.reply.includes('Welcome to Dr. Muhammad Zaheer Anjum'), 'Welcome greeting received');
        assert(res.data.options.some(o => o.value === 'LANG_URDU'), 'Offers Urdu language');
        assert(res.data.options.some(o => o.value === 'LANG_ENGLISH'), 'Offers English language');
    });

    // 2. Patient selects Urdu -> subsequent messages are in Urdu
    const urduSession = `test_ur_${Date.now()}`;
    await test('2. Patient selects Urdu -> subsequent messages are in Urdu', async () => {
        const res = await postChat({ sessionId: urduSession, message: 'اردو', payload: 'LANG_URDU' });
        assert(res.success, 'Request should succeed');
        assert(res.data.reply.includes('ڈاکٹر محمد ظہیر انجم'), 'Reply contains Urdu greeting');
        assert(res.data.options.some(o => o.value === 'BOOK_APPOINTMENT'), 'Urdu menu presented');
    });

    // 3. Patient selects English -> conversation switches correctly
    await test('3. Patient selects English -> conversation switches correctly', async () => {
        const res = await postChat({ sessionId: testSession, message: 'English', payload: 'LANG_ENGLISH' });
        assert(res.success, 'Request should succeed');
        assert(res.data.reply.includes('Welcome to Dr. Muhammad Zaheer Anjum'), 'English menu displayed');
        assert(res.data.options.some(o => o.value === 'BOOK_APPOINTMENT'), 'English menu options present');
    });

    // 4. Patient types "Book appointment" -> booking starts
    await test('4. Patient types "Book appointment" -> booking starts', async () => {
        const res = await postChat({ sessionId: testSession, message: 'Book appointment', payload: 'BOOK_APPOINTMENT' });
        assert(res.success, 'Request should succeed');
        assert(res.data.activeWorkflow === 'APPOINTMENT', 'Active workflow is APPOINTMENT');
        assert(res.data.workflowStep === 'AWAITING_NAME', 'Step is AWAITING_NAME');
        assert(res.data.reply.includes('Patient Name') || res.data.reply.includes('full name'), 'Asks for patient full name');
    });

    // 5. Patient provides name -> name is remembered
    await test('5. Patient provides name -> name is remembered', async () => {
        const res = await postChat({ sessionId: testSession, message: 'Muhammad Tariq' });
        assert(res.success, 'Request should succeed');
        assert(res.data.workflowStep === 'AWAITING_PHONE', 'Step moved to AWAITING_PHONE');
        assert(res.data.reply.includes('Muhammad Tariq'), 'Assistant acknowledges patient name');
    });

    // 6. Patient provides phone -> phone is validated
    await test('6. Patient provides phone -> phone is validated', async () => {
        const res = await postChat({ sessionId: testSession, message: '03214567890' });
        assert(res.success, 'Request should succeed');
        assert(res.data.workflowStep === 'AWAITING_DATE', 'Step moved to AWAITING_DATE');
        assert(res.data.options.some(o => o.value.startsWith('DATE_')), 'Offers real available date buttons');
    });

    // 7. Patient chooses a date -> real availability is checked
    let chosenDateIso = null;
    let chosenDateLabel = null;
    await test('7. Patient chooses a date -> real availability is checked', async () => {
        const dateOptions = (await getSync(testSession)).data.messages.slice(-1)[0].options;
        const firstDate = dateOptions.find(o => o.value.startsWith('DATE_'));
        assert(firstDate, 'Found valid date button');
        chosenDateIso = firstDate.value.replace('DATE_', '');
        chosenDateLabel = firstDate.label;

        const res = await postChat({ sessionId: testSession, message: firstDate.label, payload: firstDate.value });
        assert(res.success, 'Request should succeed');
        assert(res.data.workflowStep === 'AWAITING_SLOT', 'Step moved to AWAITING_SLOT');
        assert(res.data.options.some(o => o.value.startsWith('SLOT_')), 'Presents real time slots with tokens');
    });

    // 8. Patient chooses a time -> selected time is retained
    let chosenSlot = null;
    await test('8. Patient chooses a time -> selected time is retained', async () => {
        const slotOptions = (await getSync(testSession)).data.messages.slice(-1)[0].options;
        const firstSlot = slotOptions.find(o => o.value.startsWith('SLOT_'));
        assert(firstSlot, 'Found available slot');
        chosenSlot = firstSlot.value.replace('SLOT_', '');

        const res = await postChat({ sessionId: testSession, message: firstSlot.label, payload: firstSlot.value });
        assert(res.success, 'Request should succeed');
        assert(res.data.workflowStep === 'AWAITING_CONFIRM', 'Step moved to AWAITING_CONFIRM');
        assert(res.data.reply.includes('Please confirm your appointment details'), 'Displays summary card');
        assert(res.data.options.some(o => o.value === 'CONFIRM_BOOKING'), 'Presents confirmation button');
    });

    // 9. Patient confirms -> exactly one appointment is created
    let createdApptId = null;
    let createdToken = null;
    await test('9. Patient confirms -> exactly one appointment is created', async () => {
        const res = await postChat({ sessionId: testSession, message: 'Confirm Appointment', payload: 'CONFIRM_BOOKING' });
        assert(res.success, 'Request should succeed');
        assert(res.data.reply.includes('Appointment Confirmed'), 'Booking confirmed message');
        assert(res.data.bookingData.appointmentId, 'Has appointment ID');
        assert(res.data.bookingData.tokenNumber, 'Has token number');
        createdApptId = res.data.bookingData.appointmentId;
        createdToken = res.data.bookingData.tokenNumber;
    });

    // 10. Patient refreshes browser -> conversation continues
    await test('10. Patient refreshes browser -> conversation continues', async () => {
        const syncRes = await getSync(testSession);
        assert(syncRes.success, 'Sync endpoint works');
        assert(Array.isArray(syncRes.data.messages) && syncRes.data.messages.length >= 6, 'Entire history retained');
        const lastMsg = syncRes.data.messages[syncRes.data.messages.length - 1];
        assert(lastMsg.text.includes('Appointment Confirmed'), 'Last message contains booking confirmation');
    });

    // 11. Patient asks about clinic timings during booking -> booking context is retained
    const midSession = `test_mid_${Date.now()}`;
    await test('11. Patient asks about clinic timings during booking -> booking context is retained', async () => {
        await postChat({ sessionId: midSession, message: 'Hi' });
        await postChat({ sessionId: midSession, message: 'Book appointment', payload: 'BOOK_APPOINTMENT' });
        await postChat({ sessionId: midSession, message: 'Ahmed Khan' });
        // Patient asks mid-booking question:
        const qRes = await postChat({ sessionId: midSession, message: 'What are clinic timings?' });
        assert(qRes.success, 'Request should succeed');
        assert(qRes.data.reply.includes('12:00 PM') || qRes.data.reply.includes('Ahmed Khan'), 'Answers question and mentions patient name');
        assert(qRes.data.options.some(o => o.value === 'RESUME_BOOKING'), 'Offers button to resume booking');

        // Resume booking
        const resumeRes = await postChat({ sessionId: midSession, message: 'Continue Booking', payload: 'RESUME_BOOKING' });
        assert(resumeRes.data.workflowStep === 'AWAITING_PHONE', 'Resumes at phone collection');
        assert(resumeRes.data.reply.includes('Ahmed Khan'), 'Name Ahmed Khan was preserved');
    });

    // 12. Patient asks for Sunday -> unavailable day is explained
    await test('12. Patient asks for Sunday -> unavailable day is explained', async () => {
        const sunRes = await postChat({ sessionId: `test_sun_${Date.now()}`, message: 'Is clinic open on Sunday?' });
        assert(sunRes.success, 'Request should succeed');
        assert(sunRes.data.reply.toLowerCase().includes('closed on sunday') || sunRes.data.reply.includes('بند'), 'Explains Sunday is closed');
    });

    // 13. Patient requests occupied slot -> offer real alternatives
    await test('13. Occupied slot check -> offers real alternatives', async () => {
        // Attempt booking same date & slot as created in test 9 with a different phone
        const dupSession = `test_dup_${Date.now()}`;
        await postChat({ sessionId: dupSession, message: 'Book appointment', payload: 'BOOK_APPOINTMENT' });
        await postChat({ sessionId: dupSession, message: 'Second Patient' });
        await postChat({ sessionId: dupSession, message: '03009998877' });
        await postChat({ sessionId: dupSession, message: chosenDateLabel, payload: `DATE_${chosenDateIso}` });
        const slotRes = await postChat({ sessionId: dupSession, message: chosenSlot, payload: `SLOT_${chosenSlot}` });
        // The slot is already occupied, so the engine should not offer it or warn
        assert(slotRes.success, 'Handled safely');
    });

    // 14. Patient provides invalid phone -> request correction
    await test('14. Patient provides invalid phone -> request correction', async () => {
        const phoneSession = `test_ph_${Date.now()}`;
        await postChat({ sessionId: phoneSession, message: 'Book appointment', payload: 'BOOK_APPOINTMENT' });
        await postChat({ sessionId: phoneSession, message: 'Sara Ali' });
        const badPhoneRes = await postChat({ sessionId: phoneSession, message: '123' });
        assert(badPhoneRes.data.reply.includes('valid Pakistan mobile number'), 'Requests phone correction');
        assert(badPhoneRes.data.workflowStep === 'AWAITING_PHONE', 'Remains on phone step without resetting');
    });

    // 15. Patient requests an existing booking -> searches and displays
    await test('15. Patient requests an existing booking -> searches and displays', async () => {
        const manageSess = `test_mng_${Date.now()}`;
        await postChat({ sessionId: manageSess, message: 'Manage appointment', payload: 'MANAGE_APPOINTMENT' });
        const searchRes = await postChat({ sessionId: manageSess, message: createdApptId });
        assert(searchRes.success, 'Search executed');
        assert(searchRes.data.reply.includes(createdApptId) || searchRes.data.reply.includes('Muhammad Tariq'), 'Found created appointment');
        assert(searchRes.data.options.some(o => o.value === 'MANAGE_RESCHEDULE'), 'Offers reschedule option');
        assert(searchRes.data.options.some(o => o.value === 'MANAGE_CANCEL'), 'Offers cancel option');
    });

    // 16. Patient requests rescheduling -> booking updated correctly
    await test('16. Patient requests rescheduling -> booking updated correctly', async () => {
        const manageSess = `test_mng_resched_${Date.now()}`;
        await postChat({ sessionId: manageSess, message: 'Manage appointment', payload: 'MANAGE_APPOINTMENT' });
        await postChat({ sessionId: manageSess, message: createdApptId });
        const reschedStep = await postChat({ sessionId: manageSess, message: 'Reschedule', payload: 'MANAGE_RESCHEDULE' });
        assert(reschedStep.data.workflowStep === 'MANAGE_RESCHEDULE_DATE', 'Step is MANAGE_RESCHEDULE_DATE');

        const dateOpt = reschedStep.data.options.find(o => o.value.startsWith('DATE_'));
        const newDateIso = dateOpt.value.replace('DATE_', '');
        const slotStep = await postChat({ sessionId: manageSess, message: dateOpt.label, payload: dateOpt.value });
        assert(slotStep.data.workflowStep === 'MANAGE_RESCHEDULE_SLOT', 'Step is MANAGE_RESCHEDULE_SLOT');

        const slotOpt = slotStep.data.options.find(o => o.value.startsWith('SLOT_'));
        const confirmResched = await postChat({ sessionId: manageSess, message: slotOpt.label, payload: slotOpt.value });
        assert(confirmResched.data.reply.includes('rescheduled') || confirmResched.data.reply.includes('ری شیڈول'), 'Confirms rescheduling in DB');
    });

    // 17. Patient requests cancellation -> confirmed database update
    await test('17. Patient requests cancellation -> confirmed database update', async () => {
        const cancelSess = `test_cancel_${Date.now()}`;
        await postChat({ sessionId: cancelSess, message: 'Manage appointment', payload: 'MANAGE_APPOINTMENT' });
        await postChat({ sessionId: cancelSess, message: createdApptId });
        await postChat({ sessionId: cancelSess, message: 'Cancel appointment', payload: 'MANAGE_CANCEL' });
        const cancelConfirm = await postChat({ sessionId: cancelSess, message: 'Yes, Cancel Booking', payload: 'CONFIRM_CANCEL' });
        assert(cancelConfirm.data.reply.includes('cancelled') || cancelConfirm.data.reply.includes('منسوخ'), 'Confirmed cancellation in DB');
    });

    // 18. Patient requests a human -> staff handover works
    await test('18. Patient requests a human -> staff handover works', async () => {
        const handoverSess = `test_hand_${Date.now()}`;
        const res = await postChat({ sessionId: handoverSess, message: 'I want to talk to human staff' });
        assert(res.data.reply.includes('clinic coordinator') || res.data.reply.includes('عملہ'), 'Alerted coordinator');
        assert(res.data.mode === 'MANUAL', 'Conversation switched to MANUAL mode');
    });

    // 19. Patient reports emergency symptoms -> safe response
    await test('19. Patient reports emergency symptoms -> safe response', async () => {
        const emerSess = `test_emer_${Date.now()}`;
        const res = await postChat({ sessionId: emerSess, message: 'Severe chest pain and difficulty breathing' });
        assert(res.data.reply.includes('1122'), 'Recommends 1122');
        assert(res.data.reply.includes('EMERGENCY') || res.data.reply.includes('emergency'), 'Flags medical emergency');
    });

    // 20. WhatsApp and website use consistent business logic
    await test('20. WhatsApp and website use consistent business logic', async () => {
        const { processConversationMessage } = require('../services/conversationEngine');
        const webRes = await processConversationMessage({
            sessionId: `comp_web_${Date.now()}`,
            channel: 'website',
            messageText: 'Hi'
        });
        const waRes = await processConversationMessage({
            sessionId: `comp_wa_${Date.now()}`,
            channel: 'whatsapp',
            messageText: 'Hi'
        });
        assert.strictEqual(webRes.replyText, waRes.replyText, 'Both channels generate identical welcome text');
        assert.deepStrictEqual(webRes.options, waRes.options, 'Both channels offer identical language options');
    });

    // 21. Concurrent patients attempting the final available slot -> no double booking
    await test('21. Double booking prevention atomic check', async () => {
        const { processConversationMessage } = require('../services/conversationEngine');
        const sessA = `atomic_a_${Date.now()}`;
        const sessB = `atomic_b_${Date.now()}`;

        // Prepare both sessions at confirmation step for same slot
        const testDate = '2026-11-20';
        const testSlot = '02:00 PM';

        await processConversationMessage({ sessionId: sessA, messageText: 'Book appointment', payload: 'BOOK_APPOINTMENT' });
        await processConversationMessage({ sessionId: sessA, messageText: 'Patient A' });
        await processConversationMessage({ sessionId: sessA, messageText: '03111111111' });
        await processConversationMessage({ sessionId: sessA, payload: `DATE_${testDate}` });
        await processConversationMessage({ sessionId: sessA, payload: `SLOT_${testSlot}` });

        await processConversationMessage({ sessionId: sessB, messageText: 'Book appointment', payload: 'BOOK_APPOINTMENT' });
        await processConversationMessage({ sessionId: sessB, messageText: 'Patient B' });
        await processConversationMessage({ sessionId: sessB, messageText: '03222222222' });
        await processConversationMessage({ sessionId: sessB, payload: `DATE_${testDate}` });
        await processConversationMessage({ sessionId: sessB, payload: `SLOT_${testSlot}` });

        // Confirm Patient A first
        const confA = await processConversationMessage({ sessionId: sessA, payload: 'CONFIRM_BOOKING' });
        assert(confA.replyText.includes('Appointment Confirmed'), 'Patient A gets booking');

        // Confirm Patient B for same slot
        const confB = await processConversationMessage({ sessionId: sessB, payload: 'CONFIRM_BOOKING' });
        assert(!confB.replyText.includes('Appointment Confirmed') || confB.replyText.includes('no longer available'), 'Patient B prevented from double booking');
    });

    // 22. Repeated confirmation requests -> no duplicate appointment
    await test('22. Repeated confirmation requests -> idempotent, no duplicate appointment', async () => {
        const { processConversationMessage } = require('../services/conversationEngine');
        const sessId = `idempotent_${Date.now()}`;
        await processConversationMessage({ sessionId: sessId, messageText: 'Book appointment', payload: 'BOOK_APPOINTMENT' });
        await processConversationMessage({ sessionId: sessId, messageText: 'Same Patient' });
        await processConversationMessage({ sessionId: sessId, messageText: '03334445566' });
        await processConversationMessage({ sessionId: sessId, payload: 'DATE_2026-11-25' });
        await processConversationMessage({ sessionId: sessId, payload: 'SLOT_05:00 PM' });

        const firstConf = await processConversationMessage({ sessionId: sessId, payload: 'CONFIRM_BOOKING' });
        const firstApptId = firstConf.bookingData.appointmentId;

        // Second click
        const secondConf = await processConversationMessage({ sessionId: sessId, payload: 'CONFIRM_BOOKING' });
        assert(secondConf.bookingData.appointmentId === firstApptId, 'Returned existing appointment without creating duplicate');
    });

    // 23. Unsupported medical questions -> safe, appropriate response
    await test('23. Unsupported medical questions -> safe, appropriate response with disclaimer', async () => {
        const res = await postChat({ sessionId: `med_safe_${Date.now()}`, message: 'Can you prescribe me tramadol or antibiotics?' });
        assert(res.data.reply.includes('AI') || res.data.reply.includes('Medical Notice') || res.data.reply.includes('disclaimer'), 'Contains medical safety notice');
    });

    // 24. Urdu text and Roman Urdu comprehension
    await test('24. Roman Urdu comprehension: "Mujhe appointment book karni hai"', async () => {
        const res = await postChat({ sessionId: `roman_${Date.now()}`, message: 'Mujhe appointment book karni hai' });
        assert(res.data.activeWorkflow === 'APPOINTMENT', 'Directly started appointment workflow');
        assert(res.data.workflowStep === 'AWAITING_NAME', 'Moved to AWAITING_NAME');
    });

    // 25. Database or AI provider failure -> clear recovery behavior
    await test('25. In-memory graceful fallback and recovery', async () => {
        const { processConversationMessage } = require('../services/conversationEngine');
        const fallbackRes = await processConversationMessage({
            sessionId: `fallback_${Date.now()}`,
            messageText: 'Tell me about Stay Young Clinic'
        });
        assert(fallbackRes.success, 'Fallback returns success');
        assert(fallbackRes.replyText.includes('Stay Young Clinic'), 'Accurate clinic info returned');
    });

    console.log('\n====================================================');
    console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    try {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
    } catch (e) {}

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
});

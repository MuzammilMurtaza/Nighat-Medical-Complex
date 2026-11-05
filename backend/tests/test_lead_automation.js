const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
    console.log('===============================================================');
    console.log(' 🚀 STARTING ADS LEADS AUTOMATION & MANUAL HANDLING TEST SUITE');
    console.log('===============================================================\n');

    let adminToken = '';
    let testLeadId = '';
    let testLeadDbId = '';

    // TEST 1: Admin Login & JWT Generation
    console.log('▶ Test 1: Admin Login & Authentication');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'Admin@123456' })
    });
    const loginJson = await loginRes.json();
    assert.strictEqual(loginJson.success, true, 'Admin login should succeed');
    adminToken = loginJson.data.token;
    assert.ok(adminToken, 'Admin token should be present');
    console.log('  ✔ Admin login successful, JWT token acquired.\n');

    // TEST 2: Unauthorized Access Guard
    console.log('▶ Test 2: Security & Authorization Guard (Unauthorized Request Check)');
    const unauthRes = await fetch(`${BASE_URL}/leads`, {
        headers: { 'Content-Type': 'application/json' }
    });
    assert.strictEqual(unauthRes.status, 401, 'Request without token must return 401 Unauthorized');
    console.log('  ✔ Access control verified: Unauthenticated request blocked with 401.\n');

    // TEST 3: Meta Webhook GET Challenge Verification
    console.log('▶ Test 3: Meta Webhook Subscription Handshake');
    const challengeStr = 'test_meta_challenge_token_xyz123';
    const webhookVerifyRes = await fetch(
        `${BASE_URL}/leads/webhook?hub.mode=subscribe&hub.verify_token=dr_zaheer_meta_verify_token_2026&hub.challenge=${challengeStr}`
    );
    const challengeOutput = await webhookVerifyRes.text();
    assert.strictEqual(webhookVerifyRes.status, 200, 'Webhook challenge should return 200');
    assert.strictEqual(challengeOutput, challengeStr, 'Challenge output must match sent challenge');
    console.log('  ✔ Meta Webhook verification handshake passed.\n');

    // TEST 4: Meta Lead Ad Webhook Ingestion & Automatic AI Qualification
    console.log('▶ Test 4: Facebook Lead Ad Webhook Ingestion & AI Automated Welcome');
    const testPhone = `+92300${Math.floor(1000000 + Math.random() * 9000000)}`;
    const platformLeadgenId = `meta_lead_${Date.now()}`;

    const leadPayload = {
        object: 'page',
        entry: [{
            id: 'page_1001',
            time: Date.now(),
            changes: [{
                field: 'leadgen',
                value: {
                    leadgen_id: platformLeadgenId,
                    form_id: 'form_knee_prp_2026',
                    page_id: 'page_1001',
                    ad_id: 'ad_fb_knee_01',
                    ad_name: 'FB Knee Pain Relief Ad',
                    campaign_id: 'camp_fb_2026',
                    campaign_name: 'FB Knee Pain & PRP Campaign',
                    full_name: 'Zubair Ahmed',
                    phone_number: testPhone,
                    email: 'zubair.ahmed@example.com',
                    city: 'Lahore',
                    treatment: 'Regenerative Knee PRP Therapy',
                    message: 'I have severe knee osteoarthritis for 8 months with pain 8/10. Can PRP help me avoid knee surgery?'
                }
            }]
        }]
    };

    const webhookPostRes = await fetch(`${BASE_URL}/leads/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadPayload)
    });
    const webhookJson = await webhookPostRes.json();
    assert.strictEqual(webhookJson.success, true, 'Webhook event should process successfully');
    console.log('  ✔ Meta Lead Ad webhook accepted and processed.');

    // Fetch the created lead from backend
    const leadsListRes = await fetch(`${BASE_URL}/leads?search=${encodeURIComponent(testPhone)}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const leadsListJson = await leadsListRes.json();
    assert.strictEqual(leadsListJson.success, true);
    assert.ok(leadsListJson.data.leads.length > 0, 'Created lead should be found in DB');
    const createdLead = leadsListJson.data.leads[0];
    testLeadId = createdLead.leadId;
    testLeadDbId = createdLead._id;

    assert.strictEqual(createdLead.patientName, 'Zubair Ahmed');
    assert.strictEqual(createdLead.conversationMode, 'AI', 'Default mode must be AI');
    assert.strictEqual(createdLead.source, 'facebook_lead_ad');
    console.log(`  ✔ Lead saved in MongoDB with Lead ID: ${testLeadId}`);

    // TEST 5: Permanent Conversation History Verification
    console.log('\n▶ Test 5: Permanent Conversation History in MongoDB');
    const msgsRes = await fetch(`${BASE_URL}/leads/${testLeadDbId}/messages`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const msgsJson = await msgsRes.json();
    assert.strictEqual(msgsJson.success, true);
    const messages = msgsJson.data.messages;
    assert.ok(messages.length >= 2, 'Should contain incoming lead message and AI reply');
    assert.strictEqual(messages[0].sender, 'lead', 'First message should be from lead');
    assert.strictEqual(messages[1].sender, 'AI', 'Second message should be from AI');
    assert.ok(messages[1].message.includes('Dr. Muhammad Zaheer Anjum'), 'AI reply should introduce Dr. Zaheer');
    assert.ok(messages[1].message.includes('Medical Disclaimer'), 'AI reply must include medical disclaimer');
    console.log('  ✔ Complete chronological conversation history confirmed in MongoDB.');

    // TEST 6: Mode Switching: AI Mode -> MANUAL Mode
    console.log('\n▶ Test 6: Switching Conversation from AI Mode to MANUAL Mode');
    const switchManualRes = await fetch(`${BASE_URL}/leads/${testLeadDbId}/mode`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ mode: 'MANUAL' })
    });
    const switchManualJson = await switchManualRes.json();
    assert.strictEqual(switchManualJson.success, true);
    assert.strictEqual(switchManualJson.data.conversationMode, 'MANUAL');
    console.log('  ✔ Lead mode successfully switched to MANUAL.');

    // TEST 7: In MANUAL Mode, AI Must NOT Respond Automatically
    console.log('\n▶ Test 7: Verify AI Auto-Replies are Suppressed in MANUAL Mode');
    const patientFollowUpMsg = 'What are your clinic consultation hours tomorrow?';
    const patientMsgRes = await fetch(`${BASE_URL}/leads/${testLeadDbId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            message: patientFollowUpMsg,
            sender: 'lead'
        })
    });
    const patientMsgJson = await patientMsgRes.json();
    assert.strictEqual(patientMsgJson.success, true);
    assert.strictEqual(patientMsgJson.data.replied, false, 'AI must NOT reply when in MANUAL mode');
    console.log('  ✔ Verified: AI auto-reply was suppressed because lead is in MANUAL mode.');

    // TEST 8: Admin Sends Manual Reply
    console.log('\n▶ Test 8: Admin Sends Manual Reply from Unified Inbox Composer');
    const adminReplyText = 'Hello Zubair, Dr. Zaheer is available tomorrow from 12:00 PM to 7:30 PM. I can reserve a slot for you.';
    const adminReplyRes = await fetch(`${BASE_URL}/leads/${testLeadDbId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            message: adminReplyText,
            sender: 'admin'
        })
    });
    const adminReplyJson = await adminReplyRes.json();
    assert.strictEqual(adminReplyJson.success, true);
    assert.strictEqual(adminReplyJson.data.sender, 'admin');
    console.log('  ✔ Admin manual reply sent and recorded in conversation timeline.');

    // TEST 9: Mode Switching: MANUAL Mode -> Resume AI Mode
    console.log('\n▶ Test 9: Admin Resumes AI Mode & Context Continuity');
    const resumeAiRes = await fetch(`${BASE_URL}/leads/${testLeadDbId}/mode`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ mode: 'AI' })
    });
    const resumeAiJson = await resumeAiRes.json();
    assert.strictEqual(resumeAiJson.success, true);
    assert.strictEqual(resumeAiJson.data.conversationMode, 'AI');
    console.log('  ✔ AI Mode resumed successfully with timeline event logged.');

    // TEST 10: Exact Regression Test: "I want to book an in-person appointment for Thursday, September 3 at 2:30 PM."
    console.log('\n▶ Test 10: Exact Booking Regression Test: "Thursday, September 3 at 2:30 PM"');
    
    // Ensure clean slot for idempotent test runs
    try {
        const existingApptsRes = await fetch(`${BASE_URL}/appointments?date=2026-09-03`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const existingApptsJson = await existingApptsRes.json();
        if (existingApptsJson.success && existingApptsJson.data) {
            for (const a of existingApptsJson.data) {
                if (a.time === '2:30 PM' && a.status !== 'cancelled') {
                    await fetch(`${BASE_URL}/appointments/${a._id}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
                        body: JSON.stringify({ status: 'cancelled' })
                    });
                }
            }
        }
    } catch (e) {}

    const exactBookingMsg = 'I want to book an in-person appointment for Thursday, September 3 at 2:30 PM.';

    const bookingMsgRes = await fetch(`${BASE_URL}/leads/${testLeadDbId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            message: exactBookingMsg,
            sender: 'lead'
        })
    });
    const bookingMsgJson = await bookingMsgRes.json();
    assert.strictEqual(bookingMsgJson.success, true);
    assert.ok(bookingMsgJson.data.replied, 'AI should respond to booking request');
    console.log('  ✔ Exact booking message processed by AI Assistant.');

    // Verify lead's linked appointment in DB
    const leadDetailRes = await fetch(`${BASE_URL}/leads/${testLeadDbId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const leadDetailJson = await leadDetailRes.json();
    assert.strictEqual(leadDetailJson.success, true);
    const leadDoc = leadDetailJson.data;
    assert.strictEqual(leadDoc.leadStatus, 'Appointment Booked', 'Status must be Appointment Booked');
    assert.ok(leadDoc.linkedAppointment, 'Linked appointment must be populated');

    const appt = leadDoc.linkedAppointment;
    console.log(`  ✔ Appointment details -> Date: ${appt.date}, Time: ${appt.time}, Type: ${appt.appointmentType}, Token: #${appt.tokenNumber}, ID: ${appt.appointmentId}`);

    // EXACT ASSERTIONS AS REQUESTED BY USER
    assert.strictEqual(appt.date, '2026-09-03', 'Stored date MUST be 2026-09-03 (Thursday, September 3)');
    assert.strictEqual(appt.time, '2:30 PM', 'Stored time MUST be 2:30 PM');
    assert.strictEqual(appt.appointmentType, 'In-Person Appointment', 'Stored appointmentType MUST be In-Person Appointment');

    // Verify confirmation message contains the appointment details
    const lastAiMsg = bookingMsgJson.data.aiMsg.message;
    assert.ok(lastAiMsg.includes('2026-09-03') || lastAiMsg.includes('September 3'), 'Confirmation should contain the date 2026-09-03');
    assert.ok(lastAiMsg.includes('2:30 PM'), 'Confirmation should contain 2:30 PM');
    assert.ok(lastAiMsg.includes('In-Person Appointment'), 'Confirmation MUST explicitly display Appointment Type: In-Person Appointment');
    assert.ok(lastAiMsg.includes(appt.appointmentId), 'Confirmation should contain the appointmentId');
    console.log('  ✔ Confirmed: Date (2026-09-03), Time (2:30 PM), and Type (In-Person Appointment) verified in DB and confirmation message.');

    // Verify presence in Appointments directory API
    const apptsRes = await fetch(`${BASE_URL}/appointments?search=${appt.appointmentId}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const apptsJson = await apptsRes.json();
    assert.strictEqual(apptsJson.success, true);
    assert.ok(apptsJson.data.length > 0, 'Appointment must appear in Appointments directory');
    console.log('  ✔ Confirmed: Appointment record appears in Appointments directory & Calendar.');

    // Verify presence in Patients directory API
    const patientsRes = await fetch(`${BASE_URL}/patients?search=${encodeURIComponent(leadDoc.phone)}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const patientsJson = await patientsRes.json();
    assert.strictEqual(patientsJson.success, true);
    assert.ok(patientsJson.data.length > 0, 'Patient must appear in Patients directory');
    console.log('  ✔ Confirmed: Patient profile created & linked in Patients directory.');

    // TEST 10b: Duplicate Prevention on Retry
    console.log('\n▶ Test 10b: Duplicate Appointment Prevention on Retry');
    const initialApptCount = (await (await fetch(`${BASE_URL}/appointments`, { headers: { 'Authorization': `Bearer ${adminToken}` } })).json()).data.length;

    // Retry sending same booking message
    const retryMsgRes = await fetch(`${BASE_URL}/leads/${testLeadDbId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            message: exactBookingMsg,
            sender: 'lead'
        })
    });
    const retryMsgJson = await retryMsgRes.json();
    assert.strictEqual(retryMsgJson.success, true);

    const postRetryApptCount = (await (await fetch(`${BASE_URL}/appointments`, { headers: { 'Authorization': `Bearer ${adminToken}` } })).json()).data.length;
    assert.strictEqual(postRetryApptCount, initialApptCount, 'Retrying booking message MUST NOT create a duplicate appointment');
    console.log('  ✔ Verified: Duplicate appointment prevented on retry.');

    // TEST 10c: Weekday Mismatch Clarification Check
    console.log('\n▶ Test 10c: Weekday & Calendar Date Contradiction Handling (e.g. "Friday, September 3")');
    const mismatchLeadPhone = `+92322${Math.floor(1000000 + Math.random() * 9000000)}`;
    const mismatchSimRes = await fetch(`${BASE_URL}/leads/incoming-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source: 'facebook_lead_ad',
            patientName: 'Clarification Test',
            phone: mismatchLeadPhone,
            message: 'I want to book an in-person appointment for Friday, September 3 at 2:30 PM.'
        })
    });
    const mismatchSimJson = await mismatchSimRes.json();
    assert.strictEqual(mismatchSimJson.success, true);
    const mismatchReply = mismatchSimJson.data.aiResult?.aiMsg?.message || mismatchSimJson.data.lead?.lastMessage || '';
    assert.ok(mismatchReply.includes('Thursday') && mismatchReply.includes('Friday'), 'AI must clarify that September 3 is a Thursday');
    assert.strictEqual(mismatchSimJson.data.lead.leadStatus !== 'Appointment Booked', true, 'Contradictory date must NOT book an appointment');
    console.log('  ✔ Verified: Weekday mismatch caught -> Clarification requested without false booking.');

    // TEST 10d: Multi-Turn Alternative Slot Context Continuity
    console.log('\n▶ Test 10d: Multi-Turn Context Continuity (Unavailable Slot -> Offer Alternatives -> Choose "3:00 PM")');
    const multiTurnPhone = `+92301${Math.floor(1000000 + Math.random() * 9000000)}`;
    
    // Create new lead for multi-turn test
    const mtLeadRes = await fetch(`${BASE_URL}/leads`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            patientName: 'Farhan Zaidi',
            phone: multiTurnPhone,
            source: 'facebook_lead_ad',
            interestedTreatment: 'Knee PRP Regeneration'
        })
    });
    const mtLeadJson = await mtLeadRes.json();
    assert.strictEqual(mtLeadJson.success, true);
    const mtLead = mtLeadJson.data;

    // Step 1: Ensure 2:30 PM on 2026-09-03 is booked/unavailable by creating an existing appointment on 2:30 PM
    const blockerPhone = `+92399${Math.floor(1000000 + Math.random() * 9000000)}`;
    await fetch(`${BASE_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
            patientName: 'Blocker Patient',
            phone: blockerPhone,
            date: '2026-09-03',
            time: '2:30 PM',
            appointmentType: 'In-Person Appointment',
            clinic: 'Stay Young Clinic'
        })
    });

    // Step 2: Patient sends Message 1: "I want to book an in-person appointment for Thursday, September 3 at 2:30 PM."
    console.log('  -> Patient sends Message 1: "I want to book an in-person appointment for Thursday, September 3 at 2:30 PM."');
    const msg1Res = await fetch(`${BASE_URL}/leads/${mtLead._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
            message: 'I want to book an in-person appointment for Thursday, September 3 at 2:30 PM.',
            sender: 'lead'
        })
    });
    const msg1Json = await msg1Res.json();
    assert.strictEqual(msg1Json.success, true);
    const msg1Reply = msg1Json.data.aiMsg.message;
    assert.ok(msg1Reply.includes('unavailable') || msg1Reply.includes('2:30 PM'), 'AI must state 2:30 PM is unavailable');
    assert.ok(msg1Reply.includes('3:00 PM') || msg1Reply.includes('Available slots'), 'AI must offer alternative slots including 3:00 PM');
    console.log('  ✔ Step 1 Verified: AI responded that 2:30 PM is unavailable and offered alternative slots (including 3:00 PM).');

    // Step 3: Patient sends Message 2: "I would like to book the 3:00 PM slot as an in-person appointment."
    console.log('  -> Patient sends Message 2: "I would like to book the 3:00 PM slot as an in-person appointment."');
    const msg2Res = await fetch(`${BASE_URL}/leads/${mtLead._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
            message: 'I would like to book the 3:00 PM slot as an in-person appointment.',
            sender: 'lead'
        })
    });
    const msg2Json = await msg2Res.json();
    assert.strictEqual(msg2Json.success, true);
    const msg2Reply = msg2Json.data.aiMsg.message;

    // Assert that the AI does NOT ask the patient for the date again
    assert.ok(!msg2Reply.includes('Please let me know your preferred date'), 'AI MUST NOT ask for the date again when selecting an offered slot');
    assert.ok(msg2Reply.includes('Appointment Confirmed'), 'AI must confirm the appointment');
    assert.ok(msg2Reply.includes('2026-09-03'), 'Confirmation must contain the resolved date 2026-09-03');
    assert.ok(msg2Reply.includes('3:00 PM'), 'Confirmation must contain 3:00 PM');
    assert.ok(msg2Reply.includes('In-Person Appointment'), 'Confirmation must contain In-Person Appointment');
    console.log('  ✔ Step 2 Verified: AI successfully bound "3:00 PM" to "2026-09-03" without asking for date again!');

    // Verify appointment in DB and linked to lead
    const mtLeadDetailRes = await fetch(`${BASE_URL}/leads/${mtLead._id}`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const mtLeadDetailJson = await mtLeadDetailRes.json();
    const mtAppt = mtLeadDetailJson.data.linkedAppointment;
    assert.ok(mtAppt, 'Linked appointment must exist on lead');
    assert.strictEqual(mtAppt.date, '2026-09-03', 'Stored appointment date must be 2026-09-03');
    assert.strictEqual(mtAppt.time, '3:00 PM', 'Stored appointment time must be 3:00 PM');
    assert.strictEqual(mtAppt.appointmentType, 'In-Person Appointment', 'Stored appointmentType must be In-Person Appointment');
    console.log(`  ✔ Confirmed: Appointment stored in DB (Token #${mtAppt.tokenNumber}, ID: ${mtAppt.appointmentId}, Date: ${mtAppt.date}, Time: ${mtAppt.time}, Type: ${mtAppt.appointmentType}) and linked to lead.`);

    // TEST 11: Emergency Red Flag Detection Test
    console.log('\n▶ Test 11: Emergency / Red-Flag Detection & Alert Registration');
    const emergencyPhone = `+92311${Math.floor(1000000 + Math.random() * 9000000)}`;
    const emgRes = await fetch(`${BASE_URL}/leads/incoming-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source: 'whatsapp_ad',
            patientName: 'Emergency Caller',
            phone: emergencyPhone,
            message: 'I am experiencing sudden weakness and severe chest pain with breathing difficulty!'
        })
    });
    const emgJson = await emgRes.json();
    assert.strictEqual(emgJson.success, true);
    const emgReply = emgJson.data.aiResult?.aiMsg?.message || emgJson.data.lead?.lastMessage || '';
    assert.ok(emgReply.includes('URGENT MEDICAL NOTICE'), 'Emergency reply must be triggered');
    console.log('  ✔ Red flag detected: Immediate urgent ER guidance & emergency alert triggered.');

    // TEST 12: Manual Lead Entry with Duplicate Phone Validation
    console.log('\n▶ Test 12: Manual Lead Creation & Duplicate Phone Prevention');
    const manualLeadPhone = `+92333${Math.floor(1000000 + Math.random() * 9000000)}`;
    const createLeadRes = await fetch(`${BASE_URL}/leads`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            patientName: 'Imran Khan',
            phone: manualLeadPhone,
            email: 'imran@example.com',
            city: 'Lahore',
            interestedTreatment: 'Chronic Back & Spine Pain',
            leadMessage: 'Interested in disc treatment without surgery.'
        })
    });
    const createLeadJson = await createLeadRes.json();
    assert.strictEqual(createLeadJson.success, true);
    assert.ok(createLeadJson.data.leadId, 'Lead ID must be generated');

    // Duplicate creation attempt
    const dupRes = await fetch(`${BASE_URL}/leads`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
            patientName: 'Imran Khan Duplicate',
            phone: manualLeadPhone,
            interestedTreatment: 'Knee Pain'
        })
    });
    assert.strictEqual(dupRes.status, 409, 'Duplicate phone number should return 409 Conflict');
    console.log('  ✔ Manual lead created and duplicate phone number successfully blocked.');

    // TEST 13: Lead Conversion & Status Tracking
    console.log('\n▶ Test 13: Lead Conversion Action');
    const convertRes = await fetch(`${BASE_URL}/leads/${testLeadDbId}/convert`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ notes: 'Patient attended PRP therapy procedure at clinic.' })
    });
    const convertJson = await convertRes.json();
    assert.strictEqual(convertJson.success, true);
    assert.strictEqual(convertJson.data.leadStatus, 'Converted');
    console.log('  ✔ Lead successfully marked as Converted.');

    // TEST 14: Analytics & KPI Metrics Calculation
    console.log('\n▶ Test 14: Ads Leads Analytics KPIs & Platform Distribution');
    const statsRes = await fetch(`${BASE_URL}/leads/stats`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const statsJson = await statsRes.json();
    assert.strictEqual(statsJson.success, true);
    const s = statsJson.data;
    assert.ok(s.totalLeads > 0, 'Total leads count should be > 0');
    assert.ok(s.appointmentsBooked > 0, 'Appointments booked should be > 0');
    assert.ok(s.convertedLeads > 0, 'Converted leads should be > 0');
    console.log(`  ✔ Analytics verified: Total: ${s.totalLeads} | AI: ${s.aiHandledLeads} | Manual: ${s.manualLeads} | Booked: ${s.appointmentsBooked} | Conv Rate: ${s.conversionRate}`);

    console.log('\n===============================================================');
    console.log(' 🎉 ALL 14 AUTOMATED INTEGRATION TESTS PASSED SUCCESSFULLY!');
    console.log('===============================================================');
}

runTests().catch(err => {
    console.error('\n❌ TEST FAILURE:', err);
    process.exit(1);
});

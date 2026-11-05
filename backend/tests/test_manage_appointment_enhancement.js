const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
    console.log('🚀 Starting Manage Appointment Enhancement Test Suite...\n');

    // Pick dynamic valid future dates (Monday - Saturday)
    const today = new Date();
    const getFutureDate = (offsetDays) => {
        const d = new Date(today);
        d.setDate(today.getDate() + offsetDays);
        if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Skip Sunday
        return d.toISOString().split('T')[0];
    };

    const testDate1 = getFutureDate(3);
    const testDate2 = getFutureDate(4);
    const uniquePhone = `0321${Math.floor(1000000 + Math.random() * 9000000)}`;

    console.log(`📅 Test Dates: Date 1 = ${testDate1}, Date 2 = ${testDate2}`);
    console.log(`📱 Test Patient Phone: ${uniquePhone}`);

    // TEST 1: Book initial appointment
    console.log('\n--- TEST 1: Book Initial Appointment ---');
    const bookRes = await fetch(`${BASE_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            patientName: 'Ahmad Raza Test',
            phone: uniquePhone,
            appointmentType: 'In-Person Appointment',
            clinic: 'Stay Young Clinic',
            city: 'Lahore',
            date: testDate1,
            time: '2:00 PM',
            notes: 'Test booking for manage feature'
        })
    });
    const bookJson = await bookRes.json();
    assert.strictEqual(bookRes.status, 201, 'Booking must return 201 Created');
    assert.strictEqual(bookJson.success, true, 'Booking response must be successful');
    const appt = bookJson.data;
    const initialId = appt.appointmentId;
    const initialToken = appt.tokenNumber;
    console.log(`✅ Appointment Booked: ID=${initialId}, Token=#${initialToken}, Date=${appt.date}, Time=${appt.time}`);

    // TEST 2: Search Appointment by ID, Token, and Phone
    console.log('\n--- TEST 2: Search Appointment by ID, Token Number, and Phone ---');
    
    // 2a. Search by ID
    const searchIdRes = await fetch(`${BASE_URL}/appointments/search?query=${initialId}`);
    const searchIdJson = await searchIdRes.json();
    assert.strictEqual(searchIdJson.success, true, 'Search by ID must succeed');
    assert.ok(searchIdJson.data.some(a => a.appointmentId === initialId), 'Found by appointmentId');
    console.log('✅ Search by Appointment ID succeeded');

    // 2b. Search by Token
    const searchTokenRes = await fetch(`${BASE_URL}/appointments/search?query=${initialToken}`);
    const searchTokenJson = await searchTokenRes.json();
    assert.strictEqual(searchTokenJson.success, true, 'Search by Token must succeed');
    assert.ok(searchTokenJson.data.some(a => a.tokenNumber === initialToken), 'Found by tokenNumber');
    console.log('✅ Search by Token Number succeeded');

    // 2c. Search by Phone
    const searchPhoneRes = await fetch(`${BASE_URL}/appointments/search?query=${uniquePhone}`);
    const searchPhoneJson = await searchPhoneRes.json();
    assert.strictEqual(searchPhoneJson.success, true, 'Search by Phone must succeed');
    assert.ok(searchPhoneJson.data.some(a => a.phone === uniquePhone), 'Found by phone');
    console.log('✅ Search by Phone Number succeeded');

    // TEST 3: Confirm Appointment
    console.log('\n--- TEST 3: Confirm Appointment ---');
    const confirmRes = await fetch(`${BASE_URL}/appointments/${initialId}/confirm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
    });
    const confirmJson = await confirmRes.json();
    assert.strictEqual(confirmRes.status, 200, 'Confirm must return 200');
    assert.strictEqual(confirmJson.success, true, 'Confirm response must be successful');
    assert.strictEqual(confirmJson.data.status.toLowerCase(), 'confirmed', 'Status must be confirmed');
    assert.ok(confirmJson.data.confirmedAt, 'confirmedAt timestamp must be recorded');
    console.log(`✅ Appointment Confirmed: confirmedAt=${confirmJson.data.confirmedAt}`);

    // TEST 4: Reschedule Appointment to a new date and time
    console.log('\n--- TEST 4: Reschedule Appointment ---');
    const rescheduleRes = await fetch(`${BASE_URL}/appointments/${initialId}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date: testDate2,
            time: '4:30 PM'
        })
    });
    const rescheduleJson = await rescheduleRes.json();
    assert.strictEqual(rescheduleRes.status, 200, 'Reschedule must return 200');
    assert.strictEqual(rescheduleJson.success, true, 'Reschedule must succeed');
    assert.strictEqual(rescheduleJson.data.appointmentId, initialId, 'Appointment ID must remain unchanged');
    assert.strictEqual(rescheduleJson.data.tokenNumber, initialToken, 'Token Number must remain unchanged');
    assert.strictEqual(rescheduleJson.data.date, testDate2, 'Date must be updated to new date');
    assert.strictEqual(rescheduleJson.data.time, '4:30 PM', 'Time must be updated to new time');
    assert.ok(rescheduleJson.data.rescheduledAt, 'rescheduledAt timestamp must be saved');
    console.log(`✅ Appointment Rescheduled successfully: ID=${rescheduleJson.data.appointmentId}, Token=#${rescheduleJson.data.tokenNumber}, NewDate=${rescheduleJson.data.date}, NewTime=${rescheduleJson.data.time}, RescheduledAt=${rescheduleJson.data.rescheduledAt}`);

    // TEST 5: Verify Old Slot is Released and New Slot is Booked
    console.log('\n--- TEST 5: Verify Slot Availability after Reschedule ---');
    const slotsDate1Res = await fetch(`${BASE_URL}/appointments/slots?date=${testDate1}`);
    const slotsDate1Json = await slotsDate1Res.json();
    assert.ok(slotsDate1Json.data.slots.includes('2:00 PM'), 'Old slot (2:00 PM on Date1) must be available again');
    console.log('✅ Old slot 2:00 PM is now available again');

    const slotsDate2Res = await fetch(`${BASE_URL}/appointments/slots?date=${testDate2}`);
    const slotsDate2Json = await slotsDate2Res.json();
    assert.ok(!slotsDate2Json.data.slots.includes('4:30 PM'), 'New slot (4:30 PM on Date2) must NOT be in available slots');
    console.log('✅ New slot 4:30 PM is booked and excluded from available slots');

    // TEST 6: Double Booking Collision Prevention during Reschedule
    console.log('\n--- TEST 6: Prevent Collision during Reschedule ---');
    // Book a separate appointment on testDate2 at 5:00 PM
    const book2Res = await fetch(`${BASE_URL}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            patientName: 'Second Patient',
            phone: '03331122334',
            appointmentType: 'In-Person Appointment',
            clinic: 'Stay Young Clinic',
            city: 'Lahore',
            date: testDate2,
            time: '5:00 PM'
        })
    });
    const book2Json = await book2Res.json();
    assert.strictEqual(book2Res.status, 201);
    const secondApptId = book2Json.data.appointmentId;

    // Try to reschedule first appointment to 5:00 PM (which is now occupied by second patient)
    const collisionRes = await fetch(`${BASE_URL}/appointments/${initialId}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            date: testDate2,
            time: '5:00 PM'
        })
    });
    const collisionJson = await collisionRes.json();
    assert.strictEqual(collisionRes.status, 400, 'Colliding reschedule must return 400');
    assert.strictEqual(collisionJson.success, false);
    assert.strictEqual(collisionJson.message, 'Selected time slot is not available. Please choose another slot.');
    console.log('✅ Collision check correctly rejected reschedule to occupied slot with message: "Selected time slot is not available. Please choose another slot."');

    // TEST 7: Cancel Appointment & Verify Slot Release
    console.log('\n--- TEST 7: Cancel Appointment & Verify Slot Release ---');
    const cancelRes = await fetch(`${BASE_URL}/appointments/${initialId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Patient Request' })
    });
    const cancelJson = await cancelRes.json();
    assert.strictEqual(cancelRes.status, 200, 'Cancel must return 200');
    assert.strictEqual(cancelJson.success, true);
    assert.strictEqual(cancelJson.data.status.toLowerCase(), 'cancelled', 'Status must be cancelled');
    assert.ok(cancelJson.data.cancelledAt, 'cancelledAt timestamp must be recorded');
    console.log(`✅ Appointment Cancelled: status=${cancelJson.data.status}, cancelledAt=${cancelJson.data.cancelledAt}`);

    // Verify Date2 4:30 PM slot is freed up now
    const slotsAfterCancelRes = await fetch(`${BASE_URL}/appointments/slots?date=${testDate2}`);
    const slotsAfterCancelJson = await slotsAfterCancelRes.json();
    assert.ok(slotsAfterCancelJson.data.slots.includes('4:30 PM'), '4:30 PM slot must be released back to available slots');
    console.log('✅ Cancelled slot 4:30 PM is now released and available again');

    // Clean up second appointment
    await fetch(`${BASE_URL}/appointments/${secondApptId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Test Cleanup' })
    });

    console.log('\n=======================================================');
    console.log('🎉 ALL MANAGE APPOINTMENT ENHANCEMENT TESTS PASSED! 🎉');
    console.log('=======================================================\n');
}

runTests().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

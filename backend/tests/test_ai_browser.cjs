// Requires the existing local Playwright/Chrome QA installation. Synthetic inference only.
const { chromium } = require('../../.qa/node_modules/playwright-core');
const mongoose = require('mongoose');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const db = 'nighat_ai_browser_test_' + Date.now();
const uri = 'mongodb://127.0.0.1:27017/' + db;
const requests = [];
const results = [];
let child, browser;
const transport = http.createServer(async (req, res) => {
    let data = ''; for await (const chunk of req) data += chunk;
    const body = JSON.parse(data), input = JSON.parse(body.contents[0].parts[0].text);
    requests.push(input);
    const message = input.message;
    const language = /[\u0600-\u06ff]/.test(message) ? 'urdu' : /un ki|bata dein/i.test(message) ? 'roman_urdu' : 'english';
    const book = /arrange a visit/i.test(message);
    const topic = /professional|qualification|un ki/i.test(message) ? 'doctors' : 'hours';
    const plan = { intent: book ? 'book' : 'information', language, topic: book ? 'none' : topic, factIds: book ? [] : [topic] };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ responseId: 'synthetic-browser-' + requests.length,
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(plan) }] } }] }));
});
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
    const providerPort = await listen(transport);
    const reserve = http.createServer(); const appPort = await listen(reserve); await new Promise(resolve => reserve.close(resolve));
    await mongoose.connect(uri);
    await require('../services/configureKhurram').configureKhurram();
    child = spawn(process.execPath, ['-r', path.join(__dirname, 'helpers/syntheticProvider.cjs'), 'backend/server.js'], {
        cwd: root, env: { ...process.env, NODE_ENV: 'test', TEST_MONGODB_URI: uri, PORT: String(appPort),
            AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-3.8-flash', AI_API_KEY: 'synthetic-browser-test-not-a-key',
            AI_ENABLED: 'true', AI_PRIVACY_APPROVED: 'true', AI_PAID_SERVICE_CONFIRMED: 'true',
            AI_TIMEOUT_MS: '1000', AI_MAX_RETRIES: '0', WHATSAPP_DELIVERY_ENABLED: 'false',
            SYNTHETIC_AI_ORIGIN: 'http://127.0.0.1:' + providerPort }
    });
    let startupState = 'starting';
    child.stdout.on('data', chunk => { if (String(chunk).includes('[Database] Connected:')) startupState = 'database connected'; });
    child.stderr.on('data', chunk => { if (/EADDRINUSE/.test(String(chunk))) startupState = 'port already in use'; });
    child.on('exit', code => { startupState = 'child exited ' + code; });
    const base = 'http://127.0.0.1:' + appPort;
    let ready = false;
    for (let i = 0; i < 240; i++) {
        try { const r = await fetch(base + '/api/knowledge', { signal: AbortSignal.timeout(800) }); const b = await r.json(); if (b.data?.doctors?.some(d => d.id === 'dr-khurram')) { ready = true; break; } } catch (_) {}
        await pause(250);
    }
    assert.ok(ready, 'Local test backend did not start: ' + startupState);
    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/patient/index.html');
    await page.waitForFunction(() => document.querySelector('#providerName').textContent === 'Dr. Khurram Mansoor');
    let date = new Date(Date.now() + 10 * 86400000); while (date.getUTCDay() !== 1) date.setUTCDate(date.getUTCDate() + 1);
    const monday = date.toISOString().slice(0, 10);
    await page.locator('#bookingForm [name="date"]').fill(monday);
    await page.waitForSelector('#bookingSlots button');
    assert.equal(await page.locator('#bookingSlots button').count(), 30);
    results.push('Real backend availability displays all 30 seven-minute slots');
    await page.locator('.chat-launcher').click();
    async function action(fn) {
        const pending = page.waitForResponse(r => r.url().endsWith('/api/staff/chat/message') && r.request().method() === 'POST');
        pending.catch(() => {}); await fn(); const body = await (await pending).json(); assert.equal(body.success, true);
        await page.waitForFunction(() => !document.querySelector('#sendButton').disabled); return body.data;
    }
    const send = text => action(async () => { await page.locator('#messageInput').fill(text); await page.locator('#messageForm').evaluate(f => f.requestSubmit()); });
    const click = pattern => action(() => page.locator('.wa-options-wrap').last().getByRole('button', { name: pattern }).click());
    let r = await send('Could you tell me when I can see him in the morning?');
    assert.match(r.reply, /Google Gemini/); assert.equal(requests.length, 0);
    await click(/Allow administrative AI/); assert.equal(requests.length, 0);
    r = await send('Could you tell me when I can see him in the morning?');
    assert.equal(requests.length, 1); assert.match(r.reply, /09:00/); assert.match(r.reply, /12:30/);
    assert.equal(r.messages.at(-1).metadata.ai.source, 'gemini');
    r = await send('And what about weekends?');
    assert.equal(requests.at(-1).previousTopic, 'hours'); assert.match(r.reply, /saturday: Closed/);
    results.push('Explicit consent, natural questions and follow-up topic context reach synthetic provider');
    r = await send('براہ کرم ڈاکٹر کے اوقات بتائیں'); assert.match(r.reply, /تصدیق/);
    r = await send('un ki qualification bata dein'); assert.match(r.reply, /tasdeeq shuda/); assert.match(r.reply, /PGR/);
    results.push('English, Urdu and Roman Urdu administrative response plans render in existing chat UI');
    const beforeSafety = requests.length;
    r = await send('Which medicine should I take?'); assert.match(r.reply, /cannot diagnose|Tashkhees/);
    assert.equal(requests.length, beforeSafety);
    results.push('Medical-advice request is blocked locally without external transfer');
    r = await send('Could you arrange a visit with him?'); assert.equal(r.workflowStep, 'AWAITING_NAME');
    const beforeDetails = requests.length;
    await send('Synthetic Browser QA'); await send('03000005555');
    r = await send(monday); assert.equal(r.workflowStep, 'AWAITING_SLOT');
    await click(/^9:00 AM/); assert.equal(await mongoose.connection.collection('appointments').countDocuments({}), 0);
    r = await click(/Confirm Appointment/); assert.equal(r.workflowStep, 'CONFIRMED');
    const saved = await mongoose.connection.collection('appointments').findOne({ patientName: 'Synthetic Browser QA' });
    assert.ok(saved); assert.equal(saved.doctorId, 'dr-khurram'); assert.equal(saved.durationMinutes, 7);
    assert.equal(requests.length, beforeDetails);
    const transfer = JSON.stringify(requests); assert.ok(!transfer.includes('Synthetic Browser QA')); assert.ok(!transfer.includes('03000005555'));
    results.push('Natural appointment intent hands off to real confirmed MongoDB booking; no booking details sent to provider');
    const sid = await page.evaluate(() => localStorage.getItem('mza_patient_session_id'));
    const own = await (await fetch(base + '/api/staff/chat/messages?sessionId=' + sid)).json();
    assert.ok(own.data.messages.length > 0);
    assert.equal((await fetch(base + '/api/staff/chat/messages?phone=03000005555')).status, 400);
    const other = await (await fetch(base + '/api/staff/chat/messages?sessionId=sess_synthetic_other&phone=03000005555')).json();
    assert.equal(other.data.messages.length, 0);
    const attack = await fetch(base + '/api/staff/chat/messages?sessionId[$ne]=null'); assert.equal(attack.status, 400);
    results.push('Chat history requires private session token; phone-only and object-query recovery are rejected');
    const data = await (await fetch(base + '/api/appointments/slots?date=' + monday + '&doctorId=dr-khurram')).json();
    assert.equal(data.data.slots.length, 29); assert.ok(!data.data.slots.includes('9:00 AM'));
    for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
    assert.deepEqual(errors, []);
    results.push('Booked interval disappears from availability; four widths pass with zero runtime errors');
    fs.mkdirSync(path.join(root, '.qa'), { recursive: true });
    const evidence = { passed: results, syntheticProviderRequests: requests.length, liveProviderInference: false, productionPatientWrites: 0 };
    fs.writeFileSync(path.join(root, '.qa/ai-browser-results.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; }).finally(async () => {
    if (browser) await browser.close();
    if (child) { child.kill(); await pause(300); }
    if (mongoose.connection.name === db && db.startsWith('nighat_ai_browser_test_')) await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect(); await new Promise(resolve => transport.close(resolve));
});

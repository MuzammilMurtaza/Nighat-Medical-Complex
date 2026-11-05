const { chromium } = require('./.qa/node_modules/playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const mongoose = require('./backend/node_modules/mongoose');
const jwt = require('./backend/node_modules/jsonwebtoken');
const base='http://localhost:5001';
const results=[];
async function check(name,fn){await fn();results.push(name);console.log('PASS '+name)}
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext(); const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/patient/index.html');await page.waitForSelector('.service-card');
 await check('Responsive layout at all seven requested widths',async()=>{
 for(const width of [320,375,390,768,1024,1440,1920]){
 await page.setViewportSize({width,height:1000}); await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow at '+width);
 await page.screenshot({path:'.qa/width-'+width+'.png',fullPage:true});
 }
 });
 await check('Navigation and mobile menu',async()=>{await page.setViewportSize({width:375,height:812});await page.locator('#navToggle').click();await page.locator('#navigation a[href="#appointments"]').click();assert.equal(await page.locator('#navToggle').getAttribute('aria-expanded'),'false');assert.equal(new URL(page.url()).hash,'#appointments')});
 await check('Verified profile and expandable backend services',async()=>{assert.match(await page.locator('.doctor-bio').innerText(),/Muhammad Zaheer Anjum/);assert.equal(await page.locator('.service-card:visible').count(),6);await page.locator('.all-services').click();assert.ok(await page.locator('.service-card:visible').count()>6);await page.locator('.all-services').click()});
 await check('Chat replies to Hi and preserves session on reload',async()=>{
 await page.locator('.chat-launcher').click();await page.locator('#messageInput').fill('Hi');await page.locator('#messageForm').evaluate(f=>f.requestSubmit());
 await page.waitForFunction(()=>!document.querySelector('#sendButton').disabled);
 await page.waitForTimeout(500);assert.ok(await page.locator('#chatMessagesFeed').innerText());
 const sid=await page.evaluate(()=>localStorage.getItem('mza_patient_session_id'));
 await page.reload();assert.equal(await page.evaluate(()=>localStorage.getItem('mza_patient_session_id')),sid);
 await page.locator('.chat-launcher').click();await page.waitForTimeout(500);assert.ok(await page.locator('#chatMessagesFeed').innerText());
 });
 await check('English and Urdu backend conversations',async()=>{
 for (const [language,message] of [['english','Hi'],['urdu','السلام علیکم'],['roman_urdu','Assalam o alaikum']]){
 const response=await page.request.post(base+'/api/staff/chat/message',{data:{sessionId:'qa_'+language+'_'+Date.now(),language,message}});const body=await response.json();assert.equal(body.success,true);assert.ok(body.data.messages.length);if(language==='urdu')assert.match(JSON.stringify(body),/[\u0600-\u06ff]/);
 }
 });
 await check('Recoverable chat error stops typing and allows retry',async()=>{
 await page.route('**/api/staff/chat/message',route=>route.fulfill({status:503,contentType:'application/json',body:'{"success":false}'}));
 await page.locator('#messageInput').fill('test recovery');await page.locator('#messageForm').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>!document.querySelector('#sendButton').disabled);
 assert.match(await page.locator('#chatMessagesFeed').innerText(),/try again/i);assert.equal(await page.locator('.wa-typing-indicator').count(),0);await page.unroute('**/api/staff/chat/message');await page.locator('.chat-close').click();
 });
 await check('Slot API failure never displays invented times',async()=>{
 await page.route('**/api/appointments/slots?**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"success":false}'}));await page.locator('#bookingForm [name="date"]').fill('2026-12-09');await page.waitForFunction(()=>document.querySelector('#bookingSlots').textContent.includes('Retry'));assert.equal(await page.locator('#bookingSlots button').count(),1);assert.equal(await page.locator('#confirmBooking').isDisabled(),true);await page.unroute('**/api/appointments/slots?**');
 });
 let reference;
 await check('Real booking confirmation',async()=>{
 await page.locator('#bookingForm [name="date"]').fill('2026-12-10');await page.waitForSelector('#bookingSlots button');await page.locator('#bookingSlots button').first().click();await page.locator('#bookingForm [name="patientName"]').fill('Redesign QA Patient');await page.locator('#bookingForm [name="phone"]').fill('03000009999');await page.locator('#confirmBooking').click();await page.waitForFunction(()=>document.querySelector('#bookingStatus').textContent.includes('Appointment confirmed'));
 reference=(await page.locator('#bookingStatus').innerText()).match(/Reference: ([^.]+)\./)[1];
 });
 await mongoose.connect('mongodb://127.0.0.1:27017/nighat_redesign_qa');
 await check('Booking exists in MongoDB and protected admin appointments API',async()=>{
 const saved=await mongoose.connection.collection('appointments').findOne({appointmentId:reference});assert.ok(saved);const token=jwt.sign({id:'default_admin_id',username:'admin'},process.env.JWT_SECRET||'mza_clinic_super_secret_jwt_key_2026_safe_medical');
 const response=await page.request.get(base+'/api/appointments',{headers:{Authorization:'Bearer '+token}});const body=await response.json();assert.ok(body.data.some(a=>a.appointmentId===reference));
 await page.evaluate(token=>localStorage.setItem('mza_admin_token',token),token);await page.goto(base+'/admin/admin.html');await page.waitForTimeout(1300);assert.match(await page.title(),/Nighat/);assert.ok(!page.url().includes('login'));
 });
 await check('Unauthenticated admin records return 401',async()=>{
 for(const path of ['/api/patients','/api/appointments','/api/reports','/api/staff/inbox','/api/consultations','/api/dashboard/stats']) assert.equal((await page.request.get(base+path)).status(),401,path);
 });
 await check('No JavaScript runtime errors',async()=>assert.deepEqual(errors,[]));
 await mongoose.disconnect();
 fs.writeFileSync('.qa/results.json',JSON.stringify({passed:results,errors},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

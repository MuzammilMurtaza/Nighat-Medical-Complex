const assert=require('node:assert/strict');
const {chromium}=require('./.qa/node_modules/playwright-core');
const mongoose=require('./backend/node_modules/mongoose');
const jwt=require('./backend/node_modules/jsonwebtoken');
const base='http://localhost:5001';
(async()=>{
 const sid='qa_booking_'+Date.now();
 async function chat(message,payload){const r=await fetch(base+'/api/staff/chat/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:sid,message,payload,language:'english'})});const b=await r.json();assert.equal(b.success,true);return b.data;}
 await chat('English','LANG_ENGLISH');await chat('Book appointment','BOOK_APPOINTMENT');await chat('Chat QA Patient');let d=await chat('03000008888');assert.equal(d.workflowStep,'AWAITING_DATE');let option=d.options.find(o=>o.value.startsWith('DATE_'));const date=option.value.slice(5);d=await chat(option.label,option.value);option=d.options.find(o=>o.value.startsWith('SLOT_'));const time=option.value.slice(5);d=await chat(option.label,option.value);console.log('Review step',d.workflowStep,d.options.map(o=>o.value));option=d.options.find(o=>/CONFIRM/.test(o.value));d=await chat(option.label,option.value);assert.equal(d.workflowStep,'CONFIRMED');
 await mongoose.connect('mongodb://127.0.0.1:27017/nighat_redesign_qa');
 const booking=await mongoose.connection.collection('appointments').findOne({patientName:'Chat QA Patient',date,time});assert.ok(booking);console.log('PASS AI booking persisted through shared service');
 const available=await (await fetch(base+'/api/appointments/slots?date='+date)).json();assert.ok(!available.data.slots.includes(time));console.log('PASS Chat booking removes form availability');
 const payload={patientName:'Collision QA',phone:'03000007777',date,time};const conflict=await fetch(base+'/api/appointments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal(conflict.status,409);console.log('PASS Form cannot double-book chat slot');
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(base+'/patient/index.html');
 await page.locator('#contactForm [name="patientName"]').fill('Enquiry QA');await page.locator('#contactForm [name="phone"]').fill('03000006666');await page.locator('#contactForm [name="message"]').fill('QA enquiry for clinic staff');await page.locator('#contactForm button').click();await page.waitForFunction(()=>document.querySelector('#contactStatus').textContent.includes('has been sent'));console.log('PASS Contact form records staff handover');
 const token=jwt.sign({id:'default_admin_id',username:'admin'},process.env.JWT_SECRET||'mza_clinic_super_secret_jwt_key_2026_safe_medical');await page.evaluate(t=>localStorage.setItem('mza_admin_token',t),token);await page.goto(base+'/admin/admin.html');await page.waitForTimeout(1200);await page.locator('[data-page="appointments"]').click();await page.getByRole('cell',{name:'Chat QA Patient',exact:true}).first().waitFor();console.log('PASS Admin dashboard displays chat and form bookings');await page.screenshot({path:'.qa/admin-appointments.png',fullPage:true});await browser.close();await mongoose.disconnect();
})().catch(e=>{console.error(e);process.exit(1)});

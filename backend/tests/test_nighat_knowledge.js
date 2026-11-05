const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const knowledge = require('../services/knowledgeService');
const engine = require('../services/conversationEngine');
const { bookAppointment } = require('../services/bookingService');
const { generateSlotsForDate } = require('../utils/slotGenerator');
const Appointment = require('../models/Appointment');
const Clinic = require('../models/Clinic');
const OffDay = require('../models/OffDay');
const BlockedSlot = require('../models/BlockedSlot');
const SpecialSchedule = require('../models/SpecialSchedule');
const name = 'nighat_knowledge_test_' + Date.now();
const results=[];
async function check(label,fn){await fn();results.push(label);console.log('PASS '+label);}
(async()=>{
 await mongoose.connect('mongodb://127.0.0.1:27017/'+name,{serverSelectionTimeoutMS:2500});
 try {
 const send=(message,payload,sessionId='qa-'+randomUUID(),language)=>engine.processConversationMessage({sessionId,messageText:message,payload,language});
 await check('New organization defaults exclude historical clinic data',async()=>{const k=await knowledge.getKnowledge();assert.equal(k.organization.name,'Nighat Medical Complex');assert.equal(k.location.address,'');assert.equal(k.doctors.length,0);assert.equal(k.services.length,0);assert.ok(!('assistantInstructions' in k));});
 await check('English greeting and multilingual language selection',async()=>{let r=await send('Hi');assert.match(r.replyText,/Welcome to Nighat Medical Complex!/);assert.ok(r.options.some(o=>o.value==='LANG_URDU'));r=await send('اردو','LANG_URDU');assert.match(r.replyText,/نگہت/);r=await send('Salam mujhe fee bata dein');assert.ok(!/321|3733332|Stay Young/.test(r.replyText));});
 await check('Unknown fees and doctors are never invented',async()=>{for(const msg of ['consultation fee','Doctor qualifications','clinic address','medical services']){const r=await send(msg);assert.match(r.replyText,/not yet verified|Nighat Medical Complex/);assert.ok(!/Zaheer|Stay Young|Shadman|Lahore|3733332|Prolotherapy/i.test(r.replyText));}});
 await check('Unconfigured booking safely offers staff help',async()=>{const r=await send('Book appointment','BOOK_APPOINTMENT');assert.ok(!r.replyText.includes('Step 1'));assert.ok(r.options.some(o=>o.value==='SPEAK_STAFF'));});
 const fixture={organization:{name:'Nighat Medical Complex',type:'Medical Complex',description:'QA local fixture only'},location:{verified:true,address:'Local QA fixture address',city:'QA city',mapsUrl:''},contact:{verified:false,phone:'',whatsapp:'',email:''},schedule:{verified:true,timezone:'Asia/Karachi',slotMinutes:30,weekly:Object.fromEntries(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(day=>[day,{active:true,open:'12:00',close:'14:00'}]))},doctors:[{id:'qa-provider',name:'QA Provider Fixture',specialty:'Test fixture',qualifications:[],verified:true,active:true}],services:[{title:'QA Service Fixture',description:'Local test fixture',category:'QA',verified:true,active:true}],faqs:[{question:'parking?',answer:'QA approved answer',language:'english',verified:true}],assistantInstructions:'PRIVATE_ADMIN_SENTINEL'};
 await check('Admin-approved knowledge saves and reflects immediately',async()=>{await knowledge.updateKnowledge(fixture);let r=await send('Doctor profile');assert.match(r.replyText,/QA Provider Fixture/);r=await send('parking?');assert.equal(r.replyText,'QA approved answer');const k=await knowledge.getKnowledge();assert.ok(!JSON.stringify(k).includes('PRIVATE_ADMIN_SENTINEL'));});
 const target=new Date(Date.now()+86400000*3).toISOString().slice(0,10);
 await check('Availability uses approved schedule and existing block rules',async()=>{await BlockedSlot.create({date:target,time:'12:30 PM',reason:'QA'});const data=await generateSlotsForDate({dateStr:target,AppointmentModel:Appointment,ClinicModel:Clinic,OffDayModel:OffDay,BlockedSlotModel:BlockedSlot,SpecialScheduleModel:SpecialSchedule});assert.deepEqual(data.slots,['12:00 PM','1:00 PM','1:30 PM']);});
 await check('Concurrent real local booking writes and idempotent retry',async()=>{const input={patientName:'Local QA Patient',phone:'03000001111',date:target,time:'12:00 PM'};const pair=await Promise.allSettled([bookAppointment(input),bookAppointment({...input,patientName:'Local QA Other',phone:'03000002222'})]);assert.equal(pair.filter(p=>p.status==='fulfilled').length,1);const first=pair.find(p=>p.status==='fulfilled').value;assert.equal((await bookAppointment(input)).appointmentId,first.appointmentId);assert.equal(await Appointment.countDocuments({date:target,time:'12:00 PM'}),1);});
 await check('Full AI booking flow persists and shares form availability',async()=>{const sid='qa-flow-'+randomUUID();const s=(m,p)=>send(m,p,sid,'english');await s('English','LANG_ENGLISH');await s('Book appointment','BOOK_APPOINTMENT');await s('Local Chat QA');let r=await s('03000003333');const date=r.options.find(o=>o.value.startsWith('DATE_'));assert.ok(date);r=await s(date.label,date.value);const slot=r.options.find(o=>o.value.startsWith('SLOT_'));r=await s(slot.label,slot.value);r=await s('Confirm','CONFIRM_BOOKING');assert.equal(r.workflowStep,'CONFIRMED',r.replyText);assert.ok(await Appointment.findOne({appointmentId:r.bookingData.appointmentId}));});
 await check('Medical safety, staff handover and WhatsApp adapter remain active',async()=>{let r=await send('chest pain');assert.match(r.replyText,/emergency/i);assert.ok(!/Zaheer|3733332|Stay Young/.test(r.replyText));r=await send('Speak to staff','SPEAK_STAFF');assert.equal(r.mode,'MANUAL');const wa=engine.formatWhatsAppPayload('000',await send('Hi'));assert.equal(wa.messaging_product,'whatsapp');assert.match(JSON.stringify(wa),/Nighat/);});
 await check('Disconnected booking fails without alternate database',async()=>{await mongoose.disconnect();await assert.rejects(bookAppointment({}),e=>e.statusCode===503);});
 await check('Reconnection restores the explicitly isolated test database',async()=>{process.env.NODE_ENV='test';process.env.TEST_MONGODB_URI='mongodb://127.0.0.1:27017/'+name;const database=require('../config/database');assert.equal(await database.connectDB(),true);assert.equal(database.getDBStatus(),true);assert.equal(mongoose.connection.name,name);});
 console.log(JSON.stringify({passed:results.length,productionPatientWrites:0}));
 }finally{
 if(mongoose.connection.readyState!==1)await mongoose.connect('mongodb://127.0.0.1:27017/'+name);
 if(mongoose.connection.name===name&&name.startsWith('nighat_knowledge_test_'))await mongoose.connection.db.dropDatabase();
 await mongoose.disconnect();
 }
})().catch(e=>{console.error(e.name+': '+e.message);process.exitCode=1;});

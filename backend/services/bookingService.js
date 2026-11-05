const mongoose=require('mongoose');
const {randomUUID}=require('node:crypto');
const Appointment=require('../models/Appointment');
const Patient=require('../models/Patient');
const OffDay=require('../models/OffDay');
const BlockedSlot=require('../models/BlockedSlot');
const SpecialSchedule=require('../models/SpecialSchedule');
const {generateSlotsForDate,resolveDoctor,minutes,label}=require('../utils/slotGenerator');
const {generateAppointmentId}=require('../utils/appointmentIdGenerator');
const {generateTokenNumber}=require('../utils/tokenGenerator');
const {getKnowledge}=require('./knowledgeService');
const fail=(statusCode,message)=>Object.assign(new Error(message),{statusCode});
function normalizePhone(value){let p=String(value||'').replace(/[^\d+]/g,'');if(p.startsWith('+92'))p='0'+p.slice(3);else if(p.startsWith('92'))p='0'+p.slice(2);if(!/^03\d{9}$/.test(p))throw fail(400,'Please provide a valid Pakistan mobile number (03XXXXXXXXX).');return p;}
function ensureDatabase(){if(mongoose.connection.readyState!==1)throw fail(503,'Booking is temporarily unavailable. Please retry or contact clinic staff.');}
async function context(input){ensureDatabase();const config=await getKnowledge(),doctor=resolveDoctor(config,input.doctorId);if(!doctor||!config.schedule.verified||config.schedule.bookingEnabled===false||(config.schedule.doctorId&&config.schedule.doctorId!==doctor.id))throw fail(409,'This doctor is not available for online booking. Please contact clinic staff.');const t=minutes(input.time);if(!Number.isFinite(t)||typeof input.date!=='string')throw fail(400,'Please choose a valid date and appointment time.');return {config,doctor,time:label(t)};}
async function availability(date,time,doctorId,excludeAppointmentId){const slots=await generateSlotsForDate({dateStr:date,doctorId,excludeAppointmentId,AppointmentModel:Appointment,OffDayModel:OffDay,BlockedSlotModel:BlockedSlot,SpecialScheduleModel:SpecialSchedule});if(!slots.slots.includes(time))throw fail(409,'This time is no longer available. Please select another appointment time.');return slots;}
async function bookAppointment(input){
 const {config,doctor,time}=await context(input),{date}=input;
 if(typeof input.patientName!=='string'||input.patientName.trim().length<2||input.patientName.trim().length>160)throw fail(400,'Please provide your full name.');
 const patientName=input.patientName.trim(),phone=normalizePhone(input.phone);
 const existing=await Appointment.findOne({doctorId:doctor.id,date,time,status:{$nin:['cancelled','Cancelled']}});
 if(existing){if(existing.phone===phone&&existing.patientName===patientName)return existing;throw fail(409,'This time is no longer available. Please choose another time.');}
 const slots=await availability(date,time,doctor.id);
 let patient;
 try{patient=await Patient.findOneAndUpdate({phone},{$setOnInsert:{patientId:'PAT-'+randomUUID(),name:patientName,phone}},{upsert:true,new:true,runValidators:true});}catch(e){if(e.code!==11000)throw e;patient=await Patient.findOne({phone});}
 try{return await Appointment.create({appointmentId:await generateAppointmentId(Appointment),tokenNumber:await generateTokenNumber(Appointment,config.organization.name,date),patient:patient._id,patientName,phone,doctorId:doctor.id,doctorName:doctor.name,durationMinutes:slots.durationMinutes,appointmentType:'In-Person Appointment',clinic:config.organization.name,city:config.location.city||'',date,time,status:'confirmed',source:['website_chat','website_form','whatsapp','admin_lead'].includes(input.source)?input.source:'website_form',notes:input.notes||''});}
 catch(e){if(e.code===11000){const saved=await Appointment.findOne({doctorId:doctor.id,date,time,status:{$nin:['cancelled','Cancelled']}});if(saved&&saved.phone===phone&&saved.patientName===patientName)return saved;throw fail(409,'This time was just booked. Please select another available time.');}throw e;}
}
async function rescheduleBooking(id,input){
 ensureDatabase();const existing=await Appointment.findOne(mongoose.Types.ObjectId.isValid(id)?{$or:[{_id:id},{appointmentId:id}]}:{appointmentId:id});if(!existing)throw fail(404,'Appointment record not found.');
 const {doctor,time}=await context({...input,doctorId:existing.doctorId||input.doctorId});
 await availability(input.date,time,doctor.id,existing._id);
 try{return await Appointment.findOneAndUpdate({_id:existing._id,date:existing.date,time:existing.time},{$set:{doctorId:doctor.id,doctorName:doctor.name,date:input.date,time,durationMinutes:(await getKnowledge()).schedule.slotMinutes,status:'confirmed',scheduleReviewRequired:false,scheduleReviewReason:'',rescheduledAt:new Date()}},{new:true,runValidators:true}).then(saved=>{if(!saved)throw fail(409,'This appointment changed. Refresh and try again.');return saved;});}
 catch(e){if(e.code===11000)throw fail(409,'This time was just booked. Please select another time.');throw e;}
}
module.exports={bookAppointment,rescheduleBooking,normalizePhone};

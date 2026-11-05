const Appointment=require('../models/Appointment');
const {updateKnowledge,getRawKnowledge}=require('./knowledgeService');
const ID='dr-khurram';
async function configureKhurram(){
 const raw=await getRawKnowledge();
 const alias=/^dr\.?\s*khurram(?:\s+mansoor)?$/i;
 const matching=(raw.doctors||[]).filter(d=>d.id===ID||alias.test(d.name?.trim()||''));
 if(matching.some(d=>d.id===ID&&!alias.test(d.name?.trim()||'')))throw new Error('Doctor identifier belongs to a different profile.');
 const previous=matching[0];
 const provider={id:ID,name:'Dr. Khurram Mansoor',specialty:'Gynaecology and Obstetrics (postgraduate training)',qualifications:['MBBS','PGR (FCPS Gynae & Obs)','Member of PSASM'],consultationFee:previous?.consultationFee??null,currency:previous?.currency||'',verified:true,active:true};
 const doctors=[...(raw.doctors||[]).filter(d=>!matching.includes(d)),provider];
 const days=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
 const weekly=Object.fromEntries(days.map(day=>[day,['saturday','sunday'].includes(day)?{active:false,breaks:[]}:{active:true,open:'09:00',close:'12:30',breaks:[]} ]));
 await Appointment.createIndexes();
 const result=await updateKnowledge({doctors,schedule:{doctorId:ID,verified:true,bookingEnabled:true,timezone:'Asia/Karachi',slotMinutes:7,weekly}});
 // Preserve original appointment times, duration snapshots, status and patient history.
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const {minutes}=require('../utils/slotGenerator');
 const appointments=await Appointment.find({doctorId:ID,date:{$gte:today},status:{$in:['pending','Pending','confirmed','Confirmed','Rescheduled','rescheduled']}});
 for(const a of appointments){
  const weekday=new Date(a.date+'T00:00:00Z').getUTCDay(),t=minutes(a.time);
  const conflict=weekday===0||weekday===6||!Number.isFinite(t)||t<540||t+(a.durationMinutes||7)>750||(t-540)%7!==0||(a.durationMinutes&&a.durationMinutes!==7);
  if(conflict)await Appointment.updateOne({_id:a._id},{$set:{scheduleReviewRequired:true,scheduleReviewReason:'Updated consultation schedule: Monday-Friday 09:00-12:30, seven-minute appointments. Contact patient to review; original booking retained.'}});
 }
 return result;
}
module.exports={configureKhurram,ID};

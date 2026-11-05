const {getKnowledge}=require('../services/knowledgeService');
const {getDBStatus}=require('../config/database');
const DAYS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
function minutes(value){const m=String(value||'').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);if(!m)return NaN;let h=Number(m[1]),n=Number(m[2]);if(n>59)return NaN;if(m[3]){if(h<1||h>12)return NaN;h=h%12+(/^PM$/i.test(m[3])?12:0);}return h<24?h*60+n:NaN;}
function label(value){const h=Math.floor(value/60),m=value%60;return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
function clinicNow(now=new Date()){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));return {date:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute)+Number(p.second)/60};}
function resolveDoctor(config,id){const key=id||config.schedule?.doctorId;return key?config.doctors.find(d=>d.id===key):config.doctors[0];}
async function generateSlotsForDate({dateStr,doctorId,excludeAppointmentId,AppointmentModel,OffDayModel,BlockedSlotModel,SpecialScheduleModel,now=new Date()}){
 const unavailable=reason=>({available:false,reason,slots:[]});
 if(!getDBStatus())return unavailable('Live availability is temporarily unavailable');
 const config=await getKnowledge(),doctor=resolveDoctor(config,doctorId);
 if(!doctor||!config.schedule.verified)return unavailable('Doctor availability is not configured');
 if(config.schedule.bookingEnabled===false)return unavailable('Online booking is currently disabled. Please contact clinic staff.');
 if(config.schedule.doctorId&&doctor.id!==config.schedule.doctorId)return unavailable('This doctor does not have a configured schedule');
 const duration=config.schedule.slotMinutes;
 if(!Number.isInteger(duration)||duration<5||duration>240)return unavailable('Appointment duration is not configured');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr||''))return unavailable('Invalid date');
 const date=new Date(dateStr+'T00:00:00Z'),current=clinicNow(now);
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==dateStr)return unavailable('Invalid date');
 if(dateStr<current.date)return unavailable('Past appointments are unavailable');
 const day=config.schedule.weekly[DAYS[date.getUTCDay()]];
 if(OffDayModel&&await OffDayModel.findOne({date:dateStr}))return unavailable('Clinic holiday or doctor leave: no appointments on this date');
 const special=SpecialScheduleModel?await SpecialScheduleModel.findOne({date:dateStr}):null;
 if(!day?.active)return unavailable('The clinic is closed on this date');
 const baseStart=minutes(day.open),baseEnd=minutes(day.close);
 const start=Math.max(baseStart,minutes(special?.openingTime||day.open)),end=Math.min(baseEnd,minutes(special?.closingTime||day.close));
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)return unavailable('Schedule is not configured');
 const candidate=Array.from({length:Math.floor((baseEnd-baseStart)/duration)},(_,i)=>baseStart+i*duration).filter(t=>!special?.slots?.length||special.slots.some(s=>minutes(s)===t));
 const blocked=BlockedSlotModel?await BlockedSlotModel.find({date:dateStr}):[];
 const query={date:dateStr,status:{$nin:['cancelled','Cancelled']},$or:[{doctorId:doctor.id},{doctorId:{$exists:false}},{doctorId:null}]};
 if(excludeAppointmentId)query._id={$ne:excludeAppointmentId};
 const booked=AppointmentModel?await AppointmentModel.find(query):[];
 const intervals=[...(day?.breaks||[]).map(b=>[minutes(b.start),minutes(b.end)]),...blocked.map(b=>[minutes(b.time),minutes(b.time)+duration]),...booked.map(a=>[minutes(a.time),minutes(a.time)+(a.durationMinutes||duration)])];
 const slots=[...new Set(candidate)].filter(t=>Number.isFinite(t)&&t>=start&&t+duration<=end&&(dateStr!==current.date||t>current.minute)&&!intervals.some(([a,b])=>t<b&&t+duration>a)).sort((a,b)=>a-b).map(label);
 return {available:slots.length>0,reason:slots.length?'Available':'No appointment times are available for this date',slots,doctorId:doctor.id,doctorName:doctor.name,durationMinutes:duration,capacity:1};
}
module.exports={generateSlotsForDate,resolveDoctor,minutes,label,clinicNow,DEFAULT_SLOTS:[]};

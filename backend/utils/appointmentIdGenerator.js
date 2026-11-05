const Counter = require('../models/BookingCounter');
async function generateAppointmentId() {
 const year = new Date().getUTCFullYear();
 const counter=await Counter.findOneAndUpdate({_id:`appointment-${year}`},{$inc:{value:1}},{upsert:true,new:true});
 return `NMC-${year}-${1000+counter.value}`;
}
module.exports={generateAppointmentId};

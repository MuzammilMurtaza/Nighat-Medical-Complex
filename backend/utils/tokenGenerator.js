const Counter=require('../models/BookingCounter');
async function generateTokenNumber(AppointmentModel,clinic,date) {
 const id=`token:${clinic}:${date}`;
 const count=await AppointmentModel.countDocuments({clinic,date});
 try { await Counter.updateOne({_id:id},{$setOnInsert:{value:count}},{upsert:true}); } catch(e){if(e.code!==11000)throw e;}
 const result=await Counter.findOneAndUpdate({_id:id},{$inc:{value:1}},{new:true});
 return String(result.value).padStart(3,'0');
}
module.exports={generateTokenNumber};

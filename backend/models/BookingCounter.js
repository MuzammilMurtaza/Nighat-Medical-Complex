const mongoose = require('mongoose');
const schema = new mongoose.Schema({_id:String,value:{type:Number,default:0}},{versionKey:false});
module.exports=mongoose.model('BookingCounter',schema);

const { processConversationMessage } = require('./conversationEngine');
const LeadMessage = require('../models/LeadMessage');
const { SYSTEM_INSTRUCTIONS, getKnowledge } = require('./knowledgeService');
const MEDICAL_DISCLAIMER = 'I am an AI assistant. I do not diagnose or prescribe medication. For urgent medical concerns seek immediate professional emergency care.';
async function sendAiResponse(lead, responseText, metadata = {}) {
 const savedMsg = await LeadMessage.create({ leadId: lead._id, leadCode: lead.leadId, sender:'AI', messageType:'text', message:responseText, platformMessageId:`ai_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, timestamp:new Date(), deliveryStatus:'sent', sentBy:'Nighat AI Assistant', metadata });
 lead.lastMessage=responseText;lead.lastMessageAt=new Date();await lead.save();
 return { mode:'AI', replied:true, message:responseText, savedMessage:savedMsg, metadata };
}
async function processIncomingLeadMessage({lead,incomingMessageText,sender='lead',platformMessageId=null,metadata={}}) {
 const incomingMsg=await LeadMessage.create({leadId:lead._id,leadCode:lead.leadId,sender,messageType:'text',message:incomingMessageText,platformMessageId:platformMessageId||`lead_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,timestamp:new Date(),deliveryStatus:'delivered',sentBy:lead.patientName||'Patient',metadata});
 lead.lastMessage=incomingMessageText;lead.lastMessageAt=new Date();lead.totalMessagesCount=(lead.totalMessagesCount||0)+1;await lead.save();
 if(lead.conversationMode==='MANUAL')return {incomingMsg,aiMsg:null,replied:false,reason:'MANUAL_MODE_ACTIVE'};
 const result=await processConversationMessage({sessionId:`lead_${lead.leadId}`,channel:'whatsapp',messageText:incomingMessageText,payload:metadata.payload||null,phone:lead.phone,patientName:lead.patientName});
 if(result.mode==='MANUAL'){lead.conversationMode='MANUAL';await lead.save();}
 if(!result.replyText)return {incomingMsg,aiMsg:null,replied:false,reason:'STAFF_MODE_ACTIVE'};
 const response=await sendAiResponse(lead,result.replyText,{intent:result.activeWorkflow||'conversation_engine',options:result.options,bookingData:result.bookingData});
 return {incomingMsg,aiMsg:response,replied:true,intent:result.activeWorkflow||'conversation_engine'};
}
module.exports={processIncomingLeadMessage,sendAiResponse,MEDICAL_DISCLAIMER,SYSTEM_INSTRUCTIONS,getKnowledge};

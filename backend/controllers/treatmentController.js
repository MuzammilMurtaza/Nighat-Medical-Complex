const knowledge = require('../services/knowledgeService');
const { successResponse, errorResponse } = require('../utils/response');
const getTreatments = async (req,res,next) => { try { return successResponse(res,200,'Approved services',(await knowledge.getKnowledge()).services); } catch(e) { next(e); } };
const createTreatment = async (req,res) => {
 try {
  const raw = await knowledge.getRawKnowledge();
  const service = { title: req.body.title, description: req.body.description, category: req.body.category, verified: req.body.verified === true, active: true };
  await knowledge.updateKnowledge({ services: [...(raw.services || []),service] });
  return successResponse(res,201,'Service saved; unverified services remain hidden',service);
 } catch(e) { return errorResponse(res,400,'Unable to save service. Use authorized knowledge settings.'); }
};
module.exports = { getTreatments, createTreatment };

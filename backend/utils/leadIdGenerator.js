/**
 * Generates unique, human-friendly Lead IDs.
 * Format: LEAD-YYYYMMDD-XXXX
 */
const generateLeadId = async (AdsLeadModel) => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    try {
        if (AdsLeadModel) {
            const countToday = await AdsLeadModel.countDocuments({
                leadId: new RegExp(`^LEAD-${dateStr}`)
            });
            const nextSeq = String(countToday + 1).padStart(4, '0');
            return `LEAD-${dateStr}-${nextSeq}`;
        }
    } catch (e) {
        // Fallback below
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `LEAD-${dateStr}-${randomSuffix}`;
};

module.exports = { generateLeadId };

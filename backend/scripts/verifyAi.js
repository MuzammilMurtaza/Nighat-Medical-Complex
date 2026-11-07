// Explicitly opt-in synthetic provider check. Never use a patient message here.
require('../config/environment');
const fs = require('node:fs');
const path = require('node:path');
const provider = require('../services/ai/provider');
(async () => {
    const status = provider.status();
    if (!process.argv.includes('--live-synthetic') || !status.configured) {
        console.log(JSON.stringify({ ...status, liveInferenceAttempted: false, note: 'Requires --live-synthetic, valid AI_API_KEY, enabled/privacy/paid-service flags. No request sent.' }));
        process.exitCode = 2; return;
    }
    await provider.verifyModel();
    const result = await provider.generate({ system: 'Return the exact JSON object requested. This is a synthetic administrative connectivity check.',
        input: { synthetic: true, request: 'Return {"ok":true}. No patient information is present.' },
        schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false } });
    if (result.output.ok !== true) throw Object.assign(new Error('Invalid probe result'), { code: 'INVALID_PROBE_RESULT' });
    const evidence = { liveInferenceVerified: true, verifiedAt: new Date().toISOString(), ...result.evidence, syntheticOnly: true };
    const target = path.join(__dirname, '../../.qa'); fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'ai-live-evidence.json'), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
})().catch(e => { console.error(JSON.stringify({ liveInferenceVerified: false, error: e.code || 'PROVIDER_UNAVAILABLE' })); process.exitCode = 1; });

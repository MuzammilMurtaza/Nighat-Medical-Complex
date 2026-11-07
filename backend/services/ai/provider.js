const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.8-flash';
let active = 0;
let failures = 0;
let circuitUntil = 0;
const fault = (code, status) => Object.assign(new Error(code), { code, status });
function config(env = process.env) {
    return {
        provider: env.AI_PROVIDER || 'gemini', model: env.AI_MODEL || DEFAULT_MODEL,
        key: env.AI_API_KEY || '', enabled: env.AI_ENABLED === 'true',
        privacy: env.AI_PRIVACY_APPROVED === 'true', paid: env.AI_PAID_SERVICE_CONFIRMED === 'true',
        timeout: Math.max(100, Math.min(8000, Number(env.AI_TIMEOUT_MS) || 6000)),
        retries: Math.max(0, Math.min(1, Number(env.AI_MAX_RETRIES) || 0))
    };
}
function status(env = process.env) {
    const c = config(env);
    const reason = !c.enabled ? 'DISABLED' : !c.privacy || !c.paid ? 'PRIVACY_REVIEW_REQUIRED' :
        !c.key || /^(your_|replace|placeholder)/i.test(c.key) ? 'MISSING_KEY' :
        c.provider !== 'gemini' ? 'UNSUPPORTED_PROVIDER' : !/^gemini-[a-z0-9.-]+$/.test(c.model) ? 'INVALID_MODEL' : 'READY_NOT_VERIFIED';
    return { provider: c.provider, model: c.model, configured: reason === 'READY_NOT_VERIFIED', reason,
        inferenceVerified: false, keyConfigured: Boolean(c.key), enabled: c.enabled, privacyApproved: c.privacy, paidServiceConfirmed: c.paid };
}
async function request(path, body, { env = process.env, fetchImpl = global.fetch } = {}) {
    const c = config(env), s = status(env);
    if (!s.configured) throw fault(s.reason);
    if (Date.now() < circuitUntil) throw fault('CIRCUIT_OPEN');
    if (active >= 2) throw fault('BUSY');
    active++;
    const deadline = Date.now() + 12000;
    try {
        for (let attempt = 0; attempt <= c.retries; attempt++) {
            try {
                const response = await fetchImpl(BASE + path, {
                    method: body ? 'POST' : 'GET', redirect: 'error',
                    headers: { 'x-goog-api-key': c.key, 'Content-Type': 'application/json' },
                    ...(body ? { body: JSON.stringify(body) } : {}),
                    signal: AbortSignal.timeout(Math.max(1, Math.min(c.timeout, deadline - Date.now())))
                });
                if (!response.ok) throw fault(response.status === 401 || response.status === 403 ? 'AUTHENTICATION_FAILED' :
                    response.status === 404 ? 'MODEL_UNAVAILABLE' : 'PROVIDER_HTTP_ERROR', response.status);
                const text = await response.text();
                if (text.length > 100000) throw fault('RESPONSE_TOO_LARGE');
                const data = JSON.parse(text);
                failures = 0;
                return data;
            } catch (error) {
                const retryable = error.status === 429 || error.status >= 500;
                if (attempt < c.retries && retryable && Date.now() + 400 < deadline) {
                    await new Promise(resolve => setTimeout(resolve, 250));
                    continue;
                }
                failures++;
                if (failures >= 3) { circuitUntil = Date.now() + 30000; failures = 0; }
                throw fault(error.name === 'TimeoutError' || error.name === 'AbortError' ? 'TIMEOUT' : error.code || 'PROVIDER_UNAVAILABLE', error.status);
            }
        }
    } finally { active--; }
}
async function generate({ system, input, schema }, options = {}) {
    const c = config(options.env);
    const data = await request(`/models/${c.model}:generateContent`, {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: { maxOutputTokens: 4096, ...(c.model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}), responseMimeType: 'application/json', responseJsonSchema: schema },
        safetySettings: ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'].map(category => ({ category, threshold: 'BLOCK_LOW_AND_ABOVE' }))
    }, options);
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw fault('UNSAFE_OR_INCOMPLETE_RESPONSE');
    try {
        return { output: JSON.parse(candidate.content.parts.filter(p => !p.thought).map(p => p.text || '').join('')),
            evidence: { provider: c.provider, model: c.model, responseId: data.responseId || null,
                inputTokens: data.usageMetadata?.promptTokenCount || null, outputTokens: data.usageMetadata?.candidatesTokenCount || null } };
    } catch (_) { throw fault('INVALID_MODEL_JSON'); }
}
async function verifyModel(options = {}) {
    const c = config(options.env);
    const model = await request('/models/' + c.model, null, options);
    if (!model.supportedGenerationMethods?.includes('generateContent')) throw fault('MODEL_UNAVAILABLE');
    return { model: c.model, generateContentSupported: true };
}
module.exports = { config, status, generate, verifyModel, DEFAULT_MODEL };

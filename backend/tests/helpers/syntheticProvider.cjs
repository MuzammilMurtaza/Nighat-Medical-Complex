// Explicit local-only browser fixture. Never imported by application code.
if (process.env.NODE_ENV !== 'test' ||
    !/^mongodb:\/\/127\.0\.0\.1:27017\/nighat_ai_browser_test_\d+$/.test(process.env.TEST_MONGODB_URI || '') ||
    !/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SYNTHETIC_AI_ORIGIN || '')) {
    throw new Error('Synthetic transport requires an isolated local browser-test database.');
}
const realFetch = global.fetch;
global.fetch = (url, options) => {
    const target = new URL(url);
    if (target.origin !== 'https://generativelanguage.googleapis.com') throw new Error('External network is disabled in synthetic browser tests');
    return realFetch(process.env.SYNTHETIC_AI_ORIGIN + target.pathname, options);
};

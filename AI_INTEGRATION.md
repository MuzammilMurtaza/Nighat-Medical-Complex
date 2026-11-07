# Administrative AI integration - Nighat Medical Complex

Status on 6 November 2026: implementation and synthetic integration tests are complete. External AI remains DISABLED at the user's explicit request pending privacy review. Live Gemini inference and account/model access have NOT been verified. The API key is not configured in the inspected local setup. No real patient data was sent to a model, and no live model request was attempted.

## Architecture and authority

`frontend/patient/app.js` -> `POST /api/staff/chat/message` -> `staffController.handlePatientMessage` -> `conversationEngine.processConversationMessage` -> `ai/assistant.interpret` -> `ai/provider.generate` -> Gemini REST `generateContent`.

The model produces a constrained JSON response plan: intent, language, topic and up to two approved fact IDs. The backend validates every field and reference and renders the selected verified clinic facts with curated English/Urdu/Roman Urdu conversational text. This is genuine model-based semantic interpretation when enabled; it deliberately does NOT display arbitrary free-form LLM medical text. It is not an open-ended medical advice assistant. Public fact values retain their approved wording, including Latin names/qualifications and some English schedule labels.

Natural booking intent can only START the existing deterministic state machine. Patient name, phone, date, slot selection, review and confirmation bypass the model entirely. Real availability, validation, writes, conflict handling, cancellation and rescheduling remain in backend services. No LLM tools or database credentials are exposed. Normal menu/booking behavior remains available if AI is disabled, declined, unavailable or times out.

Knowledge comes from the existing verified MongoDB KnowledgeBase record for `nighat_medical_complex`, not a new hardcoded clinic profile. Dr. Khurram Mansoor keeps ID `dr-khurram`, MBBS / PGR (FCPS Gynae & Obs) / Member of PSASM, Monday-Friday 09:00-12:30 Asia/Karachi, seven-minute duration. No production knowledge or patient/appointment records were changed for this integration.

## Provider and model verification

Provider: Google Gemini Developer API. Proposed model: `gemini-3.8-flash`.

Official documentation inspected on 6 November 2026 lists this as stable and records no announced shutdown date. This verifies documentation, NOT account-level availability. The explicit verification script checks `models.get` for `generateContent` and then makes a synthetic inference; a model-metadata response alone is never treated as inference success.

- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/latest-model
- https://ai.google.dev/gemini-api/docs/deprecations
- https://ai.google.dev/gemini-api/docs/generate-content/structured-output
- https://ai.google.dev/api/models
- https://ai.google.dev/gemini-api/terms
- https://ai.google.dev/gemini-api/docs/zdr

Older `gemini-1.5-flash` configuration is replaced. No unverified fallback model or alternate provider is silently substituted.

## Configuration (backend only)

```dotenv
AI_PROVIDER=gemini
AI_MODEL=gemini-3.8-flash
AI_API_KEY=
AI_ENABLED=false
AI_PRIVACY_APPROVED=false
AI_PAID_SERVICE_CONFIRMED=false
AI_TIMEOUT_MS=6000
AI_MAX_RETRIES=1
WHATSAPP_DELIVERY_ENABLED=false
```

The real key belongs only in ignored `backend/.env` or a deployment secret manager. It must never be placed in frontend code or a public ZIP. MongoDB configuration is unchanged.

All three AI flags must be true and a key present before any external request is possible. Do not enable them until the user approves completion of the privacy review. After activation, a fresh patient chat must independently opt in to a disclosure identifying Google Gemini. Decline keeps deterministic booking available. Consent is persisted in StaffMessage with a timestamp, and can be withdrawn through the AI reply's menu option or the message `disable external ai`.

`GET /api/knowledge/ai-status` requires existing admin authentication and reports nonsecret readiness/gate information. It does not pretend to be a live inference test.

After approval and configuration, restart the backend and run:

```powershell
node backend/scripts/verifyAi.js --live-synthetic
```

The script refuses requests while disabled, checks the model, sends only a synthetic `{ok:true}` connectivity request, validates the result and saves response ID/model/token-count evidence under ignored `.qa/ai-live-evidence.json`. It exits nonzero on missing setup, authentication failure, unavailable model or invalid inference. Running it now only reports DISABLED; no success evidence file has been generated.

## Data leaving the server and privacy review

On a permitted general conversation request, Gemini receives only:

- Up to 800 characters of the current message after limited redaction of known session identities, phone-like numbers, emails, URLs, reference IDs, and common name/address introductions.
- A language hint and the previous administrative topic enum; no raw conversation history.
- A bounded allowlist of approved public clinic facts/FAQs; no internal assistant instructions, patient records or database documents.
- Administrative safety instructions and the response JSON schema.

No session ID, patient object, booking workflow fields, MongoDB credentials, uploads, history transcript or appointment record is sent. AI routing never runs during an active booking/manage workflow. Local medical/privacy/injection checks bypass the provider for recognized sensitive requests. Redaction is heuristic, NOT a guarantee of anonymization: a patient could type an unrecognized name or health detail into general chat. The disclosure explicitly warns against this.

Operator review must cover applicable patient privacy requirements, processing terms, service region/retention, paid-service data use, logging/sharing settings, consent wording and retention, and who can approve public clinic knowledge. Do not use unpaid AI processing for patient-sensitive content. Review Google's current terms directly; the integration is administrative only, not diagnosis, prescribing or clinical practice. No legal or clinical compliance certification is claimed.

Important inherited limitation: legacy public appointment search/management endpoints still use phone/reference lookups rather than a complete patient login/OTP authorization system. The model has no access to those APIs or their records, but a broader patient-authorization and deployment-security review remains required before public exposure. This task does not claim the entire pre-existing application is production-security certified. Phone-based chat-history recovery was removed; private session tokens now scope history and new session tokens use cryptographic randomness. Existing stored session tokens remain compatible and should be treated as bearer secrets.

## Reliability and safety

- Fixed Google HTTPS origin; credentials sent via `x-goog-api-key`, never a URL query string.
- Gemini 3 request configuration uses LOW thinking with a bounded 4096-token response budget; deprecated temperature sampling is omitted.
- Structured response schema plus independent runtime validation. Unrecognized fields, intents, fact IDs and attempted arbitrary output are rejected.
- No model-driven execution, patient-record retrieval or booking confirmation.
- Curated local medical refusal/emergency/handover messages and verified fact rendering.
- Per-request timeout 6 seconds by default, configurable up to 8 seconds; maximum total provider request budget 12 seconds; at most one retry for 429/5xx only.
- Authentication/model errors are not retried. Two concurrent provider calls per backend process; circuit opens for 30 seconds after repeated failures.
- Public chat POST rate limited to 30 requests/minute per IP. Multi-instance rate/circuit coordination would require shared infrastructure.
- No raw prompts, provider bodies, keys or patient details are logged by the adapter. Message metadata stores only source/provider/model/response ID/token counts and topic.
- Known existing classic-script build warnings and a duplicate Mongoose index warning remain unrelated to inference.

## WhatsApp and webhooks

WhatsApp intake uses the shared conversation engine, gates and consent flow. Interactive IDs from button/list responses now reach `processConversationMessage` as `payload`. Outbound option metadata is also retained so interactive replies can be formatted correctly.

Webhook POSTs now require an exact raw-body HMAC-SHA256 signature in `X-Hub-Signature-256`, validated with timing-safe comparison. Missing/placeholder secrets, missing/malformed signatures and altered bodies fail closed with 403. Raw bytes are captured before JSON parsing. Verification challenge tokens must be explicitly configured; submitted verification tokens are no longer logged. The lead simulator now requires admin authentication.

Outbound delivery remains disabled. Real Meta app secret, verify token, access token and phone-number ID, HTTPS webhook setup and explicit `WHATSAPP_DELIVERY_ENABLED=true` are required. No WhatsApp message was sent during testing. Existing in-memory duplicate-event handling is not a durable multi-instance delivery guarantee; a queue/durable event ledger is a future deployment consideration.

## Tests and evidence

```powershell
node backend/tests/test_ai_integration.js
node backend/tests/test_khurram_booking.js
node backend/tests/test_nighat_knowledge.js
node backend/tests/test_ai_browser.cjs
npm.cmd run build --prefix frontend
```

The AI integration suite uses an isolated local database and a real local HTTP server returning synthetic model responses. It tests serialization/auth headers/schema, minimization, invalid outputs, injection/medical/private guards, consent, English/Urdu/Roman Urdu plans, natural booking intent followed by actual MongoDB confirmation, WhatsApp payload/options, HMAC HTTP rejection/acceptance, bounded retries, authentication errors, timeouts and circuit breaking. These synthetic tests do NOT prove model quality or successful inference from Google.

Chrome testing uses a test-only preload that refuses nonlocal database configurations and redirects only the fixed Google API origin to a local synthetic transport. It tests consent, follow-ups, multilingual responses, real slot availability and booking persistence, privacy checks, private chat-history recovery, four viewport widths and zero runtime errors. Evidence: `.qa/ai-browser-results.json`.

The pre-existing browser suite also checks English/Urdu booking, admin rescheduling/cancellation, refresh persistence and seven screen widths with external AI disabled. All booking tests create synthetic records only in isolated local databases and remove those databases afterward.

## Current outcome / remaining setup

Implemented and locally tested, with external AI intentionally OFF. No live inference succeeded or was attempted. Remaining: approved privacy review, a valid key for a supported paid-service project, explicit activation, successful synthetic live inference, real-model language/intent evaluation and a signed Meta sandbox delivery test. Keep public WhatsApp delivery disabled until those checks and the broader patient authorization review are complete.

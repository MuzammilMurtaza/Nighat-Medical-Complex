# Atlas configuration and Nighat knowledge-base implementation

> Update, 5 November 2026: Dr. Khurram and the verified consultation schedule are now active. See [KHURRAM_BOOKING_RESULTS.md](KHURRAM_BOOKING_RESULTS.md) for the current booking implementation and tests. The unconfigured state described below records the earlier migration phase.

The running backend on port 5000 now connects to MongoDB Atlas database `nighat_medical_complex`. The patient website remains at http://localhost:5005/patient/index.html. No CSS, colors, fonts, animations, or page layout styles were changed.

## Database results

- Preserved the existing `MONGODB_URI` environment-variable name. The credential-bearing URI exists only in the ignored `backend/.env`; the password is URL-encoded locally. `.env.example` contains a placeholder, not a password.
- Environment loading resolves the backend `.env` by absolute module location, including when launched from the outer project directory.
- Removed the implicit local database fallback. An unavailable Atlas connection produces a degraded state and retry; booking cannot report success from temporary memory.
- Verified Atlas connection and target database, ping, isolated insert/read/update/delete, a fresh connection, and indexes for all 15 Mongoose models. Verification records were deleted. The empty `_connection_verification` collection may remain.
- Atlas read, write, update, delete, and index permissions are sufficient for the operations tested from this machine. The Atlas management console's user-role scope and network-allowlist scope were not independently audited.
- Backed up the accessible legacy local `mza_clinic_db`: 14 collections, 246 documents, in ignored `.migration-backup/legacy-database-*/` BSON files and a manifest. This is a local collection snapshot; no old records or databases were deleted.
- No historical patient, appointment, conversation, lead, or admin records were copied into Atlas. Migration needs explicit authorization and an organization/data-mapping decision. The new admin dashboard therefore does not automatically show historical local bookings.
- Local integration tests require an explicitly isolated test database. Test mode is an explicit override, not a runtime fallback from Atlas.

Connection-string reference: [MongoDB official URI documentation](https://www.mongodb.com/docs/manual/reference/connection-string/).

## Centralized knowledge and approvals

`backend/models/KnowledgeBase.js` and `backend/services/knowledgeService.js` define the new organization independently of historical clinic configuration. The new settings document contains Nighat Medical Complex identity, with location, contact, schedule, doctors, services and fees unverified or empty.

The existing admin dashboard has a **Knowledge Base** entry. Its editor uses the existing dashboard styles and saves through authorized `GET/PUT /api/knowledge/admin`. Weekly Working Hours opens this same editor. Set verification flags only after confirming the information. Public `GET /api/knowledge` filters unverified facts and omits internal assistant instructions.

Website chat and WhatsApp leads now use the same conversation engine, knowledge service, slot service and booking service. Removed duplicate legacy lead-answer and booking fallbacks. Approved changes are read for new messages without retraining. Facts and approved FAQs are served directly; the optional free-form generative fallback is disabled to avoid inventing clinic facts. Baseline safety instructions are centralized in `knowledgeService.js`; free-text admin instruction notes are stored, but are not executed as model instructions by this deterministic engine.

English and Urdu greetings represent Nighat Medical Complex. Roman Urdu input remains supported. Unknown facts offer staff assistance. Emergency messages direct patients to immediate professional care rather than inventing a clinic emergency number or capability. The assistant does not diagnose or prescribe.

The existing form, chat, staff lead-booking tools, and WhatsApp confirmations share persisted booking creation. Slots derive from approved operating hours plus existing off-day, special-schedule, blocked-slot, and booked-slot records. No previous clinic schedule is assumed. Historical doctor names and source records remain intact; the old static admin profile is explicitly labelled historical and is not advertised as current Nighat staff.

## Actual tests

Passed:

- Atlas CRUD/cleanup, all model indexes, and fresh-connection verification via `node backend/scripts/verifyDatabase.js`.
- 11 isolated backend integration groups via `node backend/tests/test_nighat_knowledge.js`: safe defaults, multilingual greetings, unknown facts, unconfigured booking, approved updates, configured slots/blocking, duplicate prevention/idempotency, complete AI booking persistence, emergency handling/handover/WhatsApp formatting, disconnected booking failure, and reconnection to the explicit test database.
- Real Chrome browser on `http://localhost:5005/patient/index.html`: the **Hi** reply said **Welcome to Nighat Medical Complex!** using Atlas; Urdu and Roman Urdu, unknown-fee handling, refresh/session persistence, typing cleanup, no old clinic facts, mobile overflow check, admin knowledge authorization, and no JavaScript runtime errors.
- Separate local database/browser test: authorized admin knowledge editing, form booking persisted to MongoDB, booking displayed in the admin appointment table, and a real 20-second stalled request clearing typing and offering retry. The isolated test database was cleaned up.
- JavaScript syntax checks: 65 files, zero failures. Production Vite build passed; existing classic-script notices remain covered by the existing script-copy plugin.
- Credential scan: no database credentials found in application source or build output.

No synthetic patient or appointment documents were created in Atlas. Production booking confirmation cannot be truthfully tested until real doctor and schedule information is approved. Existing chat interactions used for the requested live greeting checks are stored in Atlas conversations.

Browser runners are retained locally in ignored `.migration-work/browser-atlas.cjs` and `.migration-work/browser-isolated.cjs`. A mobile screenshot is `.qa/atlas-patient-mobile.png`. Live external WhatsApp message delivery was not exercised; its shared engine and payload compatibility were tested.

## Information still needed

Supply and approve:

1. Official address, city, and map link.
2. Official telephone, WhatsApp, and email.
3. Operating days, opening/closing times, and appointment interval.
4. Actual doctor names, specialties, qualifications, and any fees.
5. Available services and departments, with approved descriptions.
6. Consultation fee policy/currency and booking/arrival/cancellation policies.
7. Approved FAQs and any assistant style requirements.
8. Explicit scope and authorization for any historical-data migration.

**Live booking intentionally remains unavailable until at least a provider and operating schedule are approved.** The current schema still uses the existing shared appointment calendar; separate calendars for multiple doctors would require additional backend design.

## Modified files

- `.gitignore`
- `backend/.env` (local and ignored), `backend/.env.example`
- `backend/config/database.js`, `backend/config/environment.js` (new)
- `backend/server.js`
- `backend/models/KnowledgeBase.js` (new), `Admin.js`, `Appointment.js`, `Clinic.js`
- `backend/routes/knowledgeRoutes.js` (new)
- `backend/services/knowledgeService.js` (new), `bookingService.js`, `conversationEngine.js`, `leadAiService.js`, `leadFollowUpService.js`, `metaWebhookService.js`
- `backend/controllers/adminController.js`, `appointmentController.js`, `clinicController.js`, `leadController.js`, `staffController.js`, `treatmentController.js`
- `backend/middleware/authMiddleware.js`, `errorHandler.js`
- `backend/utils/slotGenerator.js`
- `backend/scripts/verifyDatabase.js` (new)
- `backend/tests/test_nighat_knowledge.js` (new), `test_whatsapp_style_conversation_engine.js`, `redesign-legacy.cjs` (legacy test database fallbacks removed)
- `frontend/admin/admin.html`, `frontend/admin/admin.js`
- `frontend/patient/index.html`, `frontend/patient/app.js`, `frontend/patient/premium.js`

Additional source snapshots are retained under ignored `.migration-backup/source/`. The original legacy database and backups are preserved.

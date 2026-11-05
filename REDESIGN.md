# Nighat Medical Complex — implementation and QA

Implemented directly in the existing frontend and Express/MongoDB project. No framework migration, production dependency additions, or database schema changes.

## What changed

- Patient landing page: responsive navigation, hero with an original SVG medical illustration, backend service directory, patient experience section, preserved doctor profile, booking form, clinic contact information, enquiry form and floating AI concierge.
- Reusable navy/emerald/teal tokens, responsive typography, reduced-motion support, keyboard focus styles, mobile navigation and full-screen mobile chat.
- Primary facility and assistant branding updated. Dr. Muhammad Zaheer Anjum’s identity and existing credentials remain intact. No Dr Nighat doctor identity, staff photograph, facility claims or numerical statistics were invented.
- Services and contact details load from the existing admin-managed APIs. When unavailable, the interface offers recovery rather than inventing data. A neutral silhouette marks the missing verified doctor photograph.
- Existing patient session storage, conversational engine, uploads, emergency handling, appointment management and staff handover retained.
- Both traditional booking and conversation/WhatsApp confirmation call `backend/services/bookingService.js`. It validates current availability, normalizes slot formatting, serializes writes within the Express process and makes repeated identical confirmations idempotent.
- Bookings require MongoDB persistence. Database outages return a recoverable error instead of a success card backed only by temporary memory. Form, legacy chat booking and rescheduling no longer invent slots after API failures. Conversation availability also fails explicitly when unavailable.
- Administrative collection endpoints now require the existing admin token. Dashboard fetches attach it consistently, and protected report downloads use authenticated requests.
- Local SVG icons remove the external icon script dependency. Vite retains the existing classic scripts in production output so inline-handler compatibility is preserved.

## Changed source files

Frontend:
- `frontend/index.html`
- `frontend/patient/index.html`
- `frontend/patient/app.js`
- `frontend/patient/premium.css` (new)
- `frontend/patient/premium.js` (new)
- `frontend/patient/icons.js` (new)
- `frontend/admin/admin.html`
- `frontend/admin/login.html`
- `frontend/admin/admin.js`
- `frontend/admin/admin.css`
- `frontend/vite.config.js`

Backend:
- `backend/services/bookingService.js` (new)
- `backend/services/conversationEngine.js`
- `backend/controllers/appointmentController.js`
- `backend/routes/appointmentRoutes.js`
- `backend/routes/patientRoutes.js`
- `backend/routes/reportRoutes.js`
- `backend/routes/staffRoutes.js`
- `backend/routes/consultationRoutes.js`
- `backend/routes/dashboardRoutes.js`
- `backend/routes/clinicRoutes.js`
- `backend/routes/treatmentRoutes.js`

## Actual verification

Chrome browser tests used a separate Express instance on port 5001 and the isolated MongoDB database `nighat_redesign_qa`. Production patient records were not used for testing.

Passed:
- Production Vite build and JavaScript syntax checks. Vite notes that classic scripts are not bundled; the explicit copy plugin includes those scripts in `dist`.
- Responsive browser checks and full-page screenshots at 320, 375, 390, 768, 1024, 1440 and 1920 pixels; no horizontal overflow.
- Mobile navigation, backend service expansion and preserved doctor profile.
- English, Urdu and Roman Urdu chat responses; reply to Hi; session identity and conversation retention after reload.
- API-error recovery and a real 20-second chat timeout: typing stops, composer re-enables and retry is offered.
- Failed availability requests show retry, with no invented selectable slots.
- Traditional form booking persisted to MongoDB; protected admin API returned the saved record.
- Complete AI booking persisted through the shared service, disappeared from form availability, and rejected a competing form booking.
- Concurrent competing booking requests returned one 201 and one 409.
- Actual admin dashboard appointment table displayed test bookings.
- Contact enquiry form recorded an existing staff handover request.
- Administrative record collections returned 401 without an admin token.
- No JavaScript runtime errors during the main browser suite; local page assets loaded successfully and local control icons rendered.
- All 25 existing WhatsApp-style conversation regression scenarios passed, including rescheduling, cancellation, emergency handling, staff handover, repeated confirmation and channel consistency. The isolated runner is `backend/tests/redesign-legacy.cjs`.

Browser runners: `qa-e2e.cjs`, `qa-integration.cjs`, `qa-recovery.cjs`, `qa-assets.cjs`.
Artifacts: `.qa/results.json`, `.qa/width-*.png`, `.qa/desktop-hero.png`, `.qa/mobile-hero.png`, `.qa/chat-mobile.png`, `.qa/admin-appointments.png`.

## Operating notes and limits

- Source backups are in `.redesign-backup/`; the supplied project had no Git repository.
- Restart the existing backend on port 5000 to load changed route protection and booking services. The usual frontend remains at http://localhost:5005/patient/index.html. From the outer workspace, use `npm.cmd run start:backend` after stopping the previous backend process.
- The QA database is separate and retains test records. QA tooling dependencies are under `.qa`, outside production package manifests.
- Browser testing used desktop Chrome with responsive viewport sizes; physical iPhone/Android devices and live external WhatsApp delivery were not tested.
- Existing contact details and doctor credentials are preserved source records, not independently reverified real-world information. Updated facility/staff information still needs to be supplied through existing settings or source configuration.
- Write serialization covers this Express process. Multiple backend workers would require a database-level reservation/uniqueness migration to guarantee cross-worker concurrency; no schema migration was applied.
- Existing patient appointment lookup/management contracts and development authentication configuration remain. The administrative route checks are not a claim of a complete security audit.

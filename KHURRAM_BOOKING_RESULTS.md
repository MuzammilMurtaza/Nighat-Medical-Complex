# Dr. Khurram appointment booking — implementation and verification

Completed in the existing Nighat Medical Complex project on 5 November 2026. The website, styling, fonts, colors, animations and responsive layouts were retained.

## Live Atlas configuration

The existing secured backend environment connects to `nighat_medical_complex`. Dr. Khurram is represented by one approved embedded doctor profile in the existing knowledge-base document, with stable identifier `dr-khurram`. No separate conflicting doctor collection was introduced. The activation script validates and saves the schedule and active profile together, preserves unrelated doctor profiles, and is duplicate-safe.

Verified configuration:

- Doctor: **Dr. Khurram**; active and verified.
- Specialty: unspecified; no specialist designation or qualifications invented.
- In-person appointments, Monday–Saturday, **10:00–18:00**, Asia/Karachi.
- Sunday closed. Duration **20 minutes**. Capacity **one appointment per slot**, 24 theoretical slots per standard day, from 10:00 AM through 5:40 PM.
- Fee, official phone, address, contact information and photograph remain unverified or absent.

Actual Atlas configuration output confirmed exactly one matching profile and no patient records modified. The running backend uses the new integration. On the live website at http://localhost:5005/patient/index.html, the doctor card and booking selector display Dr. Khurram, a future standard day returns 24 real backend-generated slots, and clicking **Book Appointment** starts his name/phone/date/time conversation.

## Booking and availability

- Form, website chat, WhatsApp channel, and staff lead-booking actions share the same MongoDB-backed booking service.
- Slots reflect verified hours, duration, holidays/doctor leave, blocked times, weekly breaks, special-date overrides, previously booked intervals, and elapsed Asia/Karachi times. A slot must finish inside its configured closing time. Cancelled slots are released; rescheduling rechecks availability.
- New appointment documents store doctor identifier and name, duration, patient reference, actual appointment ID and token, date/time and source (`website_form`, `website_chat`, `whatsapp`, or `admin_lead`). Historical records are not rewritten.
- A partial unique MongoDB index prevents duplicate active bookings for the same doctor/date/time. Separate Node processes were tested against that constraint. Existing historical documents without doctor references are left unchanged. The constraint uses MongoDB's documented [partial unique index behavior](https://www.mongodb.com/docs/manual/core/index-partial/).
- MongoDB counters allocate appointment IDs and tokens atomically. Repeated identical confirmations return the existing saved booking. Previews do not allocate fake tokens.
- Every slot page is accessible through Earlier/More time buttons while respecting WhatsApp's menu-size limit.
- Patients can type dates such as **Tomorrow** or choose buttons. The old disabled date composer was fixed. Language selection now persists correctly through the booking conversation and refresh.
- Expired form selections return a recoverable conflict and refresh actual availability. Confirmation cards use real saved details and call the provider **Doctor**, not Specialist.

## Admin controls

The existing Doctor Management and Knowledge Base screens let authorized staff view Dr. Khurram and edit specialty, active status, verified schedule, slot duration, and `schedule.bookingEnabled`. Weekly breaks are configured per day as `breaks: [{"start":"13:00","end":"13:20"}]`; these affect actual availability.

Existing off-day, blocked-time and special-schedule tools remain available. Blocked times now accept 20-minute appointment times instead of the old fixed half-hour list. Administrative schedule writes fail when persistence fails. The appointment table identifies doctor and booking source, and has working reschedule and cancel actions using the same backend scheduling rules.

`node backend/scripts/configureKhurram.js` explicitly reapplies the verified brief's schedule. Do not run that setup command after making intentional different schedule changes unless you want to reapply these baseline hours. Normal application startup does not run it or reset staff edits.

## Actual test results

Passed:

1. `node backend/tests/test_khurram_booking.js`: **11 backend integration groups** using a separate local MongoDB database. These cover duplicate-safe activation and preservation of unrelated profiles, all six consultation days, Sunday closure, exact 20-minute grid and 24-slot capacity, closing bounds, elapsed times, breaks/holidays/blocks/overrides, patient/doctor references and sources, idempotency, a two-process booking race, cancellation/rescheduling, English/Urdu/Roman Urdu initiation, actual AI booking persistence and pagination, Tomorrow in Asia/Karachi, WhatsApp source persistence, and admin schedule/booking-disable changes.
2. `node backend/tests/test_nighat_knowledge.js`: **11 existing knowledge/safety integration groups** still pass, including unverified-fact handling, multilingual greetings, emergency/staff handling and database reconnection.
3. Actual Chrome browser against a separate MongoDB-backed instance: **7 browser groups** passed. A deliberately stale form selection recovered from a real 409 conflict; the form and English/Urdu chat saved bookings; both channels shared availability; all slot pages worked; refresh retained the saved conversation; admin displayed source and provider, rescheduled a saved booking and cancelled it. All seven widths (320, 375, 390, 768, 1024, 1440, 1920) had no page overflow and no JavaScript runtime errors.
4. A real stalled chat request timed out after 20 seconds, removed typing, re-enabled the composer, and successfully recovered using its retry button and real backend.
5. Live Atlas/browser preflight at http://localhost:5005/patient/index.html confirmed Dr. Khurram, the correct real slots, and the actual Book Appointment conversation start, with no runtime errors. It stopped before entering test patient details.
6. JavaScript syntax verification: **69 files, zero failures**. Production Vite build passed. Credential scan passed; no environment credentials were copied into frontend code or build output.

No test patient or appointment documents were written to the production Atlas database. Complete booking-write tests used explicitly isolated databases, which were cleaned up. Live external WhatsApp delivery was not sent; shared-engine booking, saved channel provenance and adapter compatibility were verified.

Local browser artifacts: `.qa/khurram-browser-results.json`, `.qa/dr-khurram-live.png`. Browser runners are retained in ignored `.booking-work/`.

## Modified files

- `.gitignore`
- `backend/models/KnowledgeBase.js`, `backend/models/Appointment.js`
- `backend/models/BookingCounter.js` (new)
- `backend/services/configureKhurram.js` (new)
- `backend/scripts/configureKhurram.js` (new)
- `backend/services/knowledgeService.js`, `backend/services/bookingService.js`, `backend/services/conversationEngine.js`
- `backend/utils/slotGenerator.js`, `backend/utils/appointmentIdGenerator.js`, `backend/utils/tokenGenerator.js`
- `backend/controllers/appointmentController.js`, `backend/controllers/clinicController.js`
- `frontend/patient/app.js`, `frontend/patient/premium.js`
- `frontend/admin/admin.js`
- `backend/tests/test_khurram_booking.js` (new)
- `MIGRATION_AND_KNOWLEDGE.md` (migration-state note updated)

Source snapshots before this task are preserved in ignored `.migration-backup/khurram-source/`. No database credentials were changed or printed.

## Remaining clinic information

Booking is now enabled. Still needed for factual informational responses: verified specialty/qualifications, consultation fee and currency, official clinic address/map, official contact/WhatsApp/email, and a verified doctor photograph if desired. These are optional informational fields, not fabricated booking prerequisites.

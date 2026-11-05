# Dr. Khurram Mansoor: verified profile and seven-minute schedule

Updated 5 November 2026. This report supersedes the former 20-minute schedule in KHURRAM_BOOKING_RESULTS.md.

- Existing Atlas database: `nighat_medical_complex`; connection verified after backend restart.
- Stable doctor ID: `dr-khurram`; exactly one matching approved doctor record.
- Name: Dr. Khurram Mansoor.
- Credentials: MBBS | PGR (FCPS Gynae & Obs) | Member of PSASM.
- Clinical area explicitly described as Gynaecology and Obstetrics (postgraduate training), without claiming completed FCPS or consultant/specialist status.
- Monday-Friday: 09:00-12:30, Asia/Karachi. Saturday and Sunday closed.
- Duration: 7 minutes; 30 theoretical daily slots, 09:00 through 12:23. Last appointment ends at 12:30.

Availability uses the verified weekly grid and excludes past times, stored appointment intervals, holidays/leave, blocked times and breaks. Overrides can restrict hours and slots; they cannot reopen a closed weekday or extend the verified daily grid. Historical appointment durations still reserve their full original interval.

Two existing Atlas appointments were flagged for administrator review. No original appointment date, time, duration, status or historical doctor-name snapshot was changed. The admin appointment table displays ADMIN REVIEW REQUIRED for flagged records. Authorized rescheduling to a valid slot clears the flag. No production test appointments or patient records were created.

The booking form displays the full name and credentials, schedule and duration. Selecting a closed day disables confirmation and shows an explanation, with no offered slots. Native date-input popups still render weekend dates; closed dates are rejected through form validation and again by the backend. The existing visual design and styles were preserved.

The chatbot reads the same verified profile and schedule, answers availability and qualification questions, includes hours when requesting a booking date, and persists bookings only on confirmation. Existing WhatsApp adapter behavior was preserved and its booking source was tested locally; no outbound WhatsApp messages were sent.

Validation completed:
- 13 isolated backend booking test groups, including 30-slot boundaries, weekends even with overrides, profile idempotency, conflicting-history preservation, duplicate protection across separate processes, booking retries, cancellation/rescheduling, English/Urdu/Roman Urdu starts and persisted chat/WhatsApp-source bookings.
- 11 existing knowledge and booking regression groups.
- Chrome integration checks: form collision recovery and real booking, English/Urdu chat booking and pagination, refresh persistence, admin rescheduling/cancellation, seven viewport widths and zero JavaScript errors.
- Live Atlas-backed browser check: approved name/credentials, 30 returned slots (09:00 through 12:23), rejected weekend selection and actual chatbot booking start. No fake production booking was confirmed.
- Frontend production build passes; existing classic-script bundling warnings remain.

Changed source files:
- backend/services/configureKhurram.js
- backend/scripts/configureKhurram.js
- backend/models/Appointment.js
- backend/utils/slotGenerator.js
- backend/services/bookingService.js
- backend/services/knowledgeService.js
- backend/services/conversationEngine.js
- backend/tests/test_khurram_booking.js
- frontend/patient/premium.js
- frontend/admin/admin.js

Running locally: backend port 5000; frontend http://127.0.0.1:5005/patient/index.html.
Admin follow-up: review the two flagged original appointments with the patients before making any changes. Their original reservations remain in force until an authorized cancellation or reschedule.

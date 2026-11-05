/* Presentation layer. Existing app.js owns conversations and patient sessions. */
(() => {
  const $ = (id) => document.getElementById(id);
  const panel = $('concierge');
  let previousFocus;
  function openChat(language) {
    previousFocus = document.activeElement;
    panel.hidden = false;
    document.querySelector('.chat-launcher').setAttribute('aria-expanded', 'true');
    if (matchMedia('(max-width: 767px)').matches) document.body.style.overflow = 'hidden';
    if (language && typeof selectLanguage === 'function') selectLanguage(language);
    $('messageInput').focus({ preventScroll: true });
  }
  function closeChat() {
    panel.hidden = true;
    document.body.style.overflow = '';
    document.querySelector('.chat-launcher').setAttribute('aria-expanded', 'false');
    previousFocus?.focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-open-chat]').forEach(button => button.addEventListener('click', () => openChat(button.dataset.chatLanguage)));
  document.querySelector('.chat-close').addEventListener('click', closeChat);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeChat();
    if (event.key === 'Tab' && matchMedia('(max-width: 767px)').matches) {
      const elements = [...panel.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')].filter(el => el.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  $('navToggle').addEventListener('click', () => {
    const open = $('navigation').classList.toggle('open');
    $('navToggle').setAttribute('aria-expanded', String(open));
  });
  $('navigation').querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    $('navigation').classList.remove('open');
    $('navToggle').setAttribute('aria-expanded', 'false');
  }));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) document.querySelectorAll('#navigation a').forEach(a => a.classList.toggle('active', a.hash === '#' + entry.target.id));
    }), { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
    document.querySelectorAll('main section[id]').forEach(section => observer.observe(section));
  }
  $('copyrightYear').textContent = new Date().getFullYear();
  $('viewDoctor').addEventListener('click', () => { openChat(); sendPatientMessageToBackend('Doctor profile'); });
  $('contactStaff').addEventListener('click', () => { openChat(); document.querySelector('[data-action="speakToStaff"]').click(); });
  async function request(url, options = {}) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok || !result.success) throw Object.assign(new Error(result.message || 'The clinic service is unavailable. Please try again.'), { status: response.status });
    return result.data;
  }
  let clinic, approvedKnowledge;
  async function loadClinic() {
    try {
      approvedKnowledge = await request('/api/knowledge');
      clinic = { name: approvedKnowledge.organization.name, city: approvedKnowledge.location.city, address: approvedKnowledge.location.address, phone: approvedKnowledge.contact.phone, weeklySchedule: approvedKnowledge.schedule.weekly };
      const provider = approvedKnowledge.doctors.find(d => d.id === approvedKnowledge.schedule.doctorId) || approvedKnowledge.doctors[0];
      $('providerName').textContent = provider?.name || 'Doctor details not yet verified';
      $('providerSpecialty').textContent = provider ? (provider.specialty || 'Specialty information is currently being updated.') : 'Please contact clinic staff for assistance.';
      $('providerQualifications').textContent = provider ? (provider.qualifications || []).join(' · ') : '';
      const select = document.querySelector('#bookingForm select[name="doctor"]'); select.replaceChildren();
      const option = document.createElement('option'); option.value = provider?.id || ''; option.textContent = provider ? provider.name + ' | ' + (provider.qualifications || []).slice(0,2).join(' | ') : 'Doctor details not yet verified'; select.append(option);
      if (typeof CONFIG !== 'undefined') Object.assign(CONFIG.doctor, { name: provider?.name || 'Doctor not yet verified', specialty: provider?.specialty || '' });
      $('clinicAddress').textContent = clinic.address || 'Please contact clinic staff for the current address.';
      const phone = $('clinicPhone');
      phone.textContent = clinic.phone || 'Contact clinic staff';
      if (clinic.phone) phone.href = 'tel:' + clinic.phone.replace(/[^+\d]/g, '');
      const directions = $('clinicDirections');
      if (clinic.address) directions.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(clinic.address);
      const hours = $('clinicHours'); hours.replaceChildren();
      for (const [day, schedule] of Object.entries(clinic.weeklySchedule || {})) {
        const row = document.createElement('p');
        row.textContent = `${day[0].toUpperCase() + day.slice(1)}: ${schedule.active ? schedule.open + ' – ' + schedule.close : 'Closed'}`;
        hours.append(row);
      }
      if (!hours.childElementCount) hours.textContent = 'Confirm current hours with clinic staff.';
      $('doctorAvailability').textContent = approvedKnowledge.schedule.verified && approvedKnowledge.doctors.length ? `${provider?.name}: ${(provider?.qualifications || []).join(' | ')}. ${Object.entries(clinic.weeklySchedule || {}).map(([day,s]) => day + ': ' + (s.active ? s.open + '-' + s.close : 'Closed')).join('; ')}. ${approvedKnowledge.schedule.slotMinutes}-minute appointments. Select a date for live availability.` : 'Consultation availability has not yet been verified.';
      $('bookingSummary').textContent = $('doctorAvailability').textContent;
      // Keep existing assistant contact utilities in sync with admin-configured records.
      if (typeof CONFIG !== 'undefined') Object.assign(CONFIG.clinic, { name: clinic.name, city: clinic.city, address: clinic.address, phone: clinic.phone });
    } catch (error) {
      $('clinicAddress').textContent = 'Clinic details are temporarily unavailable.';
      $('clinicPhone').textContent = 'Please retry or contact clinic staff.';
      $('clinicHours').textContent = 'Hours could not be loaded.';
      const retry = document.createElement('button'); retry.className = 'text-link'; retry.type = 'button'; retry.textContent = 'Retry clinic details →'; retry.onclick = () => { retry.remove(); loadClinic(); };
      $('clinicHours').append(retry);
    }
  }
  async function loadServices() {
    const container = $('serviceCards');
    try {
      const services = await request('/api/treatments');
      if (!Array.isArray(services)) throw new Error('Invalid services response');
      container.replaceChildren();
      const available = services.filter(service => service.active !== false);
      available.forEach((service, index) => {
        const card = document.createElement('article'); card.className = 'service-card'; if (index >= 6) card.hidden = true;
        const number = document.createElement('span'); number.className = 'service-number'; number.textContent = String(index + 1).padStart(2, '0');
        const icon = document.createElement('span'); icon.className = 'round-icon'; icon.textContent = ['♡', '✚', '⌁'][index % 3]; icon.setAttribute('aria-hidden', 'true');
        const title = document.createElement('h3'); title.textContent = service.title;
        const description = document.createElement('p'); description.textContent = service.description;
        const action = document.createElement('button'); action.className = 'text-link'; action.type = 'button'; action.textContent = 'Learn More →';
        action.addEventListener('click', () => { openChat(); addUserMessage('Tell me about ' + service.title); sendPatientMessageToBackend('Tell me about ' + service.title); });
        card.append(number, icon, title, description, action); container.append(card);
      });
      if (available.length > 6) {
        const more = document.createElement('button'); more.type = 'button'; more.className = 'text-link all-services'; more.textContent = 'Explore all services →'; more.setAttribute('aria-expanded', 'false');
        more.onclick = () => { const expanded = more.getAttribute('aria-expanded') === 'true'; container.querySelectorAll('.service-card').forEach((card, index) => { if (index >= 6) card.hidden = expanded; }); more.setAttribute('aria-expanded', String(!expanded)); more.textContent = expanded ? 'Explore all services →' : 'Show fewer services ↑'; };
        container.append(more);
      }
      if (!available.length) container.textContent = 'Please ask clinic staff about currently available services.';
    } catch (error) {
      container.replaceChildren(); const message = document.createElement('p'); message.className = 'loading-state'; message.textContent = 'Services could not be loaded. ';
      const retry = document.createElement('button'); retry.className = 'text-link'; retry.type = 'button'; retry.textContent = 'Retry →'; retry.onclick = loadServices; message.append(retry); container.append(message);
    }
  }
  const form = $('bookingForm'), dateInput = form.elements.date;
  dateInput.min = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  let selectedTime = '', sequence = 0, submitting = false, completed = false;
  let lastBookingKey = '';
  async function loadSlots() {
    const current = ++sequence;
    selectedTime = ''; $('confirmBooking').disabled = true;
    $('bookingSummary').textContent = 'Review your selected date and time before confirming.';
    $('bookingSlots').textContent = 'Checking current availability…';
    if (!dateInput.value) { $('bookingSlots').textContent = 'Select a date to check availability.'; return; }
    dateInput.setCustomValidity('');
    const day = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(dateInput.value + 'T00:00:00Z').getUTCDay()];
    if (clinic?.weeklySchedule?.[day]?.active === false) { dateInput.setCustomValidity('The doctor is unavailable on this day. Please choose an open weekday.'); $('bookingSlots').textContent = dateInput.validationMessage; return; }
    try {
      const data = await request('/api/appointments/slots?date=' + encodeURIComponent(dateInput.value) + '&doctorId=' + encodeURIComponent(form.elements.doctor.value));
      if (current !== sequence) return;
      if (!Array.isArray(data.slots)) throw new Error('Invalid availability response');
      $('bookingSlots').replaceChildren();
      if (!data.slots.length) $('bookingSlots').textContent = data.reason || 'No times are available. Please choose another date.';
      data.slots.forEach(time => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = time; button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          selectedTime = time;
          $('bookingSlots').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
          $('bookingSummary').textContent = `${form.elements.doctor.selectedOptions[0]?.textContent || 'Care provider'} · ${dateInput.value} · ${time}${clinic?.name ? ' · ' + clinic.name : ''}`;
          $('confirmBooking').disabled = submitting || completed;
        });
        $('bookingSlots').append(button);
      });
    } catch (error) {
      if (current !== sequence) return;
      $('bookingSlots').textContent = 'Unable to load available times. ';
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry'; retry.onclick = loadSlots; $('bookingSlots').append(retry);
    }
  }
  dateInput.addEventListener('change', () => { if (!completed) loadSlots(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || completed || !selectedTime || !form.reportValidity()) return;
    submitting = true; $('confirmBooking').disabled = true; $('confirmBooking').textContent = 'Confirming…'; $('bookingStatus').textContent = '';
    try {
      if (!clinic) { await loadClinic(); if (!clinic) throw new Error('Clinic details could not be verified. Please retry.'); }
      const payload = { doctorId: form.elements.doctor.value, source: 'website_form', patientName: form.elements.patientName.value.trim(), phone: form.elements.phone.value.trim(), appointmentType: 'In-Person Appointment', clinic: clinic.name, city: clinic.city, date: dateInput.value, time: selectedTime };
      const bookingKey = JSON.stringify(payload);
      if (lastBookingKey === bookingKey) throw new Error('This booking has already been confirmed.');
      const result = await request('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      lastBookingKey = bookingKey; completed = true;
      $('bookingStatus').textContent = `Appointment confirmed. Reference: ${result.appointmentId}. Token: ${result.tokenNumber}. ${payload.date}, ${payload.time}. Please save these details.`;
      $('confirmBooking').textContent = 'Appointment confirmed ✓';
      [...form.elements].forEach(el => { el.disabled = true; });
      const again = document.createElement('button'); again.type = 'button'; again.className = 'text-link'; again.textContent = 'Book another appointment →';
      again.onclick = () => { completed = false; form.reset(); [...form.elements].forEach(el => { el.disabled = false; }); $('confirmBooking').disabled = true; $('confirmBooking').textContent = 'Confirm Appointment ↗'; $('bookingStatus').textContent = ''; selectedTime = ''; $('bookingSlots').textContent = 'Select a date to check availability.'; again.remove(); };
      $('bookingStatus').after(again);
    } catch (error) {
      $('bookingStatus').textContent = error.name === 'TimeoutError' ? 'Confirmation took too long. Check your appointment with the concierge before retrying to avoid a duplicate.' : error.message;
      $('confirmBooking').textContent = 'Retry confirmation ↗';
      if (error.status === 409) { await loadSlots(); $('confirmBooking').textContent = 'Confirm Appointment ↗'; }
    } finally { submitting = false; $('confirmBooking').disabled = completed || !selectedTime; }
  });
  $('contactForm').addEventListener('submit', async event => {
    event.preventDefault(); const contact = event.currentTarget, button = contact.querySelector('button');
    if (!contact.reportValidity() || button.disabled) return;
    button.disabled = true; $('contactStatus').textContent = 'Sending your enquiry…';
    try {
      await request('/api/staff/handover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.sessionId, patientName: contact.elements.patientName.value.trim(), phone: contact.elements.phone.value.trim(), message: contact.elements.message.value.trim() }) });
      $('contactStatus').textContent = 'Your enquiry has been sent to clinic staff.'; contact.reset();
    } catch (error) { $('contactStatus').textContent = 'Your enquiry could not be sent. Please retry.'; }
    finally { button.disabled = false; }
  });
  loadClinic(); loadServices();
})();

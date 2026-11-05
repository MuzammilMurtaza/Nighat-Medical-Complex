/**
 * Clinic Date & Time Parser for Dr. Muhammad Zaheer Anjum Clinic
 * Timezone: Asia/Karachi (UTC+5)
 * Handles natural language dates, weekdays, times, ambiguity checks, and appointment types.
 */

const CLINIC_TIMEZONE = 'Asia/Karachi';

const MONTH_MAP = {
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sept: 9, sep: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12
};

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_DISPLAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Get current reference date in clinic timezone (Asia/Karachi)
 */
function getClinicNow() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: CLINIC_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const obj = {};
    parts.forEach(p => { obj[p.type] = p.value; });

    return {
        year: parseInt(obj.year, 10),
        month: parseInt(obj.month, 10),
        day: parseInt(obj.day, 10),
        dateStr: `${obj.year}-${obj.month}-${obj.day}`
    };
}

/**
 * Format a Date object to YYYY-MM-DD
 */
function formatDateToYYYYMMDD(year, month, day) {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}

/**
 * Calculate weekday for YYYY-MM-DD (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
function getDayOfWeek(year, month, day) {
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCDay();
}

/**
 * Parse date from patient message
 * Returns {
 *   hasExplicitDate: boolean,
 *   isValid: boolean,
 *   isAmbiguous: boolean,
 *   dateStr: string | null, // YYYY-MM-DD
 *   weekday: string | null,
 *   appointmentType: string,
 *   clarificationMessage?: string
 * }
 */
function parseClinicDate(text) {
    if (!text || typeof text !== 'string') {
        return { hasExplicitDate: false, isValid: false, isAmbiguous: false, dateStr: null, weekday: null, appointmentType: 'In-Person Appointment' };
    }

    const lower = text.toLowerCase();
    const clinicNow = getClinicNow();
    const currentYear = clinicNow.year;

    // Detect Appointment Type
    let appointmentType = 'In-Person Appointment';
    if (lower.includes('online') || lower.includes('virtual') || lower.includes('video') || lower.includes('zoom') || lower.includes('whatsapp video')) {
        appointmentType = 'Online Appointment';
    } else if (lower.includes('in-person') || lower.includes('in person') || lower.includes('clinic') || lower.includes('physical') || lower.includes('visit')) {
        appointmentType = 'In-Person Appointment';
    }

    // 1. Check for explicit ISO format: YYYY-MM-DD
    const isoMatch = text.match(/\b(202[6-9])-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
    if (isoMatch) {
        const y = parseInt(isoMatch[1], 10);
        const m = parseInt(isoMatch[2], 10);
        const d = parseInt(isoMatch[3], 10);
        const dateStr = formatDateToYYYYMMDD(y, m, d);
        const dayOfWeekIndex = getDayOfWeek(y, m, d);
        const weekday = WEEKDAY_DISPLAY[dayOfWeekIndex];

        // Check if day matches weekday mentioned in text
        const foundWeekday = detectWeekdayInText(lower);
        if (foundWeekday && foundWeekday.toLowerCase() !== weekday.toLowerCase()) {
            return {
                hasExplicitDate: true,
                isValid: false,
                isAmbiguous: true,
                reason: 'weekday_mismatch',
                dateStr,
                weekday,
                appointmentType,
                clarificationMessage: `The date **${dateStr}** is a **${weekday}**, but you mentioned **${foundWeekday}**. Could you please clarify if you prefer **${weekday}, ${dateStr}** or another date?`
            };
        }

        return validateDateNotPast(y, m, d, dateStr, weekday, appointmentType, clinicNow);
    }

    // 2. Check for natural month + day format:
    // e.g. "Thursday, September 3", "September 3rd", "Sept 3, 2026", "3rd September", "3 September 2026"
    const naturalDatePattern = /\b(?:(monday|tuesday|wednesday|thursday|friday|saturday|sunday)[,\s]+)?(?:(january|february|march|april|may|june|july|august|september|sept|sep|october|oct|november|nov|december|dec)[.\s]+(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(202[6-9]))?|(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(january|february|march|april|may|june|july|august|september|sept|sep|october|oct|november|nov|december|dec)(?:[,\s]+(202[6-9]))?)\b/i;

    const natMatch = text.match(naturalDatePattern);
    if (natMatch) {
        const specifiedWeekday = natMatch[1] ? natMatch[1].toLowerCase() : null;
        let monthName = natMatch[2] || natMatch[6];
        let dayNum = parseInt(natMatch[3] || natMatch[5], 10);
        let yearNum = natMatch[4] || natMatch[7] ? parseInt(natMatch[4] || natMatch[7], 10) : currentYear;

        if (monthName && !isNaN(dayNum)) {
            const m = MONTH_MAP[monthName.toLowerCase()];
            if (m && dayNum >= 1 && dayNum <= 31) {
                // Check valid days for month (e.g. Feb 30 check)
                const daysInMonth = new Date(Date.UTC(yearNum, m, 0)).getUTCDate();
                if (dayNum > daysInMonth) {
                    return {
                        hasExplicitDate: true,
                        isValid: false,
                        isAmbiguous: true,
                        reason: 'invalid_date',
                        dateStr: null,
                        weekday: null,
                        appointmentType,
                        clarificationMessage: `The month of **${monthName}** only has ${daysInMonth} days. Please specify a valid date.`
                    };
                }

                const dateStr = formatDateToYYYYMMDD(yearNum, m, dayNum);
                const dayOfWeekIndex = getDayOfWeek(yearNum, m, dayNum);
                const actualWeekday = WEEKDAY_DISPLAY[dayOfWeekIndex];

                // Weekday consistency check
                if (specifiedWeekday && specifiedWeekday !== actualWeekday.toLowerCase()) {
                    const altDaysOffset = (WEEKDAY_NAMES.indexOf(specifiedWeekday) - dayOfWeekIndex + 7) % 7;
                    const altDate = new Date(Date.UTC(yearNum, m - 1, dayNum + altDaysOffset));
                    const altStr = formatDateToYYYYMMDD(altDate.getUTCFullYear(), altDate.getUTCMonth() + 1, altDate.getUTCDate());

                    return {
                        hasExplicitDate: true,
                        isValid: false,
                        isAmbiguous: true,
                        reason: 'weekday_mismatch',
                        dateStr,
                        weekday: actualWeekday,
                        appointmentType,
                        clarificationMessage: `**${monthName} ${dayNum}, ${yearNum}** falls on a **${actualWeekday}** (not ${specifiedWeekday.charAt(0).toUpperCase() + specifiedWeekday.slice(1)}). Did you mean **${actualWeekday}, ${monthName} ${dayNum}** or **${specifiedWeekday.charAt(0).toUpperCase() + specifiedWeekday.slice(1)}, ${altStr}**?`
                    };
                }

                return validateDateNotPast(yearNum, m, dayNum, dateStr, actualWeekday, appointmentType, clinicNow);
            }
        }
    }

    // 3. Check for numeric date format: DD/MM/YYYY or DD-MM-YYYY
    const numericDateMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])[\/\-.](0?[1-9]|1[0-2])(?:[\/\-.](202[6-9]))?\b/);
    if (numericDateMatch) {
        const d = parseInt(numericDateMatch[1], 10);
        const m = parseInt(numericDateMatch[2], 10);
        const y = numericDateMatch[3] ? parseInt(numericDateMatch[3], 10) : currentYear;

        const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
        if (d <= daysInMonth) {
            const dateStr = formatDateToYYYYMMDD(y, m, d);
            const dayOfWeekIndex = getDayOfWeek(y, m, d);
            const actualWeekday = WEEKDAY_DISPLAY[dayOfWeekIndex];
            return validateDateNotPast(y, m, d, dateStr, actualWeekday, appointmentType, clinicNow);
        }
    }

    // 4. Check for Relative Day Keywords: "today", "tomorrow", "day after tomorrow"
    if (lower.match(/\bday\s+after\s+tomorrow\b/)) {
        const target = new Date(Date.UTC(clinicNow.year, clinicNow.month - 1, clinicNow.day + 2));
        const y = target.getUTCFullYear();
        const m = target.getUTCMonth() + 1;
        const d = target.getUTCDate();
        const dateStr = formatDateToYYYYMMDD(y, m, d);
        const weekday = WEEKDAY_DISPLAY[target.getUTCDay()];
        return { hasExplicitDate: true, isValid: true, isAmbiguous: false, dateStr, weekday, appointmentType };
    }

    if (lower.match(/\btomorrow\b/)) {
        const target = new Date(Date.UTC(clinicNow.year, clinicNow.month - 1, clinicNow.day + 1));
        const y = target.getUTCFullYear();
        const m = target.getUTCMonth() + 1;
        const d = target.getUTCDate();
        const dateStr = formatDateToYYYYMMDD(y, m, d);
        const weekday = WEEKDAY_DISPLAY[target.getUTCDay()];
        return { hasExplicitDate: true, isValid: true, isAmbiguous: false, dateStr, weekday, appointmentType };
    }

    if (lower.match(/\btoday\b/)) {
        const y = clinicNow.year;
        const m = clinicNow.month;
        const d = clinicNow.day;
        const dateStr = formatDateToYYYYMMDD(y, m, d);
        const dayOfWeekIndex = getDayOfWeek(y, m, d);
        const weekday = WEEKDAY_DISPLAY[dayOfWeekIndex];
        return { hasExplicitDate: true, isValid: true, isAmbiguous: false, dateStr, weekday, appointmentType };
    }

    // 5. Check for Standalone Weekday references (e.g. "this Thursday", "next Monday", "on Friday", "Thursday")
    const standaloneWeekdayMatch = text.match(/\b(?:this\s+|next\s+|on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (standaloneWeekdayMatch) {
        const targetWeekday = standaloneWeekdayMatch[1].toLowerCase();
        const targetDayIdx = WEEKDAY_NAMES.indexOf(targetWeekday);
        const currentDayIdx = getDayOfWeek(clinicNow.year, clinicNow.month, clinicNow.day);

        let dayDiff = targetDayIdx - currentDayIdx;
        if (dayDiff < 0) {
            dayDiff += 7; // Next occurrence
        } else if (dayDiff === 0 && !lower.includes('today')) {
            dayDiff = 7; // Same day next week if not today
        }

        const target = new Date(Date.UTC(clinicNow.year, clinicNow.month - 1, clinicNow.day + dayDiff));
        const y = target.getUTCFullYear();
        const m = target.getUTCMonth() + 1;
        const d = target.getUTCDate();
        const dateStr = formatDateToYYYYMMDD(y, m, d);
        const weekday = WEEKDAY_DISPLAY[target.getUTCDay()];

        return { hasExplicitDate: true, isValid: true, isAmbiguous: false, dateStr, weekday, appointmentType };
    }

    return {
        hasExplicitDate: false,
        isValid: false,
        isAmbiguous: false,
        dateStr: null,
        weekday: null,
        appointmentType
    };
}

/**
 * Validate that resolved date is not in the past
 */
function validateDateNotPast(y, m, d, dateStr, weekday, appointmentType, clinicNow) {
    const targetDateNum = y * 10000 + m * 100 + d;
    const nowNum = clinicNow.year * 10000 + clinicNow.month * 100 + clinicNow.day;

    if (targetDateNum < nowNum) {
        return {
            hasExplicitDate: true,
            isValid: false,
            isAmbiguous: true,
            reason: 'past_date',
            dateStr,
            weekday,
            appointmentType,
            clarificationMessage: `The date **${dateStr}** (${weekday}) is in the past. Please select an upcoming consultation date.`
        };
    }

    return {
        hasExplicitDate: true,
        isValid: true,
        isAmbiguous: false,
        dateStr,
        weekday,
        appointmentType
    };
}

/**
 * Helper to detect weekday name in string
 */
function detectWeekdayInText(lower) {
    for (let i = 0; i < WEEKDAY_NAMES.length; i++) {
        const w = WEEKDAY_NAMES[i];
        if (new RegExp(`\\b${w}\\b`, 'i').test(lower)) {
            return WEEKDAY_DISPLAY[i];
        }
    }
    return null;
}

/**
 * Parse requested time slot from message and normalize to clinic slot format
 * e.g., "2:30 PM", "02:30 PM", "2:30pm", "2.30 pm", "14:30", "2 PM" -> "2:30 PM"
 */
function parseClinicTime(text, candidateSlots = []) {
    if (!text) return null;

    // Pattern for 12-hour or 24-hour time
    const timeMatch = text.match(/\b(1[0-2]|0?[1-9])[:.]([0-5]\d)\s*(am|pm)?\b/i) ||
                      text.match(/\b(1[0-2]|0?[1-9])\s*(am|pm)\b/i) ||
                      text.match(/\b(1[2-9]|20|0?[1-9])\s*(?:o'clock|hrs?|hours?)?\b/i);

    if (!timeMatch) return null;

    let hour = parseInt(timeMatch[1], 10);
    let minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    let meridiem = timeMatch[3] ? timeMatch[3].toUpperCase() : null;

    // Auto-detect PM for clinic hours if meridiem missing
    if (!meridiem) {
        if (hour >= 1 && hour <= 7) meridiem = 'PM';
        else if (hour === 12) meridiem = 'PM';
        else if (hour >= 13 && hour <= 20) {
            hour = hour - 12;
            meridiem = 'PM';
        } else if (hour >= 8 && hour <= 11) meridiem = 'AM';
    }

    const minStr = String(minute).padStart(2, '0');
    // Format options: "2:30 PM" (unpadded hour) and "02:30 PM" (padded hour)
    const formattedUnpadded = `${hour}:${minStr} ${meridiem}`;
    const formattedPadded = `${String(hour).padStart(2, '0')}:${minStr} ${meridiem}`;

    // If candidateSlots provided, find exact matching slot
    if (candidateSlots && candidateSlots.length > 0) {
        const matched = candidateSlots.find(s => {
            const sClean = s.trim().toUpperCase();
            return sClean === formattedUnpadded.toUpperCase() || sClean === formattedPadded.toUpperCase();
        });
        if (matched) return matched;
    }

    return formattedUnpadded;
}

module.exports = {
    CLINIC_TIMEZONE,
    getClinicNow,
    formatDateToYYYYMMDD,
    getDayOfWeek,
    parseClinicDate,
    parseClinicTime,
    WEEKDAY_DISPLAY
};

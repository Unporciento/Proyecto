function pad(value) { return String(value).padStart(2, '0'); }

function icsDate(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function escapeIcs(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function examCountdown(examDate) {
  if (!examDate) return null;
  const exam = new Date(`${examDate}T12:00:00`);
  const days = Math.ceil((exam - new Date()) / 86_400_000);
  return Number.isFinite(days) ? days : null;
}

export function buildCalendar(settings) {
  const minutes = Math.max(5, Number(settings.dailyGoal) || 25);
  const [hour, minute] = (settings.studyTime || '19:00').split(':').map(Number);
  const start = new Date();
  start.setDate(start.getDate() + 1); start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + minutes * 60_000);
  const untilDate = settings.examDate ? new Date(`${settings.examDate}T23:59:59`) : new Date(start.getTime() + 30 * 86_400_000);
  const until = `${untilDate.getUTCFullYear()}${pad(untilDate.getUTCMonth() + 1)}${pad(untilDate.getUTCDate())}T235959Z`;
  const uid = `forja-${Date.now()}@estudio.local`;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Forja//Plan de estudio//ES', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${icsDate(new Date())}Z`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `RRULE:FREQ=DAILY;UNTIL=${until}`, `SUMMARY:${escapeIcs('Forja · Repaso activo')}`,
    `DESCRIPTION:${escapeIcs(`${minutes} minutos: responder sin mirar, corregir y espaciar. Abre Forja y completa la cola del día.`)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', `DESCRIPTION:${escapeIcs('Tu sesión de Forja comienza en 10 minutos')}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
}

export function downloadCalendar(settings) {
  const blob = new Blob([buildCalendar(settings)], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = 'plan-forja.ics'; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

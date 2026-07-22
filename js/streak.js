export const REWARDS = Object.freeze([
  { days: 3, icon: '⚡', name: 'Arranque', copy: 'Tres días cumpliendo contigo.' },
  { days: 7, icon: '🔥', name: 'Semana firme', copy: 'Una semana completa de práctica.' },
  { days: 14, icon: '🛡', name: 'Constancia', copy: 'Dos semanas construyendo memoria.' },
  { days: 30, icon: '🏆', name: 'Disciplina', copy: 'Un mes de estudio sostenido.' },
  { days: 60, icon: '💎', name: 'Imparable', copy: 'Sesenta días de compromiso.' },
  { days: 100, icon: '👑', name: 'Leyenda Forja', copy: 'Cien días: el hábito ya es parte de ti.' }
]);
export const MIN_DAILY_ANSWERS = 3;

export function localDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function previousDay(date) {
  const copy = new Date(date); copy.setHours(12, 0, 0, 0); copy.setDate(copy.getDate() - 1); return copy;
}

function consecutive(left, right) {
  const date = new Date(`${left}T12:00:00`); date.setDate(date.getDate() + 1);
  return localDayKey(date) === right;
}

export function streakStats(attempts = [], now = new Date(), savedBest = 0) {
  const counts = new Map();
  attempts.forEach(item => {
    const day = localDayKey(item.createdAt);
    if (day) counts.set(day, (counts.get(day) || 0) + 1);
  });
  const days = [...counts].filter(([, count]) => count >= MIN_DAILY_ANSWERS).map(([day]) => day).sort();
  const activeDays = new Set(days);
  let cursor = new Date(now); cursor.setHours(12, 0, 0, 0);
  if (!activeDays.has(localDayKey(cursor))) cursor = previousDay(cursor);
  let current = 0;
  while (activeDays.has(localDayKey(cursor))) { current += 1; cursor = previousDay(cursor); }

  let best = days.length ? 1 : 0;
  let run = best;
  for (let index = 1; index < days.length; index += 1) {
    run = consecutive(days[index - 1], days[index]) ? run + 1 : 1;
    best = Math.max(best, run);
  }
  best = Math.max(best, Math.min(10_000, Number(savedBest) || 0));
  const next = REWARDS.find(reward => reward.days > current) || null;
  const previousGoal = [...REWARDS].reverse().find(reward => reward.days <= current)?.days || 0;
  const progress = next ? Math.round((current - previousGoal) / (next.days - previousGoal) * 100) : 100;
  const todayAnswers = counts.get(localDayKey(now)) || 0;
  return { current, best, activeDays: days.length, todayAnswers, remainingToday: Math.max(0, MIN_DAILY_ANSWERS - todayAnswers), next, progress: Math.max(0, Math.min(100, progress)), unlocked: REWARDS.filter(reward => reward.days <= best) };
}

export function newlyUnlocked(before, after) {
  return REWARDS.filter(reward => reward.days > before.best && reward.days <= after.best);
}

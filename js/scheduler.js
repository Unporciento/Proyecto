const DAY = 86_400_000;

export function isDue(card, now = Date.now()) {
  return !card.dueAt || new Date(card.dueAt).getTime() <= now;
}

export function schedule(card, rating, now = Date.now()) {
  const next = { ...card };
  const previous = Math.max(0, card.intervalDays || 0);
  next.repetitions = (card.repetitions || 0) + 1;
  next.lastReviewedAt = new Date(now).toISOString();

  if (rating === 1) {
    next.intervalDays = 0.04;
    next.ease = Math.max(1.3, (card.ease || 2.5) - 0.2);
    next.lapses = (card.lapses || 0) + 1;
  } else if (rating === 2) {
    next.intervalDays = previous < 1 ? 1 : Math.max(1, previous * 1.2);
    next.ease = Math.max(1.3, (card.ease || 2.5) - 0.08);
  } else if (rating === 3) {
    next.intervalDays = previous < 1 ? 2 : Math.max(2, previous * (card.ease || 2.5));
  } else {
    next.intervalDays = previous < 1 ? 4 : Math.max(4, previous * (card.ease || 2.5) * 1.35);
    next.ease = Math.min(3.2, (card.ease || 2.5) + 0.08);
  }

  const jitter = 1 + ((((card.id.length * 17) % 9) - 4) / 100);
  next.intervalDays = Math.round(next.intervalDays * jitter * 100) / 100;
  next.dueAt = new Date(now + next.intervalDays * DAY).toISOString();
  next.mastery = masteryScore(next);
  return next;
}

export function masteryScore(card) {
  if (!card.repetitions) return 0;
  const strength = Math.min(1, Math.log2((card.intervalDays || 0) + 1) / 5.7);
  const lapsePenalty = Math.min(.55, (card.lapses || 0) * .09);
  return Math.round(Math.max(0, strength - lapsePenalty) * 100);
}

export function buildSession(cards, limit = 18, now = Date.now()) {
  const scored = cards.map(card => {
    const due = isDue(card, now);
    const overdueDays = card.dueAt ? Math.max(0, (now - new Date(card.dueAt).getTime()) / DAY) : 2;
    const weakness = 1 - (card.mastery || 0) / 100;
    const novelty = card.repetitions ? 0 : 1;
    return { card, score: (due ? 10 : 0) + overdueDays + weakness * 5 + novelty * 2 + Math.random() };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map(item => item.card);
}

export function summarize(cards, attempts) {
  const reviewed = cards.filter(card => card.repetitions);
  const due = cards.filter(card => isDue(card)).length;
  const mastery = reviewed.length
    ? Math.round(reviewed.reduce((sum, card) => sum + (card.mastery || 0), 0) / reviewed.length)
    : 0;
  const correct = attempts.filter(a => a.rating >= 3).length;
  const minutes = Math.round(attempts.reduce((sum, a) => sum + (a.durationMs || 0), 0) / 60_000);
  return { total: cards.length, reviewed: reviewed.length, due, mastery, answers: attempts.length, accuracy: attempts.length ? Math.round(correct / attempts.length * 100) : 0, minutes };
}

export function nextLabel(card) {
  if (!card.dueAt) return 'Nueva';
  const diff = new Date(card.dueAt).getTime() - Date.now();
  if (diff <= 0) return 'Ahora';
  if (diff < DAY) return `${Math.max(1, Math.round(diff / 3_600_000))} h`;
  return `${Math.round(diff / DAY)} d`;
}

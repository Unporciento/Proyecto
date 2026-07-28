export function calibrationSummary(attempts) {
  const confident = attempts.filter(attempt => Number(attempt.confidence) >= 4);
  if (!confident.length) {
    return {
      confident: 0,
      blindSpots: 0,
      rate: null,
      title: 'Aún sin datos',
      copy: 'Declara tu confianza al responder para detectar puntos ciegos.'
    };
  }
  const blindSpots = confident.filter(attempt => Number(attempt.rating) < 3).length;
  const rate = Math.round(blindSpots / confident.length * 100);
  return {
    confident: confident.length,
    blindSpots,
    rate,
    title: rate < 20 ? 'Confianza bien calibrada' : `${rate}% de puntos ciegos`,
    copy: rate < 20
      ? 'Cuando dices “lo sé”, normalmente puedes demostrarlo.'
      : 'Sentías seguridad, pero el recuerdo falló. Prioriza esas preguntas.'
  };
}

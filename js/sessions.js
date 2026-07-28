import { uid } from './db.js';
import { EXAM_CONFIDENCE_LEVELS } from './exam.js';
import { buildChoices, scoreTypedAnswer } from './generator.js';
import { nextLabel } from './scheduler.js';

const escapeHtml = value => {
  const node = document.createElement('div'); node.textContent = value || ''; return node.innerHTML;
};

export class StudySession {
  constructor(target, cards, { onRate, onFinish, sound = true }) {
    this.target = target; this.cards = cards; this.onRate = onRate; this.onFinish = onFinish; this.sound = sound;
    this.index = 0; this.confidence = 3; this.startedAt = Date.now(); this.cardStartedAt = Date.now();
  }

  start() { this.render(); }

  render() {
    if (this.index >= this.cards.length) return this.finish();
    const card = this.cards[this.index];
    this.cardStartedAt = Date.now(); this.confidence = 3;
    this.target.innerHTML = `<div class="session-head"><span>Pregunta ${this.index + 1} de ${this.cards.length}</span><span>Próximo repaso: ${nextLabel(card)}</span></div>
      <div class="bar"><i style="width:${this.index / this.cards.length * 100}%"></i></div>
      <article class="question-card" style="margin-top:18px"><span class="source-tag">${escapeHtml(card.sourceName)} · ${escapeHtml(card.type)}</span>
        <h2>${escapeHtml(card.question)}</h2><textarea class="answer-input" id="activeAnswer" placeholder="Escribe lo que recuerdas. No hace falta que sea idéntico…"></textarea>
        <div class="confidence-row"><span>Antes de mirar: ¿qué tan seguro estás?</span><div class="confidence-options">${[1,2,3,4,5].map(n => `<button data-confidence="${n}" class="${n === 3 ? 'active' : ''}">${n}</button>`).join('')}</div></div>
        <button class="primary-btn" id="revealAnswer">Comprobar respuesta</button><button class="text-btn" id="readQuestion" style="margin-left:14px">Escuchar pregunta</button>
        <div id="answerReveal" hidden></div>
      </article>`;
    this.target.querySelectorAll('[data-confidence]').forEach(button => button.addEventListener('click', () => {
      this.confidence = Number(button.dataset.confidence);
      this.target.querySelectorAll('[data-confidence]').forEach(item => item.classList.toggle('active', item === button));
    }));
    this.target.querySelector('#revealAnswer').addEventListener('click', () => this.reveal(card));
    this.target.querySelector('#readQuestion').addEventListener('click', () => this.speak(card.question));
    this.target.querySelector('#activeAnswer').focus();
  }

  reveal(card) {
    const input = this.target.querySelector('#activeAnswer');
    const similarity = scoreTypedAnswer(input.value, card);
    const reveal = this.target.querySelector('#answerReveal');
    input.disabled = true;
    this.target.querySelector('#revealAnswer').hidden = true;
    reveal.hidden = false;
    reveal.className = 'answer-reveal';
    reveal.innerHTML = `<span class="eyebrow">RESPUESTA DEL MATERIAL</span><p>${escapeHtml(card.answer)}</p><button class="text-btn" id="readAnswer">Escuchar respuesta</button><small>Coincidencia orientativa de ideas clave: ${similarity}%. Tú decides según el significado, no por palabras idénticas.</small>
      <div class="rating-row"><button class="rating-btn" data-rating="1">Otra vez<small>no lo recordé</small></button><button class="rating-btn" data-rating="2">Difícil<small>faltó bastante</small></button><button class="rating-btn" data-rating="3">Bien<small>idea correcta</small></button><button class="rating-btn" data-rating="4">Fácil<small>sin esfuerzo</small></button></div>`;
    reveal.querySelector('#readAnswer').addEventListener('click', () => this.speak(card.answer));
    reveal.querySelectorAll('[data-rating]').forEach(button => button.addEventListener('click', async () => {
      const rating = Number(button.dataset.rating);
      await this.onRate(card, { rating, confidence: this.confidence, typedAnswer: input.value, similarity, durationMs: Date.now() - this.cardStartedAt });
      this.index += 1; this.render();
    }));
  }

  speak(text) {
    if (!this.sound || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'es-CL'; utterance.rate = .95; speechSynthesis.speak(utterance);
  }

  finish() {
    this.target.innerHTML = `<div class="center-stage"><span class="stage-mark">✓</span><span class="eyebrow">SESIÓN COMPLETADA</span><h1>Buen trabajo incómodo.</h1><p>Si algunas preguntas costaron, la sesión funcionó: obligaste a tu memoria a recuperar, no solo a reconocer.</p><button class="primary-btn" id="finishStudy">Volver al inicio</button></div>`;
    this.target.querySelector('#finishStudy').addEventListener('click', () => this.onFinish(Date.now() - this.startedAt));
  }
}

export class ExamSession {
  constructor(target, cards, minutes, { onFinish, onDispose = () => {} }) {
    this.target = target; this.cards = cards; this.minutes = minutes; this.onFinish = onFinish; this.onDispose = onDispose;
    this.index = 0; this.answers = []; this.remaining = minutes * 60; this.timer = null; this.disposed = false;
    this.onViewChange = event => { if (event.detail?.view !== 'examen') this.dispose(); };
  }

  start() {
    this.stopTimer();
    this.disposed = false;
    globalThis.window?.removeEventListener?.('forja:viewchange', this.onViewChange);
    globalThis.window?.addEventListener?.('forja:viewchange', this.onViewChange);
    this.timer = setInterval(() => this.tick(), 1000);
    this.render();
  }

  stopTimer() {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopTimer();
    globalThis.window?.removeEventListener?.('forja:viewchange', this.onViewChange);
    this.onDispose();
  }

  tick() { this.remaining -= 1; const label = this.target.querySelector('#examTimer'); if (label) label.textContent = this.timeLabel(); if (this.remaining <= 0) this.finish(); }
  timeLabel() { return `${String(Math.floor(this.remaining / 60)).padStart(2,'0')}:${String(this.remaining % 60).padStart(2,'0')}`; }

  render() {
    const card = this.cards[this.index];
    const choices = buildChoices(card, this.cards);
    const cardStartedAt = Date.now();
    this.target.innerHTML = `<div class="session-head"><span>Simulacro · ${this.index + 1}/${this.cards.length}</span><strong id="examTimer">${this.timeLabel()}</strong></div><div class="bar"><i style="width:${this.index / this.cards.length * 100}%"></i></div>
      <article class="question-card" style="margin-top:18px"><span class="source-tag">${escapeHtml(card.sourceName)}</span><h2>${escapeHtml(card.question)}</h2><div>${choices.map((answer, i) => `<button type="button" class="exam-option" data-option="${i}">${escapeHtml(answer)}</button>`).join('')}</div>
        <fieldset class="confidence-row"><legend>Antes de avanzar: ¿qué tan seguro está? 1 es nada; 5 es totalmente.</legend><div class="confidence-options">${EXAM_CONFIDENCE_LEVELS.map(level => `<button type="button" data-exam-confidence="${level}" aria-label="Confianza ${level} de 5" aria-pressed="false">${level}</button>`).join('')}</div></fieldset>
        <button type="button" class="primary-btn" id="examNext" disabled>${this.index + 1 === this.cards.length ? 'Finalizar' : 'Siguiente'}</button></article>`;
    let selected = null;
    let confidence = null;
    const updateNext = () => {
      this.target.querySelector('#examNext').disabled = !selected || confidence === null;
    };
    this.target.querySelectorAll('.exam-option').forEach(button => button.addEventListener('click', () => {
      selected = choices[Number(button.dataset.option)];
      this.target.querySelectorAll('.exam-option').forEach(item => item.classList.toggle('selected', item === button));
      updateNext();
    }));
    this.target.querySelectorAll('[data-exam-confidence]').forEach(button => button.addEventListener('click', () => {
      confidence = Number(button.dataset.examConfidence);
      this.target.querySelectorAll('[data-exam-confidence]').forEach(item => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      updateNext();
    }));
    this.target.querySelector('#examNext').addEventListener('click', () => {
      this.answers.push({
        card,
        selected,
        correct: selected === card.answer,
        confidence,
        durationMs: Date.now() - cardStartedAt
      });
      this.index += 1;
      if (this.index >= this.cards.length) this.finish(); else this.render();
    });
  }

  finish() {
    this.stopTimer();
    const correct = this.answers.filter(item => item.correct).length;
    const score = Math.round(correct / this.cards.length * 100);
    const errors = this.answers.filter(item => !item.correct);
    this.target.innerHTML = `<article class="question-card"><span class="eyebrow">RESULTADO</span><h1>${score}%</h1><p>${correct} de ${this.cards.length} respuestas correctas.</p><div class="bar"><i style="width:${score}%"></i></div>
      <h2 style="margin-top:28px">Errores para convertir en aprendizaje</h2>${errors.length ? errors.map(item => `<div class="answer-reveal"><strong>${escapeHtml(item.card.question)}</strong><p>${escapeHtml(item.card.answer)}</p></div>`).join('') : '<p>Excelente: repite otro día para comprobar que se mantiene.</p>'}<button class="primary-btn" id="closeExam" style="margin-top:20px">Guardar resultado</button></article>`;
    this.target.querySelector('#closeExam').addEventListener('click', () => {
      this.dispose();
      this.onFinish(this.answers, score);
    });
  }
}

let activeExamSession = null;

export function startExamSession(target, cards, minutes, options) {
  activeExamSession?.dispose();
  const session = new ExamSession(target, cards, minutes, {
    ...options,
    onDispose: () => {
      if (activeExamSession === session) activeExamSession = null;
    }
  });
  activeExamSession = session;
  session.start();
  return session;
}

import { uid } from './db.js?v=20260722-3';

const STOP = new Set('para como esta este estos estas desde donde cuando entre sobre porque aunque hacia hasta pero que una unos unas del las los con por sin sus son fue han hay más muy también puede pueden debe deben todo toda cada cual cuyo ya sea esto ese esa así no si al o y e u en de la el se un'.split(' '));

export function cleanText(raw = '') {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[>*_~`|]/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n +/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sentences(text) {
  return cleanText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map(value => value.trim())
    .filter(value => value.length >= 45 && value.length <= 420);
}

function keywords(text, max = 5) {
  const words = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .match(/[a-zñ]{4,}/g) || [];
  const counts = new Map();
  words.filter(word => !STOP.has(word)).forEach(word => counts.set(word, (counts.get(word) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, max).map(([word]) => word);
}

function definition(sentence) {
  const match = sentence.match(/^(.{3,80}?)\s+(?:es|son|se define como|corresponde a|consiste en|significa)\s+(.{15,320})[.]?$/i);
  if (!match) return null;
  const term = match[1].replace(/^(el|la|los|las|un|una)\s+/i, '').trim();
  if (term.split(/\s+/).length > 10) return null;
  return { question: `¿Qué es ${term}?`, answer: match[2].trim(), type: 'definition' };
}

function enumeration(sentence) {
  const match = sentence.match(/^(.{10,130}?)(?::| son | incluye[n]? | comprende[n]? )(.{20,280})$/i);
  if (!match || !/[,;]|\sy\s/.test(match[2])) return null;
  const lead = match[1].replace(/[.:]$/, '').trim();
  return { question: `Enumera los elementos principales de: ${lead}.`, answer: match[2].trim(), type: 'list' };
}

function formula(sentence) {
  const arithmetic = sentence.match(/(\d+(?:[.,]\d+)?\s*[+\-×÷*/]\s*\d+(?:[.,]\d+)?)\s*=\s*(\d+(?:[.,]\d+)?)/);
  if (arithmetic) return { question: `Calcula sin mirar: ${arithmetic[1]}`, answer: arithmetic[2], type: 'calculation' };
  const equation = sentence.match(/([A-Za-zÁ-ÿΔημρτ][A-Za-zÁ-ÿ0-9_()²³/·×\s-]{0,35}=\s*[^.;]{2,100})/);
  if (!equation) return null;
  return { question: 'Escribe la fórmula o relación indicada y explica qué representa.', answer: sentence, type: 'formula' };
}

function causal(sentence) {
  const match = sentence.match(/^(.{5,140}?)\s+(?:causa[n]?|provoca[n]?|produce[n]?|genera[n]?|da lugar a|conduce[n]? a)\s+(.{12,240})[.]?$/i);
  if (!match) return null;
  return { question: `¿Qué consecuencia produce ${match[1].trim()}?`, answer: match[2].trim(), type: 'cause-effect' };
}

function comparison(sentence) {
  if (!/(a diferencia de|mientras que|en cambio|por el contrario)/i.test(sentence)) return null;
  return { question: 'Compara los conceptos descritos e indica la diferencia esencial.', answer: sentence, type: 'compare' };
}

function procedure(sentence) {
  if (!/(primero|segundo|luego|después|finalmente|procedimiento|pasos|etapas)/i.test(sentence)) return null;
  return { question: 'Reconstruye en orden el procedimiento o las etapas descritas.', answer: sentence, type: 'procedure' };
}

function diagnosis(sentence) {
  const match = sentence.match(/^(.{5,150}?)\s+(?:indica[n]?|evidencia[n]?|se caracteriza[n]? por|es signo de|es síntoma de)\s+(.{12,220})[.]?$/i);
  if (!match) return null;
  return { question: `Ante “${match[1].trim()}”, ¿qué indica o caracteriza según el material?`, answer: match[2].trim(), type: 'diagnosis' };
}

function cloze(sentence) {
  const terms = keywords(sentence, 3);
  if (!terms.length) return null;
  const target = terms.sort((a, b) => b.length - a.length)[0];
  const expression = new RegExp(`\\b${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'i');
  const found = sentence.match(expression)?.[0];
  if (!found) return null;
  return { question: `Completa la idea: “${sentence.replace(expression, '________')}”`, answer: found, type: 'cloze' };
}

function explanation(sentence) {
  const subject = sentence.split(/[,.:;]/)[0].slice(0, 115);
  return { question: `Explica con tus palabras esta idea: ${subject}.`, answer: sentence, type: 'explain' };
}

function makeCard(seed, doc, index) {
  return {
    id: uid('card'), docId: doc.id, sourceName: doc.name, sourceIndex: index,
    question: seed.question, answer: seed.answer, type: seed.type,
    keywords: keywords(seed.answer, 6), createdAt: new Date().toISOString(),
    dueAt: null, intervalDays: 0, ease: 2.5, repetitions: 0, lapses: 0, mastery: 0
  };
}

export function generateCards(doc, limit = 42) {
  const source = sentences(doc.text);
  const cards = [];
  const seen = new Set();
  const add = (seed, index) => {
    if (!seed) return;
    const key = seed.question.toLowerCase();
    if (!seen.has(key) && cards.length < limit) { seen.add(key); cards.push(makeCard(seed, doc, index)); }
  };

  source.forEach((sentence, index) => {
    add(definition(sentence), index);
    add(enumeration(sentence), index);
    add(formula(sentence), index);
    add(causal(sentence), index);
    add(comparison(sentence), index);
    add(procedure(sentence), index);
    add(diagnosis(sentence), index);
  });
  source.forEach((sentence, index) => {
    if (cards.length >= Math.min(limit, Math.max(12, Math.ceil(source.length * .55)))) return;
    add(index % 3 === 0 ? explanation(sentence) : cloze(sentence), index);
  });
  return cards;
}

export function scoreTypedAnswer(input, card) {
  const normalized = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]/g, ' ');
  const answerWords = new Set(normalized(input).split(/\s+/).filter(Boolean));
  const keys = card.keywords || keywords(card.answer, 6);
  const hits = keys.filter(key => answerWords.has(normalized(key))).length;
  return keys.length ? Math.round(hits / Math.min(4, keys.length) * 100) : 0;
}

export function buildChoices(card, cards) {
  const others = cards.filter(item => item.id !== card.id && item.answer !== card.answer)
    .sort(() => Math.random() - .5).slice(0, 3).map(item => item.answer);
  return [card.answer, ...others].sort(() => Math.random() - .5);
}

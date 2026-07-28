import {
  AUTONOMY_FAMILIES,
  RELATIONSHIP_TASKS,
  emptyMilestoneEvidence,
  validateRelationship
} from './relationship-contracts.js';
import { transitionMessage } from './identity-profile.js';

const NEXT_STAGE = Object.freeze({
  professor_buenaventura: 'buenaventura',
  buenaventura: 'professor_tura',
  professor_tura: 'tura'
});

function has(evidence, family) {
  return evidence.families.includes(family);
}

function hasContextDiscipline(evidence) {
  return has(evidence, 'source_verified') || has(evidence, 'evidence_connected');
}

function hasTaskDiversity(evidence) {
  const analytical = evidence.taskKinds.some(task =>
    task === 'explain' || task === 'compare' || task === 'question'
  );
  const actionable = evidence.taskKinds.some(task =>
    task === 'review' || task === 'suggest'
  );
  return analytical && actionable;
}

function initialGate(evidence) {
  return evidence.separatedSessions
    && hasTaskDiversity(evidence)
    && has(evidence, 'attempt_before_help')
    && has(evidence, 'reasoning_articulated')
    && hasContextDiscipline(evidence);
}

function intermediateGate(evidence) {
  return evidence.separatedSessions
    && hasTaskDiversity(evidence)
    && has(evidence, 'revision_after_feedback')
    && has(evidence, 'decision_justified')
    && hasContextDiscipline(evidence);
}

function finalGate(evidence) {
  return evidence.separatedSessions
    && hasTaskDiversity(evidence)
    && has(evidence, 'attempt_before_help')
    && has(evidence, 'reasoning_articulated')
    && has(evidence, 'revision_after_feedback')
    && has(evidence, 'decision_justified')
    && hasContextDiscipline(evidence);
}

function eligible(stage, evidence) {
  if (stage === 'professor_buenaventura') return initialGate(evidence);
  if (stage === 'buenaventura') return intermediateGate(evidence);
  if (stage === 'professor_tura') return finalGate(evidence);
  return false;
}

function unique(values, value) {
  return values.includes(value) ? [...values] : [...values, value];
}

export function observeAutonomy(relationship, observation) {
  const current = validateRelationship(relationship);
  if (!current.evolutionEnabled
    || observation?.actionComplete !== true
    || observation.activeEvaluation === true
    || observation.technicalError === true
    || !AUTONOMY_FAMILIES.includes(observation.family)
    || !RELATIONSHIP_TASKS.includes(observation.task)
    || typeof observation.day !== 'string') {
    return { relationship: current, transition: null };
  }
  const previousDay = current.milestoneEvidence.lastObservationDay;
  const evidence = {
    families: unique(current.milestoneEvidence.families, observation.family),
    separatedSessions: current.milestoneEvidence.separatedSessions
      || Boolean(previousDay && previousDay !== observation.day),
    taskKinds: unique(current.milestoneEvidence.taskKinds, observation.task),
    lastObservationDay: observation.day
  };
  const next = NEXT_STAGE[current.stage];
  if (!next || !eligible(current.stage, evidence)) {
    return {
      relationship: validateRelationship({ ...current, milestoneEvidence: evidence }),
      transition: null
    };
  }
  return {
    relationship: validateRelationship({
      ...current,
      stage: next,
      milestoneEvidence: emptyMilestoneEvidence(observation.day)
    }),
    transition: {
      from: current.stage,
      to: next,
      message: transitionMessage(next)
    }
  };
}

export function setEvolutionEnabled(relationship, enabled) {
  return validateRelationship({
    ...validateRelationship(relationship),
    evolutionEnabled: Boolean(enabled)
  });
}

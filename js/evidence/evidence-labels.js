export const EVIDENCE_TYPE_OPTIONS = Object.freeze([
  Object.freeze({ id: 'text', label: 'Texto u observación' }),
  Object.freeze({ id: 'document', label: 'Documento' }),
  Object.freeze({ id: 'photo', label: 'Fotografía' }),
  Object.freeze({ id: 'technical_result', label: 'Resultado técnico' }),
  Object.freeze({ id: 'procedure', label: 'Procedimiento' }),
  Object.freeze({ id: 'finding', label: 'Hallazgo' }),
  Object.freeze({ id: 'calculation', label: 'Cálculo' }),
  Object.freeze({ id: 'table_record', label: 'Tabla o registro' })
]);

export const EVIDENCE_STATE_OPTIONS = Object.freeze([
  Object.freeze({ id: 'collected', label: 'Recopilada' }),
  Object.freeze({ id: 'review', label: 'Por revisar' }),
  Object.freeze({ id: 'approved', label: 'Aprobada' }),
  Object.freeze({ id: 'discarded', label: 'Descartada' })
]);

const typeLabels = new Map(EVIDENCE_TYPE_OPTIONS.map(item => [item.id, item.label]));
const stateLabels = new Map(EVIDENCE_STATE_OPTIONS.map(item => [item.id, item.label]));

export const evidenceTypeLabel = id => typeLabels.get(id) || typeLabels.get('text');
export const evidenceStateLabel = id => stateLabels.get(id) || stateLabels.get('review');

function optionNode(item) {
  const option = document.createElement('option');
  option.value = item.id;
  option.textContent = item.label;
  return option;
}

export function fillEvidenceLabels({ type, state, typeFilter, stateFilter }) {
  type.replaceChildren(...EVIDENCE_TYPE_OPTIONS.map(optionNode));
  state.replaceChildren(...EVIDENCE_STATE_OPTIONS.map(optionNode));
  typeFilter.replaceChildren(optionNode({ id: '', label: 'Todos' }),
    ...EVIDENCE_TYPE_OPTIONS.map(optionNode));
  stateFilter.replaceChildren(optionNode({ id: '', label: 'Todos' }),
    ...EVIDENCE_STATE_OPTIONS.map(optionNode));
}

import { IDENTITY_STAGES } from './relationship-contracts.js';

const PROFILES = Object.freeze({
  professor_buenaventura: Object.freeze({
    name: 'Profesor Buenaventura',
    voice: 'formal y algo más explicativo'
  }),
  buenaventura: Object.freeze({
    name: 'Buenaventura',
    voice: 'formal, directo y ligeramente más conciso'
  }),
  professor_tura: Object.freeze({
    name: 'Profesor Tura',
    voice: 'institucional, sobrio y más sintético'
  }),
  tura: Object.freeze({
    name: 'Tura',
    voice: 'sobrio, directo y conciso'
  })
});

export function identityProfile(stage) {
  if (!IDENTITY_STAGES.includes(stage)) {
    throw new TypeError('Etapa de identidad no válida.');
  }
  return PROFILES[stage];
}

export function transitionMessage(stage) {
  const profile = identityProfile(stage);
  return `A partir de ahora puede llamarme ${profile.name}. `
    + 'Las reglas de trabajo y mis permisos no cambian.';
}

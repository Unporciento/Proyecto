export function resolveEnergyMode(preference = 'auto', signals = {}) {
  if (preference === 'standard' || preference === 'saver') return preference;
  const constrained = signals.saveData || signals.reducedMotion || signals.coarsePointer || signals.lowBattery || signals.hardwareConcurrency <= 4 || signals.deviceMemory <= 4;
  return constrained ? 'saver' : 'standard';
}

function browserSignals(battery) {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return {
    saveData: Boolean(connection?.saveData),
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    lowBattery: Boolean(battery && !battery.charging && battery.level <= .35),
    hardwareConcurrency: navigator.hardwareConcurrency || 8,
    deviceMemory: navigator.deviceMemory || 8
  };
}

export function applyEnergyMode(preference = 'auto', root = document.documentElement, battery = null) {
  const mode = resolveEnergyMode(preference, browserSignals(battery));
  root.dataset.energy = mode;
  root.dataset.energyPreference = preference;
  return mode;
}

export async function monitorEnergy(getPreference, onChange = () => {}) {
  let battery = null;
  try { battery = navigator.getBattery ? await navigator.getBattery() : null; } catch { battery = null; }
  const update = () => onChange(applyEnergyMode(getPreference(), document.documentElement, battery));
  ['chargingchange', 'levelchange'].forEach(name => battery?.addEventListener(name, update));
  navigator.connection?.addEventListener?.('change', update);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', update);
  const visibility = () => document.documentElement.toggleAttribute('data-page-hidden', document.hidden);
  document.addEventListener('visibilitychange', visibility); visibility();
  update();
}

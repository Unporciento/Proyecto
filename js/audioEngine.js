/**
 * ============================================================================
 *  audioEngine.js
 *  AUDIO PROCEDURAL — MOTOR, FRENADO Y ALARMAS
 * ============================================================================
 *  Todo el sonido se sintetiza en tiempo real con la Web Audio API (osciladores
 *  + ruido blanco filtrado). No depende de archivos .mp3/.wav externos, así
 *  que no hay bloqueos CORS ni peso extra que cargar.
 *
 *  - setVehicle(type)     → cambia el "timbre" de todo el motor de audio para
 *    que coincida con la maquinaria seleccionada (ver VEHICLE_AUDIO_PROFILES
 *    más abajo: motor más grave y silbido de freno de aire en las máquinas
 *    pesadas, chirrido más agudo y sin aire en el furgón liviano).
 *  - playIgnition()       → arranque del motor (chispazo de ruido + tono
 *    ascendente), con el rango de frecuencias del vehículo activo.
 *  - startEngineLoop()    → rugido de motor en bucle, dos osciladores armónicos.
 *  - updateEngine(kmh, brakeIntensity) → sube el "RPM" con la velocidad y
 *    mezcla el chirrido de neumáticos (ruido filtrado) según la intensidad
 *    de frenado (0..1); ambos usan el perfil del vehículo activo.
 *  - triggerBrakeEngage() → sonido de "enganche" al iniciar el frenado activo:
 *    golpe seco de mordaza en todos los vehículos, + silbido de aire
 *    comprimido ("pssht") en los que tienen frenos de aire (bus, camión
 *    articulado, grúa, minero) — el furgón no lo tiene (frenos hidráulicos).
 *  - stopEngineLoop()     → apaga motor + chirrido con fade-out
 *  - startWarningLoop()/stopWarningLoop() → beep de alerta por brake fade
 *  - toggleMute()         → silencia/reactiva todo el audio
 * ============================================================================
 */

const AudioEngine = (function () {

  /**
   * Perfil sonoro por maquinaria. Los valores están calibrados a partir de
   * la masa real de cada vehículo (ver VEHICLE_PROFILES en mathCore.js:
   * furgon 2t, bus 15t, articulado 25t, grúa 45t, minero 300t) siguiendo la
   * intuición física de que un motor/frenos más grandes resuenan más grave:
   *   - engineBase/ignitionBase   → más masa = pitch de ralentí más bajo.
   *   - filterBase/filterRange    → más masa = timbre más "tapado"/grave
   *     (motores diésel grandes suenan más sordos que uno pequeño a gasolina).
   *   - screechBase/screechRange  → más masa = discos/neumáticos más grandes
   *     = chirrido de frenada más grave y menos "chillón".
   *   - engineGainMax/screechGainMax → más masa = más presencia sonora.
   *   - airBrake  → solo la maquinaria pesada real (bus/articulado/grúa/
   *     minero) usa frenos neumáticos; el furgón (2t) usa frenos hidráulicos
   *     comunes y por eso NO tiene silbido de aire al frenar.
   */
  const VEHICLE_AUDIO_PROFILES = {
    furgon: {
      engineBase: 58, filterBase: 560, filterRange: 680, engineGainMax: 0.22,
      screechBase: 1450, screechRange: 2000, screechGainMax: 0.30,
      ignitionBase: 46, ignitionPeak: 102, airBrake: false
    },
    bus: {
      engineBase: 42, filterBase: 430, filterRange: 620, engineGainMax: 0.27,
      screechBase: 1100, screechRange: 1750, screechGainMax: 0.33,
      ignitionBase: 34, ignitionPeak: 80, airBrake: true
    },
    articulado: {
      engineBase: 36, filterBase: 390, filterRange: 580, engineGainMax: 0.29,
      screechBase: 980, screechRange: 1650, screechGainMax: 0.34,
      ignitionBase: 30, ignitionPeak: 72, airBrake: true
    },
    grua: {
      engineBase: 32, filterBase: 350, filterRange: 540, engineGainMax: 0.31,
      screechBase: 880, screechRange: 1550, screechGainMax: 0.35,
      ignitionBase: 27, ignitionPeak: 66, airBrake: true
    },
    minero: {
      engineBase: 22, filterBase: 260, filterRange: 420, engineGainMax: 0.40,
      screechBase: 620, screechRange: 1250, screechGainMax: 0.42,
      ignitionBase: 18, ignitionPeak: 48, airBrake: true
    }
  };

  let currentProfile = VEHICLE_AUDIO_PROFILES.furgon;

  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  let running = false;

  // Nodos del motor (se recrean en cada startEngineLoop)
  let engineOsc1, engineOsc2, engineGain, engineFilter, osc2Gain;

  // Nodos del chirrido de neumáticos (ruido filtrado, se crean bajo demanda)
  let screechSource, screechFilter, screechGain;

  let warningInterval = null;

  /** Cambia el perfil sonoro activo. Se llama desde main.js cada vez que
   *  cambia el selector de maquinaria, y una vez al iniciar la app. */
  function setVehicle(type) {
    currentProfile = VEHICLE_AUDIO_PROFILES[type] || VEHICLE_AUDIO_PROFILES.furgon;
  }

  function ensureContext() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null; // navegador sin soporte: fallamos en silencio
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.7;
      master.connect(ctx.destination);
      buildNoiseBuffer();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function buildNoiseBuffer() {
    const len = ctx.sampleRate * 2;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Chispazo de arranque: ruido de "crank" + tono ascendente tipo ignición.
   *  El rango de frecuencias del tono viene del perfil del vehículo activo,
   *  así que un camión minero arranca con un rugido mucho más grave que un
   *  furgón. */
  function playIgnition() {
    if (!ensureContext()) return;
    const p = currentProfile;
    const t0 = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 220;
    bp.Q.value = 5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t0);
    ng.gain.linearRampToValueAtTime(0.5, t0 + 0.05);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(master);
    src.start(t0);
    src.stop(t0 + 0.5);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(p.ignitionBase, t0);
    osc.frequency.exponentialRampToValueAtTime(p.ignitionPeak, t0 + 0.4);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.linearRampToValueAtTime(0.32, t0 + 0.15);
    og.gain.linearRampToValueAtTime(0.0001, t0 + 0.55);
    osc.connect(og);
    og.connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.6);
  }

  /** Rugido de motor en bucle: dos osciladores (fundamental + armónico) filtrados.
   *  Pitch base y ganancia salen del perfil del vehículo activo. */
  function startEngineLoop() {
    if (!ensureContext()) return;
    stopEngineLoop();
    running = true;
    const p = currentProfile;
    const t0 = ctx.currentTime;

    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = p.filterBase;

    engineGain = ctx.createGain();
    engineGain.gain.setValueAtTime(0, t0);
    engineGain.gain.linearRampToValueAtTime(p.engineGainMax, t0 + 0.35);

    engineOsc1 = ctx.createOscillator();
    engineOsc1.type = 'sawtooth';
    engineOsc1.frequency.value = p.engineBase;

    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = p.engineBase * 1.5;
    osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.3;

    engineOsc1.connect(engineFilter);
    engineOsc2.connect(osc2Gain);
    osc2Gain.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);

    engineOsc1.start(t0);
    engineOsc2.start(t0);
  }

  /**
   * Actualiza el motor (pitch ~ "RPM" proporcional a la velocidad) y mezcla
   * el chirrido de neumáticos según `brakeIntensity` (0..1, 0 = sin frenar).
   * Todo el rango tonal (motor y chirrido) depende del perfil del vehículo
   * activo, así que la misma velocidad/intensidad suena distinto en un
   * furgón que en un camión minero.
   */
  function updateEngine(speedKmh, brakeIntensity) {
    if (!running || !ctx) return;
    const p = currentProfile;
    const rpmFactor = 0.4 + Math.min(1, speedKmh / 140) * 1.6;
    const base = p.engineBase * rpmFactor;
    const t = ctx.currentTime;
    engineOsc1.frequency.setTargetAtTime(base, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(base * 1.5, t, 0.08);
    engineFilter.frequency.setTargetAtTime(p.filterBase + rpmFactor * p.filterRange, t, 0.1);

    updateScreech(brakeIntensity);
  }

  function updateScreech(intensity) {
    if (!ctx) return;
    const p = currentProfile;
    if (intensity > 0.04) {
      if (!screechSource) {
        screechSource = ctx.createBufferSource();
        screechSource.buffer = noiseBuffer;
        screechSource.loop = true;
        screechFilter = ctx.createBiquadFilter();
        screechFilter.type = 'bandpass';
        screechFilter.Q.value = 9;
        screechGain = ctx.createGain();
        screechGain.gain.value = 0;
        screechSource.connect(screechFilter);
        screechFilter.connect(screechGain);
        screechGain.connect(master);
        screechSource.start();
      }
      const t = ctx.currentTime;
      const targetGain = Math.min(p.screechGainMax, intensity * (p.screechGainMax * 1.25));
      screechGain.gain.setTargetAtTime(targetGain, t, 0.06);
      screechFilter.frequency.setTargetAtTime(p.screechBase + intensity * p.screechRange, t, 0.06);
    } else if (screechGain) {
      screechGain.gain.setTargetAtTime(0, ctx.currentTime, 0.18);
    }
  }

  /** Apaga motor y chirrido con fade-out corto. */
  function stopEngineLoop() {
    running = false;
    if (!ctx) return;
    const t0 = ctx.currentTime;

    if (engineGain) {
      engineGain.gain.cancelScheduledValues(t0);
      engineGain.gain.setTargetAtTime(0, t0, 0.22);
    }
    [engineOsc1, engineOsc2].forEach((o) => {
      if (o) { try { o.stop(t0 + 0.5); } catch (e) { /* ya detenido */ } }
    });
    engineOsc1 = engineOsc2 = engineGain = engineFilter = osc2Gain = null;

    if (screechGain) screechGain.gain.setTargetAtTime(0, t0, 0.2);
    if (screechSource) {
      const src = screechSource;
      setTimeout(() => { try { src.stop(); } catch (e) { /* ya detenido */ } }, 400);
      screechSource = null;
    }
  }

  /** Silbido corto de aire comprimido ("pssht"), característico de frenos
   *  neumáticos de bus/camión/grúa. Ruido filtrado en agudos con un pico
   *  resonante para darle ese carácter siseante, envolvente corta. */
  function playAirBrakeHiss() {
    if (!ensureContext()) return;
    const t0 = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 4200;
    peak.Q.value = 1.2;
    peak.gain.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.16 + currentProfile.engineGainMax * 0.3, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);

    src.connect(hp);
    hp.connect(peak);
    peak.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + 0.6);
  }

  /**
   * Sonido de "enganche" de freno: se dispara UNA vez, justo en el instante
   * en que el vehículo empieza a frenar activamente (lo llama main.js en la
   * transición de `isBraking` false→true, no en cada frame). Combina:
   *   1) Un golpe seco y grave (mordaza/pastilla mecánica), en TODOS los
   *      vehículos, con el pitch del motor activo como referencia.
   *   2) Si el vehículo tiene frenos de aire (ver `airBrake` en el perfil),
   *      un silbido de aire comprimido justo después, como en un bus/camión
   *      real. El furgón (hidráulico) se queda solo con el golpe (1).
   */
  function triggerBrakeEngage() {
    if (!ensureContext()) return;
    const p = currentProfile;
    const t0 = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(p.engineBase * 2.2, t0);
    osc.frequency.exponentialRampToValueAtTime(p.engineBase * 0.9, t0 + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.24, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.2);

    if (p.airBrake) {
      setTimeout(playAirBrakeHiss, 70);
    }
  }

  /** Beep corto de alarma (brake fade / sobrecalentamiento de frenos). */
  function playWarningBeep() {
    if (!ensureContext()) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 880;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.16, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  }

  function startWarningLoop() {
    if (warningInterval) return;
    playWarningBeep();
    warningInterval = setInterval(playWarningBeep, 500);
  }

  function stopWarningLoop() {
    if (warningInterval) {
      clearInterval(warningInterval);
      warningInterval = null;
    }
  }

  function setMuted(value) {
    muted = value;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.7, ctx.currentTime, 0.05);
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  function isMuted() {
    return muted;
  }

  return {
    setVehicle,
    ensureContext,
    playIgnition,
    startEngineLoop,
    updateEngine,
    triggerBrakeEngage,
    stopEngineLoop,
    startWarningLoop,
    stopWarningLoop,
    toggleMute,
    isMuted
  };
})();

window.AudioEngine = AudioEngine;
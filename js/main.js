/**
 * ============================================================================
 *  main.js
 *  EL CEREBRO DEL SIMULADOR
 * ============================================================================
 *  Orquesta mathCore.js (matemática), scene3D.js + vehicleModels.js (3D) y
 *  dashboard.js (telemetría). Maneja el bucle requestAnimationFrame y todos
 *  los eventos de la interfaz.
 * ============================================================================
 */

(function () {

  // --------------------------------------------------------------------
  // ESTADO GLOBAL DE LA APLICACIÓN
  // --------------------------------------------------------------------
  const state = {
    vehicleType: 'furgon',
    terrain: 'asfalto',
    roadProfile: 'lomas', // 'recto' | 'lomas' | 'bajada' — perfil de camino activo (Ronda 9)
    initialSpeedKmh: 80,
    brakePressure: 100,

    // Pendiente del terreno (Ronda 8 — Faena Minera Dinámica)
    maxSlopeDeg: 8,      // controlado por el slider "Inclinación máxima del terreno"
    thetaRad: 0,         // pendiente (radianes) evaluada en el punto de inicio del frenado;
                          // convención de mathCore.js: > 0 = cuesta abajo, < 0 = cuesta arriba
    slopeDecelCapacity: 0,
    slopeCritical: false,
    driverView: false,

    // Parámetros de la corrida activa (se congelan al presionar "Simular")
    a: 0,
    b: 0,
    massKg: 0,
    tStop: 0,
    totalDistance: 0,
    run: null, // objeto {a1,b1,tFade,a2,b2,...} de MathCore.buildRun — trayectoria con brake fade dinámico

    isRunning: false,
    simTime: 0,
    sceneScale: 1,

    vehicleGroup: null,
    vehicleHalfLength: 1,
    vehicleWheelRadius: 0.4,
    vehicleTrackWidth: 2.0,

    // Acumulador de tiempo para espaciar la generación de huellas/humo
    // (no queremos un plano nuevo en cada frame a 60fps, sino cada ~90ms).
    effectsTimer: 0,

    // Recuerda si el frame anterior estaba en brake fade, para disparar la
    // alarma sonora solo en la transición (no repetir el beep cada frame).
    wasBrakeFade: false,

    // Recuerda si el frame anterior el vehículo estaba frenando activamente,
    // para disparar el sonido de "enganche" de freno (clunk + aire, si el
    // vehículo lo tiene) solo en la transición, no en cada frame.
    wasBraking: false,

    // ------------------------------------------------------------------
    // RONDA 10 — HERRAMIENTAS DE PRESENTACIÓN / DEFENSA EN VIVO
    // ------------------------------------------------------------------
    presentationMode: false, // Modo "Meet": fuentes/líneas grandes + cursor de puntero
    slowMotion: false,       // Cámara lenta: multiplica dt por 0.5 durante la corrida
    isPaused: false,         // Pausa exacta en medio del frenado (no resetea simTime)
    wasStopped: false,       // para disparar el overlay "¡DETENIDO!" solo en la transición
    impactShown: false       // para disparar el muro de impacto una sola vez por corrida
  };

  let sceneRefs = null;
  const clock = new THREE.Clock();

  const ROAD_START_X = -Scene3D.ROAD_LENGTH / 2 + 6; // punto de partida del vehículo en el eje Z de la carretera
  const VISIBLE_TRACK = Scene3D.ROAD_LENGTH - 40;     // margen de seguridad en ambos extremos
  // Ronda 10: distancia REAL (metros de frenado reales, no escalados) a la
  // que se ubica el muro de impacto. Ver recomputeCoefficients() para la
  // conversión a posición de escena.
  const IMPACT_REAL_DISTANCE_M = 80;

  // Etiquetas legibles del perfil de camino, usadas en el overlay de la
  // captura de pantalla y en los metadatos del CSV exportado.
  const ROAD_PROFILE_LABELS = {
    recto: 'Recto (plano)',
    lomas: 'Lomas (sinusoidal)',
    bajada: 'Bajada pronunciada (15°)'
  };

  // --------------------------------------------------------------------
  // REFERENCIAS AL DOM
  // --------------------------------------------------------------------
  const dom = {
    vehicleSelect: document.getElementById('vehicleSelect'),
    terrainSelect: document.getElementById('terrainSelect'),
    roadProfileSelect: document.getElementById('roadProfileSelect'),
    speedSlider: document.getElementById('speedSlider'),
    speedValue: document.getElementById('speedValue'),
    brakeSlider: document.getElementById('brakeSlider'),
    brakeValue: document.getElementById('brakeValue'),
    maxSlopeSlider: document.getElementById('maxSlopeSlider'),
    maxSlopeValue: document.getElementById('maxSlopeValue'),
    simulateBtn: document.getElementById('simulateBtn'),
    exportBtn: document.getElementById('exportBtn'),
    shareBtn: document.getElementById('shareBtn'),
    copySummaryBtn: document.getElementById('copySummaryBtn'),
    screenshotBtn: document.getElementById('screenshotBtn'),
    cinemaBtn: document.getElementById('cinemaBtn'),
    restoreBtn: document.getElementById('restoreBtn'),
    soundBtn: document.getElementById('soundBtn'),
    driverViewBtn: document.getElementById('driverViewBtn'),
    speedChips: document.querySelectorAll('.slider-presets[data-target="speedSlider"] .chip'),
    brakeChips: document.querySelectorAll('.slider-presets[data-target="brakeSlider"] .chip'),
    maxSlopeChips: document.querySelectorAll('.slider-presets[data-target="maxSlopeSlider"] .chip'),
    formulaA: document.getElementById('formulaA'),
    formulaB: document.getElementById('formulaB'),
    formulaDecel: document.getElementById('formulaDecel'),
    formulaTheta: document.getElementById('formulaTheta'),
    slopeWarning: document.getElementById('slopeWarning'),
    boardPosition: document.getElementById('boardPosition'),
    boardVelocity: document.getElementById('boardVelocity'),
    boardAcceleration: document.getElementById('boardAcceleration'),
    boardT: document.getElementById('boardT'),
    boardTangent: document.getElementById('boardTangent'),
    canvasContainer: document.getElementById('canvasContainer'),
    appShell: document.querySelector('.app-shell'),
    panelHud: document.querySelector('.panel-hud'),

    // Ronda 10 — herramientas de presentación en vivo
    pauseBtn: document.getElementById('pauseBtn'),
    slowMoBtn: document.getElementById('slowMoBtn'),
    presentationBtn: document.getElementById('presentationBtn'),
    scenarioButtons: document.querySelectorAll('.scenario-btn'),
    eventOverlay: document.getElementById('eventOverlay'),
    presenterCursor: document.getElementById('presenterCursor'),
    boardCard: document.getElementById('boardCard'),
    boardModalBackdrop: document.getElementById('boardModalBackdrop')
  };

  // --------------------------------------------------------------------
  // SINCRONIZACIÓN DE ESPACIO PARA EL HUD (evita que tape los paneles)
  // --------------------------------------------------------------------
  // El HUD (`.panel-hud`) es `position: fixed`, así que vive fuera del
  // flujo del grid de `.app-shell`. Antes el CSS reservaba un espacio fijo
  // adivinado (128px) bajo los paneles para que el HUD no los tapara, pero
  // la altura real del HUD varía (texto de estado más largo como "⚠ BRAKE
  // FADE — SOBRECALENTAMIENTO", botones que envuelven a una segunda fila en
  // pantallas angostas, zoom del navegador, etc.), así que ese número fijo
  // quedaba desactualizado y el HUD terminaba superpuesto sobre la Pizarra
  // y el gráfico de temperatura (ver captura del pedido de la Ronda 5).
  //
  // La solución: medir la altura real de `.panel-hud` con ResizeObserver
  // (se dispara automáticamente ante CUALQUIER cambio de tamaño: resize de
  // ventana, texto de estado que crece, envoltura de botones) y escribir
  // esa altura en la variable CSS `--hud-height`, que `styles.css` usa para
  // calcular `padding-bottom` en `.app-shell`. Así el espacio reservado
  // siempre es exacto, sin importar el contenido o el tamaño de pantalla.
  function syncHudSpacing() {
    if (!dom.panelHud) return;
    const h = Math.ceil(dom.panelHud.getBoundingClientRect().height);
    if (h > 0) {
      document.documentElement.style.setProperty('--hud-height', h + 'px');
    }
  }

  function initHudSpacingObserver() {
    syncHudSpacing();
    if (window.ResizeObserver && dom.panelHud) {
      const ro = new ResizeObserver(syncHudSpacing);
      ro.observe(dom.panelHud);
    } else {
      // Respaldo para navegadores sin ResizeObserver: al menos se
      // recalcula en cada resize de ventana.
      window.addEventListener('resize', syncHudSpacing);
    }
  }

  // --------------------------------------------------------------------
  // MEJORA — TOAST DE FEEDBACK (confirmación visual de acciones rápidas)
  // --------------------------------------------------------------------
  // Pequeño aviso flotante y autodestructivo para confirmar acciones de un
  // solo clic (copiar enlace, copiar resumen) sin interrumpir con un
  // `alert()` bloqueante. `aria-live="polite"` para que lectores de
  // pantalla lo anuncien sin robar el foco.
  let toastEl = null;
  let toastHideTimer = null;
  function showToast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'app-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    if (toastHideTimer) clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(() => {
      toastEl.classList.remove('is-visible');
      toastHideTimer = null;
    }, 2200);
  }

  /** Copia texto al portapapeles con fallback para navegadores/contextos
   *  sin `navigator.clipboard` (p. ej. HTTP sin TLS). */
  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback clásico: <textarea> oculto + document.execCommand('copy').
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* navegador sin soporte */ }
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  // --------------------------------------------------------------------
  // LIBERACIÓN DE MEMORIA GPU (Three.js no libera VRAM con el GC de JS)
  // --------------------------------------------------------------------
  // Recorre un Object3D completo y dispone la geometría y los materiales
  // de cada hijo. Cada buildXxx() de VehicleModels crea materiales nuevos
  // (no compartidos), así que es seguro disponer todo el árbol aquí.
  function disposeObject3D(obj) {
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        (Array.isArray(child.material) ? child.material : [child.material])
          .forEach((m) => m.dispose());
      }
    });
  }

  // --------------------------------------------------------------------
  // CONSTRUCCIÓN / RECONSTRUCCIÓN DEL VEHÍCULO EN LA ESCENA
  // --------------------------------------------------------------------
  // IMPORTANTE (orden de inicialización): esta función asume que
  // `sceneRefs` ya fue asignado por Scene3D.init() en init() más abajo.
  // Nunca se llama antes de eso: init() llama primero a Scene3D.init()
  // y solo después a rebuildVehicle(). Si en el futuro se invoca desde
  // otro punto del código, hay que verificar `sceneRefs` antes de usarla.
  function rebuildVehicle() {
    if (!sceneRefs) {
      console.warn('rebuildVehicle() llamada antes de que Scene3D.init() terminara.');
      return;
    }
    if (state.vehicleGroup) {
      sceneRefs.scene.remove(state.vehicleGroup);
      disposeObject3D(state.vehicleGroup); // libera geometría/materiales del vehículo anterior (evita fuga de VRAM al cambiar de maquinaria)
    }
    // VehicleModels.build() reconstruye la geometría COMPLETA del vehículo
    // (chasis, carrocería/tolva, ejes, ruedas) desde cero para el tipo
    // seleccionado — no es el mismo mesh reescalado, es un modelo distinto
    // por cada tipo de maquinaria (ver comentarios en vehicleModels.js).
    const built = VehicleModels.build(state.vehicleType);
    state.vehicleGroup = built.group;
    state.vehicleHalfLength = built.halfLength;
    state.vehicleWheelRadius = built.wheelRadius;
    state.vehicleTrackWidth = built.trackWidth || 2.0;

    // Orientar el vehículo para que avance a lo largo del eje Z
    state.vehicleGroup.rotation.y = Math.PI / 2;
    state.vehicleGroup.position.set(0, Scene3D.getHeightAt(ROAD_START_X), ROAD_START_X);
    sceneRefs.scene.add(state.vehicleGroup);

    // Vista Cabina: registra el nuevo modelo (proporciones distintas por
    // maquinaria) para que la cámara se ubique a una altura/profundidad
    // coherente con el vehículo activo — ver Scene3D.updateDriverView.
    Scene3D.setDriverViewTarget(
      state.vehicleGroup,
      state.vehicleWheelRadius * 3.6,
      state.vehicleHalfLength * 0.55
    );
  }

  // --------------------------------------------------------------------
  // UTILIDAD: THROTTLE NATIVO (sin dependencias) — Ronda 7
  // --------------------------------------------------------------------
  /**
   * Envuelve `fn` para que, durante una ráfaga de llamadas (p. ej. cada
   * pixel que se arrastra un slider), el CUERPO PESADO de `fn` se ejecute
   * como máximo una vez cada `waitMs` — nunca más seguido que eso — y
   * SIEMPRE se garantiza una ejecución final con el último valor apenas
   * termina la ráfaga (trailing call), para que el estado nunca quede
   * "atrasado" respecto al último valor real del slider.
   * A diferencia de un debounce puro (que solo dispara al soltar), esto
   * sigue refrescando gráficos/vehículo cada ~waitMs mientras se arrastra,
   * en vez de congelar toda la vista pesada hasta el `change`.
   */
  function throttle(fn, waitMs) {
    let lastCall = 0;
    let trailingTimer = null;
    let lastArgs = null;
    function run() {
      lastCall = performance.now();
      if (trailingTimer) { clearTimeout(trailingTimer); trailingTimer = null; }
      fn.apply(null, lastArgs);
    }
    function throttled(...args) {
      lastArgs = args;
      const remaining = waitMs - (performance.now() - lastCall);
      if (remaining <= 0) {
        run();
      } else if (!trailingTimer) {
        trailingTimer = setTimeout(run, remaining);
      }
    }
    // Ejecuta YA la llamada pendiente (si hay una programada) y cancela su
    // timer, para poder forzarla desde un evento 'change' sin que además
    // dispare sola unos milisegundos después (ver maxSlopeSlider 'change').
    throttled.flush = () => { if (trailingTimer) run(); };
    return throttled;
  }

  // --------------------------------------------------------------------
  // SLIDERS — fill dinámico (--fill) y resaltado de chip preset activo
  // --------------------------------------------------------------------
  function updateSliderFill(el) {
    const min = Number(el.min), max = Number(el.max), val = Number(el.value);
    const pct = ((val - min) / (max - min)) * 100;
    el.style.setProperty('--fill', pct + '%');
  }

  function highlightChips(chips, value) {
    chips.forEach((chip) => {
      chip.classList.toggle('active', Number(chip.dataset.value) === value);
    });
  }

  // --------------------------------------------------------------------
  // PERFIL DE CAMINO — atenuar el slider de pendiente cuando no aplica
  // --------------------------------------------------------------------
  /**
   * El slider "Inclinación máxima del terreno" solo afecta la física/
   * visual cuando el perfil activo es "Lomas" (sinusoidal) — en "Recto" y
   * "Bajada pronunciada" la pendiente la define el perfil mismo (0° o 15°
   * fijos). Se atenúa y bloquea el control para no sugerir un ajuste que
   * en ese momento no tiene ningún efecto.
   */
  function updateRoadProfileUI() {
    const slopeGroup = document.querySelector('.slope-control');
    if (!slopeGroup) return;
    slopeGroup.classList.toggle('profile-disabled', state.roadProfile !== 'lomas');
  }

  // --------------------------------------------------------------------
  // RONDA 10 — OVERLAY GIGANTE DE EVENTOS CRÍTICOS
  // --------------------------------------------------------------------
  // Texto 2D centrado sobre el canvas 3D, pensado para que se lea incluso
  // muy comprimido en Google Meet ("¡FRENANDO!", "¡DETENIDO!", "¡FALLA
  // TÉRMICA!", "¡IMPACTO!"). Cada llamada reemplaza cualquier overlay
  // anterior y reinicia su temporizador de desvanecido.
  let eventOverlayTimer = null;
  function showEventOverlay(text, extraClass, durationMs = 2200) {
    if (!dom.eventOverlay) return;
    dom.eventOverlay.textContent = text;
    dom.eventOverlay.className = 'event-overlay is-visible' + (extraClass ? ' ' + extraClass : '');
    if (eventOverlayTimer) clearTimeout(eventOverlayTimer);
    eventOverlayTimer = setTimeout(() => {
      dom.eventOverlay.classList.remove('is-visible');
    }, durationMs);
  }

  // --------------------------------------------------------------------
  // RONDA 10 — MODO PRESENTACIÓN ("MEET MODE")
  // --------------------------------------------------------------------
  // Activa/desactiva `.presentation-mode` en <body> (fuentes/bordes más
  // grandes en CSS, cursor de puntero visible) y engrosa las líneas de
  // ambos gráficos Chart.js vía Dashboard.setPresentationMode(). Se puede
  // alternar en cualquier momento, incluso a mitad de una corrida.
  function setPresentationMode(active) {
    state.presentationMode = active;
    document.body.classList.toggle('presentation-mode', active);
    dom.presentationBtn.classList.toggle('active', active);
    dom.presentationBtn.setAttribute('aria-pressed', String(active));
    dom.presentationBtn.textContent = active ? '🎥 Presentación ON' : '🎥 Modo Presentación';
    Dashboard.setPresentationMode(active);
  }

  /** Mueve el círculo de #presenterCursor a la posición real del mouse (solo tiene efecto visual mientras Modo Presentación está activo, ver CSS). */
  function initPresenterCursor() {
    if (!dom.presenterCursor) return;
    document.addEventListener('mousemove', (e) => {
      dom.presenterCursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }, { passive: true });
  }

  // --------------------------------------------------------------------
  // RONDA 10 — CÁMARA LENTA (SLOW MOTION)
  // --------------------------------------------------------------------
  // Multiplica el `dt` de la física/animación por 0.5 mientras está
  // activa (ver animate()), para poder explicar la matemática en vivo
  // sin que el lag de Google Meet arruine la sensación de movimiento.
  function setSlowMotion(active) {
    state.slowMotion = active;
    dom.slowMoBtn.classList.toggle('active', active);
    dom.slowMoBtn.setAttribute('aria-pressed', String(active));
    dom.slowMoBtn.textContent = active ? '🐢 Cámara Lenta ON (0.5×)' : '🐢 Cámara Lenta';
  }

  // --------------------------------------------------------------------
  // RONDA 10 — PAUSA / REANUDAR EN EL INSTANTE EXACTO
  // --------------------------------------------------------------------
  // A diferencia de detener la simulación (endSimulation), pausar NO
  // resetea `state.simTime` ni el HUD: solo congela el avance del tiempo
  // en animate(), para poder explicar con calma la pendiente de la recta
  // tangente en un instante exacto de la gráfica. `clock.getDelta()` se
  // descarta al reanudar para no acumular un salto de tiempo gigante
  // correspondiente a todo lo que duró la pausa.
  function togglePause() {
    if (!state.isRunning) return;
    state.isPaused = !state.isPaused;
    dom.pauseBtn.classList.toggle('is-paused', state.isPaused);
    dom.pauseBtn.setAttribute('aria-pressed', String(state.isPaused));
    dom.pauseBtn.textContent = state.isPaused ? '▶ Reanudar' : '⏸ Pausar';
    if (!state.isPaused) clock.getDelta();
  }

  // --------------------------------------------------------------------
  // RONDA 10 — CASOS DE PRUEBA PREDEFINIDOS (bookmarks para la defensa)
  // --------------------------------------------------------------------
  // Configura maquinaria/terreno/perfil de camino/velocidad al instante,
  // reutilizando los mismos listeners de 'change'/'input' que ya validan
  // y recalculan todo — así no hay lógica duplicada ni riesgo de que un
  // caso quede en un estado a medio calcular.
  const SCENARIO_PRESETS = {
    A: { vehicle: 'furgon', terrain: 'asfalto', roadProfile: 'recto', speed: 80, brake: 100, label: 'Frenado seguro' },
    B: { vehicle: 'minero', terrain: 'hielo', roadProfile: 'recto', speed: 60, brake: 100, label: 'Distancia extrema' },
    C: { vehicle: 'bus', terrain: 'asfalto', roadProfile: 'bajada', speed: 100, brake: 100, label: 'Falla térmica asegurada' }
  };

  function applyScenario(key) {
    if (state.isRunning) return; // evita corromper una corrida en curso (ver setControlsLocked)
    const p = SCENARIO_PRESETS[key];
    if (!p) return;

    Dashboard.clearGhost(); // evita comparar el ghost de la corrida anterior contra un vehículo/terreno distinto

    dom.vehicleSelect.value = p.vehicle;
    dom.vehicleSelect.dispatchEvent(new Event('change'));

    dom.terrainSelect.value = p.terrain;
    dom.terrainSelect.dispatchEvent(new Event('change'));

    dom.roadProfileSelect.value = p.roadProfile;
    dom.roadProfileSelect.dispatchEvent(new Event('change'));

    dom.speedSlider.value = p.speed;
    dom.speedSlider.dispatchEvent(new Event('input'));
    dom.speedSlider.dispatchEvent(new Event('change'));

    dom.brakeSlider.value = p.brake;
    dom.brakeSlider.dispatchEvent(new Event('input'));
    dom.brakeSlider.dispatchEvent(new Event('change'));

    dom.scenarioButtons.forEach((btn) => {
      const isActive = btn.dataset.scenario === key;
      btn.classList.toggle('just-applied', isActive);
      if (isActive) setTimeout(() => btn.classList.remove('just-applied'), 1200);
    });
  }

  // --------------------------------------------------------------------
  // RONDA 10 — PIZARRA MATEMÁTICA COMO MODAL/LIGHTBOX
  // --------------------------------------------------------------------
  function toggleBoardModal(forceOpen) {
    if (!dom.boardCard) return;
    const open = typeof forceOpen === 'boolean'
      ? forceOpen
      : !dom.boardCard.classList.contains('board-modal-open');
    dom.boardCard.classList.toggle('board-modal-open', open);
    if (dom.boardModalBackdrop) dom.boardModalBackdrop.classList.toggle('is-visible', open);
    dom.boardCard.setAttribute('aria-expanded', String(open));
    // Modo Cine aplica `filter: blur()` a `.panel-left` (que contiene el
    // boardCard), y ese filtro crea un nuevo "containing block" en CSS
    // que rompe el `position: fixed` del modal (queda difuminado y mal
    // centrado). Como no pueden coexistir sin ese conflicto visual, salir
    // de Modo Cine al abrir el modal.
    if (open) dom.appShell.classList.remove('cinema-mode');
  }

  // --------------------------------------------------------------------
  // RONDA 10 — ATAJOS DE TECLADO (para presentar sin tocar el mouse)
  //   Espacio → Simular / Pausar · M → Modo cine · P → Modo Presentación
  //   Esc     → cerrar la pizarra si está expandida como modal
  // --------------------------------------------------------------------
  function initHotkeys() {
    document.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      // No interceptar mientras el foco está en un control interactivo
      // (sliders, selects) — ahí Espacio/las flechas deben operar el control.
      if (activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA') return;

      // Ctrl/Cmd + tecla: dejar pasar los atajos nativos del navegador
      // (p. ej. Cmd+P imprimir) en vez de interceptarlos con los nuestros.
      if (e.ctrlKey || e.metaKey) return;

      if (e.code === 'Space') {
        e.preventDefault();
        // Ignora auto-repeat: si el usuario mantiene Espacio presionado,
        // el navegador dispara 'keydown' repetidamente y sin este guard
        // pausaría/reanudaría muchas veces por segundo.
        if (e.repeat) return;
        if (!state.isRunning) {
          if (!dom.simulateBtn.disabled) startSimulation();
        } else {
          togglePause();
        }
      } else if (e.key === 'm' || e.key === 'M') {
        const enteringCinema = !dom.appShell.classList.contains('cinema-mode');
        if (enteringCinema) toggleBoardModal(false); // ver nota en toggleBoardModal
        dom.appShell.classList.toggle('cinema-mode');
      } else if (e.key === 'p' || e.key === 'P') {
        setPresentationMode(!state.presentationMode);
      } else if (e.key === 'Escape' && dom.boardCard && dom.boardCard.classList.contains('board-modal-open')) {
        toggleBoardModal(false);
      }
    });
  }

  // --------------------------------------------------------------------
  // RECÁLCULO DE COEFICIENTES MATEMÁTICOS (a, b) SEGÚN LA UI ACTUAL
  // --------------------------------------------------------------------
  // Relación Fuerza de frenado ↔ fricción del terreno ↔ MASA (Ronda 7, para
  // la defensa oral):
  //   F_frenado = μ(terreno) · g · REFERENCE_MASS_KG · η_freno · presión
  //   decel     = F_frenado / massKg          (Segunda Ley de Newton, a = F/m)
  //   decel_máxima posible = μ · g            (tope físico de fricción)
  //   Desde esta ronda la masa SÍ afecta la cinemática (a, b, t, distancia):
  //   con la misma fuerza de frenado, una máquina más pesada desacelera
  //   menos. Ver nota extensa en mathCore.js, computeCoefficientA. El
  //   terreno decide μ: asfalto seco (μ=0.80) permite casi 7× más
  //   desaceleración que el hielo (μ=0.12).
  //   La `brakeEfficiency` de cada máquina sigue multiplicando esa fuerza
  //   para reflejar que un sistema hidráulico real nunca aprovecha el 100%
  //   de la fricción disponible — y la fuerza real resultante (F = m·a) es
  //   la que reportamos en el HUD como "Fuerza freno".
  function recomputeCoefficients() {
    const terrainData = MathCore.getTerrainData(state.terrain);
    const vehicleProfile = MathCore.getVehicleProfile(state.vehicleType);

    // Pendiente en el punto donde arranca el frenado (aproximación cuasi-
    // estática, ver nota extensa en mathCore.js). `Scene3D.getSlopeAt` usa
    // la convención "positivo = subiendo en +z" (dirección de avance); la
    // física de mathCore.js usa la convención inversa ("positivo = bajando"
    // ayuda a entender por qué frena peor), así que se invierte el signo.
    const terrainSlopeRad = Scene3D.getSlopeAt(ROAD_START_X);
    state.thetaRad = -terrainSlopeRad;

    const { a, decelMagnitude, slopeDecelCapacity, slopeCritical } = MathCore.computeCoefficientA(
      terrainData.mu,
      vehicleProfile.brakeEfficiency,
      state.brakePressure,
      vehicleProfile.massKg,
      state.thetaRad
    );
    const b = MathCore.computeCoefficientB(state.initialSpeedKmh);

    state.a = a;
    state.b = b;
    state.massKg = vehicleProfile.massKg;
    state.slopeDecelCapacity = slopeDecelCapacity;
    state.slopeCritical = slopeCritical;

    // Construye la trayectoria completa (posiblemente seccionada en dos
    // tramos si el disco cruza el umbral de brake fade durante la corrida).
    state.run = MathCore.buildRun(a, b, state.massKg);
    state.tStop = state.run.tStop;
    state.totalDistance = MathCore.totalStopDistanceRun(state.run);

    // Escala visual: comprime distancias reales grandes para que el
    // frenado siempre termine dentro del tramo visible de carretera.
    state.sceneScale = state.totalDistance > 0
      ? Math.min(1, VISIBLE_TRACK / state.totalDistance)
      : 1;

    // --- RONDA 10: Muro de impacto a una distancia REAL fija ---
    // `IMPACT_REAL_DISTANCE_M` es metros reales de frenado, no unidades de
    // escena: si el vehículo se detiene antes de recorrerlos, la barrera
    // queda intacta (nunca la alcanza); si necesita más para detenerse,
    // la atraviesa. Como la comparación en animate() se hace en unidades
    // reales (`position >= IMPACT_REAL_DISTANCE_M`), aquí solo hace falta
    // convertir esos 80m reales a la posición de ESCENA equivalente para
    // dibujar la barrera en el lugar visualmente correcto de cada corrida.
    const wallScenePos = ROAD_START_X + IMPACT_REAL_DISTANCE_M * state.sceneScale;
    Scene3D.setImpactWallZ(wallScenePos);

    updateFormulaPanel(decelMagnitude);
  }

  function updateFormulaPanel(decelMagnitude) {
    dom.formulaA.textContent = state.a.toFixed(3);
    dom.formulaB.textContent = state.b.toFixed(2);
    dom.formulaDecel.textContent = decelMagnitude.toFixed(2);
    if (dom.formulaTheta) {
      dom.formulaTheta.textContent = (state.thetaRad * 180 / Math.PI).toFixed(1);
    }
    if (dom.slopeWarning) {
      dom.slopeWarning.style.display = state.slopeCritical ? 'block' : 'none';
    }
  }

  // --------------------------------------------------------------------
  // PIZARRA DE ECUACIONES EN VIVO
  // --------------------------------------------------------------------
  /**
   * Escribe en la "pizarra" las tres funciones (f, f', f'') con los
   * coeficientes numéricos reales de la corrida actual, más la recta
   * tangente evaluada en el instante `t` (se recalcula cada frame durante
   * la simulación para que el estudiante vea la ecuación "vivir").
   */
  function updateBlackboard(t) {
    const inFade = state.run && state.run.hasFade && t >= state.run.tFade;
    const segA = inFade ? state.run.a2 : state.a;
    const segB = inFade ? state.run.b2 : state.b;
    const segT = inFade ? t - state.run.tFade : t;
    const pos = MathCore.positionAtRun(state.run, t);
    const vel = MathCore.velocityAtRun(state.run, t);
    const doubleDeriv = -2 * segA;

    const suffix = inFade ? '  ⚠ tramo con brake fade' : '';
    dom.boardPosition.textContent = `= -${segA.toFixed(3)}t² + ${segB.toFixed(2)}t${suffix}`;
    dom.boardVelocity.textContent = `= ${doubleDeriv.toFixed(3)}t + ${segB.toFixed(2)}`;
    dom.boardAcceleration.textContent = `= ${doubleDeriv.toFixed(3)} m/s² (constante)`;
    dom.boardT.textContent = `${t.toFixed(2)} s`;
    dom.boardTangent.textContent =
      `= ${pos.toFixed(2)} + ${vel.toFixed(2)}(t − ${segT.toFixed(2)})`;
  }

  // --------------------------------------------------------------------
  // VISTA PREVIA ESTÁTICA (cuando el usuario mueve controles sin simular)
  // --------------------------------------------------------------------
  function showStaticPreview() {
    Dashboard.reset();
    Dashboard.updateHUD({
      speedKmh: state.initialSpeedKmh,
      stopDistance: state.totalDistance,
      time: 0,
      acceleration: -2 * state.a,
      temp: MathCore.AMBIENT_TEMP,
      forceKN: MathCore.brakingForceAt(state.massKg, -2 * state.a) / 1000,
      energyMJ: MathCore.kineticEnergyAt(state.massKg, state.b) / 1e6,
      brakeFade: false,
      status: 'LISTO'
    });
    updateBlackboard(0);
    // Ronda 7: `state.vehicleGroup` es `null` si WebGL no está disponible
    // (Scene3D.init() devolvió el fallback en vez de la escena real) —
    // el resto del dashboard (gráficos, HUD, pizarra) debe seguir
    // funcionando igual, así que este bloque se salta sin romper nada.
    if (state.vehicleGroup) {
      state.vehicleGroup.position.set(0, Scene3D.getHeightAt(ROAD_START_X), ROAD_START_X);
      state.vehicleGroup.rotation.z = -Scene3D.getSlopeAt(ROAD_START_X);
    }
    // Una corrida nueva (o un ajuste de controles) no debe arrastrar
    // huellas/humo de la corrida anterior.
    Scene3D.clearSkidMarks();
    Scene3D.clearSmoke();
    Scene3D.clearSparks();
    Scene3D.resetImpactWall();
  }

  // --------------------------------------------------------------------
  // SERIE DE PUNTOS PARA LA RECTA TANGENTE (ventana alrededor de t0)
  // --------------------------------------------------------------------
  function buildTangentSeries(t0) {
    const window_ = Math.max(0.6, state.tStop * 0.18);
    // La recta tangente se dibuja con los coeficientes del tramo activo en
    // t0 (fase sana o fase con brake fade): cada tramo es su propia
    // parábola local con f'' constante propio, así que la ventana se
    // recorta para no cruzar el punto de unión entre tramos.
    const inFade = state.run.hasFade && t0 >= state.run.tFade;
    const segStart = inFade ? state.run.tFade : 0;
    const segEnd = inFade ? state.tStop : (state.run.hasFade ? state.run.tFade : state.tStop);
    const tMin = Math.max(segStart, t0 - window_);
    const tMax = Math.min(segEnd, t0 + window_);
    const localA = inFade ? state.run.a2 : state.run.a1;
    const localB = inFade ? state.run.b2 : state.run.b1;
    const offset = inFade ? state.run.p1AtFade : 0;
    const t0Local = t0 - segStart;
    return [
      { x: tMin, y: offset + MathCore.tangentLineAt(t0Local, localA, localB, tMin - segStart) },
      { x: tMax, y: offset + MathCore.tangentLineAt(t0Local, localA, localB, tMax - segStart) }
    ];
  }

  // --------------------------------------------------------------------
  // INICIO DE UNA CORRIDA DE SIMULACIÓN
  // --------------------------------------------------------------------
  // --------------------------------------------------------------------
  // BLOQUEO DE CONTROLES DURANTE LA SIMULACIÓN
  // --------------------------------------------------------------------
  // Mientras una corrida está en curso, cambiar vehículo/terreno/perfil de
  // camino/sliders o aplicar un "Caso de prueba" dispara rebuildVehicle()
  // y/o showStaticPreview() (que resetea Dashboard y reposiciona el
  // vehículo), corrompiendo la corrida a mitad de camino. Se bloquean estos
  // controles en startSimulation() y se liberan en endSimulation().
  function setControlsLocked(locked) {
    dom.vehicleSelect.disabled = locked;
    dom.terrainSelect.disabled = locked;
    dom.roadProfileSelect.disabled = locked;
    dom.speedSlider.disabled = locked;
    dom.brakeSlider.disabled = locked;
    dom.maxSlopeSlider.disabled = locked;
    [dom.speedChips, dom.brakeChips, dom.maxSlopeChips].forEach((chipList) => {
      chipList.forEach((chip) => { chip.disabled = locked; });
    });
    dom.scenarioButtons.forEach((btn) => { btn.disabled = locked; });
  }

  function startSimulation() {
    setControlsLocked(true);
    recomputeCoefficients();
    Dashboard.reset();
    Scene3D.clearSkidMarks();
    Scene3D.clearSmoke();
    Scene3D.clearSparks();
    Scene3D.resetImpactWall();
    state.simTime = 0;
    state.effectsTimer = 0;
    state.isRunning = true;
    state.wasBrakeFade = false;
    state.wasBraking = false;
    state.wasStopped = false;
    state.impactShown = false;
    state.isPaused = false;
    clock.getDelta(); // descarta el delta acumulado mientras estaba detenido
    dom.simulateBtn.disabled = true;
    dom.simulateBtn.textContent = 'FRENANDO...';
    if (dom.pauseBtn) {
      dom.pauseBtn.disabled = false;
      dom.pauseBtn.classList.remove('is-paused');
      dom.pauseBtn.setAttribute('aria-pressed', 'false');
      dom.pauseBtn.textContent = '⏸ Pausar';
    }
    if (dom.eventOverlay) dom.eventOverlay.classList.remove('is-visible');

    // --- Audio: arranque de motor + rugido en bucle ---
    AudioEngine.ensureContext();
    AudioEngine.playIgnition();
    AudioEngine.startEngineLoop();
  }

  function endSimulation(finalStatus) {
    state.isRunning = false;
    state.isPaused = false;
    setControlsLocked(false);
    dom.simulateBtn.disabled = false;
    dom.simulateBtn.textContent = 'SIMULAR FRENADO DE EMERGENCIA';
    if (dom.pauseBtn) {
      dom.pauseBtn.disabled = true;
      dom.pauseBtn.classList.remove('is-paused');
      dom.pauseBtn.setAttribute('aria-pressed', 'false');
      dom.pauseBtn.textContent = '⏸ Pausar';
    }
    AudioEngine.stopEngineLoop();
    AudioEngine.stopWarningLoop();
    const thermal = MathCore.brakeTemperatureAtRun(state.run, state.simTime, state.massKg);
    Dashboard.updateHUD({
      speedKmh: 0,
      stopDistance: state.totalDistance,
      time: state.tStop,
      acceleration: 0,
      temp: thermal.temp,
      forceKN: 0,
      energyMJ: 0,
      brakeFade: thermal.isBrakeFade,
      status: thermal.isBrakeFade ? '⚠ FINALIZADA CON BRAKE FADE' : finalStatus
    });
  }

  // --------------------------------------------------------------------
  // BUCLE PRINCIPAL DE ANIMACIÓN
  // --------------------------------------------------------------------
  const COOLING_TAIL_SECONDS = 6; // tiempo extra que se sigue graficando el enfriamiento tras la detención

  function animate() {
    requestAnimationFrame(animate);
    const rawDt = clock.getDelta();
    // Ronda 10 — Cámara Lenta: multiplica el paso de tiempo de la física/
    // animación por 0.5 mientras está activa, para dar tiempo a explicar
    // la matemática sin que el lag de videollamada arruine el movimiento.
    // Se aplica a TODO lo que depende del tiempo dentro de este bucle
    // (posición del vehículo, huellas/humo, motor, cámara), no solo al
    // avance de `state.simTime`, para que la sensación de "lento" sea
    // consistente en toda la escena.
    const dt = (state.isRunning && state.slowMotion) ? rawDt * 0.5 : rawDt;

    if (state.isRunning && !state.isPaused) {
      state.simTime += dt;

      const position = MathCore.positionAtRun(state.run, state.simTime);
      const velocity = MathCore.velocityAtRun(state.run, state.simTime);
      const acceleration = MathCore.accelerationAtRun(state.run, state.simTime);
      const thermal = MathCore.brakeTemperatureAtRun(state.run, state.simTime, state.massKg);
      const temp = thermal.temp;

      // --- Fuerza de frenado (F = m·a) y energía cinética (Ec = ½·m·v²) ---
      // Ambas dependen de la masa real de la maquinaria seleccionada; a
      // diferencia de `a`/`b` (cinemática pura), aquí SÍ se nota el peso.
      const forceN = MathCore.brakingForceAt(state.massKg, acceleration);
      const energyJ = MathCore.kineticEnergyAt(state.massKg, velocity);

      // --- Mover el vehículo en la escena (posición real escalada) ---
      // Ronda 7: todo este bloque es puramente 3D — si WebGL no está
      // disponible, `state.vehicleGroup` es `null` (ver rebuildVehicle) y
      // se salta entero sin afectar la física ni el resto del dashboard.
      const scenePos = ROAD_START_X + position * state.sceneScale;
      if (state.vehicleGroup) {
        state.vehicleGroup.position.z = scenePos;
        // El chasis sigue la altura real del terreno y se inclina (pitch)
        // según la pendiente local — puramente visual, no afecta la física
        // cuasi-estática (que usa la pendiente fija del punto de partida).
        state.vehicleGroup.position.y = Scene3D.getHeightAt(scenePos);
        state.vehicleGroup.rotation.z = -Scene3D.getSlopeAt(scenePos);

        // --- Cámara cinemática: sigue al vehículo sin quitarle el control al usuario ---
        Scene3D.focusOn(scenePos, dt);

        // Rotar ruedas proporcionalmente a la velocidad (detalle visual).
        // Se identifican por `userData.isWheel` (asignado en vehicleModels.js)
        // en vez de por tipo de geometría, para no rotar por error otras
        // piezas cilíndricas del modelo (p.ej. la torreta de la grúa o la
        // articulación del camión articulado).
        // Las ruedas ahora se construyen "de pie" (eje real hacia los
        // lados, ver vehicleModels.js), así que el giro de rodado se aplica
        // sobre su propio eje Z, no X (con la orientación anterior, girar en
        // X hacía que el eje de la rueda "se acostara" progresivamente en
        // vez de rodar limpio sobre un eje fijo).
        const wheelSpin = (velocity * dt) / Math.max(0.05, state.vehicleWheelRadius);
        state.vehicleGroup.children.forEach((child) => {
          if (child.userData && child.userData.isWheel) {
            child.rotation.z += wheelSpin;
          }
        });

        // --- RONDA 10: Muro de impacto — el vehículo lo sobrepasa mientras
        // todavía tiene velocidad. Se compara en METROS REALES (`position`,
        // no `scenePos`) para que el resultado sea independiente de cuánto
        // se haya comprimido visualmente la corrida: si el vehículo se
        // detiene antes de los 80m reales, nunca dispara el impacto. ---
        if (!state.impactShown && position >= IMPACT_REAL_DISTANCE_M) {
          state.impactShown = true;
          Scene3D.triggerImpact();
          showEventOverlay('¡IMPACTO!', 'event-impact', 2600);
        }
      }

      // --- Intensidad de frenado normalizada (0..1), usada por efectos y audio ---
      const brakeIntensity = Math.min(1, Math.abs(acceleration) / 8);

      // --- Huellas de frenado y humo de neumáticos ---
      // Se generan mientras el vehículo sigue en movimiento (f'(t) > 0,
      // es decir, todavía está frenando activamente). Se espacian con
      // `effectsTimer` para no saturar la escena a 60fps.
      const isBraking = velocity > 0.3 && state.simTime < state.tStop;

      // --- Audio: "enganche" de freno (clunk mecánico + silbido de aire en
      // vehículos pesados) solo en el instante en que arranca el frenado
      // activo, no en cada frame. `triggerBrakeEngage()` ya sabe (vía
      // AudioEngine.setVehicle) si el vehículo actual tiene frenos de aire.
      // Ronda 10: además dispara el overlay gigante "¡FRENANDO!".
      if (isBraking && !state.wasBraking) {
        AudioEngine.triggerBrakeEngage();
        showEventOverlay('¡FRENANDO!', 'event-danger');
      }
      state.wasBraking = isBraking;

      state.effectsTimer += dt;
      if (state.vehicleGroup && isBraking && state.effectsTimer >= 0.09) {
        state.effectsTimer = 0;
        const worldX = state.vehicleGroup.position.x;
        const halfTrack = state.vehicleTrackWidth / 2;
        Scene3D.addSkidMark(worldX - halfTrack, scenePos);
        Scene3D.addSkidMark(worldX + halfTrack, scenePos);
        if (Math.random() < 0.6) {
          Scene3D.spawnSmokePuff(worldX - halfTrack, state.vehicleWheelRadius, scenePos);
          Scene3D.spawnSmokePuff(worldX + halfTrack, state.vehicleWheelRadius, scenePos);
        }
        if (thermal.isBrakeFade) {
          Scene3D.spawnSparks(worldX - halfTrack, state.vehicleWheelRadius * 0.4, scenePos);
          Scene3D.spawnSparks(worldX + halfTrack, state.vehicleWheelRadius * 0.4, scenePos);
        }
        // Sacudida de cámara: más fuerte cuanto más brusco el frenado, y
        // todavía más si el disco ya está en brake fade (control errático).
        Scene3D.shakeCamera(brakeIntensity * (thermal.isBrakeFade ? 0.85 : 0.45));
      }
      Scene3D.updateSmoke(dt);
      Scene3D.updateSparks(dt);

      // --- Audio: motor con "RPM" ligado a la velocidad + chirrido de neumáticos ---
      AudioEngine.updateEngine(velocity * 3.6, isBraking ? brakeIntensity : 0);

      // --- Alarma de brake fade: solo se dispara en la transición a estado crítico ---
      // Ronda 10: además dispara el overlay gigante "¡FALLA TÉRMICA!".
      if (thermal.isBrakeFade && !state.wasBrakeFade) {
        AudioEngine.startWarningLoop();
        showEventOverlay('¡FALLA TÉRMICA!', 'event-danger', 3000);
      } else if (!thermal.isBrakeFade && state.wasBrakeFade) {
        AudioEngine.stopWarningLoop();
      }
      state.wasBrakeFade = thermal.isBrakeFade;

      // --- Ronda 10: overlay "¡DETENIDO!" solo en la transición a parado ---
      const stoppedNow = state.simTime >= state.tStop;
      if (stoppedNow && !state.wasStopped) {
        showEventOverlay('¡DETENIDO!', 'event-ok');
      }
      state.wasStopped = stoppedNow;

      // --- Alimentar gráficos, HUD y pizarra ---
      Dashboard.pushFrame({
        t: state.simTime,
        position,
        tangentSeries: buildTangentSeries(state.simTime),
        ambientTemp: MathCore.AMBIENT_TEMP,
        temp
      });

      Dashboard.updateHUD({
        speedKmh: velocity * 3.6,
        stopDistance: state.totalDistance,
        time: state.simTime,
        acceleration,
        temp,
        forceKN: forceN / 1000,
        energyMJ: energyJ / 1e6,
        brakeFade: thermal.isBrakeFade,
        status: thermal.isBrakeFade
          ? '⚠ BRAKE FADE — SOBRECALENTAMIENTO'
          : (state.simTime < state.tStop ? 'FRENANDO' : 'DETENIDO / ENFRIANDO')
      });

      updateBlackboard(state.simTime);

      if (state.simTime >= state.tStop + COOLING_TAIL_SECONDS) {
        endSimulation('SIMULACIÓN FINALIZADA');
      }
    }

    Scene3D.render(dt);
  }

  // --------------------------------------------------------------------
  // EVENTOS DE UI
  // --------------------------------------------------------------------
  function bindEvents() {
    dom.vehicleSelect.addEventListener('change', () => {
      state.vehicleType = dom.vehicleSelect.value;
      // El "timbre" del motor y el frenado (pitch, filtro, silbido de aire)
      // depende de qué maquinaria está seleccionada — ver audioEngine.js,
      // VEHICLE_AUDIO_PROFILES. Hay que avisarle al motor de audio ANTES de
      // que el usuario presione "Simular" para que la próxima corrida ya
      // suene distinto.
      AudioEngine.setVehicle(state.vehicleType);
      rebuildVehicle();
      recomputeCoefficients();
      showStaticPreview();
      persistSettings();
    });

    dom.terrainSelect.addEventListener('change', () => {
      state.terrain = dom.terrainSelect.value;
      recomputeCoefficients();
      Scene3D.setTerrainVisual(state.terrain, MathCore.getTerrainData(state.terrain));
      showStaticPreview();
      persistSettings();
    });

    dom.roadProfileSelect.addEventListener('change', () => {
      state.roadProfile = dom.roadProfileSelect.value;
      Scene3D.setRoadProfile(state.roadProfile);
      updateRoadProfileUI();
      recomputeCoefficients();
      if (!state.isRunning) showStaticPreview();
      persistSettings();
    });

    // Ronda 7 — Debounce/throttle de rendimiento: el recálculo pesado
    // (física completa + reset/redibujo de ambos gráficos Chart.js +
    // reposicionar el vehículo 3D) se separa del refresco liviano de texto.
    // El texto/relleno del slider (`updateSliderFill`, chips, número en
    // vivo) sigue actualizándose en CADA evento 'input' para que se sienta
    // instantáneo al arrastrar; el trabajo pesado se limita a como máximo
    // una vez cada ~100ms mientras se arrastra (`throttle`), y al soltar
    // el slider (`change`) se fuerza un recálculo final inmediato para que
    // el último valor quede siempre reflejado con precisión exacta.
    const heavySpeedRecompute = throttle(() => {
      recomputeCoefficients();
      if (!state.isRunning) showStaticPreview();
    }, 100);
    const heavyBrakeRecompute = throttle(() => {
      recomputeCoefficients();
      if (!state.isRunning) showStaticPreview();
    }, 100);

    dom.speedSlider.addEventListener('input', () => {
      state.initialSpeedKmh = Number(dom.speedSlider.value);
      dom.speedValue.textContent = state.initialSpeedKmh;
      updateSliderFill(dom.speedSlider);
      highlightChips(dom.speedChips, state.initialSpeedKmh);
      heavySpeedRecompute();
    });
    dom.speedSlider.addEventListener('change', () => {
      recomputeCoefficients();
      if (!state.isRunning) showStaticPreview();
      persistSettings();
    });

    dom.brakeSlider.addEventListener('input', () => {
      state.brakePressure = Number(dom.brakeSlider.value);
      dom.brakeValue.textContent = state.brakePressure;
      updateSliderFill(dom.brakeSlider);
      highlightChips(dom.brakeChips, state.brakePressure);
      heavyBrakeRecompute();
    });
    dom.brakeSlider.addEventListener('change', () => {
      recomputeCoefficients();
      if (!state.isRunning) showStaticPreview();
      persistSettings();
    });

    // Chips de preset: fijan el slider al valor indicado y disparan su
    // evento 'input' para reutilizar toda la lógica de recálculo de arriba.
    dom.speedChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        dom.speedSlider.value = chip.dataset.value;
        dom.speedSlider.dispatchEvent(new Event('input'));
      });
    });
    dom.brakeChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        dom.brakeSlider.value = chip.dataset.value;
        dom.brakeSlider.dispatchEvent(new Event('input'));
      });
    });

    // Slider de "Inclinación Máxima del Terreno": a diferencia de
    // velocidad/freno, mover este control SÍ implica reconstruir geometría
    // 3D (la pista, bermas, marcadores y conos cambian de forma), así que
    // el recálculo pesado se limita al evento 'change' (soltar el slider)
    // en vez de recalcular en cada pixel arrastrado; el número/relleno del
    // slider sigue actualizándose en vivo en 'input' para que se sienta fluido.
    const heavySlopeRecompute = throttle(() => {
      Scene3D.setMaxSlope(state.maxSlopeDeg);
      Scene3D.setTerrainVisual(state.terrain, MathCore.getTerrainData(state.terrain));
      recomputeCoefficients();
      if (!state.isRunning) showStaticPreview();
      persistSettings();
    }, 220);

    dom.maxSlopeSlider.addEventListener('input', () => {
      state.maxSlopeDeg = Number(dom.maxSlopeSlider.value);
      dom.maxSlopeValue.textContent = state.maxSlopeDeg;
      updateSliderFill(dom.maxSlopeSlider);
      highlightChips(dom.maxSlopeChips, state.maxSlopeDeg);
      heavySlopeRecompute();
    });
    dom.maxSlopeSlider.addEventListener('change', () => {
      // heavySlopeRecompute ya deja programada (o ya ejecutó) esta misma
      // reconstrucción vía el evento 'input' throttled; flush() la fuerza
      // YA si sigue pendiente, en vez de repetir rebuildTerrainGeometry()
      // por segunda vez con el mismo valor (ver Auditoría II, hallazgo 3).
      heavySlopeRecompute.flush();
      persistSettings();
    });
    dom.maxSlopeChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        dom.maxSlopeSlider.value = chip.dataset.value;
        dom.maxSlopeSlider.dispatchEvent(new Event('input'));
        dom.maxSlopeSlider.dispatchEvent(new Event('change'));
      });
    });

    dom.driverViewBtn.addEventListener('click', () => {
      state.driverView = Scene3D.toggleDriverView();
      dom.driverViewBtn.classList.toggle('active', state.driverView);
      dom.driverViewBtn.setAttribute('aria-pressed', String(state.driverView));
      dom.driverViewBtn.textContent = state.driverView ? '🚙 Vista Libre' : '🚙 Vista Cabina';
    });

    dom.simulateBtn.addEventListener('click', startSimulation);

    dom.exportBtn.addEventListener('click', exportData);
    if (dom.shareBtn) dom.shareBtn.addEventListener('click', shareScenarioLink);
    if (dom.copySummaryBtn) dom.copySummaryBtn.addEventListener('click', copyRunSummary);

    dom.screenshotBtn.addEventListener('click', takeScreenshot);

    dom.soundBtn.addEventListener('click', () => {
      AudioEngine.ensureContext();
      const muted = AudioEngine.toggleMute();
      dom.soundBtn.textContent = muted ? '🔇 Sonido' : '🔊 Sonido';
      dom.soundBtn.classList.toggle('muted', muted);
      dom.soundBtn.setAttribute('aria-pressed', String(muted));
    });

    dom.cinemaBtn.addEventListener('click', () => {
      toggleBoardModal(false); // ver nota en toggleBoardModal: no pueden coexistir
      dom.appShell.classList.add('cinema-mode');
    });

    dom.restoreBtn.addEventListener('click', () => {
      dom.appShell.classList.remove('cinema-mode');
    });

    // ------------------------------------------------------------------
    // RONDA 10 — controles de presentación en vivo
    // ------------------------------------------------------------------
    if (dom.pauseBtn) {
      dom.pauseBtn.addEventListener('click', togglePause);
    }

    if (dom.slowMoBtn) {
      dom.slowMoBtn.addEventListener('click', () => setSlowMotion(!state.slowMotion));
    }

    if (dom.presentationBtn) {
      dom.presentationBtn.addEventListener('click', () => setPresentationMode(!state.presentationMode));
    }

    dom.scenarioButtons.forEach((btn) => {
      btn.addEventListener('click', () => applyScenario(btn.dataset.scenario));
    });

    if (dom.boardCard) {
      dom.boardCard.addEventListener('click', () => toggleBoardModal());
      dom.boardCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleBoardModal();
        }
      });
    }
    if (dom.boardModalBackdrop) {
      dom.boardModalBackdrop.addEventListener('click', () => toggleBoardModal(false));
    }
  }

  // --------------------------------------------------------------------
  // PERSISTENCIA DE CONFIGURACIÓN (localStorage) — Ronda 8
  // --------------------------------------------------------------------
  // Guarda la última configuración elegida (maquinaria, terreno, sliders)
  // para que al recargar la página el simulador arranque donde el usuario
  // lo dejó, en vez de siempre volver a los valores por defecto. No es una
  // "corrida fantasma" (no existía en versiones anteriores de este
  // proyecto): es una conveniencia de UI, deliberadamente simple.
  const SETTINGS_KEY = 'frenado-emergencia:settings-v1';

  // Claves cortas usadas en la URL de escenario compartible (ver
  // buildShareURL()/loadSettingsFromURL() más abajo) — un solo lugar para
  // no desincronizar los nombres entre generar y leer la URL.
  const SHARE_PARAM_KEYS = {
    vehicleType: 'v', terrain: 't', roadProfile: 'p',
    initialSpeedKmh: 's', brakePressure: 'b', maxSlopeDeg: 'm'
  };

  /** Valida y aplica un objeto plano {vehicleType, terrain, ...} sobre
   *  `state`, ignorando cualquier clave ausente o inválida. Usado tanto
   *  por loadSettings() (localStorage) como por loadSettingsFromURL()
   *  (querystring), para no duplicar las reglas de validación en dos
   *  sitios que podrían desincronizarse con el tiempo. */
  function applyStateFromPlainObject(saved) {
    if (!saved) return;
    if (saved.vehicleType && MathCore.VEHICLE_PROFILES[saved.vehicleType]) state.vehicleType = saved.vehicleType;
    if (saved.terrain && MathCore.TERRAIN_FRICTION[saved.terrain]) state.terrain = saved.terrain;
    if (saved.roadProfile === 'recto' || saved.roadProfile === 'lomas' || saved.roadProfile === 'bajada') {
      state.roadProfile = saved.roadProfile;
    }
    if (typeof saved.initialSpeedKmh === 'number' && isFinite(saved.initialSpeedKmh)) {
      state.initialSpeedKmh = Math.min(140, Math.max(10, saved.initialSpeedKmh));
    }
    if (typeof saved.brakePressure === 'number' && isFinite(saved.brakePressure)) {
      state.brakePressure = Math.min(100, Math.max(10, saved.brakePressure));
    }
    if (typeof saved.maxSlopeDeg === 'number' && isFinite(saved.maxSlopeDeg)) {
      state.maxSlopeDeg = Math.min(22, Math.max(0, saved.maxSlopeDeg));
    }
  }

  function persistSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        vehicleType: state.vehicleType,
        terrain: state.terrain,
        roadProfile: state.roadProfile,
        initialSpeedKmh: state.initialSpeedKmh,
        brakePressure: state.brakePressure,
        maxSlopeDeg: state.maxSlopeDeg
      }));
    } catch (e) {
      /* localStorage no disponible (modo privado, cuota excedida, etc.) — no es crítico */
    }
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      applyStateFromPlainObject(JSON.parse(raw));
    } catch (e) {
      /* configuración corrupta o localStorage no disponible — se ignora y se usan los valores por defecto */
    }
  }

  // --------------------------------------------------------------------
  // MEJORA — ESCENARIO COMPARTIBLE POR URL
  // --------------------------------------------------------------------
  // Codifica vehículo/terreno/perfil/sliders como querystring corto
  // (?v=minero&t=hielo&p=bajada&s=100&b=100&m=15) para que un profesor
  // pueda enviar por chat/correo un enlace que abre el simulador YA
  // configurado con un caso específico, sin depender de que el otro
  // extremo toque los controles a mano. Si la URL trae parámetros,
  // tienen prioridad sobre lo guardado en localStorage (ver init()).
  function loadSettingsFromURL() {
    let params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (e) {
      return false;
    }
    if (![...params.keys()].some((k) => Object.values(SHARE_PARAM_KEYS).includes(k))) return false;

    const num = (key) => {
      const raw = params.get(key);
      if (raw === null) return undefined;
      const n = Number(raw);
      return isFinite(n) ? n : undefined;
    };
    applyStateFromPlainObject({
      vehicleType: params.get(SHARE_PARAM_KEYS.vehicleType) || undefined,
      terrain: params.get(SHARE_PARAM_KEYS.terrain) || undefined,
      roadProfile: params.get(SHARE_PARAM_KEYS.roadProfile) || undefined,
      initialSpeedKmh: num(SHARE_PARAM_KEYS.initialSpeedKmh),
      brakePressure: num(SHARE_PARAM_KEYS.brakePressure),
      maxSlopeDeg: num(SHARE_PARAM_KEYS.maxSlopeDeg)
    });
    return true;
  }

  /** Construye la URL absoluta del escenario ACTUALMENTE configurado. */
  function buildShareURL() {
    const params = new URLSearchParams();
    params.set(SHARE_PARAM_KEYS.vehicleType, state.vehicleType);
    params.set(SHARE_PARAM_KEYS.terrain, state.terrain);
    params.set(SHARE_PARAM_KEYS.roadProfile, state.roadProfile);
    params.set(SHARE_PARAM_KEYS.initialSpeedKmh, state.initialSpeedKmh);
    params.set(SHARE_PARAM_KEYS.brakePressure, state.brakePressure);
    params.set(SHARE_PARAM_KEYS.maxSlopeDeg, state.maxSlopeDeg);
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  }

  function shareScenarioLink() {
    const url = buildShareURL();
    copyToClipboard(url).then(() => {
      showToast('🔗 Enlace del escenario copiado');
    }).catch(() => {
      showToast('No se pudo copiar automáticamente — enlace: ' + url);
    });
  }

  // --------------------------------------------------------------------
  // MEJORA — COPIAR RESUMEN DE LA CORRIDA (texto plano al portapapeles)
  // --------------------------------------------------------------------
  // Complementa exportData() (CSV completo): un resumen corto en texto
  // plano, pensado para pegar directo en el chat de una videollamada
  // durante la defensa oral sin tener que abrir/adjuntar el archivo.
  function copyRunSummary() {
    const vehicleProfile = MathCore.getVehicleProfile(state.vehicleType);
    const terrainData = MathCore.getTerrainData(state.terrain);
    const thermal = state.run
      ? MathCore.brakeTemperatureAtRun(state.run, state.simTime, state.massKg)
      : null;
    const lines = [
      `Simulador de Frenado de Emergencia — resumen de corrida`,
      `Maquinaria: ${vehicleProfile.label} (${state.massKg || vehicleProfile.massKg} kg)`,
      `Terreno: ${terrainData.label} — ${ROAD_PROFILE_LABELS[state.roadProfile] || state.roadProfile}`,
      `Velocidad inicial: ${state.initialSpeedKmh} km/h — Presión de freno: ${state.brakePressure}%`,
      `Distancia de frenado: ${state.totalDistance.toFixed(1)} m — Tiempo: ${state.tStop.toFixed(2)} s`,
      thermal ? `Temperatura del disco: ${thermal.temp.toFixed(0)}°C${thermal.isBrakeFade ? ' — ⚠ BRAKE FADE' : ''}` : null,
      `Enlace del escenario: ${buildShareURL()}`
    ].filter(Boolean);

    copyToClipboard(lines.join('\n')).then(() => {
      showToast('📋 Resumen copiado al portapapeles');
    }).catch(() => {
      showToast('No se pudo copiar el resumen automáticamente');
    });
  }

  // --------------------------------------------------------------------
  // EXPORTACIÓN DE DATOS — descarga real de reporte_frenado.csv
  // --------------------------------------------------------------------
  /**
   * Arma un reporte CSV con los datos clave de la corrida actual y lo
   * descarga como `reporte_frenado.csv` usando un Blob + enlace temporal
   * (sin dependencias externas). Funciona con la simulación en curso,
   * detenida o recién previsualizada: siempre usa el estado más reciente.
   */
  /**
   * Genera la serie temporal detallada de la corrida activa, muestreada
   * cada `stepSec` segundos, evaluando DIRECTAMENTE las funciones
   * analíticas de MathCore (positionAtRun/velocityAtRun/brakeTemperatureAtRun)
   * en vez de depender de frames ya renderizados. Ventaja: funciona igual
   * si se exporta ANTES de simular, a mitad de una corrida, o después de
   * que termine — siempre es la curva matemática completa, no una
   * grabación parcial de lo que alcanzó a verse en pantalla.
   * @returns {{rows: string[][], maxTemp: number}}
   */
  function generateDetailedSeriesRows(stepSec = 0.1) {
    const rows = [['t (s)', 'Posición f(t) (m)', 'Velocidad (km/h)', 'Temperatura disco (°C)']];
    const tStop = isFinite(state.tStop) ? state.tStop : 0;
    const tEnd = tStop + COOLING_TAIL_SECONDS;
    let maxTemp = -Infinity;

    for (let t = 0; t <= tEnd + 1e-9; t += stepSec) {
      const tSample = Math.min(t, tEnd);
      const position = MathCore.positionAtRun(state.run, tSample);
      const velocityKmh = MathCore.velocityAtRun(state.run, tSample) * 3.6;
      const thermalSample = MathCore.brakeTemperatureAtRun(state.run, tSample, state.massKg);
      if (thermalSample.temp > maxTemp) maxTemp = thermalSample.temp;
      rows.push([
        tSample.toFixed(2),
        position.toFixed(2),
        velocityKmh.toFixed(2),
        thermalSample.temp.toFixed(1)
      ]);
    }
    return { rows, maxTemp };
  }

  function exportData() {
    const terrainData = MathCore.getTerrainData(state.terrain);
    const vehicleProfile = MathCore.getVehicleProfile(state.vehicleType);
    const thermalNow = MathCore.brakeTemperatureAtRun(state.run, state.simTime, state.massKg);
    const { rows: seriesRows, maxTemp } = generateDetailedSeriesRows(0.1);

    // --- BLOQUE 1: METADATOS ---------------------------------------------
    const metaRows = [
      ['=== METADATOS ==='],
      ['Fecha', new Date().toLocaleString('es-CL')],
      ['Tipo de camino', ROAD_PROFILE_LABELS[state.roadProfile] || state.roadProfile],
      ['Maquinaria', vehicleProfile.label],
      ['Masa (kg)', state.massKg],
      ['Terreno', terrainData.label],
      ['Coeficiente de fricción (μ)', terrainData.mu],
      ['Inclinación máxima del terreno (°)', state.maxSlopeDeg],
      ['Pendiente en el punto de frenado (°)', (state.thetaRad * 180 / Math.PI).toFixed(1)],
      ['¿Pendiente crítica? (gravedad > frenos)', state.slopeCritical ? 'Sí' : 'No'],
      ['Velocidad inicial (km/h)', state.initialSpeedKmh],
      ['Presión de freno (%)', state.brakePressure],
      ['Coeficiente a', state.a.toFixed(4)],
      ['Coeficiente b (m/s)', state.b.toFixed(4)]
    ];

    // --- BLOQUE 2: RESUMEN DE RESULTADOS FINALES --------------------------
    const summaryRows = [
      ['=== RESUMEN DE RESULTADOS ==='],
      ['Distancia Total (m)', state.totalDistance.toFixed(2)],
      ['Tiempo Total de frenado (s)', state.tStop.toFixed(3)],
      ['Temperatura Máxima (°C)', maxTemp.toFixed(1)],
      ['Fuerza de frenado máxima (kN)', (MathCore.brakingForceAt(state.massKg, -2 * state.a) / 1000).toFixed(2)],
      ['Energía cinética inicial (MJ)', (MathCore.kineticEnergyAt(state.massKg, state.b) / 1e6).toFixed(3)],
      ['¿Hubo Brake Fade?', state.run.hasFade ? 'Sí' : 'No'],
      ['Instante de inicio de Brake Fade (s)', state.run.hasFade ? state.run.tFade.toFixed(2) : 'N/A'],
      ['Temperatura al momento de exportar (°C)', thermalNow.temp.toFixed(1)]
    ];

    // --- BLOQUE 3: SERIE TEMPORAL DETALLADA (cada 0.1 s) -------------------
    const seriesHeader = [['=== SERIE TEMPORAL DETALLADA (cada 0.1 s, para graficar en Excel) ===']];

    // Escapa comillas dobles y separa con ';' (compatible con Excel en es-CL);
    // los bloques se unen con una fila en blanco entre sí para que se lean
    // como secciones separadas al abrir el archivo.
    const csvContent = [metaRows, [[]], summaryRows, [[]], seriesHeader, seriesRows]
      .flat()
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    // BOM UTF-8 al inicio para que Excel muestre correctamente las tildes/ñ
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'reporte_frenado.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // --------------------------------------------------------------------
  // CAPTURA DE PANTALLA CON OVERLAY DE DATOS (📸) — evidencia para el
  // informe universitario
  // --------------------------------------------------------------------
  /**
   * Captura el frame actual del canvas 3D y lo descarga como PNG, con un
   * panel de texto "estampado" en la esquina superior izquierda mostrando
   * los datos críticos del instante exacto de la captura.
   *
   * CÓMO FUNCIONA (paso a paso, para la defensa oral):
   *  1) Se fuerza un render inmediato (Scene3D.render(0)) para asegurar
   *     que el framebuffer WebGL tiene el frame más reciente en el
   *     instante exacto del clic, sin esperar al próximo rAF.
   *  2) El canvas de Three.js (`sceneRefs.renderer.domElement`) es un
   *     <canvas> normal del DOM: su contenido se "copia" a OTRO canvas 2D
   *     en memoria con `ctx.drawImage(canvasOrigen, 0, 0)` — igual que se
   *     copiaría cualquier imagen. Esto NO modifica la escena 3D real; el
   *     canvas temporal es solo un lienzo de composición aparte.
   *  3) Sobre ESE canvas temporal (nunca sobre la escena en vivo) se
   *     dibuja un rectángulo semitransparente + texto con el contexto 2D
   *     estándar (fillRect/fillText) — la forma más simple de "estampar"
   *     datos en una imagen ya renderizada, sin librerías externas.
   *  4) `canvas.toBlob()` convierte el resultado compuesto a PNG y se
   *     descarga con el mismo patrón de enlace temporal que usa
   *     exportData() para el CSV.
   */
  function takeScreenshot() {
    if (!sceneRefs || !sceneRefs.renderer) {
      alert('No se puede capturar: el entorno 3D no está disponible en este navegador (sin WebGL).');
      return;
    }

    Scene3D.render(0); // paso 1: asegurar el frame más reciente en el buffer
    const threeCanvas = sceneRefs.renderer.domElement;

    // Paso 2: lienzo de composición del mismo tamaño que el canvas 3D real
    const outCanvas = document.createElement('canvas');
    outCanvas.width = threeCanvas.width;
    outCanvas.height = threeCanvas.height;
    const ctx = outCanvas.getContext('2d');
    ctx.drawImage(threeCanvas, 0, 0, outCanvas.width, outCanvas.height);

    // Paso 3: overlay con los datos EXACTOS que el usuario ve en el HUD
    // en este instante (se leen del propio DOM para garantizar que la
    // imagen coincide 1:1 con la pantalla, sin duplicar estado).
    const vehicleLabel = MathCore.getVehicleProfile(state.vehicleType).label;
    const terrainLabel = MathCore.getTerrainData(state.terrain).label;
    const speedTxt = `${document.getElementById('hudSpeed').textContent} km/h`;
    const distTxt = `${document.getElementById('hudDistance').textContent} m`;
    const tempTxt = `${document.getElementById('hudTemp').textContent} °C`;
    const statusTxt = document.getElementById('hudStatus').textContent;
    // Ronda 10: la ecuación f(t) EXACTA del instante capturado, leída
    // directamente de la pizarra en vivo (mismo texto que ve el usuario
    // en pantalla, sin duplicar lógica de formateo).
    const equationTxt = dom.boardPosition ? `f(t) ${dom.boardPosition.textContent}` : '';

    const scale = outCanvas.width / 1280; // texto proporcional a la resolución real del canvas
    const fontSize = Math.max(13, Math.round(17 * scale));
    const lineHeight = fontSize * 1.5;
    const pad = 16 * scale;

    ctx.font = `600 ${fontSize}px Barlow, sans-serif`;
    const lines = [
      `Maquinaria: ${vehicleLabel}`,
      `Terreno: ${terrainLabel}`,
      `Velocidad: ${speedTxt}`,
      `Distancia recorrida: ${distTxt}`,
      `Temperatura de disco: ${tempTxt}`,
      `Estado: ${statusTxt}`
    ];
    if (equationTxt) lines.push(equationTxt);
    const boxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2;
    const boxHeight = lines.length * lineHeight + pad * 1.6;
    const boxX = 20 * scale, boxY = 20 * scale;

    ctx.fillStyle = 'rgba(10, 13, 16, 0.72)';
    ctx.strokeStyle = 'rgba(255, 204, 0, 0.6)';
    ctx.lineWidth = 2;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 10 * scale);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    }

    ctx.fillStyle = '#f4f4f4';
    lines.forEach((line, i) => {
      ctx.fillText(line, boxX + pad, boxY + pad + (i + 0.85) * lineHeight);
    });

    // Marca de agua con fecha/hora, para trazabilidad de la evidencia
    ctx.font = `400 ${Math.max(10, Math.round(11 * scale))}px 'Share Tech Mono', monospace`;
    ctx.fillStyle = 'rgba(244,244,244,0.7)';
    ctx.fillText(new Date().toLocaleString('es-CL'), boxX + pad, boxY + boxHeight - pad * 0.4);

    // Paso 4: descarga como PNG (mismo patrón de enlace temporal que el CSV)
    outCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `captura_frenado_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  // --------------------------------------------------------------------
  // ARRANQUE DE LA APLICACIÓN
  // --------------------------------------------------------------------
  function init() {
    loadSettings();
    loadSettingsFromURL(); // si el enlace trae un escenario (?v=...), pisa lo guardado en localStorage

    // Refleja la configuración cargada (o los valores por defecto del HTML)
    // en los controles ANTES de construir la escena, para que el terreno
    // inicial ya nazca con la pendiente máxima correcta.
    dom.vehicleSelect.value = state.vehicleType;
    dom.terrainSelect.value = state.terrain;
    dom.roadProfileSelect.value = state.roadProfile;
    dom.speedSlider.value = state.initialSpeedKmh;
    dom.speedValue.textContent = state.initialSpeedKmh;
    dom.brakeSlider.value = state.brakePressure;
    dom.brakeValue.textContent = state.brakePressure;
    dom.maxSlopeSlider.value = state.maxSlopeDeg;
    dom.maxSlopeValue.textContent = state.maxSlopeDeg;

    sceneRefs = Scene3D.init(dom.canvasContainer, state.maxSlopeDeg, state.roadProfile);
    Dashboard.init();
    AudioEngine.setVehicle(state.vehicleType);
    rebuildVehicle();
    recomputeCoefficients();
    Scene3D.setTerrainVisual(state.terrain, MathCore.getTerrainData(state.terrain));
    updateSliderFill(dom.speedSlider);
    updateSliderFill(dom.brakeSlider);
    updateSliderFill(dom.maxSlopeSlider);
    highlightChips(dom.speedChips, state.initialSpeedKmh);
    highlightChips(dom.brakeChips, state.brakePressure);
    highlightChips(dom.maxSlopeChips, state.maxSlopeDeg);
    updateRoadProfileUI();
    showStaticPreview();
    bindEvents();
    initHudSpacingObserver();
    initHotkeys();
    initPresenterCursor();
    animate();
  }

  window.addEventListener('DOMContentLoaded', init);
})();
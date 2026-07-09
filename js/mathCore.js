/**
 * ============================================================================
 *  mathCore.js
 *  NÚCLEO MATEMÁTICO DEL SIMULADOR DE FRENADO DE EMERGENCIA
 * ============================================================================
 *
 *  Este archivo NO conoce Three.js ni Chart.js. Es matemática pura, separada
 *  a propósito (Arquitectura Limpia) para que el estudiante pueda defender
 *  cada fórmula de forma aislada, sin ruido de renderizado.
 *
 *  MODELO FÍSICO DE POSICIÓN
 *  --------------------------
 *  Se modela la posición horizontal recorrida por la máquina durante el
 *  frenado como una función cuadrática del tiempo:
 *
 *        f(t) = -a·t² + b·t
 *
 *  donde:
 *    a  → semi-magnitud de la desaceleración (constante, siempre ≥ 0)
 *    b  → velocidad inicial en el instante t = 0 (m/s)
 *    t  → tiempo transcurrido desde que se pisa el freno (s)
 *
 *  Es una parábola cóncava hacia abajo: la máquina avanza cada vez más
 *  lento hasta detenerse en el vértice de la parábola.
 *
 *  PRIMERA DERIVADA → VELOCIDAD INSTANTÁNEA
 *  ------------------------------------------
 *  Por definición, la velocidad es la razón de cambio de la posición
 *  respecto al tiempo, es decir, la PENDIENTE de la recta tangente a
 *  f(t) en cada instante:
 *
 *        f'(t) = lim (h→0) [f(t+h) - f(t)] / h  =  -2a·t + b
 *
 *  Geométricamente: si dibujamos f(t) como una curva, f'(t) es el valor
 *  de la pendiente de la recta que "toca" esa curva en el punto t sin
 *  cruzarla (la recta tangente). Cuando f'(t) = 0, la máquina está
 *  detenida: ese es exactamente el vértice de la parábola.
 *
 *  SEGUNDA DERIVADA → ACELERACIÓN (CONSTANTE)
 *  ---------------------------------------------
 *  La aceleración es la razón de cambio de la velocidad, o la derivada
 *  de la derivada:
 *
 *        f''(t) = d/dt [f'(t)] = d/dt [-2a·t + b] = -2a
 *
 *  Nótese que f''(t) NO depende de t: es una CONSTANTE negativa. Esto es
 *  coherente con la física: se asume que el sistema de frenos aplica una
 *  fuerza de fricción constante durante todo el frenado (Segunda Ley de
 *  Newton, F = m·a, con F constante ⇒ a constante). Por eso el modelo
 *  cuadrático (y no uno de mayor grado) es la elección correcta para
 *  este fenómeno.
 *
 *  RECTA TANGENTE EN UN PUNTO t₀
 *  --------------------------------
 *  La ecuación punto-pendiente de la recta tangente a f en t₀ es:
 *
 *        L(t) = f(t₀) + f'(t₀)·(t - t₀)
 *
 *  Esta recta representa la MEJOR APROXIMACIÓN LINEAL de f cerca de t₀,
 *  y su pendiente es, precisamente, la velocidad instantánea en t₀.
 *
 *  LÍMITES Y LEY DE ENFRIAMIENTO DE NEWTON (TEMPERATURA DE FRENOS)
 *  -------------------------------------------------------------------
 *  La fricción entre las pastillas y el disco convierte energía cinética
 *  en calor. Una vez que el vehículo se detiene (o incluso mientras el
 *  calor se disipa al ambiente), el disco se enfría según la Ley de
 *  Enfriamiento de Newton:
 *
 *        T(t) = T_amb + (T_pico - T_amb)·e^(-k·(t - t_parada))
 *
 *  El concepto de LÍMITE aparece aquí de forma central:
 *
 *        lim (t→∞) T(t) = T_amb
 *
 *  porque e^(-k·x) → 0 cuando x → ∞. Esto significa que la curva de
 *  temperatura tiene una ASÍNTOTA HORIZONTAL en T = T_amb: el disco
 *  nunca "salta" bruscamente a temperatura ambiente, se aproxima a ella
 *  indefinidamente sin tocarla jamás en tiempo finito (en el modelo
 *  matemático continuo).
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// CONSTANTES FÍSICAS GLOBALES
// ---------------------------------------------------------------------------
const GRAVITY = 9.8;              // Aceleración de la gravedad terrestre (m/s²)
const AMBIENT_TEMP = 24;          // Temperatura ambiente de referencia (°C)
const COOLING_CONSTANT = 0.045;   // k de Newton: qué tan rápido se enfría el disco (1/s)
const HEAT_GAIN_FACTOR = 0.00085; // Constante empírica que liga masa·v² con el pico de temperatura
const BRAKE_FADE_TEMP = 400;      // Umbral (°C) sobre el cual se considera "brake fade" (falla térmica)

// Fracción de la desaceleración nominal que el sistema logra retener una
// vez que se cruza el umbral de brake fade (400°C). 0.55 = se pierde ~45%
// de la efectividad de frenado porque las pastillas "vitrificadas" ya no
// muerden el disco con el mismo coeficiente de fricción.
const BRAKE_FADE_REDUCTION = 0.55;

// ---------------------------------------------------------------------------
// PENDIENTE DEL TERRENO Y SU EFECTO EN LA DESACELERACIÓN (Ronda 8 — Faena Minera)
// ---------------------------------------------------------------------------
/**
 * Cuando la carretera no es plana, el peso del vehículo (m·g) tiene una
 * componente que actúa EN LA MISMA DIRECCIÓN de la pista (no solo hacia
 * abajo), y esa componente ayuda o estorba al frenado según el sentido de
 * la pendiente θ (theta, en radianes; θ > 0 = bajando, θ < 0 = subiendo,
 * siguiendo la convención de `Scene3D.getSlopeAt`):
 *
 *   Normal al terreno   N = m·g·cos(θ)   → la fricción disponible es μ·N,
 *                                          por eso μ·g·cos(θ) reemplaza al
 *                                          clásico μ·g de piso plano (con
 *                                          pendiente pronunciada, cos(θ)<1,
 *                                          hay MENOS normal y por lo tanto
 *                                          menos fricción disponible).
 *   Componente gravitacional paralela a la pista = g·sin(θ)
 *
 *   θ > 0 (CUESTA ABAJO): la gravedad empuja al vehículo en el mismo
 *   sentido en que se mueve, así que se RESTA a la capacidad de frenado:
 *   el camión frena mucho más lento y recorre más distancia.
 *   θ < 0 (CUESTA ARRIBA): la gravedad actúa en contra del movimiento, así
 *   que se SUMA a la capacidad de frenado: el propio peso ayuda a
 *   detener el vehículo antes.
 *
 * La capacidad de desaceleración que permite el terreno pasa de ser el
 * μ·g plano (Ronda 7) a:
 *
 *      decelCapacidad(θ) = μ·g·cos(θ) − g·sin(θ)
 *
 * y este valor —no μ·g— es ahora el tope físico que usa `computeCoefficientA`
 * (el sistema de frenos, por más fuerza que aplique, nunca puede superar lo
 * que el terreno+gravedad permiten en ese punto).
 *
 * CASO EXTREMO: en una bajada muy pronunciada con terreno muy resbaladizo
 * (μ bajo), decelCapacidad(θ) puede volverse NEGATIVA — significa que ni
 * frenando a fondo se puede vencer a la gravedad, y en la vida real el
 * vehículo ACELERARÍA cuesta abajo pese a tener los frenos aplicados. El
 * modelo cuadrático f(t) = -a·t² + b·t de este simulador exige a ≥ 0 (es
 * un modelo de FRENADO, no de caída libre/aceleración), así que en ese caso
 * se satura `decelMagnitude` en `MIN_DECEL_FLOOR` y se levanta la bandera
 * `slopeCritical` para que la UI le muestre al usuario/estudiante una
 * advertencia explícita ("pendiente crítica: los frenos no bastan") en vez
 * de fingir silenciosamente que el vehículo se detiene con normalidad.
 *
 * APROXIMACIÓN CUASI-ESTÁTICA (decisión de diseño explícita): θ se evalúa
 * UNA sola vez, en la posición donde arranca el frenado, y se mantiene
 * constante durante toda esa corrida. Esto conserva el modelo cerrado en
 * forma cuadrática —imprescindible para la lección de derivadas de primer
 * y segundo orden (f, f', f'')— a cambio de no recalcular la pendiente
 * instante a instante si el mismo frenado cruzara de bajada a subida. Es
 * una simplificación de ingeniería documentada, no una omisión accidental.
 */
const MIN_DECEL_FLOOR = 0.05; // m/s² — piso mínimo para que a = decel/2 > 0 (el modelo cuadrático lo exige)

// Masa de referencia (kg) usada para calibrar la CAPACIDAD de frenado del
// sistema hidráulico/neumático (ver computeCoefficientA, Ronda 7). Se eligió
// el furgón (2000 kg) porque es la máquina más liviana del catálogo: con
// esta referencia, a masa de referencia el modelo se comporta exactamente
// igual que el límite físico clásico (decel = μ·g·η·presión), y para
// máquinas más pesadas la MISMA fuerza de frenado (ahora dividida por una
// masa mayor, F = m·a ⇒ a = F/m) produce una desaceleración menor.
const REFERENCE_MASS_KG = 2000;

// ---------------------------------------------------------------------------
// TABLAS DE PARÁMETROS (fuente única de verdad para masa y fricción)
// ---------------------------------------------------------------------------

/**
 * Coeficiente de fricción cinética (μ) aproximado según el tipo de terreno.
 * A menor μ, menor fuerza de frenado disponible, mayor distancia de frenado.
 * Cada terreno también declara metadatos puramente visuales (`weather`,
 * `roadTint`) que consume scene3D.js para cambiar el aspecto de la pista
 * (nieve cayendo, lluvia, tono del asfalto) — no afectan ningún cálculo.
 */
const TERRAIN_FRICTION = {
  asfalto: { mu: 0.80, label: 'Asfalto seco', weather: 'despejado', roadTint: 0x2b2f33 },
  mojado:  { mu: 0.55, label: 'Asfalto mojado / Lluvia', weather: 'lluvia', roadTint: 0x1c2226 },
  grava:   { mu: 0.50, label: 'Grava', weather: 'despejado', roadTint: 0x4a4136 },
  barro:   { mu: 0.35, label: 'Barro', weather: 'lluvia', roadTint: 0x3a2c1f },
  nieve:   { mu: 0.25, label: 'Nieve', weather: 'nieve', roadTint: 0xd8dee2 },
  hielo:   { mu: 0.12, label: 'Hielo', weather: 'nieve', roadTint: 0xaecbd6 }
};

/**
 * Perfil de cada máquina: masa (kg), y un factor de eficiencia de frenos
 * (las máquinas más pesadas tienen sistemas de freno relativamente menos
 * eficientes respecto a su propia masa, lo cual es realista en minería).
 */
const VEHICLE_PROFILES = {
  furgon: {
    label: 'Furgón (2 ton)',
    massKg: 2000,
    brakeEfficiency: 1.00,
    scale: 1.0
  },
  bus: {
    label: 'Bus (15 ton)',
    massKg: 15000,
    brakeEfficiency: 0.90,
    scale: 1.9
  },
  articulado: {
    label: 'Camión Articulado (25 ton)',
    massKg: 25000,
    brakeEfficiency: 0.82,
    scale: 2.3
  },
  grua: {
    label: 'Grúa Industrial (45 ton)',
    massKg: 45000,
    brakeEfficiency: 0.75,
    scale: 2.6
  },
  minero: {
    label: 'Camión Minero (300 ton)',
    massKg: 300000,
    brakeEfficiency: 0.62,
    scale: 3.4
  }
};

// NOTA PARA LA DEFENSA ORAL — relación Masa ↔ Desaceleración ↔ Fuerza (Ronda 7):
// -----------------------------------------------------------------------
// Desde la Ronda 7, la masa (`massKg`) SÍ participa directamente en el
// cálculo de `a` (ver computeCoefficientA): a = F_frenado / massKg, la
// Segunda Ley de Newton aplicada explícitamente. La masa cumple ahora TRES
// roles, todos coherentes entre sí:
//   1) Vía `computeCoefficientA(mu, brakeEfficiency, brakePressurePct, massKg)`:
//      la MISMA fuerza de frenado (calibrada a REFERENCE_MASS_KG = furgón)
//      produce menos desaceleración cuanto mayor es `massKg` — por eso el
//      camión minero, con la misma presión de freno que el furgón, tiene
//      una `a` mucho menor y una distancia de frenado mucho mayor.
//   2) Vía `brakeEfficiency`: modela además que el sistema hidráulico de
//      una máquina más pesada logra un % menor de la fricción teórica
//      disponible (ineficiencia mecánica adicional, independiente del
//      efecto de masa del punto 1).
//   3) Vía `brakingForceAt(m, a) = m·a` y `kineticEnergyAt(m, v) = ½·m·v²`:
//      la masa también determina la magnitud de la fuerza que deben
//      disipar los frenos y la energía cinética que se convierte en calor
//      — el camión minero genera muchísima más fuerza de frenado y energía
//      térmica que el furgón, y por lo tanto llega antes al umbral de
//      `brakeFade` pese a frenar con una `a` menor.
// En todos los casos, la desaceleración está topada en μ·g (límite físico
// de fricción neumático-terreno): ningún sistema de frenos, por potente
// que sea, puede superar ese límite sin bloquear las ruedas.
// -----------------------------------------------------------------------

// ---------------------------------------------------------------------------
// FUNCIONES DE ACCESO A TABLAS
// ---------------------------------------------------------------------------

function getTerrainData(terrainKey) {
  return TERRAIN_FRICTION[terrainKey] || TERRAIN_FRICTION.asfalto;
}

function getVehicleProfile(vehicleKey) {
  return VEHICLE_PROFILES[vehicleKey] || VEHICLE_PROFILES.furgon;
}

// ---------------------------------------------------------------------------
// CÁLCULO DE COEFICIENTES a, b DE LA CUADRÁTICA f(t) = -a·t² + b·t
// ---------------------------------------------------------------------------

/**
 * Calcula el coeficiente "a" de la ecuación de posición.
 *
 * MODELO ACTUALIZADO (Ronda 7) — Segunda Ley de Newton aplicada al frenado:
 * la desaceleración real ya NO es independiente de la masa. Se calcula
 * explícitamente como a = F/m:
 *
 *      F_frenado = μ · g · REFERENCE_MASS_KG · η_freno · (presiónFreno/100)
 *      decel     = F_frenado / massKg
 *
 * donde η_freno es la eficiencia mecánica del sistema de frenos de esa
 * máquina en particular, y REFERENCE_MASS_KG (2000 kg, el furgón) calibra
 * la CAPACIDAD de fuerza de frenado (Newtons) disponible: un sistema de
 * frenos real no escala su fuerza linealmente con la masa del vehículo
 * (discos/pastillas más grandes ayudan, pero no compensan del todo cientos
 * de toneladas), así que la MISMA fuerza de frenado (calibrada al furgón)
 * produce una desaceleración cada vez menor a medida que `massKg` crece —
 * exactamente el efecto físico pedido: a mayor masa, menor `a`, mayor
 * distancia de frenado con la misma presión de freno.
 *
 * Como en el modelo cuadrático f''(t) = -2a, y f''(t) debe ser igual a
 * -decel (negativa porque frena), se despeja:
 *
 *      a = decel / 2
 *
 * TOPE FÍSICO: la desaceleración nunca puede superar μ·g (el límite de
 * fricción disponible entre neumático y terreno); por encima de ese valor
 * las ruedas patinarían/bloquearían en vez de frenar más rápido. Esto
 * también evita que, para el furgón (masa = REFERENCE_MASS_KG), el modelo
 * "se pase" del límite físico clásico cuando η_freno·presión ≥ 1.
 *
 * @param {number} mu               Coeficiente de fricción del terreno
 * @param {number} brakeEfficiency  Eficiencia del sistema de frenos (0-1)
 * @param {number} brakePressurePct Presión de freno aplicada por el usuario (0-100)
 * @param {number} massKg           Masa real del vehículo seleccionado (kg)
 * @param {number} thetaRad         Pendiente del terreno en el punto de inicio del
 *                                   frenado, en radianes (0 = plano, ver nota de
 *                                   PENDIENTE DEL TERRENO más arriba). Opcional,
 *                                   por defecto 0 (compatibilidad con llamadas
 *                                   anteriores que no conocían el terreno 3D).
 *                                   NOTA (Ronda 9): desde el selector "Perfil
 *                                   del camino" de la UI, este radián puede
 *                                   provenir de tres fuentes en Scene3D:
 *                                   Recto → 0 siempre; Lomas → variable según
 *                                   la onda senoidal; Bajada pronunciada →
 *                                   15° fijo. Esta función no necesita saber
 *                                   cuál está activo, solo recibe el radián
 *                                   ya resuelto (ver Scene3D.setRoadProfile).
 * @returns {{a:number, decelMagnitude:number, slopeDecelCapacity:number, slopeCritical:boolean}}
 */
function computeCoefficientA(mu, brakeEfficiency, brakePressurePct, massKg, thetaRad = 0) {
  const pressureRatio = Math.max(0, Math.min(100, brakePressurePct)) / 100;
  const safeMassKg = massKg > 0 ? massKg : REFERENCE_MASS_KG;

  // decelCapacidad(θ) = μ·g·cos(θ) − g·sin(θ)  (ver nota extensa arriba).
  // Reemplaza al μ·g plano de la Ronda 7 como tope físico del terreno.
  const slopeDecelCapacity = mu * GRAVITY * Math.cos(thetaRad) - GRAVITY * Math.sin(thetaRad);

  // F = m · a  ⇒  a = F / m  (Segunda Ley de Newton aplicada al frenado)
  const brakeForceN = mu * GRAVITY * REFERENCE_MASS_KG * brakeEfficiency * pressureRatio;
  let decelMagnitude = brakeForceN / safeMassKg;

  // Tope físico: no se puede desacelerar más rápido que lo que el terreno
  // Y la gravedad (según la pendiente) permiten en ese punto.
  decelMagnitude = Math.min(decelMagnitude, slopeDecelCapacity);

  // Bandera de "pendiente crítica": el terreno/gravedad ya no dejan margen
  // de frenado real (decelCapacidad ≤ piso mínimo) — en la vida real el
  // vehículo aceleraría cuesta abajo pese a frenar. Se satura `decelMagnitude`
  // en el piso mínimo para mantener el modelo cuadrático válido (a > 0).
  const slopeCritical = decelMagnitude <= MIN_DECEL_FLOOR;
  decelMagnitude = Math.max(decelMagnitude, MIN_DECEL_FLOOR);

  const a = decelMagnitude / 2;
  return { a, decelMagnitude, slopeDecelCapacity, slopeCritical };
}

/**
 * El coeficiente "b" es, por definición del modelo, la velocidad inicial
 * en unidades de m/s (f'(0) = -2a·0 + b = b). Se recibe en km/h desde la
 * UI y se convierte.
 */
function computeCoefficientB(initialSpeedKmh) {
  return initialSpeedKmh / 3.6; // km/h -> m/s
}

// ---------------------------------------------------------------------------
// FUNCIÓN DE POSICIÓN f(t) Y SUS DERIVADAS
// ---------------------------------------------------------------------------

/**
 * Tiempo en el que la máquina se detiene por completo: raíz de f'(t) = 0.
 *      -2a·t + b = 0  ⇒  t = b / (2a)
 */
function stopTime(a, b) {
  if (a <= 0) return Infinity;
  return b / (2 * a);
}

/**
 * Posición f(t) = -a·t² + b·t, saturada en la distancia final una vez que
 * la máquina se detiene (después de t_parada la posición física no
 * retrocede, aunque la parábola matemática pura sí lo haría).
 */
function positionAt(t, a, b) {
  const tStop = stopTime(a, b);
  const tClamped = Math.min(t, tStop);
  return -a * tClamped * tClamped + b * tClamped;
}

/**
 * f'(t): primera derivada = velocidad instantánea (m/s).
 * Se satura en 0 tras la detención (la velocidad no puede ser negativa
 * en este fenómeno de frenado).
 */
function velocityAt(t, a, b) {
  const tStop = stopTime(a, b);
  if (t >= tStop) return 0;
  return -2 * a * t + b;
}

/**
 * f''(t): segunda derivada = aceleración (m/s²), constante durante el
 * frenado activo y 0 una vez detenido el vehículo (ya no hay fuerza neta).
 */
function accelerationAt(t, a, b) {
  const tStop = stopTime(a, b);
  if (t >= tStop) return 0;
  return -2 * a;
}

/**
 * Distancia total de frenado: valor de f(t) evaluado en t_parada.
 * Equivale a sustituir t = b/(2a) en f(t), lo que algebraicamente da:
 *      f(t_parada) = b² / (4a)
 */
function totalStopDistance(a, b) {
  if (a <= 0) return 0;
  return (b * b) / (4 * a);
}

/**
 * Ecuación de la recta tangente a f(t) en el instante t0:
 *      L(t) = f(t0) + f'(t0)·(t - t0)
 * Se usa para dibujar en vivo la recta tangente sobre la curva de posición.
 */
function tangentLineAt(t0, a, b, t) {
  const f_t0 = positionAt(t0, a, b);
  const fPrime_t0 = velocityAt(t0, a, b);
  return f_t0 + fPrime_t0 * (t - t0);
}

// ---------------------------------------------------------------------------
// FUNCIÓN SECCIONADA CON BRAKE FADE ("run") — NIVEL INGENIERÍA
// ---------------------------------------------------------------------------
/**
 * Estima el instante t_fade en el que la temperatura del disco (bajo el
 * modelo de calentamiento definido en brakeTemperatureAt) cruzaría los
 * BRAKE_FADE_TEMP °C, ASUMIENDO que la corrida completa mantiene la
 * desaceleración nominal `a`. Se invierte algebraicamente la fase de
 * calentamiento T(ratio) = T_amb + (pico-T_amb)·(1-e^(-3·ratio)):
 *
 *      ratio = -ln(1 - (T_umbral - T_amb)/(pico - T_amb)) / 3
 *      t_fade = ratio · t_parada_nominal
 *
 * Si el pico teórico nunca alcanza el umbral, devuelve null (no hay fade).
 */
function estimateFadeOnsetTime(a, b, massKg) {
  const tStopNominal = stopTime(a, b);
  if (!isFinite(tStopNominal) || tStopNominal <= 0) return null;
  const peak = peakBrakeTemperature(massKg, b);
  if (peak <= BRAKE_FADE_TEMP) return null;
  const target = (BRAKE_FADE_TEMP - AMBIENT_TEMP) / (peak - AMBIENT_TEMP);
  if (target >= 1 || target <= 0) return null;
  const ratio = -Math.log(1 - target) / 3;
  if (ratio >= 1) return null;
  return ratio * tStopNominal;
}

/**
 * Construye la trayectoria completa de una corrida como una función
 * SECCIONADA (piecewise) de dos tramos, cada uno una parábola con f''
 * constante propia — exactamente el mismo modelo de mathCore, aplicado
 * dos veces con continuidad de posición y velocidad en el punto de unión:
 *
 *   Tramo 1 (0 ≤ t < t_fade):  f1(t) = -a·t² + b·t            (frenos sanos)
 *   Tramo 2 (t ≥ t_fade):      f2(t) = f1(t_fade) + g(t-t_fade)
 *                              g(τ) = -a2·τ² + v1·τ            (frenos con fade)
 *
 * donde a2 = a · BRAKE_FADE_REDUCTION (menor desaceleración disponible) y
 * v1 = f1'(t_fade) (la velocidad no puede "saltar" entre tramos).
 * Si nunca se alcanza el umbral térmico, el tramo 2 es idéntico al 1
 * (hasFade = false) y el comportamiento es el mismo que antes.
 *
 * @returns {{a1,b1,tFade,a2,b2,p1AtFade,tStop,hasFade}}
 */
function buildRun(a, b, massKg) {
  const tFade = estimateFadeOnsetTime(a, b, massKg);
  if (tFade === null) {
    return { a1: a, b1: b, tFade: Infinity, a2: a, b2: b, p1AtFade: 0, tStop: stopTime(a, b), hasFade: false };
  }
  const p1AtFade = positionAt(tFade, a, b);
  const v1AtFade = velocityAt(tFade, a, b);
  const a2 = a * BRAKE_FADE_REDUCTION;
  const tStop2 = stopTime(a2, v1AtFade);
  return { a1: a, b1: b, tFade, a2, b2: v1AtFade, p1AtFade, tStop: tFade + tStop2, hasFade: true };
}

function positionAtRun(run, t) {
  if (t < run.tFade) return positionAt(t, run.a1, run.b1);
  return run.p1AtFade + positionAt(t - run.tFade, run.a2, run.b2);
}

function velocityAtRun(run, t) {
  if (t < run.tFade) return velocityAt(t, run.a1, run.b1);
  return velocityAt(t - run.tFade, run.a2, run.b2);
}

function accelerationAtRun(run, t) {
  if (t < run.tFade) return accelerationAt(t, run.a1, run.b1);
  return accelerationAt(t - run.tFade, run.a2, run.b2);
}

function totalStopDistanceRun(run) {
  return positionAtRun(run, run.tStop);
}

/**
 * Temperatura del disco para una corrida con posible fade. Reutiliza
 * brakeTemperatureAt con el t_parada REAL de la corrida (run.tStop, que
 * ya incorpora el tramo 2 más largo) para que la fase de enfriamiento
 * arranque en el momento correcto.
 */
function brakeTemperatureAtRun(run, t, massKg) {
  const result = brakeTemperatureAt(t, run.a1, run.b1, massKg);
  // Si el t_parada real difiere del nominal (por el tramo 2 más lento),
  // recalculamos la fase usando el t_parada verdadero de la corrida.
  const tStop = run.tStop;
  const v0 = run.b1;
  const peak = peakBrakeTemperature(massKg, v0);
  let out;
  if (t <= tStop || !isFinite(tStop)) {
    const safeTStop = isFinite(tStop) && tStop > 0 ? tStop : 1;
    const ratio = Math.min(1, t / safeTStop);
    const temp = AMBIENT_TEMP + (peak - AMBIENT_TEMP) * (1 - Math.exp(-3 * ratio));
    out = { temp, peak, phase: 'calentando' };
  } else {
    const elapsedCooling = t - tStop;
    const temp = AMBIENT_TEMP + (peak - AMBIENT_TEMP) * Math.exp(-COOLING_CONSTANT * elapsedCooling);
    out = { temp, peak, phase: 'enfriando' };
  }
  out.isBrakeFade = run.hasFade && t >= run.tFade && out.temp >= BRAKE_FADE_TEMP - 0.01;
  // Nunca "baja" del umbral mientras siga en fase de frenado activo del tramo 2:
  if (run.hasFade && t >= run.tFade && t <= tStop) out.isBrakeFade = true;
  return out;
}

// ---------------------------------------------------------------------------
// ENERGÍA CINÉTICA Y FUERZA DE FRENADO
// ---------------------------------------------------------------------------

/**
 * Energía cinética instantánea del vehículo: Ec = ½·m·v².
 * Es la energía que el sistema de frenos debe convertir en calor durante
 * el frenado. A mayor masa o velocidad, mayor energía a disipar — de ahí
 * que el camión minero caliente sus discos mucho más que el furgón aunque
 * ambos desaceleren con un porcentaje de eficiencia similar.
 * @param {number} massKg
 * @param {number} velocityMs
 * @returns {number} Energía en Joules (J)
 */
function kineticEnergyAt(massKg, velocityMs) {
  return 0.5 * massKg * velocityMs * velocityMs;
}

/**
 * Fuerza de frenado instantánea: Segunda Ley de Newton, F = m·a.
 * Se reporta en magnitud (valor absoluto) porque interesa la intensidad
 * de la fuerza que deben soportar las pastillas y el disco, no su signo.
 * @param {number} massKg
 * @param {number} accelerationMs2  Aceleración con signo (f''(t))
 * @returns {number} Fuerza en Newtons (N)
 */
function brakingForceAt(massKg, accelerationMs2) {
  return massKg * Math.abs(accelerationMs2);
}

// ---------------------------------------------------------------------------
// TERMODINÁMICA DE FRENOS — LEY DE ENFRIAMIENTO DE NEWTON
// ---------------------------------------------------------------------------

/**
 * Temperatura pico teórica alcanzada por el disco al final del frenado,
 * derivada de la energía cinética disipada: E_c = ½·m·v².
 * A mayor masa y mayor velocidad inicial, mayor energía convertida en
 * calor, y por lo tanto mayor pico de temperatura.
 */
function peakBrakeTemperature(massKg, initialSpeedMs) {
  const kineticEnergyProxy = massKg * initialSpeedMs * initialSpeedMs;
  return AMBIENT_TEMP + HEAT_GAIN_FACTOR * kineticEnergyProxy;
}

/**
 * Temperatura del disco de freno en el instante t.
 *
 * FASE 1 (0 ≤ t ≤ t_parada): el disco se calienta rápidamente por la
 * fricción, aproximándose de forma asintótica (pero creciente) al pico
 * de temperatura mediante una función 1 - e^(-3·ratio). Esto evita un
 * salto brusco y modela cómo el calor se acumula progresivamente.
 *
 * FASE 2 (t > t_parada): ya no hay fricción de frenado activa (el
 * vehículo está detenido), así que el disco simplemente se enfría hacia
 * la temperatura ambiente según la Ley de Enfriamiento de Newton:
 *
 *      T(t) = T_amb + (T_pico - T_amb)·e^(-k·(t - t_parada))
 *
 * Cuando t → ∞, el término exponencial tiende a 0, por lo que:
 *
 *      lim (t→∞) T(t) = T_amb     (ASÍNTOTA HORIZONTAL)
 *
 * FALLA TÉRMICA (BRAKE FADE):
 * Si en cualquier instante la temperatura calculada supera `BRAKE_FADE_TEMP`
 * (400 °C), se marca `isBrakeFade = true`. Físicamente, sobre ese umbral el
 * material de las pastillas empieza a perder coeficiente de fricción
 * (outgassing / vitrificación), es decir, el propio frenado se vuelve menos
 * efectivo — de ahí el nombre "fade". Este simulador no recalcula la
 * cinemática cuando ocurre (para no complicar el modelo cuadrático base),
 * pero sí expone la bandera para que la UI alerte al usuario/estudiante.
 *
 * @returns {{temp:number, peak:number, phase:'calentando'|'enfriando', isBrakeFade:boolean}}
 */
function brakeTemperatureAt(t, a, b, massKg) {
  const tStop = stopTime(a, b);
  const v0 = b;
  const peak = peakBrakeTemperature(massKg, v0);

  let result;
  if (t <= tStop || !isFinite(tStop)) {
    const safeTStop = isFinite(tStop) && tStop > 0 ? tStop : 1;
    const ratio = Math.min(1, t / safeTStop);
    const temp = AMBIENT_TEMP + (peak - AMBIENT_TEMP) * (1 - Math.exp(-3 * ratio));
    result = { temp, peak, phase: 'calentando' };
  } else {
    const elapsedCooling = t - tStop;
    const temp = AMBIENT_TEMP + (peak - AMBIENT_TEMP) * Math.exp(-COOLING_CONSTANT * elapsedCooling);
    result = { temp, peak, phase: 'enfriando' };
  }
  result.isBrakeFade = result.temp >= BRAKE_FADE_TEMP;
  return result;
}

// ---------------------------------------------------------------------------
// EXPORTACIÓN (namespace global simple, sin bundlers, para máxima compatibilidad)
// ---------------------------------------------------------------------------
window.MathCore = {
  GRAVITY,
  AMBIENT_TEMP,
  BRAKE_FADE_TEMP,
  BRAKE_FADE_REDUCTION,
  MIN_DECEL_FLOOR,
  REFERENCE_MASS_KG,
  TERRAIN_FRICTION,
  VEHICLE_PROFILES,
  getTerrainData,
  getVehicleProfile,
  computeCoefficientA,
  computeCoefficientB,
  stopTime,
  positionAt,
  velocityAt,
  accelerationAt,
  totalStopDistance,
  tangentLineAt,
  kineticEnergyAt,
  brakingForceAt,
  peakBrakeTemperature,
  brakeTemperatureAt,
  // API "run" (seccionada, con brake fade dinámico) — usada por main.js
  buildRun,
  positionAtRun,
  velocityAtRun,
  accelerationAtRun,
  totalStopDistanceRun,
  brakeTemperatureAtRun
};
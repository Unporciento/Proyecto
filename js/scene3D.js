/**
 * ============================================================================
 *  scene3D.js
 *  CONFIGURACIÓN BASE DE LA ESCENA THREE.JS
 * ============================================================================
 *  Responsable de: renderer, cámara, luces, suelo/carretera y OrbitControls.
 *  No conoce nada de matemática de frenado ni de vehículos: solo prepara el
 *  "escenario" sobre el cual main.js coloca al vehículo.
 * ============================================================================
 */

const Scene3D = (function () {

  let scene, camera, renderer, controls;
  let roadGroup, markerGroup, skidMarksGroup, smokeGroup, weatherGroup, coneGroup;
  // Ronda 7: se pone en `true` solo si init() construyó la escena real
  // (WebGL disponible). El resto de las funciones públicas de este módulo
  // lo consultan como guardia para no operar sobre `scene`/`renderer`
  // inexistentes cuando se usó el fallback sin WebGL — así main.js puede
  // seguir llamando a Scene3D.* con total normalidad sin `if` extra.
  let sceneReady = false;
  let smokeParticles = []; // {points, life, maxLife} — puffs de humo activos
  let sparkParticles = []; // {points, life, maxLife} — chispas de brake fade activas
  let weatherParticles = null; // { points, velocities, kind: 'lluvia'|'nieve' }
  let roadMeshRef = null; // referencia al mesh de asfalto para poder retintarlo por terreno

  // Longitud total de la carretera en unidades del mundo 3D (metros virtuales)
  const ROAD_LENGTH = 260;
  const ROAD_WIDTH = 14;

  // --------------------------------------------------------------------
  // TERRENO CON PENDIENTE (Ronda 8 — Faena Minera Dinámica)
  // --------------------------------------------------------------------
  // Modelamos la altura de la pista como una onda senoidal a lo largo del
  // eje Z (dirección de avance del vehículo): y(z) = A · sin(FREQ · z).
  // La PENDIENTE en cualquier punto es, por definición, la derivada de esa
  // función de altura respecto a la distancia recorrida:
  //      dy/dz = A · FREQ · cos(FREQ · z)
  // y el ÁNGULO real de la pendiente es θ(z) = atan(dy/dz) — exactamente el
  // mismo concepto de "recta tangente a una curva" que ya usa mathCore.js
  // para f(t), aplicado ahora a la forma del terreno en vez del tiempo.
  const TERRAIN_FREQ = 0.045; // rad/m — controla cuán seguido ondula la pista (perfil "Lomas")
  let terrainAmplitude = 0;   // metros — se deriva de "Inclinación Máxima" vía setMaxSlope()

  // --------------------------------------------------------------------
  // PERFIL DE CAMINO (Ronda 9 — selector "Recto / Lomas / Bajada pronunciada")
  // --------------------------------------------------------------------
  // `roadProfile` decide qué función de altura/pendiente usan getHeightAt()
  // y getSlopeAt() más abajo. El resto del simulador (main.js, mathCore.js)
  // NO sabe cuál está activo: solo consume estas dos funciones, así que
  // cambiar el perfil es transparente para la física y para el 3D.
  let roadProfile = 'lomas'; // 'recto' | 'lomas' | 'bajada'

  // Ángulo constante del perfil "Bajada pronunciada": a diferencia de
  // "Lomas" (que ondula, sube y baja), este es un plano inclinado hacia
  // abajo de punta a punta de la pista — el peor caso para la física de
  // frenado (ver nota de PENDIENTE DEL TERRENO en mathCore.js).
  const BAJADA_ANGLE_DEG = 15;
  const BAJADA_THETA_RAD = THREE.MathUtils.degToRad(BAJADA_ANGLE_DEG);

  // z donde "empieza" la carretera (altura de referencia = 0 ahí); origen
  // del plano inclinado del perfil "Bajada".
  const ROAD_ORIGIN_Z = -ROAD_LENGTH / 2;

  /** Altura (mundo Y) del terreno en la distancia z, según el perfil activo. */
  function getHeightAt(z) {
    switch (roadProfile) {
      case 'recto':
        return 0;
      case 'bajada':
        // Plano inclinado: baja de forma constante a medida que z crece
        // (el vehículo avanza hacia +z), sin ondulación.
        return -Math.tan(BAJADA_THETA_RAD) * (z - ROAD_ORIGIN_Z);
      case 'lomas':
      default:
        return terrainAmplitude * Math.sin(z * TERRAIN_FREQ);
    }
  }

  /**
   * Ángulo de pendiente (radianes) en la distancia z: θ = atan(dy/dz).
   * θ > 0 ⇒ terreno subiendo en la dirección +z; el vehículo avanza hacia
   * +z, así que cuando se calcula la física de frenado se usa -θ en ese
   * punto de inicio para que "positivo" signifique CUESTA ABAJO (ver
   * mathCore.js, nota de PENDIENTE DEL TERRENO) — main.js hace esa
   * conversión de signo al leer este valor para la física. Depende del
   * perfil de camino activo (roadProfile).
   */
  function getSlopeAt(z) {
    switch (roadProfile) {
      case 'recto':
        return 0;
      case 'bajada':
        return -BAJADA_THETA_RAD; // pendiente negativa constante = bajando en +z
      case 'lomas':
      default: {
        const dydz = terrainAmplitude * TERRAIN_FREQ * Math.cos(z * TERRAIN_FREQ);
        return Math.atan(dydz);
      }
    }
  }

  /** A = tan(θ_max) / FREQ, despejado de "pendiente máxima = A·FREQ ≈ tan(θ_max)". */
  function amplitudeForMaxSlope(maxSlopeDeg) {
    const thetaMax = THREE.MathUtils.degToRad(maxSlopeDeg);
    return Math.tan(thetaMax) / TERRAIN_FREQ;
  }

  /** Desplaza los vértices Z de una PlaneGeometry (aún sin rotar) según getHeightAt,
   *  y recalcula normales para que la iluminación siga la superficie ondulada.
   *  Nota de ejes: PlaneGeometry nace en el plano XY; tras `rotation.x = -90°`
   *  (usado en buildRoad), el eje local Y pasa a ser el mundo -Z, y el eje
   *  local Z pasa a ser el mundo Y (altura) — por eso desplazamos Z aquí. */
  function displaceTerrainGeometry(geometry) {
    const posAttr = geometry.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const localY = posAttr.getY(i);
      const worldZ = -localY;
      posAttr.setZ(i, getHeightAt(worldZ));
    }
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  /**
   * Crea una textura procedural de asfalto con líneas discontinuas,
   * usando un <canvas> 2D en memoria. Evita dependencias externas (CORS-free).
   * `tintHex` permite reteñir la base según el terreno seleccionado (p.ej.
   * un gris azulado para hielo, un gris muy oscuro y brillante para
   * asfalto mojado, un blanco grisáceo para nieve).
   */
  function buildRoadTexture(tintHex = 0x2b2f33) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    const tint = new THREE.Color(tintHex);
    const r = Math.round(tint.r * 255), g = Math.round(tint.g * 255), b = Math.round(tint.b * 255);

    // Base del terreno (color depende del tipo seleccionado)
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ruido sutil
    for (let i = 0; i < 1400; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const shade = Math.random() * 18;
      ctx.fillStyle = `rgba(${shade + 30},${shade + 32},${shade + 34},0.35)`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Línea central discontinua amarilla (referencia Caterpillar)
    ctx.fillStyle = '#FFCC00';
    const dashHeight = 40;
    const gap = 30;
    for (let y = 0; y < canvas.height; y += dashHeight + gap) {
      ctx.fillRect(canvas.width / 2 - 4, y, 8, dashHeight);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 18);
    return texture;
  }

  function buildRoad() {
    roadGroup = new THREE.Group();

    // heightSegments alto (130 ≈ un vértice cada 2m) para que la onda del
    // terreno se vea suave y no "poligonal" al inclinarse.
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH, 1, 130);
    displaceTerrainGeometry(roadGeo);
    const roadMat = new THREE.MeshStandardMaterial({
      map: buildRoadTexture(),
      roughness: 0.95,
      metalness: 0.02
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.receiveShadow = true;
    roadGroup.add(roadMesh);
    roadMeshRef = roadMesh;

    // Bermas laterales (terreno adyacente) para dar contexto industrial;
    // también siguen la ondulación del terreno para no "flotar" ni
    // "enterrarse" respecto a la carretera principal.
    const shoulderGeo = new THREE.PlaneGeometry(60, ROAD_LENGTH, 1, 130);
    displaceTerrainGeometry(shoulderGeo);
    const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x1a1d1f, roughness: 1 });

    const shoulderLeft = new THREE.Mesh(shoulderGeo, shoulderMat);
    shoulderLeft.rotation.x = -Math.PI / 2;
    shoulderLeft.position.set(-ROAD_WIDTH / 2 - 30 + 0.5, -0.02, 0);
    shoulderLeft.receiveShadow = true;
    roadGroup.add(shoulderLeft);

    const shoulderRight = shoulderLeft.clone();
    shoulderRight.position.set(ROAD_WIDTH / 2 + 30 - 0.5, -0.02, 0);
    roadGroup.add(shoulderRight);

    scene.add(roadGroup);
  }

  /**
   * Conos de seguridad anaranjados (elementos de "faena minera"), generados
   * proceduralmente con ConeGeometry — sin archivos .gltf externos, así que
   * no hay bloqueos CORS al abrir el proyecto localmente. Se ubican a ambos
   * costados de la pista, siguiendo la altura real del terreno en cada z.
   */
  function buildSafetyCones() {
    coneGroup = new THREE.Group();
    const coneGeo = new THREE.ConeGeometry(0.32, 0.85, 10);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.55, emissive: 0x431a00, emissiveIntensity: 0.2 });
    const bandGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.12, 10);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.5 });

    for (let z = -ROAD_LENGTH / 2 + 10; z <= ROAD_LENGTH / 2 - 10; z += 12) {
      [-(ROAD_WIDTH / 2 + 1.4), (ROAD_WIDTH / 2 + 1.4)].forEach((x) => {
        const groundY = getHeightAt(z);
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(x, groundY + 0.425, z);
        cone.castShadow = true;
        coneGroup.add(cone);

        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.set(x, groundY + 0.5, z);
        coneGroup.add(band);
      });
    }
    scene.add(coneGroup);
  }

  // --------------------------------------------------------------------
  // MURO DE IMPACTO — barrera New Jersey a una distancia REAL fija (Ronda 10)
  // --------------------------------------------------------------------
  // A diferencia de otros elementos de la pista, esta barrera representa
  // una distancia REAL fija (p. ej. 80 metros desde el punto de frenada),
  // no una posición fija en la ESCENA. Como main.js comprime distancias
  // reales grandes con `state.sceneScale` para que quepan en el tramo
  // visible, es main.js quien conoce esa escala y le indica a esta
  // función DÓNDE (en coordenadas de escena) cae ese punto de 80 metros
  // reales en cada corrida — así, si el vehículo frena en menos de 80m
  // nunca llega a la barrera (para en seco antes), y si necesita más de
  // 80m para detenerse, la atraviesa. Ver setImpactWallZ() y
  // main.js:recomputeCoefficients().
  let impactWallGroup = null;
  let impactWallBlocks = []; // { mesh, restPos: THREE.Vector3 }
  let impactTriggered = false;

  // Materiales compartidos y persistentes de la barrera de impacto: se crean
  // UNA sola vez a nivel de módulo. setImpactWallZ() se llama hasta ~10
  // veces por segundo mientras se arrastra un slider, así que crear
  // materiales nuevos en cada llamada (como antes) generaba una fuga de
  // memoria en la GPU. Estos NO deben disponerse mientras la barrera exista.
  const IMPACT_RED_MAT = new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.5, emissive: 0x3a0d10, emissiveIntensity: 0.15 });
  const IMPACT_WHITE_MAT = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.5 });

  function buildImpactWall() {
    impactWallGroup = new THREE.Group();
    impactWallBlocks = [];

    const blockGeo = new THREE.BoxGeometry(1.6, 0.9, 0.55);

    const halfSpan = ROAD_WIDTH / 2 - 0.4;
    let idx = 0;
    for (let x = -halfSpan; x <= halfSpan + 0.001; x += 1.6, idx++) {
      const mesh = new THREE.Mesh(blockGeo, (idx % 2 === 0) ? IMPACT_RED_MAT : IMPACT_WHITE_MAT);
      const restPos = new THREE.Vector3(x, 0.55, 0); // y/z reales se fijan en setImpactWallZ()
      mesh.position.copy(restPos);
      mesh.castShadow = true;
      impactWallGroup.add(mesh);
      impactWallBlocks.push({ mesh, restPos: restPos.clone() });
    }
    scene.add(impactWallGroup);
    // Posición por defecto (se sobreescribe apenas main.js calcula la
    // escala de la corrida actual); evita que la barrera quede en z=0
    // encima del vehículo antes de la primera llamada.
    setImpactWallZ(70);
  }

  /**
   * Reubica toda la barrera en la coordenada de escena `z` indicada
   * (recalculando también la altura del terreno en ese punto) y la deja
   * intacta/reparada — se llama cada vez que cambian los parámetros de
   * la corrida (vehículo, terreno, velocidad, etc.), así una barrera que
   * quedó "destruida" en una corrida anterior siempre aparece de nuevo
   * entera y en el lugar correcto para la corrida siguiente.
   *
   * Reutiliza IMPACT_RED_MAT/IMPACT_WHITE_MAT (creados una sola vez a
   * nivel de módulo) en vez de crear materiales nuevos en cada llamada.
   */
  function setImpactWallZ(z) {
    if (!impactWallBlocks.length) return;
    const groundY = getHeightAt(z);
    impactWallBlocks.forEach(({ mesh, restPos }, i) => {
      restPos.z = z;
      restPos.y = groundY + 0.55;
      mesh.position.copy(restPos);
      mesh.rotation.set(0, 0, 0);
      mesh.material = (i % 2 === 0) ? IMPACT_RED_MAT : IMPACT_WHITE_MAT;
    });
    impactTriggered = false;
  }

  /**
   * Dispara el evento visual de colisión: cada bloque de la barrera
   * "sale volando" (se le suma un offset aleatorio a su posición y
   * rotación) y se ennegrece — un choque contundente y muy legible en
   * video comprimido, sin necesidad de física de partículas real.
   */
  function triggerImpact() {
    if (!sceneReady || !impactWallGroup || impactTriggered) return;
    impactTriggered = true;
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.9 });
    impactWallBlocks.forEach(({ mesh }, i) => {
      mesh.material = blackMat;
      const dir = i % 2 === 0 ? 1 : -1;
      mesh.position.x += dir * (2.5 + Math.random() * 3.5);
      mesh.position.y += 1.2 + Math.random() * 2.2;
      mesh.position.z += (Math.random() - 0.3) * 4;
      mesh.rotation.set(Math.random() * 4, Math.random() * 4, Math.random() * 4);
    });
    shakeCamera(1.4);
  }

  /** Restaura la barrera a su última posición asignada, intacta (sin moverla de z). */
  function resetImpactWall() {
    if (!impactWallBlocks.length) return;
    setImpactWallZ(impactWallBlocks[0].restPos.z);
  }

  function isImpactTriggered() {
    return impactTriggered;
  }

  /**
   * Reconstruye por completo la geometría que depende de la altura del
   * terreno (pista, bermas, marcadores de distancia y conos) cuando cambia
   * la "Inclinación Máxima" desde la UI. Se llama solo al soltar el slider
   * (no en cada frame), así que el costo de recrear geometría es aceptable.
   */
  function rebuildTerrainGeometry() {
    if (!sceneReady) return;
    [roadGroup, markerGroup, coneGroup, impactWallGroup].forEach((group) => {
      if (!group) return;
      scene.remove(group);
      group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    });
    buildRoad();
    buildDistanceMarkers();
    buildSafetyCones();
    buildImpactWall();
  }

  /**
   * Fija la pendiente máxima del terreno (grados) según el slider de la UI
   * y reconstruye la geometría dependiente. Devuelve la amplitud resultante
   * por si algún módulo la necesita para depuración.
   */
  function setMaxSlope(maxSlopeDeg) {
    terrainAmplitude = amplitudeForMaxSlope(maxSlopeDeg);
    rebuildTerrainGeometry();
    return terrainAmplitude;
  }

  /**
   * Cambia el perfil de camino activo ('recto' | 'lomas' | 'bajada') y
   * reconstruye la geometría dependiente (pista, bermas, marcadores,
   * conos). Reutiliza `rebuildTerrainGeometry()`, la misma rutina que ya
   * usa `setMaxSlope()`, así que ambos controles conviven sin duplicar
   * lógica de reconstrucción.
   */
  function setRoadProfile(profile) {
    roadProfile = (profile === 'recto' || profile === 'bajada') ? profile : 'lomas';
    rebuildTerrainGeometry();
    return roadProfile;
  }

  /**
   * Cambia el aspecto de la carretera y el clima según el terreno elegido
   * en el panel de controles. Es puramente visual (no toca mathCore.js):
   * - Retiñe la textura del asfalto (roadTint provisto por MathCore).
   * - Ajusta rugosidad/brillo: el asfalto mojado y el hielo se ven más
   *   pulidos (menor roughness, mayor metalness) para simular reflejos.
   * - Activa lluvia o nieve cayendo (o ninguna, "despejado").
   * @param {string} terrainKey  'asfalto'|'mojado'|'grava'|'barro'|'nieve'|'hielo'
   * @param {{roadTint:number, weather:string}} terrainMeta  metadatos de MathCore.TERRAIN_FRICTION[terrainKey]
   */
  function setTerrainVisual(terrainKey, terrainMeta) {
    if (!roadMeshRef || !terrainMeta) return;
    const oldMap = roadMeshRef.material.map; // se dispone después de asignar la nueva (evita fuga de textura en la GPU)
    roadMeshRef.material.map = buildRoadTexture(terrainMeta.roadTint);
    if (oldMap) oldMap.dispose();
    roadMeshRef.material.map.needsUpdate = true;

    const isSlick = terrainKey === 'hielo' || terrainKey === 'mojado';
    roadMeshRef.material.roughness = isSlick ? 0.25 : 0.95;
    roadMeshRef.material.metalness = isSlick ? 0.35 : 0.02;
    roadMeshRef.material.needsUpdate = true;

    setWeather(terrainMeta.weather);

    // Niebla/ambiente ligeramente más fríos y densos con nieve/hielo.
    if (terrainMeta.weather === 'nieve') {
      scene.fog.color.setHex(0xaebac2);
      scene.fog.near = 40;
    } else if (terrainMeta.weather === 'lluvia') {
      scene.fog.color.setHex(0x11151a);
      scene.fog.near = 45;
    } else {
      scene.fog.color.setHex(0x0a0d10);
      scene.fog.near = 60;
    }
  }

  // --------------------------------------------------------------------
  // CLIMA: LLUVIA / NIEVE (THREE.Points cayendo en bucle sobre la escena)
  // --------------------------------------------------------------------
  function clearWeather() {
    if (weatherParticles) {
      weatherGroup.remove(weatherParticles.points);
      weatherParticles.points.geometry.dispose();
      weatherParticles.points.material.dispose();
      weatherParticles = null;
    }
  }

  /**
   * Genera (o quita) un sistema de partículas que cae continuamente sobre
   * la escena. 'lluvia' → líneas finas y rápidas; 'nieve' → puntos anchos
   * y lentos con leve deriva lateral; 'despejado' → sin partículas.
   */
  function setWeather(kind) {
    clearWeather();
    if (kind !== 'lluvia' && kind !== 'nieve') return;

    const count = kind === 'lluvia' ? 900 : 500;
    const spread = 90;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count); // caída vertical (unid/seg)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = Math.random() * 45;
      positions[i * 3 + 2] = (Math.random() - 0.5) * (ROAD_LENGTH + 60);
      velocities[i] = kind === 'lluvia' ? 28 + Math.random() * 10 : 2.5 + Math.random() * 1.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: kind === 'lluvia' ? 0x9fd3ff : 0xffffff,
      size: kind === 'lluvia' ? 0.12 : 0.35,
      transparent: true,
      opacity: kind === 'lluvia' ? 0.55 : 0.85,
      depthWrite: false,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    weatherGroup.add(points);
    weatherParticles = { points, velocities, kind };
  }

  /**
   * Avanza la caída de lluvia/nieve un paso de tiempo `dt`. Cuando una
   * partícula toca el suelo, se recicla arriba en una posición X/Z nueva
   * (loop infinito, sin costo de creación/destrucción de geometría).
   */
  function updateWeather(dt) {
    if (!weatherParticles) return;
    const { points, velocities, kind } = weatherParticles;
    const posAttr = points.geometry.getAttribute('position');
    const arr = posAttr.array; // Float32Array subyacente — mismo patrón que ya usa setWeather()
    const drift = kind === 'nieve' ? 0.6 : 0.05;
    for (let i = 0; i < velocities.length; i++) {
      const ix = i * 3;
      let y = arr[ix + 1] - velocities[i] * dt;
      let x = arr[ix] + (kind === 'nieve' ? Math.sin((y + i) * 0.5) * drift * dt : 0);
      if (y < 0) {
        y = 40 + Math.random() * 5;
        x = (Math.random() - 0.5) * 90;
        arr[ix + 2] = (Math.random() - 0.5) * (ROAD_LENGTH + 60);
      }
      arr[ix] = x;
      arr[ix + 1] = y;
    }
    posAttr.needsUpdate = true;
  }

  /**
   * Dibuja líneas transversales cada 10 m sobre la carretera para dar
   * referencia visual de distancia recorrida. Cada 50 m la marca es más
   * ancha/opaca ("marca mayor") para facilitar la lectura a simple vista.
   * Puramente decorativo: no participa en ningún cálculo físico.
   */
  function buildDistanceMarkers() {
    markerGroup = new THREE.Group();
    const minorMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.28 });
    const majorMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.65 });

    for (let d = 0; d <= ROAD_LENGTH; d += 10) {
      const isMajor = d % 50 === 0;
      const z = -ROAD_LENGTH / 2 + d;
      const geo = new THREE.PlaneGeometry(ROAD_WIDTH * (isMajor ? 0.92 : 0.6), isMajor ? 0.2 : 0.09);
      const mesh = new THREE.Mesh(geo, isMajor ? majorMat : minorMat);
      // Se inclinan junto con la pendiente local de la pista (ver getSlopeAt)
      // para que no queden "flotando" ni "enterradas" sobre el terreno ondulado.
      mesh.rotation.x = -Math.PI / 2 + getSlopeAt(z);
      mesh.position.set(0, getHeightAt(z) + 0.012, z);
      markerGroup.add(mesh);
    }
    scene.add(markerGroup);
  }

  /**
   * Inicializa los grupos vacíos donde se acumularán, en tiempo de
   * ejecución, las huellas de frenado (skid marks) y los puffs de humo.
   * Se crean una sola vez en init(); main.js los puebla/limpia por corrida.
   */
  function initEffectsGroups() {
    skidMarksGroup = new THREE.Group();
    smokeGroup = new THREE.Group();
    weatherGroup = new THREE.Group();
    scene.add(skidMarksGroup);
    scene.add(smokeGroup);
    scene.add(weatherGroup);
  }

  // --------------------------------------------------------------------
  // HUELLAS DE FRENADO (SKID MARKS)
  // --------------------------------------------------------------------

  /**
   * Añade una huella de frenado (plano oscuro semitransparente) en el
   * punto (x, z) de la carretera, justo bajo la posición de una rueda.
   * Se invoca desde main.js mientras el vehículo frena (velocidad > 0).
   */
  // Geometría/material por defecto de las huellas de frenado, compartidos
  // y creados UNA sola vez a nivel de módulo. Todas las llamadas reales a
  // addSkidMark() en el proyecto usan los valores por defecto (mismo
  // tamaño y color), así que antes se creaba un par geometría+material
  // nuevo por cada huella (cientos en un frenado largo) y se abandonaban
  // sin dispose() al limpiar. Reutilizar el mismo par reduce eso a "1 solo
  // par" para todas las huellas de una sesión.
  const DEFAULT_SKID_GEO = new THREE.PlaneGeometry(0.3, 1.0);
  const DEFAULT_SKID_MAT = new THREE.MeshBasicMaterial({
    color: 0x0a0a0a, transparent: true, opacity: 0.45, depthWrite: false
  });

  function addSkidMark(x, z, width = 0.3, length = 1.0, opacity = 0.45) {
    if (!sceneReady) return;
    const isDefaultLook = (width === 0.3 && length === 1.0 && opacity === 0.45);
    // Caso común (99% de las llamadas): reutiliza geometría/material fijos.
    // Si alguna vez se pide un tamaño/opacidad distinto, se crea un par
    // propio para esa huella puntual (comportamiento anterior, sin leak
    // porque es la excepción, no la regla).
    const geo = isDefaultLook ? DEFAULT_SKID_GEO : new THREE.PlaneGeometry(width, length);
    const mat = isDefaultLook ? DEFAULT_SKID_MAT : new THREE.MeshBasicMaterial({
      color: 0x0a0a0a, transparent: true, opacity, depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.sharedResources = isDefaultLook; // para que clearSkidMarks sepa si puede disponer
    // Sigue la altura y pendiente local del terreno (ligeramente elevada
    // sobre el asfalto para evitar z-fighting).
    mesh.rotation.x = -Math.PI / 2 + getSlopeAt(z);
    mesh.position.set(x, getHeightAt(z) + 0.015, z);
    skidMarksGroup.add(mesh);
  }

  /** Elimina todas las huellas de frenado (se llama al iniciar una nueva corrida). */
  function clearSkidMarks() {
    if (!skidMarksGroup) return;
    while (skidMarksGroup.children.length) {
      const mesh = skidMarksGroup.children.pop();
      // Las huellas "por defecto" comparten DEFAULT_SKID_GEO/MAT entre sí
      // y con las próximas corridas — nunca se disponen. Solo se dispone
      // geometría/material propios de una huella con tamaño/opacidad
      // personalizados (caso excepcional, ver addSkidMark).
      if (!mesh.userData.sharedResources) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
  }

  // --------------------------------------------------------------------
  // HUMO DE NEUMÁTICOS (THREE.Points)
  // --------------------------------------------------------------------

  /**
   * Genera un pequeño puff de humo (partículas THREE.Points) en la
   * posición de una rueda que está frenando. Cada puff es un batch de
   * puntos independiente que se desvanece y asciende con updateSmoke().
   */
  function spawnSmokePuff(x, y, z) {
    if (!sceneReady) return;
    const count = 6;
    const positions = new Float32Array(count * 3);
    const baseY = getHeightAt(z) + y; // `y` llega como altura relativa (radio de rueda) desde main.js
    for (let i = 0; i < count; i++) {
      positions[i * 3] = x + (Math.random() - 0.5) * 0.4;
      positions[i * 3 + 1] = baseY + Math.random() * 0.2;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xaaaaaa,
      size: 0.35,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    smokeGroup.add(points);
    smokeParticles.push({ points, life: 0, maxLife: 0.9 + Math.random() * 0.3 });
  }

  /**
   * Avanza la animación de todos los puffs de humo activos: los desvanece
   * (opacity → 0), los agranda ligeramente y los eleva. Se llama una vez
   * por frame desde el bucle de animación de main.js con el delta-time.
   */
  function updateSmoke(dt) {
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
      const p = smokeParticles[i];
      p.life += dt;
      const t = p.life / p.maxLife;
      if (t >= 1) {
        smokeGroup.remove(p.points);
        p.points.geometry.dispose();
        p.points.material.dispose();
        smokeParticles.splice(i, 1);
        continue;
      }
      p.points.position.y += dt * 0.8;
      p.points.material.opacity = 0.45 * (1 - t);
      p.points.material.size = 0.35 + t * 0.5;
    }
  }

  /** Elimina todos los puffs de humo activos (se llama al iniciar una nueva corrida). */
  function clearSmoke() {
    smokeParticles.forEach((p) => {
      smokeGroup.remove(p.points);
      p.points.geometry.dispose();
      p.points.material.dispose();
    });
    smokeParticles = [];
  }

  // --------------------------------------------------------------------
  // CHISPAS DE FRENO — SOLO DURANTE BRAKE FADE (disco sobrecalentado)
  // --------------------------------------------------------------------

  /**
   * Genera un pequeño estallido de chispas naranja/rojo bajo una rueda que
   * frena en condición de brake fade. Reutiliza smokeGroup como padre visual
   * (mismo sistema de coordenadas) pero se anima y limpia por separado.
   */
  function spawnSparks(x, y, z) {
    if (!sceneReady) return;
    const count = 8;
    const positions = new Float32Array(count * 3);
    const baseY = getHeightAt(z) + y;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = x + (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = baseY + Math.random() * 0.15;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: Math.random() < 0.5 ? 0xffaa33 : 0xe63946,
      size: 0.16,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      sizeAttenuation: true
    });
    const points = new THREE.Points(geo, mat);
    smokeGroup.add(points);
    sparkParticles.push({ points, life: 0, maxLife: 0.22 + Math.random() * 0.15 });
  }

  /** Anima el desvanecimiento rápido de las chispas activas (llamar cada frame). */
  function updateSparks(dt) {
    for (let i = sparkParticles.length - 1; i >= 0; i--) {
      const p = sparkParticles[i];
      p.life += dt;
      const t = p.life / p.maxLife;
      if (t >= 1) {
        smokeGroup.remove(p.points);
        p.points.geometry.dispose();
        p.points.material.dispose();
        sparkParticles.splice(i, 1);
        continue;
      }
      p.points.position.y += dt * 1.4;
      p.points.material.opacity = 0.95 * (1 - t);
    }
  }

  function clearSparks() {
    sparkParticles.forEach((p) => {
      smokeGroup.remove(p.points);
      p.points.geometry.dispose();
      p.points.material.dispose();
    });
    sparkParticles = [];
  }

  // --------------------------------------------------------------------
  // CÁMARA CINEMÁTICA — seguimiento suave del vehículo + sacudida por frenado
  // --------------------------------------------------------------------
  let shakeMagnitude = 0;

  /**
   * Solicita una sacudida de cámara (0..1). Se usa durante frenados fuertes
   * y con más fuerza aún durante brake fade. Si ya hay una sacudida activa
   * más intensa en curso, se conserva la mayor (no se pisan entre sí).
   */
  function shakeCamera(intensity) {
    shakeMagnitude = Math.max(shakeMagnitude, Math.min(1.4, intensity));
  }

  /**
   * Desplaza suavemente el punto de mira de OrbitControls hacia la posición
   * Z del vehículo, sin secuestrar el control manual del usuario: solo se
   * llama mientras la simulación está corriendo, y el usuario puede seguir
   * orbitando/zoom libremente en todo momento.
   */
  function focusOn(z, dt, smoothing = 3.2) {
    if (!controls) return;
    const t = 1 - Math.exp(-smoothing * dt);
    controls.target.z += (z - controls.target.z) * t;
  }

  // --------------------------------------------------------------------
  // CÁMARA "VISTA CABINA" (Driver View) — Ronda 8
  // --------------------------------------------------------------------
  // En vez de reparentar la cámara con `vehicleGroup.add(camera)` (lo que
  // complicaría el resize/aspect ratio del renderer), actualizamos la
  // posición/orientación de la cámara en cada frame usando la matriz de
  // transformación del propio `vehicleGroup` vía `localToWorld`. El efecto
  // es idéntico (la cámara queda "pegada" al vehículo, con inclinación de
  // terreno incluida), pero es más simple de sincronizar con OrbitControls.
  let driverViewEnabled = false;
  let driverViewTarget = null; // { group, height, forward }

  /** Registra el vehículo activo y sus proporciones (llamado por main.js cada vez que se reconstruye el modelo 3D). */
  function setDriverViewTarget(vehicleGroup, height, forward) {
    driverViewTarget = { group: vehicleGroup, height, forward };
  }

  /** Activa/desactiva la Vista Cabina. Mientras está activa, OrbitControls se deshabilita (el usuario no debe poder "sacar" la cámara del vehículo). */
  function toggleDriverView() {
    driverViewEnabled = !driverViewEnabled;
    if (controls) controls.enabled = !driverViewEnabled;
    return driverViewEnabled;
  }

  function isDriverView() {
    return driverViewEnabled;
  }

  /** Actualiza la cámara en Vista Cabina; se llama una vez por frame desde render(). */
  function updateDriverView() {
    if (!driverViewEnabled || !driverViewTarget || !driverViewTarget.group) return;
    const g = driverViewTarget.group;
    // g.matrixWorld solo se recalcula dentro de renderer.render(), que corre
    // DESPUÉS de esta función en el ciclo de render() — sin este forzado,
    // localToWorld() de más abajo leería la posición del frame ANTERIOR
    // (1 frame de atraso, notable en cámara lenta y frenados bruscos).
    g.updateMatrixWorld(true);
    // El modelo se orienta con `rotation.y = 90°` en main.js, por lo que su
    // eje local -X apunta hacia el "frente" del vehículo (dirección de
    // avance en +Z del mundo). Colocamos la cámara un poco hacia ese frente
    // y a la altura de una cabina, y miramos más adelante en la misma
    // dirección para simular la perspectiva del conductor.
    const camLocal = new THREE.Vector3(-driverViewTarget.forward * 0.2, driverViewTarget.height, 0);
    const lookLocal = new THREE.Vector3(-driverViewTarget.forward * 6, driverViewTarget.height * 0.6, 0);
    const camWorld = g.localToWorld(camLocal.clone());
    const lookWorld = g.localToWorld(lookLocal.clone());
    camera.position.copy(camWorld);
    camera.lookAt(lookWorld);
  }

  /**
   * Ronda 10 — Iluminación "Flat / Cel Shaded" para broadcasting.
   * ------------------------------------------------------------------
   * La compresión de video de Google Meet arruina los degradados
   * sutiles (banding, macro-bloques): en vez de un gradiente suave de
   * luz-a-sombra, conviene un contraste MÁS duro y marcado, con menos
   * luz ambiental "rellenando" las sombras. Cambios respecto a la
   * iluminación anterior:
   *   - Hemisferio (luz ambiental/rebote) baja de 0.65 → 0.38: menos
   *     "relleno" en las zonas de sombra, para que se vean más oscuras
   *     y definidas en vez de un gris uniforme lavado.
   *   - Sol (DirectionalLight) sube de 1.1 → 1.6: el lado iluminado del
   *     vehículo queda mucho más brillante en contraste con su propia
   *     sombra, un look más "duro"/gráfico.
   *   - `shadowMap.type` pasa de PCFSoftShadowMap a PCFShadowMap en
   *     init(): sombras con borde más definido (menos difuminado), en
   *     vez del borde suave que la compresión de video vuelve un
   *     manchón gris.
   *   - Se agrega una luz de relleno fría (rim light) desde el lado
   *     opuesto al sol para que el contorno del vehículo se separe del
   *     fondo oscuro aun con la ambiental reducida (los materiales de
   *     los vehículos, ver vehicleModels.js, además pasaron a
   *     MeshToonMaterial con solo 3 escalones de luz — el look "cel
   *     shaded" propiamente dicho).
   */
  function buildLights() {
    const hemi = new THREE.HemisphereLight(0x9fb8c8, 0x14171a, 0.38);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d6, 1.6);
    sun.position.set(40, 60, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.camera.far = 200;
    // Bordes de sombra más duros y definidos (menos "bias" de suavizado)
    sun.shadow.radius = 1;
    scene.add(sun);

    // Luz de relleno fría desde el lado opuesto al sol: separa la
    // silueta del vehículo del fondo oscuro sin depender de ambiental.
    const rim = new THREE.DirectionalLight(0x9fd0ff, 0.55);
    rim.position.set(-30, 20, -35);
    scene.add(rim);

    // Luz de acento "peligro" muy tenue para reforzar la identidad visual
    const accent = new THREE.PointLight(0xe63946, 0.4, 40);
    accent.position.set(-10, 8, -10);
    scene.add(accent);
  }

  /**
   * Detecta si el navegador/GPU actual puede crear un contexto WebGL.
   * No basta con comprobar `window.WebGLRenderingContext` (esa clase puede
   * existir aunque el contexto real falle por GPU deshabilitada, drivers
   * viejos o política de la organización) — se intenta crear un contexto
   * real de prueba sobre un `<canvas>` descartable, tal como recomienda la
   * documentación de Three.js.
   */
  function isWebGLAvailable() {
    if (!window.WebGLRenderingContext) return false;
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      return !!gl;
    } catch (e) {
      return false;
    }
  }

  /**
   * Inyecta un bloque de error visible dentro de `canvasContainer` cuando
   * WebGL no está disponible, en vez de dejar una pantalla negra sin
   * ninguna pista. Los cálculos matemáticos (mathCore.js) y el resto del
   * dashboard (Chart.js, HUD, pizarra) no dependen de Three.js, así que
   * siguen funcionando con normalidad aunque el 3D no pueda cargar.
   */
  function renderWebGLFallback(canvasContainer) {
    const fallback = document.createElement('div');
    fallback.className = 'webgl-fallback';
    fallback.innerHTML = `
      <div class="webgl-fallback-icon" aria-hidden="true">⚠</div>
      <p class="webgl-fallback-title">Error: Tu navegador o tarjeta gráfica no soporta WebGL.</p>
      <p class="webgl-fallback-text">El entorno 3D no puede cargarse, pero los cálculos matemáticos seguirán funcionando. Probá con una versión actualizada de Chrome o Firefox, o revisá que la aceleración por hardware esté habilitada.</p>
    `;
    canvasContainer.appendChild(fallback);
  }

  /**
   * Inicializa toda la escena y devuelve las referencias que main.js
   * necesitará en su bucle de animación.
   */
  function init(canvasContainer, initialMaxSlopeDeg = 8, initialRoadProfile = 'lomas') {
    if (!isWebGLAvailable()) {
      renderWebGLFallback(canvasContainer);
      // Se devuelve un stub "sin operación": el resto de la app (main.js)
      // sigue llamando a Scene3D.* con normalidad (setTerrainVisual,
      // addSkidMark, focusOn, render, etc.) sin necesitar `if` extra en
      // cada punto de llamada; todo simplemente no hace nada visualmente.
      return null;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d10);
    scene.fog = new THREE.Fog(0x0a0d10, 60, 220);

    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(-14, 8, 16);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      // Ronda 9: necesario para el botón de Captura de Pantalla (📸, ver
      // main.js:takeScreenshot). Sin esto, el navegador puede limpiar el
      // framebuffer WebGL antes de que toDataURL()/toBlob() lo lean,
      // produciendo capturas negras o en blanco de forma intermitente.
      preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    // Ronda 10: PCFShadowMap (borde de sombra más duro y definido) en vez
    // de PCFSoftShadowMap — ver nota extensa en buildLights() sobre por
    // qué un look "más gráfico" sobrevive mejor a la compresión de Meet.
    renderer.shadowMap.type = THREE.PCFShadowMap;
    canvasContainer.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5;
    controls.maxDistance = 90;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.target.set(0, 1.2, 0);
    controls.update();

    terrainAmplitude = amplitudeForMaxSlope(initialMaxSlopeDeg);
    roadProfile = (initialRoadProfile === 'recto' || initialRoadProfile === 'bajada')
      ? initialRoadProfile
      : 'lomas';

    buildLights();
    buildRoad();
    buildDistanceMarkers();
    buildSafetyCones();
    buildImpactWall();
    initEffectsGroups();

    window.addEventListener('resize', () => onResize(canvasContainer));

    sceneReady = true;
    return { scene, camera, renderer, controls };
  }

  function onResize(canvasContainer) {
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function render(dt = 0) {
    if (!sceneReady) return;
    updateWeather(dt);
    if (driverViewEnabled) {
      updateDriverView();
    } else {
      controls.update();
      if (shakeMagnitude > 0.001) {
        const jitter = shakeMagnitude * 0.16;
        camera.position.x += (Math.random() - 0.5) * jitter;
        camera.position.y += (Math.random() - 0.5) * jitter * 0.6;
        shakeMagnitude = Math.max(0, shakeMagnitude - dt * 5.5);
      }
    }
    renderer.render(scene, camera);
  }

  return {
    init,
    render,
    ROAD_LENGTH,
    ROAD_WIDTH,
    // Efectos visuales (huellas de frenado + humo), consumidos por main.js
    addSkidMark,
    clearSkidMarks,
    spawnSmokePuff,
    updateSmoke,
    clearSmoke,
    // Chispas de brake fade
    spawnSparks,
    updateSparks,
    clearSparks,
    // Cámara cinemática: seguimiento del vehículo + sacudida por frenado
    focusOn,
    shakeCamera,
    // Terreno/clima visual (nieve, lluvia, tinte de pista) según MathCore.TERRAIN_FRICTION
    setTerrainVisual,
    // Terreno con pendiente (Ronda 8): altura/ángulo por posición + control desde la UI
    getHeightAt,
    getSlopeAt,
    setMaxSlope,
    setRoadProfile,
    // Cámara "Vista Cabina"
    setDriverViewTarget,
    toggleDriverView,
    isDriverView,
    // Ronda 10 — Muro de impacto (colisión al final de la pista)
    setImpactWallZ,
    triggerImpact,
    resetImpactWall,
    isImpactTriggered
  };
})();

window.Scene3D = Scene3D;
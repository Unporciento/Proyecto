/**
 * ============================================================================
 *  vehicleModels.js
 *  CONSTRUCCIÓN PROCEDURAL DE MAQUINARIA PESADA
 * ============================================================================
 *  Genera geometría 3D combinando primitivas (BoxGeometry, CylinderGeometry)
 *  para representar Furgón, Bus y Camión Minero, sin depender de archivos
 *  .gltf externos (evita bloqueos CORS al abrir el proyecto localmente).
 * ============================================================================
 */

const VehicleModels = (function () {

  const PALETTE = {
    furgon:     { body: 0xd8d8d8, accent: 0xffcc00, chassis: 0x1c1f22 },
    bus:        { body: 0xffcc00, accent: 0x1c1f22, chassis: 0x14171a },
    articulado: { body: 0xc0392b, accent: 0xffcc00, chassis: 0x16181a },
    grua:       { body: 0xffcc00, accent: 0xe63946, chassis: 0x14171a },
    minero:     { body: 0xe6b800, accent: 0xe63946, chassis: 0x0f1113 }
  };

  /**
   * Ronda 7 — corrección de orientación: `CylinderGeometry` nace con su eje
   * de simetría a lo largo de Y (parado, como una lata). Antes se reorientaba
   * con `mesh.rotation.z = 90°`, lo que dejaba el eje apuntando en X
   * (adelante/atrás del vehículo) en vez de Z (izquierda/derecha) — por eso
   * las ruedas se veían "acostadas", como tambores planos bajo el chasis, en
   * vez de discos verticales reales.
   *
   * La reorientación correcta se HORNEA directamente en la geometría (con
   * `geometry.rotateX(90°)`, que transforma los vértices una sola vez, no la
   * transformación del mesh) para que el eje verdadero del cilindro quede en
   * Z. Así, la malla queda "de pie" como una rueda real, Y el giro de rodado
   * que aplica main.js sobre `mesh.rotation.z` cada frame (ver animate())
   * gira limpiamente sobre ese mismo eje fijo, sin tambalear.
   */
  function makeWheel(radius, width) {
    const geo = new THREE.CylinderGeometry(radius, radius, width, 20);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.9, metalness: 0.1 });
    const wheel = new THREE.Mesh(geo, mat);
    wheel.castShadow = true;
    wheel.userData.isWheel = true; // usado por main.js para saber qué mallas rotar como ruedas

    // Aro metálico central para dar detalle sin costo geométrico alto.
    // Es hijo de `wheel`, así que hereda automáticamente su rotación de
    // rodado; solo necesita la misma corrección de eje horneada en su
    // propia geometría para quedar alineado con el resto de la rueda.
    const hubGeo = new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, width * 1.02, 12);
    hubGeo.rotateX(Math.PI / 2);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.4, metalness: 0.8 });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    wheel.add(hub);

    return wheel;
  }

  function addAxle(group, x, z, radius, width, trackWidth) {
    const wheelL = makeWheel(radius, width);
    wheelL.position.set(x, radius, z + trackWidth / 2);
    group.add(wheelL);

    const wheelR = makeWheel(radius, width);
    wheelR.position.set(x, radius, -(trackWidth / 2));
    group.add(wheelR);
  }

  /**
   * FURGÓN (2 ton): cabina + caja de carga simple, 2 ejes.
   */
  function buildFurgon() {
    const group = new THREE.Group();
    const c = PALETTE.furgon;

    const chassisGeo = new THREE.BoxGeometry(4.4, 0.3, 1.8);
    const chassisMat = new THREE.MeshStandardMaterial({ color: c.chassis, roughness: 0.8 });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.55;
    chassis.castShadow = true;
    group.add(chassis);

    const cabinGeo = new THREE.BoxGeometry(1.6, 1.3, 1.9);
    const bodyMat = new THREE.MeshStandardMaterial({ color: c.body, roughness: 0.55, metalness: 0.25 });
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.position.set(1.5, 1.35, 0);
    cabin.castShadow = true;
    group.add(cabin);

    const cargoGeo = new THREE.BoxGeometry(2.5, 1.6, 1.85);
    const cargo = new THREE.Mesh(cargoGeo, new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 }));
    cargo.position.set(-0.9, 1.5, 0);
    cargo.castShadow = true;
    group.add(cargo);

    // Franja de acento
    const stripeGeo = new THREE.BoxGeometry(2.52, 0.15, 1.87);
    const stripe = new THREE.Mesh(stripeGeo, new THREE.MeshStandardMaterial({ color: c.accent, emissive: c.accent, emissiveIntensity: 0.15 }));
    stripe.position.set(-0.9, 0.85, 0);
    group.add(stripe);

    const trackWidth = 1.9;
    addAxle(group, 1.3, 0, 0.42, 0.35, trackWidth);
    addAxle(group, -1.3, 0, 0.42, 0.35, trackWidth);

    return { group, halfLength: 2.4, wheelRadius: 0.42, trackWidth };
  }

  /**
   * BUS (15 ton): carrocería alargada, ventanas simuladas por material
   * emisivo tenue, 2 ejes reforzados.
   */
  function buildBus() {
    const group = new THREE.Group();
    const c = PALETTE.bus;

    const chassisGeo = new THREE.BoxGeometry(9.2, 0.4, 2.4);
    const chassis = new THREE.Mesh(chassisGeo, new THREE.MeshStandardMaterial({ color: c.chassis, roughness: 0.8 }));
    chassis.position.y = 0.65;
    chassis.castShadow = true;
    group.add(chassis);

    const bodyGeo = new THREE.BoxGeometry(9.0, 2.1, 2.5);
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: c.body, roughness: 0.45, metalness: 0.2 }));
    body.position.y = 1.85;
    body.castShadow = true;
    group.add(body);

    // Franja de ventanas
    const windowGeo = new THREE.BoxGeometry(9.02, 0.7, 2.52);
    const windowMesh = new THREE.Mesh(windowGeo, new THREE.MeshStandardMaterial({
      color: 0x1c2530, roughness: 0.2, metalness: 0.6, emissive: 0x0e3a4a, emissiveIntensity: 0.25
    }));
    windowMesh.position.y = 2.35;
    group.add(windowMesh);

    // Franja de acento inferior
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(9.02, 0.25, 2.52),
      new THREE.MeshStandardMaterial({ color: c.accent, emissive: c.accent, emissiveIntensity: 0.15 })
    );
    stripe.position.y = 1.0;
    group.add(stripe);

    const trackWidth = 2.5;
    addAxle(group, 3.4, 0, 0.55, 0.4, trackWidth);
    addAxle(group, -3.4, 0, 0.55, 0.4, trackWidth);

    return { group, halfLength: 4.9, wheelRadius: 0.55, trackWidth };
  }

  /**
   * CAMIÓN MINERO (300 ton): tolva masiva, cabina lateral elevada, ejes
   * dobles con neumáticos gigantes — proporciones tipo CAT 797.
   */
  function buildMinero() {
    const group = new THREE.Group();
    const c = PALETTE.minero;

    const chassisGeo = new THREE.BoxGeometry(11, 0.9, 5.4);
    const chassis = new THREE.Mesh(chassisGeo, new THREE.MeshStandardMaterial({ color: c.chassis, roughness: 0.85, metalness: 0.15 }));
    chassis.position.y = 1.6;
    chassis.castShadow = true;
    group.add(chassis);

    // Tolva (caja de carga) inclinada hacia atrás, forma trapezoidal simulada
    const hopperGeo = new THREE.BoxGeometry(7.5, 3.4, 5.6);
    const hopper = new THREE.Mesh(hopperGeo, new THREE.MeshStandardMaterial({ color: c.body, roughness: 0.55, metalness: 0.35 }));
    hopper.position.set(-1.2, 4.1, 0);
    hopper.rotation.x = 0.06;
    hopper.castShadow = true;
    group.add(hopper);

    // Refuerzo trasero de la tolva
    const backGeo = new THREE.BoxGeometry(0.6, 4.6, 5.7);
    const back = new THREE.Mesh(backGeo, new THREE.MeshStandardMaterial({ color: c.chassis, roughness: 0.7 }));
    back.position.set(-4.8, 4.6, 0);
    group.add(back);

    // Cabina lateral elevada (característica de camiones mineros)
    const cabinGeo = new THREE.BoxGeometry(2.2, 2.1, 2.0);
    const cabin = new THREE.Mesh(cabinGeo, new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4, metalness: 0.3 }));
    cabin.position.set(4.4, 4.5, 2.0);
    cabin.castShadow = true;
    group.add(cabin);

    // Franja de peligro
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(7.55, 0.3, 5.65),
      new THREE.MeshStandardMaterial({ color: c.accent, emissive: c.accent, emissiveIntensity: 0.2 })
    );
    stripe.position.set(-1.2, 2.5, 0);
    group.add(stripe);

    // Escalera de acceso simplificada
    const ladderGeo = new THREE.BoxGeometry(0.15, 3.2, 0.6);
    const ladder = new THREE.Mesh(ladderGeo, new THREE.MeshStandardMaterial({ color: 0x2b2f33, metalness: 0.5 }));
    ladder.position.set(3.0, 2.4, 2.9);
    group.add(ladder);

    // Ejes dobles delanteros y traseros con neumáticos gigantes
    const trackWidth = 4.6;
    addAxle(group, 4.6, 0, 1.35, 0.9, trackWidth);
    addAxle(group, -4.2, 0, 1.35, 0.9, trackWidth);
    addAxle(group, -5.6, 0, 1.35, 0.9, trackWidth);

    return { group, halfLength: 6.0, wheelRadius: 1.35, trackWidth };
  }

  /**
   * CAMIÓN ARTICULADO (25 ton): cabeza tractora + semirremolque unidos por
   * un "quinto rueda" simulado, 3 ejes en total (1 delantero + 2 traseros
   * del remolque) para diferenciarlo claramente del bus.
   */
  function buildArticulado() {
    const group = new THREE.Group();
    const c = PALETTE.articulado;

    // Cabeza tractora
    const tractorChassisGeo = new THREE.BoxGeometry(2.6, 0.35, 2.2);
    const tractorChassis = new THREE.Mesh(tractorChassisGeo, new THREE.MeshStandardMaterial({ color: c.chassis, roughness: 0.8 }));
    tractorChassis.position.set(3.3, 0.6, 0);
    tractorChassis.castShadow = true;
    group.add(tractorChassis);

    const cabinGeo = new THREE.BoxGeometry(2.0, 1.7, 2.1);
    const cabin = new THREE.Mesh(cabinGeo, new THREE.MeshStandardMaterial({ color: c.body, roughness: 0.5, metalness: 0.25 }));
    cabin.position.set(4.0, 1.7, 0);
    cabin.castShadow = true;
    group.add(cabin);

    // Semirremolque (caja larga)
    const trailerGeo = new THREE.BoxGeometry(6.6, 2.3, 2.35);
    const trailer = new THREE.Mesh(trailerGeo, new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 }));
    trailer.position.set(-2.0, 1.7, 0);
    trailer.castShadow = true;
    group.add(trailer);

    // Franja de acento a lo largo del remolque
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(6.62, 0.2, 2.37),
      new THREE.MeshStandardMaterial({ color: c.accent, emissive: c.accent, emissiveIntensity: 0.15 })
    );
    stripe.position.set(-2.0, 0.9, 0);
    group.add(stripe);

    // Quinto rueda / articulación (cilindro corto entre tractor y remolque)
    const jointGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.5, 12);
    const joint = new THREE.Mesh(jointGeo, new THREE.MeshStandardMaterial({ color: 0x2b2f33, metalness: 0.6 }));
    joint.rotation.z = Math.PI / 2;
    joint.position.set(1.2, 0.75, 0);
    group.add(joint);

    const trackWidth = 2.1;
    addAxle(group, 3.6, 0, 0.5, 0.35, trackWidth);   // eje delantero de la tractora
    addAxle(group, -1.0, 0, 0.5, 0.4, trackWidth);   // primer eje del remolque
    addAxle(group, -3.4, 0, 0.5, 0.4, trackWidth);   // segundo eje del remolque

    return { group, halfLength: 5.3, wheelRadius: 0.5, trackWidth };
  }

  /**
   * GRÚA INDUSTRIAL MÓVIL (45 ton): chasis reforzado, cabina de mando y
   * pluma/brazo telescópico inclinado hacia atrás con contrapeso trasero.
   */
  function buildGrua() {
    const group = new THREE.Group();
    const c = PALETTE.grua;

    const chassisGeo = new THREE.BoxGeometry(6.4, 0.55, 2.6);
    const chassis = new THREE.Mesh(chassisGeo, new THREE.MeshStandardMaterial({ color: c.chassis, roughness: 0.8 }));
    chassis.position.y = 0.9;
    chassis.castShadow = true;
    group.add(chassis);

    const cabinGeo = new THREE.BoxGeometry(1.7, 1.5, 2.0);
    const cabin = new THREE.Mesh(cabinGeo, new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4, metalness: 0.3 }));
    cabin.position.set(2.2, 1.9, 0);
    cabin.castShadow = true;
    group.add(cabin);

    // Base giratoria de la pluma
    const turretGeo = new THREE.CylinderGeometry(1.1, 1.2, 0.7, 16);
    const turret = new THREE.Mesh(turretGeo, new THREE.MeshStandardMaterial({ color: c.body, roughness: 0.55, metalness: 0.3 }));
    turret.position.set(-0.4, 1.6, 0);
    turret.castShadow = true;
    group.add(turret);

    // Pluma telescópica (inclinada, apuntando hacia atrás y arriba)
    const boomGeo = new THREE.BoxGeometry(7.5, 0.5, 0.5);
    const boom = new THREE.Mesh(boomGeo, new THREE.MeshStandardMaterial({ color: c.body, roughness: 0.5, metalness: 0.35 }));
    boom.position.set(-3.6, 3.1, 0);
    boom.rotation.z = 0.35;
    boom.castShadow = true;
    group.add(boom);

    // Contrapeso trasero
    const counterweightGeo = new THREE.BoxGeometry(1.3, 1.1, 2.4);
    const counterweight = new THREE.Mesh(counterweightGeo, new THREE.MeshStandardMaterial({ color: c.accent, roughness: 0.6 }));
    counterweight.position.set(-2.7, 1.7, 0);
    counterweight.castShadow = true;
    group.add(counterweight);

    // Estabilizadores (patas de apoyo, puramente decorativos)
    const legGeo = new THREE.BoxGeometry(0.25, 1.0, 0.25);
    [[-2.6, 1.7], [-2.6, -1.7], [1.6, 1.7], [1.6, -1.7]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: 0x2b2f33, metalness: 0.5 }));
      leg.position.set(lx, 0.5, lz);
      group.add(leg);
    });

    const trackWidth = 2.5;
    addAxle(group, 2.6, 0, 0.6, 0.45, trackWidth);
    addAxle(group, 0.0, 0, 0.6, 0.45, trackWidth);
    addAxle(group, -2.6, 0, 0.6, 0.45, trackWidth);

    return { group, halfLength: 4.5, wheelRadius: 0.6, trackWidth };
  }

  const BUILDERS = {
    furgon: buildFurgon,
    bus: buildBus,
    articulado: buildArticulado,
    grua: buildGrua,
    minero: buildMinero
  };

  /**
   * Construye el vehículo solicitado. Cada maquinaria tiene su propio
   * builder con geometría, paleta y proporciones completamente distintas
   * (chasis, tolva/carrocería, cabina, número de ejes y tamaño de rueda),
   * así que cambiar el selector en la UI reconstruye un mesh visualmente
   * diferenciado — no es el mismo modelo reescalado uniformemente.
   * `trackWidth` (ancho entre ruedas izquierda/derecha) se expone para que
   * main.js pueda ubicar huellas de frenado y humo bajo las ruedas reales
   * de cada vehículo, en vez de un punto genérico bajo el chasis.
   * @param {'furgon'|'bus'|'minero'} type
   * @returns {{group: THREE.Group, halfLength: number, wheelRadius: number, trackWidth: number}}
   */
  function build(type) {
    const builder = BUILDERS[type] || BUILDERS.furgon;
    return builder();
  }

  return { build };
})();

window.VehicleModels = VehicleModels;
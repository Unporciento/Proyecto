# Changelog

## Sin publicar — Módulo de cierre 3

- Implementado el MVP de Profesor Buenaventura con permisos exclusivos
  `OBSERVE` y `RECOMMEND`.
- Añadida selección explícita de hasta cuatro fragmentos de Biblioteca,
  Rúbricas, Evidencias e Informes dentro de un único proyecto.
- `compare` admite contexto mixto del mismo proyecto, con vista previa,
  procedencia y presupuesto máximo de 8.000 caracteres.
- Incorporados contratos versionados, adaptadores de solo lectura, proveedor
  desacoplado y `UnavailableProvider` como valor predeterminado.
- El estado es efímero y no existen escrituras académicas, memoria, historial,
  Tura, Laboratorio ni sincronización remota.

## Sin publicar — Módulo de cierre 2

- Documentada la arquitectura canónica de Buenaventura: personalidad, límites
  pedagógicos, contexto mínimo, privacidad, adaptadores de solo lectura y matriz
  de comportamiento.
- La asistencia permanece inactiva: no se añadió interfaz, proveedor, memoria ni
  escritura académica.

## Sin publicar — Módulo de cierre 1

- Simulacro registra confianza y duración reales por respuesta.
- Calibración detecta puntos ciegos también desde intentos de Simulacro.
- Diez preguntas quedan como valor predeterminado explícito.
- Etiquetas de evidencias centralizadas sin migrar identificadores.
- Añadida una guía accesible del flujo académico completo.
- Documentada una estrategia de versiones sin renumerar producto ni datos.
- Service Worker `2026.07.26-6` precarga los nuevos contratos de Simulacro,
  Calibración y etiquetas para conservar el arranque offline.

## 2026-07-26 — Módulo UX

- Identidad FORJA y versión `2.0.0` visibles.
- Footer con año automático, metadatos PWA y favicon consolidados.
- Pantalla de carga breve, estado offline y errores globales seguros.
- Añadidas páginas 404 y offline sin dependencias externas.
- Microinteracciones respetan movimiento reducido y ahorro de energía.
- Service Worker `2026.07.26-5` precarga los recursos de recuperación.

## 2026-07-26 — Módulo 6: Presentaciones

- Añadida la preparación de contenido académico por diapositivas.
- Diapositivas ordenables con título, contenido, notas y estado.
- Vínculos explícitos con secciones del informe, evidencias y fuentes.
- Operaciones atómicas y bloqueo de relaciones entre proyectos.
- Paquete JSON local y versionado para una futura integración con NEXUS Present.
- Comprobado con 500 diapositivas.

## 2026-07-26 — Módulo 5: Informes

- Añadidos informes con secciones ordenadas y estados borrador/final.
- Secciones conectadas con evidencias y fuentes del mismo proyecto.
- Cobertura de criterios derivada de la trazabilidad existente.
- Autoguardado atómico sin crear historial por cada pulsación.
- Hitos únicamente al marcar el informe como final.
- Eliminación conserva fuentes, evidencias, criterios y documentos.
- Comprobado con 500 secciones.

## 2026-07-26 — Optimización del proceso

- Añadido `verify:quick` con sintaxis, contratos, imports/CSP, prueba focalizada y
  límite de 400 líneas.
- `verify` conserva la suite completa obligatoria antes de publicar.
- Documentación e informes separados por responsabilidad para evitar repetición.

## 2026-07-26 — Módulo 4: Evidencias

- Añadida la gestión de evidencias dentro de cada proyecto.
- Ocho tipos cerrados y cuatro estados cerrados.
- Cada evidencia exige al menos una fuente y un criterio del mismo proyecto.
- Trazabilidad visible: fuente → sustenta evidencia → satisface criterio.
- Asociación opcional con documento existente; documento obligatorio para
  evidencia documental o fotografía.
- Creación, edición y eliminación multistore atómicas.
- Relaciones duplicadas, autorrelaciones, extremos inexistentes y cruces entre
  proyectos son rechazados.
- Eliminar evidencia conserva documentos, fuentes, rúbricas y criterios.
- Listado paginado y filtrado; comprobado con 500 evidencias.

## 2026-07-26 — Módulo 3: Rúbricas

- Añadida una rúbrica estructurada y consultable dentro de cada proyecto.
- Criterios con título, descripción, puntaje, posición, obligatoriedad y estado cerrado.
- Reordenamiento accesible mediante controles Subir y Bajar.
- Puntaje total derivado exclusivamente de los criterios.
- Contratos esquema 2 compatibles con rúbricas y criterios internos esquema 1.
- Duplicados, puntajes inválidos, pertenencias cruzadas y totales manipulados rechazados.
- Escritura y eliminación atómicas, incluida la limpieza de relaciones huérfanas.
- Consulta por índices `projectKind` y `parentId`; comprobada con 500 criterios.

## 2026-07-26 — Módulo 2: Fuentes

- Añadida la gestión de fuentes dentro de cada proyecto académico.
- Tipos cerrados: PDF, Word, imagen, enlace web, libro, artículo, apunte y video.
- Contrato de fuente esquema 2, compatible con fuentes internas esquema 1.
- Los archivos se referencian desde la Biblioteca sin duplicarlos ni eliminarlos.
- Creación, edición y eliminación actualizan artefactos y relaciones de forma atómica.
- Enlaces limitados a HTTP y HTTPS y contenido visible construido con `textContent`.
- Lista paginada por el índice compuesto `projectKind`; comprobada con 500 fuentes.
- La interfaz usa exclusivamente `AcademicRepository`.

## 2026-07-26 — Módulo 1: Proyectos Académicos

- Añadida la sección visible `Proyectos`, integrada con la navegación y diseño de FORJA.
- Gestión completa: crear, editar, archivar y eliminar con confirmación.
- Contrato de proyecto esquema 2 con profesor, semestre, fechas, color, icono y progreso.
- Compatibilidad conservada con registros académicos esquema 1.
- Estados cerrados: activo, entregado, calificado y archivado.
- Duplicados bloqueados por nombre normalizado dentro de una asignatura.
- Consultas paginadas mediante el índice `updatedAt`; comprobadas con 500 proyectos.
- La interfaz usa exclusivamente `AcademicRepository`.

## 2026-07-26 — Etapa 2B: activación controlada de IndexedDB v3

- Elevado `TARGET_DB_VERSION` de 2 a 3 para activar la migración académica aditiva.
- Las instalaciones nuevas crean los cinco stores anteriores y los cuatro stores
  académicos aprobados.
- Las instalaciones v2 conservan materias, documentos, tarjetas, intentos y
  configuración durante la migración.
- Comprobada la reapertura sin repetir la migración.
- Incrementado el service worker a `2026.07.26-4`.
- Verificación completa: 44 pruebas aprobadas, 0 fallidas.
- No se modificaron `app.js`, sincronización ni interfaz.

## 2026-07-26 — Hotfix Etapa 2A

- Corregida una carrera en el `fetch` del service worker: la respuesta ahora se
  clona antes de devolver el original y la escritura en caché queda vinculada a
  `event.waitUntil()` sin retrasar la respuesta de red.
- Añadidas pruebas de consumo concurrente, respuestas no exitosas, navegación
  offline y recursos estáticos en caché.
- Incrementada la versión del service worker a `2026.07.26-3`.
- Verificación completa: 42 pruebas aprobadas, 0 fallidas.

## 2026-07-26 — Etapa 2A: puente IndexedDB v2

### Producción

- El detector abre primero la versión instalada y nunca solicita una versión inferior.
- El objetivo efectivo permanece en IndexedDB v2.
- Una instalación v2 no crea `academicProjects`, `projectArtifacts`, `artifactRelations` ni `artifactRevisions`.
- Exportación, restauración y borrado operan únicamente sobre los stores disponibles.
- Una base de prueba v3 puede abrirse con el puente configurado para v2 sin `VersionError`.

### Preparado, pero inactivo

- Migración v2 → v3, contratos, repositorio y respaldo académico permanecen en el código y las pruebas.
- No existe interfaz académica y `app.js` no cambió.
- `SYNC_ENDPOINT` continúa vacío.

## 2026-07-26 — Fase 2 interna: núcleo académico

### Añadido

- Modelo versionado para proyectos, fuentes, referencias documentales, rúbricas, criterios, evidencias, informes y secciones.
- Relaciones semánticas cerradas y trazabilidad completa por proyecto.
- Repositorio académico con validación previa y transacciones atómicas.
- Puente de compatibilidad y migración aditiva IndexedDB v2 → v3.
- Respaldo v2 con conversión inmutable de respaldos v1.
- Pruebas unitarias, negativas, verticales, de migración, respaldo, atomicidad y volumen.

### Compatibilidad

- Los cinco stores anteriores y sus datos permanecen intactos.
- No se convierten automáticamente materias ni documentos en proyectos.
- `app.js` no cambió y no existe interfaz académica todavía.
- El sobre cifrado de bóveda continúa en versión 1; solo su contenido validado pasa a respaldo v2.

### Verificación

- 38 pruebas aprobadas y 0 fallidas.
- Volumen comprobado: 200 proyectos, 20 000 artefactos y 50 000 relaciones.
- Todos los archivos propios comprobados permanecen por debajo de 400 líneas.

## 2026-07-26 — Estabilización de cuentas y datos

### Corregido

- Cancelar una restauración ya no deja la cuenta marcada como desbloqueada.
- Una restauración fallida en IndexedDB aborta toda la transacción y conserva los datos anteriores.
- La autorización remota ahora depende de código y contraseña juntos.
- CORS ya no responde con un origen permitido cuando la solicitud proviene de un origen desconocido.
- El límite remoto sube a 16 MB para admitir cualquier respaldo local aceptado de hasta 10 MB después de cifrado y Base64.

### Cambiado

- Se eliminaron los query strings de versión repetidos en HTML e imports.
- El caché de la PWA tiene una única versión en `service-worker.js`.
- La CSP incluye un marcador cerrado para el futuro origen exacto de sincronización.
- Se añadió `fake-indexeddb` únicamente como dependencia de desarrollo.
- `npm run verify` ejecuta sintaxis, pruebas y límite de 400 líneas.

### Pruebas

- 25 pruebas aprobadas: lógica previa, cuenta, bóveda, límites, IndexedDB, restauración atómica, recursos, CSP, service worker y Worker.
- El Worker también completa el empaquetado real de Wrangler en modo `--dry-run`.

### Compatibilidad

- Sin cambios en el esquema IndexedDB.
- Las bóvedas portátiles v1 existentes continúan siendo legibles.
- La sincronización remota continúa desactivada hasta desplegar y configurar el Worker.

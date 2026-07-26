# Entrega y migración del núcleo académico

Estado: núcleo aprobado; Etapa 2A configurada con objetivo efectivo v2  
Complementa [ACADEMIC_CORE_ARCHITECTURE.md](ACADEMIC_CORE_ARCHITECTURE.md).

## 1. Migración propuesta

### 1.1 Puente de compatibilidad

Antes de subir IndexedDB de versión 2 a 3, `db.js` debe aprender a:

1. abrir la versión existente sin solicitar una versión inferior;
2. detectar la versión instalada;
3. aplicar migraciones numeradas solo cuando sean necesarias;
4. tolerar stores futuros que el código antiguo no utiliza.

Esto evita que una reversión de aplicación provoque `VersionError` después de crear la base v3.

### 1.2 Migración v2 → v3

En una única actualización de esquema:

- conservar intactos `subjects`, `documents`, `cards`, `attempts` y `settings`;
- crear `academicProjects`;
- crear `projectArtifacts`;
- crear `artifactRelations`;
- crear `artifactRevisions`;
- crear los índices definidos;
- usar la versión nativa de IndexedDB como versión autoritativa del esquema.

No se convertirán automáticamente materias o documentos en proyectos. Los materiales actuales pueden ser apuntes generales y no necesariamente trabajos universitarios.

### 1.3 Adopción gradual

Cuando el usuario vincule un documento existente a un proyecto:

- se conserva el documento original;
- se crea un `document_ref`;
- las tarjetas y los intentos existentes permanecen asociados al documento;
- una fase futura podrá crear un `study_set` que los relacione con el proyecto.

### 1.4 Respaldos

El respaldo de datos pasa de versión 1 a versión 2.

- Un respaldo v1 se transforma en memoria añadiendo las cuatro colecciones nuevas vacías.
- Un respaldo v2 valida colecciones antiguas y académicas.
- La restauración sigue siendo atómica.
- El sobre cifrado de bóveda continúa en versión 1; solo cambia el esquema del contenido.
- Nunca se modifica el archivo de respaldo original.

## 2. Arquitectura de código propuesta

```text
js/
  academic/
    artifact-schemas.js     tipos, estados y validadores discriminados
    project-model.js        invariantes y creación de proyectos
    relation-model.js       relaciones permitidas y validación
    academic-repository.js  consultas y transacciones por proyecto
    academic-migrations.js  migraciones IndexedDB numeradas
    backup-v2.js            conversión y validación de respaldos
```

Reglas:

- `app.js` no importará ni coordinará este núcleo.
- Los módulos de dominio no accederán al DOM.
- El repositorio será el único adaptador académico de IndexedDB.
- La interfaz futura dependerá de casos de uso pequeños, no de stores directamente.
- Ningún archivo propio superará 400 líneas; objetivo: menos de 250.
- No se añade framework, ORM ni dependencia de producción.

## 3. Rendimiento y crecimiento

Riesgos:

- demasiados artefactos cargados en memoria;
- búsquedas que recorran todos los proyectos;
- revisiones con cuerpos de informe grandes;
- relaciones huérfanas;
- crecimiento de evidencias repetidas;
- respaldos que superen los límites actuales;
- transacciones largas durante migración.

Controles:

- consultas por `projectId` e índices compuestos;
- paginación por `updatedAt`;
- revisiones solo en hitos explícitos;
- límites por colección y por tamaño de contenido;
- validación de referencias antes de escribir o restaurar;
- eliminación por proyecto mediante cursor e índices;
- prueba de volumen en móvil equivalente a 200 proyectos, 20 000 artefactos y 50 000 relaciones;
- medición antes de introducir cachés o agregados persistidos.

No se almacenarán blobs originales dentro de los nuevos artefactos.

## 4. Plan de implementación

### 2.1 Contratos puros

- implementar esquemas, enums e invariantes;
- probar cada tipo y relación;
- sin IndexedDB ni interfaz.

Salida: objetos inválidos no pueden cruzar la frontera del dominio.

### 2.2 Puente y migraciones

- adaptar apertura versionada;
- implementar registro de migraciones;
- crear stores e índices v3;
- probar apertura desde v2, reapertura v3 y reversión al puente.

Salida: cero cambios sobre datos existentes.

### 2.3 Repositorio académico

- operaciones por proyecto;
- transacciones de artefactos y relaciones;
- consultas indexadas;
- borrado seguro sin eliminar documentos.

Salida: flujo de datos completo sin interfaz.

### 2.4 Respaldo v2

- exportar nuevas colecciones;
- convertir v1 a v2;
- validar referencias;
- probar restauración atómica y bóveda.

Salida: respaldo antiguo compatible y respaldo nuevo recuperable.

### 2.5 Prueba vertical sin interfaz

- crear proyecto;
- añadir fuente;
- añadir rúbrica y criterio;
- vincular evidencia al criterio y fuente;
- construir informe y sección;
- demostrar trazabilidad mediante consulta.

Salida: el primer flujo funciona por API de dominio y pruebas.

Solo después se podrá proponer una interfaz.

## 5. Riesgos de diseño pendientes

- Los proyectos interdisciplinarios solo tendrán una asignatura principal inicialmente.
- No se define todavía edición colaborativa.
- No se define todavía formato DOCX/PDF de salida.
- No se implementa estilo de citas; una fuente solo conserva datos estructurados.
- No se resuelven conflictos entre dispositivos.
- Una relación polimórfica exige validadores estrictos para evitar grafos incoherentes.
- El límite de 10 MB de respaldo puede requerir revisión al crecer los informes.
- IndexedDB no impone claves foráneas; FORJA debe validarlas.

## 6. Criterios de aceptación

La arquitectura puede aprobarse si:

- todo elemento del flujo pertenece a un único proyecto;
- un documento se almacena una sola vez;
- una evidencia puede demostrar uno o varios criterios sin duplicarse;
- una sección del informe puede rastrearse hasta evidencia y fuente;
- rúbrica y criterios tienen identidad independiente;
- datos existentes siguen legibles y sin cambios;
- respaldos v1 siguen restaurándose;
- una reversión posterior a v3 no produce `VersionError`;
- ninguna consulta necesita cargar toda la base;
- las operaciones multientidad son atómicas;
- el dominio funciona sin DOM, red, nube ni IA;
- `app.js` no crece;
- no se añade ninguna dependencia de producción;
- pruebas de integridad, migración, volumen y respaldo pasan;
- el primer flujo se demuestra completo antes de diseñar pantallas.

## 7. Decisiones aprobadas

1. Usar un catálogo común `projectArtifacts` con esquemas estrictos por tipo.
2. Usar relaciones explícitas en vez de arreglos de IDs embebidos.
3. Mantener documentos físicos fuera del proyecto y referenciarlos.
4. No convertir automáticamente la biblioteca actual en proyectos.
5. Dar a cada proyecto una sola asignatura principal inicialmente.
6. Conservar revisiones únicamente en hitos explícitos.
7. Introducir primero un puente de compatibilidad antes de IndexedDB v3.
8. Limitar la primera implementación al flujo fuentes → rúbrica → evidencias → informe.

## 8. Resultado de implementación

Se implementó sin interfaz:

- contratos cerrados y versionados para proyecto, siete tipos de artefacto y cinco relaciones;
- puente que detecta primero la versión instalada y nunca solicita una inferior;
- migración aditiva v2 → v3 con stores e índices académicos;
- repositorio como única frontera de escritura y consulta académica;
- validación previa de asignatura, proyecto, padres, documentos, extremos y duplicados;
- transacciones atómicas para proyecto, grafo académico y restauración;
- respaldo v2 y conversión v1 → v2 únicamente en memoria;
- consulta completa de artefactos, relaciones y documentos por proyecto;
- caché offline de los nuevos módulos internos.

La prueba vertical crea y recupera:

```text
Proyecto
├─ Fuente ← documento_ref
├─ Rúbrica
│  └─ Criterio
├─ Evidencia ── derived_from ──> Fuente
│            └─ satisfies ─────> Criterio
└─ Informe
   └─ Sección ← supports ─────── Evidencia
              └─ cites ─────────> Fuente
```

Resultado de `npm run verify`: 38 pruebas aprobadas, 0 fallidas.

Medición de referencia con `fake-indexeddb`:

- 200 proyectos;
- 20 000 artefactos;
- 50 000 relaciones;
- carga: 7 245,2 ms;
- consulta indexada de un proyecto: 4,2 ms.

Estas cifras son una prueba repetible de estructura e índices, no equivalen al rendimiento
de Safari o Chrome en un teléfono real.

## 9. Despliegue y reversión

La Etapa 2A mantiene:

- `TARGET_DB_VERSION = 2`;
- `ACADEMIC_DB_VERSION = 3`, usado solo por migraciones y pruebas aisladas;
- detección de la versión instalada antes de decidir si se actualiza;
- stores académicos ausentes en instalaciones v2 normales;
- apertura compatible de una base v3 sin solicitar v2.

La Etapa 2B podrá comenzar únicamente después de validar físicamente 2A. Su cambio
principal será elevar `TARGET_DB_VERSION` a `ACADEMIC_DB_VERSION`, actualizar la
versión del service worker y repetir todas las pruebas. La versión estable anterior
sigue recuperable mediante `38b19a4f187e7cd079912ee784632cd3dbcba353`.

No se implementó ni activó interfaz, sincronización, Worker, calendario, IA,
presentaciones, colaboración o exportación documental.

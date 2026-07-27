# Módulo 1 — Proyectos Académicos

Estado: implementado; pendiente de validación manual en producción  
Fecha: 2026-07-26

## Alcance

Este módulo hace visible únicamente la raíz del núcleo académico. Permite gestionar
proyectos, pero no muestra ni crea fuentes, rúbricas, criterios, evidencias, informes,
presentaciones, profesor IA, Laboratorio o sincronización.

## Arquitectura

```text
index.html
  └─ projects-controller.js
       ├─ project-form.js
       ├─ projects-view.js
       └─ AcademicRepository
            └─ contratos versionados
                 └─ IndexedDB v3
```

La interfaz no importa `db.js` ni utiliza `indexedDB`. `AcademicRepository` sigue
siendo la frontera obligatoria para lectura y escritura académica.

`app.js` permanece sin cambios. El módulo se inicializa desde un segundo script ES
y solo consulta proyectos cuando la vista `#proyectos` se activa.

## Contrato de proyecto

El esquema visible es `PROJECT_SCHEMA_VERSION = 2`:

```js
{
  id,
  subjectId,
  title,
  professor,
  semester,
  startDate,
  dueDate,
  status,
  description,
  color,
  icon,
  progress,
  schemaVersion,
  createdAt,
  updatedAt,
  submittedAt,
  archivedAt
}
```

El validador continúa aceptando registros internos esquema 1 para conservar
respaldos y pruebas anteriores. Editar uno de esos registros lo convierte
explícitamente al esquema 2 después de completar los campos nuevos.

## Reglas

- El nombre es obligatorio y se normaliza al comparar duplicados.
- No puede repetirse el mismo nombre dentro de una asignatura.
- La asignatura debe existir.
- La entrega no puede ser anterior al inicio.
- Los estados son `active`, `submitted`, `graded` y `archived`.
- El progreso es un entero entre 0 y 100.
- El color es hexadecimal de seis dígitos.
- El icono pertenece a un catálogo cerrado.
- Archivar conserva todo el contenido.
- Eliminar requiere confirmación.
- Eliminar borra proyecto, artefactos, relaciones y revisiones en una transacción.
- Los documentos y asignaturas nunca se eliminan junto al proyecto.

## Rendimiento

La lista usa el índice `updatedAt` y cursor descendente. Se muestran 60 tarjetas
por página y el usuario puede cargar más. Los filtros se aplican durante el
recorrido indexado sin cargar artefactos, relaciones ni documentos.

La prueba automatizada usa 500 proyectos y consulta dos páginas y el filtro de
archivados. El umbral es 1 segundo en `fake-indexeddb`; esta medición no sustituye
la validación física en iPhone y computador.

## Accesibilidad y seguridad

- Navegación compatible con teclado y hash cerrado.
- Diálogo con etiquetas, validación nativa y error con `role="alert"`.
- Foco inicial en el nombre y retorno al control que abrió el diálogo.
- Tarjetas con nombres accesibles para editar, archivar y eliminar.
- Barra de progreso con atributos ARIA.
- Contenido del usuario insertado con `textContent`, nunca como HTML.
- Diseño de una columna en móvil y controles táctiles de al menos 38–44 px.

## Crecimiento

Las tarjetas ya admiten identidad, estado y progreso, pero no inventan contadores
de elementos todavía inexistentes. Los módulos siguientes deberán enlazar sus
artefactos al `projectId` actual y conservar esta vista como puerta de entrada.

No comenzar el Módulo 2 hasta aprobar manualmente este módulo en PC e iPhone.

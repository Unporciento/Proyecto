# Contexto, privacidad y permisos

## Permisos del MVP futuro

`OBSERVE` permite leer únicamente una selección explícita. `RECOMMEND` permite
devolver texto y sugerencias no ejecutables. Ninguna respuesta puede contener
una mutación, orden de repositorio o acción automática. Un orquestador futuro
recibirá puertos de lectura; nunca `AcademicRepository`, IndexedDB ni un puerto
de escritura.

## Contrato propuesto: `BuenaventuraRequestV1`

```js
{
  schemaVersion: 'buenaventura-request-v1',
  requestId: 'efimero',
  task: 'explain|review|compare|suggest|question',
  module: 'library|rubric|evidence|report',
  permissions: ['OBSERVE', 'RECOMMEND'],
  scope: { projectId: 'uno-o-null', selectionIds: ['explicitos'] },
  fragments: [{ kind, id, title, excerpt, provenance }],
  constraints: { activeEvaluation: false, offline: false }
}
```

Los campos son de lista permitida; no se aceptan metadatos arbitrarios. Cada
fragmento lleva procedencia, es contenido de referencia no confiable y contiene
como máximo 2.000 caracteres. Una solicitud admite un proyecto, cuatro
fragmentos y 8.000 caracteres en total. No incluye contraseñas, códigos, tokens,
fotos de perfil, bóveda, documentos completos, Data URLs, historial entero ni
datos de otros proyectos.

`BuenaventuraResponseV1` tendrá `status` (`ok`, `insufficient_context`,
`cannot_verify`, `ambiguous_source`, `requires_supervision`, `policy_blocked`,
`provider_unavailable` u `offline`), texto y referencias de soporte. No tendrá
campo de mutaciones. Estos contratos son propuestos y no están implementados.

## Adaptadores de solo lectura propuestos

Todos reciben una selección explícita y devuelven `fragments` u omisiones
explicadas; rechazan identificadores desconocidos, exceso de presupuesto y
cruces de proyecto.

- Biblioteca: documento seleccionado y rangos de extracto autorizados.
- Rúbricas: rúbrica del proyecto y criterios seleccionados.
- Evidencias: evidencias seleccionadas y resúmenes de su fuente o criterio del
  mismo proyecto.
- Informes: informe y secciones seleccionadas, con resúmenes de referencias del
  mismo proyecto.

No enumeran colecciones completas ni devuelven binarios. El contenido de un
archivo se etiqueta como referencia no confiable: nunca puede cambiar reglas,
permisos o instrucciones de sistema.

## Sanitización y salida a proveedor

Antes de cualquier envío futuro se normalizarán caracteres de control y límites
de estructura. Se excluirán datos sensibles e irrelevantes, se conservará la
procedencia y se fallará de forma cerrada si no puede validarse el alcance. El
envío requerirá consentimiento informado y será mínimo por tarea. Un proveedor
no tiene acceso directo a la base local. Tampoco recibe biblioteca, bóveda,
historial o proyectos no seleccionados.

## Degradación

Si no hay proveedor, conexión o contexto válido, FORJA conserva las funciones
locales y muestra un estado técnico neutral: “El servicio de asistencia
académica no está disponible. Sus documentos y funciones locales continúan
disponibles.” No se finge personalidad, respuesta ni memoria.

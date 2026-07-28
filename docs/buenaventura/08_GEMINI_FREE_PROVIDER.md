# Proveedor Gemini API Free Tier

## Estado y activación

Esta integración queda preparada para activación final, sin publicar todavía la
rama ni GitHub Pages. El frontend usa el Worker gratuito aprobado y conserva
`UnavailableProvider` cuando Gemini o Cloudflare no están disponibles.

El único modelo permitido es `gemini-3.5-flash-lite`. El proyecto `Forja` debe
permanecer en `Usage tier: Free`, sin cuenta de facturación ni tarjeta. No hay
fallback a modelos o proveedores pagados.

## Flujo

1. La persona selecciona de uno a cuatro fragmentos del mismo proyecto.
2. Revisa la vista previa y desidentifica manualmente su contenido.
3. Confirma por solicitud el uso de Gemini Free Tier, la desidentificación y
   que es mayor de 18 años.
4. El adaptador elimina identificadores locales y envía aliases efímeros al
   Worker.
5. El Worker valida origen, contrato y límites, y llama a Gemini con la clave
   almacenada como secreto.
6. El adaptador traduce `F1` a `F4` de vuelta a referencias locales en memoria.

No se usa IndexedDB, repositorio de escritura, historial, caché de respuestas,
bóveda, respaldo o sincronización.

## Payload navegador a proxy

```json
{
  "schemaVersion": "buenaventura-proxy-request-v1",
  "task": "explain|review|compare|suggest|question",
  "activeEvaluation": false,
  "identityStage": "professor_buenaventura|buenaventura|professor_tura|tura",
  "consent": {
    "externalProvider": true,
    "deidentified": true,
    "adultUse": true
  },
  "fragments": [
    {
      "alias": "F1",
      "module": "library|rubric|evidence|report",
      "kind": "tipo permitido por FORJA",
      "excerpt": "máximo 2.000 caracteres"
    }
  ]
}
```

Quedan excluidos `requestId`, `projectId`, IDs de artefactos, `selectionIds`,
títulos, procedencia, nombres de cuenta, otros proyectos, archivos, historial,
notas, bóveda, respaldos y credenciales. La evolución solo aporta
`identityStage`: no envía señales, hitos, fechas, historial, configuración ni
razones de transición.

## Payload proxy a Gemini

El Worker envía:

- `system_instruction` compuesta por la política común OBSERVE/RECOMMEND y una
  instrucción de voz fija y cerrada para `identityStage`;
- `contents[0]` con un JSON que contiene `task`, `activeEvaluation` y los
  fragmentos mínimos;
- `generationConfig.maxOutputTokens: 800`;
- `responseMimeType: application/json`;
- un esquema cerrado con `status`, `text` y referencias `F1` a `F4`.

No habilita grounding, URLs, archivos, búsqueda, funciones, ejecución de
código, caché, Batch, Flex ni Priority.

## Degradación

El proxy conserva categorías técnicas cerradas: `invalid_request` (400),
`permission_denied` (403), `model_not_found` (404), `quota_exhausted` (429) y
`provider_unavailable` (503). Nunca reenvía el mensaje completo de Gemini. El
frontend traduce cualquier fallo del proxy a la respuesta técnica local y no
reintenta con un servicio pagado.

La comprobación del 28 de julio de 2026 confirmó que `v1beta generateContent`
acepta `system_instruction`, `generationConfig`, `responseMimeType` y
`responseSchema` con `gemini-3.5-flash-lite`. El falso `provider_unavailable`
observado durante la activación provenía de JSON deformado por `curl.exe` bajo
PowerShell: el bloque de captura anterior confundía el error de análisis local
con una caída de Gemini. El análisis de JSON quedó separado y ahora responde
`400 invalid_request`.

## Privacidad pendiente

En Gemini API Free Tier Google puede utilizar las entradas y respuestas para
mejorar productos, y revisores humanos pueden procesarlas. Por eso la interfaz
prohíbe contenido personal, sensible o confidencial y exige confirmación
específica. Esta confirmación reduce riesgo, pero no detecta automáticamente
todos los datos personales; la revisión manual sigue siendo obligatoria.

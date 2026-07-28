# Evolución controlada hacia Tura

## Alcance

La única secuencia permitida es:

`Profesor Buenaventura → Buenaventura → Profesor Tura → Tura`.

Es una relación global, opt-in y local. Cambia el nombre presentado y pequeños
matices de concisión. No cambia rigor, permisos, contexto, consentimiento,
desidentificación ni límites de seguridad. Las cuatro etapas tratan siempre a
la persona de usted.

## Estado mínimo

`buenaventura-relationship-v1` conserva:

- evolución activada o desactivada;
- etapa actual;
- familias cualitativas observadas;
- confirmación de separación entre sesiones mediante días locales distintos;
- diversidad cerrada de tipos de tarea;
- día aproximado de la última observación.

No contiene puntuaciones, porcentajes, pesos, contadores, notas, frecuencia,
historial cronológico, prompts, respuestas, fragmentos ni identificadores
académicos.

## Política cualitativa

La política usa predicados booleanos, no sumas:

- toda transición exige sesiones separadas;
- debe existir una tarea analítica (`explain`, `compare` o `question`) y una
  orientada a acción (`review` o `suggest`);
- Profesor Buenaventura exige intento propio, razonamiento articulado y
  disciplina de contexto;
- Buenaventura exige revisión, decisión justificada y disciplina de contexto;
- Profesor Tura exige intento, razonamiento, revisión, decisión justificada y
  disciplina de contexto.

Disciplina de contexto significa fuente verificada o relación explícita entre
evidencia y criterio. Después de cada transición la evidencia cualitativa se
vacía. Así, una misma acción no puede producir dos etapas.

Solo se observa una acción si la solicitud termina correctamente, no existe
evaluación activa y no hubo error técnico. Notas, ausencias, tiempo transcurrido
y número de mensajes no participan.

## Voz

- Profesor Buenaventura: formal y algo más explicativo.
- Buenaventura: formal, directo y ligeramente más conciso.
- Profesor Tura: institucional, sobrio y más sintético.
- Tura: sobrio, directo y conciso.

No hay afecto, amistad simulada, dependencia, confianza emocional, celebración
ni reducción de exigencia. Una transición se comunica una sola vez:

> A partir de ahora puede llamarme Buenaventura. Las reglas de trabajo y mis
> permisos no cambian.

## Persistencia y respaldo

El estado usa una única clave `buenaventuraRelationship` en `settings`. La
auditoría confirmó que el respaldo v2 ya exporta y restaura esta colección de
forma atómica. No cambia la estructura superior ni las colecciones del formato,
por lo que crear v3 sería innecesario.

La clave nueva tiene validación cerrada. Respaldos v1 se convierten a v2 solo en
memoria y respaldos v2 conservan su versión. Un estado corrupto aborta antes de
escribir.

## Gemini

El proxy recibe únicamente `identityStage`. No recibe señales, hitos, fechas,
historial, configuración o razones de transición. El Worker selecciona una
instrucción fija por etapa y aplica una política común de OBSERVE, RECOMMEND,
trato de usted y seguridad. Gemini no decide ni menciona transiciones.

## Control de la persona

La evolución comienza desactivada. Desactivarla congela la etapa y no conserva
nuevas observaciones. Eliminarla borra la clave completa y vuelve a Profesor
Buenaventura. No existe control de QA en producción; las etapas artificiales se
construyen únicamente dentro de pruebas.

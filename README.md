# Forja

Forja es una aplicación web local para convertir materiales de estudio en sesiones de recuperación activa, repasos espaciados y simulacros. Está pensada para funcionar con cualquier materia sin convertir una guía en un simple resumen pasivo.

## Qué hace

- Importa PDF, DOCX, TXT, Markdown e imágenes con OCR.
- Permite pegar apuntes directamente desde el teléfono.
- Organiza materiales persistentes por materias.
- Genera preguntas trazables al documento: definiciones, listas, fórmulas, cálculos, procedimientos, comparación, causa–efecto y diagnóstico.
- Programa repasos adaptativos según dificultad y errores.
- Calcula rachas por día local, conserva el récord y desbloquea seis recompensas permanentes.
- Mezcla materias o permite estudiar una sola carpeta.
- Incluye simulacros cronometrados sin corrección inmediata.
- Compara confianza declarada con rendimiento para descubrir puntos ciegos.
- Lee preguntas y respuestas con la voz del dispositivo.
- Genera un calendario de sesiones con alarma hasta el examen.
- Guarda perfil, foto, documentos, preguntas y progreso en IndexedDB.
- Personaliza tema claro, oscuro o automático y seis paletas más un color libre.
- Exporta y restaura respaldos JSON con validación previa y reemplazo atómico.
- Crea una identidad mediante código de recuperación y contraseña, y genera bóvedas portátiles cifradas con AES-256-GCM.
- Se instala como PWA y mantiene disponible la interfaz sin conexión.
- Ajusta efectos y procesamiento según el dispositivo; pausa temporizadores y tareas evitables al quedar en segundo plano.

## Método de aprendizaje

El diseño prioriza dos técnicas de alta utilidad: práctica de recuperación y estudio distribuido. Añade intercalado, explicación y corrección de errores para evitar confundir familiaridad con dominio.

Fuentes principales:

- Dunlosky et al. (2013), *Improving Students’ Learning With Effective Learning Techniques*: https://pubmed.ncbi.nlm.nih.gov/26173288/
- Roediger y Karpicke (2006), *Test-Enhanced Learning*: https://pubmed.ncbi.nlm.nih.gov/16507066/
- Cepeda et al. (2006), *Distributed Practice in Verbal Recall Tasks*: https://pubmed.ncbi.nlm.nih.gov/16719566/
- Samani y Pan (2021), *Interleaved practice enhances memory and problem-solving*: https://pmc.ncbi.nlm.nih.gov/articles/PMC8589969/

## Privacidad

El despliegue actual no tiene backend, registro remoto ni analítica. El texto extraído, la foto de perfil y el progreso permanecen en el navegador. PDF.js, Mammoth y Tesseract se descargan desde versiones fijadas de jsDelivr solo cuando el formato los necesita; los archivos no se envían allí.

La bóveda de cuenta ya funciona entre dispositivos mediante archivo cifrado. `sync-worker/` contiene el backend de conocimiento cero para activar sincronización automática: hasta que su URL se configure, la aplicación indica claramente “modo portátil” y no simula una nube inexistente.

## Desarrollo

No requiere compilación.

```bash
python3 -m http.server 4173
npm install
npm run verify
```

La arquitectura mantiene cada archivo por debajo de 400 líneas para facilitar revisión y mantenimiento.

## Núcleo académico interno

La Fase 2 incorpora, todavía sin interfaz, un flujo único de proyecto → fuente →
rúbrica y criterio → evidencia → informe y sección. Los documentos continúan
almacenados una sola vez en la biblioteca y el proyecto guarda referencias y
relaciones semánticas. La interfaz futura deberá usar el repositorio académico;
no accederá directamente a IndexedDB.

La versión puente de producción conserva IndexedDB v2: acepta y exporta respaldos
v1 y no crea todavía stores académicos. El respaldo v2 y la migración v3 se prueban
en bases aisladas, pero permanecerán inactivos hasta la Etapa 2B. La arquitectura y el plan de entrega están documentados en
`docs/ACADEMIC_CORE_ARCHITECTURE.md` y `docs/ACADEMIC_CORE_DELIVERY.md`.

# Forja

Forja es una aplicación web local para convertir materiales de estudio en sesiones de recuperación activa, repasos espaciados y simulacros. Está pensada para funcionar con cualquier materia sin convertir una guía en un simple resumen pasivo.

## Qué hace

- Importa PDF, DOCX, TXT, Markdown e imágenes con OCR.
- Permite pegar apuntes directamente desde el teléfono.
- Organiza materiales persistentes por materias.
- Crea, edita, archiva y elimina proyectos académicos vinculados a una asignatura.
- Registra fuentes académicas por proyecto: archivos existentes, enlaces, libros,
  artículos, apuntes y videos.
- Construye rúbricas con criterios ordenados, puntajes derivados, obligatoriedad
  y estados verificables.
- Registra evidencias y muestra qué fuentes las sustentan y qué criterios intentan
  satisfacer, sin duplicar archivos.
- Construye informes por secciones ordenadas, con autoguardado, fuentes,
  evidencias, cobertura de rúbrica e hitos al finalizar.
- Prepara guiones de presentación con diapositivas, notas y vínculos académicos,
  y genera un paquete JSON local para una futura integración con NEXUS Present.
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
- Incluye identidad PWA, versión visible, estados offline, página 404, pantalla
  de carga breve y experiencia adaptable con movimiento reducido.
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
npm run verify:quick -- ux
npm run verify
```

Sustituye `ux` por el módulo en desarrollo. `verify` ejecuta la suite completa
y es obligatorio antes de publicar. Cada archivo debe permanecer bajo 400 líneas.

## Núcleo académico

IndexedDB v3 contiene el flujo proyecto → fuente → rúbrica y criterio → evidencia
→ informe y sección. Los documentos permanecen una sola vez en la biblioteca y
los componentes académicos se conectan mediante relaciones semánticas.

Los módulos visibles permiten gestionar proyectos, fuentes, rúbricas, evidencias,
informes y guiones de presentación. Toda operación visible pasa por
`AcademicRepository`; la interfaz nunca accede directamente a IndexedDB.

La arquitectura general y los módulos están documentados en
`docs/ACADEMIC_CORE_ARCHITECTURE.md`, `docs/ACADEMIC_CORE_DELIVERY.md` y
`docs/MODULE-1-PROJECTS.md`, `docs/MODULE-2-SOURCES.md` y
`docs/MODULE-3-RUBRICS.md`, `docs/MODULE-4-EVIDENCE.md` y
`docs/MODULE-5-REPORTS.md`, `docs/MODULE-6-PRESENTATIONS.md` y
`docs/MODULE-UX.md`.

La separación entre edición pública, aplicación, IndexedDB, Service Worker y
respaldos está propuesta —sin cambios de numeración todavía— en
`docs/VERSIONING.md`.

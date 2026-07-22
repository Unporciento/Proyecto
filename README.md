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

No existe backend, registro remoto ni analítica. El texto extraído, la foto de perfil y el progreso permanecen en el navegador. PDF.js, Mammoth y Tesseract se descargan desde versiones fijadas de jsDelivr solo cuando el formato los necesita; los archivos no se envían allí.

## Desarrollo

No requiere compilación.

```bash
python3 -m http.server 4173
npm test
npm run check
```

La arquitectura mantiene cada archivo por debajo de 400 líneas para facilitar revisión y mantenimiento.

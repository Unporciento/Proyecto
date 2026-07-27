# Seguridad de Forja

## Modelo

El despliegue actual de Forja es una aplicación estática sin servidor. El modo opcional de sincronización añade un Worker que almacena únicamente bóvedas cifradas; permanece desactivado mientras `SYNC_ENDPOINT` esté vacío. En modo local, la frontera de confianza es el navegador del usuario.

## Controles aplicados

- Política CSP restrictiva: recursos propios y versiones fijadas de jsDelivr; sin `eval`, objetos ni formularios externos.
- Verificación de tamaño, formato permitido y firma binaria antes de procesar un archivo.
- Archivos HTML, SVG, JavaScript y formatos no declarados se rechazan.
- Todo contenido procedente de documentos o nombres se escapa antes de insertarse en la interfaz.
- OCR y extracción ocurren en el navegador; no se transmite el archivo.
- Perfil y avatar se almacenan localmente; el avatar se decodifica, recorta y vuelve a codificar como JPEG.
- Los avatares guardados se vuelven a validar antes de mostrarse y se insertan mediante nodos DOM, nunca como HTML.
- Límite de 35 MB por material y 3 MB por avatar para reducir agotamiento de memoria.
- Dependencias externas con versiones exactas, cargadas solo para el formato correspondiente.
- Restauración de respaldo limitada a 10 MB, con estructura, referencias, cantidades y claves peligrosas validadas antes de escribir.
- La bóveda cifrada y el Worker admiten 16 MB para absorber el crecimiento causado por cifrado y Base64 de cualquier respaldo local aceptado.
- La restauración reemplaza todas las colecciones en una única transacción: o se completa entera o no modifica nada.
- Los contratos académicos rechazan tipos, versiones y campos no reconocidos antes de escribir.
- El repositorio comprueba asignaturas, proyectos, padres, documentos, extremos y relaciones duplicadas dentro de la misma transacción.
- La interfaz de proyectos construye nodos DOM con `textContent`, usa estados e
  iconos cerrados y nunca escribe directamente en IndexedDB.
- La interfaz de fuentes también usa `textContent`; los enlaces solo se muestran
  si usan HTTP o HTTPS y se abren con aislamiento `noopener noreferrer`.
- PDF, Word e imagen deben referenciar un documento existente de la asignatura.
  La referencia, la fuente y su relación se escriben o revierten juntas.
- Eliminar una fuente borra solo su artefacto y referencias académicas; el archivo
  original de la Biblioteca se conserva.
- Las rúbricas calculan su total desde los criterios; el repositorio rechaza
  totales manipulados, puntajes negativos, estados desconocidos y duplicados.
- Rúbrica y criterios se actualizan en una única transacción. Al quitar un criterio
  también se eliminan sus relaciones, sin borrar los artefactos relacionados.
- Eliminar un proyecto exige confirmación y borra su grafo en una sola transacción;
  archivar únicamente cambia su estado.
- Los respaldos v1 se convierten a v2 en memoria; el archivo original nunca se modifica.
- En 2B el objetivo efectivo es v3; la migración conserva los stores anteriores
  y crea únicamente los cuatro stores académicos aprobados.
- Navegación por hash restringida a una lista cerrada de vistas; el menú móvil bloquea el fondo y ofrece cinco vías de cierre.
- Las rachas se derivan de intentos reales almacenados, no de un contador editable en la interfaz.
- Borrado local requiere confirmación.

## Límites honestos

- Quien tenga acceso al perfil del navegador y al dispositivo puede leer los datos locales. Forja no cifra con contraseña porque una clave gestionada en el mismo frontend no protege frente a un atacante con acceso al navegador.
- Limpiar los datos de Safari/Chrome elimina la biblioteca. Se recomienda exportar respaldos con regularidad.
- El perfil es local, no sincroniza entre dispositivos.
- GitHub Pages no puede almacenar cuentas; por eso el frontend funciona con bóvedas cifradas y la sincronización remota se conecta a un Worker separado.
- Las bóvedas portátiles usan AES-256-GCM y PBKDF2-SHA-256; la clave combina el código de recuperación con la contraseña.
- El servidor opcional recibe solo ciphertext, una identidad y un token derivados conjuntamente de código y contraseña; nunca recibe la contraseña, el código ni datos legibles.
- La sincronización usa revisiones optimistas para impedir sobrescrituras silenciosas desde dispositivos desactualizados.
- La calidad del OCR depende de la imagen. El usuario debe revisar el texto y las respuestas generadas antes de un examen de alta importancia.

## Reporte

No publiques materiales personales ni datos sensibles en un issue público. Describe únicamente el comportamiento técnico y pasos mínimos para reproducirlo.

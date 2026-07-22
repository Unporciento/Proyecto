# Seguridad de Forja

## Modelo

Forja es una aplicación estática sin servidor. Esto elimina cuentas remotas, contraseñas, base de datos pública y endpoints de subida. La frontera de confianza es el navegador del usuario.

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
- La restauración reemplaza todas las colecciones en una única transacción: o se completa entera o no modifica nada.
- Navegación por hash restringida a una lista cerrada de vistas; el menú móvil bloquea el fondo y ofrece cinco vías de cierre.
- Las rachas se derivan de intentos reales almacenados, no de un contador editable en la interfaz.
- Borrado local requiere confirmación.

## Límites honestos

- Quien tenga acceso al perfil del navegador y al dispositivo puede leer los datos locales. Forja no cifra con contraseña porque una clave gestionada en el mismo frontend no protege frente a un atacante con acceso al navegador.
- Limpiar los datos de Safari/Chrome elimina la biblioteca. Se recomienda exportar respaldos con regularidad.
- El perfil es local, no sincroniza entre dispositivos.
- GitHub Pages no incluye cuentas: una futura sincronización deberá usar autenticación en servidor y cifrado previo en el dispositivo.
- La calidad del OCR depende de la imagen. El usuario debe revisar el texto y las respuestas generadas antes de un examen de alta importancia.

## Reporte

No publiques materiales personales ni datos sensibles en un issue público. Describe únicamente el comportamiento técnico y pasos mínimos para reproducirlo.

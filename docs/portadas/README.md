# Portadas de los juegos

Ilustraciones originales (SVG) de las portadas de Snake e Interrogatorio que
se muestran en la portada y el catálogo del portafolio. Usan los colores de
cada juego y la tipografía IBM Plex.

Para cambiarlas: edita el `.svg`, ábrelo en el navegador para revisarlo y
expórtalo a PNG de 1440×1080. Luego genera las versiones WebP de 720 y 1200 px
en `portal/capturas/` con los nombres `<juego>-portada-720.webp` y
`<juego>-portada-1200.webp`, y el respaldo `<juego>-portada.png`.

`renderizar.js` hace la exportación con Playwright (requiere las fuentes de
`portal/fuentes/` copiadas junto al SVG).

# 04 · Componentes

Cada pieza: qué es, cómo se ve, cuándo usarla y cuándo no. Clases en `codigo/base.css`; React en
`codigo/kit.tsx` y `codigo/controls.tsx`.

---

## Estructura

### Header · `.hdr`
- La marca (`.brand`) en 2 líneas de etiqueta fuerte. Siempre a la izquierda y nunca es un
  botón.
- Después van:
  - la pastilla de modos: un ícono por modo, con el activo en negro;
  - la pastilla de historial (deshacer y rehacer, que se desactivan si no hay pasos);
  - descargar y compartir, como botones sueltos.
- Deshacer, rehacer, descargar y compartir actúan **sobre el modo activo**.
- Compartir usa `navigator.share` donde existe y, si no, descarga.

### Tarjeta del lienzo · `.card`
- Fondo `--card`, radio 5, `overflow: hidden` y `touch-action: none`: los gestos son de la
  app, no del navegador.
- Admite como mucho dos botones redondos (`.card-btn.left` y `.card-btn.right`), por
  ejemplo voltear y "?", más el aviso breve (`.notice`) y la barra flotante (`.float-bar`).

### Fila de herramientas · `.toolrow`
- Alto 40 px, con hasta 3 elementos: pastilla, pastilla o selector, y botón suelto.
- **Orden fijo de la pastilla de paneles:** las pestañas simples primero, la acción
  "Sugerir" (dado) después y el engranaje "Avanzado" siempre al final.
- La herramienta activa y la pestaña activa se marcan en negro, cada una dentro de su
  pastilla.

### Hoja inferior · `<Sheet>` / `.sheet`
- Fondo `--sheet`, radio 25 arriba y tirador de 100 × 2 px. El contenido scrollea por
  dentro (`overscroll-behavior: contain`).
- `height` y `onHeight` controlan el alto en el teléfono. La app lo guarda en sus
  preferencias para recordarlo.
- Adentro va un `.panel-body` en este orden:
  1. la fila rápida (si la hay);
  2. las secciones esenciales, cada una con su `Label`;
  3. `Advanced` al final.
- Si un panel tiene título propio, va como `.label.sheet-title` (etiqueta fuerte).

---

## Botones

### Botón de ícono · `<IconButton>` / `.ibtn`
- Transparente dentro de una pastilla; activo = fondo negro e ícono blanco.
- **Siempre** lleva `label`: es el `aria-label` y el `title`. El texto describe la acción
  completa ("Sello: tocá para estampar…").
- Su área tocable crece 6 px arriba y abajo con `::before`.
- **Variante suelta** (`className="solo"`): fondo `--control` y 37–40 px. Es para acciones
  únicas, como descargar, compartir o limpiar.
- **Insignia** (`.ibtn-badge`): un número chico abajo a la derecha que indica un estado del
  botón (por ejemplo "2" o "4" en simetría).

### Pastilla · `<Pill>` / `.pill`
- Agrupa botones de la misma familia sobre fondo `--control`, con radio 5.
- `white` la vuelve blanca, para usarla sobre la hoja gris.
- No mezcla familias: herramientas en una pastilla, pestañas en otra.

### Botón ancho · `.wide-btn` / `.wide-btn.dark`
- Mide 44 px de alto, a todo el ancho, con etiqueta fuerte.
- Blanco para acciones secundarias y negro (`dark`) para la principal. Como mucho una negra
  por panel.

### Texto enlace · `.text-link`
- Etiqueta fuerte subrayada, para salidas suaves ("Listo", "Volver").

### Chips · `.chips`
- Botones blancos de 44 px de ancho mínimo para valores discretos (cuerpos, tamaños). El
  elegido es negro.

---

## Controles

### Deslizador · `<RangeControl>`
- Arriba, la etiqueta a la izquierda y el valor (etiqueta fuerte) a la derecha. Debajo, la
  pista fina, con el tramo lleno en `--handle` y un pulgar negro de 11 px.
- `hint` agrega una línea de cuerpo chico debajo. Usarla solo si el control no se entiende
  probándolo.
- `extra` admite algo chico entre etiqueta y valor (el chip "Aleatorio").
- El valor siempre lleva unidad (`42%`, `15°`, `36 pt`). Si hay un rango, se muestra como
  rango (`8–42%`).
- Todo el arrastre es **un** paso de deshacer (`gesture`).

### Chip "Aleatorio" · `<ChipToggle>`
- Un conmutador de 22 px junto a la etiqueta de un deslizador.
- Encendido, cada uso toma un valor al azar entre un mínimo (o 0) y lo elegido, y el valor
  del deslizador pasa a mostrarse como rango.
- Es el patrón para "variación" en cualquier parámetro numérico.

### Interruptor · `<Switch>`
- La etiqueta en mayúsculas a la izquierda, con una ayuda de cuerpo chico debajo, y el
  switch a la derecha (negro = encendido). Mide 44 px de alto mínimo.

### Segmentado · `<Segmented>`
- Para 2 o 3 opciones excluyentes con texto: fondo blanco y segmento activo negro.
- Debajo suele ir una `.sheet-note` que explica la opción elegida y cambia con ella.

### Fila rápida · `.quick-row` + `<QuickGroup>` + `<QuickToggle>`
- La primera fila de un panel: **tres columnas del mismo ancho**. Por ejemplo, disposición
  (3 íconos), alineación (3 íconos) y un interruptor compacto con una palabra ("ALTURA").
- Los botones (`.qbtn`) son blancos y de 32 px de alto. Si una opción no aplica, el grupo
  se desactiva en vez de desaparecer.
- Sirve para los ajustes de "forma" que se tocan seguido y se entienden por ícono.

### Avanzado · `<Advanced>`
- Un `details` con una línea arriba, el título "AVANZADO" en etiqueta fuerte y una flecha.
  Viene plegado.
- Va siempre al final del panel. Adentro puede llevar `Label` y cualquier control.

### Selector desplegable · `.selector`
- Ocupa el lugar de una pastilla en la fila.
- Tiene un cuadro negro de 40 px con una muestra (por ejemplo "Aa" en la fuente elegida),
  el nombre y un subtítulo (valor en etiqueta), y una flecha.
- **Solo la flecha rota** al abrir (`.selector.open`); la muestra no se mueve.
- Al abrirlo, la hoja muestra la lista de opciones.

### Campo · `.field`
- 33 px de alto, fondo `--control`, texto de 16 px centrado y placeholder de 13 px.

---

## Elección visual

### Muestras de color · `.swatches` / `.swatch`
- Círculos de 34 px, centrados, que bajan de línea si no entran.
- El elegido lleva un tilde blanco, o negro sobre colores claros, y un doble anillo
  (blanco + `#1A1C1C`).
- Los colores claros llevan `.swatch-light`, con borde interior para no perderse en el
  fondo.
- El último círculo es siempre el color propio (`.swatch-custom`, un arcoíris con un
  `<input type=color>` invisible encima).

### Tarjetas elegibles · `.pick-card`, `.pick-list`, `.pick-tray`, `.pick-grid`
- Fondo blanco y radio 5. La elegida lleva **borde interior negro de 2 px**.
- Llevan un nombre (etiqueta fuerte) y una descripción (cuerpo chico, `--muted`).
- Tres formas de ordenarlas:

| Disposición | Para qué | Ejemplos |
|---|---|---|
| `.pick-list` (vertical) | Opciones que se explican con texto | recetas, cajas |
| `.pick-tray` (horizontal, desliza de costado) | Opciones con imagen | sellos, tipos |
| `.pick-grid` (5 columnas) | Muestras visuales chicas | texturas, con nombre debajo |

---

## Mensajes

### Aviso breve · `.notice`
- Una pastilla negra con etiqueta fuerte blanca, centrada en la tarjeta, que dura
  **1,4 s**. Es región viva (`role="status"`).
- Confirma acciones o explica lo que pasó: "IMAGEN DESCARGADA", "ESA LETRA NO ESTÁ EN LA
  CAJA".

### Aviso de primera vez · `.coach-mark`
- Una caja negra abajo de la tarjeta, con un título de 15 px, 1 o 2 frases de 13 px, "Más
  en ?" y el botón "ENTENDIDO".
- Aparece **una sola vez** por tema (se guarda en las preferencias), y se puede volver a
  activar desde la guía.

### Hoja superpuesta · `.overlay` + `.overlay-sheet`
- Para la guía, fichas y textos largos: velo `rgba(0,0,0,.28)`, una hoja de hasta 560 px y
  80 dvh, y texto de lectura de 14/20.
- En la computadora queda centrada y con todas las esquinas redondeadas.
- Las preguntas y temas van en `details` blancos de 48 px de alto mínimo.

### Mensaje del sistema · `.toast`
- Abajo a la izquierda, negro, de 12 px. Solo para problemas técnicos (una fuente que no
  cargó); lo del usuario va en `.notice`.

---

## Antes de crear una pieza nueva

1. ¿Es una elección entre opciones? Segmentado (texto), fila rápida (íconos) o tarjetas
   (imagen o descripción).
2. ¿Es un número? Deslizador, con el chip "Aleatorio" si tiene sentido variar.
3. ¿Es un sí o no? Interruptor, o interruptor compacto si va en la fila rápida.
4. ¿Es una acción? Botón de ícono en la fila o en el header; si hace falta texto, botón
   ancho.
5. ¿Es información? Aviso breve si es una respuesta, aviso de primera vez si enseña algo, y
   hoja superpuesta si es largo.

Si nada de esto alcanza, la pieza nueva usa los mismos tokens:

- radio 5;
- fondo blanco sobre la hoja o `--control` sobre blanco;
- activo en negro;
- textos con los roles de `02-fundamentos.md`.

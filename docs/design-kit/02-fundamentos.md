# 02 · Fundamentos (tokens)

Todos los valores viven en `codigo/tokens.css`. Ningún componente usa colores ni medidas sueltas
que no salgan de ahí, salvo las pocas excepciones marcadas abajo.

## Color

| Token | Valor | Uso |
|---|---|---|
| `--black` | `#000000` | Lo activo (fondo), el texto, los íconos, el pulgar del deslizador |
| `--white` | `#FFFFFF` | Fondo de la app; controles sobre la hoja gris; texto sobre negro |
| `--control` | `#F4F4F4` | Botones, pastillas, el campo y los selectores sobre fondo blanco |
| `--sheet` | `#F4F4F4` | La hoja inferior y las hojas superpuestas |
| `--card` | `#EEECE5` | La tarjeta del lienzo (beige claro) |
| `--handle` | `#9D9D9D` | Tirador de la hoja, barra de scroll, tramo lleno del deslizador |
| `--track` | `#FFFFFF` | Tramo vacío del deslizador |
| `--muted` | `#717171` | Texto secundario: el valor bajo un nombre, ayudas de controles |
| `--placeholder` | `#5C5C5C` | Placeholder del campo y notas de la hoja (`.sheet-note`) |
| `--accent` | `#EA5144` | Solo cursor, selección en el lienzo y anillo de carga. Nunca en botones |

**Propios de ARMA TU MATRIZ** (no se trasladan a otra app salvo que tenga objetos parecidos):
`--sort` `#BBBCB6` (cuerpo del tipo), `--furniture` `#8D978F` (relleno),
`--sort-edge` `rgba(0,0,0,.18)`.

**Excepciones toleradas:**
- el gris del interruptor apagado, `#D6D6D6` / `#D2D2D2`;
- la línea de "Avanzado", `#E2E2E2`;
- las sombras: hoja flotante `0 -10px 30px rgba(0,0,0,.18)`, barra flotante
  `0 4px 16px rgba(0,0,0,.14)`, objeto arrastrado `0 10px 26px rgba(0,0,0,.25)`;
- el velo de las hojas superpuestas, `rgba(0,0,0,.28)`.

**Contraste:**
- negro sobre `#F4F4F4` o `#EEECE5`: 17:1 o más;
- `--muted` sobre blanco: 4,9:1 (alcanza para texto de 12 px);
- `--placeholder` sobre `#F4F4F4`: 6,1:1.

## Tipografía

Dos familias, con roles que no se mezclan:

| Rol | Familia | Tamaño / interlínea | Otros | Dónde |
|---|---|---|---|---|
| **Etiqueta** | Alte Haas Grotesk 400 | 11 / 12 px | tracking 2 px, MAYÚSCULAS | Títulos de sección, nombres de controles, segmentos |
| **Etiqueta fuerte** | Alte Haas Grotesk 700 | 11 / 12 px | tracking 2 px, MAYÚSCULAS | Marca, avisos, "Avanzado", botones de texto, valores |
| **Cuerpo chico** | Work Sans 400 | 12 / 16 px | — | Ayudas, notas, descripciones |
| **Lectura** | Work Sans 400–600 | 14 / 20 px | — | Fichas, guía, textos educativos |
| **Título de hoja** | Work Sans 600 | 20 / 24 px | — | Encabezado de una ficha |
| **Campo** | Work Sans 400 | 16 px | centrado | El campo de texto (16 px evita el zoom de iOS) |

- Ningún texto de la interfaz baja de **11 px**. La única excepción es la insignia numérica
  del botón de simetría, de 9 px, que es decorativa.
- El tracking de 2 px es para MAYÚSCULAS. En segmentos y chips angostos se baja a 1–1,5 px.
- Los números de valor (`42%`, `36PT`) van como etiqueta fuerte, alineados a la derecha.
- En pantallas de 900 px o más, la marca sube a 13 / 15 px y el resto queda igual.

## Medidas y espacio

| Token | Valor | Uso |
|---|---|---|
| `--gutter` | 20 px (24 px desde 900 px) | Margen lateral de toda la app |
| `--gap` | 8 px | Separación entre piezas: header, campo, tarjeta, fila |
| `--control-h` | 33 px (40 px en la fila de herramientas) | Alto de botones, pastillas, campo, segmentos |
| `--icon-w` | 34 px | Ancho de un botón de ícono dentro de una pastilla |
| `--touch` | 44 px | Área tocable mínima. Un botón que se ve más chico amplía su área con `::before` |
| `--radius` | 5 px | Todo: botones, pastillas, tarjetas, campo |
| `--radius-sheet` | 25 px | Esquinas superiores de la hoja inferior y de las hojas superpuestas |

Otros valores fijos:

- **Botones:**
  - botón suelto (`.ibtn.solo`): 37 px de ancho en el header y 40 px en la fila;
  - botones redondos del lienzo: 30–32 px, a 6 px del borde;
  - botones cuadrados de la fila rápida: 32 px de alto, a lo ancho de su columna.
- **Hoja:**
  - tirador: 100 × 2 px, en una franja de 16 px;
  - alto inicial: 236 px, ajustable entre 150 px y el 70 % de la pantalla (se recuerda);
  - tope de alto en el teléfono: 60 dvh.
- **Muestras:**
  - de color: círculos de 34 px;
  - de textura: tarjetas de proporción 11:15.
- **Controles:**
  - deslizador: pista de 5 px, pulgar negro de 11 px, área de 22 px;
  - interruptor: 38 × 22 px, con bolita de 16 px;
  - interruptor compacto: 30 × 18 px;
  - chip "Aleatorio": 22 px de alto, radio 11.
- **Ritmo vertical dentro de la hoja:**
  - etiqueta de sección: 16 px arriba y 8 abajo (4 px si es la primera);
  - entre controles: 12 px;
  - notas: 6 px arriba y 10 abajo.

## Movimiento

| Qué | Duración | Curva |
|---|---|---|
| Estado de botones (color, fondo) | 120 ms | lineal |
| Interruptores, flecha del selector, "Avanzado" | 150 ms | ease |
| Una pieza que se acomoda en su lugar | 220 ms | `cubic-bezier(.2,.8,.2,1.12)`, con un leve rebote |
| Aviso de primera vez (entra) | 280 ms | `cubic-bezier(.2,.8,.2,1)` |
| Voltear el lienzo (espejo) | 620 ms | `cubic-bezier(.45,.05,.25,1)` |
| Transición entre modos (animación de entintado) | ≈ 2,2 s | se puede saltear tocando |

Con `prefers-reduced-motion`, todo pasa a 0,01 s (`base.css`).

## Íconos

- Trazo de 1,5 px, puntas y uniones redondeadas, sin relleno, en `currentColor`.
- Se dibujan a 17–20 px dentro de botones de 33–40 px.
- Hay 21 en `icons.tsx`:

| Grupo | Íconos |
|---|---|
| Modos y tipo | `Type`, `TextStyle`, `Roller` |
| Historial | `Undo`, `Redo` |
| Salida | `Save` (descargar), `Share` |
| Paneles | `Grid`, `Frame`, `Gear`, `Palette`, `Drop`, `File` |
| Acciones | `Dice` (sugerir), `Help`, `Chevron`, `Trash`, `Mirror` |
| Herramientas | `Stamp`, `Brush`, `Circles` |

- Un ícono nuevo se dibuja con las mismas reglas: caja cuadrada, trazo de 1,5 px y formas
  simples.

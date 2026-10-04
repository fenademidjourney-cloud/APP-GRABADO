# 03 · Anatomía de la pantalla y layout

Ver `capturas/01…04` (la app real) y `demo-pantalla.html` (la plantilla).

## En el teléfono (diseño base: 390 × 844)

```
┌──────────────────────────────────────┐  safe-area-inset-top
│ MARCA    [T|▤]  [↶ ↷]  [💾]  [⇪]     │  HEADER · 33 px · arriba 11 px, lados 20 px
│                                      │  gap 8
│ [        campo de texto          ]   │  CAMPO · 33 px (opcional, solo donde se escribe)
│                                      │  gap 8
│ ┌──────────────────────────────────┐ │
│ │ (◐)                          (?) │ │  TARJETA DEL LIENZO · #EEECE5 · crece (flex 1)
│ │          ┌──────────┐            │ │    botones redondos a 6 px de las esquinas
│ │          │  LIENZO  │            │ │    aviso centrado a 46 px del borde superior
│ │          └──────────┘            │ │    el contenido encaja, nunca desborda
│ └──────────────────────────────────┘ │
│                                      │  10 px
│ [▦ A ⚄ ⚙]  [Aa  Nombre        ⌄]    │  FILA DE HERRAMIENTAS · 40 px
│                                      │  10 px
│╭────────────────────────────────────╮│
││              ────                  ││  HOJA · #F4F4F4 · radio 25 arriba
││  CONTENIDO DEL PANEL (scroll)      ││    alto 236 px por defecto; tirador para cambiarlo
││                                    ││    el contenido scrollea dentro, la página nunca
│╰────────────────────────────────────╯│  safe-area-inset-bottom
└──────────────────────────────────────┘
```

**Reglas:**

- **La app ocupa exactamente la pantalla.** Usa `100dvh`, `body` con `overflow: hidden` y
  sin scroll de página. Solo scrollean la hoja y las bandejas horizontales.
- **Margen lateral de 20 px** para todo lo de arriba. La hoja va de borde a borde, con su
  contenido a 20 px.
- **Header:** la marca a la izquierda, en dos líneas de etiqueta fuerte. Después vienen el
  selector de modo (pastilla), deshacer y rehacer (pastilla), descargar y compartir
  (botones sueltos). Los modos se distinguen por ícono, no por texto.
- **Campo:** de ancho completo y centrado, con el placeholder como invitación ("Escribí…").
  Solo aparece en el modo donde se escribe.
- **Tarjeta:** es la única pieza elástica, y todo lo demás tiene alto fijo.
  - El lienzo se dibuja centrado, encajado (`fit = min(ancho/W, alto/H)`) y con su propio
    fondo y sombra suave (`0 1px 3px rgba(0,0,0,.12)`).
- **Fila de herramientas** (40 px), de izquierda a derecha:
  1. una pastilla con 3 o 4 botones de ícono (herramientas o pestañas);
  2. una segunda pastilla de pestañas, o un selector desplegable;
  3. al final, como mucho, un botón suelto (Limpiar).

  Las pastillas se reparten el ancho (`flex: 1`) y sus botones también, con un máximo de
  48 px cada uno. El último botón de la pastilla de paneles es siempre el engranaje
  (Avanzado).
- **Hoja inferior:** muestra el panel de la pestaña activa.
  - El tirador cambia su alto y la app recuerda el último.
  - Lo esencial va arriba y "Avanzado" al final, plegado.

## En la computadora (desde 900 px)

Son las mismas piezas en otro contenedor (`base.css`, `@media (min-width: 900px)`):

```
┌───────────────────────────────────────────────────────────────────┐
│ MARCA            [T|▤]  [↶ ↷]  [💾]  [⇪]                          │  header a todo el ancho
├──────────────────────────────────────────────┬────────────────────┤
│ [ campo ]                                    │ [fila de           │
│ ┌──────────────────────────────────────────┐ │  herramientas]     │
│ │                                          │ │ ╭────────────────╮ │
│ │              TARJETA DEL LIENZO          │ │ │                │ │
│ │              (todo el alto)              │ │ │  HOJA          │ │
│ │                                          │ │ │  (todo el alto,│ │
│ │                                          │ │ │  radio 25 en   │ │
│ └──────────────────────────────────────────┘ │ │  las 4 puntas) │ │
│                                              │ ╰────────────────╯ │
└──────────────────────────────────────────────┴────────────────────┘
          .mode-main (flex 1)              gap 20    .mode-side (400 px)
```

- El margen pasa a 24 px, y el header gana 16 px arriba.
- La columna derecha mide 400 px: la fila arriba y la hoja ocupando el resto. El tirador se
  oculta, porque la hoja ya tiene todo el alto.
- Las hojas superpuestas (guía, ficha) pasan a ser un panel centrado, o un panel de 420 px
  anclado abajo a la derecha.

## Estructura en el código

```tsx
<div className="app-shell">
  <Header />
  <main className="mode">
    <div className="mode-main">   {/* campo + tarjeta */} </div>
    <div className="mode-side">   {/* fila + hoja */}    </div>
  </main>
</div>
```

`mode-main` y `mode-side` son las dos columnas de la computadora. En el teléfono se apilan, y
por eso la fila y la hoja quedan debajo de la tarjeta.

## Superposiciones (de abajo hacia arriba)

| z-index | Pieza |
|---|---|
| 5–8 | Insignias y barra flotante de selección, dentro de la tarjeta |
| 12 | Aviso de primera vez (dentro de la tarjeta, abajo) |
| 20 | Aviso breve (dentro de la tarjeta, arriba) |
| 30–31 | Vista previa del cursor y anillo de carga (fijos) |
| 40 | Transición entre modos (cubre la tarjeta) |
| 55–60 | Ficha y hojas superpuestas con velo |
| 100 | Mensaje del sistema (abajo a la izquierda) |
| 998–999 | Lo que se está arrastrando |

## Header de la web anfitriona (pendiente)

Si la app vive dentro de un sitio con su propio header:
- ese header va arriba, fijo, a todo el ancho;
- la app empieza debajo, con `.app-shell { height: calc(100dvh - var(--web-h)) }`.

Los gestos no se rompen, porque las coordenadas se toman siempre con `getBoundingClientRect()`
y nunca con posiciones fijas.

# 05 · Interacción

## Gestos: un gesto, un significado

| Gesto | Significa | Detalle |
|---|---|---|
| **Tocar** | Hacer: insertar, elegir, estampar | La respuesta es inmediata y visible. Si algo "vuela" a su lugar, se anima |
| **Mantener apretado** (≈ 260 ms quieto) | Levantar o cargar | Levanta una pieza para arrastrarla, o carga una herramienta (más tinta, más presión). Un anillo o una escala de 1,1 + sombra muestra que se activó |
| **Mantener sin mover** (en una herramienta de dibujo) | Acumular | La herramienta sigue actuando en el lugar: el pincel empapa y el patrón crece en anillos |
| **Arrastrar** | Mover o trazar | La pieza sigue al dedo; el pincel deja un rastro continuo |
| **Deslizar** dentro de una lista o bandeja | Recorrer | Nunca inserta ni arrastra: el desplazamiento y el arrastre no se confunden |
| **Pellizcar / Ctrl + rueda** | Ampliar el lienzo | Opcional. El lienzo vuelve a encajar solo cuando cambia el contenido |
| **Soltar sobre el centro de otra pieza** | Intercambiar | Soltar en un hueco inserta |

**Tiempos:**
- la pulsación larga se activa a los **260 ms**;
- una herramienta detecta que el dedo está quieto a los **60 ms**, y desde ahí repite su
  acción cada **70 ms**;
- un aviso breve dura **1,4 s**;
- dos cambios con la misma clave en menos de **1 s** son un solo paso de deshacer.

## Puntero: reglas técnicas que evitan los errores que ya tuvimos

- Usar **Pointer Events** (`pointerdown/move/up/cancel`) con `setPointerCapture`. Escuchar
  `move` y `up` en `window` mientras dura el gesto, y limpiar todo en `up` **y** en
  `cancel`.
- Usar `getCoalescedEvents()` si existe, para que un trazo rápido no tenga saltos.
- Las coordenadas siempre salen de `getBoundingClientRect()` del lienzo, en el momento.
  Nunca usar offsets fijos (así un header externo no rompe nada).
- `touch-action` por zona:

| Zona | Valor |
|---|---|
| Lienzo, tarjeta, tirador | `none` |
| Hoja y listas verticales | `pan-y` |
| Bandejas horizontales | `pan-x` |

- **En toda superficie donde se mantiene apretado** hay que bloquear lo que el sistema hace
  con una pulsación larga. Si no, cancela el puntero y el gesto se corta (bug real: el
  pincel quedaba en una sola impresión al mantener y arrastrar con el dedo).
  - CSS: `-webkit-touch-callout: none; user-select: none; -webkit-tap-highlight-color: transparent`.
  - JS: `preventDefault` en `contextmenu`, `selectstart`, `dragstart` y en
    `touchstart`/`touchmove` con `{ passive: false }`.
- Ante un `pointercancel` se cierra el gesto **sin** usar las coordenadas del evento, que
  pueden llegar como (0,0).

## Deshacer

- Hay un historial por modo (`history.ts`), con un tope de 100 pasos.
- Un paso es un gesto completo: un arrastre de deslizador, un arrastre de pieza o una
  ráfaga de tipeo. En el deslizador, el gesto se abre en `pointerdown` y se cierra en
  `pointerup`.
- Deshacer y rehacer están siempre en el header, y también responden a Ctrl+Z y
  Ctrl+Shift+Z.
- "Limpiar" o "Reemplazar todo" también se pueden deshacer, así que no piden confirmación.
  Solo se confirma lo que no tiene vuelta atrás.

## "Sugerir" (el dado)

- **Cada toque tiene que dar un resultado visiblemente distinto.**
  - Se elige un estilo entre varios definidos, y nunca el mismo dos veces seguidas. Después
    se sortean sus valores dentro de su rango.
  - No alcanza con cambiar la semilla: si la configuración actual deja poco margen, el
    resultado se repite. Cuando hace falta, Sugerir abre la configuración (en ARMA TU
    MATRIZ, por ejemplo, pasa de "una sola tipografía" a "mezcla").
- Respeta lo que el usuario fijó a mano: disposición, interruptores, piezas fijadas.
- Todo el cambio es un solo paso de deshacer.

## Elegir algo reemplaza, no acumula

Elegir una opción global en un selector (una tipografía, un tamaño) **la aplica a todo** en
un solo paso que se puede deshacer. No queda "para lo próximo" ni se suma a lo anterior. Si
algo no se puede aplicar, se explica con un aviso breve.

## Respuesta y estados

- **Presionar** un elemento lo achica a 0,94. **Levantarlo** lo agranda a 1,1 y le agrega
  sombra (`0 8px 18px rgba(0,0,0,.22)`). **Asentarlo** lo anima 220 ms, con un leve
  rebote.
- **Mientras se arrastra**, el lugar donde va a caer se marca: el hueco se abre o el
  objetivo toma el acento. La previsualización solo se recalcula cuando cambia el objetivo,
  no en cada movimiento.
- **Si no se puede hacer algo**, se explica con un aviso breve; el control no queda sin
  responder.
- **Un control que no aplica** baja a 30 % de opacidad y queda en su lugar.
- **Una herramienta de dibujo**, con mouse, muestra una vista previa al 32 % de opacidad de
  dónde va a caer.

## Persistencia

- Se guarda solo, sin botón de guardar: el documento, las preferencias (alto de la hoja,
  silencio, avisos vistos, últimas elecciones) y el trabajo de cada modo.
- Las claves llevan prefijo (`nombre-app:`), porque en `file://` el navegador comparte el
  almacenamiento entre archivos. Todo va con `try/catch`.
- Al cargar, los datos se sanean con una lista blanca, nunca con `...guardado`. Si una
  opción guardada ya no existe, se vuelve al valor por defecto.

## Accesibilidad

- `lang="es"` y foco visible en todo (`outline: 2px solid #000; outline-offset: 2px`).
- Todo botón de ícono lleva nombre accesible (`label`) y `aria-pressed` si es conmutable.
- Los deslizadores llevan `aria-label` con su etiqueta.
- Los avisos usan `role="status"` / `aria-live="polite"`.
- El área tocable es de 44 px o más, aunque el control se vea más chico.
- Lo elegido nunca se indica solo con color: también con negro e inversión, un tilde o un
  borde.
- Se respeta `prefers-reduced-motion`.
- Las piezas del lienzo se pueden enfocar con Tab, elegir con Enter y mover con Alt +
  flechas.

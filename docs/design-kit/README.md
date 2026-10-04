# Design kit — base de diseño y UX de ARMA TU MATRIZ

Todo lo que define cómo se ve y cómo se usa ARMA TU MATRIZ, separado de lo que esa app hace
(tipos móviles, matriz, estampado). Sirve para arrancar otra app con la misma experiencia.

**Origen:** Figma del usuario, archivo `9Qr4Fw7Ws9aTNRdbPejnqy` ("App Arma tu matriz"), página
MOBILE, frames MODO 1 (`1:13`) y MODO 2 (`1:221`), 390 × 844. Las reglas de abajo incluyen
además los ajustes que salieron de probar la app (rondas de septiembre 2026).

## Qué hay en la carpeta

| Archivo | Para qué |
|---|---|
| [01-principios.md](01-principios.md) | Las ideas que guían todas las decisiones. Leer primero. |
| [02-fundamentos.md](02-fundamentos.md) | Tokens: color, tipografía, medidas, radios, movimiento. |
| [03-anatomia-y-layout.md](03-anatomia-y-layout.md) | La pantalla tipo, medida por medida, en el teléfono y en la computadora. |
| [04-componentes.md](04-componentes.md) | Cada pieza de la interfaz: qué es, cómo se ve, cuándo usarla. |
| [05-interaccion.md](05-interaccion.md) | Gestos, tiempos, deshacer, avisos, accesibilidad. |
| [06-voz-y-textos.md](06-voz-y-textos.md) | Cómo se escribe: tono, mayúsculas, largo, ejemplos. |
| [07-checklist.md](07-checklist.md) | Lista para revisar cada pantalla nueva antes de darla por buena. |
| `demo.html` | Todas las piezas juntas (abrir con doble clic). `demo-pantalla.html` es la pantalla tipo sola: en una ventana ancha muestra el diseño de computadora. |
| `capturas/` | La app real a 390 × 844 y la demo del kit. |
| `codigo/` | El código listo para copiar (ver abajo). |

### `codigo/`

| Archivo | Contenido |
|---|---|
| `tokens.css` | Variables de diseño y `@font-face` (apunta a `./fuentes/`). Se importa primero. |
| `base.css` | Estilos de todas las piezas genéricas: shell, header, pastillas, fila de herramientas, tarjeta, hoja, controles, muestras, avisos, versión de computadora. |
| `kit.tsx` | React: `IconButton`, `Pill`, `Sheet` (hoja con tirador), `Advanced`, `Label`. |
| `controls.tsx` | React: `RangeControl`, `ChipToggle` ("Aleatorio"), `Switch`, `Segmented`, `QuickGroup`, `QuickToggle`. |
| `icons.tsx` | Los 21 íconos del Figma, en `currentColor`. |
| `history.ts` | Historial de deshacer inmutable, con agrupado por clave y por gesto. |
| `plantilla-app.tsx` | La pantalla tipo armada con las piezas: el punto de partida de una app nueva. |
| `vite.config.ejemplo.ts` | Configuración para entregar la app como un único HTML que funciona sin conexión. |
| `fuentes/` | Alte Haas Grotesk (400, 700) y Work Sans (400, 500, 600) en WOFF. |

## Cómo arrancar otra app con esto

1. Crear el proyecto (React + TypeScript + Vite) y copiar `codigo/` a `src/ui/`.
2. Importar `tokens.css` y después `base.css` en el punto de entrada, y partir de `plantilla-app.tsx`.
3. Si se entrega como un único HTML sin conexión: `npm i -D vite-plugin-singlefile` y usar
   `vite.config.ejemplo.ts`.
4. Copiar esta carpeta de documentos al proyecto nuevo (por ejemplo, `docs/design-kit/`). Si se
   trabaja con Claude Code, agregar esto al `CLAUDE.md` del proyecto nuevo:

   > La interfaz sigue el design kit de `docs/design-kit/`. Antes de diseñar o cambiar
   > cualquier pantalla, leé `README.md`, `01-principios.md` y `03-anatomia-y-layout.md`.
   > Reutilizá las piezas de `src/ui/` antes de crear nuevas. Revisá cada pantalla con
   > `07-checklist.md`.

## Licencias de las fuentes — revisar antes de reutilizar

- **Work Sans:** SIL Open Font License 1.1. Se puede embeber y redistribuir.
- **Alte Haas Grotesk** (Yann Le Coroller): el usuario autorizó embeberla en ARMA TU MATRIZ.
  **Para otra app, confirmar su licencia de uso antes de publicarla.** Si no se puede usar,
  el reemplazo más cercano es una grotesca libre con mayúsculas anchas, como Archivo o
  Work Sans 600, sin tocar el resto de los tokens.
- Los íconos son los del Figma del usuario.

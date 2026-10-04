# 01 · Principios

Siete ideas, en orden de prioridad. Cuando dos chocan, gana la que está más arriba.

## 1. Lo tiene que poder usar un chico; el adulto encuentra más un paso después

- Cada panel muestra primero lo esencial, grande: tres a cinco decisiones como máximo.
- Lo fino vive plegado en **"Avanzado"** (`<Advanced>`), al final del panel, o detrás del
  engranaje (último botón de la fila).
- Una acción tiene que entenderse sin leer: ícono claro, resultado inmediato y visible.
- Si un ajuste necesita una explicación larga para un chico, va en Avanzado.

## 2. El lienzo es el protagonista

- La tarjeta del lienzo ocupa todo el espacio que sobra: header, campo, fila y hoja tienen
  alto fijo; la tarjeta crece (`flex: 1`).
- El contenido **siempre encaja** en la tarjeta: nunca la desborda ni queda más grande que
  ella, y tampoco deja espacio muerto. Cuando cambia el contenido o la pantalla, se vuelve a
  encajar.
- Sobre el lienzo solo flotan dos botones redondos en las esquinas superiores, el aviso
  breve y, si hace falta, una barra de selección abajo. Nada más.

## 3. Una sola gramática, en todas las pantallas

Todas las pantallas se arman con las mismas cinco piezas, siempre en el mismo orden:

1. el header;
2. el campo de texto (opcional);
3. la tarjeta del lienzo;
4. la fila de herramientas;
5. la hoja inferior.

Lo que cambia entre modos es el contenido de la fila y de la hoja, no la estructura. El
usuario aprende la app una vez.

## 4. Negro = activo, gris claro = disponible

- Lo elegido es negro con ícono o texto blanco: botón, segmento, chip o tarjeta con borde
  interior negro de 2 px.
- Lo que se puede tocar es gris claro (`#F4F4F4`) o blanco sobre gris.
- Lo desactivado baja a 30 % de opacidad: no desaparece, para que el lugar no salte.
- El color de acento (rojo `#EA5144`) se reserva para el cursor, la selección sobre el
  lienzo y el anillo de "cargando". **Nunca** se usa en botones.

## 5. Lo físico se enseña con la interacción, no con texto

- Los gestos imitan la acción real: mantener apretado carga o levanta, arrastrar deja un
  rastro, soltar asienta.
- Cada acción tiene una respuesta visible inmediata: algo se mueve, se oscurece o vuela a su
  lugar.
- Los textos educativos son cortos (≤ 280 caracteres), aparecen **una sola vez** (aviso de
  primera vez) y siempre quedan accesibles desde el "?".

## 6. Todo se puede deshacer

- Cada modo tiene su propio historial. Deshacer y rehacer viven siempre en el header.
- Un arrastre de deslizador, un gesto o una ráfaga de tipeo cuentan como un solo paso
  (`history.ts`).
- Las acciones "destructivas" (limpiar, reemplazar todo) también son un paso que se puede
  deshacer. Por eso casi no hace falta pedir confirmación: solo se pide cuando no hay vuelta
  atrás, como cambiar un formato que borra lo hecho.

## 7. No se rediseña lo que funciona

- Ante un pedido nuevo, primero se resuelve reutilizando una pieza del kit. Recién si no
  alcanza se crea una nueva, con los mismos tokens.
- Se cambian los tokens, no las pantallas: un color o una medida se tocan en `tokens.css`.
- Cada cambio se comprueba en el teléfono (390 × 844) y en la computadora (1440 × 900), sin
  superposiciones ni scroll de página.

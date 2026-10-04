# 07 · Checklist de cada pantalla

Revisar antes de dar por buena una pantalla o un cambio.

## Estructura
- [ ] Usa la anatomía de siempre: header · (campo) · tarjeta · fila · hoja.
- [ ] La página no scrollea; solo la hoja y las bandejas.
- [ ] La tarjeta es la única pieza elástica, y el contenido encaja sin desbordar ni dejar
      espacio muerto.
- [ ] La fila tiene como mucho 3 elementos, y el engranaje (Avanzado) es el último botón de
      la pastilla de paneles.

## Simple primero
- [ ] Lo primero que se ve en cada panel se entiende sin leer, como lo entendería un chico.
- [ ] Hay como mucho 3–5 decisiones a la vista; lo demás está en "Avanzado".
- [ ] Cada acción tiene una respuesta visible en menos de 100 ms.

## Visual
- [ ] Solo usa tokens (`tokens.css`), sin colores ni radios sueltos.
- [ ] Lo activo es negro; el acento rojo no aparece en ningún botón.
- [ ] Ningún texto baja de 11 px y las etiquetas van en MAYÚSCULAS con tracking.
- [ ] Ningún control se superpone a otro, en ningún ancho.
- [ ] Si un control no aplica, se desactiva (30 %) en vez de desaparecer.

## Interacción
- [ ] Tocar, mantener y arrastrar hacen cosas distintas y coherentes con `05-interaccion.md`.
- [ ] Mantener apretado y arrastrar funciona **con el dedo** (sin menú contextual,
      selección ni lupa que corten el gesto).
- [ ] Todo se puede deshacer, y un gesto es un solo paso.
- [ ] "Sugerir" da un resultado distinto en cada toque.
- [ ] Elegir una opción global la aplica a todo, en un paso.

## Textos
- [ ] Voseo, frases cortas, sin exclamaciones.
- [ ] Todos los textos salen del archivo de textos (`t('…')`).
- [ ] Cada botón de ícono tiene nombre accesible.

## Comprobación
- [ ] Teléfono **390 × 844** (y 375 × 812, 360 × 740): capturas, sin superposiciones.
- [ ] Computadora **1440 × 900**: dos columnas y el lienzo llenando su columna.
- [ ] Sin errores en la consola.
- [ ] Con `prefers-reduced-motion` no hay animaciones largas.
- [ ] Si se entrega como un único HTML: funciona con doble clic (`file://`) y sin conexión.

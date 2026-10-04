# Planning: TALLER DE GRABADO — estudio web de impresión y grabado

## 0. Contexto

**Qué se busca.** Una app web, local y sin backend, para cargar o pegar imágenes, componerlas y transformarlas en piezas que
parezcan impresas de verdad: xilografía, buril, aguafuerte, letterpress, litografía, serigrafía, risografía y trama. Tiene que
servir para dos cosas: mockups físicos (con papel, desgaste y relieve) y producción limpia (PNG transparente, separaciones).

**Punto de partida.**
- La carpeta del proyecto (`APPS/IMPRESIONGRABADO`) está vacía.
- El design kit de ARMA TU MATRIZ (`APPS/TYPE/design-kit`) es la fuente de verdad de UX y UI: tokens, `base.css`,
  `kit.tsx`, `controls.tsx`, `icons.tsx`, `history.ts`, `plantilla-app.tsx`, la configuración de Vite para un único archivo,
  y las fuentes.
- Hay 8 referencias visuales.

**Idea central de la arquitectura.** No hay "filtros". Hay un modelo físico mínimo pero real, en cuatro pasos:
1. **Matriz.** Cada técnica genera dónde la plancha toma tinta y cuánta. Es un campo implícito en milímetros, no en píxeles.
2. **Impresión.** Un modelo compartido decide cuánta tinta llega al papel, según presión, cantidad de tinta, relieve del papel
   y absorción.
3. **Tintas.** Se combinan de forma sustractiva: la sobreimpresión sale sola, sin modos de fusión.
4. **Soporte.** El papel tiene color, relieve y luz.

Todo se evalúa en coordenadas físicas del documento. Por eso el preview y el export son el mismo cálculo a distinta
resolución, y una trama de 5000 px se calcula a 5000 px aunque la foto original sea chica.

---

## 1. Análisis del design kit: qué se hereda y qué se agrega

**Se hereda tal cual:**
- los 7 principios (`01-principios.md`): lo esencial primero, el lienzo protagonista, una sola gramática, negro = activo,
  enseñar con la interacción y todo deshacible;
- la anatomía header · tarjeta · fila · hoja y las dos columnas desde 900 px;
- los tokens, los componentes y las reglas de puntero, `touch-action`, deshacer por gesto, persistencia con prefijo y
  saneado por lista blanca;
- la voz con voseo, los textos en un archivo con claves y el checklist de cada pantalla.

**Cómo se traduce a esta app:**

| Pieza del kit | En IMPRENTA |
|---|---|
| Header: marca · pastilla de modos · ↶↷ · descargar · compartir | Modos: **01 COMPONER** (`IconFrame`) y **02 IMPRIMIR** (`IconRoller`). Descargar abre la hoja de **Exportar**. Compartir usa `navigator.share` con el PNG. |
| Campo de texto | No se usa en el MVP. En el futuro, si se agrega una capa de texto, aparece solo en COMPONER. |
| Tarjeta del lienzo | El resultado impreso, encajado. Botón redondo izquierdo: **Comparar** (mantener apretado = original). Derecho: **?** (guía). Aviso breve arriba y barra flotante de selección abajo, en COMPONER. |
| Fila de herramientas (pastilla ≤4 + selector + botón suelto) | **IMPRIMIR:** `[Efecto · Tintas · Material · ⚙]` + selector de **Técnica** + botón suelto **Variante** (dado). **COMPONER:** `[Mover · Recortar · Capas · ⚙]` + selector de **Capa activa** + botón suelto **Agregar imagen**. |
| Selector desplegable (cuadro negro con muestra + nombre + subtítulo) | Selector de técnica. El cuadro muestra una miniatura de la técnica aplicada a la imagen del usuario, el nombre ("Xilografía") y la familia ("RELIEVE"). Al abrir, la hoja muestra las técnicas por familia en `pick-tray` con miniaturas en vivo. |
| Hoja con "Avanzado" plegado | Cada panel muestra 3–5 controles esenciales del preset; lo propio del motor va en Avanzado. |
| `pick-grid` 11:15 (texturas) | Biblioteca de papeles. Es el mismo patrón que la captura 04 del kit. |
| Muestras de color con "propio" al final | Biblioteca de tintas spot más el color propio. |
| Chip "Aleatorio" | Variación por parámetro donde tenga sentido (por ejemplo, el registro). |
| Dado "Sugerir" | **Variante:** cada toque elige otra variante de estilo de la técnica, sortea valores dentro de rangos y cambia la semilla. Respeta lo fijado a mano. Es un solo paso de deshacer. |
| Coach mark | Una vez por técnica, en ≤280 caracteres: "¿Qué es una xilografía?". |
| Anillo de carga (acento) | Cálculo de campos pesados (líneas de buril) y progreso del export. |
| Acento rojo `#EA5144` | Solo selección y tiradores sobre el lienzo, y el anillo de carga. Nunca en botones. |

**Íconos nuevos**, con trazo de 1,5, puntas redondas y caja cuadrada: Comparar (◐), Capas, Agregar (+), Ojo / Ojo tachado,
Duplicar, Recortar, Subir / Bajar, Candado, Gubia (Efecto) y Papel con mancha (Material). `Drop` y `Palette` ya existen.

**Tipografía.** El README del kit avisa que la licencia de Alte Haas Grotesk se autorizó solo para ARMA TU MATRIZ.
**Hay que confirmarla.** Si no se puede usar, la reemplaza Archivo (OFL) sin tocar el resto de los tokens.

---

## 2. Análisis de las referencias

| # | Técnica probable | Trama / línea | Tinta | Papel | Registro | Degradación / bordes | Lógica que se extrae |
|---|---|---|---|---|---|---|---|
| 1 Collage (mujer, avión, hexágonos) | Risografía de 2 tintas (rojo coral + azul medio) | Fotos en grano o trama gruesa; plenos en las formas | Semitransparente: donde se cruzan rojo y azul sale un violeta oscuro | Sin estucar, blanco roto, con manchitas grises | Leve corrimiento | Plenos desparejos (falta de tinta en el centro de las masas), velo gris, bordes blandos | **Cada capa se asigna a una tinta (tambor).** No es una separación automática. |
| 2 LETTERPRESSIONISM | Tipos de madera + tacos de madera, en relieve | Sin trama; la veta y los poros de la madera son la textura | Rojo cálido sobre negro y gris (negro subentintado) | Crema | Dos pasadas | Veta en las letras, picaduras, faltantes de tinta en los poros, bordes astillados | **La textura de la tinta sale de la superficie de la matriz** (relieve de la madera), no del papel. |
| 3 Cabeza de estatua | Grabado de reproducción del siglo XIX (madera de pie o acero) | Líneas que siguen la forma, entrecruzado en las sombras y ancho que varía con el tono, con puntas afinadas | Negro | Gris claro, liso | — | Limpio y nítido | **Campo de dirección + líneas espaciadas** cuyo ancho codifica el tono. |
| 4 Durero, *El caballero, la muerte y el diablo* (1513) | Grabado a buril sobre cobre | Hatching muy denso, cross-hatching, curvas de volumen, punto y rombo | Negro | Verjurado antiguo | — | Líneas que engrosan y afinan, negros por densidad | Igual que la 3, más capas de entrecruzado y un trazo de buril de punta en rombo. |
| 5 Warhol, *Marilyn* (1967) | Serigrafía | Plenos planos en color y una tinta "clave" negra, fotográfica y de alto contraste | Opacas, 6 o más | No se ve | **Corrimiento deliberado** entre las formas de color y la clave | Bordes duros y apenas empastados | **Estenciles por tinta:** planos posterizados + clave fotográfica, con orden de pasadas y opacidad. |
| 6 Póster April Greiman | Risografía (o su estética) con rosa, amarillo y azul flúor + negro | **Grano FM** muy visible y algo de trama AM | Transparentes: las mezclas ópticas crean colores nuevos | Sin estucar | Sutil | Grano en todos los tonos, tipografía monoespaciada nítida | Trama estocástica por tinta y **una imagen distinta por tinta**. |
| 7 Póster CCA *The Other Architect* | Offset spot de 2–3 tintas (magenta + cian + amarillo verdoso) | Fotos continuas por tinta y un círculo de **trama gruesa** como recurso gráfico | Transparentes | Liso, sin textura | Exacto | **Limpio**, sin imperfecciones | Duotono con **fotos distintas por tinta**. La trama a escala visible es un elemento de diseño. Necesita un modo limpio. |
| 8 Póster ZKM *imatronic* | Offset (o serigrafía) spot multitinta | Fotos monocromas, cada una en una tinta | Transparentes, en multiplicación | Liso | Exacto | Limpio | Asignación capa → tinta y sobreimpresión sustractiva. |

**Patrones comunes:**
1. **La tinta spot domina** (6 de 8). Cada imagen se vuelve un mapa tonal monocromo impreso con una tinta, y las tintas se
   suman de forma sustractiva. Por eso la composición tiene que permitir **asignar capas a tintas**. Es la decisión de
   arquitectura más importante que sale de las referencias.
2. **Las líneas que siguen la forma** (2 de 8) piden un motor de líneas real. Detectar bordes no alcanza.
3. **El papel suele ser blanco roto o crema, sin estucar.** Las imperfecciones son sutiles y salen del proceso: plenos
   desparejos, grano, registro. Nunca son "grunge".
4. **Los resultados limpios importan igual que los sucios** (7 y 8). Las capas de efecto tienen que poder apagarse por
   separado.
5. **La trama a escala visible es un recurso gráfico** (1, 6 y 7). Hace falta control físico de la escala.
6. Hay tipografía en casi todas. Llega como imagen pegada en el MVP; una capa de texto queda para después.

---

## A. Research técnico por técnica

> Las fechas y los datos históricos quedan como **borrador** en el archivo de textos, como pide la regla del kit, hasta que
> se revisen. Para la arquitectura importa la física; las fechas son contexto.

### RELIEVE (se entinta la superficie elevada y lo tallado queda blanco)

**Xilografía (woodcut).**
- **Origen:** China, siglos VII–VIII (Sutra del Diamante, 868). En Europa desde ~1400 (naipes, estampas devotas); Durero
  (*Apocalipsis*, 1498); ukiyo-e japonés (siglos XVII–XIX, color con varios tacos, registro *kentō*, baren); expresionismo
  alemán.
- **Matriz y proceso:** tabla de madera al hilo (cerezo, peral, tilo) tallada con cuchillo y gubias. La tinta se aplica con
  rodillo (o pincel en Japón) y pasa al papel con prensa o frotando con baren o cuchara.
- **Rasgos visuales:** masas negras fuertes; cortes blancos con forma de gubia (V afilada o U redondeada, con entrada y salida
  afinadas); **veta** visible en los plenos; poco detalle fino; bordes astillados **a favor de la veta**.
- **Imperfecciones:** veta que no toma tinta, presión despareja (marcas de baren), plenos moteados y astillas.
- **Parámetros digitales:** tamaño mínimo de detalle (ancho de gubia), umbral y niveles, dirección y densidad de los cortes,
  dirección e intensidad de la veta, presión, tinta, aspereza de borde anisótropa y modo de impresión (prensa o baren).

**Grabado en madera de pie (wood engraving).**
- **Origen:** Thomas Bewick (fines del siglo XVIII); dominó la ilustración del siglo XIX (Doré, a través de grabadores).
- **Proceso:** taco de boj **a contrafibra** (sin veta) grabado con buriles. Es la técnica de **línea blanca**: el tono se
  arma con líneas blancas paralelas cuyo ancho crece en las luces. Se imprime en relieve, junto con los tipos.
- **Rasgos:** muy fino, líneas blancas regulares, sin veta, gris por densidad de líneas.
- **Parámetros:** como el buril, pero en polaridad inversa (líneas = sin tinta) y con impresión en relieve.

**Linograbado.**
- **Origen:** linóleo, década de 1860; uso artístico desde inicios del siglo XX y grabado a la reducción (Picasso, años 50).
- **Rasgos:** material **isótropo** (sin veta), curvas suaves, bordes más limpios, plenos con un moteado fino del linóleo y
  poca astilla.
- **Parámetros:** los de la xilografía, sin veta y con suavidad de corte.

**Tipos móviles.**
- **Origen:** Bi Sheng, tipos de cerámica (~1040, China Song); en Corea, tipos metálicos (*Jikji*, 1377); Gutenberg
  (~1440–1455, Maguncia: molde manual, aleación plomo-estaño-antimonio, tinta al aceite, prensa de tornillo). Los tipos de
  madera para afiches son del siglo XIX (Wells, 1828; pantógrafo de Leavenworth, 1834).
- **Física:** cada carácter es una pieza independiente. Hay variación de altura y desgaste **por pieza**, línea de base
  irregular, entintado desigual por pieza e impresión **"kiss"** (en el oficio, marcar el papel se consideraba un defecto).
- **Rasgos:** bordes levemente engrosados, **squash** (anillo de tinta más oscuro en el borde y centro más claro), caracteres
  rotos o gastados, variación entre letras iguales, y veta en los tipos de madera (ref. 2).

**Letterpress (contemporáneo).** Comparte motor con tipos móviles, pero es otro preset:
- planchas de fotopolímero, nítidas y uniformes;
- **impresión profunda (deboss)** en papel de algodón grueso;
- poca variación entre caracteres y sombreado del hundido.

### HUECOGRABADO / CALCOGRAFÍA (la tinta queda en los surcos, se limpia la superficie y el papel húmedo saca la tinta de los surcos con mucha presión)

**Rasgos comunes de la familia:**
- tinta **en relieve** sobre el papel;
- **huella de plancha** (el rectángulo hundido con bisel);
- **tono de plancha** (la película que queda al limpiar, con marcas de tarlatana o de mano);
- surcos más profundos que dan líneas más oscuras y anchas.

**Buril (engraving).**
- **Origen:** orfebrería, mediados del siglo XV (Maestro E.S., Schongauer); Durero; grabado de reproducción; billetes.
- **Proceso:** el buril empuja un surco en V en el cobre; la profundidad define el ancho.
- **Rasgos:** líneas precisas que **engrosan y afinan**, terminaciones en punta, cross-hatching a ángulos regulares, punto y
  rombo en las transiciones, y espaciado **constante** (el tono va por ancho y por capas).
- **Parámetros:** espaciado (líneas/mm), ancho máximo, capas de cruce y sus ángulos, dirección (forma, fija o mixta),
  afinado de puntas y punteado.

**Aguafuerte (etching).**
- **Origen:** ~1500 (Hopfer, sobre hierro); Rembrandt; Goya.
- **Proceso:** se cubre la plancha con un barniz, la punta lo dibuja y el ácido muerde. Los tiempos de mordida dan la
  profundidad (*stopping out*).
- **Rasgos:** ancho **casi constante** con puntas romas; trazo **libre y dibujístico** (leve temblor); tono por densidad y
  por mordidas; más tono de plancha.
- **Imperfecciones:** *foul biting* (picaduras sueltas del ácido).
- **Parámetros:** el espaciado varía con el tono, cantidad de mordidas (2–4 niveles de ancho y oscuridad), temblor de mano
  y foul bite.

**Punta seca (drypoint).**
- **Origen:** Maestro del Libro de Horas (~1480); Rembrandt.
- **Proceso:** la punta raya el metal y levanta una **rebaba** que retiene tinta.
- **Rasgos:** línea **aterciopelada**, con un halo difuso asimétrico de un lado e irregular. La rebaba se gasta en pocas
  copias (parámetro **"número de copia"**).
- **Parámetros:** rebaba (cantidad y lado), desgaste y temblor.

**Aguatinta.**
- **Origen:** difundida por Le Prince (~1768); Goya, *Los Caprichos* (1799).
- **Proceso:** se funde polvo de resina sobre la plancha y el ácido muerde alrededor de cada grano.
- **Rasgos:** **grano reticulado** (una red de puntos blancos en el negro) y **tonos escalonados** con bordes netos (una
  mordida por nivel).
- **Parámetros:** tamaño y densidad del grano, cantidad de niveles y suavidad entre niveles.

**Mezzotinta.** Von Siegen, 1642. El *rocker* graba toda la plancha, que imprime un negro aterciopelado, y se trabaja **de
oscuro a claro** raspando y bruñendo. Da negros profundísimos, gradaciones muy suaves y un grano fino multidireccional, sin
líneas. **Es lo bastante distinta como para tener preset propio, pero va después del MVP:** es una variante del motor de
grano con impresión de huecograbado.

### PLANOGRAFÍA

**Litografía en piedra.**
- **Origen:** Senefelder (1796–98, Baviera; piedra de Solnhofen). Cromolitografía y afiches del siglo XIX (Chéret,
  Toulouse-Lautrec, Mucha). El offset (Rubel, 1904) es la litografía indirecta.
- **Física:**
  - se dibuja con lápiz o crayón graso, o con **tusche** líquido, sobre piedra **granada**;
  - se fija con goma arábiga y ácido;
  - se moja: el agua repele la tinta grasa, que solo se adhiere a la grasa;
  - se imprime con prensa de rasero y sin relieve.
- **Rasgos:**
  - el **grano de la piedra**: el lápiz toca solo las crestas, así que el tono es la densidad de puntitos irregulares;
  - tonos muy ricos y continuos; trazo cercano al dibujo;
  - **reticulado de tusche** en las aguadas;
  - **crachis** (salpicado con cepillo, típico de los afiches de Lautrec);
  - sin huella ni deboss.
- **Imperfecciones:** *scumming* (velo de tinta en zonas sin imagen), tono que se cierra y borde de la piedra.
- **Parámetros:** grano de piedra (tamaño y filo), grano del lápiz (presión), suavidad de línea, densidad de tinta, ruptura
  tonal, aguada / tusche y crachis.

### ESTÉNCIL

**Serigrafía.**
- **Origen:** precedentes en el estarcido japonés (*katazome*). Patente de Samuel Simon (1907); emulsiones fotográficas;
  serigrafía artística desde los años 30 (WPA); pop de los 60 (ref. 5).
- **Física:**
  - una malla tensada (seda y luego poliéster, 43–200 hilos/cm) con un estencil;
  - el **rasero** empuja la tinta por las zonas abiertas;
  - **una pantalla por color, una pasada por color**;
  - la película de tinta es gruesa y puede ser **opaca**.
- **Rasgos:** color plano y saturado; bordes nítidos con **dientes de sierra de la malla** (un artefacto real, a la
  frecuencia de la malla); y moiré entre la trama y la malla (también real).
- **Imperfecciones:**
  - corrimiento de registro por pasada (traslación y un poco de rotación);
  - *trapping* (solapes y luces blancas entre colores);
  - poros sin tinta (*pinholes*);
  - estrías en la dirección del rasero;
  - tinta corrida (bleed) con mucha presión o tinta fluida;
  - imágenes fantasma.
- **Parámetros:** tintas y orden de pasadas, opacidad, cobertura, textura de malla, bleed, aspereza de borde, registro,
  trapping y sobreimpresión.

**Risografía.**
- **Origen:** Riso Kagaku (Japón, 1946); Print Gocco (1977); primer duplicador digital RISOGRAPH (1986). El antecedente es el
  mimeógrafo o duplicador de estencil.
- **Física:**
  - un cabezal térmico **perfora un master** (una película sobre fibra) a ~300–600 dpi;
  - el master envuelve un **tambor de tinta**, y la tinta (a base de soja o salvado de arroz) atraviesa los agujeros por
    presión;
  - **un tambor = una tinta = una pasada**;
  - la tinta es **semitransparente, se absorbe y tarda en secar**.
- **Rasgos:**
  - la trama se construye **sobre la grilla del master** (puntos AM hechos de celdas a 600 dpi, o grano FM);
  - puntos con borde blando por la absorción;
  - plenos **que no llegan al 100%** y moteados;
  - **falta de tinta** en masas grandes, bandas del tambor y marcas de rodillo;
  - registro impreciso (±0,5–2 mm, sobre todo vertical);
  - ghosting y manchas por roce;
  - la mezcla óptica entre tintas es el gran recurso.
- **Parámetros:** tintas spot (biblioteca), modo de trama (grano o AM) y su lpi, dpi del master, densidad máxima, absorción,
  registro por tambor, falta de tinta, bandas y ghosting.

### FOTOMECÁNICO

**Trama (halftone).**
- **Origen:** Talbot (1852, el concepto); Horgan en el *Daily Graphic* (1880); tramas de líneas cruzadas de Ives y de los
  Levy (1880–90); tramas de contacto; screening digital AM y FM (FM desde los 90).
- **Física:** el tono continuo se convierte en puntos de tamaño variable (AM) o en densidad variable de puntos iguales (FM).
- **Lineaturas:**
  - diario: 65–100 lpi sobre papel prensa;
  - revista: 133–175 lpi.
- **Ganancia de punto:** el punto crece por perímetro, así que los medios tonos ganan más.
- **Ángulos CMYK:** C 15°, M 75°, Y 0°, K 45°, que evitan el moiré y forman la **roseta**.
- **Imperfecciones:**
  - *hickeys*: polvo en la plancha que deja una mancha con un aro blanco;
  - repinte;
  - ganancia excesiva en el papel prensa;
  - transparencia del dorso.

**Ben-Day.** Benjamin Day Jr. (1879), tintes mecánicos de puntos **uniformes** para cómics. Históricamente corresponde. Se
diferencia del halftone porque el tamaño del punto es fijo por zona y no depende del tono.

**Otros presets de la familia:**
- **Reproducción de alto contraste:** película lith (Kodalith) con contraste extremo, sombras empastadas y efecto de borde.
- **Serigrafía fotográfica:** fotolito tramado sobre emulsión, es decir, trama + impresión de serigrafía.
- **Offset:** CMYK o spot, tramado y limpio (refs. 7 y 8).

---

## B. Mapa de técnicas

| Familia de proceso | Técnicas | Motor | Modelo de impresión |
|---|---|---|---|
| **Relieve** | Xilografía, linograbado, madera de pie, tipos móviles, letterpress, tipos de madera | `relief` (+ `line` para cortes y madera de pie) | relieve |
| **Huecograbado** | Buril, aguafuerte, punta seca, aguatinta, mezzotinta | `line` (líneas), `grain` (aguatinta, mezzotinta) | huecograbado |
| **Planografía** | Litografía en piedra, crachis, (offset) | `grain` (litografía), `screen` (offset) | planográfico |
| **Estencil** | Serigrafía, serigrafía pop, multicolor, con corrimiento, risografía, estencil digital | `stencil` (+ `screen`) | estencil / riso |
| **Fotomecánico** | Trama de diario, editorial, fotomecánica, Ben-Day, alto contraste, serigrafía fotográfica, offset | `screen` (+ `stencil`) | planográfico / estencil |
| **Digital / híbrido** | Dither de 1 bit, trama estocástica, sobreimpresión experimental | `screen` | según el preset |

La **familia de navegación** de la interfaz (Clásicas · Editorial · Pop/Estencil · Contemporáneas) es otro campo del preset,
distinto de la familia de proceso.

---

## C. Arquitectura de motores

### C.1 Representación común: la matriz como campo implícito en milímetros

Cada motor entrega, **por tinta**, dos campos evaluables en cualquier punto del documento (en mm):
- **`φ(x)`, el campo de borde:** es aproximadamente la distancia con signo al borde de la zona entintada (negativa adentro).
  - Cobertura antialiasada a cualquier resolución: `cov = clamp(0.5 − φ/px, 0, 1)`.
  - **Ganancia de punto / ink spread** físico, en mm: `φ − δ`. El punto crece por perímetro, así que la ganancia en medios
    tonos sale sola.
  - **Desgaste** (`φ + erosión`), **aspereza** (`φ + ruido·r`) y **squash** (halo donde `|φ|` es chico) son operaciones
    triviales.
  - **Contornos para SVG:** iso-línea `φ = 0`.
- **`h(x)`, la carga de la matriz:** cuánta tinta sostiene cada punto. En relieve es la superficie (veta, poros); en
  huecograbado, la profundidad del surco; en estencil, la apertura de malla o del master.

Cómo se construye `φ` en cada caso:
- **Trama:** `(spot(x) − tono) · tamaño de celda / |∇spot|`.
- **Umbral sobre un campo de tono:** `(t₀ − T)/|∇T|`.
- **Trazos:** distancia a la línea central menos medio ancho.

Es una sola abstracción para todos los motores y es lo que hace posible la independencia de resolución.

### C.2 Los 5 motores de técnica

| Motor | Qué hace | Qué alimenta | Dónde corre |
|---|---|---|---|
| **`screen`** | Tramas AM analíticas con *spot functions* (redonda, elipse, cuadrada, línea, cruz, rombo, círculos concéntricos, onda, patrón propio = imagen como celda), FM estocástica (umbral con tile de blue noise void-and-cluster precalculado), dither de difusión de error (en CPU, a la resolución del dispositivo), ángulos y lpi por tinta, fase y moiré deliberado | Trama de diario, editorial y fotomecánica; Ben-Day; offset; las tramas de riso y serigrafía | GPU, por píxel |
| **`stencil`** | **Separación** (capas asignadas a tintas, separación automática a N tintas spot con LUT, posterizado en regiones con k-means en Lab + simplificación, clave fotográfica con umbral y grano) y **estencil por tinta** (pleno, umbral, trama con `screen`, grano) | Serigrafías, risografías y estencil digital | CPU en worker (LUT, k-means) + GPU |
| **`relief`** | Matriz de relieve: simplificación con preservación de bordes, tamaño mínimo de detalle por morfología, umbral o niveles, **superficie** (veta procedural o asset, moteado del linóleo, superficie de tipo), astillado anisótropo a favor de la veta y **variación por pieza** (componentes conexas → semilla por carácter) | Xilografía, linograbado, letterpress, tipos móviles y tipos de madera | CPU en worker (componentes, distancias) + GPU |
| **`line`** | **Campo de dirección** (Edge Tangent Flow de Kang et al. 2007 sobre el tono suavizado, mezclado con un ángulo fijo donde el gradiente es débil) + **líneas de flujo equiespaciadas** (Jobard–Lefer) por capa de entrecruzado, con espaciado y ancho según el tono. Polilíneas en mm con ancho por vértice. Puntas en rombo, redondas o con rebaba. Polaridad negra (huecograbado) o blanca (madera de pie, cortes de gubia) | Buril, aguafuerte, punta seca, madera de pie y cortes de xilografía | Las líneas se calculan en un worker y se rasterizan como tiras de triángulos en la GPU a cualquier resolución |
| **`grain`** | Pantallas de grano estocástico con carácter físico: diente de piedra litográfica (Worley afilado + ruido multiescala, o scan real); lápiz = umbral del grano según tono y presión, con dirección de trazo; reticulado de tusche (ruido deformado y umbralado); crachis (salpicado Poisson); resina de aguatinta (red invertida + niveles escalonados); rocker de mezzotinta | Litografía, aguatinta y mezzotinta | GPU (tiles de grano generados una vez, con semilla) |

**Por qué 5 motores y no 7.** La física de la matriz se comparte entre técnicas:
- la xilografía usa `relief` para las masas y `line` en polaridad blanca para los cortes;
- la risografía y la serigrafía usan `stencil` + `screen`, pero con otro modelo de impresión;
- el buril, el aguafuerte y la punta seca son `line` con distinto trazo, espaciado e impresión.

### C.3 Física compartida (no son motores; son etapas)

1. **Registro.** Por tinta: transformación afín (dx, dy en mm, rotación) + una ondulación de baja frecuencia (estiramiento
   del papel). Se aplica **a las coordenadas** con que se lee la matriz: no mueve píxeles.
2. **Impresión.** Matriz + tinta + presión + papel dan la densidad depositada `D_i(x)`. Hay un modelo por familia:
   - **Relieve:**
     - el contacto depende de la altura del papel frente a la presión (con poca presión, la tinta solo toca las crestas de las
       fibras);
     - la película de tinta = tinta × superficie de la matriz × agotamiento (en masas grandes, la tinta se agota según la
       cobertura promedio de los alrededores);
     - **squash**: halo con `|φ|` chico;
     - sobreentintado: `φ − δ` y contraformas que se cierran;
     - subentintado: moteado;
     - **deboss**: altura del papel = −desenfoque(matriz) × presión.
   - **Huecograbado:** la tinta sale de la profundidad del surco; tono de plancha (película de baja frecuencia + rayas en la
     dirección de limpieza); la tinta queda en relieve (sombreado positivo); **huella de plancha** (rectángulo hundido con
     bisel); papel húmedo con contacto alto.
   - **Planográfico:** contacto uniforme, borde levemente blando, *scumming* y sin relieve.
   - **Estencil:**
     - serigrafía: película gruesa y opaca, dientes de malla en los bordes, estrías del rasero, poros y bleed por presión;
     - risografía: grilla del master, densidad máxima < 1, absorción (punto blando), bandas del tambor, agotamiento en masas
       y ghosting.
3. **Imperfecciones** (§G.3). Modulan la matriz o la densidad, según el origen físico de cada una.
4. **Tintas** (§H). Composición sustractiva de Beer–Lambert más un componente opaco.
5. **Soporte.** Color del papel (con moteado), altura (fibras + deboss + relieve de la tinta), luz rasante sutil y bordes del
   pliego (barbas, roturas).

---

## D. Pipeline de render

### D.1 Grafo no destructivo

```
FUENTES (blobs originales inmutables, por hash)
  └─ CAPAS: transformación · recorte · opacidad · fusión · máscara · tinta destino
       └─ PLANCHAS: composición por tinta destino ("auto" → separación)
            └─ PREPARACIÓN DEL TONO: canal/luminancia, niveles/curva, contraste, detalle, simplificación, invertir
                 └─ CAMPOS (resolución de análisis, en caché): tono suavizado, dirección, componentes, distancias,
                    líneas de flujo, LUT de separación, k-means
                      └─ MATRIZ por tinta: φ_i, h_i (procedural, por píxel de salida)
                           └─ REGISTRO (coordenadas) → IMPRESIÓN → D_i
                                └─ IMPERFECCIONES (modulan φ / D / papel)
                                     └─ TINTAS (sustractivo) → SOPORTE (papel, luz) → SALIDA (preview | tile de export)
```

- Cada nodo tiene una **clave = hash(parámetros propios + claves de entrada)**. Cada `ParamDef` declara su **etapa**, así que
  mover un control solo invalida lo que está después.
- Por ejemplo, la intensidad del papel solo rehace la composición final (60 fps), y el espaciado de líneas rehace las líneas
  de flujo (100–500 ms en un worker, con el resultado anterior visible y el anillo de carga).
- La fuente nunca se modifica y todo se recalcula desde ella.

**Interruptores del modo limpio** (§19 del pedido):

| Interruptor | Apagado = |
|---|---|
| Técnica | La plancha pasa como tinta de tono continuo (sin matriz). |
| Textura de tinta | Impresión ideal: `D = cov(φ)`, sin moteado, contacto ni agotamiento. |
| Imperfecciones | Se saltea la etapa. |
| Papel | Albedo blanco, sin altura ni luz; habilita el fondo transparente. |
| Color | Cada marca toma el color de la fuente compuesta en lugar del de la tinta ("colores de la imagen"). |
| Registro | Desplazamientos en cero. |

### D.2 Dos resoluciones que nunca se mezclan

- **Resolución de análisis** (fija por documento: ~2048 px de lado largo, 4096 en "alta"). Ahí viven los **campos de baja
  frecuencia**: dirección, componentes, líneas de flujo (en mm), LUT y k-means.
  - Son **los mismos para el preview y el export**, así que las líneas y las regiones no "saltan" al exportar.
- **Resolución de detalle** (la del preview o la del export). Ahí se evalúa **en cada punto**:
  - la lectura de la fuente con **bicúbico** (Catmull-Rom de 9 lecturas en el shader);
  - la preparación puntual (curvas, contraste) + la corrección de baja frecuencia que viene del análisis (transferencia de
    detalle);
  - la composición de capas, φ, la impresión, las tintas y el papel.

**Por qué una fuente chica no se pixela:**
- el tono se reconstruye de forma suave (bicúbico) y las marcas se generan proceduralmente en mm a la resolución de salida;
- el umbral sobre un campo interpolado da contornos curvos, no escaleras;
- no se inventa información: los detalles que no estaban en la fuente no aparecen; lo que se gana es que **las marcas de la
  técnica** son nítidas.

La superresolución con IA (Real-ESRGAN o Swin2SR con ONNX Runtime Web / WebGPU, cargada a pedido) queda como función futura
opcional.

### D.3 Preview y export comparten un único camino

`renderRegion(project, regiónEnMm, pxPorMm, destino)` sirve para todo:
- el **preview** es una región (el viewport) a la resolución de la pantalla (DPR ≤ 2, con tope de MP);
- el **export** son N tiles de 2048² con un **margen de solape** igual al radio máximo de vecindad (bleed, squash, deboss: en
  mm × dpi, típicamente 32–128 px).

**LOD del preview.** Cuando la celda de la trama o el espaciado de líneas mide menos de ~3 px en pantalla, el shader
**integra la cobertura** (filtro de caja analítico) y muestra el tono más una sugerencia de textura, para no fabricar un
moiré falso con la grilla de la pantalla.
- Aparece el aviso **"ACERCATE PARA VER LA TRAMA REAL"**.
- Con doble toque, la vista va al 100 %.

### D.4 Pasadas en la GPU por región o tile

1. Planchas: compone las capas por tinta en el punto (hasta 8 capas por pasada; más, en varias pasadas).
2. Matriz: φ y h por tinta, en RG16F (hasta 4 tintas por pasada con MRT).
3. Impresión + vecindad: desenfoques separables chicos dentro del tile con solape → `D_i` en RGBA16F.
4. Imperfecciones + tintas + soporte + luz → RGBA8 sRGB (o premultiplicado transparente).

---

## E. Arquitectura de presets

### E.1 Modelo de datos (TypeScript, serializable)

```ts
type EngineId = 'screen' | 'stencil' | 'relief' | 'line' | 'grain'
type ImpressionModel = 'relief' | 'intaglio' | 'planographic' | 'screenprint' | 'riso' | 'offset'
type ProcessFamily = 'relief' | 'intaglio' | 'planographic' | 'stencil' | 'photomechanical' | 'digital'
type NavFamily = 'classic' | 'editorial' | 'pop' | 'contemporary'

interface ParamDef {                    // declarative: the UI is generated from this
  id: string; labelKey: string; hintKey?: string
  type: 'number' | 'enum' | 'bool' | 'angle' | 'length' | 'frequency'
  unit?: 'mm' | 'pt' | 'lpi' | 'lpmm' | 'deg' | '%' | 'dpi'
  min?: number; max?: number; step?: number; options?: string[]
  stage: 'prep' | 'fields' | 'matrix' | 'impression' | 'imperfections' | 'ink' | 'paper'  // cache invalidation
  variant?: [number, number]            // range the dice (Variante) may draw from
}

interface PresetDef {
  id: string                            // 'woodcut', 'copperplate-engraving'…
  nameKey: string; originalName: string // "Xilografía" / "Woodcut"
  navFamily: NavFamily; process: ProcessFamily
  kind: 'historical' | 'creative'; variantOf?: string   // creative variations always name their base
  descriptionKey: string; historyKey: string            // educational texts (with review status)
  engine: EngineId; impression: ImpressionModel
  params: Record<string, unknown>                       // engine defaults
  universal: Partial<Universal>                         // starting values of the 8 universal controls
  essentials: string[]                                  // ≤5 visible controls (universal or engine)
  advanced: string[]                                    // the rest that applies (anything else is hidden)
  colorMode: 'mono' | 'duotone' | 'spot' | 'process'
  inks: InkPreset[]; paper: PaperRef; imperfections: ImperfectionPreset
  variants: Array<Partial<…>>                           // styles the dice cycles through
  defaultSeed: number
}
```

Los motores implementan una interfaz común, y el núcleo del render no conoce ninguna técnica:

```ts
interface EngineModule {
  id: EngineId
  params: ParamDef[]
  mapUniversal(u: Universal, p: Params): Params
  fields(p: Params): FieldRequest[]     // which analysis fields it needs
  matrixShader: ShaderChunk             // GLSL returning φ, h per ink
  vectorize?(ctx): SvgWriter            // only where it makes sense
}
```

Un preset nuevo es un archivo de datos y no toca la interfaz.

### E.2 Controles universales (8) y cómo los traduce cada motor

| Universal | screen | stencil | relief | line | grain |
|---|---|---|---|---|---|
| **DETALLE** | Tono por celda ↔ por píxel | Simplificación / niveles | Tamaño mínimo de detalle | Largo mínimo de línea, adaptatividad | Suavizado del tono |
| **ESCALA** (física) | lpi | lpi / tamaño de grano | Ancho de gubia, escala general | Espaciado (líneas/mm) | Tamaño del grano de piedra |
| **TINTA** | Densidad + δ | Película / opacidad | Sub ↔ sobreentintado | Tinta en surcos | Grasa / densidad |
| **PRESIÓN** | Ganancia + contacto | Rasero → bleed | Contacto, squash, deboss | Huella, relieve de la tinta | Contacto, scumming |
| **ASPEREZA** | Borde del punto | Borde / malla | Astillado | Temblor de mano | Ruptura del lápiz |
| **REGISTRO** | Desfase entre tintas | Desfase entre pasadas | Entre tacos | (se desactiva al 30 % en monotinta) | Entre piedras |
| **GRANO** | Ruido de impresión | Malla / tambor | Veta / moteado | Grano del tono de plancha | Contraste del grano |
| **CONTRASTE** | Curva previa | Curva previa | Curva previa | Curva previa | Curva previa |

Los valores se muestran en unidades de impresión con una traducción simple. Por ejemplo, `ESCALA 85 lpi` lleva la ayuda
"Puntos de 0,3 mm. Menos lpi: puntos más grandes."

### E.3 Catálogo

**MVP (13 presets):**

| Familia | Preset (nombre en la UI / original) | Motor + impresión |
|---|---|---|
| Clásicas | Xilografía / Woodcut | relief + line (gubias), impresión de relieve |
| Clásicas | Linograbado / Linocut | relief, relieve |
| Clásicas | Grabado a buril / Copperplate Engraving | line, huecograbado |
| Clásicas | Aguafuerte / Etching | line, huecograbado |
| Clásicas | Tipos móviles / Movable Type | relief (variación por pieza), relieve kiss |
| Clásicas | Letterpress | relief (fotopolímero), relieve profundo |
| Clásicas | Litografía en piedra / Stone Lithography | grain, planográfico |
| Editorial | Trama de diario / Newspaper Halftone | screen, offset sobre papel prensa |
| Editorial | Trama editorial / Editorial Halftone | screen, offset |
| Pop / estencil | Serigrafía / Screenprint | stencil, serigrafía |
| Pop / estencil | Serigrafía pop / Pop Screenprint | stencil (planos + clave + corrimiento), serigrafía |
| Contemporáneas | Risografía / Risograph (2 tintas) | stencil + screen, riso |
| Contemporáneas | Risografía grano / Risograph Grain | stencil + FM, riso |

**Después del MVP:**
- Clásicas: Punta seca, Aguatinta, Mezzotinta, Madera de pie, Tipos de madera.
- Editorial: Trama fotomecánica, Alto contraste (película lith), Offset CMYK, Duotono offset.
- Pop: Ben-Day, Serigrafía multicolor, Serigrafía fotográfica, Serigrafía duotono, Serigrafía con corrimiento.
- Contemporáneas: Risografía zine, Estencil digital (mimeógrafo), Sobreimpresión experimental, Dither 1 bit.

---

## F. Arquitectura de composición

```ts
interface Layer {
  id: string; kind: 'image'                       // 'text' in a later phase
  assetId: string; name: string
  visible: boolean; locked: boolean
  opacity: number; blend: 'normal' | 'multiply' | 'screen' | 'darken' | 'lighten'
  transform: { x: number; y: number; scale: number; rotation: number; flipX: boolean }  // mm, centred
  crop: { l: number; t: number; r: number; b: number }                                  // normalised
  inkTarget: 'auto' | string                      // KEY: 'auto' = enters the separation; inkId = that ink's plate
  tone: { invert: boolean; levels?: [number, number, number] }                           // per-layer prep
  mask?: { type: 'clip-below' | 'asset'; assetId?: string }                             // v1.1
}
```

- **Tinta destino** (lo que piden las refs. 1, 6, 7 y 8): cada tinta tiene su plancha. "Auto" compone en color y separa.
  Esto unifica monotinta, duotono, collage risográfico y separación automática.
- **MVP:** posición, escala, rotación, recorte, opacidad, orden, visibilidad, duplicar, borrar, fusión (5 modos) y tinta
  destino.
- **v1.1:** máscara de recorte a la capa de abajo y máscara desde un asset.
- **Grupos:** no. Las planchas de tinta ya cumplen ese papel de agrupación, y así la app no se vuelve un Photoshop.

**Interacción:**
- Tocar elige una capa (con prueba de alfa).
- Arrastrar mueve la capa elegida.
- Dos dedos **sobre** la capa la escalan y rotan; **fuera** de la capa, hacen zoom y paneo del lienzo.
- En la computadora: tiradores en color acento (esquinas = escala, manija = rotación); Alt + flechas para empujar; Supr,
  Ctrl+D, Ctrl+[ y Ctrl+].
- La selección y los tiradores se dibujan en una **capa DOM/SVG** en el hilo principal, sin latencia.
- La barra flotante del kit muestra `[Duplicar · Recortar · Subir · Bajar · Borrar]`.
- Mientras se arrastra, los motores que van solo por GPU siguen en vivo. El motor `line` muestra sus líneas anteriores y las
  recalcula al soltar.

---

## G. Sistema de texturas

### G.1 Roles técnicos (un asset no es "una imagen encima")

| Rol | Qué modula | Ejemplos |
|---|---|---|
| `paperHeight` | Contacto de la tinta (crestas y valles), luz, bleed por fibra | Fibra de papel, verjurado, washi |
| `paperAlbedo` | Color y moteado de baja frecuencia del papel | Papel antiguo, kraft |
| `matrixSurface` | `h`: la tinta que sostiene la matriz | Veta de madera, linóleo, superficie de tipo |
| `inkMottle` | Densidad de la película en los plenos | Scans de plenos de riso o serigrafía |
| `grain` | Umbral de los motores de grano | Piedra litográfica, resina |
| `matrixDamage` | `φ`: en relieve, un rayón **imprime blanco**; en huecograbado, **imprime negro** porque retiene tinta | Rayones, grietas |
| `dust` | En relieve y offset: puntos blancos y *hickeys* (mancha con aro) | Polvo |
| `paperStain` | Albedo bajo la tinta, con línea de borde (efecto anillo de café); *foxing* | Manchas |
| `paperAlpha` | Recorte del pliego, barbas, roturas | Roturas y bordes (scan a contraluz) |
| `displacement` | Ondulación del registro y del papel (cockling) | Mapas suaves |

### G.2 Ingesta: clasificar antes de usar

Hay una herramienta de desarrollo (`/tools/textures`, en Node) y una versión liviana en el worker para assets que el usuario
suba más adelante. Hace lo siguiente:
1. **Análisis:** histograma, contraste, **escala dominante** (autocorrelación radial), **anisotropía** (tensor de estructura:
   veta o fibra), escasez de manchas (polvo o manchas frente a textura continua), saturación (manchas teñidas), alfa,
   tileabilidad y gradiente de iluminación.
2. **Propuesta de rol** con su justificación, que se revisa a mano.
3. **Normalización:**
   - flat-field (resta de la iluminación de baja frecuencia);
   - conversión a gris lineal;
   - media y varianza estándar, para que los deslizadores se comporten igual con cualquier asset;
   - recorte o volteo a un tile;
   - **escala física declarada** (dpi del scan) para que la fibra mida lo mismo en cualquier export.
4. **Manifiesto** `textures/manifest.json`: id, archivo, roles, dpi, tileable, fuente / licencia y estadísticas.

**Contra la repetición:**
- **hex-tiling** con rotación y desplazamiento aleatorios por hexágono (Mikkelsen 2022);
- mezcla que preserva el histograma (Heitz & Neyret 2018);
- **extensión procedural del detalle** cuando el export supera la resolución del scan.

**Siempre hay una alternativa procedural** para cada rol (fibra anisótropa + flóculos de Worley, veta con anillos deformados,
piedra), así la app funciona y se ve bien antes de tener los assets reales. Los assets reales suben la calidad.

### G.3 Imperfecciones ligadas al proceso

Cada imperfección es una función del estado físico, no un overlay:
- **Falta de tinta:** P(falta) ∝ (poca tinta) × (poca presión) × (valle del papel) × (agotamiento por cobertura en un radio)
  × (mapa de presión del pliego).
- **Presión despareja:** campo de baja frecuencia. En una prensa es un gradiente de lado a lado; a mano, **trazos de baren**
  direccionales.
- **Bleed:** dilatación de φ según fluidez × absorción, con anisotropía en la dirección de la fibra.
- **Desgaste de borde:** erosión de φ, mayor donde la curvatura es alta (las esquinas se gastan primero).
- **Plancha dañada:** grietas a favor de la veta (madera), piezas rotas (tipos), rayones según la polaridad del proceso.
- **Específicas de cada preset:** bandas de tambor y ghosting (riso); malla, poros y estrías (serigrafía); tono de plancha y
  foul bite (huecograbado); scumming y crachis (litografía); *hickeys* y repinte (trama).
- **Sobre el papel:** manchas, foxing, polvo, rayones y roturas.

Cada preset trae su propio set de imperfecciones. Se encienden y apagan en conjunto con un interruptor, y cada una tiene su
chip.

### G.4 Assets que te voy a pedir (al empezar la Fase 6)

- **Papeles (4–8):** algodón blanco, crema verjurado, papel prensa, kraft, washi (kozo), offset sin estucar de 90 g (papel de
  riso) y uno de color.
- **Tinta:** plenos y tintes del 50 % de riso, serigrafía y relieve reales; marcas de rodillo.
- **Matriz:** madera al hilo (y, si podés, una impresión de un pleno de taco); piedra o lápiz litográfico sobre superficie
  granada.
- **Daño:** manchas, foxing, polvo, rayones, roturas (a contraluz para sacar el alfa), pliegues y bordes.
- **Formato:** scanner plano a **600–1200 dpi**, PNG o TIFF **sin compresión con pérdida**, 16 bits si se puede, sin mejora
  automática, ≥10 × 10 cm, con el dpi anotado. Si se puede, además una foto con luz rasante del mismo papel, para sacar la
  altura.

---

## H. Arquitectura de color

- **Espacio de trabajo:** sRGB lineal en float; se convierte a sRGB solo al mostrar o codificar. Display-P3
  (`drawingBufferColorSpace`) queda para después; ayuda con los flúor.
- **Modelo de tinta (sobreimpresión real):**
  - por tinta, la transmitancia es `T_i` = color lineal y la absorbancia es `A_i = −ln T_i`;
  - resultado = `papel × Π exp(−A_i · D_i)` (Beer–Lambert): dos pasadas oscurecen de forma no lineal, como en la realidad;
  - **opacidad** por tinta (serigrafía opaca, blanco sobre papel de color): `mix(transparente, color_i, o_i · cov_i)` en
    **orden de pasada**;
  - con papel de color, todo funciona igual (la tinta transparente tiñe el papel).
- **Tinta:** `{ id, nombre, color, opacidad, densidad, visible, orden, registro{dx,dy,rot}, trama{tipo,lpi,ángulo,forma}, textura }`.
- **Modos:** Monotinta, Duotono (curva por tinta, como el duotono clásico) y Multitinta spot. Un segmentado
  `1 TINTA | 2 TINTAS | VARIAS` en el panel Tintas.
- **Separación automática a N tintas:** una **LUT 3D de 33³** que se resuelve en un worker. Para cada RGB busca densidades
  ≥0 que minimicen el error en Lab bajo el modelo de tinta, con una regularización que prefiere menos tintas. En la GPU es una
  sola lectura de textura.
- **Biblioteca de tintas** inspirada en tintas spot y de riso, con **nombres genéricos** ("Rosa flúor", "Azul medio",
  "Amarillo", "Verde azulado", "Rojo vivo", "Azul federal", "Naranja"…). Sin nombres comerciales de Riso ni de Pantone.
  - Se avisa que los **flúor no se reproducen en pantalla**: se ven aproximados.
- **CMYK:**
  - **"Vista CMYK (simulación)":** tintas de proceso + separación con GCR/UCR simple y ángulos 15/75/0/45. Se rotula siempre
    como simulación.
  - **"Archivo de producción CMYK"**, en la Fase 12:
    - lo honesto para esta app son **las planchas tramadas que generamos nosotros**: la trama es parte del arte;
    - se escriben como canales de un TIFF separado (`Photometric=5`) o como un PDF con `DeviceCMYK`;
    - la conversión con **perfil ICC** real (lcms2 compilado a WASM, MIT, cargado a pedido, con un perfil que cargue el
      usuario o uno de licencia verificada como FOGRA39 / ECI) llega en una fase posterior.
  - **Nunca** se rotula un PNG como CMYK.

---

## I. Arquitectura de exportación

| Salida | Contenido | Implementación |
|---|---|---|
| **PNG RGB** (MVP) | Con papel o **transparente**; 1×/2×/4×/px a medida; mm/cm/pulgadas + DPI | Render por tiles → **codificador PNG en streaming** propio con `CompressionStream('deflate')` nativo, por franjas (no hace falta un canvas gigante, que en iOS tiene un tope de ~16,7 MP); chunk `pHYs` con el DPI y chunk `sRGB` |
| PNG transparente | Solo el efecto | Un tono: `α = densidad·opacidad`, RGB = tinta. Varias: `α = 1 − Π(1 − a_i)` y color = (composición sobre blanco − (1 − α)) / α, para que se vea igual sobre blanco y razonable sobre otros fondos |
| **Separaciones por tinta** (Fase 7) | Un PNG gris o de **1 bit** por tinta (negro = tinta), al dpi de la plancha, + compuesto RGB, en un ZIP | Escritor ZIP propio (store + CRC32, ~80 líneas). Modo "película / master" sin antialias |
| **PDF de imprenta** (Fase 12) | Una imagen por tinta en espacio `/Separation /NombreTinta`, **overprint activo** (`/OP /op /OPM`), tamaño en puntos, marcas de registro y corte opcionales | Escritor PDF mínimo propio (~300 líneas, FlateDecode con `CompressionStream`) |
| **TIFF** (Fase 12) | CMYK separado o canales spot; DPI y, opcionalmente, ICC | Escritor TIFF baseline propio |
| **SVG** (Fase 13) | **Solo la matriz limpia**, sin papel ni imperfecciones, y solo donde es vectorizable | `line` → trazos de ancho variable como contornos (RDP + Bézier). `screen` → puntos y paths **con un estimador de nodos** que lo desactiva por encima de ~150k elementos. Umbral y relieve → contornos de la iso-línea `φ = 0` (marching squares sobre el campo continuo + Bézier por Schneider), con slider de calidad y límite de nodos. **Sin potrace (GPL).** |

**Topes por equipo.** Se calculan con `MAX_TEXTURE_SIZE`, `deviceMemory` y la plataforma: ~10.000 px de lado en el teléfono
y ~20.000 en la computadora, con un aviso. El export es cancelable, muestra el progreso con el anillo y no congela la UI.

**Fuentes en el export.**
- Si el original es más grande que la textura que se usa en el preview, el export sube **recortes por tile del original**:
  usa toda la resolución real.
- Los SVG importados se re-rasterizan a la escala del export (en la v1.1, por tile).

---

## J. Mobile y UX

### J.1 Flujo (6 pasos del pedido → anatomía del kit)

1. **Sin imagen:** la tarjeta invita con "Soltá, pegá o elegí una imagen", un botón ancho negro `ELEGIR IMAGEN` y 3
   muestras de dominio público para probar.
2. **Al cargar:** se crea una capa, se encaja en el documento y se abre IMPRIMIR con la técnica por defecto (Risografía o la
   última usada). Hay resultado inmediato.
3. **Técnica:** selector en la fila, con miniaturas en vivo de la imagen del usuario.
4. **Efecto:** fila rápida + 3–5 esenciales; el resto en Avanzado.
5. **Tintas:** segmentado de cantidad, lista de tintas (muestra, nombre, ojo), biblioteca de muestras + propia; por tinta,
   opacidad y densidad; en Avanzado, trama, registro y orden.
6. **Material:** interruptor PAPEL + `pick-grid` de papeles + color e intensidad; interruptor IMPERFECCIONES + chips; en
   Avanzado, escala, contraste, absorción, desplazamiento e interacción con la tinta.
7. **⚙ Avanzado (global):**
   - interruptores LIMPIO / FÍSICO (técnica, textura de tinta, imperfecciones, papel, color, registro);
   - documento (A4 / A3 / Carta / Cuadrado / a medida en mm, DPI);
   - semilla (valor + "Nueva");
   - calidad del preview.
8. **Exportar** (header): una hoja superpuesta con `PNG | IMPRENTA | SVG`, fondo (papel o transparente), tamaño (chips + px
   resultantes + medida física) y un único botón negro `EXPORTAR`.

### J.2 Antes / después

- Botón redondo **izquierdo** de la tarjeta: **mantener apretado = original** (la semántica del kit para "mantener").
- En la computadora, además, se puede mantener la tecla `\`.
- Es instantáneo: muestra la composición de las fuentes, que ya está en caché.

Se descarta el slider dividido porque agrega una pieza fuera del kit.

### J.3 Gestos en el lienzo

| Modo | 1 dedo | 2 dedos | Doble toque |
|---|---|---|---|
| IMPRIMIR | Paneo (si hay zoom) | Zoom / paneo | Encajar ↔ 100 % (para ver la trama real) |
| COMPONER | Elegir / mover capa | Sobre la capa: escala y rotación; fuera: zoom | — |

El zoom y el paneo responden **al instante con una transformación CSS** del canvas mostrado, mientras el worker vuelve a
dibujar nítido a la nueva escala (como un mapa).

### J.4 Performance mobile

- DPR con tope 2 y tope de MP del preview.
- Durante un arrastre, resolución ×0,5 para los parámetros pesados.
- Pausa del render con `visibilitychange`.
- **Reconstrucción ante pérdida del contexto WebGL**: todo es reconstruible desde el proyecto.
- `highp` obligatorio, verificado con `getShaderPrecisionFormat`.
- Si no hay RGBA16F renderizable, RGBA8 con codificación cuidadosa.
- Export con tiles de 1024 en el teléfono.
- Compartir con `navigator.share` (que en iOS lleva a "Guardar imagen").

---

## K. Estrategia de performance

**Por qué WebGL2 y no las otras opciones:**

| Opción | Decisión |
|---|---|
| **WebGL2 (GLSL ES 3.0)** | **Motor principal.** Está disponible en casi todos los navegadores, también dentro de workers con OffscreenCanvas (Safari 17 o más nuevo). Tiene enteros sin signo (para hashes deterministas), MRT y texturas float / half-float. |
| Canvas 2D | Solo para miniaturas y decodificación. No sirve para pipelines de 2–5 MP por cuadro. |
| WebGPU | **Segundo backend futuro.** Sus compute shaders aceleran líneas de flujo, difusión de error y la LUT. Hoy no alcanza para ser la única vía en mobile sin duplicar los shaders. La capa `render/gl` queda delgada para poder agregarlo. |
| Web Workers + OffscreenCanvas | **Sí.** El render vive en un worker; el hilo de la UI nunca se bloquea. |
| WASM | **No en el MVP.** Solo si una medición lo justifica (difusión de error a 60 MP, líneas en el export) o para librerías existentes a pedido (lcms2, HEIC, TIFF de entrada). |

**Hilos:**
- **Principal:** React, el store y el historial (`history.ts` del kit), gestos y overlay de selección. No dibuja nada pesado.
- **Worker de render:** OffscreenCanvas transferido desde el canvas visible. Es dueño de todos los recursos de GPU, el grafo,
  la caché de nodos, el preview y el export. El export se intercala por tiles entre cuadros del preview, que tiene
  prioridad, y se puede cancelar.
- **Pool de análisis** (hasta 3 workers): ETF, líneas de flujo, componentes conexas, transformadas de distancia, LUT, k-means,
  blue noise, análisis de assets y codificadores.
- **Alternativa:** si no hay WebGL en OffscreenCanvas, el mismo módulo de render corre en el hilo principal con presupuesto
  por cuadro.

**Mensajes entre hilos:** el hilo principal manda el **estado del proyecto** completo (un JSON chico) en cada cambio; el
worker compara hashes e invalida lo justo. Las imágenes viajan como `ImageBitmap` o `ArrayBuffer` transferibles.

**Determinismo:**
- PRNG `sfc32` en la CPU y hash `pcg3d` sobre enteros en la GPU;
- **flujos de semilla por módulo** (`hash(semilla, idMódulo)`): cambiar una imperfección no altera el registro;
- todos los ruidos se evalúan en mm de documento, así que el preview y el export coinciden;
- **la promesa honesta:** la misma semilla en el mismo equipo da un resultado idéntico bit a bit; entre GPUs distintas da un
  resultado visualmente idéntico, porque puede haber diferencias de un ulp en los bordes de umbral.

**Presupuestos (los valida cada fase):**
- parámetro GPU → preview en <16 ms en la computadora y <50 ms en un teléfono medio;
- recálculo de campos <500 ms, con el resultado anterior visible;
- export de 6000 × 6000 en <15 s en la computadora.

---

## L. MVP

**El MVP comprende las Fases 0–11:**
- 5 motores;
- 13 presets;
- composición;
- color spot / duotono;
- papel e imperfecciones;
- modo limpio;
- semilla;
- PNG grande y transparente;
- separaciones por tinta en ZIP;
- funcionamiento real en el teléfono.

**Orden de los motores y por qué:**
1. `screen`: es el más simple y fija la independencia de resolución, el LOD y el export.
2. `stencil`: suma la separación, el modelo de tinta y el registro. Lo reutilizan la risografía y la serigrafía.
3. `relief`: suma la impresión física (squash, deboss, contacto con el papel).
4. `line`: es el más difícil. Cuando está listo, la xilografía suma sus gubias.
5. `grain`: litografía.

---

## M. Roadmap: fases verificables

Cada fase deja algo que se prueba visualmente, con capturas a 390 × 844, 375 × 812, 360 × 740 y 1440 × 900, el checklist
`07-checklist.md` y sin errores en la consola. Nunca hay dos sistemas grandes en paralelo.

| Fase | Entrega | Cómo se verifica |
|---|---|---|
| **00 · Base** | Vite + React + TS; el kit copiado a `src/ui` y sus docs a `docs/design-kit`; `CLAUDE.md` con la regla del kit; i18n `es.ts`; shell header · tarjeta · fila · hoja con los dos modos y el estado vacío; este planning en `docs/PLANNING.md` | Capturas que coinciden con el kit en los 4 tamaños |
| **01 · Entrada** | Selector de archivos, arrastrar y soltar, **pegar** (evento `paste` + botón con `navigator.clipboard.read`), PNG/JPG/WebP (+ SVG rasterizado; HEIC si el navegador lo decodifica; si no, un aviso claro); assets por hash SHA-256 en IndexedDB; una capa nueva encajada; worker de render WebGL2 mostrando la composición; zoom y paneo | Pegar una imagen copiada del navegador → aparece. Pellizcar en un teléfono real o emulado |
| **02 · Composición** | Seleccionar, mover, escalar, rotar, recortar, opacidad, orden, visibilidad, duplicar, borrar, fusión y tinta destino; panel de capas; deshacer por gesto; autoguardado y restauración | Componer 3 imágenes, deshacer paso a paso, recargar y que vuelva todo |
| **03 · Núcleo del render** | Grafo con hashes y caché; coordenadas en mm; preparación del tono; **modelo de tinta Beer–Lambert**; monotinta / duotono de tono continuo; papel procedural v1; fondo transparente; **comparar**; LOD | Carta de prueba de sobreimpresión (rampas de 2 tintas); un duotono de foto creíble |
| **04 · Export v1** | Render por tiles con solape; **PNG en streaming** con DPI; transparente; 1×/2×/4×/a medida; mm/cm/pulgadas + DPI; progreso y cancelación; topes por equipo | Export de 8000 px en la computadora y de 4000 o más en el teléfono; diferencia preview/export = 0 a igual escala; PNG transparente en Figma |
| **05 · Motor `screen`** | 6 o más formas de punto, lpi, ángulo, ganancia física (δ en mm), suavidad, fase, ángulos por tinta, moiré deliberado, FM blue noise, patrón propio; presets **Trama de diario** y **Trama editorial** | Rampa tonal y foto; contar las celdas por pulgada en el export = lpi pedido; sin moiré falso en el preview |
| **06 · Semilla + impresión v1 + imperfecciones v1 + soporte v2** | Flujos de semilla y Variante (dado); modelo de impresión (contacto con el papel, agotamiento, bleed); altura del papel y luz; imperfecciones base; panel de **modo limpio**. **Se te piden los assets** | La misma semilla da un hash de export idéntico; con todo apagado sale un PNG limpio |
| **07 · Motor `stencil`** | Asignación por capas, LUT de separación, posterizado k-means, clave fotográfica, trama por tinta, **registro**, opacidad y orden de pasadas; impresión de **serigrafía** y de **riso** (grilla de master, grano FM, bandas, agotamiento, ghosting); biblioteca de tintas; **separaciones en ZIP**; presets Serigrafía, Serigrafía pop, Risografía y Risografía grano | Comparación lado a lado con las refs. 1, 5, 6, 7 y 8; abrir las separaciones y comprobar que alcanzan para imprimir |
| **08 · Motor `relief`** | Simplificación + detalle mínimo; xilografía v1 (masas, veta, astillado anisótropo, baren); linograbado; letterpress (squash, deboss, sub y sobreentintado); tipos móviles (variación por componente conexa, piezas gastadas); presets | Comparación con la ref. 2; texto pegado en letterpress y tipos móviles: deben verse distintos |
| **09 · Motor `line`** | ETF; líneas de flujo equiespaciadas por capa; ancho y espaciado según tono; puntas; trazos en GPU independientes de la resolución; impresión de huecograbado (tono de plancha, huella, tinta en relieve); presets **Buril** y **Aguafuerte**; después, **xilografía v2** con gubias en polaridad blanca | Comparación con las refs. 3 y 4; retrato y estatua; export a 2× del preview con líneas idénticas en posición |
| **10 · Motor `grain`** | Grano de piedra, lápiz con dirección de trazo, tusche, crachis; impresión planográfica con scumming; preset **Litografía en piedra** | Rampa y retrato: tono rico sin bandas, grano que no se repite |
| **11 · Texturas reales** | Herramienta de clasificación y normalización; manifiesto; hex-tiling + mezcla que preserva el histograma; tus assets en sus roles; biblioteca de papeles en Material | Antes y después con assets; buscar repeticiones a 400 % |
| — **fin del MVP** — | | Criterios de éxito (§V) |
| **12 · Paquete de imprenta** | PDF spot con Separation + overprint; TIFF; vista CMYK (simulación); trama offset CMYK; después, ICC con lcms2-wasm | Abrir el PDF en Acrobat → Vista previa de salida: una separación por tinta |
| **13 · SVG** | `line`, `screen` con estimador e iso-contornos de relieve | Abrir en Illustrator/Figma; cantidad de nodos dentro del límite |
| **14 · Pulido** | PWA sin conexión; **Guardar / Abrir proyecto** (`.imprenta` = zip con `project.json` + `assets/`); revisión de performance en un teléfono real | Lighthouse; abrir un proyecto en otro equipo |
| **15+** | Punta seca, aguatinta, mezzotinta, madera de pie, Ben-Day, dither de 1 bit, tipos de madera, máscaras, capa de texto, WebGPU, Display-P3, superresolución IA opcional | — |

---

## N. Estructura del proyecto (segunda etapa)

```
/docs            PLANNING.md · design-kit/ (copia) · research/tecnicas.md (textos con estado)
/public          textures/ (procesadas + manifest.json) · samples/ · bluenoise/ (tiles precalculados)
/tools           textures/ (clasificar y normalizar, Node) · bluenoise/ (void-and-cluster) · charts/ (cartas de prueba)
/src
  main.tsx
  ui/            design kit: tokens.css, base.css, kit.tsx, controls.tsx, icons.tsx (+ íconos nuevos),
                 ParamControl.tsx (genera controles desde ParamDef)
  i18n/          es.ts (claves + estado borrador/revisado/aprobado)
  app/           shell, modos (compose/, print/), paneles (Effect, Inks, Material, Advanced, Layers, Export),
                 canvas/ (vista, gestos, overlay de selección, puente con el worker)
    store/       store del proyecto + history.ts (kit) + autoguardado + saneado por lista blanca
  model/         tipos (Project, Layer, Ink, PresetDef, ParamDef), esquema y migraciones, unidades (mm/in/pt/lpi/dpi)
  presets/       registry.ts + un archivo de datos por preset, agrupados por familia de navegación
  engines/       screen/ stencil/ relief/ line/ grain/  — cada uno: params.ts, mapUniversal.ts, *.glsl, fields.ts
  print/         física compartida: impression/ (relief, intaglio, planographic, screenprint, riso),
                 ink/ (modelo, biblioteca, separación), registration/, imperfections/, substrate/
  render/        grafo (nodos, hashes, caché), gl/ (wrapper WebGL2 mínimo: programas, pool de FBO, texturas,
                 pérdida de contexto), passes/ (planchas, prep, tintas, display), tiler.ts, lod.ts,
                 glsl/ (hash, ruido, hex-tiling, bicúbico, spot functions)
  analysis/      CPU pura: etf.ts, streamlines.ts, ccl.ts, distance.ts, kmeans.ts, lutSolver.ts,
                 bluenoise.ts, resample.ts (Lanczos), contours.ts, assetAnalyze.ts
  workers/       render.worker.ts, analysis.worker.ts, rpc.ts
  io/            import/ (decodificar, pegar, soltar), assets/ (IndexedDB), export/ (pngStream, zip, pdf,
                 tiff, svg), projectFile.ts
  util/          prng.ts, hash.ts, math.ts
/tests           unit (vitest): PRNG, unidades, codificadores, LUT, spot functions, saneado
                 visual (Playwright): cartas de prueba → imágenes de referencia por preset
```

**Por qué esta estructura:**
- **`engines/` y `presets/` separados:** los presets son datos puros y los motores son algoritmos. Un preset nuevo es un
  archivo.
- **`print/` aparte de `engines/`:** la física de impresión, tinta, registro y papel se comparte. Es lo que hace que todas
  las técnicas "parezcan impresas" de forma coherente, y evita que cada motor reinvente el papel.
- **`render/` no conoce ninguna técnica:** solo grafo, tiles y GL. Así se puede agregar WebGPU o cambiar la estrategia de
  tiles sin tocar los motores.
- **`analysis/` es TypeScript puro sin DOM:** corre en workers, se testea con vitest y se puede portar a WASM función por
  función si una medición lo pide.
- **`ui/` es el kit intacto** + `ParamControl`: se cumple "no se rediseña lo que funciona".

**Dependencias:**
- de ejecución: `react` y `react-dom`, nada más en el MVP (PNG, ZIP, PDF, TIFF y el wrapper GL son propios; deflate nativo);
- de desarrollo: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `@playwright/test` y, si se entrega como un único
  HTML, `vite-plugin-singlefile` (los workers van inline);
- a pedido, más adelante: `lcms2` WASM, un decodificador de TIFF y `onnxruntime-web`.

---

## V. Verificación y criterios de éxito

**Cartas de prueba fijas** en `/tools/charts`:
- rampa 0–100 %;
- foto de retrato;
- ilustración plana;
- tipografía fina;
- imagen de 300 px;
- PNG con alfa;
- carta de sobreimpresión de 2 y 3 tintas.

**Por preset:**
- lado a lado con su referencia y la pregunta "¿parece una impresión real o un filtro?";
- revisión al 100 % y al 400 % buscando repeticiones o ruido uniforme;
- la imagen de 300 px exportada a 4× no muestra escalones.

**Criterios de éxito del pedido (§44) y cómo se comprueban:**
- pegar e intervenir de inmediato (Fase 01);
- técnicas reconocibles (comparación con las refs.);
- escala y detalle (universales);
- 1 o varias tintas (Fase 07);
- apagar papel e imperfecciones / resultado limpio (Fase 06);
- combinar imágenes (Fase 02);
- mobile real (capturas + teléfono físico);
- preview rápido (presupuestos de §K);
- export más detallado que el preview (Fase 04, al 100 %);
- PNG transparente de alta resolución (Fase 04).

**Herramienta.** Con el navegador integrado (preview de Vite) saco las capturas en los 4 tamaños y leo la consola en cada
fase.

## R. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Calidad y tiempo del motor `line` | Va en una fase propia. Hay un preview progresivo (líneas gruesas primero). Las líneas viven en mm, así que se calculan una sola vez |
| Memoria en iOS (~1–1,5 GB por pestaña; tope de canvas de 16,7 MP) | Tiles + PNG en streaming + topes por equipo + reconstrucción ante pérdida del contexto |
| Precisión `mediump` en GPUs de teléfono | `highp` obligatorio y verificado; hashes con enteros |
| Repeticiones en las texturas | Hex-tiling + mezcla que preserva el histograma + alternativa procedural |
| Moiré falso en el preview | LOD con cobertura integrada + aviso de zoom |
| Licencias | Alte Haas (confirmada para esta app); sin potrace (GPL); perfiles ICC; nombres de tintas genéricos; muestras de dominio público |
| Fidelidad histórica de los textos | Estado "borrador" hasta que se revisen |

## Decisiones tomadas (3 de octubre de 2026)

1. **Nombre:** TALLER DE GRABADO. La marca va en dos líneas ("TALLER DE" / "GRABADO") y sale del archivo de textos.
2. **Fuente de etiqueta:** Alte Haas Grotesk. El usuario confirmó que tiene licencia para esta app. Work Sans se mantiene
   para el cuerpo.
3. **Entrega:** **un único HTML** que funciona con doble clic y sin conexión (`vite-plugin-singlefile`, como en el kit).
   Cambia lo siguiente:
   - Los workers van **inline** (blob URL). Si un navegador no permite workers u OffscreenCanvas en `file://`, el render
     corre en el hilo principal con presupuesto por cuadro (la alternativa de §K ya lo prevé).
   - Autoguardado en IndexedDB con prefijo `taller-de-grabado:`. Si en `file://` no está disponible, se guarda solo el
     proyecto en localStorage (sin imágenes) y se avisa con un aviso breve.
   - Pegar se resuelve con el evento `paste` (anda siempre). El botón que lee el portapapeles aparece solo si
     `navigator.clipboard.read` existe.
   - Las texturas, los tiles de blue noise y las muestras van **embebidos** en el HTML: se vigila su peso (objetivo
     inicial: <25 MB en total).
   - **La Fase 00 incluye una prueba de `file://`** en Chrome, Edge, Firefox y Safari: worker inline, WebGL2 en
     OffscreenCanvas, IndexedDB, `paste` y descarga. El resultado se anota acá.
4. **Técnica por defecto:** Risografía de 2 tintas.
5. **Siguiente paso:** Fase 00. Los assets se piden al empezar la Fase 06.

### Resultado de la prueba de `file://` (Fase 00, 3 de octubre de 2026)

Se abre `dist/index.html#diag` (el HTML único que genera `npm run build`).

| Comprobación | Edge 154 (Chromium, Windows, headless) | Firefox | Safari / iOS |
|---|---|---|---|
| Worker inline (blob, iife) | OK | pendiente | pendiente |
| WebGL2 en worker con OffscreenCanvas | OK (textura máx. 16384, ANGLE D3D11) | pendiente | pendiente |
| Render a RGBA16F / RGBA32F | OK | pendiente | pendiente |
| `highp` en fragment shader | OK | pendiente | pendiente |
| IndexedDB (blob de 1 MB, ida y vuelta) | OK | pendiente | pendiente |
| localStorage | OK | pendiente | pendiente |
| `navigator.clipboard.read` | OK (`file://` cuenta como contexto seguro) | pendiente | pendiente |
| CompressionStream (principal y worker) | OK | pendiente | pendiente |

**Conclusión provisoria:** en Chromium, el HTML único soporta toda la arquitectura del plan sin recortes. Firefox y
Safari se prueban abriendo el mismo archivo con `#diag` al final de la dirección. Si algo falla, se usan las alternativas
ya previstas en "Decisiones tomadas".

## Avance

| Fase | Estado | Notas |
|---|---|---|
| 00 · Base | Hecha (3 de octubre de 2026) | Shell del kit, paneles con estado, prueba de `file://` |
| 01 · Entrada | Hecha (3 de octubre de 2026) | Archivo / soltar / pegar / botón PEGAR; PNG, JPG, WebP, GIF, AVIF, SVG (raster de 4096 px), HEIC y TIFF si el navegador los abre; assets por SHA-256 en IndexedDB; una importación = un paso de deshacer; render WebGL2 en worker (con alternativa en el hilo principal); zoom con pellizco o Ctrl + rueda, paneo con zoom, doble toque encajar ↔ 100 % (300 dpi). Probado en Edge con el HTML único. Exportar, compartir y Variante siguen al 30 % hasta sus fases. |
| 02 · Composición | Hecha (4 de octubre de 2026) | Elegir con un toque (atraviesa la transparencia con una máscara de alfa de 128 px), mover, pellizcar para escalar y rotar, tiradores de esquina y de rotación (se pega a 0/90/180°), recorte por bordes que respeta rotación y espejo, panel Mover (ancho en mm, rotación, encajar / llenar / centrar / espejo), panel Capas (orden, visibilidad, tinta destino AUTO o 1…N, opacidad, fusión, bloquear), barra flotante, atajos (Supr, Ctrl+D, Ctrl+[ ], Alt+flechas, Esc), un gesto = un paso de deshacer, autoguardado en IndexedDB con saneado por lista blanca y restauración al abrir. Probado en Edge con el HTML único. La tinta destino se guarda; se ve impresa desde la Fase 03. |
| 03 · Núcleo del render | Hecha (4 de octubre de 2026) | Pasadas de capas a texturas intermedias (todas en color · AUTO · una plancha gris por tinta asignada), en caché: solo se rehacen si cambian capas, vista o tamaño. Composición con separación NNLS en absorbancia (hasta 6 tintas), tinta Beer–Lambert (la sobreimpresión oscurece sola), papel procedural v1 en mm (pulpa + fibras que se desvanecen con el zoom, 10 papeles), contraste y cantidad de tinta, salida sin papel con el alfa mínimo exacto sobre blanco, Comparar (mantener el botón o la tecla \), interruptor de Color (las marcas toman los colores de la imagen). Modelo de tinta en `src/print/ink.ts` con tests; el shader lo replica. Probado en Edge con el HTML único. Aún sin técnica: la tinta se imprime en tono continuo. |
| 04 · Export v1 | Hecha (4 de octubre de 2026) | Hoja Exportar: FONDO (con papel / transparente, es el mismo interruptor PAPEL), TAMAÑO 1× / 2× / 4× = 150 / 300 / 600 dpi o A MEDIDA (36 dpi hasta el tope del equipo), medidas en mm, cm o pulgadas. El renderer dibuja "frames" (el pliego sobre un destino de W × H px): el preview y cada tile del export usan el mismo código. Tiles de 2048 (1024 en pantallas táctiles), fuentes re-decodificadas hasta 8192 px si el export lo necesita, PNG por franjas con CompressionStream (RGB o RGBA con alfa directo, pHYs con los dpi, sRGB), progreso con el anillo, cancelación. Topes: 20000 px de lado y 240 MP (60 MP y 10000 px en táctiles). Medido en esta PC: A4 300 dpi 2,1 s · 600 dpi (35 MP) 6,1 s · 1000 dpi (97 MP) 11,3 s. 1× contra 4× promediados: diferencia ≤ 1/255. Compartir: se prepara el PNG y un segundo toque abre el menú del sistema (el navegador exige un toque reciente); sin soporte, descarga. |
| 05 · Motor `screen` | Hecha (4 de octubre de 2026) | Formas redondo (euclidiano), cadena (elipse), cuadrado, línea, cruz y rombo como funciones continuas y simétricas; tabla de cuantiles (33) para que el área entintada sea exactamente el tono. Tono leído en el centro de cada celda y mezclado con el del píxel según DETALLE. Ganancia física en mm, escalada por PRESIÓN; suavidad; aspereza de borde. Ángulos por tinta según los juegos clásicos (K 45 · C 15 · M 75 · Y 0) rotados con el ángulo base; MOIRÉ los acerca a propósito. Estocástica (FM) con ruido azul void-and-cluster 64 × 64 (tiles volteados por hash, vecindario 3 × 3 para que los puntos se fundan); en FM la ganancia queda limitada al 12 % del punto. **Corrección de fondo:** los tonos se manejan en "% de punto" perceptual (como un archivo de preimpresión: un gris del 50 % ≈ 57 % de punto en negro antes de la ganancia) y la cobertura se promedia en luz reflejada (1 − a·(1 − T)), no en absorbancia; tono continuo, planchas y trama comparten ese dominio (`print/ink.ts`, con tests). Vista alejada: celdas de menos de ~5 px de pantalla se muestran como tono (con su ganancia) y aparece una nota para acercarse; en el archivo el umbral es ~1 px. Export con margen de solape igual a una celda. Presets Trama de diario (65 lpi, redondo, prensa) y Trama editorial (133 lpi, cadena, blanco). Elegir una técnica aplica su preset en un paso de deshacer; el panel Efecto se genera desde `ParamDef`. Verificado: 65 lpi pedidos → 64,9 lpi medidos en el PNG a 300 dpi. |
| 06 · Semilla + impresión v1 + imperfecciones v1 + soporte v2 | Hecha (4 de octubre de 2026) | **Semilla** en el documento (Avanzado: número editable + NUEVA) con flujos por módulo (`util/seed.ts`: papel, impresión, imperfecciones, registro, trama, variante); la GPU deriva los suyos de la misma semilla. **Variante (dado):** cada técnica trae estilos con rangos (Trama de diario: Diario gastado, Tirada limpia, Trama gruesa, Trama de líneas; Trama editorial: Cadena fina, Punto cuadrado, Cruz y rombo, Estocástica fina; las técnicas sin motor usan 5 estilos genéricos); nunca repite el anterior, sortea dentro del rango, cambia la semilla, respeta tintas, papel, capas e interruptores, un paso de deshacer y un aviso con el nombre del estilo. **Render:** una pasada de tono por tinta (separación + planchas, en caché) que leen la trama y el registro; un campo de **masa** por tinta a resolución de análisis (pliego entero a 4 px/mm, desenfoque gaussiano de σ = 3 mm) igual en preview y export. **Modelo de impresión v1** con pesos por familia (`print/impression.ts`: relieve, huecograbado, planografía, estencil, offset): contacto con el relieve del papel según la presión (con el promedio correcto cuando las fibras no se pueden dibujar), moteado de la película (MOTEADO), agotamiento en masas grandes, bleed a lo largo de las fibras según la absorción del papel. **Registro** por tinta (desplazamiento y giro sobre el centro, la primera tinta fija, hasta 1,2 mm y 0,25°) aplicado a las coordenadas de la plancha. **Imperfecciones v1** (chips en Material + INTENSIDAD): presión despareja, falta de tinta, polvo y *hickeys*, desgaste, manchas y *foxing*; cada preset trae su set. **Papel v2:** relieve y absorción por papel, LUZ RASANTE (Material · Avanzado). **Modo limpio** completo con ayudas. Verificado en Chromium con el HTML único: tres exports con la misma semilla dan el mismo SHA-256, una semilla nueva da otro y volver a tipear la anterior lo repite; con todo apagado sale un PNG transparente limpio. **Pendiente:** las texturas reales (§G.4) siguen pedidas; todo usa la alternativa procedural. |
| 07 · Motor `stencil` | Hecha v1 (4 de octubre de 2026) | Motor `stencil` (`engines/stencil/params.ts`) con tres formas de llevar el tono: **planos** (posterizado por tinta en 2–5 niveles con borde antialiasado, simplificación = DETALLE como desenfoque del tono a resolución de análisis leído con B-spline cúbica para contornos redondos, **grano de película** para la clave fotográfica), **trama** AM y **grano** FM. Riso construye sus puntos sobre la **grilla del master** (200–600 dpi) y la serigrafía sobre la **malla** (40–200 hilos/cm, a 7°): de cerca se ven los píxeles del master y los dientes de la malla. Modelos de impresión `riso` (densidad máxima < 100 %, absorción, agotamiento) y `screenprint` (película gruesa que puentea el relieve del papel). **Opacidad por tinta** en orden de pasada (una tinta opaca tapa en proporción a la película que deja) y **orden de pasadas** en Tintas · Avanzado (las capas asignadas viajan con su tinta). Imperfecciones nuevas: **bandas** (del tambor en riso, estrías del rasero en serigrafía) y **fantasma** (copia tenue 38 mm más abajo, desde el tono de análisis). Aviso de flúor en Tintas. **Separaciones en ZIP** (Exportar · SEPARACIONES): un PNG gris por tinta (negro = tinta, la matriz limpia sin registro ni imperfecciones, nombrado `tinta-N-color.png`) + la impresión, con escritor ZIP propio (store + CRC-32). Presets **Risografía**, **Risografía grano**, **Serigrafía** y **Serigrafía pop**, cada uno con 4 estilos para el dado. Verificado en Chromium: ZIP válido (`unzip -l`), capturas en escritorio y teléfono, sin errores. **Diferido:** la LUT 3D de separación en Lab y el posterizado k-means en Lab (hoy la separación es NNLS por píxel y el posterizado es por tinta), trapping y ghosting por roce. |
| 08 · Motor `relief` | Hecha v1 (4 de octubre de 2026) | Motor `relief` (`engines/relief/params.ts`): la matriz es un corte del tono simplificado (DETALLE = ancho de gubia, hasta 2 mm de desenfoque a resolución de análisis) guardado como **distancia al borde en mm** (φ con pendiente por diferencias centrales), así sobre y subentintado (TINTA + PRESIÓN), aspereza, astillado y desgaste son desplazamientos de φ. **Superficie:** madera (anillos de crecimiento cortados a lo largo: líneas de leño tardío que toman menos tinta, bandas de leño temprano, fibras; con promedio correcto al alejarse), linóleo (moteado fino isótropo), plomo y fotopolímero. **Astillado** anisótropo a favor de la veta, **barén** (frotado a mano con trazos que se curvan) o prensa, **halo de tinta** (squash: borde oscuro, centro claro), **hundido** (deboss desde el tono de análisis, con luz rasante; además lleva la plancha al fondo del papel y quita los poros). **Tipos móviles:** componentes conexas en CPU a resolución de análisis (`analysis/components.ts`, union-find 8-conexo, ids estables) → por pieza: altura (tinta), línea de base corrida, piezas gastadas que pierden el borde. Presets **Xilografía**, **Linograbado**, **Letterpress** y **Tipos móviles**, con 4 estilos cada uno para el dado. **También:** la fuente ampliada se lee con **Catmull-Rom** (9 lecturas) en la pasada de capas, como pide §D.2: los umbrales dan curvas en vez de escalones; y se corrigió el signo de la luz rasante del papel. Verificado con texto pegado: letterpress (fotopolímero nítido, hundido profundo) y tipos móviles (variación letra por letra, squash, desgaste) se ven distintos. **Diferido:** cortes de gubia en polaridad blanca (llegan con `line`, xilografía v2) y la comparación con la ref. 2 cuando tengamos los scans de madera. |
| 09 · Motor `line` | Hecha v1 (4 de octubre de 2026) | Geometría en CPU (`engines/line/flow.ts`), una sola vez por tono y parámetros: **campo de direcciones** por tensor de estructura del tono suavizado (las líneas siguen las isofotas y envuelven los volúmenes; donde no hay forma, el ÁNGULO fijo; SEGUIR LA FORMA mezcla los dos), calculado a 1 px/mm; **líneas de flujo equiespaciadas** Jobard–Lefer (RK2, grilla de vecinos, semillas de vecinos + grilla gruesa) por capa de cruce (hasta 3, giradas 0°/55°/−50°), que solo corren donde el tono las pide; **ancho por vértice y por tinta** con cascada de cobertura entre capas (w/d = tono), puntas afinadas (ENTRADA Y SALIDA), temblor de mano (ASPEREZA) y simplificación de tramos rectos (A4 a 0,4 mm: ~1 s, ~5 MB). La GPU dibuja tiras de triángulos con antialias analítico (líneas de menos de un píxel se dibujan a un píxel y más claras), una tinta por canal y unión 1 − (1 − a)(1 − b). **El preview y el export dibujan el mismo buffer:** el análisis del export usa las mismas texturas del preview; 1× contra 2× reducido difiere en promedio 7,7/255 (contra 34,9 si las líneas se corrieran 2 px). Polaridad negra o blanca. **Impresión de huecograbado:** tono de plancha con rayas de limpieza, huella de plancha con bisel a la luz rasante, tinta en relieve. Presets **Grabado a buril** (línea que engorda, puntas finas) y **Aguafuerte** (línea pareja, cruces, temblor, más tono de plancha), con 4 estilos cada uno. **Xilografía v2:** GUBIAS en polaridad blanca sobre el motor `relief` (los medios tonos se tallan con cortes que siguen la forma y se afinan). **También:** el planificador de cuadros tiene un respaldo con temporizador (en un worker, después de un cuadro largo, `requestAnimationFrame` puede quedar quieto). **Diferido:** densidad de líneas variable con el tono (hoy el tono va por ancho y capas), punteado en las sombras más hondas, foul bite. |
| 10 · Motor `grain` | Hecha v1 (4 de octubre de 2026) | Tiles de grano de 512² generados una vez (`analysis/grainTiles.ts`, con semilla, periódicos e **igualados en histograma**: la tinta cubre exactamente el tono): **piedra granada** (Worley + fbm), **tusche** (reticulado de crestas de dos fbm) y **crachis** (gotas con distribución de tamaños en ley de potencia). En el shader se combinan **dos lecturas del tile con distinta escala y rotación** (nunca se repiten juntas) y la suma vuelve a ser uniforme con la CDF exacta de la media de dos uniformes, así no aparecen bandas ni repeticiones. **Lápiz con dirección de trazo** (el grano se estira y el tono se agrupa en bandas a lo largo del trazo), borde planográfico levemente blando (más nítido con ASPEREZA), **velo** (scumming: grasa en el grano abierto) y DETALLE como suavizado del tono. Vista alejada: si un diente mide menos de ~1 px, se muestra el tono. Preset **Litografía en piedra** con 4 estilos (grano fino, lápiz grueso, aguada de tusche, crachis). Verificado: rampa continua y escalones sin bandas a 100 %, tests de uniformidad y continuidad en los bordes del tile. **Diferido:** mezzotinta y aguatinta (usan este motor, después del MVP), grano real de piedra escaneado (§G.4). |
| 12 · Paquete de imprenta | Hecha v1 (4 de octubre de 2026) | Exportar · ARCHIVO **PNG / ZIP / PDF**. **PDF de imprenta** propio (`io/export/pdf.ts`): una imagen por tinta en espacio `/Separation` con el nombre de la tinta (con escape de nombres; tintas repetidas se numeran) y alternativa RGB, `/Decode [1 0]` sobre la película gris (negro = tinta), estado gráfico con **sobreimpresión** (`/OP /op /OPM 1`) y fusión **Multiplicar** (en cualquier visor las tintas se mezclan; en Vista previa de salida aparece una separación por tinta), tamaño de página en puntos (A4 = 595,276 × 841,89), imágenes con FlateDecode comprimidas en streaming. Verificado con poppler: `pdfinfo` (A4, título), `pdfimages -list` (una imagen `sep` por tinta a los ppi pedidos) y render correcto. Preset **Offset CMYK** (tintas de proceso, ángulos C 15° · M 75° · Y 0° · K 45°: rosetas), con 4 estilos (revista, historieta, moiré, estocástica). **Diferido:** TIFF, marcas de registro y corte (el pliego no tiene margen para ellas), vista CMYK con GCR/UCR y perfiles ICC. |

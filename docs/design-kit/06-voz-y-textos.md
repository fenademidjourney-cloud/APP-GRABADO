# 06 · Voz y textos

## Tono

- **Español rioplatense con voseo:** "Tocá", "Arrastrá", "Elegí", "Mantené apretado". La
  excepción es una frase que venga del diseño original; el placeholder del Figma, por
  ejemplo, decía "Escribe tu palabra…". Lo nuevo va con voseo.
- **Se le habla a un chico de 10 años sin infantilizarlo:** frases cortas, verbos de acción
  y palabras concretas. El término técnico se usa cuando enseña algo ("cuerpo", "matriz"),
  pero se explica la primera vez.
- **Se dice qué pasa, no qué es el control.** "Más tinta: una impresión llena y apretada.
  Menos: huecos, manchas y el grano del papel." en vez de "Controla la densidad de tinta".
- **Sin signos de exclamación ni emojis.** Tampoco "¡Genial!" ni "¡Ups!".

## Formatos por rol

| Rol | Formato | Largo | Ejemplo |
|---|---|---|---|
| Etiqueta de sección o control | MAYÚSCULAS, sin punto | 1–3 palabras | `TAMAÑO` · `CON QUÉ ESTAMPÁS` · `COLOR DEL PAPEL` |
| Segmento o chip | MAYÚSCULAS | 1–2 palabras | `MEZCLA` / `UNA SOLA` |
| Botón de texto | MAYÚSCULAS, verbo | 1–2 palabras | `ENTENDIDO` · `LISTO` · `SALTAR` |
| Nombre accesible de un ícono | Oración: "Acción: cómo" | ≤ 90 caracteres | `Sello: tocá para estampar; mantené apretado para cargar más tinta` |
| Nota o ayuda bajo un control | Oración con punto, cuerpo chico | 1 frase, ≤ 120 caracteres | `Cada letra puede salir de una caja distinta. Tocá el dado para mezclar.` |
| Aviso breve | MAYÚSCULAS, sin punto | ≤ 50 caracteres | `IMAGEN DESCARGADA` · `ESA LETRA NO ESTÁ EN LA CAJA` |
| Aviso de primera vez | Título como pregunta o acción + 1–2 frases | ≤ 280 caracteres | `¿Qué estoy viendo?` + explicación |
| Placeholder | Invitación en imperativo | ≤ 50 caracteres | `Escribí tu palabra o arrastrá tipos de la caja` |
| Valor | Número + unidad, sin espacio en % | — | `42%` · `15°` · `36 pt` · rango `8–42%` |

## Reglas

- **Un concepto, una palabra.** Si se dice "pliego", no se dice también "hoja" ni "lienzo"
  para lo mismo.
- **Lo que falta se dice, no se esconde.** "Dato pendiente de verificación" en vez de un
  campo vacío; "Texturas provisorias…" cuando algo es temporal.
- **Los errores dicen qué hacer:** "NO SE PUDO PREPARAR LA IMAGEN", con un camino para
  seguir si lo hay.
- **Ningún texto de la interfaz va escrito en el código de los componentes.** Todo sale de
  un único archivo de textos con claves (`t('art.size')`), así se revisan y traducen juntos.
- **Los textos educativos se marcan con su estado** (`borrador`, `revisado`, `aprobado`)
  hasta que alguien los apruebe.

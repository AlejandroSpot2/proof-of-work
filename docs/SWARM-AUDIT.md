# Auditoría del swarm de cursores (solo revisión)

Alcance: `components/studio2/Swarm.tsx`, su CSS en `components/studio2/studio2.module.css` y su montaje en `components/studio2/StudioApp.tsx`.

Referencias, solo lectura:
- **Reel 5 de Neviza**: `PromoColossu/variants/neviza-2026/src/r5-vision-swarm.html` y `projects/r5-vision-swarm-9x16/index.html`. Son el mismo archivo; el segundo tiene resueltos 1080x1920.
- **Swarm de Joel Califa** (https://califa.github.io/swarm-site/): estudiado solo por su comportamiento. No se leyó ni se copió su código.
- **Lunaria Atelier de Neviza**: solo la descripción que dio el dueño; no la he visto.

En esta tarea no se cambió código de la app.

**Cómo leer la evidencia**

| Marca | Significado |
|---|---|
| **[O]** | Observado en un navegador real (Edge, 1440x900): video, cuadros o el registro del probe. |
| **[C]** | Leído en el código, con `archivo:línea`. |
| **[H]** | Hipótesis: deducida del código, pero no medida. |

**Artefactos en `docs/swarm-review/`**

| Archivo | Contenido |
|---|---|
| `ours-swarm.webm` | 10,24 s, 1440x900. Studio nuevo, clic en **Build portfolio**, lectura, swarm y portafolio asentado. |
| `reel5-swarm.webm` | 14,76 s, 540x960. Reel 5 en tiempo real desde t=0. |
| `ours-frame-00..07.jpg` | Cuadros cada ~300 ms del mismo flujo. Corrida aparte, sin video, para que las capturas no frenen la animación. |
| `reel5-t*.jpg` | Cuadros del Reel 5 en sus propios tiempos (1,0 a 12,8 s), buscados sobre su timeline pausado. |
| `scrolled-mid.jpg` | **Replay the reveal** con el canvas desplazado hasta los proyectos. |
| `ours-log.json`, `frames-log.json`, `reduced-log.json`, `scrolled-log.json` | Registro del probe: montaje y desmontaje del overlay, bloques recortados con sus rects, etiquetas de cursores, scroll del canvas, estilo computado del overlay y el estado de recorte del bloque `name` cuadro a cuadro. |
| `record.mjs` | El arnés: Playwright con Edge, más un probe inyectado con `addInitScript`. Lee la app y no la modifica. Uso: `node docs/swarm-review/record.mjs ours\|frames\|reduced\|scrolled\|reel5`. |

---

## 1. ¿El swarm corre de verdad en la ruta actual?

**Sí, corre, pero hace mucho menos de lo que parece.**

**Ruta.** El landing nuevo (`/`, estático) lleva a `/api/example/start?to=/studio`. Ahí se hace clic en **Build portfolio**.
- `build()` termina con `setPendingReveal(true)` [C] `StudioApp.tsx:113`.
- `readyToReveal` espera a que el modelo y el snapshot estén listos [C] `StudioApp.tsx:44-52`.
- Después monta `<Swarm>` [C] `StudioApp.tsx:314`.
- `walkthrough-v4` lo confirma en su check 3 ("the reveal is labeled an illustration") [O].

**Bloques objetivo encontrados [O] (`ours-log.json`, evento "overlay +120 ms")**

En el DOM hay 14 elementos `[data-swarm]`:
`hero, name, headline, facts, index, index-tidepool, index-quietroom, index-kerf, project-tidepool, project-quietroom, project-kerf, trust, next, sf`.

El filtro [C] `Swarm.tsx:44-51` hace cuatro cosas:
- deja solo lo visible dentro del canvas,
- descarta los hijos de un contenedor que no sea `hero`,
- descarta `hero`,
- corta en 9.

Con el canvas arriba, eso deja **4 bloques**: `name`, `headline`, `facts` e `index`.
- Las filas `index-*` quedan fuera porque viven dentro de `index`.
- `project-*`, `trust`, `next` y `sf` están bajo el pliegue.

**Lo que no entra en la coreografía [O] (`ours-frame-00.jpg`)**

- **El párrafo intro.** No lleva `data-swarm` [C] `Portfolio.tsx:117-118`. Se ve desde el primer cuadro, flotando solo en un canvas vacío.
- **La barra superior del portafolio** (nombre, chip EXAMPLE y nav) [C] `Portfolio.tsx:91`. Tampoco se anima.

**Cursores [O]**

- Son **7**, de acuerdo con `N = min(12, max(6, objetivos + 3))` [C] `Swarm.tsx:66`.
- Sus etiquetas son: `NOTES.md, PR-12.md, README.md, commits, contributors, NOTES.md, PR-7.md`.
- Salen de los primeros chips del rail en orden del DOM (`origins[i % len]`) [C] `Swarm.tsx:68`. Por eso:
  - todos vienen de Tidepool y Quietroom; ningún archivo de Kerf vuela;
  - `NOTES.md` aparece dos veces sin decir de qué proyecto es.

**Movimiento reducido [O] (`reduced-log.json`)**

El overlay se monta y se desmonta 16 ms después, sin recortar nada [C] `Swarm.tsx:54-58`. Se ve el estado final de inmediato, que es lo correcto. El caption alcanza a existir un cuadro [O]; el efecto es menor.

**Capa [O]**

El overlay usa `position: fixed`, `z-index: 60` y `pointer-events: none` (estilo computado en el log) [C] `studio2.module.css:475-480`. El caption tiene `pointer-events: auto` [C] `:516-531`, así que **Skip** funciona.

**Recorte y "flash" [O]**

En tres corridas, el bloque `name` aparece **sin recorte durante 60 a 88 ms** antes de que el swarm lo oculte:

| Corrida | Visible sin recorte | Recorte puesto | Duración |
|---|---|---|---|
| 1 | 2029 | 2117 | 88 ms |
| 2 | 2010 | 2082 | 72 ms |
| 3 | 2769 | 2829 | 60 ms |

En 60 ms caben de 4 a 5 cuadros a 60 Hz. La causa está en el orden de montaje [C]:
1. El portafolio terminado se renderiza: `built && model` en `StudioApp.tsx:294-298`.
2. Un `requestAnimationFrame` después se monta el swarm [C] `StudioApp.tsx:46-49`.
3. El recorte se aplica dentro de un `useEffect`, que corre tras el paint [C] `Swarm.tsx:60-62`.

[H] En vivo, el público puede ver un parpadeo del resultado completo justo antes de que "se construya". El probe lo mide (estado de recorte por cuadro), pero no lo verifiqué cuadro a cuadro en el webm.

**Scroll y coordenadas**

- Los rects se leen **una sola vez** al inicio con `getBoundingClientRect()` [C] `Swarm.tsx:11-14, 43, 92`.
- Cursores y selecciones se posicionan en coordenadas de viewport dentro del overlay fijo [C] `Swarm.tsx:77, 97-98`.
- El canvas es el contenedor con scroll (`overflow: auto`) [C] `studio2.module.css:417-425`, y `pointer-events: none` deja que la rueda llegue a él.
- [H] Si alguien desplaza el canvas durante los ~2,7 s, las selecciones y los cursores se quedan donde estaban los bloques. No lo medí.

**Replay con el canvas desplazado [O] (`scrolled-log.json`, `scrolled-mid.jpg`)**

- Solo hay 2 objetivos: `project-tidepool` (y=191, h=436) y `project-quietroom` (y=725, h=436). El segundo termina en y=1161, más allá del viewport de 900.
- El arrastre va a `r.y + r.h` [C] `Swarm.tsx:102`, así que [H] ese cursor y su selección salen de la pantalla.
- Hay 6 cursores: 2 trabajan y 4 deambulan sin tarea.

**Tiempo frente a `onDone`**

- [C] `end = 260 + objetivos·260 + 1100`, y `finish` corre en `end + 300` [C] `Swarm.tsx:112-116`. Con 4 objetivos da 2700 ms.
- [O] El overlay vivió 2741, 2743 y 2735 ms en tres corridas, que coincide.
- `finish` quita los recortes y los cursores, y llama a `onDone` → `setSwarm(false)`.
- En el desmontaje, la limpieza llama a `stop`, no a `onDone` [C] `Swarm.tsx:125-128`. Así, el doble efecto de StrictMode no termina el swarm antes de tiempo.
- Escape y **Skip** llaman a `finish` [C] `:118-124`.

---

## 2. Fases del timeline: el nuestro frente al Reel 5

**El nuestro.** El 0 es el montaje del overlay. Los tiempos salen de `Swarm.tsx`; los marcados [O] se midieron.

| Fase | ms | Qué pasa | Evidencia |
|---|---|---|---|
| Lectura | -850 → 0 | Los chips del rail pasan a "ok"; el canvas sigue mostrando el CV "before". Del clic al render pasaron 848 ms. | [O] `clickAt` y `frames` en `ours-log.json` |
| Flash | -88 → +60 | El portafolio completo es visible y luego se recorta. | [O] |
| Aparición | 0 → 460 | 7 cursores aparecen en sus chips: escala 0,6→1 en 220 ms, escalonados 40 ms. | [C] `:78` |
| Llegada | 260 → 1500 | El cursor k sale en `260 + k·260` y viaja 460 ms en línea recta hacia la esquina superior izquierda del bloque. | [C] `:89-94` |
| Gesto y construcción | 720 → 2180 | En `t0 + 460`, la selección crece 380 ms mientras el cursor arrastra a la esquina inferior derecha. La máscara del bloque baja de `draw + 220` a `draw + 680`. La selección se desvanece en `draw + 640`. | [C] `:100-104` |
| Cursores sobrantes | 300 → 1540 | Los 3 cursores sin bloque viajan 900 ms a puntos fijos del canvas y se quedan quietos. | [C] `:108-110` |
| Asentamiento | 2180 → 2700 | No hay asentamiento como tal: los cursores quedan detenidos unos 500 ms, se apagan (300 ms, desde `end - 200 + i·20`) y luego se desmonta. | [C] `:112-116` |

Total: **~2,7 s** de swarm, más ~0,85 s de lectura.

**El Reel 5.** Composición GSAP de 16 s [C] `r5-vision-swarm.html`.

| Fase | ms | Qué pasa | Evidencia |
|---|---|---|---|
| Vacío | 0 → 1450 | Página en blanco; el caret parpadea dos veces (200 y 750 ms). El cursor guía llega en 650 ms con `power3.out`, hace clic en 1350 (presión 70 ms + 160 ms, onda de 550 ms) y el caret colapsa. | [C] `:150-157`, [O] `reel5-t1.jpg` |
| Llegada | 1450 → 2430 | 29 cursores entran desde fuera del cuadro, escalonados 35 ms, 700 ms cada uno con `power3.out`, hasta un anillo alrededor del centro. | [C] `:160-164`, [O] `reel5-t1_9.jpg` |
| Construcción A | 2400 → 5300 | Ver la lista debajo de la tabla. | [C] `:168-197`, [O] `reel5-t3_6.jpg`, `reel5-t4_8.jpg` |
| Construcción B | 5300 → 7500 | Ver la lista debajo de la tabla. | [C] `:200-220`, [O] `reel5-t6_6.jpg` |
| Construcción C | 7500 → 9250 | Ver la lista debajo de la tabla. | [C] `:223-240`, [O] `reel5-t8_6.jpg` |
| Asentamiento | 9250 → 10400 | La cámara se aleja a 0,9 (750 ms); los cursores "revolotean" sobre 14 puntos y uno de cada tres hace clic. | [C] `:243-250`, [O] `reel5-t9_8.jpg` |
| Revelación | 10400 → 11750 | La página se escala a 0,62 y se desvanece (550 ms). Los cursores convergen sobre el contorno de la N (850 ms, `power3.inOut`, ordenados por ángulo para no cruzarse). La noche entra con una cortina circular en 11050. | [C] `:265-276`, [O] `reel5-t11_2.jpg` |
| Cierre | 11750 → 16000 | Aparece la N; el enjambre se dispersa 900 px; entran la palabra y la línea; un último clic del guía en 13750 vuelve rosa "visión". | [C] `:277-296`, [O] `reel5-t12_8.jpg` |

Detalle de las tres fases de construcción del Reel 5:
- **A, nav y titular (2400 → 5300).** La cámara hace zoom a 1,2 con −1,6°. La nav se dibuja como marco (450 ms). El logo se escribe a 22 cps con I-beam. Tres links y una píldora entran con `back.out(2.2)` tras un clic con onda. Se trazan guías vertical y horizontal (500 ms). El titular se escribe a 15 y 11 cps. Tres barras de texto se arrastran (420 ms). El CTA se dibuja como marco y recibe un clic.
- **B, imagen y código (5300 → 7500).** La cámara salta con +1,3°. La imagen se dibuja como marco y su arte se descubre de izquierda a derecha detrás de un cursor (550 ms). Se dibuja el panel de código y sus 3 líneas se escriben a 44 cps. Entran la muestra de color y "Aa".
- **C, tarjetas (7500 → 9250).** Se escribe el rótulo a 34 cps. Tres tarjetas se dibujan como marco (400 ms, escalonadas 80 ms). Un clic en cada una la levanta 10 px.

Además, los huecos de más de 750 ms se llenan con saltos inquietos de 420 ms (`sine.inOut`, ±60 px, derivando hacia el siguiente objetivo) [C] `:69-83`.

**Comparación por fase**

| Fase | El nuestro | Reel 5 |
|---|---|---|
| Vacío | No hay vacío: hay flash, y el intro y la barra ya están ahí. | Vacío de 1,45 s con un acto que lo rompe (el clic). |
| Llegada | Desde los chips del rail, que tiene sentido de origen. | Desde fuera del cuadro. |
| Construcción | ~1,5 s, 4 contactos. | 6,85 s, unos 26 contactos constructivos. |
| Asentamiento | Ninguno (~0,5 s quieto). | 1,15 s. |
| Revelación | No hay segunda transformación. | La página se convierte en marca. |

---

## 3. Causa → efecto: ¿cada contacto cambia visiblemente el elemento?

### El nuestro: no construye, descubre

- **Selección.** Una caja de 2 px en cobalto, radio 6, relleno al 5 %, sin tiradores ni medidas [C] `studio2.module.css:507-514`. Crece de 0 al tamaño del bloque mientras el cursor va de la esquina superior izquierda a la inferior derecha [C] `Swarm.tsx:94-102`.
- **Efecto.** El bloque ya existe completo. Solo se le quita un `clip-path: inset(0 0 100% 0)` de arriba abajo [C] `:61, :103`.
  - El borrado empieza 220 ms después de iniciado el arrastre y termina 300 ms después de que el cursor ya se detuvo [C] `:101-103`.
  - [O] En `ours-frame-04.jpg` el titular aparece cortado a media línea dentro de su caja mientras el cursor está quieto en la esquina.
  - **La máscara no sigue al cursor:** sigue al reloj.
- **Arrastre.** Solo dibuja la caja; no mueve nada.
- **Redimensionar.** No existe.
- **Escribir.** No existe: ni I-beam ni texto letra a letra.
- **Clic.** No existe: ni presión, ni onda, ni "pop".
- **Guías y medidas.** No existen.
- **Procedencia.** La etiqueta del cursor no tiene relación con lo que construye.
  - El cursor `NOTES.md` dibuja el nombre y `PR-12.md` el titular, por orden de índice [C] `:91`.
  - El cursor sobrante `contributors` se estaciona encima de "Okafor" durante ~2 s y tapa el h1 [O] (`ours-frame-04.jpg`, `ours-frame-07.jpg`, destino calculado en [C] `:109`).
  - Para un producto cuya promesa es "cada frase con su archivo", esta es la oportunidad perdida más grande: el swarm podría mostrar la procedencia y no la muestra.

### Reel 5: cada contacto crea DOM

- **`frame()`** [C] `:117-128`: el cursor arrastra una selección con 4 tiradores [C] `:16-17`. El elemento aparece debajo justo al soltar (opacidad, 220 ms) y la selección se va 150 ms después.
- **`typeIn()`** [C] `:130-139`: el cursor cambia a I-beam [C] `:95-100`. El texto se escribe carácter a carácter con el cursor viajando a la par (`ease: 'none'`, duración = longitud ÷ cps).
- **`pop()`** [C] `:141-147`: presión de 70 ms, onda, y el elemento entra de escala 0,5 a 1 con `back.out(2.2)`.
- **Guías y barras** [C] `:175-195`: la línea crece exactamente detrás de la punta del cursor (misma duración y easing).
- **El arte de la imagen** [C] `:206-208` se descubre de izquierda a derecha con el cursor encima del borde.
- Unos 26 contactos constructivos en 6,85 s; cada uno deja algo que antes no estaba.

### Swarm de Califa: construcción tipo editor [O, solo comportamiento]

- **Antes de hacer scroll**, los cursores orbitan alrededor del logo y nada se construye en 14 s, ni con un clic.
- **Al hacer scroll**, la página aparece **en construcción**:
  - reglas superior e izquierda con valores en px;
  - guías rojas sólidas y azules punteadas que cruzan el lienzo;
  - insignias de tamaño durante el dibujo ("580 × 86", "440 × 86", "136 × 40");
  - cursores en cruz (+) antes de dibujar una caja;
  - I-beam escribiendo texto parcial con su caret. El `innerText` capturado lo confirma: "Run a thousan", "Produc", "routed|".
  - cajas de texto con contorno mientras se escriben;
  - selecciones sobre líneas de un panel de código.
- [H] No determiné si la construcción avanza ligada al scroll o con su propio tiempo una vez disparada.
- Los cuadros quedaron fuera del repo (scratchpad) por no tener licencia; aquí solo se describe la conducta.

### Lunaria Atelier [descrito por el dueño, no observado]

Reconstruye el DOM de la página desde cero:
- cajas dibujadas con cursor en cruz,
- texto tecleado,
- herramienta pluma,
- reglas,
- elementos llevados a su sitio con alt-arrastre.

No adivino más detalles hasta tener la referencia.

### Conclusión

Califa y Lunaria comparten la gramática del Reel 5: el gesto **es** la causa del elemento, y el estado intermedio (texto a medias, caja sin contenido, guía a medio trazar) se ve. El nuestro solo tiene la primera mitad del gesto (la caja), y su efecto es una cortina temporizada sobre un resultado que ya existía.

---

## 4. Trayectorias, easing, pausas, densidad, roles, escala y contraste

**Trayectorias [C]**

| | El nuestro | Reel 5 |
|---|---|---|
| Forma | Recta, de punto a punto (WAAPI `translate`) [C] `Swarm.tsx:82-87`. | Recta con huecos rellenos de saltos aleatorios (±60 px) que derivan hacia el destino [C] `:72-79`. Se lee como orgánica. |
| Duración | Fija: 460 ms de llegada y 380 ms de arrastre, sea cual sea la distancia (del rail al índice hay ~700 px; del rail al nombre ~300). [H] Los cursores lejanos parecen apurados y los cercanos lentos. | Fija por gesto (0,26 a 0,7 s), con la aproximación calculada hacia atrás desde el contacto (`approach`). |

**Easing**

- **El nuestro:** una sola curva, `cubic-bezier(0.22, 1, 0.36, 1)` (salida muy fuerte), para todo [C] `:8`. No hay anticipación, rebote ni presión.
- **Reel 5:** varias curvas según el gesto [C]:
  - `power3.out` para llegar;
  - `power2.inOut` para arrastrar;
  - `none` para escribir (velocidad constante, como en la vida real);
  - `back.out(2.2)` para los pops;
  - `sine.inOut` para los saltos.

**Pausas**

- **El nuestro:** ninguna antes del contacto. El cursor llega y en ese mismo ms empieza a arrastrar (`draw = t0 + 460`) [C] `:94-102`. Al final queda ~0,5 s inmóvil, sin intención [C] `:112`.
- **Reel 5:** la aproximación termina 20 ms antes del contacto [C] `:118`, y los saltos mantienen vivo a cada cursor entre tareas.

**Densidad**

| | El nuestro | Reel 5 |
|---|---|---|
| Cursores | 7, de los cuales 4 trabajan y 3 vagan [O]; en el replay desplazado, 6 con 2 trabajando [O]. | 30 [C] `:102-108`. |
| Área | 1092x836 px de canvas [O]. | 1080x1920. |
| Contactos | ~2,7 por segundo. | ~3,8 por segundo. |
| Cursor a la vez | Uno por bloque. | Varios a la vez sobre zonas distintas: la cámara reparte la atención. |

**Roles y etiquetas**

- **El nuestro:** nombres de archivo base [C] `StudioApp.tsx:209`, en mono de 11 px [C] `studio2.module.css:494-505`. Tienen dos problemas:
  - se repiten (`NOTES.md` dos veces) [O];
  - no dicen qué hace cada cursor ni por qué toca ese bloque.
  - Aun así, es el material correcto: no son agentes inventados.
- **Reel 5:** roles de oficio ("diseño", "código", "marca", "tipo", "datos", "ux", "copy", "color", "ideas"), solo en 9 de 30 cursores; el resto va sin etiqueta para no saturar [C] `:102-107`.

**Escala**

| | El nuestro | Reel 5 |
|---|---|---|
| Flecha | 24x34 px [C] `Swarm.tsx:73`: 1,7 % del ancho a 1440 y 1,9 % a 1280. | 48x70 en un cuadro de 1080 de ancho [C] `:62`: 4,4 % del ancho. |
| Etiqueta | 11 px. [H] En el proyector de 1280x720 de la demo apenas se lee. | 19 px, en negrita 600, con tracking [C] `:20`. |
| Selección | 2 px, sin tiradores. | 2,5 px, con tiradores de 13 px [C] `:16-17`. |

**Contraste [O]**

- Los cursores son cobalto `#2747e8`, tinta `#0e1116` o gris `#4a5160` [C] `Swarm.tsx:7`, con trazo blanco y sombra [C] `studio2.module.css:489-492`. Se leen bien sobre el papel.
- Las etiquetas llevan texto blanco sobre esos colores, con contraste suficiente.
- El relleno de la selección (5 %) casi no se ve; el borde sí.
- **El problema es de oclusión, no de contraste:** cursores y etiquetas quietos encima del texto que se acaba de revelar [O].

---

## 5. Grado de transformación antes → después

**El nuestro**

- **Antes real del producto:** el panel del CV, "This is all a reader gets today." [C] `StudioApp.tsx:300-304`.
- **Al hacer clic:** el CV desaparece sin transición y lo reemplaza el portafolio. Ese cambio, que es el de verdad (de un CV de afirmaciones a un portafolio con pruebas), **no se anima**.
- **Lo que el swarm anima:** el paso de "canvas casi vacío" (barra e intro ya visibles) a "el mismo portafolio" [O] (`ours-frame-00.jpg` → `ours-frame-07.jpg`).
- **Cambia** solo la visibilidad de 4 bloques del pliegue superior.
- **No cambian** el layout, los datos ni el estado.
- Resumen: una transformación de visibilidad, que además ocurre después de haber mostrado el resultado (flash).

**Reel 5**

- Página en blanco con caret → página completa (nav, titular, cuerpo, CTA, imagen, código, muestras, tarjetas).
- Luego, una segunda transformación: la página se abstrae en la marca N y la línea final.
- Construcción del 100 % del contenido visible, más un cierre conceptual.

**Califa y Lunaria:** construcción del 100 % desde cero, con los andamios visibles (reglas, guías, medidas).

---

## 6. Propuesta priorizada

**Restricciones de la propuesta**

- Es una secuencia de construcción diseñada, coreografiada como datos (estilo Remotion: una función pura del tiempo, que se puede buscar y probar).
- Se presenta siempre como ilustración: se mantiene el caption "Illustration…" y **Skip**.
- Sin 3D y sin agentes falsos: cada cursor es un archivo real leído.
- Nada se copia de Califa: se toma la gramática (caja, medida, escribir, alt-arrastre, guía), que es de uso común en editores.

### P0. Corregir lo que hoy se ve mal (pequeño; no cambia el concepto)

1. **Eliminar el flash de 60 a 88 ms [O].** El estado oculto debe existir antes del primer paint del portafolio construido. Opciones [H]:
   - que el componente del portafolio nazca oculto cuando hay `pendingReveal`;
   - o aplicar el recorte en un efecto de layout, antes del paint.
2. **Cubrir o excluir de forma coherente lo que hoy flota.** El intro [C] `Portfolio.tsx:117` y la barra superior [C] `:91` deben entrar en la coreografía o quedar visibles a propósito desde el principio, como "lo que ya había".
3. **No estacionar cursores sobre el texto [O].** Los sobrantes no deberían existir (ver P1). Si existen, deben volver a su chip o salir del canvas.
4. **Scroll durante el swarm [H].** Hay dos caminos:
   - bloquear el scroll del canvas mientras dura (~3 a 5 s, con Skip disponible);
   - o poner el overlay dentro del canvas, en coordenadas de contenido, en vez de fijo al viewport.
5. **Bloques fuera de pantalla [O, H].** Elegir solo objetivos enteros dentro del canvas, o recortar el arrastre al borde visible.
6. **Movimiento reducido.** No montar el overlay ni el caption. Hoy viven un cuadro [O].

### P1. Hacer que cada contacto cause su efecto: la secuencia diseñada

**Narrativa:** del CV al portafolio con pruebas. Empieza en el panel "before", que ya es el antes del producto.

**Total: ~4,8 s.** Es un momento de la app, no un reel; Skip está disponible desde el ms 0.

| ms | Gesto (causa) | Efecto visible | Etiqueta del cursor (dato real) |
|---|---|---|---|
| 0 → 400 | Los chips leídos se encienden y de cada uno sale su cursor, en arco y escalonado 30 ms. | El rail se vuelve la fuente. | El archivo del chip, con proyecto: `kerf/commits`, `tidepool/PR-12.md`. |
| 400 → 1100 | Un cursor selecciona la línea del CV "Kerf. Maintainer." (caja con tiradores). | La línea queda marcada. | `kerf/commits` |
| 1100 → 1700 | La tacha (trazo que sigue a la punta) y escribe debajo, con I-beam a ~30 cps: "Runs Kerf's docs and release process". | Texto nuevo letra a letra. | `kerf/RELEASING.md` |
| 1700 → 2000 | Alt-arrastre: la línea nueva se duplica como fantasma y viaja a su lugar en el portafolio, con una guía roja al alinearse. | El CV se pliega y se abre el lienzo del portafolio. | — |
| 2000 → 2600 | Cursor en cruz: dibuja la caja del nombre con insignia "W × H" y escribe "Rin Okafor". | El h1 existe porque se escribió. | `tidepool/README.md` |
| 2300 → 3100 | En paralelo, otro cursor escribe el titular. | El titular a medio escribir es visible. | El archivo de la afirmación del titular, sacado de sus evidencias. |
| 2700 → 3500 | Tres clics, uno por proyecto, sobre el índice. Cada fila "pop" con `back.out` y onda; el cursor viene de los chips de **ese** proyecto. | Aparecen Tidepool, Quietroom y Kerf. | El archivo con más citas de cada proyecto. |
| 3500 → 4100 | Un cursor arrastra una regla bajo los datos (Role, Location, Record). Las filas entran con alt-arrastre y encajan en la guía. | Hechos alineados. | `cv.md` → solo lo que respaldan los archivos. |
| 4100 → 4800 | Asentamiento: los cursores vuelven en arco a sus chips y cada chip usado queda con una marca de "citado". Las guías se apagan. | El rail muestra qué se usó. | — |

**Reglas de movimiento** (inspiradas en el Reel 5, no copiadas):
- Duración según la distancia: `250 + 0,35 ms/px`, limitada a 300–700 ms.
- Trayectoria en arco suave (punto de control desplazado 8–12 % de la distancia).
- Aproximación con `power3.out`, arrastre con `power2.inOut`, escritura lineal.
- Pausa de 80 a 120 ms antes de cada contacto; presión de escala 0,85 durante 70 ms.
- Saltos de 300 a 400 ms solo si un cursor espera más de 600 ms.

**Densidad:** de 8 a 10 cursores, **todos con tarea**. Fuera los cursores que vagan. Como mucho tres activos a la vez, en zonas distintas.

**Escala para el proyector de 1280x720:**
- flecha de 30 a 32 px;
- etiqueta de 12 a 13 px en mono 600;
- selección de 2 px con tiradores de 8 px e insignia de medidas.

**Procedencia, lo que nos distingue del Reel 5:** cada etiqueta sale de las evidencias de la afirmación que se construye (archivo y línea). Así el swarm demuestra la promesa del producto en lugar de decorarla. Es un dato real, no un agente.

**Implementación [H]:** un guion declarativo, por ejemplo `[{ t, cursor, action: 'select'|'type'|'draw'|'altDrag'|'click', target, text }]`, interpretado por un único reloj (rAF o WAAPI con `currentTime`).
- Se puede buscar por tiempo, lo que sirve para capturas y tests (por ejemplo, un atributo `data-swarm-phase`).
- Respeta el movimiento reducido saltando al final.
- No necesita dependencias nuevas, aunque GSAP también serviría.

### P2. Pulido

- Un "camera pull" opcional: un desplazamiento suave del canvas hasta los proyectos al final, sin rotación ni 3D, solo si cabe en el tiempo.
- La segunda transformación del Reel 5 (de la página a la marca) **no** aplica a una app. El equivalente útil es el cierre en el rail (los chips citados).
- Un test e2e que busque tiempos clave y compare capturas, apoyado en el guion determinista.

---

## Lo que no pude verificar

- El flash visto cuadro a cuadro en el video. Está medido por el probe, no inspeccionado en el webm.
- El desalineamiento al hacer scroll durante el swarm. Es una hipótesis desde el código.
- Cómo se dispara la construcción de Califa (¿ligada al scroll o con tiempo propio?).
- Todo lo de Lunaria Atelier. Pendiente de la referencia.

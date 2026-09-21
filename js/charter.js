function inicializarWorkspace() {
    document.getElementById("main-menu").classList.add("hidden");
    document.getElementById("editor-workspace").classList.add("active");
    
    document.getElementById("editor-workspace").offsetHeight;

    let intentos = 0;
    let chequearAltura = setInterval(() => {
        if (document.getElementById("scroll-workspace").clientHeight > 0 || intentos > 15) {
            clearInterval(chequearAltura); 
            actualizarAlturaScroll();
            reposicionarScroll();
            aplicarMuteEstadosUI();
            
            // Empujoncito extra para forzar a la pantalla a dibujarse
            setTimeout(actualizarWaveforms, 150);
        }
        intentos++;
    }, 20); 
}

function asegurarDificultadesChart(chart) {
    const nombres = ["hard", "normal", "easy"];
    const tieneMapaDeDificultades = chart.difficulties && typeof chart.difficulties === "object" && !Array.isArray(chart.difficulties);
    if (!tieneMapaDeDificultades) {
        chart.difficulties = {};
        chart.difficulties.normal = {
            notes: chart.notes && typeof chart.notes === "object" ? chart.notes : {},
            events: chart.events && typeof chart.events === "object" ? chart.events : {}
        };
        chart.difficulties.hard = { notes: {}, events: {} };
        chart.difficulties.easy = { notes: {}, events: {} };
    }
    Object.keys(chart.difficulties).forEach((nombre) => {
        chart.difficulties[nombre].notes ||= {};
        chart.difficulties[nombre].events ||= {};
    });
    chart.activeDifficulty = chart.difficulties[chart.activeDifficulty] ? chart.activeDifficulty : (chart.difficulties.normal ? "normal" : Object.keys(chart.difficulties)[0]);
    dificultadActiva = chart.activeDifficulty;
    chart.notes = chart.difficulties[dificultadActiva].notes;
    chart.events = chart.difficulties[dificultadActiva].events;
    actualizarIndicadorDificultad();
}

function guardarDificultadActiva() {
    if (!currentChartData || !dificultadActiva) return;
    if (!currentChartData.difficulties || typeof currentChartData.difficulties !== "object") currentChartData.difficulties = {};
    currentChartData.difficulties[dificultadActiva] = {
        notes: currentChartData.notes || {},
        events: currentChartData.events || {}
    };
}

function actualizarListaDificultades() {
    const lista = document.getElementById("difficulty-list");
    if (!lista || !currentChartData) return;
    lista.innerHTML = ["hard", "normal", "easy"].map((nombre) => {
        const existe = Boolean(currentChartData.difficulties?.[nombre]);
        const activo = nombre === dificultadActiva;
        return `<button class="difficulty-card ${activo ? "active" : ""} ${existe ? "" : "missing"}" type="button" ${existe ? `onclick="cambiarDificultad('${nombre}')"` : "disabled"}>
            <strong>${nombre.toUpperCase()}</strong><small>${existe ? "Disponible" : "Faltante"}</small>
        </button>`;
    }).join("");
}

function cambiarDificultad(nombre) {
    if (!currentChartData) return;
    if (!currentChartData.difficulties[nombre] || nombre === dificultadActiva) return;
    guardarDificultadActiva();
    dificultadActiva = nombre;
    currentChartData.activeDifficulty = nombre;
    currentChartData.notes = currentChartData.difficulties[nombre].notes;
    currentChartData.events = currentChartData.difficulties[nombre].events;
    notaSeleccionada = null;
    deseleccionarEventoActual();
    generarEstructuraGrilla(currentChartData.totalRows);
    pintarNotasActuales();
    pintarEventosActuales();
    actualizarListaDificultades();
    actualizarIndicadorDificultad();
}

function cambiarDificultadSiguiente() {
    const orden = ["normal", "hard", "easy"];
    const indice = orden.indexOf(dificultadActiva);
    cambiarDificultad(orden[(indice + 1) % orden.length]);
}

function actualizarIndicadorDificultad() {
    const indicador = document.getElementById("display-song-difficulty");
    if (indicador) indicador.innerText = dificultadActiva.toUpperCase();
}

function abrirVentanaDificultad() {
    const ventana = document.getElementById("difficulty-window");
    const wrapper = document.getElementById("menu-windows-wrapper");
    if (!ventana) return;
    ventana.classList.add("active");
    ventana.classList.remove("minimized");
    ventana.setAttribute("aria-hidden", "false");
    actualizarListaDificultades();
    if (wrapper) wrapper.classList.remove("open");
}

function cerrarVentanaDificultad() {
    const ventana = document.getElementById("difficulty-window");
    if (!ventana) return;
    ventana.classList.remove("active");
    ventana.setAttribute("aria-hidden", "true");
}

function alternarMinimizarDificultad() {
    const ventana = document.getElementById("difficulty-window");
    const boton = ventana?.querySelector(".floating-window-minimize i");
    if (!ventana) return;
    ventana.classList.toggle("minimized");
    if (boton) boton.className = ventana.classList.contains("minimized") ? "fa-solid fa-square-plus" : "fa-solid fa-minus";
}

function quitarDificultadActiva() {
    if (!currentChartData) return;
    const disponibles = ["hard", "normal", "easy"].filter((nombre) => currentChartData.difficulties[nombre]);
    if (disponibles.length <= 1) return;
    delete currentChartData.difficulties[dificultadActiva];
    const siguiente = disponibles.find((nombre) => nombre !== dificultadActiva) || "normal";
    dificultadActiva = siguiente;
    currentChartData.activeDifficulty = siguiente;
    currentChartData.notes = currentChartData.difficulties[siguiente].notes;
    currentChartData.events = currentChartData.difficulties[siguiente].events;
    generarEstructuraGrilla(currentChartData.totalRows);
    pintarNotasActuales();
    pintarEventosActuales();
    actualizarListaDificultades();
    actualizarIndicadorDificultad();
}

function restaurarDificultadesFaltantes() {
    if (!currentChartData) return;
    if (!currentChartData.difficulties || typeof currentChartData.difficulties !== "object") currentChartData.difficulties = {};
    ["hard", "normal", "easy"].forEach((nombre) => {
        if (!currentChartData.difficulties[nombre]) currentChartData.difficulties[nombre] = { notes: {}, events: {} };
    });
    actualizarListaDificultades();
}
 
function actualizarAlturaScroll() {
    const workspace = document.getElementById("scroll-workspace");
    if (!currentChartData || workspace.clientHeight === 0) return;
    const totalHeightPx = currentChartData.totalRows * alturaCelda;
    const scaledGridHeight = totalHeightPx * globalZoomFactor;
    const H = workspace.clientHeight;
    
    let inner = document.getElementById("scroll-inner");
    inner.style.height = scaledGridHeight + H + "px";
    
    const grilla = document.getElementById("grilla-dinamica-container");
    grilla.style.position = "absolute";
    grilla.style.top = H / 2 + "px";
    grilla.style.left = "50%";
    grilla.style.transformOrigin = "top center";
    grilla.style.transform = `translateX(-50%) scale(${globalZoomFactor})`;
    
    const labels = document.getElementById("lane-labels-wrapper");
    if (labels) labels.style.width = 360 * globalZoomFactor + "px";
    
    const canvas = document.getElementById("wave-canvas");
    if (canvas) {
        canvas.width = 360 * globalZoomFactor;
        canvas.height = H;
        canvas.style.width = 360 * globalZoomFactor + "px";
    }
    programarRenderNotas();
}

// ============================================================================
// GRILLA VIRTUALIZADA
// Las celdas son simples <div> de fondo: se crean solo cerca del viewport
// (ventana con margen) y se reciclan cuando quedan lejos. La interacción se
// maneja por delegación de eventos en el contenedor, así que no hay un
// listener por celda. Las NOTAS no viven en el DOM: se dibujan en un canvas
// superpuesto (ver RENDER DE NOTAS EN CANVAS).
// ============================================================================

let grillaDOM = { filas: 0, celdas: {}, celdasEvento: {} };
const VENTANA_CELDAS = 24;   // filas extra creadas alrededor del viewport
const VENTANA_RECICLAJE = 60; // filas de distancia a partir de las cuales se recicla una celda

function generarEstructuraGrilla(filas) {
    const jugador = document.getElementById("cols-jugador");
    const oponente = document.getElementById("cols-oponente");
    const events = document.getElementById("cols-events");
    jugador.innerHTML = "";
    oponente.innerHTML = "";
    events.innerHTML = "";

    grillaDOM = { filas: filas, celdas: {}, celdasEvento: {} };

    // Las mitades solo definen el ancho del contenedor (spacers); las celdas
    // se colocan ABSOLUTAS sobre el contenedor en su coordenada lógica, así
    // que su posición no depende del orden de creación ni del empaquetado.
    jugador.style.width = 4 * 45 + "px";
    oponente.style.width = 4 * 45 + "px";
    events.style.width = 45 + "px";

    const cont = document.getElementById("grilla-dinamica-container");
    if (cont) {
        // Limpia celdas/separadores del chart anterior (viven en el contenedor,
        // no en las mitades que acabamos de vaciar).
        cont.querySelectorAll(".grid-cell").forEach((n) => n.remove());
        cont.style.height = filas * alturaCelda + "px";
        // Separadores verticales entre las 9 columnas (8 líneas, no una por celda).
        for (let i = 0; i < 8; i++) {
            const sep = document.createElement("div");
            sep.className = "grid-cell cell-sep";
            sep.style.cssText = `top:0;height:100%;left:${i * 45 + 45}px;width:0;pointer-events:none;`;
            cont.appendChild(sep);
        }
        // Delegación de clicks: un solo listener para toda la grilla.
        if (!cont.dataset.delegado) {
            cont.dataset.delegado = "1";
            cont.addEventListener("click", delegarClickGrilla);
        }
    }
}

// Posición visual de una columna lógica: el layout es [oponente 4-7][jugador 0-3][eventos].
function posVisualDeCol(c) { return c < 4 ? c + 4 : c - 4; }

function crearClaseCelda(f, c) {
    let cls = "grid-cell";
    if (f % 4 === 0) cls += " beat-line";
    if (f % 16 === 0) cls += " measure-line";
    if ((c % 4 + f) % 2 === 1) cls += " cell-alt";
    return cls;
}

function asegurarCelda(f, c) {
    const key = f + "-" + c;
    const existente = grillaDOM.celdas[key];
    if (existente && existente.isConnected) return existente;
    const cont = document.getElementById("grilla-dinamica-container");
    if (!cont) return null;
    const cell = document.createElement("div");
    cell.className = crearClaseCelda(f, c);
    cell.style.cssText = `position:absolute;top:${f * alturaCelda}px;left:${posVisualDeCol(c) * 45}px;`;
    cell.dataset.f = f;
    cell.dataset.c = c;
    cont.appendChild(cell);
    grillaDOM.celdas[key] = cell;
    return cell;
}

function asegurarCeldaEvento(f) {
    const existente = grillaDOM.celdasEvento[f];
    if (existente && existente.isConnected) return existente;
    const cont = document.getElementById("grilla-dinamica-container");
    if (!cont) return null;
    const cell = document.createElement("div");
    cell.className = crearClaseCelda(f, 8) + " cell-evento";
    cell.style.cssText = `position:absolute;top:${f * alturaCelda}px;left:${8 * 45}px;`;
    cell.dataset.f = f;
    cell.dataset.evento = "1";
    cont.appendChild(cell);
    grillaDOM.celdasEvento[f] = cell;
    // Si la fila ya tiene evento, restaura el icono al (re)crear la celda.
    if (currentChartData?.events?.[f]) {
        const icon = document.createElement("img");
        icon.className = "event-note-icon";
        icon.src = "eventassets/FocusCamera.png";
        icon.alt = "Focus Camera";
        cell.appendChild(icon);
    }
    return cell;
}

// Crea las celdas visibles (con margen) y recicla las que quedaron lejos.
function sincronizarCeldasVisibles() {
    const filas = grillaDOM.filas;
    if (!filas) return;
    const rango = rangoFilasVisibles();
    if (!rango) return;
    const desde = Math.max(0, rango.desde - VENTANA_CELDAS);
    const hasta = Math.min(filas - 1, rango.hasta + VENTANA_CELDAS);

    for (let f = desde; f <= hasta; f++) {
        for (let c = 0; c < 8; c++) asegurarCelda(f, c);
        asegurarCeldaEvento(f);
    }

    const limiteInf = rango.desde - VENTANA_RECICLAJE;
    const limiteSup = rango.hasta + VENTANA_RECICLAJE;
    for (const key in grillaDOM.celdas) {
        const f = grillaDOM.celdas[key].dataset.f | 0;
        if (f < limiteInf || f > limiteSup) {
            grillaDOM.celdas[key].remove();
            delete grillaDOM.celdas[key];
        }
    }
    for (const f in grillaDOM.celdasEvento) {
        if (f < limiteInf || f > limiteSup) {
            grillaDOM.celdasEvento[f].remove();
            delete grillaDOM.celdasEvento[f];
        }
    }
}

// Delegación: un solo listener para toda la grilla en lugar de uno por celda.
function delegarClickGrilla(e) {
    const cell = e.target.closest(".grid-cell");
    if (!cell || !currentChartData) return;
    if (cell.dataset.evento) {
        manejarClickCeldaEvento(e, parseInt(cell.dataset.f, 10), cell);
    } else {
        manejarClickCelda(e, parseInt(cell.dataset.f, 10), parseInt(cell.dataset.c, 10), cell);
    }
}

// ============================================================================
// RENDER DE NOTAS EN CANVAS (virtualizado)
// Las notas y sustains se dibujan en un canvas superpuesto a la grilla usando
// únicamente las notas dentro del viewport. El índice ordenado permite
// encontrarlas con búsqueda binaria en O(log N) sin recorrer todo el chart.
// ============================================================================

let notasCanvas = null;
let notasCanvasCtx = null;
let notasIdx = null;         // [{fila, col, len}] ordenado por fila
let notasDirty = true;       // el índice hay que reconstruirlo
let renderNotasPendiente = false;
const ESCALA_CALIDAD = 2;    // render a 2x para que no se vea borroso con zoom
const COLORES_NOTA = ["#C24B99", "#00FFFF", "#12FA05", "#F9393F"];
const notasImgCache = {};

function imagenNota(col) {
    const tipo = col % 4;
    if (!notasImgCache[tipo]) {
        const img = new Image();
        img.src = ["noteassets/purple0000.png", "noteassets/blue0000.png", "noteassets/green0000.png", "noteassets/red0000.png"][tipo];
        notasImgCache[tipo] = img;
    }
    return notasImgCache[tipo];
}

function construirIndiceNotas() {
    notasIdx = [];
    const notes = currentChartData && currentChartData.notes;
    if (notes) {
        for (const key in notes) {
            const parts = key.split("-");
            const fila = parseInt(parts[0], 10);
            const col = parseInt(parts[1], 10);
            if (Number.isNaN(fila) || Number.isNaN(col)) continue;
            notasIdx.push({ fila: fila, col: col, len: Math.max(0, notes[key].len | 0), tMs: typeof notes[key].t === "number" ? notes[key].t : null });
        }
        notasIdx.sort((a, b) => a.fila - b.fila || a.col - b.col);
    }
    notasDirty = false;
}

function limiteInferiorFila(fila) {
    let low = 0, high = notasIdx.length;
    while (low < high) {
        const mid = (low + high) >>> 1;
        if (notasIdx[mid].fila < fila) low = mid + 1;
        else high = mid;
    }
    return low;
}

function rangoFilasVisibles() {
    const ws = document.getElementById("scroll-workspace");
    if (!ws || ws.clientHeight === 0) return null;
    const zoom = globalZoomFactor || 1;
    // La grilla arranca a H/2 del viewport (gridTop), no en su borde
    // superior: sin ese offset el rango sale desplazado ~12 filas.
    const H = ws.clientHeight;
    const top = (ws.scrollTop - H / 2) / zoom;
    const alto = H / zoom;
    return {
        desde: Math.floor(top / alturaCelda) - 1,
        hasta: Math.ceil((top + alto) / alturaCelda) + 1
    };
}

// El canvas de notas es del tamaño del VIEWPORT (capa fija sobre el
// workspace), no de la grilla completa: así nunca excede los límites de
// canvas del navegador y el costo de memoria/redibujado es constante.
function asegurarCanvasNotas() {
    const ws = document.getElementById("scroll-workspace");
    const columna = document.querySelector(".editor-center-column");
    if (!ws || !columna) return;
    if (!notasCanvas) {
        notasCanvas = document.createElement("canvas");
        notasCanvas.id = "notas-canvas";
        notasCanvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:3;pointer-events:none;";
        columna.appendChild(notasCanvas);
        notasCanvasCtx = notasCanvas.getContext("2d");
    }
    const w = ws.clientWidth, h = ws.clientHeight;
    if (w && h && (notasCanvas.width !== w * ESCALA_CALIDAD || notasCanvas.height !== h * ESCALA_CALIDAD)) {
        notasCanvas.width = w * ESCALA_CALIDAD;
        notasCanvas.height = h * ESCALA_CALIDAD;
    }
}

// LECTURA de posición grilla→canvas. Llamar SIEMPRE antes de mutar el DOM:
// leer tras una mutación fuerza un recálculo de layout carísimo en charts
// largos (scroll-inner puede medir cientos de miles de px).
function medirPosicionNotas() {
    if (!notasCanvas) return null;
    const canvasRect = notasCanvas.getBoundingClientRect();
    const z = globalZoomFactor || 1;
    // La verdad absoluta son las CELDAS DOM (lo que el usuario ve y clickea),
    // no el rect del contenedor: con translateX(-50%) + scale(z) el bounding
    // box del contenedor NO coincide con el borde de la columna visual 0 y
    // las notas quedaban desalineadas respecto a la grilla. Se mide desde una
    // celda real cercana al centro del canvas y se extrapola linealmente.
    sincronizarCeldasVisibles();
    const H = notasCanvas.height / ESCALA_CALIDAD;
    let mejor = null, mejorDist = Infinity;
    for (const key in grillaDOM.celdas) {
        const cell = grillaDOM.celdas[key];
        if (!cell.isConnected) continue;
        const r = cell.getBoundingClientRect();
        const dist = Math.abs(r.top + r.height / 2 - (canvasRect.top + H / 2));
        if (dist < mejorDist) {
            mejorDist = dist;
            mejor = { cell: r, f: cell.dataset.f | 0, c: cell.dataset.c | 0 };
        }
    }
    if (mejor) {
        return {
            offsetX: mejor.cell.left - canvasRect.left - posVisualDeCol(mejor.c) * 45 * z,
            offsetY: mejor.cell.top - canvasRect.top - mejor.f * alturaCelda * z,
            wsH: H
        };
    }
    // Respaldo (sin celdas): geometría teórica del contenedor.
    const cont = document.getElementById("grilla-dinamica-container");
    if (!cont) return null;
    const contRect = cont.getBoundingClientRect();
    return {
        offsetX: contRect.left - canvasRect.left,
        offsetY: contRect.top - canvasRect.top,
        wsH: H
    };
}

// Todas las pinturas de notas pasan por aquí: varios cambios en el mismo
// frame se agrupan en un solo redibujado (rAF + dirty flag). El orden dentro
// del callback importa: LECTURAS (scroll + rects) → MUTACIONES (celdas) →
// dibujo puro en canvas. Así nunca se lee layout recién mutado.
// Además hay un respaldo con setTimeout(50ms) por si el entorno nunca
// dispara rAF (webviews sin componer): en navegadores normales el rAF llega
// primero y el respaldo no hace nada.
function programarRenderNotas() {
    if (renderNotasPendiente) return;
    renderNotasPendiente = true;
    const ejecutar = () => {
        if (!renderNotasPendiente) return; // el rAF ya lo hizo
        renderNotasPendiente = false;
        const pos = medirPosicionNotas();
        sincronizarCeldasVisibles();
        dibujarNotas(null, pos);
    };
    requestAnimationFrame(ejecutar);
    setTimeout(ejecutar, 50);
}

function pintarNotasActuales() {
    notasDirty = true;
    asegurarCanvasNotas();
    sincronizarCeldasVisibles();
    programarRenderNotas();
}

function dibujarNotas(scrollTopPx, pos) {
    if (!currentChartData) return;
    asegurarCanvasNotas();
    if (!notasCanvas || grillaDOM.filas === 0) return;
    const z = globalZoomFactor || 1;
    const ctx = notasCanvasCtx;
    const W = notasCanvas.width / ESCALA_CALIDAD;
    const H = notasCanvas.height / ESCALA_CALIDAD;

    // Mapeo fila/col → píxeles del viewport. Si no llegó `pos` (llamada
    // directa), se mide aquí (una lectura de layout).
    if (!pos) pos = medirPosicionNotas();
    if (!pos) return;
    // pos.offsetY ya incluye gridTop y el scroll actual: de ahí se deduce
    // exactamente qué filas caen dentro del canvas.
    const desde = Math.max(0, Math.floor(-pos.offsetY / (alturaCelda * z)) - 1);
    const hasta = Math.min(grillaDOM.filas - 1, Math.ceil((-pos.offsetY + H) / (alturaCelda * z)) + 1);

    ctx.setTransform(ESCALA_CALIDAD, 0, 0, ESCALA_CALIDAD, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (hasta < desde) return;
    if (!notasIdx || notasDirty) construirIndiceNotas();

    const offsetX = pos.offsetX;
    const offsetY = pos.offsetY;
    const stepMs = (60 / (currentChartData.bpm || 120)) / 4 * 1000;
    const yDeFila = (fila) => offsetY + fila * alturaCelda * z;
    // Las notas importadas pueden llevar ms exactos (fuera de grilla): se
    // dibujan en su tiempo real, no en la fila cuantizada.
    const yDeNota = (n) => n.tMs != null ? offsetY + (n.tMs / stepMs) * alturaCelda * z : yDeFila(n.fila);
    const xDeCol = (col, offset) => offsetX + posVisualDeCol(col) * 45 * z + offset * z;

    let i = limiteInferiorFila(desde);
    // Los sustains que empiezan antes del viewport pero terminan dentro
    // también deben dibujarse: se retrocede mientras alcancen la ventana.
    while (i > 0 && notasIdx[i - 1].fila + notasIdx[i - 1].len >= desde) i--;

    for (; i < notasIdx.length && notasIdx[i].fila <= hasta; i++) {
        const n = notasIdx[i];
        if (n.len > 0) {
            // Solo la parte del sustain dentro del viewport se dibuja. Con ms
            // exactos el cuerpo arranca en el y real de la nota (el canvas
            // recorta lo que quede fuera); el borde inferior sigue siendo de fila.
            const filaBottom = Math.min(n.fila + n.len, hasta + 1);
            const cuerpoTop = yDeNota(n) + 22 * z;
            const cuerpoBottom = yDeFila(filaBottom);
            if (cuerpoBottom > cuerpoTop) {
                ctx.fillStyle = COLORES_NOTA[n.col % 4];
                ctx.globalAlpha = 0.9;
                ctx.fillRect(xDeCol(n.col, 14.5), cuerpoTop, 16 * z, cuerpoBottom - cuerpoTop);
                ctx.globalAlpha = 1;
            }
        }
        const x = xDeCol(n.col, 2.5);
        const y = yDeNota(n) + 2.5 * z;
        const tam = 40 * z;
        const img = imagenNota(n.col);
        if (img.complete && img.naturalWidth) {
            ctx.drawImage(img, x, y, tam, tam);
        } else {
            ctx.fillStyle = COLORES_NOTA[n.col % 4];
            ctx.beginPath();
            ctx.arc(x + tam / 2, y + tam / 2, 17 * z, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function pintarEventosActuales() {
    const events = currentChartData && currentChartData.events ? currentChartData.events : {};
    const rango = rangoFilasVisibles();
    if (!rango) return;
    const desde = Math.max(0, rango.desde - VENTANA_CELDAS);
    const hasta = Math.min(grillaDOM.filas - 1, rango.hasta + VENTANA_CELDAS);
    for (const row in events) {
        const f = parseInt(row, 10);
        if (Number.isNaN(f)) continue;
        if (f >= desde && f <= hasta) asegurarCeldaEvento(f);
    }
}

function manejarClickCeldaEvento(e, f, cell) {
    e.stopPropagation();
    if (!currentChartData.events) currentChartData.events = {};

    if (!currentChartData.events[f]) {
        currentChartData.events[f] = {
            type: "Focus Camera",
            target: "opponent",
            duration: 0,
            offsetX: 0,
            offsetY: 0,
            effect: "CLASSIC"
        };
        const icon = document.createElement("img");
        icon.className = "event-note-icon";
        icon.src = "eventassets/FocusCamera.png";
        icon.alt = "Focus Camera";
        cell.appendChild(icon);
    }

    seleccionarEvento(f);
}

function seleccionarEvento(f) {
    if (eventoSeleccionado !== null) {
        const anterior = grillaDOM.celdasEvento[eventoSeleccionado];
        if (anterior) anterior.classList.remove("event-selected");
    }

    eventoSeleccionado = Number(f);
    const cell = grillaDOM.celdasEvento[eventoSeleccionado];
    if (cell) cell.classList.add("event-selected");
    actualizarVentanaEvento();
}

function deseleccionarEventoActual() {
    if (eventoSeleccionado !== null) {
        const cell = grillaDOM.celdasEvento[eventoSeleccionado];
        if (cell) cell.classList.remove("event-selected");
    }
    eventoSeleccionado = null;
    actualizarVentanaEvento();
}

function eliminarEventoSeleccionado() {
    if (eventoSeleccionado === null || !currentChartData?.events?.[eventoSeleccionado]) return;
    const cell = grillaDOM.celdasEvento[eventoSeleccionado];
    if (cell) {
        cell.classList.remove("event-selected");
        cell.querySelector(".event-note-icon")?.remove();
    }
    delete currentChartData.events[eventoSeleccionado];
    eventoSeleccionado = null;
    actualizarVentanaEvento();
}

function actualizarVentanaEvento() {
    const evento = eventoSeleccionado === null || !currentChartData?.events
        ? null
        : currentChartData.events[eventoSeleccionado];
    const target = document.getElementById("event-target-select");
    const duration = document.getElementById("event-duration-input");
    const effect = document.getElementById("event-effect-select");
    const offsetX = document.getElementById("event-offset-x");
    const offsetY = document.getElementById("event-offset-y");
    const deleteButton = document.getElementById("event-delete-button");
    const positionFields = document.getElementById("events-position-fields");
    const controls = [target, duration, effect, offsetX, offsetY, deleteButton];

    controls.forEach((control) => { if (control) control.disabled = !evento; });
    if (!evento) {
        if (positionFields) positionFields.hidden = true;
        return;
    }

    evento.target = evento.target || "opponent";
    evento.duration = Number.isFinite(Number(evento.duration)) ? Number(evento.duration) : 0;
    evento.offsetX = Number.isFinite(Number(evento.offsetX)) ? Number(evento.offsetX) : 0;
    evento.offsetY = Number.isFinite(Number(evento.offsetY)) ? Number(evento.offsetY) : 0;
    evento.effect = evento.effect || "CLASSIC";
    if (target) target.value = evento.target;
    if (duration) duration.value = evento.duration;
    if (effect) effect.value = evento.effect;
    if (offsetX) offsetX.value = evento.offsetX;
    if (offsetY) offsetY.value = evento.offsetY;
    if (positionFields) positionFields.hidden = evento.target !== "position";
}

function actualizarConfiguracionEvento() {
    if (eventoSeleccionado === null || !currentChartData?.events?.[eventoSeleccionado]) return;
    const evento = currentChartData.events[eventoSeleccionado];
    evento.target = document.getElementById("event-target-select")?.value || "opponent";
    evento.duration = Math.max(0, parseFloat(document.getElementById("event-duration-input")?.value) || 0);
    evento.effect = document.getElementById("event-effect-select")?.value || "CLASSIC";
    evento.offsetX = parseFloat(document.getElementById("event-offset-x")?.value) || 0;
    evento.offsetY = parseFloat(document.getElementById("event-offset-y")?.value) || 0;
    const positionFields = document.getElementById("events-position-fields");
    if (positionFields) positionFields.hidden = evento.target !== "position";
}

function deseleccionarNotaActual() {
    if (!notaSeleccionada) return;
    const cell = grillaDOM.celdas[notaSeleccionada];
    if (cell) cell.classList.remove("selected-note");
    notaSeleccionada = null;
}

function manejarClickCelda(e, f, c, cell) {
    e.stopPropagation();
    deseleccionarEventoActual();
    const key = `${f}-${c}`;
    if (currentChartData.notes[key]) {
        if (notaSeleccionada === key) {
            delete currentChartData.notes[key];
            cell.classList.remove("selected-note");
            notaSeleccionada = null;
            notasDirty = true;
            programarRenderNotas();
        } else {
            deseleccionarNotaActual();
            notaSeleccionada = key;
            cell.classList.add("selected-note");
        }
    } else {
        deseleccionarNotaActual();
        currentChartData.notes[key] = { len: 0 };
        notaSeleccionada = key;
        cell.classList.add("selected-note");
        notasDirty = true;
        programarRenderNotas();
    }
}

function ajustarLongitudNota(dir) {
    if (!notaSeleccionada) return;
    const nota = currentChartData.notes[notaSeleccionada];
    if (!nota) return;
    nota.len = Math.max(0, (nota.len || 0) + dir);
    notasDirty = true;
    programarRenderNotas();
}

function sincronizarPistasAudio(tiempo) {
    if (!Number.isFinite(tiempo)) return;
    if (audioInst) audioInst.currentTime = tiempo;
    if (audioVoice1) audioVoice1.currentTime = tiempo;
    if (audioVoice2) audioVoice2.currentTime = tiempo;
}

function togglePlayPause() {
    if (!audioInst) return;
    const btn = document.getElementById("btn-play-pause");
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    
    if (isPlaying) {
        audioInst.pause();
        if (audioVoice1) audioVoice1.pause();
        if (audioVoice2) audioVoice2.pause();
        sincronizarPistasAudio(audioInst.currentTime);
        isPlaying = false;
        
        // Cambia a icono de Play
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Reproducir';
        btn.classList.remove("playing");
        cancelAnimationFrame(animationFrameId);
        const btnMobile = document.getElementById("btn-play-pause-mobile");
        if (btnMobile) {
            btnMobile.innerHTML = '<i class="fa-solid fa-play"></i> Play';
            btnMobile.classList.remove("playing");
        }
    } else {
        const t = audioInst.currentTime;
        sincronizarPistasAudio(t);
        lastHitTime = t - 0.001;
        hitsSonados.clear(); // reinicia la deduplicación de hitsounds
        const reproducciones = [audioInst, audioVoice1, audioVoice2]
            .filter(Boolean)
            .map((audio) => audio.play());
        Promise.allSettled(reproducciones).then(() => sincronizarPistasAudio(audioInst.currentTime));
        isPlaying = true;
        
        // Cambia a icono de Pausa
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar';
        btn.classList.add("playing");
        const btnMobile = document.getElementById("btn-play-pause-mobile");
        if (btnMobile) {
            btnMobile.innerHTML = '<i class="fa-solid fa-pause"></i> Pausa';
            btnMobile.classList.add("playing");
        }
        animationFrameId = requestAnimationFrame(actualizarPlaybackFiel);
    }
}

function reposicionarScroll() {
    if(!audioInst || !currentChartData) return;
    const tiempoActual = audioInst.currentTime;
    const stepDuration = (60 / currentChartData.bpm) / 4;
    const currentStep = tiempoActual / stepDuration;
    
    const workspace = document.getElementById('scroll-workspace');
    ignorarSiguienteScroll = true; 
    workspace.scrollTop = (currentStep * alturaCelda * globalZoomFactor);
    sincronizarCeldasVisibles();
    programarRenderNotas();
    
    // CORRECCIÓN: Volvemos a pasar el tiempo exacto
    actualizarWaveforms(tiempoActual); 
}

// Hitsounds: devuelve la clave ("fila-col") de la PRIMERA nota cuyo hit aún no
// fue sonado dentro de la ventana exacta del frame (t0, t1], o null si no hay.
// El disparo compara contra el ms EXACTO de la nota (n.tMs, preservado del
// import; las notas fuera de grilla suenan en su tiempo real) o contra su fila
// (notas colocadas a mano, siempre en grilla). La dedup es por clave de nota y
// no por fila: dos notas fuera de grilla en filas vecinas pueden cruzar orden.
let hitsSonados = new Set();

function hayNotaNuevaEnRango(t0Seg, t1Seg) {
    if (!notasIdx || notasDirty) construirIndiceNotas();
    if (!notasIdx.length) return null;
    const hitP = document.getElementById("hit-player")?.checked;
    const hitE = document.getElementById("hit-enemy")?.checked;
    if (!hitP && !hitE) return null;

    const stepMs = (60 / (currentChartData.bpm || 120)) / 4 * 1000;
    const t0Ms = t0Seg * 1000;
    const t1Ms = t1Seg * 1000;
    // Escaneo por filas ±1: una nota fuera de grilla vive en la fila vecina a
    // su tiempo real. El filtro final es la ventana exacta del frame.
    const fila0 = Math.max(0, Math.floor(t0Ms / stepMs) - 1);
    const fila1 = Math.ceil(t1Ms / stepMs) + 1;

    let i = limiteInferiorFila(fila0);
    for (; i < notasIdx.length && notasIdx[i].fila <= fila1; i++) {
        const n = notasIdx[i];
        const clave = n.fila + "-" + n.col;
        if (hitsSonados.has(clave)) continue; // ya sonó desde el último play/seek
        const col = n.col;
        if (!((col < 4 && hitP) || (col >= 4 && hitE))) continue;
        // Piso, no techo: el hit dispara cuando el audio ALCANZA el tiempo de
        // la nota, nunca antes (antes con ceil sonaba hasta un step temprano).
        const hitMs = n.tMs != null ? n.tMs : n.fila * stepMs;
        if (hitMs <= t0Ms || hitMs > t1Ms) continue;
        return clave;
    }
    return null;
}

function actualizarPlaybackFiel() {
    if (!audioInst) return;
    const tiempoActual = audioInst.currentTime;
    if (isPlaying) {
        reposicionarScroll();
        if (lastHitTime >= 0 && currentChartData) {
            const latencia = 0; 
            const t0 = lastHitTime + latencia;
            const t1 = tiempoActual + latencia;
            if (t1 > t0) {
                const claveHit = hayNotaNuevaEnRango(t0, t1);
                if (claveHit) {
                    playHitsound();
                    hitsSonados.add(claveHit);
                }
            }
        }
        lastHitTime = tiempoActual;
    }
    actualizarContadorDeTiempo(tiempoActual);
    if (isPlaying) {
        if (tiempoActual >= audioInst.duration) {
            togglePlayPause();
            audioInst.currentTime = 0;
            reposicionarScroll();
        } else {
            animationFrameId = requestAnimationFrame(actualizarPlaybackFiel);
        }
    }
}

function manejarScrollManual() {
    if (!currentChartData) return;
    // Scroll programático (reposicionarScroll): se ignora por completo. El
    // que lo originó ya repinta celdas/canvas; continuar aquí provocaría un
    // seek del audio y, en playback, un toggle que lo pausaba al instante.
    if (ignorarSiguienteScroll) { ignorarSiguienteScroll = false; return; }
    // Scroll del usuario: el redibujado va primero, aplique o no audio.
    sincronizarCeldasVisibles();
    programarRenderNotas();
    if (!audioInst) return;
    if (isPlaying) togglePlayPause(); 
    
    const workspace = document.getElementById('scroll-workspace');
    const stepDuration = (60 / currentChartData.bpm) / 4;
    let nuevoTiempo = ((workspace.scrollTop / globalZoomFactor) / alturaCelda) * stepDuration;
    if (nuevoTiempo < 0) nuevoTiempo = 0;
    if (nuevoTiempo > audioInst.duration) nuevoTiempo = audioInst.duration;
    
    audioInst.currentTime = nuevoTiempo;
    if (audioVoice1) audioVoice1.currentTime = nuevoTiempo;
    if (audioVoice2) audioVoice2.currentTime = nuevoTiempo;
    
    lastHitTime = nuevoTiempo; 
    hitsSonados.clear(); // al hacer seek, todo vuelve a estar "sin sonar"
    actualizarContadorDeTiempo(nuevoTiempo);
    programarRenderNotas();
    
    // CORRECCIÓN: Volvemos a pasar el tiempo exacto
    actualizarWaveforms(nuevoTiempo); 
}

function actualizarContadorDeTiempo(tiempo) {
    let mins = Math.floor(tiempo / 60);
    let secs = Math.floor(tiempo % 60);
    let ms = Math.floor((tiempo % 1) * 100);
    const stepDuration = 60 / currentChartData.bpm / 4;
    const currentBeat = tiempo / stepDuration / 4;
    document.getElementById("txt-time").innerHTML = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
    document.querySelectorAll(".bottom-playback-bar span")[1].innerText = `Beat: ${currentBeat.toFixed(2)}`;
}

// SPACEBAR PLAY/PAUSE EVENT
window.addEventListener("keydown", function (e) {
    if (e.code === "Space") {
        e.preventDefault();
        togglePlayPause();
    }
});

// Al cambiar el tamaño de la ventana, redimensionar el canvas y redibujar.
window.addEventListener("resize", () => {
    programarRenderNotas();
});

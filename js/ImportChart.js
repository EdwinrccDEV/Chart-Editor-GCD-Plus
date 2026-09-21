// Toda la importacion de charts (.fnfc, JSON y proyectos archivados) vive aqui.

function mostrarModalImportacion() {
	const modal = document.getElementById("modal-importar-chart");
	if (modal) modal.classList.add("active");
}

function cerrarModalImportacion() {
	const modal = document.getElementById("modal-importar-chart");
	if (modal) modal.classList.remove("active");
}

function menuAbrirChart() {
	mostrarModalImportacion();
}

// ===================
// IMPORTAR CHART DE...
// ===================

function menuImportarChartDe() {
	const wrapper = document.getElementById("menu-importar-wrapper");
	if (wrapper) wrapper.classList.remove("open");
	mostrarModalImportacion();
}

function importarChartDesdeMenu(formato) {
	const wrapper = document.getElementById("menu-importar-wrapper");
	if (wrapper) wrapper.classList.remove("open");
	if (formato === "codename") {
		cerrarModalImportacion();
		document.getElementById("import-codename-input")?.click();
		return;
	}
	alert("La importación de " + formato + " aún no está implementada.\n\nPor ahora solo está disponible la importación de charts de Codename Engine.");
}

function seleccionarImportacion(tipo) {
	cerrarModalImportacion();
	const inputId = tipo === "fnfc" ? "import-fnfc-input" : "import-codename-input";
	document.getElementById(inputId)?.click();
}

function normalizarChartFNFC(data) {
	if (!data || (!data.songName && !data.name) || !data.notes || typeof data.notes !== "object" || Array.isArray(data.notes)) return null;
	const esFormatoInterno = Object.keys(data.notes).every((key) => /^\d+-\d+$/.test(key));
	if (!esFormatoInterno) return null;
	const notes = data.notes || {};
	const bpmNum = parseFloat(data.bpm);
	return {
		id: data.id || "chart_" + Date.now(),
		songName: data.songName || data.name || "Imported Chart",
		bpm: Number.isFinite(bpmNum) && bpmNum > 0 ? bpmNum : 160,
		bpmExplicito: Number.isFinite(bpmNum) && bpmNum > 0,
		author: data.author || data.composer || data.artist || "",
		charter: data.charter || "",
		speed: parseFloat(data.speed) || 1,
		player: data.player || "bf",
		opponent: data.opponent || "dad",
		girlfriend: data.girlfriend || "gf",
		album: data.album || "volume1",
		difficulty: parseInt(data.difficulty, 10) || 3,
		stage: data.stage || "stage",
		audioBase64: data.audioBase64 || undefined,
		totalRows: parseInt(data.totalRows, 10) || calcularFilasDesdeNotas(notes),
		notes: notes,
		events: data.events && typeof data.events === "object" && !Array.isArray(data.events) ? data.events : {},
	};
}

function calcularFilasDesdeNotas(notes) {
	let maxRow = 0;
	for (const key in notes) {
		const parts = key.split("-");
		const row = parseInt(parts[0], 10);
		const len = parseInt(notes[key].len, 10) || 0;
		if (!Number.isNaN(row)) maxRow = Math.max(maxRow, row + len);
	}
	return Math.max(16, Math.ceil((maxRow + 16) / 16) * 16);
}

function calcularFilasDesdeDuracion(duracion, bpm) {
	if (!Number.isFinite(duracion) || duracion <= 0 || !Number.isFinite(bpm) || bpm <= 0) return 0;
	const totalSteps = Math.ceil(duracion / ((60 / bpm) / 4));
	return Math.max(16, Math.ceil(totalSteps / 16) * 16);
}
// pintarNotasActuales/pintarEventosActuales viven ahora en js/charter.js (render por canvas)

function agregarNotaImportada(notes, timeMs, lane, sustainMs, stepMs) {
	const laneValue = parseInt(lane, 10);
	const time = parseFloat(timeMs);
	if (Number.isNaN(time) || Number.isNaN(laneValue) || laneValue < 0 || laneValue > 7) return 0;
	const col = laneValue;

	const row = Math.max(0, Math.round(time / stepMs));
	const sustain = Math.max(0, parseFloat(sustainMs) || 0);
	const len = Math.round(sustain / stepMs);
	// Preserva el tiempo y sustain EXACTOS en ms (Codename permite notas fuera
	// de la grilla). Sin esto, el import cuantiza a la fila mas cercana (ej.
	// 2400ms con step de 208ms cae en fila 12 -> 2500ms) y suena desfasada.
	const nota = { len: len, t: time };
	if (sustain > 0) nota.s = sustain;
	notes[`${row}-${col}`] = nota;
	return row + len;
}

function convertirEventosExternos(events, bpm, dificultad = "normal") {
	const resultado = {};
	if (events && !Array.isArray(events) && typeof events === "object") events = events[dificultad] || events.normal || [];
	if (!Array.isArray(events) || !Number.isFinite(bpm) || bpm <= 0) return resultado;
	const stepMs = 60000 / bpm / 4;
	const charToTarget = ["opponent", "player", "gf"];

	events.forEach((evento) => {
		if (!evento || evento.e !== "FocusCamera") return;
		const tiempo = parseFloat(evento.t);
		if (!Number.isFinite(tiempo)) return;
		const valores = evento.v && typeof evento.v === "object" ? evento.v : {};
		const fila = Math.max(0, Math.round(tiempo / stepMs));
		const char = parseInt(valores.char, 10);
		resultado[fila] = {
			type: "Focus Camera",
			t: tiempo,
			target: charToTarget[char] || "opponent",
			duration: Number(valores.duration) || 4,
			offsetX: Number(valores.x) || 0,
			offsetY: Number(valores.y) || 0,
			effect: valores.ease || "CLASSIC"
		};
	});
	return resultado;
}

// Convierte un chart.json nativo de Codename Engine (formato CODENAME: strumLines + events + meta)
// al formato interno del editor {notes: {"row-col": {len}}, events: {"row": {...}}}.
function convertirChartCodename(data) {
	if (!data || typeof data !== "object" || !Array.isArray(data.strumLines)) return null;

	const bpmRaw = parseFloat(data.meta?.bpm);
	const bpm = Number.isFinite(bpmRaw) && bpmRaw > 0 ? bpmRaw : 160;
	const stepMs = 60000 / bpm / 4;
	const notes = {};
	let maxRow = 0;

	data.strumLines.forEach((line) => {
		if (!line || !Array.isArray(line.notes)) return;
		// En Codename: type 0 = OPPONENT, type 1 = PLAYER.
		// En este editor: columnas 0-3 = jugador, 4-7 = oponente.
		const offset = line.type === 0 ? 4 : 0;
		line.notes.forEach((note) => {
			if (!note) return;
			const lane = parseInt(note.id, 10);
			if (Number.isNaN(lane)) return;
			const col = offset + (lane % 4);
			maxRow = Math.max(maxRow, agregarNotaImportada(notes, note.time, col, note.sLen, stepMs));
		});
	});
	if (Object.keys(notes).length === 0) return null;

	const meta = data.meta && typeof data.meta === "object" ? data.meta : {};
	const charToTarget = ["opponent", "player", "gf"];
	const events = {};
	(Array.isArray(data.events) ? data.events : []).forEach((evento) => {
		if (!evento || !Number.isFinite(parseFloat(evento.time))) return;
		const fila = Math.max(0, Math.round(parseFloat(evento.time) / stepMs));
		// Solo se representa el evento de cámara; el resto queda disponible en currentChartData.events.
		if (evento.name === "Camera Movement") {
			const valores = Array.isArray(evento.params) ? evento.params : [];
			// Guarda el tiempo EXACTO en ms para poder re-alinear el evento si el
			// BPM del chart era un fallback y se conserva el del proyecto.
			events[fila] = {
				type: "Focus Camera",
				t: parseFloat(evento.time),
				target: charToTarget[valores[0]] || "opponent",
				// Codename: [target, tween?, tweenTime, ease, tweenType, offsetX, offsetY]
				duration: Number(valores[2]) || 4,
				offsetX: Number(valores[5]) || 0,
				offsetY: Number(valores[6]) || 0,
				effect: String(valores[3] || "CLASSIC").toUpperCase()
			};
		}
	});

	return {
		id: "chart_" + Date.now(),
		songName: meta.displayName || meta.name || "Imported Chart",
		bpm: bpm,
		bpmExplicito: Number.isFinite(bpmRaw) && bpmRaw > 0,
		author: "",
		charter: "",
		speed: parseFloat(data.scrollSpeed) || 1,
		player: obtenerNombrePersonaje(data.strumLines.find((l) => l && l.type === 1)?.characters, "bf"),
		opponent: obtenerNombrePersonaje(data.strumLines.find((l) => l && l.type === 0)?.characters, "dad"),
		girlfriend: "gf",
		album: "volume1",
		difficulty: 3,
		stage: data.stage || "stage",
		totalRows: Math.max(16, Math.ceil((maxRow + 16) / 16) * 16),
		notes: notes,
		events: events,
	};
}

function convertirChartExterno(data) {
	if (!data || typeof data !== "object") return null;

	// Formato nativo de Codename Engine (strumLines con type 0/1 + codenameChart).
	if (Array.isArray(data.strumLines) && (data.codenameChart === true || data.codenameChart === "true" || data.meta)) return convertirChartCodename(data);

	const interno = normalizarChartFNFC(data);
	if (interno) return interno;

	const root = data.song && typeof data.song === "object" ? data.song : data;
	const bpmRaw = parseFloat(root.bpm || data.bpm);
	const bpm = Number.isFinite(bpmRaw) && bpmRaw > 0 ? bpmRaw : 160;
	const speedValue = typeof root.scrollSpeed === "object" ? root.scrollSpeed.normal : root.scrollSpeed;
	const stepMs = 60000 / bpm / 4;
	const notes = {};
	let maxRow = 0;

	if (Array.isArray(root.notes) && root.notes.length && root.notes[0].sectionNotes) {
		root.notes.forEach((section) => {
			(section.sectionNotes || []).forEach((note) => {
				const noteData = parseInt(note[1], 10);
				if (Number.isNaN(noteData) || noteData < 0 || noteData > 7) return;
				maxRow = Math.max(maxRow, agregarNotaImportada(notes, note[0], noteData, note[2], stepMs));
			});
		});
	} else if (Array.isArray(root.strumLines || root.strumlines)) {
		// Rama de compatibilidad para formatos similares sin meta.codenameChart (Codename
		// marca type 0 = OPPONENT / 1 = PLAYER; este editor usa cols 0-3 jugador, 4-7 oponente).
		const strumLines = root.strumLines || root.strumlines;
		strumLines.forEach((line, lineIndex) => {
			const tag = `${line.position || ""} ${line.name || ""} ${line.characters || ""}`.toLowerCase();
			let offset = lineIndex === 0 ? 0 : 4;
			if (tag.includes("opponent") || tag.includes("enemy") || tag.includes("dad") || line.type === 0) offset = 4;
			if (tag.includes("player") || tag.includes("boyfriend") || tag.includes("bf") || line.type === 1) offset = 0;

			(line.notes || []).forEach((note) => {
				const lane = parseInt(note.id ?? note.d ?? note.lane ?? note.noteData, 10);
				if (Number.isNaN(lane)) return;
				const col = lane > 3 ? lane % 8 : offset + lane;
				maxRow = Math.max(maxRow, agregarNotaImportada(notes, note.time ?? note.t, col, note.sLen ?? note.l ?? note.sustainLength, stepMs));
			});
		});
	} else {
		const noteList = Array.isArray(root.notes) ? root.notes : root.notes && (root.notes.normal || root.notes.hard || root.notes.easy);
		if (Array.isArray(noteList)) {
			noteList.forEach((note) => {
				const lane = parseInt(note.d ?? note.id ?? note.lane ?? note.noteData ?? note[1], 10);
				const time = note.t ?? note.time ?? note[0];
				const sustain = note.l ?? note.sLen ?? note.sustainLength ?? note[2];
				if (Number.isNaN(lane)) return;
				const col = lane % 8;
				maxRow = Math.max(maxRow, agregarNotaImportada(notes, time, col, sustain, stepMs));
			});
		}
	}

	if (Object.keys(notes).length === 0) return null;
	return {
		id: "chart_" + Date.now(),
		songName: root.songName || root.song || root.name || data.songName || "Imported Chart",
		bpm: bpm,
		bpmExplicito: Number.isFinite(bpmRaw) && bpmRaw > 0,
		author: root.artist || root.author || "",
		charter: root.charter || root.chartedBy || "",
		speed: parseFloat(speedValue) || parseFloat(data.speed) || 1,
		player: data.player || "bf",
		opponent: data.opponent || "dad",
		girlfriend: data.girlfriend || "gf",
		album: data.album || "volume1",
		difficulty: parseInt(data.difficulty, 10) || 3,
		stage: data.stage || "stage",
		totalRows: Math.max(16, Math.ceil((maxRow + 16) / 16) * 16),
		notes: notes,
		events: convertirEventosExternos(data.events, bpm, data.difficultyName),
	};
}

function buscarEntradaZip(zip, nombres) {
	const candidatos = Array.isArray(nombres) ? nombres : [nombres];
	let encontrada = null;
	zip.forEach((relativePath, zipEntry) => {
		if (encontrada || zipEntry.dir) return;
		const nombre = relativePath.split("/").pop().toLowerCase();
		if (candidatos.some((candidato) => nombre === candidato.toLowerCase())) encontrada = zipEntry;
	});
	return encontrada;
}

function buscarEntradaZipPorPalabra(zip, palabra) {
	let encontrada = null;
	zip.forEach((relativePath, zipEntry) => {
		if (encontrada || zipEntry.dir) return;
		const nombre = relativePath.split("/").pop().toLowerCase();
		if (nombre.includes(palabra) && nombre.endsWith(".json")) encontrada = zipEntry;
	});
	return encontrada;
}

function buscarAudioZip(zip, prefijo, nombre) {
	const nombreNormalizado = String(nombre || "").trim().toLowerCase();
	const esperado = nombreNormalizado ? `${prefijo}-${nombreNormalizado}.ogg` : `${prefijo}.ogg`;
	return buscarEntradaZip(zip, esperado);
}

function obtenerNombrePersonaje(valor, respaldo) {
	if (Array.isArray(valor)) valor = valor[0];
	if (valor && typeof valor === "object") valor = valor.name || valor.id || valor.character;
	return String(valor || respaldo).trim().toLowerCase();
}

function cargarMetadatosImportados(meta, chart) {
	const playData = meta.playData || {};
	const characters = playData.characters || {};
	const speedValue = typeof chart.scrollSpeed === "object" ? chart.scrollSpeed.normal : chart.scrollSpeed;
	const bpmRaw = parseFloat(meta.timeChanges?.[0]?.bpm || meta.bpm || chart.bpm);
	const bpm = Number.isFinite(bpmRaw) && bpmRaw > 0 ? bpmRaw : 160;
	return {
		songName: meta.songName || meta.song || "Imported Chart",
		author: meta.artist || meta.composer || "",
		charter: meta.charter || meta.credit || "",
		bpm: bpm,
		bpmExplicito: Number.isFinite(parseFloat(meta.timeChanges?.[0]?.bpm || meta.bpm)),
		speed: parseFloat(speedValue) || 1,
		player: obtenerNombrePersonaje(characters.player || playData.player || meta.player || playData.playerVocals || meta.playerVocals, "bf"),
		opponent: obtenerNombrePersonaje(characters.opponent || playData.opponent || meta.opponent || playData.opponentVocals || meta.opponentVocals, "dad"),
		girlfriend: obtenerNombrePersonaje(characters.girlfriend || playData.girlfriend || meta.girlfriend, "gf"),
		album: meta.album || playData.album || "volume1",
		difficulty: parseInt(playData.ratings?.normal || meta.difficulty, 10) || 3,
		stage: playData.stage || meta.stage || "stage",
	};
}

// Reconstruye los audios embebidos en el chart (data-URL o base64 crudo, tal como los
// guarda "Archivar Chart" en localStorage) y redibuja los waveforms. Así reabrir un
// proyecto archivado (o importar un .fnfc interno con audioBase64) conserva el audio.
async function restaurarAudiosDesdeChart(chart) {
	if (!chart || !chart.audioBase64 || typeof chart.audioBase64 !== "object") return false;
	const entradas = [
		["inst", "inst"], ["v1", "player"], ["v2", "opponent"]
	];
	let restaurado = false;
	for (const [clave, etiqueta] of entradas) {
		let dataUrl = chart.audioBase64[clave];
		if (!dataUrl) continue;
		if (typeof dataUrl !== "string") continue;
		// "Archivar Chart" guarda data-URLs, pero por compatibilidad se acepta base64 crudo.
		if (!dataUrl.startsWith("data:")) dataUrl = "data:audio/ogg;base64," + dataUrl;
		try {
			const blob = await (await fetch(dataUrl)).blob();
			const file = new File([blob], etiqueta + ".ogg", { type: blob.type || "audio/ogg" });
			const audio = new Audio(URL.createObjectURL(blob));
			if (clave === "inst") { fileRawInst = file; audioInst = audio; }
			else if (clave === "v1") { fileRawV1 = file; audioVoice1 = audio; }
			else { fileRawV2 = file; audioVoice2 = audio; }
			restaurado = true;
		} catch (e) {
			console.error("No se pudo restaurar el audio embebido (" + etiqueta + ")", e);
		}
	}
	if (!restaurado) return false;
	buffers.inst = await decodeAudioFile(fileRawInst);
	buffers.v1 = await decodeAudioFile(fileRawV1);
	buffers.v2 = await decodeAudioFile(fileRawV2);
	// El chart exportado no siempre tiene en cuenta la duración del audio: amplía la grilla si hace falta.
	const duracionAudio = Math.max(buffers.inst?.duration || 0, buffers.v1?.duration || 0, buffers.v2?.duration || 0);
	const filasAudio = calcularFilasDesdeDuracion(duracionAudio, chart.bpm);
	if (filasAudio > (currentChartData.totalRows || 0)) {
		currentChartData.totalRows = filasAudio;
		generarEstructuraGrilla(currentChartData.totalRows);
		pintarNotasActuales();
		pintarEventosActuales();
	}
	autoAjustarSelectoresDeWaveform(!!(buffers.v1 && buffers.v2));
	aplicarMuteEstadosUI();
	cargarDatosEnMesa(fileRawV1, fileRawV2, currentChartData.songName, currentChartData.bpm);
	if (typeof actualizarWaveforms === "function") actualizarWaveforms();
	return true;
}

function abrirChartEnEditor(data, conservarAudios = false) {
	const dificultadesPreservadas = data && data.difficulties && typeof data.difficulties === "object" && !Array.isArray(data.difficulties)
		? JSON.parse(JSON.stringify(data.difficulties))
		: null;
	const dificultadActivaPreservada = data && typeof data.activeDifficulty === "string" ? data.activeDifficulty : null;
	const chart = normalizarChartFNFC(data) || convertirChartExterno(data);
	if (!chart) return false;

	// Regla de BPM: el chart solo manda si trae un BPM EXPLICITO. Cuando el BPM
	// era un fallback (ej. 160 porque el chart.json de Codename no trae meta.bpm)
	// y ya hay un proyecto abierto con BPM propio, se CONSERVA el BPM del
	// proyecto y las filas de notas/eventos se recalculan a su grilla usando sus
	// tiempos EXACTOS en ms (que son absolutos respecto al audio: no se escalan).
	// Si trae un BPM explicito DISTINTO, se pregunta al usuario. Y si el chart
	// trae audio embebido (proyecto archivado / .fnfc con OGGs), su BPM es
	// autoridad: sus notas van sincronizadas a SU audio, nunca se re-alinean.
	const bpmProyecto = parseFloat(document.getElementById("song-bpm")?.value);
	const traeAudioEmbebido = chart.audioBase64 && typeof chart.audioBase64 === "object" && Object.keys(chart.audioBase64).length > 0;
	const hayProyectoConBpm = Number.isFinite(bpmProyecto) && bpmProyecto > 0 && !!currentChartData;
	let conservarBpmProyecto = false;
	if (hayProyectoConBpm && !traeAudioEmbebido) {
		if (!chart.bpmExplicito) {
			conservarBpmProyecto = true;
		} else if (chart.bpm !== bpmProyecto) {
			conservarBpmProyecto = !confirm(
				"El chart importado trae BPM " + chart.bpm + ", pero tu proyecto usa " + bpmProyecto + ".\n\n" +
				"ACEPTAR = usar el BPM del chart (" + chart.bpm + ")\n" +
				"CANCELAR = conservar el BPM de tu proyecto (" + bpmProyecto + ") y alinear las notas a su grilla"
			);
		}
	}
	if (conservarBpmProyecto) {
		chart.bpm = bpmProyecto;
		const stepDestino = 60000 / bpmProyecto / 4;
		let maxFila = 0;
		const notasRealineadas = {};
		Object.entries(chart.notes || {}).forEach(([clave, nota]) => {
			const [fila, col] = clave.split("-").map(Number);
			const nuevaFila = Number.isFinite(nota.t) ? Math.max(0, Math.round(nota.t / stepDestino)) : fila;
			// El largo del sustain en filas fue calculado con el step del BPM
			// fallback: se recalcula desde su duracion EXACTA en ms (s).
			if (Number.isFinite(nota.s)) nota.len = Math.max(0, Math.round(nota.s / stepDestino));
			maxFila = Math.max(maxFila, nuevaFila + (nota.len || 0));
			notasRealineadas[`${nuevaFila}-${col}`] = nota;
		});
		chart.notes = notasRealineadas;
		const eventosRealineados = {};
		Object.entries(chart.events || {}).forEach(([clave, evento]) => {
			// Los eventos van SOLO por fila (sin columna): la clave es el numero de fila.
			const nuevaFila = Number.isFinite(evento.t) ? Math.max(0, Math.round(evento.t / stepDestino)) : parseInt(clave, 10) || 0;
			eventosRealineados[`${nuevaFila}`] = evento;
		});
		chart.events = eventosRealineados;
		chart.totalRows = Math.max(16, Math.ceil((maxFila + 16) / 16) * 16);
	}

	if (dificultadesPreservadas && Object.keys(dificultadesPreservadas).length) {
		chart.difficulties = dificultadesPreservadas;
		const preferidaOriginal = dificultadActivaPreservada && dificultadesPreservadas[dificultadActivaPreservada]
			? dificultadActivaPreservada
			: (dificultadesPreservadas.normal ? "normal" : Object.keys(dificultadesPreservadas)[0]);
		chart.notes = dificultadesPreservadas[preferidaOriginal].notes || chart.notes || {};
		chart.events = dificultadesPreservadas[preferidaOriginal].events || chart.events || {};
		chart.activeDifficulty = preferidaOriginal;
	}

	currentChartData = chart;
	asegurarDificultadesChart(currentChartData);
	// Regla de audio: el audio solo se toca si el chart TRAE uno embebido
	// (proyectos archivados / .fnfc con audioBase64), en cuyo caso se reemplaza
	// por el suyo. Si no trae (Codename, JSON, .fnfc sin OGGs), se conserva
	// intacto el audio ya cargado: importar un chart ya no obliga a
	// reimportar el audio ni borra los waveforms.
	if (traeAudioEmbebido) {
		limpiarAudiosExistentes();
		restaurarAudiosDesdeChart(chart);
	}
	generarEstructuraGrilla(currentChartData.totalRows);
	pintarNotasActuales();
	pintarEventosActuales();
	// Con el audio decidido, muestra las etiquetas reales de las pistas
	// (antes pasaba nulls y reseteaba los nombres aunque el audio siguiera cargado).
	cargarDatosEnMesa(fileRawV1, fileRawV2, currentChartData.songName, currentChartData.bpm);
	const speedInput = document.getElementById("speed-dummy-input");
	if (speedInput) speedInput.value = currentChartData.speed || 1;
	const songNameInput = document.getElementById("song-name");
	if (songNameInput) songNameInput.value = currentChartData.songName || "";
	const bpmInput = document.getElementById("song-bpm");
	if (bpmInput) bpmInput.value = currentChartData.bpm || 160;
	const authorInput = document.getElementById("song-author");
	if (authorInput && currentChartData.author) authorInput.value = currentChartData.author;
	const charterInput = document.getElementById("song-charter");
	if (charterInput && currentChartData.charter) charterInput.value = currentChartData.charter;
	inicializarWorkspace();
	actualizarListaDificultades();
	actualizarIndicadorDificultad();
	return true;
}

async function procesarArchivoFNFC(input) {
	const file = input.files[0];
	if (!file) return;

	try {
		limpiarAudiosExistentes();
		const zip = await JSZip.loadAsync(file);
		const metaFile = buscarEntradaZip(zip, ["song-metadata.json", "metadata.json"]) || buscarEntradaZipPorPalabra(zip, "metadata");
		const chartFile = buscarEntradaZip(zip, ["song-chart.json", "chart.json"]) || buscarEntradaZipPorPalabra(zip, "chart");

		if (metaFile && chartFile) {
			const metaJson = JSON.parse(await metaFile.async("string"));
			const chartJson = JSON.parse(await chartFile.async("string"));

			const metadata = cargarMetadatosImportados(metaJson, chartJson);
			const notasPorDificultad = chartJson.notes && typeof chartJson.notes === "object" && !Array.isArray(chartJson.notes)
				? chartJson.notes
				: { normal: chartJson.notes };

			const dificultadesImportadas = {};
			let maxFilasGlobales = 0;
			Object.keys(notasPorDificultad).forEach((nombre) => {
				const dificultad = convertirChartExterno({
					...metadata,
					notes: notasPorDificultad[nombre],
					events: chartJson.events?.[nombre] || chartJson.events,
					difficultyName: nombre,
					scrollSpeed: chartJson.scrollSpeed?.[nombre] ?? metadata.speed
				});
				if (dificultad) {
					dificultadesImportadas[nombre] = { notes: dificultad.notes, events: dificultad.events };
					maxFilasGlobales = Math.max(maxFilasGlobales, dificultad.totalRows || 0);
				}
			});

			const chart = convertirChartExterno({
				...metadata,
				notes: notasPorDificultad.normal || notasPorDificultad[Object.keys(notasPorDificultad)[0]] || {},
				events: chartJson.events?.normal || chartJson.events,
				scrollSpeed: chartJson.scrollSpeed ?? metadata.speed
			});
			if (!chart) throw new Error("Chart sin notas reconocibles");

			if (Object.keys(dificultadesImportadas).length) {
				chart.difficulties = dificultadesImportadas;
				const primeraDificultad = Object.keys(dificultadesImportadas).find((n) => n === "normal") || Object.keys(dificultadesImportadas)[0];
				chart.notes = dificultadesImportadas[primeraDificultad].notes;
				chart.events = dificultadesImportadas[primeraDificultad].events;
				chart.activeDifficulty = primeraDificultad;
				chart.totalRows = Math.max(chart.totalRows || 0, maxFilasGlobales);
			}
			const instrumentalName = metaJson.playData?.characters?.instrumental || metaJson.playData?.inst || metaJson.inst || "";
			const instZip = buscarAudioZip(zip, "inst", instrumentalName) || buscarAudioZip(zip, "inst", "");
			const playerZip = buscarEntradaZip(zip, ["Voices-Player.ogg", `voices-${metadata.player}.ogg`]);
			const opponentZip = buscarEntradaZip(zip, ["Voices-Opponent.ogg", `voices-${metadata.opponent}.ogg`]);
			const blobInst = instZip ? await instZip.async("blob") : null;
			const blobPlayer = playerZip ? await playerZip.async("blob") : null;
			const blobOpponent = opponentZip ? await opponentZip.async("blob") : null;
			fileRawInst = blobInst ? new File([blobInst], instZip.name, { type: "audio/ogg" }) : null;
			fileRawV1 = blobPlayer ? new File([blobPlayer], playerZip.name, { type: "audio/ogg" }) : null;
			fileRawV2 = blobOpponent ? new File([blobOpponent], opponentZip.name, { type: "audio/ogg" }) : null;
			if (fileRawInst) audioInst = new Audio(URL.createObjectURL(fileRawInst));
			if (fileRawV1) audioVoice1 = new Audio(URL.createObjectURL(fileRawV1));
			if (fileRawV2) audioVoice2 = new Audio(URL.createObjectURL(fileRawV2));
			buffers.inst = await decodeAudioFile(fileRawInst);
			buffers.v1 = await decodeAudioFile(fileRawV1);
			buffers.v2 = await decodeAudioFile(fileRawV2);
			const duracionAudio = Math.max(
				buffers.inst?.duration || 0,
				buffers.v1?.duration || 0,
				buffers.v2?.duration || 0
			);
			chart.totalRows = Math.max(
				chart.totalRows || 0,
				calcularFilasDesdeDuracion(duracionAudio, chart.bpm)
			);

			const dificultadesPreservadas = chart.difficulties && Object.keys(chart.difficulties).length
				? JSON.parse(JSON.stringify(chart.difficulties))
				: null;
			const dificultadActivaPreservada = chart.activeDifficulty || null;

			if (!abrirChartEnEditor(chart, true)) throw new Error("Chart sin notas reconocibles");

			if (dificultadesPreservadas && currentChartData) {
				currentChartData.difficulties = dificultadesPreservadas;
				Object.keys(currentChartData.difficulties).forEach((nombre) => {
					currentChartData.difficulties[nombre].notes ||= {};
					currentChartData.difficulties[nombre].events ||= {};
				});
				const diffKeys = Object.keys(currentChartData.difficulties);
				let preferida;
				if (dificultadActivaPreservada && currentChartData.difficulties[dificultadActivaPreservada]) {
					preferida = dificultadActivaPreservada;
				} else if (currentChartData.difficulties.normal) {
					preferida = "normal";
				} else {
					preferida = diffKeys[0];
				}
				dificultadActiva = preferida;
				currentChartData.activeDifficulty = preferida;
				currentChartData.notes = currentChartData.difficulties[preferida].notes;
				currentChartData.events = currentChartData.difficulties[preferida].events;
				notaSeleccionada = null;
				deseleccionarEventoActual();
				generarEstructuraGrilla(currentChartData.totalRows);
				pintarNotasActuales();
				pintarEventosActuales();
				actualizarListaDificultades();
				actualizarIndicadorDificultad();
			}

			aplicarMuteEstadosUI();
			autoAjustarSelectoresDeWaveform(fileRawV1 && fileRawV2);
			cargarDatosEnMesa(fileRawV1, fileRawV2, metadata.songName, metadata.bpm);
			return;
		}

			const data = JSON.parse(await file.text());
		if (!abrirChartEnEditor(data)) alert("Archivo .fnfc invalido.");
	} catch (err) {
		console.error(err);
		alert("Error al leer y decodificar el archivo del chart.");
	} finally {
		input.value = "";
	}
}

function procesarArchivoCodename(input) {
	const file = input.files[0];
	if (!file) return;
	const reader = new FileReader();
	reader.onload = function (e) {
		try {
			const data = JSON.parse(e.target.result);
			const chart = convertirChartCodename(data) || convertirChartExterno(data);
			if (!chart || !abrirChartEnEditor(chart)) {
				alert("Este archivo no parece un chart.json de Codename Engine (se espera un JSON con \"strumLines\").");
			}
		} catch (err) {
			console.error(err);
			alert("Error al leer el archivo JSON del chart.");
		}
	};
	reader.readAsText(file);
	input.value = "";
}

function renderizarProyectosArchivados() {
	const grid = document.getElementById("lista-proyectos-grid");
	if (!grid) return;

	grid.innerHTML = `
		<div class="folder-card new-project" onclick="abrirModalNuevoChart()">
			<div class="folder-icon"><i class="fa-solid fa-folder-plus"></i></div>
			<h3>Nuevo Chart</h3>
		</div>`;

	const proyectos = JSON.parse(localStorage.getItem("fnf_mobile_charts")) || [];
	proyectos.forEach((proy) => {
		const card = document.createElement("div");
		card.className = "folder-card";
		card.innerHTML = `
			<button class="delete-project-btn" onclick="eliminarProyectoArchivado(event, '${proy.id}')">
				<i class="fa-solid fa-trash"></i>
			</button>
			<div class="folder-icon" onclick="cargarProyectoDesdeArchivo('${proy.id}')">
				<i class="fa-solid fa-file-audio" style="color: #c9c2d5;"></i>
			</div>
			<h3 onclick="cargarProyectoDesdeArchivo('${proy.id}')">${proy.songName}</h3>
			<p style="font-size:11px; color:var(--text-sub);">BPM: ${proy.bpm}</p>`;
		grid.appendChild(card);
	});
}

function eliminarProyectoArchivado(event, id) {
	event.stopPropagation();
	if (!confirm("¿Eliminar chart?")) return;
	let proyectos = JSON.parse(localStorage.getItem("fnf_mobile_charts")) || [];
	proyectos = proyectos.filter((proyecto) => proyecto.id !== id);
	localStorage.setItem("fnf_mobile_charts", JSON.stringify(proyectos));
	renderizarProyectosArchivados();
}

function cargarProyectoDesdeArchivo(id) {
	const proyectos = JSON.parse(localStorage.getItem("fnf_mobile_charts")) || [];
	const proyecto = proyectos.find((item) => item.id === id);
	if (proyecto) abrirChartEnEditor(proyecto);
}

"use strict";

// ---------------------------------------------------------------------------
// Generic iCUE widget scaffold. Polls a local bridge and renders rows.
// Replace the render logic and endpoint with your own. Keep the patterns:
//   - prop()/getX() for iCUE properties (NEVER shadow a property global)
//   - idempotent start() called on DOMContentLoaded
//   - fitFont()/ResizeObserver for legible sizing on any tile size
// ---------------------------------------------------------------------------

var FETCH_TIMEOUT_MS = 8000;

// Defaults MUST match the data-default values in index.html.
var DEFAULTS = {
	bridgePort: "37650",
	pollSeconds: "60",
	accentColor: "#4C8BF5",
	textColor: "#F5F4F2",
	backgroundColor: "#1B1A19",
};

// Font-fit bounds (px) for the root font size that all rem sizes derive from.
var FONT_MIN_PX = 10;
var FONT_MAX_PX = 20;

var state = {
	data: null,
	pollTimer: null,
	started: false,
	resizeObserver: null,
};

// Read an iCUE property (injected as a global) with a fallback.
function prop(name) {
	try {
		if (typeof window !== "undefined" && window[name] !== undefined && window[name] !== null && window[name] !== "") {
			return window[name];
		}
	} catch (e) {}
	return DEFAULTS[name];
}

function $(id) {
	return document.getElementById(id);
}

function applyTheme() {
	var root = document.documentElement.style;
	root.setProperty("--accent", prop("accentColor"));
	root.setProperty("--text", prop("textColor"));
	root.setProperty("--bg", prop("backgroundColor"));
}

// Poll interval in ms. User-configurable via iCUE (seconds).
// NOTE: must not be named `pollSeconds` — iCUE injects that property as a global
// and a same-named declaration is a redeclaration error (blank widget).
function getPollMs() {
	var n = parseInt(String(prop("pollSeconds")).replace(/[^0-9]/g, ""), 10);
	if (isNaN(n)) n = parseInt(DEFAULTS.pollSeconds, 10);
	n = Math.max(10, Math.min(3600, n)); // keep >= fetch timeout, cap at 1h
	return n * 1000;
}

function setStatus(kind, title) {
	var dot = $("status-dot");
	dot.className = "status-dot " + kind;
	dot.title = title || "";
}

function showMessage(text) {
	var msg = $("message");
	msg.textContent = text;
	msg.classList.remove("hidden");
}

function hideMessage() {
	$("message").classList.add("hidden");
}

// Build one row. Replace with your own markup as needed.
function makeRow(label, value) {
	var row = document.createElement("div");
	row.className = "row";

	var lbl = document.createElement("span");
	lbl.className = "row-label";
	lbl.textContent = label;

	var val = document.createElement("span");
	val.className = "row-value";
	val.textContent = value;

	row.appendChild(lbl);
	row.appendChild(val);
	return row;
}

function render(data) {
	state.data = data;

	var rows = $("rows");
	rows.innerHTML = "";

	// EXAMPLE: expects data.items = [{ label, value }]. Adapt to your payload.
	if (Array.isArray(data.items)) {
		data.items.forEach(function (item) {
			rows.appendChild(makeRow(item.label, item.value));
		});
	}

	var updated = $("updated");
	var when = data.fetchedAt ? new Date(data.fetchedAt) : new Date();
	updated.textContent = "updated " + when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

	setStatus(data.stale ? "stale" : "online", data.stale ? "Cached" : "Live");
	$("widget").classList.remove("dim");
	hideMessage();

	// Content changed; refit the text to the tile.
	fitFont();
}

function handleFailure(text) {
	setStatus("offline", text.split("\n")[0]);
	if (state.data) $("widget").classList.add("dim"); // keep last-good, dimmed
	showMessage(text);
}

function poll() {
	var port = String(prop("bridgePort")).replace(/[^0-9]/g, "") || DEFAULTS.bridgePort;
	var url = "http://127.0.0.1:" + port + "/data";

	var controller = new AbortController();
	var to = setTimeout(function () {
		controller.abort();
	}, FETCH_TIMEOUT_MS);

	fetch(url, { signal: controller.signal, cache: "no-store" })
		.then(function (res) {
			return res.json().catch(function () {
				return null;
			});
		})
		.then(function (payload) {
			clearTimeout(to);
			if (!payload) {
				handleFailure("Unavailable\nUnexpected response from bridge.");
				return;
			}
			if (payload.ok === false) {
				handleFailure("Unavailable\n" + (payload.message || payload.error || ""));
				return;
			}
			render(payload);
		})
		.catch(function () {
			clearTimeout(to);
			handleFailure("Bridge offline\nStart the local bridge on your PC.");
		});
}

// (Re)start the poll timer using the current configured interval.
function startPolling() {
	if (state.pollTimer) clearInterval(state.pollTimer);
	state.pollTimer = setInterval(poll, getPollMs());
}

// Scale the root font size so content fills the tile without overflowing, with a
// legible floor. All rem-based sizes derive from this. Tune the /26 divisor and
// the min/max for your content density.
function fitFont() {
	var widget = $("widget");
	if (!widget) return;
	var rootStyle = document.documentElement.style;
	var size = Math.min(FONT_MAX_PX, Math.max(FONT_MIN_PX, widget.clientWidth / 26));
	rootStyle.fontSize = size + "px";
	while (size > FONT_MIN_PX && widget.scrollHeight > widget.clientHeight + 1) {
		size -= 0.5;
		rootStyle.fontSize = size + "px";
	}
}

// Refit whenever the tile is resized (e.g. small <-> medium layout).
function observeResize() {
	if (state.resizeObserver) return;
	var widget = $("widget");
	if (!widget) return;
	if (typeof ResizeObserver !== "undefined") {
		state.resizeObserver = new ResizeObserver(function () {
			fitFont();
		});
		state.resizeObserver.observe(widget);
	} else {
		window.addEventListener("resize", fitFont);
	}
	fitFont();
}

function start() {
	if (state.started) return;
	state.started = true;

	applyTheme();
	observeResize();
	poll();
	startPolling();
}

function onDataUpdated() {
	// A property changed; re-theme, re-poll, and restart the timer so a new
	// interval takes effect live.
	applyTheme();
	poll();
	startPolling();
}

// Public surface consumed by the iCUE lifecycle hooks declared in index.html.
window.MyWidget = { start: start, onDataUpdated: onDataUpdated };

// Surface silent JS failures to the CUE5 logs (search for "js:").
window.onerror = function (message, source, line, col) {
	console.error("js:", message, line + ":" + col);
};

// Start as soon as the DOM is ready, regardless of iCUE init state. start() is
// idempotent, so the icueEvents hooks and the check below just refine afterward.
// (iCUE sets iCUE_initialized = false at load and fires onICUEInitialized later;
// we must not depend on that to render.)
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", function () {
		start();
	});
} else {
	start();
}

if (typeof iCUE_initialized !== "undefined" && iCUE_initialized) {
	start();
}

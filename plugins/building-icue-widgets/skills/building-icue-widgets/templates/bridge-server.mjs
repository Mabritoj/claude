// Local data bridge for iCUE widgets.
// Serves normalized JSON on localhost; widget never sees secrets.
//
// Customize: upstream fetch, normalization, credential path, PORT.
// Endpoints: GET /health , GET /data

import http from "node:http";
import { writeFile, rename } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const PORT = Number(process.env.PORT) || 37650;
const HOST = "127.0.0.1";
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 60_000;

let cache = null; // { at: number, payload: object }

function log(...args) {
	console.log(new Date().toISOString(), ...args);
}

async function writeAtomic(filePath, data) {
	const dir = path.dirname(filePath);
	const tmp = path.join(dir, `.tmp.${crypto.randomBytes(6).toString("hex")}`);
	await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
	await rename(tmp, filePath);
}

// TODO: replace with your upstream fetch + normalization
async function fetchData() {
	// Example placeholder — widget template expects data.items = [{ label, value }]
	return {
		ok: true,
		fetchedAt: new Date().toISOString(),
		items: [
			{ label: "Example metric", value: "42" },
			{ label: "Status", value: "OK" },
		],
	};
}

async function getData() {
	const now = Date.now();
	if (cache && now - cache.at < CACHE_TTL_MS) {
		return { payload: cache.payload, cached: true };
	}
	try {
		const payload = await fetchData();
		cache = { at: now, payload };
		return { payload, cached: false };
	} catch (err) {
		if (cache) {
			log(`fetch failed (${err.message}); serving stale cache`);
			return {
				payload: { ...cache.payload, stale: true, error: err.code || "ERROR" },
				cached: true,
			};
		}
		return {
			payload: {
				ok: false,
				error: err.code || "ERROR",
				message: err.message,
				fetchedAt: new Date().toISOString(),
			},
			cached: false,
		};
	}
}

const cors = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

const server = http.createServer(async (req, res) => {
	if (req.method === "OPTIONS") {
		res.writeHead(204, cors);
		res.end();
		return;
	}

	const url = new URL(req.url, `http://${HOST}:${PORT}`);

	if (url.pathname === "/health") {
		res.writeHead(200, { "Content-Type": "application/json", ...cors });
		res.end(JSON.stringify({ ok: true, service: "my-widget-bridge", port: PORT }));
		return;
	}

	if (url.pathname === "/data") {
		const { payload } = await getData();
		const status = payload.ok === false ? 502 : 200;
		res.writeHead(status, {
			"Content-Type": "application/json",
			"Cache-Control": "no-store",
			...cors,
		});
		res.end(JSON.stringify(payload));
		return;
	}

	res.writeHead(404, { "Content-Type": "application/json", ...cors });
	res.end(JSON.stringify({ ok: false, error: "NOT_FOUND" }));
});

server.listen(PORT, HOST, () => {
	log(`Bridge listening on http://${HOST}:${PORT}`);
	log(`Endpoints: GET /data , GET /health`);
});

var SUPABASE_URL = "https://PLATZHALTER-checker-test.supabase.co";
var SUPABASE_KEY = "PLATZHALTER_SUPABASE_ANON_KEY_TEST";
if (!window.supabase) {
	document.addEventListener("DOMContentLoaded", () => {
		const m = document.getElementById("authMsg");
		if (m) {
			m.textContent = "Verbindung wird geladen, bitte Seite neu laden falls dies bleibt.";
			m.className = "auth-msg show error";
		}
	});
}
var sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
var WORKER = "https://compliance-worker-test.julius-422.workers.dev";

var API_PDF_TOKEN = (function() {
	try {
		return new URLSearchParams(location.search).get("api_pdf") || "";
	} catch (e) {
		return "";
	}
})();
var WORKER_STILL_MS = 45e3;
var WORKER_LIMIT_ANALYSE = 9e5;
var WORKER_LIMIT = 9e4;
async function workerFetch(action, payload, opt) {
	const kopf = { "Content-Type": "application/json" };
	try {
		if (typeof sb !== "undefined" && sb && sb.auth) {
			const sess = (await sb.auth.getSession()).data.session;
			if (sess && sess.access_token) kopf["Authorization"] = "Bearer " + sess.access_token;
		}
	} catch (e) {}
	const koerper = {
		action,
		payload
	};
	try {
		if (typeof API_PDF_TOKEN !== "undefined" && API_PDF_TOKEN) koerper.render_token = API_PDF_TOKEN;
	} catch (e) {}
	return fetch(WORKER, {
		method: "POST",
		headers: kopf,
		body: JSON.stringify(koerper),
		signal: opt && opt.signal ? opt.signal : undefined
	});
}
async function workerCall(action, payload, versuch) {
	const v = versuch || 0;
	const teuer = action === "pruefen" || action === "neu_bewerten" || action === "firmen_vorsuche";
	const MAX = teuer ? 1 : 3;
	const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
	const LANG = {
		pruefen: WORKER_LIMIT_ANALYSE,
		neu_bewerten: 9e5,
		repair_json: 3e5,
		firmen_vorsuche: 18e4,
		bilder_nachladen: 3e5,
		sanktionen_laden: 3e5
	};
	const limit = LANG[action] || WORKER_LIMIT;
	let grund = "";
	const timer = ctrl ? setTimeout(function() {
		grund = "gesamt";
		ctrl.abort();
	}, limit) : null;
	let still = null;
	const wecker = function() {
		if (!ctrl) return;
		if (still) clearTimeout(still);
		still = setTimeout(function() {
			if (!grund) grund = "still";
			ctrl.abort();
		}, WORKER_STILL_MS);
	};
	const aufraeumen = function() {
		if (timer) clearTimeout(timer);
		if (still) clearTimeout(still);
	};
	try {
		const res = await workerFetch(action, payload, { signal: ctrl ? ctrl.signal : undefined });
		if (!res.ok && (res.status === 429 || res.status >= 500) && v < MAX) {
			aufraeumen();
			await new Promise(function(r) {
				setTimeout(r, 1200 * Math.pow(2, v));
			});
			return workerCall(action, payload, v + 1);
		}
		let text = "";
		if (res.body && typeof res.body.getReader === "function" && typeof TextDecoder !== "undefined") {
			const leser = res.body.getReader();
			const dec = new TextDecoder();
			while (true) {
				wecker();
				const teil = await leser.read();
				if (teil.done) break;
				text += dec.decode(teil.value, { stream: true });
			}
			text += dec.decode();
		} else if (typeof res.text === "function") {
			text = await res.text();
		} else {
			const j = await res.json();
			aufraeumen();
			return j;
		}
		aufraeumen();
		return JSON.parse(text);
	} catch (e) {
		aufraeumen();
		if (grund === "gesamt") throw new Error("timeout: Die Anfrage hat zu lange gedauert.");
		const msg = (e && e.message || "") + "";
		const netz = grund === "still" || /failed to fetch|networkerror|load failed|network|aborted|abgebrochen/i.test(msg) || e && e.name === "AbortError";
		if (netz && v < MAX) {
			await new Promise(function(r) {
				setTimeout(r, 1200 * Math.pow(2, v));
			});
			return workerCall(action, payload, v + 1);
		}
		if (netz) throw new Error("network: Die Verbindung zum Analyse-Dienst wurde unterbrochen.");
		throw e;
	}
}
function friendlyError(msg) {
	const m = ((msg || "") + "").toLowerCase();
	if (!m) return "Die Analyse konnte nicht abgeschlossen werden. Bitte versuche es erneut.";
	if (m.includes("abo_aktiv")) return "Dein Abo ist noch aktiv. Bitte kündige es zuerst oder kontaktiere den Support, dann kannst du dein Konto löschen.";
	if (m.includes("abo_pruefung_nicht_moeglich")) return "Dein Abo-Status konnte gerade nicht geprüft werden. Dein Konto wurde nicht gelöscht. Bitte versuche es später erneut.";
	if (m.includes("auslastung") || m.includes("rate_limit") || m.includes("overloaded") || m.includes("529")) return "Der Analyse-Dienst ist gerade stark ausgelastet. Bitte in ein bis zwei Minuten erneut versuchen – deine Analysen bleiben erhalten.";
	if (m.includes("zeit:")) return "Die Recherche zu dieser Firma hat ungewöhnlich lange gedauert und wurde abgebrochen. Bitte erneut versuchen – mit Sitz (Ort) oder USt-ID geht es meist schneller.";
	if (m.includes("zugang:") || m.includes("unauthorized")) return "Der Zugang zum Analyse-Dienst wurde abgelehnt. Bitte wende dich an den Support.";
	if (m.includes("dienst:")) return "Der Analyse-Dienst antwortet gerade nicht. Bitte versuche es in Kürze erneut.";
	if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed") || m.includes("network") || m.includes("err_internet")) return "Die Verbindung zum Analyse-Dienst wurde unterbrochen. Bitte versuche es erneut – deine bisherigen Analysen bleiben erhalten.";
	if (m.includes("timeout") || m.includes("timed out") || m.includes("408")) return "Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.";
	if (m.includes("overloaded") || m.includes("rate") || m.includes("429") || m.includes("ausgelastet") || m.includes("529")) return "Der Analyse-Dienst ist gerade stark ausgelastet. Bitte versuche es in einem Moment erneut.";
	if (m.includes("eingabe:")) return "Die Eingabe ist ungültig oder zu lang. Bitte kürzen oder korrigieren und erneut versuchen.";
	if (m.includes("konto nicht aktiv") || m.includes("konto_inaktiv")) return "Dein Konto ist noch nicht aktiviert. Bitte Zugangscode einlösen oder Paket wählen.";
	if (m.includes("quota") || m.includes("kontingent") || m.includes("limit") && !m.includes("rate")) return "Dein Analyse-Kontingent ist aufgebraucht. Bitte wähle ein größeres Paket.";
	if (m.includes("500") || m.includes("502") || m.includes("503") || m.includes("server")) return "Der Server hat gerade ein Problem. Bitte versuche es in einem Moment erneut.";
	return "Die Analyse konnte nicht abgeschlossen werden. Bitte versuche es erneut.";
}

function escapeHtml(s) {
	return String(s == null ? "" : s).replace(/[&<>"']/g, function(c) {
		return {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"\"": "&quot;",
			"'": "&#39;"
		}[c];
	});
}
function sichereFarbe(f, standard) {
	return /^#[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i.test(String(f || "").trim()) ? String(f).trim() : standard || "#22C55E";
}
function hexToRgba(hex, a) {
	hex = (hex || "#22C55E").replace("#", "");
	if (hex.length === 3) hex = hex.split("").map(function(c) {
		return c + c;
	}).join("");
	var n = parseInt(hex, 16);
	return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
}
var lpKlemm = function(v) {
	return v < 0 ? 0 : v > 1 ? 1 : v;
};

var LANG = "de";
try {
	LANG = localStorage.getItem("cc_lang") === "en" ? "en" : "de";
} catch (e) {}
function setLang(wert) {
	LANG = wert;
}
var CURRENT_USER_EMAIL = "";
var CURRENT_USER_NAME = "";
var CURRENT_USER_ID = "";
var CURRENT_FIRMA = null;
var CURRENT_USER_ROLLE = "";
var CURRENT_USER_RANG = "member";
var RANG_GELADEN = false;
var SESSION_GEROUTET = false;
function setCURRENT_USER_EMAIL(wert) {
	CURRENT_USER_EMAIL = wert;
}
function setCURRENT_USER_NAME(wert) {
	CURRENT_USER_NAME = wert;
}
function setCURRENT_USER_ID(wert) {
	CURRENT_USER_ID = wert;
}
function setCURRENT_FIRMA(wert) {
	CURRENT_FIRMA = wert;
}
function setCURRENT_USER_ROLLE(wert) {
	CURRENT_USER_ROLLE = wert;
}
function setCURRENT_USER_RANG(wert) {
	CURRENT_USER_RANG = wert;
}
function setRANG_GELADEN(wert) {
	RANG_GELADEN = wert;
}
function setSESSION_GEROUTET(wert) {
	SESSION_GEROUTET = wert;
}
var TEAM_MEMBERS = [];
var EINLADUNGEN_GELADEN = [];
function setTEAM_MEMBERS(wert) {
	TEAM_MEMBERS = wert;
}
function setEINLADUNGEN_GELADEN(wert) {
	EINLADUNGEN_GELADEN = wert;
}
var UPLOAD_INFO = null;
var UPLOAD_GEWAEHLT = {};
var UPLOAD_ABGESCHLOSSEN = false;
var UPLOAD_GEZEICHNET = false;
var UPLOAD_EINW_GEZEIGT = false;
var PDFJS_GELADEN = null;
var KYC = {
	analyseId: null,
	doks: {},
	urls: {},
	pruefId: null,
	firmenname: "",
	link: null
};
var KYC_ZIEL_NACH_LADEN = null;
var DOK_VIEWER = null;
function setUPLOAD_INFO(wert) {
	UPLOAD_INFO = wert;
}
function setUPLOAD_GEWAEHLT(wert) {
	UPLOAD_GEWAEHLT = wert;
}
function setUPLOAD_ABGESCHLOSSEN(wert) {
	UPLOAD_ABGESCHLOSSEN = wert;
}
function setUPLOAD_GEZEICHNET(wert) {
	UPLOAD_GEZEICHNET = wert;
}
function setUPLOAD_EINW_GEZEIGT(wert) {
	UPLOAD_EINW_GEZEIGT = wert;
}
function setPDFJS_GELADEN(wert) {
	PDFJS_GELADEN = wert;
}
function setKYC(wert) {
	KYC = wert;
}
function setKYC_ZIEL_NACH_LADEN(wert) {
	KYC_ZIEL_NACH_LADEN = wert;
}
function setDOK_VIEWER(wert) {
	DOK_VIEWER = wert;
}
var ORDNER_LIST = [];
var NEUER_ORDNER_SICHT = "privat";
var SELECTED_ORDNER_ID = null;
var HISTORY_FILTER = "alle";
var HISTORY_PRUEFER = "";
var HISTORY_STANDORT = "";
var HU_GEZEIGT = false;
var HISTORY_SORT = "neu";
var FAVORITEN = [];
var FAV_KERNE = {};
var HISTORY_ROWS = [];
function setORDNER_LIST(wert) {
	ORDNER_LIST = wert;
}
function setNEUER_ORDNER_SICHT(wert) {
	NEUER_ORDNER_SICHT = wert;
}
function setSELECTED_ORDNER_ID(wert) {
	SELECTED_ORDNER_ID = wert;
}
function setHISTORY_FILTER(wert) {
	HISTORY_FILTER = wert;
}
function setHISTORY_PRUEFER(wert) {
	HISTORY_PRUEFER = wert;
}
function setHISTORY_STANDORT(wert) {
	HISTORY_STANDORT = wert;
}
function setHU_GEZEIGT(wert) {
	HU_GEZEIGT = wert;
}
function setHISTORY_SORT(wert) {
	HISTORY_SORT = wert;
}
function setFAVORITEN(wert) {
	FAVORITEN = wert;
}
function setFAV_KERNE(wert) {
	FAV_KERNE = wert;
}
function setHISTORY_ROWS(wert) {
	HISTORY_ROWS = wert;
}
var DRUCK_NAME = "";
var DRUCK_ID = "";
var DRUCK_TEIL = "";
var DRUCK_LAEUFT = false;
var DRUCK_SPRACHE = null;
function setDRUCK_NAME(wert) {
	DRUCK_NAME = wert;
}
function setDRUCK_ID(wert) {
	DRUCK_ID = wert;
}
function setDRUCK_TEIL(wert) {
	DRUCK_TEIL = wert;
}
function setDRUCK_LAEUFT(wert) {
	DRUCK_LAEUFT = wert;
}
function setDRUCK_SPRACHE(wert) {
	DRUCK_SPRACHE = wert;
}

function t(key, de) {
	return de;
}
var _TR_CACHE = {};
try {
	_TR_CACHE = JSON.parse(localStorage.getItem("cc_tr_en") || "{}");
} catch (e) {
	_TR_CACHE = {};
}
var _TR_CACHE_DE = {};
try {
	_TR_CACHE_DE = JSON.parse(localStorage.getItem("cc_tr_de") || "{}");
} catch (e) {
	_TR_CACHE_DE = {};
}
function _trCache(ziel) {
	return ziel === "de" ? _TR_CACHE_DE : _TR_CACHE;
}
function _trSpeichern() {
	try {
		localStorage.setItem("cc_tr_en", JSON.stringify(_TR_CACHE));
		localStorage.setItem("cc_tr_de", JSON.stringify(_TR_CACHE_DE));
	} catch (e) {}
}
var _TR_SKIP = /^[\s\d.,:;!?()\[\]{}\/\\|+\-*=<>%&#@~^"'`\u00b7\u2013\u2014\u2026\u2192\u2713\u2605\u20ac$]*$/;
function _trUebersetzbar(s) {
	const t = s.trim();
	if (!t || t.length > 4e3) return false;
	if (_TR_SKIP.test(t)) return false;
	if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/.test(t)) return false;
	if (/^https?:\/\//i.test(t)) return false;
	if (/^(HRB|HRA|KRS|VAT|USt|St\.?-?Nr)[\s.:-]*[\dA-Za-z\s.\/-]{1,24}$/i.test(t)) return false;
	if (/^[+\d][\d\s()\/+-]{5,}$/.test(t)) return false;
	return /[a-zA-Z\u00e4\u00f6\u00fc\u00df\u00c4\u00d6\u00dc]/.test(t);
}

function anzeigeName(vorname, nachname, email) {
	const v = (vorname || "").trim(), n = (nachname || "").trim();
	const voll = (v + " " + n).trim();
	return voll || email || "";
}
async function namenNachtragen() {
	if (!sb) return;
	try {
		await ladeMeinenNamen();
		if (CURRENT_USER_NAME) return;
		let v = "", n = "";
		try {
			const { data } = await sb.auth.getUser();
			const m = data && data.user && data.user.user_metadata || {};
			v = (m.vorname || "").trim();
			n = (m.nachname || "").trim();
		} catch (e) {}
		if (!v && !n) {
			try {
				const g = JSON.parse(localStorage.getItem("cc_name") || "{}");
				v = (g.v || "").trim();
				n = (g.n || "").trim();
			} catch (e) {}
		}
		if (!v && !n) return;
		await sb.rpc("name_setzen", {
			p_vorname: v,
			p_nachname: n
		});
		setCURRENT_USER_NAME(anzeigeName(v, n, ""));
		try {
			localStorage.removeItem("cc_name");
		} catch (e) {}
	} catch (e) {}
}
async function ladeMeinenNamen() {
	if (!sb) return;
	try {
		const { data } = await sb.rpc("mein_name");
		const r = data && data[0] || null;
		setCURRENT_USER_NAME(r ? anzeigeName(r.vorname, r.nachname, "") : "");
	} catch (e) {
		setCURRENT_USER_NAME("");
	}
}

var RANG_SVG = {
	support: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\"/></svg>",
	president: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M3 18h18v2H3v-2zm0-2 2-9 4.5 4L12 5l2.5 6L19 7l2 9H3z\"/></svg>",
	vice: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.95z\"/></svg>",
	senior: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 2l10 10-10 10L2 12z\"/></svg>",
	member: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><circle cx=\"12\" cy=\"12\" r=\"7\"/></svg>"
};
var RANG_INFO = {
	support: {
		name: "Support",
		wert: 5,
		farbe: "support",
		ico: "🔧"
	},
	president: {
		name: "President",
		wert: 4,
		farbe: "pres",
		ico: "★"
	},
	vice: {
		name: "Vice President",
		wert: 3,
		farbe: "vice",
		ico: "✦"
	},
	senior: {
		name: "Senior",
		wert: 2,
		farbe: "senior",
		ico: "◆"
	},
	member: {
		name: "Member",
		wert: 1,
		farbe: "member",
		ico: "●"
	}
};
function rangSymbol(r) {
	return "<span class=\"rang-svg\">" + (RANG_SVG[r] || RANG_SVG.member) + "</span>";
}
function rangWert(r) {
	return (RANG_INFO[r] || RANG_INFO.member).wert;
}
function rangName(r) {
	return (RANG_INFO[r] || RANG_INFO.member).name;
}
function darfVerwalten() {
	return rangWert(CURRENT_USER_RANG) >= 3;
}
function mitgliedName(uid) {
	const m = (TEAM_MEMBERS || []).find(function(x) {
		return x.user_id === uid;
	});
	return m ? m.anzeige || m.email || "?" : "?";
}

function pdfJsLaden() {
	if (PDFJS_GELADEN) return PDFJS_GELADEN;
	setPDFJS_GELADEN(new Promise(function(fertig, fehler) {
		if (window.pdfjsLib) return fertig(window.pdfjsLib);
		const sk = document.createElement("script");
		sk.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
		sk.onload = function() {
			try {
				window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
			} catch (e) {}
			fertig(window.pdfjsLib);
		};
		sk.onerror = function() {
			fehler(new Error("PDF-Anzeige nicht verfuegbar"));
		};
		document.head.appendChild(sk);
	}));
	return PDFJS_GELADEN;
}
async function pdfSeitenAlsBilder(url, maxSeiten) {
	const lib = await pdfJsLaden();
	const doc = await lib.getDocument({ url }).promise;
	const bilder = [];
	const anzahl = Math.min(doc.numPages, maxSeiten || 15);
	for (let i = 1; i <= anzahl; i++) {
		const seite = await doc.getPage(i);
		const sicht = seite.getViewport({ scale: 1.7 });
		const c = document.createElement("canvas");
		c.width = Math.round(sicht.width);
		c.height = Math.round(sicht.height);
		await seite.render({
			canvasContext: c.getContext("2d"),
			viewport: sicht
		}).promise;
		bilder.push(c.toDataURL("image/jpeg", .82));
	}
	return bilder;
}
async function exifDrehungDatei(file) {
	try {
		return exifDrehungPuffer(await file.slice(0, 262144).arrayBuffer());
	} catch (e) {
		return 0;
	}
}
function exifDrehungPuffer(buf) {
	try {
		const v = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer);
		if (v.getUint16(0) !== 65496) return 0;
		let o = 2;
		while (o + 4 < v.byteLength && o < 262144) {
			const marker = v.getUint16(o), laenge = v.getUint16(o + 2);
			if (marker === 65505 && v.getUint32(o + 4) === 1165519206) {
				const t = o + 10, le = v.getUint16(t) === 18761;
				const ifd = t + v.getUint32(t + 4, le), n = v.getUint16(ifd, le);
				for (let i = 0; i < n; i++) {
					const e = ifd + 2 + i * 12;
					if (v.getUint16(e, le) === 274) {
						const w = v.getUint16(e + 8, le);
						return w === 3 ? 180 : w === 6 ? 90 : w === 8 ? 270 : 0;
					}
				}
				return 0;
			}
			if ((marker & 65280) !== 65280) return 0;
			o += 2 + laenge;
		}
	} catch (e) {}
	return 0;
}

function bezText(b) {
	return b == null ? "" : String(b).replace(/\bRueckseite\b/g, "Rückseite");
}
function feldLabel(key, wert) {
	const k = String(key || "");
	if (/^Handelsregister\s*\(HR[AB]\)$/i.test(k)) {
		const m = String(wert || "").match(/\b(HR[AB]|GnR|PR|VR)\b/);
		return m ? "Handelsregister (" + m[1] + ")" : "Handelsregister";
	}
	return k;
}
function historieZeileSlim(r) {
	if (!r || !("rj_firmenname" in r || "rj_name" in r || "rj_orig" in r)) return r;
	const rj = {};
	if (r.rj_firmenname != null) rj.firmenname = r.rj_firmenname;
	if (r.rj_orig != null) rj.firmennameOriginal = r.rj_orig;
	if (r.rj_name != null) rj._name = r.rj_name;
	if (r.rj_email != null) rj._email = r.rj_email;
	if (r.rj_api) rj._api = r.rj_api;
	delete r.rj_firmenname;
	delete r.rj_orig;
	delete r.rj_name;
	delete r.rj_email;
	delete r.rj_api;
	r.report_json = rj;
	r._slim = true;
	return r;
}
function historieZeilenMischen(neue) {
	const vorhanden = {};
	HISTORY_ROWS.forEach(function(r) {
		if (r.id) vorhanden[r.id] = true;
	});
	let dazu = 0;
	(neue || []).forEach(function(r) {
		if (r && r.id && !vorhanden[r.id]) {
			HISTORY_ROWS.push(r);
			vorhanden[r.id] = true;
			dazu++;
		}
	});
	if (dazu) {
		HISTORY_ROWS.sort(function(a, b) {
			const x = String(b.created_at || ""), y = String(a.created_at || "");
			return x < y ? -1 : x > y ? 1 : 0;
		});
	}
	return dazu;
}
function histVerdictClass(v) {
	return v === "ok" ? "ok" : v === "bad" ? "bad" : "warn";
}
function histVerdictIcon(v) {
	return v === "ok" ? "✓" : v === "bad" ? "✕" : "⚠";
}
function ordnerFehlerText(e) {
	const m = e && e.message || "";
	if (e && (e.code === "23505" || /duplicate key|unique/i.test(m))) {
		return LANG === "en" ? "A folder with this name already exists." : "Ein Ordner mit diesem Namen existiert schon.";
	}
	return m;
}
function historieSlimAbgelehnt(err) {
	const code = String(err && err.code || "");
	const msg = String(err && err.message || "");
	if (/^(42703|42883|PGRST100|PGRST200)$/.test(code)) return true;
	return /column|json|operator|schema cache|does not exist/i.test(msg);
}
function ordnerWarte(ms) {
	return new Promise(function(r) {
		setTimeout(r, ms);
	});
}

var API_RENDER = !!API_PDF_TOKEN;
var _W_DE = new Set("der die das und ist nicht mit von den dem des ein eine einer einen eines wird wurde werden wurden sind zu für fuer auf im bei keine kein keinen oder auch als nach bitte liegt vor beide sowie kann sollte sich noch".split(" "));
var _W_EN = new Set("the and is not with of to for on at no or after please are were be been has have this that by from both found can should will its their which".split(" "));
function textSprache(t) {
	const w = String(t || "").toLowerCase().split(/[^a-z\u00e4\u00f6\u00fc\u00df]+/).filter(Boolean);
	if (w.length < 3) return null;
	let de = 0, en = 0;
	w.forEach(function(x) {
		if (_W_DE.has(x)) de++;
		if (_W_EN.has(x)) en++;
	});
	return de > en ? "de" : en > de ? "en" : null;
}
function berichtSprache(d) {
	if (!d) return "de";
	if (d._sprache === "en" || d._sprache === "de") return d._sprache;
	const teile = [d.empfehlung].concat((d.risikoHinweise || []).map(function(h) {
		return h && h.text;
	}));
	[
		"grunddaten",
		"personen",
		"finanzen",
		"reputation",
		"kontakt"
	].forEach(function(k) {
		(d[k] && d[k].felder || []).forEach(function(f) {
			teile.push(f && f.value);
		});
	});
	return textSprache(teile.filter(function(x) {
		return typeof x === "string";
	}).join(" . ")) || "de";
}
function druckZeitText() {
	return druckZeitFormat(new Date());
}
function druckZeitFormat(datum) {
	const zone = API_RENDER ? { timeZone: "Europe/Berlin" } : {};
	if (druckSprache() === "en") {
		return datum.toLocaleDateString("en-GB", Object.assign({
			day: "2-digit",
			month: "short",
			year: "numeric"
		}, zone)) + ", " + datum.toLocaleTimeString("en-GB", Object.assign({
			hour: "2-digit",
			minute: "2-digit"
		}, zone));
	}
	return datum.toLocaleDateString("de-DE", Object.assign({
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}, zone)) + ", " + datum.toLocaleTimeString("de-DE", Object.assign({
		hour: "2-digit",
		minute: "2-digit"
	}, zone)) + " Uhr";
}
function druckSprache() {
	return DRUCK_SPRACHE || LANG;
}
var DRUCK_TXT = {
	de: {
		pruefId: "Prüf-ID",
		gedruckt: "gedruckt",
		ordner: "Ordner",
		wzDiag: "Akte nicht<br>abgeschlossen",
		wzFuss: "ENTWURF · Akte nicht abgeschlossen · gedruckt am ",
		banTitel: "Entwurf – Akte nicht abgeschlossen",
		banText1: "Dieser Ausdruck vom ",
		banText2: " zeigt einen vorläufigen Stand",
		banAkte: " der Akte ",
		banText3: ". Verbindlich ist erst die abgeschlossene Akte.",
		dateiEntwurf: " - ENTWURF (nicht abgeschlossen)",
		pruefung: "Compliance-Prüfung",
		apiTitel: "Automatische Prüfung über die REST-API",
		apiErstellt: "erstellt am",
		teile: {
			gesamt: "Akte",
			analyse: "Analyse",
			sanktion: "Sanktionsabgleich",
			dokumente: "Dokumente",
			endverbleib: "Endverbleibserklärung"
		}
	},
	en: {
		pruefId: "Check ID",
		gedruckt: "printed",
		ordner: "Folder",
		wzDiag: "File not<br>finalised",
		wzFuss: "DRAFT · File not finalised · printed on ",
		banTitel: "Draft – file not finalised",
		banText1: "This printout of ",
		banText2: " shows a preliminary state",
		banAkte: " of file ",
		banText3: ". Only the finalised file is binding.",
		dateiEntwurf: " - DRAFT (not finalised)",
		pruefung: "Compliance check",
		apiTitel: "Automated check via REST API",
		apiErstellt: "created on",
		teile: {
			gesamt: "File",
			analyse: "Analysis",
			sanktion: "Sanctions check",
			dokumente: "Documents",
			endverbleib: "End-use declaration"
		}
	}
};
function DT() {
	return DRUCK_TXT[druckSprache() === "en" ? "en" : "de"];
}

var authMode = "login";
var _LANG_DE = new WeakMap();
var _TR_RUECK = null;
var _TR_RUECK_N = -1;
function _trOriginalFuer(wert) {
	try {
		const roh = String(wert == null ? "" : wert), s = roh.trim();
		if (!s) return roh;
		const anzahl = Object.keys(_TR_CACHE).length;
		if (!_TR_RUECK || _TR_RUECK_N !== anzahl) {
			_TR_RUECK = {};
			Object.keys(_TR_CACHE).forEach(function(de) {
				const en = _TR_CACHE[de];
				if (typeof en === "string" && en && en !== de && _TR_RUECK[en] === undefined) _TR_RUECK[en] = de;
			});
			_TR_RUECK_N = anzahl;
		}
		const de = _TR_RUECK[s];
		return de !== undefined ? roh.replace(s, de) : roh;
	} catch (e) {
		return wert;
	}
}
function kloneMitOriginal(quelle) {
	const kopie = quelle.cloneNode(true);
	try {
		const wq = document.createTreeWalker(quelle, NodeFilter.SHOW_TEXT), wk = document.createTreeWalker(kopie, NodeFilter.SHOW_TEXT);
		let q, k;
		while ((q = wq.nextNode()) && (k = wk.nextNode())) {
			const orig = _LANG_DE.has(q) ? _LANG_DE.get(q) : _trOriginalFuer(q.nodeValue);
			if (orig === undefined || orig === null) continue;
			_LANG_DE.set(k, orig);
			_trAnwenden(k);
		}
	} catch (e) {}
	return kopie;
}
function _trKnoten(root) {
	const raus = [];
	let w;
	try {
		w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	} catch (e) {
		return raus;
	}
	let n;
	while (n = w.nextNode()) {
		if (!n.nodeValue || !n.nodeValue.trim()) continue;
		const p = n.parentNode;
		if (!p) continue;
		if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(p.nodeName)) continue;
		try {
			if (p.closest && p.closest("[id^=\"legal\"], [data-tr=\"aus\"]")) continue;
		} catch (e) {}
		if (!_LANG_DE.has(n)) _LANG_DE.set(n, _trOriginalFuer(n.nodeValue));
		raus.push(n);
	}
	return raus;
}
function _trAttribute() {
	let els = [];
	try {
		els = document.querySelectorAll("[placeholder], [title]");
	} catch (e) {
		return [];
	}
	const offen = [];
	els.forEach(function(el) {
		try {
			if (el.closest && el.closest("#supDash")) return;
		} catch (e) {}
		["placeholder", "title"].forEach(function(attr) {
			const wert = el.getAttribute(attr);
			if (wert === null) return;
			const merk = "tr" + attr;
			if (!el.dataset[merk]) el.dataset[merk] = wert;
			const de = (el.dataset[merk] || "").trim();
			if (!de) return;
			if (LANG !== "en") {
				el.setAttribute(attr, el.dataset[merk]);
				return;
			}
			const en = _TR_CACHE[de];
			if (en !== undefined) el.setAttribute(attr, el.dataset[merk].replace(de, en));
			else if (_trUebersetzbar(de) && offen.indexOf(de) < 0) offen.push(de);
		});
	});
	return offen;
}
function _trAnwenden(n) {
	const orig = _LANG_DE.get(n);
	if (orig === undefined) return;
	if (LANG !== "en") {
		if (n.nodeValue !== orig) n.nodeValue = orig;
		return;
	}
	const de = orig.trim();
	const en = _TR_CACHE[de];
	if (en !== undefined && en !== null) {
		const neu = orig.replace(de, en);
		if (n.nodeValue !== neu) n.nodeValue = neu;
	}
}
var _TR_LAUFT = false;
var _TR_WARTEND = new Set();
async function uebersetzeBaum(root, sofortFertig) {
	if (!root || !root.nodeType) return;
	if (typeof LP_EN !== "undefined" && !uebersetzeBaum._lpGeladen) {
		Object.keys(LP_EN).forEach(function(de) {
			if (_TR_CACHE[de] === undefined) _TR_CACHE[de] = LP_EN[de];
		});
		uebersetzeBaum._lpGeladen = true;
	}
	const knoten = _trKnoten(root);
	knoten.forEach(_trAnwenden);
	if (LANG !== "en") return;
	const offen = [];
	knoten.forEach(function(n) {
		const de = (_LANG_DE.get(n) || "").trim();
		if (!de || !_trUebersetzbar(de)) return;
		if (_TR_CACHE[de] !== undefined) return;
		if (offen.indexOf(de) < 0) offen.push(de);
		_TR_WARTEND.add(n);
	});
	try {
		_trAttribute().forEach(function(de) {
			if (offen.indexOf(de) < 0) offen.push(de);
		});
	} catch (e) {}
	if (!offen.length) return;
	if (sofortFertig === true) return;
	await _trNachladen(offen);
}
async function _trPaket(teil, tiefe, ziel, streng) {
	if (!teil.length) return;
	ziel = ziel === "de" ? "de" : "en";
	const cache = _trCache(ziel);
	try {
		const res = await workerCall("texte_uebersetzen", {
			texte: teil,
			ziel
		});
		if (res && res.ok && Array.isArray(res.texte) && res.texte.length === teil.length) {
			teil.forEach(function(q, k) {
				if (typeof res.texte[k] === "string") cache[q] = res.texte[k];
			});
			_trSpeichern();
			return;
		}
		throw new Error(res && res.error || "unvollstaendig");
	} catch (e) {
		if (teil.length > 1 && tiefe < 4) {
			const m = Math.ceil(teil.length / 2);
			await _trPaket(teil.slice(0, m), tiefe + 1, ziel, streng);
			await _trPaket(teil.slice(m), tiefe + 1, ziel, streng);
		} else if (streng) {
			throw e;
		} else {
			teil.forEach(function(q) {
				if (cache[q] === undefined) cache[q] = q;
			});
			_trSpeichern();
			console.warn("Uebersetzung fehlgeschlagen:", e && e.message || "", teil[0] && teil[0].slice(0, 40));
		}
	}
}
var _TR_NOCHMAL = false;
var _TR_RUNDEN = 0;
async function _trNachladen(offen) {
	if (_TR_LAUFT) {
		_TR_NOCHMAL = true;
		_trOverlay(true);
		return;
	}
	_TR_LAUFT = true;
	_trOverlay(true);
	try {
		const pakete = [];
		let akt = [], zeichen = 0;
		offen.forEach(function(s) {
			if (akt.length >= 25 || zeichen + s.length > 6e3) {
				if (akt.length) pakete.push(akt);
				akt = [];
				zeichen = 0;
			}
			akt.push(s);
			zeichen += s.length;
		});
		if (akt.length) pakete.push(akt);
		for (let i = 0; i < pakete.length; i++) {
			const teil = pakete[i];
			await _trPaket(teil, 0);
		}
		_TR_WARTEND.forEach(function(n) {
			if (n.isConnected !== false) _trAnwenden(n);
		});
		_TR_WARTEND.clear();
		try {
			uebersetzeBaum(document.body, true);
		} catch (e) {}
		try {
			_trAttribute();
		} catch (e) {}
		try {
			const rest = [];
			_trKnoten(document.body).forEach(function(n) {
				const de = (_LANG_DE.get(n) || "").trim();
				if (de && _trUebersetzbar(de) && _TR_CACHE[de] === undefined && rest.indexOf(de) < 0) rest.push(de);
			});
			if (rest.length && _TR_RUNDEN < 3) {
				_TR_NOCHMAL = true;
				_TR_RUNDEN++;
			}
		} catch (e) {}
	} finally {
		_TR_LAUFT = false;
	}
	if (_TR_NOCHMAL) {
		_TR_NOCHMAL = false;
		try {
			await uebersetzeBaum(document.body);
		} catch (e) {}
	}
	if (!_TR_LAUFT && !_TR_NOCHMAL) _trOverlay(false);
}
function _trOverlay(an) {
	let o = document.getElementById("trOverlay");
	if (an) {
		if (o) {
			o._soll = true;
			o.classList.add("an");
			return;
		}
		if (!o) {
			o = document.createElement("div");
			o.id = "trOverlay";
			o.style.cssText = "opacity:0;transform:translateY(10px) scale(.94);transition:opacity .3s ease, transform .3s cubic-bezier(.2,.9,.3,1.3);position:fixed;bottom:64px;left:16px;z-index:10002;background:#fff;border:1.5px solid rgba(34,197,94,.35);border-radius:12px;padding:9px 14px;font-size:12.5px;font-weight:700;color:#16A34A;box-shadow:0 10px 26px -12px rgba(10,15,13,.3);display:flex;align-items:center;gap:8px;";
			o.innerHTML = "<span style=\"width:13px;height:13px;border:2px solid rgba(34,197,94,.3);border-top-color:#16A34A;border-radius:50%;display:inline-block;animation:upSpin .8s linear infinite;\"></span><span>Translating…</span>";
			document.body.appendChild(o);
			o._soll = true;
			void o.offsetWidth;
			requestAnimationFrame(function() {
				if (o._soll) o.classList.add("an");
			});
		}
	} else if (o) {
		o._soll = false;
		o.classList.remove("an");
		setTimeout(function() {
			if (o.parentNode && !o.classList.contains("an")) o.remove();
		}, 300);
	}
}
var _trTimer = null;
try {
	new MutationObserver(function(muts) {
		if (LANG !== "en") return;
		let neuerInhalt = false;
		muts.forEach(function(m) {
			if (!m.addedNodes) return;
			for (let i = 0; i < m.addedNodes.length; i++) {
				const nd = m.addedNodes[i];
				if (nd.id === "trOverlay") continue;
				const _ndEl = nd.nodeType === 1 ? nd : nd.parentNode;
				try {
					if (_ndEl && _ndEl.closest && _ndEl.closest("#supDash")) continue;
				} catch (e) {}
				if (nd.nodeType === 1) {
					uebersetzeBaum(nd, true);
					neuerInhalt = true;
				} else if (nd.nodeType === 3 && nd.parentNode) {
					uebersetzeBaum(nd.parentNode, true);
					neuerInhalt = true;
				}
			}
		});
		if (!neuerInhalt) return;
		clearTimeout(_trTimer);
		_trTimer = setTimeout(function() {
			if (LANG !== "en") return;
			_trOverlay(true);
			uebersetzeBaum(document.body).then(function() {
				if (!_TR_LAUFT && !_TR_NOCHMAL) _trOverlay(false);
			}).catch(function() {
				if (!_TR_LAUFT && !_TR_NOCHMAL) _trOverlay(false);
			});
		}, 260);
	}).observe(document.body || document.documentElement, {
		childList: true,
		subtree: true
	});
} catch (e) {}
function authToggleHtml(reg) {
	return reg ? "Schon ein Konto? <a data-act-click=\"h30\">Jetzt anmelden</a>" : "Noch kein Konto? <a data-act-click=\"h30\">Jetzt registrieren</a>";
}
function refreshAuthTexts() {
	const title = document.getElementById("authTitle");
	const btn = document.getElementById("authBtn");
	const toggle = document.getElementById("authToggle");
	if (!title || !btn || !toggle) return;
	const reg = typeof authMode !== "undefined" && authMode === "register";
	title.textContent = reg ? t("auth_t_reg", "Konto erstellen") : t("auth_t_login", "Anmelden");
	btn.textContent = reg ? t("auth_b_reg", "Registrieren") : t("auth_b_login", "Anmelden");
	toggle.innerHTML = authToggleHtml(reg);
	const verg = document.getElementById("authVergessen");
	if (verg) verg.style.display = reg ? "none" : "";
	const nam = document.getElementById("authNamen");
	if (nam) nam.style.display = reg ? "" : "none";
}
var LP_EN = {
	"Produktvideo · 80 Sekunden": "Product video · 80 seconds",
	"Der Compliance-Checker im Überblick": "The Compliance Checker at a glance",
	"Von der ersten Prüfung bis zur abgeschlossenen Akte – einmal komplett durchgespielt.": "From the first check to the closed file – shown end to end.",
	"Anmelden": "Sign in",
	"Kostenlos testen": "Try for free",
	"KYC & Compliance · Prüfung gemäß §§ 10–17 GwG": "KYC & Compliance · Checks under Sections 10–17 GwG",
	"Know Your Customer in Minuten.": "Know Your Customer in minutes.",
	"Sauber dokumentiert.": "Properly documented.",
	"Geschäftspartner prüfen und identifizieren – in einem Werkzeug. Register, wirtschaftlich Berechtigte, Sanktions- & PEP-Listen, dazu Ausweis und Bestätigungsfoto in derselben Akte. Am Ende steht ein PDF-Nachweis mit Quellen.": "Screen and identify business partners – in one tool. Registers, beneficial owners, sanctions & PEP lists, plus ID document and confirmation photo in the same file. The result is a PDF report with sources.",
	"Kostenlos testen – 3 Analysen gratis": "Try for free – 3 analyses included",
	"✓ Keine Kreditkarte nötig": "✓ No credit card required",
	"✓ Datenspeicherung in der EU": "✓ Data stored in the EU",
	"✓ Deutsch & Englisch": "✓ German & English",
	"⚖️ Wie die Bewertung funktioniert": "⚖️ How the scoring works",
	"🔍 Woher die Daten stammen": "🔍 Where the data comes from",
	"Länder im Detail": "Countries in detail",
	"PDF": "PDF",
	"Nachweis je Prüfung": "Evidence per check",
	"Deine Vorteile": "Your benefits",
	"Alles, was du für die geldwäscherechtliche Prüfung deiner Geschäftspartner brauchst – an einem Ort.": "Everything you need for anti-money-laundering checks of your business partners – in one place.",
	"Prüfung in Minuten": "Checks in minutes",
	"Name + Land eingeben – mehr nicht": "Enter name + country – that's it",
	"KI durchsucht Register, Presse & Web": "AI searches registers, press & web",
	"Klarer Vertrauens-Score von 0–100": "Clear trust score from 0–100",
	"Sanktions- & PEP-Screening": "Sanctions & PEP screening",
	"Konsolidierte EU-Sanktionsliste, täglich aktuell": "Consolidated EU sanctions list, updated daily",
	"Von den Machern des Compliance-Checkers": "From the makers of the Compliance Checker",
	"Wiederkehrende Arbeit?": "Repetitive work?",
	"Die automatisieren wir.": "We automate it.",
	"Automati Labs entwickelt KI-Werkzeuge für Unternehmen – vom internen Tool über automatisierte Abläufe bis zum Assistenten, der E-Mails und Anfragen übernimmt. Individuell gebaut, sauber dokumentiert, in Deutschland betreut.": "Automati Labs builds AI tools for companies – from internal software and automated workflows to assistants that handle emails and requests. Custom-built, well documented, supported in Germany.",
	"KI-Assistenten": "AI assistants",
	"Prozess-Automatisierung": "Process automation",
	"Interne Software": "Internal software",
	"Kostenloses Erstgespräch": "Free initial consultation",
	"Vorhandene Akte öffnen": "Open existing file",
	"Einzelne Bereiche oder die ganze Akte drucken": "Print single sections or the whole file",
	"Vier Ränge vom President bis zum Member": "Four ranks from President to Member",
	"Ordner gezielt für Gruppen & Standorte freigeben": "Share folders with specific groups & locations",
	"Akte abschließen": "Close the file",
	"Dokumente ergänzen, Vollständigkeit bestätigen und die gesamte Akte als PDF ablegen – bereit für jede Prüfung.": "Add documents, confirm completeness and file the whole record as a PDF – ready for any audit.",
	"Eine Akte pro Geschäftspartner": "One file per business partner",
	"Eine Prüfung allein reicht der Aufsicht nicht. Jedes Unternehmen bekommt eine eigene Akte – mit allem, was dazugehört, sauber in Bereiche gegliedert und auf Knopfdruck als ein Dokument.": "A check alone is not enough for the regulator. Every company gets its own file – with everything that belongs to it, neatly organised into sections and available as one document at the push of a button.",
	"Vertrauens-Score mit nachvollziehbarer Rechnung": "Trust score with a transparent calculation",
	"Grunddaten, Personen, Finanzen, Reputation": "Core data, people, finances, reputation",
	"Fehlende Angaben selbst ergänzen und neu bewerten": "Add missing details yourself and re-evaluate",
	"Dokumente": "Documents",
	"Ausweis und Bestätigungsfoto hinterlegen": "Store ID and confirmation photo",
	"Sicherer Upload-Link – der Partner lädt selbst hoch": "Secure upload link – the partner uploads directly",
	"Handelsregisterauszüge werden ausgelesen": "Commercial register extracts are read automatically",
	"Sanktionslisten": "Sanctions lists",
	"Sanktionsliste · täglich aktuell": "Sanctions list · updated daily",
	"Unternehmen und Personen gegen die EU-Liste": "Companies and persons against the EU list",
	"Auch bei abweichender Schreibweise": "Even with differing spellings",
	"Listenstand im Bericht dokumentiert": "List version documented in the report",
	"Endverbleibserklärung": "End-use declaration",
	"Für den Fahrzeughandel": "For vehicle dealers",
	"Vorausgefüllt mit Käufer, Ort und Datum": "Pre-filled with buyer, place and date",
	"Unterschriebene Fassung direkt in der Akte": "Signed version stored in the file",
	"Abschluss": "Completion",
	"Vollständigkeit mit Datum und Namen bestätigen": "Confirm completeness with date and name",
	"Abgeschlossene Akten auf einen Blick erkennbar": "Closed files recognisable at a glance",
	"Jederzeit wieder öffnen": "Reopen at any time",
	"Als PDF": "As PDF",
	"Gesamte Akte als ein Dokument": "The whole file as one document",
	"Oder einzelne Bereiche separat": "Or individual sections separately",
	"PEP-Prüfung der verantwortlichen Personen": "PEP check of responsible persons",
	"K.O.-Kriterien klar gekennzeichnet": "Knock-out criteria clearly flagged",
	"Nachweise für die Akte": "Evidence for your files",
	"PDF-Bericht mit Quellenangaben": "PDF report with source references",
	"Manipulationssichere Prüf-ID": "Tamper-proof check ID",
	"International einsetzbar": "Works internationally",
	"56 Länder im Detail, weltweit nutzbar": "56 countries in detail, usable worldwide",
	"Suche in Landessprache (KRS, EGRUL & Co.)": "Searches in local language (KRS, EGRUL & more)",
	"Berichte auf Deutsch oder Englisch": "Reports in German or English",
	"Für dein ganzes Team": "For your whole team",
	"Geteiltes Kontingent für alle Mitarbeiter": "Shared quota for all staff",
	"Ordner für Kunden & Vorgänge": "Folders for clients & cases",
	"Fair & planbar": "Fair & predictable",
	"Fester Monatspreis, klare Pakete": "Fixed monthly price, clear packages",
	"3 Gratis-Analysen zum Start": "3 free analyses to start",
	"Von 100 bis 1.000 Analysen im Monat": "From 100 to 1,000 analyses per month",
	"So funktioniert's": "How it works",
	"Vier Schritte – von der Registrierung bis zum fertigen Nachweis.": "Four steps – from sign-up to the finished report.",
	"Kostenlos registrieren": "Register for free",
	"Konto erstellen und sofort loslegen – deine ersten 3 Analysen sind gratis. Keine Kreditkarte nötig.": "Create an account and start right away – your first 3 analyses are free. No credit card required.",
	"Unternehmen eingeben": "Enter a company",
	"Name des Unternehmens + Land, optional die USt-ID für eine präzise Zuordnung.": "Company name + country, optionally the VAT ID for a precise match.",
	"KI prüft & bewertet": "AI checks & scores",
	"Handelsregister, wirtschaftlich Berechtigte, Sanktions- & PEP-Listen, Presse – alles mit Quellen und Vertrauens-Score.": "Commercial register, beneficial owners, sanctions & PEP lists, press – all with sources and a trust score.",
	"PDF ablegen": "File the PDF",
	"Bericht herunterladen und in deiner Akte ablegen – bereit für jede Prüfung.": "Download the report and file it – ready for any audit.",
	"Die vollständige Akte – nicht nur die Analyse": "The complete file – not just the analysis",
	"Eine Prüfung allein reicht der Aufsicht nicht. Der Compliance-Checker sammelt alles, was zu einem Geschäftspartner gehört, an einem Ort – und gibt es auf Knopfdruck als geschlossenes Dokument aus.": "A check alone is not enough for regulators. The Compliance Checker collects everything that belongs to a business partner in one place – and exports it as a single document at the push of a button.",
	"Ausweis & Bestätigungsfoto": "ID document & confirmation photo",
	"Personalausweis zu jeder Prüfung hinterlegen": "Attach an ID document to every check",
	"Bestätigungsfoto der handelnden Person": "Confirmation photo of the acting person",
	"Verschlüsselt gespeichert in der EU": "Stored encrypted in the EU",
	"Sicherer Upload-Link": "Secure upload link",
	"Link erzeugen und dem Geschäftspartner schicken": "Generate a link and send it to your business partner",
	"Er lädt selbst hoch – ganz ohne Konto": "They upload themselves – no account needed",
	"Einmalig nutzbar, danach automatisch ungültig": "Single use, automatically expires afterwards",
	"Akte als ein PDF": "File as one PDF",
	"Bericht, Ausweis und Foto in einem Dokument": "Report, ID and photo in one document",
	"Ganze Ordner auf einmal exportieren": "Export entire folders at once",
	"Jede Anlage sauber beschriftet und zugeordnet": "Every attachment clearly labelled and assigned",
	"Nachvollziehbar bis ins Detail": "Traceable down to the detail",
	"Compliance lebt davon, dass jemand später versteht, wie ein Ergebnis zustande kam. Deshalb legen wir offen, wie bewertet wird – und woher die Informationen stammen.": "Compliance depends on someone later understanding how a result came about. That's why we disclose how we score – and where the information comes from.",
	"Offengelegte Bewertung": "Transparent scoring",
	"Fünf Prüfbereiche, vier eigenständige Warnsignale, drei klare Einstufungen – vollständig dokumentiert und jederzeit einsehbar.": "Five assessment areas, four independent warning signals, three clear ratings – fully documented and viewable at any time.",
	"Belegte Herkunft": "Documented sources",
	"Jede Kernaussage ist ihrer Quellenkategorie zugeordnet. Was nicht belegbar ist, wird als Lücke ausgewiesen statt geschätzt.": "Every key statement is assigned to its source category. What cannot be verified is reported as a gap rather than guessed.",
	"Deutsch & Englisch": "German & English",
	"Oberfläche und Berichte auf Knopfdruck in beiden Sprachen – für internationale Geschäftspartner und Konzernprüfungen.": "Interface and reports in both languages at the push of a button – for international partners and group audits.",
	"Bewertung im Detail": "Scoring in detail",
	"Datenquellen ansehen": "View data sources",
	"Nicht nur einmal prüfen – dauerhaft im Blick behalten": "Don't just check once – keep watching",
	"Eine Prüfung ist eine Momentaufnahme. Bei Geschäftspartnern, mit denen Sie über Jahre arbeiten, kann sich viel ändern – ohne dass Sie davon erfahren. Markieren Sie ein Unternehmen mit dem Stern, und der Compliance-Checker prüft es": "A check is a snapshot. With partners you work with for years, a lot can change – without you hearing about it. Mark a company with the star, and the Compliance Checker re-checks it",
	"alle drei Monate automatisch neu": "automatically every three months",
	"Mit einem Klick markieren": "Mark with one click",
	"Ein Stern in der Historie genügt. Jederzeit wieder abschaltbar – kein Abo, keine Bindung.": "A star in the history is all it takes. Switch it off any time – no subscription, no commitment.",
	"Automatisch alle 3 Monate": "Automatically every 3 months",
	"Die erneute Prüfung läuft im Hintergrund. Der Bericht landet automatisch in der Akte des Unternehmens.": "The re-check runs in the background. The report is filed automatically with the company.",
	"Sofort informiert bei Änderungen": "Informed immediately of changes",
	"Neuer Sanktions-Treffer, Insolvenzhinweis, Wechsel in der Geschäftsführung oder gefallener Score – Sie sehen sofort, was sich verändert hat.": "New sanctions hit, insolvency notice, change of management or a dropped score – you see immediately what has changed.",
	"Transparent abgerechnet:": "Transparent billing:",
	"Jede automatische Prüfung zählt wie eine normale Analyse gegen Ihr Monatskontingent – also vier pro Jahr und Unternehmen. Ist das Kontingent aufgebraucht, wird nicht geprüft. Keine versteckten Kosten, keine Zusatzgebühr.": "Every automatic check counts like a normal analysis against your monthly quota – four per year and company. If the quota is used up, no check is run. No hidden costs, no extra fees.",
	"Sanktionslisten – direkt abgeglichen, nicht recherchiert": "Sanctions lists – matched directly, not researched",
	"Jede Prüfung gleicht Namen unmittelbar gegen die": "Every check matches names directly against the",
	"konsolidierte Sanktionsliste der Europäischen Union": "consolidated sanctions list of the European Union",
	"ab. Nicht über eine Internetsuche, sondern gegen die amtliche Liste selbst – täglich aktualisiert und mit dokumentiertem Stand.": ". Not via a web search, but against the official list itself – updated daily with a documented version date.",
	"Amtliche Quelle": "Official source",
	"Die Liste stammt unverändert von der Europäischen Kommission – dieselbe Grundlage, die auch Banken und Behörden verwenden.": "The list comes unchanged from the European Commission – the same basis used by banks and authorities.",
	"Täglich aktualisiert": "Updated daily",
	"Der Abgleich läuft gegen den jeweils aktuellen Stand. In jedem Bericht ist festgehalten, gegen welchen Listenstand geprüft wurde.": "Matching runs against the current version. Every report records which list version was used.",
	"Auch ähnliche Schreibweisen": "Similar spellings too",
	"Umlaute, Bindestriche, abweichende Transkriptionen – der Abgleich erkennt Namensvarianten, nicht nur exakte Übereinstimmungen.": "Umlauts, hyphens, different transliterations – matching recognises name variants, not just exact matches.",
	"Was ein Treffer bedeutet:": "What a hit means:",
	"Ein Treffer weist auf eine Namensgleichheit oder Ähnlichkeit hin – nicht darauf, dass es sich um dieselbe Person handelt. Ob tatsächlich Identität vorliegt, muss gesondert ermittelt werden. Der Bericht macht diesen Unterschied ausdrücklich deutlich.": "A hit indicates a name match or similarity – not that it is the same person. Whether identity actually exists must be determined separately. The report makes this distinction explicit.",
	"Preise": "Pricing",
	"Alle Pakete enthalten": "All packages include",
	"denselben vollen Funktionsumfang": "the same full feature set",
	"– sie unterscheiden sich nur in der Anzahl der Analysen pro Monat. Laufzeit 12 Monate, monatliche Abrechnung.": "– they differ only in the number of analyses per month. 12-month term, billed monthly.",
	"✓ Die ersten 3 Analysen sind kostenlos": "✓ The first 3 analyses are free",
	"Ohne Kreditkarte, ohne Verpflichtung – einfach ausprobieren.": "No credit card, no commitment – just try it.",
	"In jedem Paket enthalten": "Included in every package",
	"Prüfung nach §§ 10–17 GwG": "Checks under Sections 10–17 GwG",
	"PDF-Nachweis mit Quellen": "PDF report with sources",
	"Ausweis- und Foto-Ablage": "ID and photo storage",
	"Ordner & Akten-Export": "Folders & file export",
	"Team mit Rängen": "Team with ranks",
	"Datenspeicherung in der EU": "Data stored in the EU",
	"Speicherung in der EU": "Stored in the EU",
	"Für wen?": "Who is it for?",
	"Für alle, die nach dem Geldwäschegesetz prüfen müssen – oder einfach wissen wollen, mit wem sie Geschäfte machen.": "For everyone who has to check under anti-money-laundering law – or simply wants to know who they're doing business with.",
	"Autohändler": "Car dealers",
	"Kanzleien & Steuerberater": "Law firms & tax advisors",
	"Immobilienmakler": "Real estate agents",
	"Finanzdienstleister": "Financial service providers",
	"Güterhändler": "Goods traders",
	"Kostenlos starten": "Start for free",
	"Bereit? Deine ersten 3 Analysen sind gratis.": "Ready? Your first 3 analyses are free.",
	"Jetzt kostenlos testen": "Try it free now",
	"✓ In 2 Minuten startklar": "✓ Ready in 2 minutes",
	"Intelligente KI-Systeme für Ihr Unternehmen.": "Intelligent AI systems for your business.",
	"Der Compliance-Checker ist ein Produkt der Automati Labs GmbH – entwickelt für Unternehmen, die ihre gesetzlichen Sorgfaltspflichten ernst nehmen.": "The Compliance Checker is a product of Automati Labs GmbH – built for companies that take their legal due diligence seriously.",
	"Compliance-Checker": "Compliance Checker",
	"Vorteile": "Benefits",
	"Die digitale Akte": "The digital file",
	"Laufende Überwachung": "Ongoing monitoring",
	"Transparenz": "Transparency",
	"Wie bewertet wird": "How we score",
	"Woher die Daten stammen": "Where the data comes from",
	"Impressum": "Legal notice",
	"Datenschutz": "Privacy",
	"AGB": "Terms",
	"Kontakt": "Contact",
	"© 2026 Automati Labs GmbH · Alle Rechte vorbehalten.": "© 2026 Automati Labs GmbH · All rights reserved.",
	"DSGVO-konform gehostet": "GDPR-compliant hosting",
	"Einen Moment…": "One moment…",
	"Auswählen": "Select",
	"Bronze wählen": "Choose Bronze",
	"Silber wählen": "Choose Silver",
	"Gold wählen": "Choose Gold",
	"Platinum wählen": "Choose Platinum",
	"Beliebteste Wahl": "Most popular",
	"Analysen / Monat": "analyses / month",
	"/ Monat": "/ month",
	"Bronze": "Bronze",
	"Silber": "Silver",
	"Gold": "Gold",
	"Platinum": "Platinum",
	"Neu": "New"
};
var LP_DE = {};
Object.keys(LP_EN).forEach(function(k) {
	LP_DE[LP_EN[k]] = k;
});
function lpUebersetzen(nachEn) {
	const wurzel = document.getElementById("landingGate");
	if (!wurzel) return 0;
	const wb = nachEn ? LP_EN : LP_DE;
	let n = 0;
	const walker = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT, null);
	const knoten = [];
	while (walker.nextNode()) knoten.push(walker.currentNode);
	knoten.forEach(function(t) {
		const roh = t.nodeValue;
		const s = roh.replace(/\s+/g, " ").trim();
		if (!s) return;
		const ziel = wb[s];
		if (ziel === undefined) return;
		const vor = roh.match(/^\s*/)[0], nach = roh.match(/\s*$/)[0];
		t.nodeValue = vor + ziel + nach;
		n++;
	});
	wurzel.querySelectorAll("[title],[placeholder],[aria-label]").forEach(function(el) {
		[
			"title",
			"placeholder",
			"aria-label"
		].forEach(function(a) {
			const v = el.getAttribute(a);
			if (!v) return;
			const z = wb[v.trim()];
			if (z !== undefined) el.setAttribute(a, z);
		});
	});
	wurzel.setAttribute("data-lang", nachEn ? "en" : "de");
	return n;
}
(function logoVerteilen() {
	function setzen() {
		try {
			let q = null;
			document.querySelectorAll("img.auth-logo, img.logo-svg, img.plan-logo").forEach(function(el) {
				if (!q && el.getAttribute("src") && el.getAttribute("src").indexOf("data:image") === 0) q = el;
			});
			if (!q) return;
			document.querySelectorAll("[data-logo=\"1\"]").forEach(function(el) {
				const a = el.getAttribute("src");
				if (!a || a.indexOf("data:image") !== 0) el.src = q.src;
			});
			const ap = document.querySelector("link[rel=\"apple-touch-icon\"]");
			const ic = document.querySelector("link[rel=\"icon\"]");
			if (ap && ic && ap.getAttribute("href") === "#") ap.href = ic.href;
		} catch (e) {}
	}
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setzen);
	else setzen();
	setTimeout(setzen, 300);
})();
function applyLang(ohneBlende) {
	if (!ohneBlende) {
		try {
			const lg = document.getElementById("landingGate");
			if (lg) {
				lg.classList.add("lp-lang-wechsel");
				setTimeout(function() {
					lg.classList.remove("lp-lang-wechsel");
				}, 380);
			}
		} catch (e) {}
	}
	const lb = document.getElementById("langBtn");
	if (lb) lb.textContent = LANG === "de" ? "🌐 EN" : "🌐 DE";
	hrSpracheAnwenden(document);
	if (LANG === "en") {
		_trOverlay(true);
		uebersetzeBaum(document.body).then(function() {
			if (!_TR_LAUFT && !_TR_NOCHMAL) _trOverlay(false);
		}).catch(function() {
			if (!_TR_LAUFT && !_TR_NOCHMAL) _trOverlay(false);
		});
	} else {
		uebersetzeBaum(document.body, true);
		_trOverlay(false);
	}
	_trAttribute();
	refreshAuthTexts();
	try {
		const ug = document.getElementById("uploadGate");
		if (ug && ug.style.display !== "none") {
			if (typeof UPLOAD_INFO !== "undefined" && UPLOAD_INFO) {
				uploadSubSetzen();
				uploadRender();
			} else {
				const ub = document.getElementById("uploadBody");
				if (ub && ub.innerHTML) ub.innerHTML = uploadFehlerHtml();
			}
		}
	} catch (e) {}
	try {
		if (typeof CURRENT_FIRMA !== "undefined" && CURRENT_FIRMA) updateKontingentAnzeige();
	} catch (e) {}
	try {
		const pg = document.getElementById("planGate");
		if (pg && pg.style.display !== "none" && pg.style.display !== "") renderPlaene();
	} catch (e) {}
}
function chatVollbild() {
	return window.innerWidth <= 760 || window.innerHeight <= 500 && !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
}
function chatTastaturAnpassen(vvTest) {
	const p = document.getElementById("helpPop");
	const vv = vvTest || window.visualViewport;
	if (!p) return;
	const offen = p.style.display === "flex";
	const tastatur = !!(vv && offen && chatVollbild() && window.innerHeight - vv.height > 120);
	if (tastatur) {
		const neu = !p.classList.contains("tastatur");
		p.classList.add("tastatur");
		p.style.top = Math.round(vv.offsetTop || 0) + "px";
		p.style.height = Math.round(vv.height) + "px";
		p.style.maxHeight = Math.round(vv.height) + "px";
		if (neu) {
			const v = p.querySelector(".chat-verlauf");
			if (v) v.scrollTop = v.scrollHeight;
		}
	} else if (p.classList.contains("tastatur")) {
		p.classList.remove("tastatur");
		p.style.top = "";
		p.style.height = "";
		p.style.maxHeight = "";
	}
}
if (window.visualViewport) {
	window.visualViewport.addEventListener("resize", function() {
		chatTastaturAnpassen();
	});
	window.visualViewport.addEventListener("scroll", function() {
		chatTastaturAnpassen();
	});
}
function toggleHelp() {
	const p = document.getElementById("helpPop");
	const bd = document.getElementById("chatBackdrop");
	const btn = document.getElementById("helpBtn");
	if (!p) return;
	const offen = p.style.display === "flex";
	if (offen) {
		p.classList.remove("pop-in");
		p.classList.add("pop-out");
		if (bd) bd.classList.remove("an");
		if (btn) btn.classList.remove("offen");
		document.body.style.overflow = "";
		document.body.classList.remove("chat-offen");
		setTimeout(function() {
			p.style.display = "none";
			p.classList.remove("pop-out");
			chatTastaturAnpassen();
		}, 260);
	} else {
		p.style.display = "flex";
		p.classList.remove("pop-out");
		void p.offsetWidth;
		p.classList.add("pop-in");
		if (bd && chatVollbild()) bd.classList.add("an");
		if (btn) btn.classList.add("offen");
		if (chatVollbild()) document.body.style.overflow = "hidden";
		document.body.classList.add("chat-offen");
		chatZeichnen();
		chatTorLaden().then(function(ok) {
			chatTorZeigen(!ok);
			if (ok && !chatVollbild()) {
				const f = document.getElementById("chatFeld");
				if (f) f.focus();
			}
		});
	}
}
var CHAT_VERLAUF = [];
var CHAT_LAEUFT = false;
var CHAT_TEILTEXT = "";
var CHAT_FRISCH = -1;
var CHAT_ERSTER_AUFBAU = true;
var CHAT_DS_OK = null;
var CHAT_UID = null;
function chatTorSchluessel(uid) {
	return "cc_chat_ds_" + (uid || "gast");
}
async function chatTorLaden() {
	if (CHAT_DS_OK !== null) return CHAT_DS_OK;
	try {
		const { data } = await sb.auth.getUser();
		const u = data && data.user;
		CHAT_UID = u ? u.id : null;
		if (u && u.user_metadata && u.user_metadata.chat_ds_ok === true) {
			CHAT_DS_OK = true;
			try {
				localStorage.setItem(chatTorSchluessel(CHAT_UID), "1");
			} catch (e) {}
			return true;
		}
	} catch (e) {
		CHAT_UID = null;
	}
	let lokal = false;
	try {
		lokal = localStorage.getItem(chatTorSchluessel(CHAT_UID)) === "1";
	} catch (e) {}
	CHAT_DS_OK = lokal;
	return CHAT_DS_OK;
}
function chatTorPruefen() {
	const box = document.getElementById("chatTorBox");
	const btn = document.getElementById("chatTorBtn");
	if (btn) btn.disabled = !(box && box.checked);
}
async function chatTorOk() {
	const box = document.getElementById("chatTorBox");
	if (!box || !box.checked) return;
	CHAT_DS_OK = true;
	try {
		localStorage.setItem(chatTorSchluessel(CHAT_UID), "1");
	} catch (e) {}
	try {
		await sb.auth.updateUser({ data: { chat_ds_ok: true } });
	} catch (e) {}
	chatTorZeigen(false);
	const f = document.getElementById("chatFeld");
	if (f && !chatVollbild()) f.focus();
}
function chatTorZeigen(an) {
	const tor = document.getElementById("chatTor");
	const verlauf = document.getElementById("chatVerlauf");
	const pop = document.getElementById("helpPop");
	if (tor) tor.style.display = an ? "flex" : "none";
	if (verlauf) verlauf.style.display = an ? "none" : "flex";
	if (pop) pop.classList.toggle("tor-offen", !!an);
	const runter = document.getElementById("chatRunter");
	if (runter && an) runter.classList.remove("an");
	if (!an) chatNachUnten(true);
}
var CHAT_VORSCHLAEGE = [
	"Wie ist eine Akte aufgebaut?",
	"Wie schicke ich einem Kunden den Upload-Link?",
	"Wie gebe ich einen Ordner für eine Gruppe frei?",
	"Wertet die KI meine Dokumente aus?"
];
var CHAT_PFEIL = "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 18l6-6-6-6\"/></svg>";
var CHAT_MARKE = "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/></svg>";
function chatZeit(t) {
	const d = t ? new Date(t) : new Date();
	return d.toLocaleTimeString("de-DE", {
		hour: "2-digit",
		minute: "2-digit"
	});
}
function chatZeichnen() {
	const box = document.getElementById("chatVerlauf");
	if (!box) return;
	let html = "";
	const frischKl = CHAT_ERSTER_AUFBAU ? " chat-frisch" : "";
	if (!CHAT_VERLAUF.length) {
		html += "<div class=\"chat-reihe" + frischKl + "\">" + "<span class=\"chat-mini\">" + CHAT_MARKE + "</span>" + "<div class=\"chat-stapel\"><div class=\"chat-blase chat-bot chat-start\">" + "Hallo! Ich bin der Hilfe-Assistent des Compliance-Checkers. Ich erkläre dir Schritt für Schritt, " + "wo du was findest – vom Team einladen bis zum Ausweis-Upload. Was möchtest du tun?" + "</div></div></div>" + "<div class=\"chat-chips" + frischKl + "\">" + CHAT_VORSCHLAEGE.map(function(v, i) {
			return "<button class=\"chat-chip\" style=\"--cd:" + (.12 + i * .07) + "s\" data-act-click=\"h74\" data-a0=\"" + escapeAttr(i) + "\">" + "<span>" + v + "</span>" + CHAT_PFEIL + "</button>";
		}).join("") + "</div>";
	} else {
		html += CHAT_VERLAUF.map(function(m, i) {
			const ich = m.role === "user";
			const frisch = i === CHAT_FRISCH ? " chat-frisch" : "";
			const meta = "<div class=\"chat-meta\">" + "<span class=\"chat-zeit\">" + chatZeit(m.t) + "</span>" + (ich ? "" : "<button class=\"chat-kopier\" data-act-click=\"h75\" data-a0=\"" + escapeAttr(i) + "\" title=\"Antwort kopieren\">" + "<svg viewBox=\"0 0 24 24\" width=\"11\" height=\"11\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"9\" y=\"9\" width=\"12\" height=\"12\" rx=\"2\"/><path d=\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\"/></svg>Kopieren</button>") + "</div>";
			return "<div class=\"chat-reihe" + (ich ? " ist-ich" : "") + frisch + "\">" + "<span class=\"chat-mini" + (ich ? " leer" : "") + "\">" + (ich ? "" : CHAT_MARKE) + "</span>" + "<div class=\"chat-stapel\">" + "<div class=\"chat-blase " + (ich ? "chat-ich" : "chat-bot") + "\">" + chatText(m.content) + "</div>" + meta + "</div></div>";
		}).join("");
	}
	if (CHAT_LAEUFT && !CHAT_TEILTEXT) {
		html += "<div class=\"chat-reihe chat-frisch\"><span class=\"chat-mini\">" + CHAT_MARKE + "</span>" + "<div class=\"chat-stapel\"><div class=\"chat-blase chat-bot chat-tippt\"><span></span><span></span><span></span></div></div></div>";
	}
	if (CHAT_TEILTEXT) {
		html += "<div class=\"chat-reihe\"><span class=\"chat-mini\">" + CHAT_MARKE + "</span>" + "<div class=\"chat-stapel\"><div class=\"chat-blase chat-bot chat-schreibt\" id=\"chatLaufend\">" + chatText(CHAT_TEILTEXT) + "<span class=\"chat-cursor\"></span></div></div></div>";
	}
	box.innerHTML = html;
	CHAT_ERSTER_AUFBAU = false;
	const nb = document.getElementById("chatNeuBtn");
	if (nb) nb.style.display = CHAT_VERLAUF.length ? "" : "none";
	chatNachUnten();
}
function chatNachUnten(erzwingen) {
	const box = document.getElementById("chatVerlauf");
	if (!box) return;
	const nahAmEnde = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
	if (erzwingen || nahAmEnde) {
		if (typeof box.scrollTo === "function") box.scrollTo({
			top: box.scrollHeight,
			behavior: erzwingen ? "smooth" : "auto"
		});
		else box.scrollTop = box.scrollHeight;
		const k = document.getElementById("chatRunter");
		if (k) k.classList.remove("an");
		return;
	}
	chatScrollGeprueft();
}
function chatScrollGeprueft() {
	const box = document.getElementById("chatVerlauf");
	const knopf = document.getElementById("chatRunter");
	if (!box || !knopf) return;
	const weitOben = box.scrollHeight - box.scrollTop - box.clientHeight > 140;
	knopf.classList.toggle("an", weitOben);
}
function chatLaufendAuffrischen() {
	const el = document.getElementById("chatLaufend");
	if (!el) {
		chatZeichnen();
		return;
	}
	el.innerHTML = chatText(CHAT_TEILTEXT) + "<span class=\"chat-cursor\"></span>";
	chatNachUnten();
}
function chatText(t) {
	let h = escapeHtml(String(t || ""));
	h = h.replace(/\*\*([^*\n]{1,160})\*\*/g, "<b>$1</b>");
	h = h.replace(/\bhttps?:\/\/[^\s<]+/g, function(url) {
		const ende = url.match(/[.,;:!?)]+$/);
		const rest = ende ? ende[0] : "";
		const sauber = rest ? url.slice(0, -rest.length) : url;
		const ziel = sichereUrl(sauber.replace(/&amp;/g, "&"));
		return ziel ? "<a href=\"" + ziel + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + sauber + "</a>" + rest : url;
	});
	return h.replace(/\n/g, "<br/>");
}
function chatVorschlag(i) {
	const f = document.getElementById("chatFeld");
	if (f) f.value = CHAT_VORSCHLAEGE[i] || "";
	chatSenden();
}
function chatNeu() {
	if (CHAT_LAEUFT) return;
	CHAT_VERLAUF = [];
	CHAT_TEILTEXT = "";
	CHAT_FRISCH = -1;
	CHAT_ERSTER_AUFBAU = true;
	chatZeichnen();
	const f = document.getElementById("chatFeld");
	if (f && !chatVollbild()) f.focus();
}
function chatKopieren(i, btn) {
	const m = CHAT_VERLAUF[i];
	if (!m) return;
	function fertig() {
		if (!btn) return;
		const alt = btn.innerHTML;
		btn.classList.add("fertig");
		btn.innerHTML = "<svg viewBox=\"0 0 24 24\" width=\"11\" height=\"11\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\"/></svg>Kopiert";
		setTimeout(function() {
			btn.classList.remove("fertig");
			btn.innerHTML = alt;
		}, 1500);
	}
	try {
		navigator.clipboard.writeText(m.content).then(fertig).catch(function() {
			kopierNotloesung(m.content, fertig);
		});
	} catch (e) {
		kopierNotloesung(m.content, fertig);
	}
}
function chatFeldHoehe(el) {
	if (!el) return;
	el.style.height = "auto";
	el.style.height = Math.min(el.scrollHeight, 112) + "px";
	const z = document.getElementById("chatZaehler");
	if (z) {
		const n = (el.value || "").length;
		z.textContent = n + " / 1000";
		z.classList.toggle("an", n > 700);
		z.classList.toggle("voll", n > 940);
	}
}
function chatTaste(ev) {
	if (ev.key === "Enter" && !ev.shiftKey) {
		ev.preventDefault();
		chatSenden();
	}
	if (ev.key === "Escape") toggleHelp();
}
async function chatSenden() {
	if (CHAT_LAEUFT) return;
	const feld = document.getElementById("chatFeld");
	const btn = document.getElementById("chatSendenBtn");
	const frage = (feld && feld.value || "").trim();
	if (!frage) {
		if (feld) feld.focus();
		return;
	}
	CHAT_VERLAUF.push({
		role: "user",
		content: frage,
		t: Date.now()
	});
	CHAT_FRISCH = CHAT_VERLAUF.length - 1;
	if (feld) {
		feld.value = "";
		feld.style.height = "auto";
		chatFeldHoehe(feld);
	}
	CHAT_LAEUFT = true;
	CHAT_TEILTEXT = "";
	if (btn) {
		btn.disabled = true;
		btn.classList.add("laedt");
	}
	chatZeichnen();
	chatNachUnten(true);
	const stoerung = "Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal – " + "oder schreib uns an support@automatilabs.de.";
	const chatCtrl = typeof AbortController !== "undefined" ? new AbortController() : null;
	let chatStill = null;
	const chatWecker = function() {
		if (!chatCtrl) return;
		if (chatStill) clearTimeout(chatStill);
		chatStill = setTimeout(function() {
			chatCtrl.abort();
		}, WORKER_STILL_MS);
	};
	const chatGesamt = chatCtrl ? setTimeout(function() {
		chatCtrl.abort();
	}, 12e4) : null;
	try {
		const res = await workerFetch("support_chat", {
			verlauf: CHAT_VERLAUF.slice(-10).map(function(m) {
				return {
					role: m.role,
					content: m.content
				};
			}),
			sprache: typeof LANG !== "undefined" ? LANG : "de"
		}, { signal: chatCtrl ? chatCtrl.signal : undefined });
		const art = res.headers.get("content-type") || "";
		if (!res.ok || art.indexOf("application/json") >= 0 || !res.body) {
			let txt = "";
			try {
				const j = await res.json();
				txt = j && j.antwort ? j.antwort : "";
				if (!txt && j && j.error) txt = friendlyError(j.error);
			} catch (e) {}
			CHAT_VERLAUF.push({
				role: "assistant",
				content: txt || stoerung,
				t: Date.now()
			});
			CHAT_FRISCH = CHAT_VERLAUF.length - 1;
		} else {
			const leser = res.body.getReader();
			const dec = new TextDecoder();
			let letzte = 0;
			while (true) {
				chatWecker();
				const { done, value } = await leser.read();
				if (done) break;
				CHAT_TEILTEXT += dec.decode(value, { stream: true });
				const jetzt = Date.now();
				if (jetzt - letzte > 45) {
					letzte = jetzt;
					chatLaufendAuffrischen();
				}
			}
			chatLaufendAuffrischen();
			CHAT_VERLAUF.push({
				role: "assistant",
				content: CHAT_TEILTEXT.trim() || stoerung,
				t: Date.now()
			});
			CHAT_FRISCH = -1;
		}
	} catch (e) {
		if (CHAT_TEILTEXT.trim()) {
			CHAT_VERLAUF.push({
				role: "assistant",
				content: CHAT_TEILTEXT.trim() + "\n\n(Verbindung unterbrochen – bitte die Frage erneut stellen.)",
				t: Date.now()
			});
		} else {
			CHAT_VERLAUF.push({
				role: "assistant",
				content: "Ich bin gerade nicht erreichbar. Bitte später erneut versuchen oder an " + "support@automatilabs.de schreiben.",
				t: Date.now()
			});
		}
		CHAT_FRISCH = CHAT_VERLAUF.length - 1;
	}
	if (chatStill) clearTimeout(chatStill);
	if (chatGesamt) clearTimeout(chatGesamt);
	CHAT_TEILTEXT = "";
	CHAT_LAEUFT = false;
	if (btn) {
		btn.disabled = false;
		btn.classList.remove("laedt");
	}
	chatZeichnen();
	chatNachUnten(true);
	const f2 = document.getElementById("chatFeld");
	if (f2 && !chatVollbild()) f2.focus();
}
function toggleLang() {
	_TR_RUNDEN = 0;
	setLang(LANG === "de" ? "en" : "de");
	try {
		localStorage.setItem("cc_lang", LANG);
	} catch (e) {}
	applyLang();
}
if (LANG === "en") {
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyLang);
	else applyLang();
}
function zeigePasswortGesendet(mail) {
	const karte = document.querySelector(".auth-card");
	if (!karte) return;
	const alt = karte.innerHTML;
	const logo = karte.querySelector(".auth-logo");
	const logoSrc = logo ? logo.src : "";
	karte.innerHTML = "<img class=\"auth-logo\" src=\"" + logoSrc + "\" alt=\"Compliance Checker by Automati Labs\" />" + "<div class=\"pw-ok\">" + "<div class=\"pw-ok-ico\"><svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + "<rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"/><path d=\"m2 7 10 6 10-6\"/></svg></div>" + "<div class=\"pw-ok-t\">Wir haben dir eine E-Mail geschickt</div>" + "<div class=\"pw-ok-d\">An <b>" + escapeHtml(mail) + "</b>. Klicke auf den Link in der E-Mail, um ein neues Passwort zu setzen.</div>" + "<div class=\"pw-ok-tipp\">" + "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 16v-4M12 8h.01\"/></svg>" + "<span>Nichts angekommen? Schau bitte im <b>Spam-Ordner</b> nach. Der Link ist 60 Minuten gültig.</span>" + "</div>" + "<div class=\"pw-ok-warte\">" + "<span class=\"pw-punkte\"><i></i><i></i><i></i></span>" + "Wir warten auf deinen Klick in der E-Mail" + "</div>" + "</div>";
	requestAnimationFrame(function() {
		const b = karte.querySelector(".pw-ok");
		if (b) b.classList.add("an");
	});
}
var PW_ANSICHT_OFFEN = false;
function zeigeNeuesPasswort(fehlertext) {
	if (PW_ANSICHT_OFFEN) return;
	PW_ANSICHT_OFFEN = true;
	try {
		if (typeof hideBoot === "function") hideBoot();
	} catch (e) {}
	try {
		if (typeof alleGatesAus === "function") alleGatesAus();
	} catch (e) {}
	const lg = document.getElementById("landingGate");
	if (lg) lg.style.display = "none";
	const gate = document.getElementById("authGate");
	if (gate) {
		gate.classList.remove("hidden");
		gate.style.display = "flex";
	}
	const karte = document.querySelector(".auth-card");
	if (!karte) return;
	const logo = karte.querySelector(".auth-logo");
	const logoSrc = logo ? logo.src : "";
	karte.innerHTML = "<img class=\"auth-logo\" src=\"" + logoSrc + "\" alt=\"Compliance Checker by Automati Labs\" />" + "<div class=\"pw-neu\">" + "<div class=\"pw-neu-ico\"><svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + "<rect x=\"4\" y=\"10\" width=\"16\" height=\"11\" rx=\"2\"/><path d=\"M8 10V7a4 4 0 0 1 8 0v3\"/></svg></div>" + "<div class=\"pw-neu-t\">Neues Passwort festlegen</div>" + "<div class=\"pw-neu-d\">Wähle ein Passwort mit mindestens 8 Zeichen.</div>" + (EINLADUNG_TOKEN ? "<div class=\"pw-einl\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M20 6 9 17l-5-5\"/></svg>" + "<span>Deine Team-Einladung bleibt erhalten – direkt nach dem Speichern trittst du bei.</span></div>" : "") + (fehlertext ? "<div class=\"auth-msg error\" style=\"display:block;\">" + escapeHtml(fehlertext) + "</div>" : "") + "<div class=\"auth-field\"><label class=\"auth-label\">Neues Passwort</label><div class=\"pw-wrap\">" + "<input type=\"password\" class=\"auth-input\" id=\"pwNeu1\" placeholder=\"••••••••\" autocomplete=\"new-password\" data-act-keydown=\"h76\" />" + "<button type=\"button\" class=\"pw-auge\" data-act-click=\"h77\" title=\"Passwort anzeigen\">" + "<svg class=\"auge-zu\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>" + "<svg class=\"auge-auf\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24\"/><path d=\"m1 1 22 22\"/></svg>" + "</button>" + "</div></div>" + "<div class=\"auth-field\"><label class=\"auth-label\">Passwort wiederholen</label><div class=\"pw-wrap\">" + "<input type=\"password\" class=\"auth-input\" id=\"pwNeu2\" placeholder=\"••••••••\" autocomplete=\"new-password\" data-act-keydown=\"h76\" />" + "<button type=\"button\" class=\"pw-auge\" data-act-click=\"h78\" title=\"Passwort anzeigen\">" + "<svg class=\"auge-zu\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg>" + "<svg class=\"auge-auf\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24\"/><path d=\"m1 1 22 22\"/></svg>" + "</button>" + "</div></div>" + "<div class=\"auth-msg\" id=\"pwNeuMsg\" style=\"display:none;\"></div>" + "<button class=\"auth-btn\" id=\"pwNeuBtn\" data-act-click=\"h79\">Passwort speichern</button>" + "</div>";
	requestAnimationFrame(function() {
		const b = karte.querySelector(".pw-neu");
		if (b) b.classList.add("an");
		const f = document.getElementById("pwNeu1");
		if (f) setTimeout(function() {
			f.focus();
		}, 120);
	});
}
async function pwSpeichern() {
	const a = document.getElementById("pwNeu1");
	const b = document.getElementById("pwNeu2");
	const msg = document.getElementById("pwNeuMsg");
	const btn = document.getElementById("pwNeuBtn");
	const p1 = a && a.value || "", p2 = b && b.value || "";
	function zeig(text, art) {
		if (!msg) return;
		msg.textContent = text;
		msg.className = "auth-msg " + (art === "ok" ? "ok" : "error");
		msg.style.display = "";
		msg.style.animation = "none";
		void msg.offsetWidth;
		msg.style.animation = "authMsgIn .4s cubic-bezier(.2,.7,.2,1) both";
	}
	function wackel(feld) {
		if (!feld) return;
		feld.focus();
		feld.classList.remove("feld-wackel");
		void feld.offsetWidth;
		feld.classList.add("feld-wackel");
		setTimeout(function() {
			feld.classList.remove("feld-wackel");
		}, 600);
	}
	if (p1.length < 8) {
		zeig("Das Passwort muss mindestens 8 Zeichen haben.", "error");
		wackel(a);
		return;
	}
	if (p1 !== p2) {
		zeig("Die beiden Passwörter stimmen nicht überein.", "error");
		wackel(b);
		return;
	}
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Wird gespeichert…";
	}
	try {
		const { error } = await sb.auth.updateUser({ password: p1 });
		if (error) throw error;
		const karte = document.querySelector(".auth-card");
		const logo = karte ? karte.querySelector(".auth-logo") : null;
		const src = logo ? logo.src : "";
		if (karte) {
			karte.innerHTML = "<img class=\"auth-logo\" src=\"" + src + "\" alt=\"Compliance Checker by Automati Labs\" />" + "<div class=\"pw-ok an\">" + "<div class=\"pw-ok-ico\"><svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\"/></svg></div>" + "<div class=\"pw-ok-t\">Passwort geändert</div>" + "<div class=\"pw-ok-d\">Du kannst dich jetzt mit deinem neuen Passwort anmelden.</div>" + "<button class=\"auth-btn\" data-act-click=\"h80\">Weiter zum Tool</button>" + "</div>";
		}
	} catch (e) {
		let t = e && e.message || "Speichern fehlgeschlagen.";
		if (/expired|invalid/i.test(t)) t = "Der Link ist abgelaufen. Bitte fordere einen neuen an.";
		if (/same.*password|should be different/i.test(t)) t = "Bitte wähle ein anderes Passwort als bisher.";
		zeig(t, "error");
		if (btn) {
			btn.disabled = false;
			btn.textContent = "Passwort speichern";
		}
	}
}
function pwFertig() {
	let ziel = location.pathname;
	if (EINLADUNG_TOKEN) {
		try {
			localStorage.setItem("cc_einladung", EINLADUNG_TOKEN);
		} catch (e) {}
		ziel += "?einladung=" + encodeURIComponent(EINLADUNG_TOKEN);
	}
	try {
		history.replaceState(null, "", ziel);
	} catch (e) {}
	location.href = ziel;
}
async function passwortVergessen() {
	const feld = document.getElementById("authEmail");
	const mail = (feld && feld.value || "").trim();
	const msg = document.getElementById("authMsg");
	function zeige(text, art) {
		if (!msg) return;
		msg.textContent = text;
		msg.className = "auth-msg " + (art === "ok" ? "ok" : "error");
		msg.style.display = "";
		msg.style.animation = "none";
		void msg.offsetWidth;
		msg.style.animation = "authMsgIn .4s cubic-bezier(.2,.7,.2,1) both";
	}
	if (!mail || mail.indexOf("@") < 0) {
		const bereich = document.getElementById("authVergessen");
		if (bereich) {
			bereich.classList.add("pv-hinweis-an");
			let h = document.getElementById("pvHinweis");
			if (!h) {
				h = document.createElement("div");
				h.id = "pvHinweis";
				h.className = "pv-hinweis";
				h.innerHTML = "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M12 9v4M12 17h.01\"/><circle cx=\"12\" cy=\"12\" r=\"9\"/></svg>" + "<span>Trage oben deine E-Mail-Adresse ein – dorthin schicken wir den Link.</span>";
				bereich.appendChild(h);
			}
			h.classList.remove("an");
			void h.offsetWidth;
			h.classList.add("an");
		}
		if (feld) {
			feld.focus();
			feld.classList.remove("feld-wackel");
			void feld.offsetWidth;
			feld.classList.add("feld-wackel");
			setTimeout(function() {
				feld.classList.remove("feld-wackel");
			}, 600);
			const lab = feld.closest(".auth-field");
			if (lab) {
				lab.classList.add("feld-noetig");
				setTimeout(function() {
					lab.classList.remove("feld-noetig");
				}, 2600);
			}
		}
		return;
	}
	const h = document.getElementById("pvHinweis");
	if (h) h.classList.remove("an");
	const link = document.querySelector("#authVergessen a");
	if (link) {
		link.textContent = "Wird gesendet…";
		link.style.pointerEvents = "none";
	}
	try {
		let zurueck = location.origin + location.pathname;
		if (EINLADUNG_TOKEN) zurueck += "?einladung=" + encodeURIComponent(EINLADUNG_TOKEN);
		const { error } = await sb.auth.resetPasswordForEmail(mail, { redirectTo: zurueck });
		if (error) throw error;
		zeigePasswortGesendet(mail);
	} catch (e) {
		zeige("Konnte nicht gesendet werden: " + (e && e.message || "Bitte erneut versuchen."), "error");
	}
	if (link) {
		link.textContent = "Passwort vergessen?";
		link.style.pointerEvents = "";
	}
}
function pwAuge(feldId, btn) {
	const f = document.getElementById(feldId);
	if (!f) return;
	const zeigen = f.type === "password";
	f.type = zeigen ? "text" : "password";
	if (btn) {
		btn.classList.toggle("offen", zeigen);
		btn.title = zeigen ? "Passwort verbergen" : "Passwort anzeigen";
	}
	try {
		f.focus();
	} catch (e) {}
}
function toggleAuthMode() {
	authMode = authMode === "login" ? "register" : "login";
	try {
		const karte = document.querySelector(".auth-card");
		if (karte) {
			karte.classList.remove("auth-neu");
			void karte.offsetWidth;
			karte.classList.add("auth-neu");
		}
	} catch (e) {}
	const title = document.getElementById("authTitle");
	const btn = document.getElementById("authBtn");
	const toggle = document.getElementById("authToggle");
	const pw = document.getElementById("authPassword");
	const legal = document.getElementById("authLegal");
	const nam = document.getElementById("authNamen");
	const verg = document.getElementById("authVergessen");
	if (authMode === "register") {
		title.textContent = t("auth_t_reg", "Konto erstellen");
		btn.textContent = t("auth_b_reg", "Registrieren");
		toggle.innerHTML = authToggleHtml(true);
		pw.setAttribute("autocomplete", "new-password");
		if (legal) legal.style.display = "flex";
		if (nam) nam.style.display = "";
		if (verg) verg.style.display = "none";
	} else {
		title.textContent = t("auth_t_login", "Anmelden");
		btn.textContent = t("auth_b_login", "Anmelden");
		toggle.innerHTML = authToggleHtml(false);
		pw.setAttribute("autocomplete", "current-password");
		if (legal) legal.style.display = "none";
		if (nam) nam.style.display = "none";
		if (verg) verg.style.display = "";
	}
	const g = document.getElementById("chkGwg");
	if (g) g.checked = false;
	const a = document.getElementById("chkAgb");
	if (a) a.checked = false;
	showAuthMsg("", "");
}
function showAuthMsg(text, type) {
	const m = document.getElementById("authMsg");
	if (!text) {
		m.classList.remove("show");
		return;
	}
	m.textContent = text;
	m.className = "auth-msg show " + type;
}
async function doAuth() {
	const email = document.getElementById("authEmail").value.trim();
	const password = document.getElementById("authPassword").value;
	const btn = document.getElementById("authBtn");
	if (!email || !password) {
		showAuthMsg("Bitte E-Mail und Passwort eingeben.", "error");
		return;
	}
	if (authMode === "register" && password.length < 8) {
		showAuthMsg("Passwort muss mindestens 8 Zeichen haben.", "error");
		return;
	}
	if (password.length < 6) {
		showAuthMsg("Passwort muss mindestens 6 Zeichen haben.", "error");
		return;
	}
	if (authMode === "register") {
		const g = document.getElementById("chkGwg"), a = document.getElementById("chkAgb");
		if (!g || !g.checked || !a || !a.checked) {
			showAuthMsg("Bitte bestätige beide Kästchen (GwG-Personenkreis + AGB/Datenschutz), um fortzufahren.", "error");
			return;
		}
	}
	btn.disabled = true;
	showAuthMsg("", "");
	try {
		if (authMode === "register") {
			const vn = ((document.getElementById("authVorname") || {}).value || "").trim();
			const nn = ((document.getElementById("authNachname") || {}).value || "").trim();
			if (!vn || !nn) {
				showAuthMsg("Bitte gib deinen Vor- und Nachnamen ein.", "error");
				const leer = document.getElementById(!vn ? "authVorname" : "authNachname");
				if (leer) {
					leer.focus();
					leer.classList.remove("feld-wackel");
					void leer.offsetWidth;
					leer.classList.add("feld-wackel");
					setTimeout(function() {
						leer.classList.remove("feld-wackel");
					}, 600);
				}
				btn.disabled = false;
				return;
			}
			const { data, error } = await sb.auth.signUp({
				email,
				password,
				options: { data: {
					vorname: vn,
					nachname: nn
				} }
			});
			if (error) throw error;
			try {
				if (vn || nn) localStorage.setItem("cc_name", JSON.stringify({
					v: vn,
					n: nn
				}));
			} catch (e) {}
			showAuthMsg("Fast geschafft! Bitte bestätige deine E-Mail über den Link, den wir dir geschickt haben. Kommt keine Mail, ist die Adresse vielleicht schon registriert – dann melde dich an oder setze dein Passwort zurück.", "success");
			btn.disabled = false;
		} else {
			const { data, error } = await sb.auth.signInWithPassword({
				email,
				password
			});
			if (error) throw error;
		}
	} catch (e) {
		let msg = e.message || "Fehler. Bitte erneut versuchen.";
		if (msg.includes("Invalid login")) msg = "E-Mail oder Passwort falsch.";
		if (msg.includes("Email not confirmed")) msg = "Bitte bestätige zuerst deine E-Mail (Link in deinem Postfach).";
		if (msg.includes("already registered")) msg = "Diese E-Mail ist bereits registriert. Bitte anmelden.";
		showAuthMsg(msg, "error");
		btn.disabled = false;
	}
}
var ABMELDEN_LAEUFT = false;
async function doLogout() {
	if (ABMELDEN_LAEUFT) return;
	ABMELDEN_LAEUFT = true;
	setRANG_GELADEN(false);
	CHAT_DS_OK = null;
	CHAT_UID = null;
	showBoot();
	try {
		await sb.auth.signOut();
	} catch (e) {}
	try {
		if ("scrollRestoration" in history) history.scrollRestoration = "manual";
		window.scrollTo(0, 0);
	} catch (e) {}
	location.reload();
}
async function entferntHinweisPruefen() {
	if (!sb) return;
	const { data } = await sb.rpc("entfernt_hinweis");
	if (!data || !data.firma) return;
	const box = document.createElement("div");
	box.id = "entfGate";
	box.className = "up-warn-back";
	box.innerHTML = "<div class=\"up-warn-card entf-card\">" + "<div class=\"entf-ico\"><svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"m17 8 5 5M22 8l-5 5\"/></svg></div>" + "<div class=\"up-warn-t\">Du wurdest aus einem Team entfernt</div>" + "<div class=\"up-warn-d\">Ein Administrator hat dich aus <b>" + escapeHtml(data.firma) + "</b> entfernt. " + "Du arbeitest jetzt wieder in deinem eigenen Konto – deine früheren Prüfungen dort sind unverändert.</div>" + "<div class=\"up-warn-btns\"><button class=\"up-senden up-warn-ok\" data-act-click=\"h81\">Verstanden</button></div>" + "</div>";
	document.body.appendChild(box);
	einblenden(box);
}
function entfGateZu() {
	const b = document.getElementById("entfGate");
	if (!b) return;
	const k = b.querySelector(".entf-card");
	if (k) k.classList.add("karte-weg");
	b.classList.remove("an");
	setTimeout(function() {
		if (b.parentNode) b.remove();
	}, 280);
}
async function setPruefer(v) {
	setHISTORY_PRUEFER(v || "");
	renderHistoryList();
	if (v) {
		await historieFilterVorbereiten();
		renderHistoryList();
	}
}
async function setStandortFilter(v) {
	setHISTORY_STANDORT(v || "");
	renderHistoryList();
	if (v) {
		await historieFilterVorbereiten();
		renderHistoryList();
	}
}
function favUebersichtHtml() {
	if (!FAVORITEN.length) {
		return "<div class=\"fav-panel fav-leer-panel\">" + "<div class=\"fav-leer-ico\"><svg viewBox=\"0 0 24 24\" width=\"30\" height=\"30\" fill=\"currentColor\"><path d=\"M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.95z\"/></svg></div>" + "<div class=\"fav-leer-t\">Noch keine Firma in der Überwachung</div>" + "<div class=\"fav-leer-d\">Markiere eine geprüfte Firma mit dem Stern, um sie dauerhaft zu überwachen. Sie wird dann <b>alle drei Monate automatisch neu geprüft</b> – du erfährst sofort, wenn sich etwas ändert.</div>" + "</div>";
	}
	const offen = FAVORITEN.reduce(function(s, f) {
		return s + (parseInt(f.offene_meldungen, 10) || 0);
	}, 0);
	const zeilen = FAVORITEN.map(function(f, i) {
		const naechste = f.naechste_pruefung ? new Date(f.naechste_pruefung) : null;
		const tage = naechste ? Math.ceil((naechste.getTime() - Date.now()) / 864e5) : null;
		const letzte = f.letzte_pruefung ? new Date(f.letzte_pruefung).toLocaleDateString("de-DE", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric"
		}) : "noch nicht";
		const v = f.letzte_veraenderung || "keine";
		const marke = v === "kritisch" ? "<span class=\"fav-marke fav-m-rot\">Kritische Veränderung</span>" : v === "verschlechtert" ? "<span class=\"fav-marke fav-m-gelb\">Veränderung erkannt</span>" : v === "verbessert" ? "<span class=\"fav-marke fav-m-gruen\">Verbessert</span>" : f.letzte_pruefung ? "<span class=\"fav-marke fav-m-grau\">Unverändert</span>" : "<span class=\"fav-marke fav-m-grau\">Erstprüfung ausstehend</span>";
		const sc = f.letzter_score != null ? f.letzter_score : null;
		const scFarbe = sc === null ? "grau" : sc >= 75 ? "gruen" : sc >= 50 ? "gelb" : "rot";
		return "<div class=\"fav-zeile\" style=\"--fd:" + (.05 + i * .07) + "s\">" + "<div class=\"fav-haupt\">" + "<div class=\"fav-name\">" + escapeHtml(f.firmenname) + (parseInt(f.offene_meldungen, 10) ? "<span class=\"fav-neu\">neu</span>" : "") + "</div>" + "<div class=\"fav-meta\">Zuletzt geprüft: " + letzte + (tage !== null ? " · nächste Prüfung in " + (tage <= 0 ? "Kürze" : tage + " Tagen") : "") + "</div>" + "</div>" + "<div class=\"fav-rechts\">" + (sc !== null ? "<span class=\"fav-score fav-s-" + scFarbe + "\">" + sc + "</span>" : "") + marke + "<button class=\"fav-weg\" data-act-click=\"h82\" data-a0=\"" + escapeAttr(f.id) + "\" title=\"Aus der Überwachung nehmen\">" + "<svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M18 6 6 18M6 6l12 12\"/></svg></button>" + "</div></div>";
	}).join("");
	return "<div class=\"fav-panel\">" + "<div class=\"fav-kopf\">" + "<div><div class=\"fav-titel\">Laufende Überwachung</div>" + "<div class=\"fav-untertitel\">Diese Firmen werden <b>alle drei Monate automatisch neu geprüft</b>. Jede Prüfung wird zu den geltenden Konditionen abgerechnet und als Bericht in der Akte abgelegt.</div></div>" + (offen ? "<div class=\"fav-badge-offen\">" + offen + " neue Meldung" + (offen === 1 ? "" : "en") + "</div>" : "") + "</div>" + "<div class=\"fav-liste\">" + zeilen + "</div>" + "</div>";
}
async function favEntfernen(id, ev) {
	if (ev) ev.stopPropagation();
	const zeile = ev && ev.currentTarget && ev.currentTarget.closest(".fav-zeile");
	if (zeile) {
		zeile.classList.add("fav-raus");
	}
	try {
		await sb.from("favoriten").update({ aktiv: false }).eq("id", id);
		setTimeout(async function() {
			await ladeFavoriten();
			renderHistoryList();
		}, 320);
	} catch (e) {
		if (zeile) zeile.classList.remove("fav-raus");
		alert("Konnte nicht entfernt werden.");
	}
}
async function ladeFavoriten() {
	setFAVORITEN([]);
	setFAV_KERNE({});
	if (!sb || !CURRENT_FIRMA) return;
	try {
		const { data } = await sb.rpc("meine_favoriten");
		setFAVORITEN(data || []);
		FAVORITEN.forEach(function(f) {
			FAV_KERNE[firmenKern(f.firmenname)] = f;
		});
	} catch (e) {
		setFAVORITEN([]);
	}
}
function istFavorit(name) {
	return !!FAV_KERNE[firmenKern(name || "")];
}
function favBestaetigen(firmenname) {
	return new Promise(function(res) {
		const limit = CURRENT_FIRMA && CURRENT_FIRMA.monatslimit ? CURRENT_FIRMA.monatslimit : null;
		const box = document.createElement("div");
		box.id = "favGate";
		box.className = "up-warn-back";
		box.innerHTML = "<div class=\"up-warn-card fav-card\">" + "<div class=\"fav-dlg-ico\"><svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"currentColor\"><path d=\"M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.95z\"/></svg></div>" + "<div class=\"up-warn-t\">Firma dauerhaft überwachen?</div>" + "<div class=\"up-warn-d\"><b>" + escapeHtml(firmenname) + "</b> wird ab sofort <b>alle drei Monate automatisch neu geprüft</b>. Du wirst benachrichtigt, sobald sich etwas ändert – etwa ein Sanktions-Treffer, ein Insolvenzhinweis oder ein Wechsel in der Geschäftsführung.</div>" + "<div class=\"fav-kosten\">" + "<div class=\"fav-kosten-t\">Wichtig zu den Kosten</div>" + "<ul class=\"fav-kosten-l\">" + "<li>Jede automatische Prüfung zählt wie eine normale Analyse <b>gegen dein Monatskontingent</b>" + (limit ? " (aktuell " + limit + " Analysen / Monat)" : "") + ".</li>" + "<li>Das sind <b>4 Analysen pro Jahr</b> für diese Firma.</li>" + "<li>Ist dein Kontingent aufgebraucht, wird <b>nicht</b> geprüft – es entstehen keine zusätzlichen Kosten.</li>" + "<li>Du kannst die Überwachung <b>jederzeit mit einem Klick beenden</b>.</li>" + "</ul></div>" + "<label class=\"fav-check-zeile\" id=\"favCheckZeile\">" + "<input type=\"checkbox\" id=\"favCheck\" data-act-change=\"h83\" />" + "<span class=\"einw-mark\"></span>" + "<span class=\"fav-check-text\">Ich habe verstanden, dass jede automatische Prüfung mein Analysen-Kontingent verbraucht.</span>" + "</label>" + "<div class=\"up-warn-btns\">" + "<button class=\"kyc-btn\" data-act-click=\"h84\">Abbrechen</button>" + "<button class=\"up-senden up-warn-ok up-senden-aus\" id=\"favOkBtn\" disabled data-act-click=\"h85\">Überwachung starten</button>" + "</div></div>";
		document.body.appendChild(box);
		einblenden(box);
		window._favAntwort = res;
	});
}
function favCheckGeaendert() {
	const c = document.getElementById("favCheck");
	const b = document.getElementById("favOkBtn");
	if (!b) return;
	const an = !!(c && c.checked);
	b.disabled = !an;
	b.classList.toggle("up-senden-aus", !an);
}
function favDlgSchliessen(ja) {
	const b = document.getElementById("favGate");
	if (ja) {
		const c = document.getElementById("favCheck");
		if (!c || !c.checked) {
			const z = document.getElementById("favCheckZeile");
			if (z) {
				z.classList.remove("fav-wackel");
				void z.offsetWidth;
				z.classList.add("fav-wackel");
			}
			return;
		}
	}
	if (b) {
		b.classList.remove("an");
		setTimeout(function() {
			if (b.parentNode) b.remove();
		}, 240);
	}
	if (window._favAntwort) {
		window._favAntwort(!!ja);
		window._favAntwort = null;
	}
}
var BEARBEITEN_AN = false;
var ERGAENZUNGEN = {};
var ERG_QUELLEN = {};
function bearbIcoSvg() {
	return "<svg class=\"bearb-refresh\" viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"none\" stroke=\"currentColor\" " + "stroke-width=\"2.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\"/><path d=\"M21 3v5h-5\"/>" + "<path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\"/><path d=\"M3 21v-5h5\"/></svg>";
}
function bearbLeisteZeichnen() {
	const belegAnz = typeof KYC !== "undefined" && KYC.doks && KYC.doks.beleg ? KYC.doks.beleg.length : 0;
	const l = document.getElementById("bearbLeiste");
	if (!l || !CURRENT_REPORT) return;
	const n = Object.keys(ERGAENZUNGEN).length;
	const bereit = n > 0 || belegAnz > 0;
	const d = CURRENT_REPORT;
	const fassung = d._fassung || 1;
	const hinweisAlt = d._fassung_hinweis ? "<div class=\"bearb-fassung\">Fassung " + fassung + " · " + escapeHtml(d._fassung_hinweis) + "</div>" : "";
	if (!BEARBEITEN_AN) {
		l.innerHTML = hinweisAlt + "<div class=\"bearb-karte\">" + "<div class=\"bearb-ico\"><svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z\"/></svg></div>" + "<div class=\"bearb-text\"><div class=\"bearb-t\">Etwas fehlt oder stimmt nicht?</div>" + "<div class=\"bearb-d\">Website, USt-IdNr., Registernummer oder Geschäftsführung nachtragen – danach wird der Bericht mit deinen Angaben neu bewertet.</div></div>" + "<button class=\"bearb-btn\" data-act-click=\"h86\">Angaben ergänzen</button>" + "</div>";
	} else {
		l.innerHTML = hinweisAlt + "<div class=\"bearb-karte bearb-aktiv\">" + "<div class=\"bearb-ico bearb-ico-an\"><svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z\"/></svg></div>" + "<div class=\"bearb-text\"><div class=\"bearb-t\">Bearbeitungsmodus</div>" + "<div class=\"bearb-d\">Klicke auf den Stift neben einem Feld. " + (n ? "<b>" + n + " Angabe" + (n === 1 ? "" : "n") + " ergänzt.</b>" : "Noch nichts ergänzt.") + (belegAnz ? " <b>" + belegAnz + " Dokument" + (belegAnz === 1 ? "" : "e") + "</b> wird beim Neubewerten ausgelesen." : "") + (n || belegAnz ? "<span class=\"bearb-haft\">Für die Richtigkeit selbst ergänzter Angaben und hochgeladener Unterlagen bist du verantwortlich. Sie werden übernommen, ohne dass wir sie amtlich verifizieren können.</span>" : "") + "</div></div>" + "<div class=\"bearb-btns\">" + "<button class=\"kyc-btn\" data-act-click=\"h87\">Abbrechen</button>" + "<button class=\"bearb-btn\" id=\"neuBewertenBtn\" data-act-click=\"h88\"" + (bereit ? "" : " disabled") + ">" + bearbIcoSvg() + "<span class=\"bearb-label\">Neu bewerten" + (n ? " · " + n : "") + "</span></button>" + "</div></div>";
	}
	requestAnimationFrame(function() {
		const k = l.querySelector(".bearb-karte");
		if (k) k.classList.add("an");
	});
}
function bearbeitenStart() {
	if (gesperrtMelden()) return;
	BEARBEITEN_AN = true;
	ERGAENZUNGEN = {};
	ERG_QUELLEN = {};
	const rep = document.getElementById("report") || document.body;
	rep.classList.add("bearb-modus");
	bearbLeisteZeichnen();
	zeigeToast("Bearbeitungsmodus", "Klicke auf den Stift rechts neben einem Feld.");
}
function bearbeitenAbbruch() {
	BEARBEITEN_AN = false;
	ERGAENZUNGEN = {};
	ERG_QUELLEN = {};
	const rep = document.getElementById("report") || document.body;
	rep.classList.remove("bearb-modus");
	document.querySelectorAll(".kv-ergaenzt").forEach(function(z) {
		z.classList.remove("kv-ergaenzt");
		const orig = z.getAttribute("data-orig");
		if (orig !== null) {
			const v = z.querySelector(".kv-v");
			if (v) v.innerHTML = orig;
		}
	});
	document.querySelectorAll(".kv-edit").forEach(function(e) {
		const z = e.closest(".kv");
		const orig = z && z.getAttribute("data-orig");
		if (z && orig !== null) {
			const v = z.querySelector(".kv-v");
			if (v) v.innerHTML = orig;
		}
	});
	bearbLeisteZeichnen();
}
function ccStift(id) {
	return "<button class=\"kv-stift cc-stift\" data-act-click=\"h89\" data-a0=\"" + escapeAttr(id) + "\" title=\"Wert ergänzen\" tabindex=\"-1\">" + "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z\"/></svg></button>";
}
function feldBearbeiten(feldId, ev) {
	if (ev) {
		ev.stopPropagation();
		ev.preventDefault();
	}
	const zeile = document.getElementById(feldId);
	if (!zeile) return;
	if (zeile.querySelector(".kv-edit")) {
		const i = zeile.querySelector(".kv-edit-in");
		if (i) i.focus();
		return;
	}
	document.querySelectorAll(".kv-edit").forEach(function(e) {
		const z = e.closest(".kv");
		if (z && z.id !== feldId) feldAbbruch(z.id);
	});
	const kat = zeile.getAttribute("data-kat"), feld = zeile.getAttribute("data-feld");
	const schluessel = kat + "|" + feld;
	const v = zeile.querySelector(".kv-v") || zeile.querySelector(".cc-wert");
	if (!v) return;
	if (zeile.getAttribute("data-orig") === null) zeile.setAttribute("data-orig", v.innerHTML);
	let start = ERGAENZUNGEN[schluessel];
	if (start === undefined) start = feldWertLesen(v);
	const quelleStart = ERG_QUELLEN[schluessel] || "";
	v.innerHTML = "<div class=\"kv-edit\">" + "<label class=\"kv-edit-feld\"><span class=\"kv-edit-lbl\">Wert</span>" + "<input class=\"kv-edit-in\" type=\"text\" value=\"" + escapeHtml(start) + "\" placeholder=\"Wert eingeben…\" autocomplete=\"off\" data-act-keydown=\"h90\" data-a0=\"" + escapeAttr(feldId) + "\" /></label>" + "<label class=\"kv-edit-feld\"><span class=\"kv-edit-lbl\">Quelle <em>optional</em></span>" + "<input class=\"kv-edit-quelle\" type=\"text\" value=\"" + escapeHtml(quelleStart) + "\" placeholder=\"Link oder Bezeichnung\" autocomplete=\"off\" data-act-keydown=\"h90\" data-a0=\"" + escapeAttr(feldId) + "\" /></label>" + "<div class=\"kv-edit-knoepfe\">" + "<button type=\"button\" class=\"kv-edit-x\" data-act-click=\"h91\" data-a0=\"" + escapeAttr(feldId) + "\">Abbrechen</button>" + "<button type=\"button\" class=\"kv-edit-ok\" data-act-click=\"h92\" data-a0=\"" + escapeAttr(feldId) + "\">Übernehmen</button>" + "</div></div>";
	zeile.classList.add("kv-offen");
	const inp = v.querySelector(".kv-edit-in");
	requestAnimationFrame(function() {
		if (inp) {
			inp.focus();
			inp.select();
		}
	});
}
function feldWertLesen(v) {
	const kopie = v.cloneNode(true);
	kopie.querySelectorAll(".kv-src, .kv-src-link, .kv-src-plain, .kv-erg-tag, .kv-erg-quelle, .kv-stift").forEach(function(x) {
		x.remove();
	});
	const link = kopie.querySelector("a[href]");
	const roh = link ? link.getAttribute("href") : (kopie.textContent || "").replace(/\u2197/g, "").trim();
	return /^n\/?a$/i.test(roh) || !roh ? "" : String(roh).split("\n")[0].trim().slice(0, 200);
}
function feldErgaenztHTML(wert, quelle) {
	let q = "";
	const t = String(quelle || "").trim();
	if (t) {
		const url = sichereUrl(/^https?:\/\//i.test(t) ? t : "");
		let name = t;
		if (url) {
			try {
				name = new URL(t).hostname.replace(/^www\./, "");
			} catch (e) {}
		}
		q = "<span class=\"kv-erg-quelle\">Quelle: " + (url ? "<a href=\"" + url + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + escapeHtml(name) + " ↗</a>" : escapeHtml(name)) + "</span>";
	}
	return "<span class=\"kv-erg-wert\">" + escapeHtml(wert) + "<span class=\"kv-erg-tag\">ergänzt</span></span>" + q;
}
function feldEditorZu(zeile, v, html) {
	const ed = v && v.querySelector(".kv-edit");
	const fertig = function() {
		if (!v) return;
		v.innerHTML = html;
		v.classList.remove("kv-v-neu");
		void v.offsetWidth;
		v.classList.add("kv-v-neu");
	};
	zeile.classList.remove("kv-offen");
	if (!ed || bewegungReduziert()) {
		fertig();
		return;
	}
	ed.classList.add("zu");
	setTimeout(fertig, 170);
}
function bewegungReduziert() {
	try {
		return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch (e) {
		return false;
	}
}
function feldTaste(ev, feldId) {
	if (ev.key === "Enter") {
		ev.preventDefault();
		feldUebernehmen(feldId);
	}
	if (ev.key === "Escape") {
		ev.preventDefault();
		feldAbbruch(feldId);
	}
}
function feldUebernehmen(feldId) {
	const zeile = document.getElementById(feldId);
	if (!zeile) return;
	const inp = zeile.querySelector(".kv-edit-in");
	const qin = zeile.querySelector(".kv-edit-quelle");
	const wert = (inp && inp.value || "").trim().slice(0, 500);
	const quelle = (qin && qin.value || "").trim().slice(0, 300);
	const schluessel = zeile.getAttribute("data-kat") + "|" + zeile.getAttribute("data-feld");
	const v = zeile.querySelector(".kv-v") || zeile.querySelector(".cc-wert");
	if (wert) {
		ERGAENZUNGEN[schluessel] = wert;
		if (quelle) ERG_QUELLEN[schluessel] = quelle;
		else delete ERG_QUELLEN[schluessel];
		zeile.classList.add("kv-ergaenzt");
		feldEditorZu(zeile, v, feldErgaenztHTML(wert, quelle));
	} else {
		delete ERGAENZUNGEN[schluessel];
		delete ERG_QUELLEN[schluessel];
		zeile.classList.remove("kv-ergaenzt");
		const orig = zeile.getAttribute("data-orig");
		feldEditorZu(zeile, v, orig !== null ? orig : v ? v.innerHTML : "");
	}
	bearbLeisteZeichnen();
}
function feldAbbruch(feldId) {
	const zeile = document.getElementById(feldId);
	if (!zeile) return;
	const v = zeile.querySelector(".kv-v") || zeile.querySelector(".cc-wert");
	const schluessel = zeile.getAttribute("data-kat") + "|" + zeile.getAttribute("data-feld");
	if (ERGAENZUNGEN[schluessel] !== undefined) {
		feldEditorZu(zeile, v, feldErgaenztHTML(ERGAENZUNGEN[schluessel], ERG_QUELLEN[schluessel]));
	} else {
		const orig = zeile.getAttribute("data-orig");
		feldEditorZu(zeile, v, orig !== null ? orig : v ? v.innerHTML : "");
	}
}
function standortVorschlaege() {
	const dl = document.getElementById("standortListe");
	const inp = document.getElementById("standortInput");
	if (!dl) return;
	const zaehler = {};
	(HISTORY_ROWS || []).forEach(function(r) {
		const st = (r.standort || "").trim();
		if (st) zaehler[st] = (zaehler[st] || 0) + 1;
	});
	const liste = Object.keys(zaehler).sort(function(a, b) {
		return zaehler[b] - zaehler[a] || a.localeCompare(b);
	});
	dl.innerHTML = liste.map(function(st) {
		return "<option value=\"" + escapeHtml(st) + "\"></option>";
	}).join("");
	if (inp && !inp.value) {
		try {
			const k = "cc_standort_" + (CURRENT_FIRMA && CURRENT_FIRMA.firma_id || "x");
			const zuletzt = localStorage.getItem(k);
			if (zuletzt) inp.value = zuletzt;
		} catch (e) {}
	}
}
function standortWert() {
	const inp = document.getElementById("standortInput");
	const v = (inp && inp.value || "").replace(/\s+/g, " ").trim().slice(0, 60);
	if (v) {
		try {
			localStorage.setItem("cc_standort_" + (CURRENT_FIRMA && CURRENT_FIRMA.firma_id || "x"), v);
		} catch (e) {}
	}
	return v || null;
}
async function analyseIdErmitteln(d) {
	if (d && d._analyseId) return d._analyseId;
	if (typeof KYC !== "undefined" && KYC.analyseId && KYC.pruefId === (d && d.pruefId)) return KYC.analyseId;
	const pid = d && (d.pruefId || d.pruef_id);
	if (!pid) return null;
	try {
		const row = (HISTORY_ROWS || []).find(function(x) {
			return x.pruef_id === pid;
		});
		if (row && row.id) return row.id;
	} catch (e) {}
	if (!sb) return null;
	try {
		const q = await sb.from("analysen").select("id").eq("pruef_id", pid).limit(1);
		if (q && q.data && q.data[0] && q.data[0].id) return q.data[0].id;
	} catch (e) {}
	return null;
}
async function neuBewertenKern() {
	if (gesperrtMelden()) return false;
	const n = Object.keys(ERGAENZUNGEN).length;
	const unlesbarVorher = CURRENT_REPORT && CURRENT_REPORT._belegeUnlesbar || {};
	const belegeRoh = (typeof KYC !== "undefined" && KYC.doks && KYC.doks.beleg ? KYC.doks.beleg : []).filter(function(x) {
		return !unlesbarVorher[x.storage_path];
	});
	if (!n && !belegeRoh.length || !CURRENT_REPORT) return false;
	const basisBericht = CURRENT_REPORT;
	const btn = document.getElementById("neuBewertenBtn");
	if (btn) {
		btn.disabled = true;
		btn.classList.add("laedt");
		btn.innerHTML = "<span class=\"bearb-spin\"></span><span class=\"bearb-label\">Wird neu bewertet…</span>";
	}
	const erg = {};
	Object.keys(ERGAENZUNGEN).forEach(function(k) {
		erg[k.replace("|", " > ")] = ERGAENZUNGEN[k];
	});
	const schonGelesen = CURRENT_REPORT && Array.isArray(CURRENT_REPORT._belegeAusgewertet) ? CURRENT_REPORT._belegeAusgewertet : [];
	const belege = belegeRoh.slice().sort(function(x, y) {
		return (schonGelesen.indexOf(x.storage_path) >= 0 ? 1 : 0) - (schonGelesen.indexOf(y.storage_path) >= 0 ? 1 : 0);
	}).slice(0, 3).map(function(d) {
		return {
			path: d.storage_path,
			name: d.datei_name || "",
			mime: d.mime_type || ""
		};
	});
	try {
		const quellen = {};
		Object.keys(ERG_QUELLEN).forEach(function(k) {
			if (ERGAENZUNGEN[k] !== undefined) quellen[k.replace("|", " > ")] = ERG_QUELLEN[k];
		});
		const r = await workerCall("neu_bewerten", {
			bericht: CURRENT_REPORT,
			ergaenzungen: erg,
			quellen,
			belege
		});
		if (!r || !r.ok || !r.bericht) throw new Error(r && r.error || "Neubewertung fehlgeschlagen");
		if (CURRENT_REPORT !== basisBericht) throw new Error("Die Akte wurde während der Bewertung gewechselt – nichts gespeichert");
		const neu = r.bericht;
		neu._fassung = (CURRENT_REPORT._fassung || 1) + 1;
		neu._email = CURRENT_REPORT._email;
		neu._name = CURRENT_REPORT._name;
		neu.pruefId = CURRENT_REPORT.pruefId || CURRENT_REPORT.pruef_id;
		neu._analyseId = CURRENT_REPORT._analyseId;
		neu._sanktionen = CURRENT_REPORT._sanktionen;
		belegStatusUebernehmen(neu, r, belege);
		scoreBerechnen(neu);
		const altBericht = CURRENT_REPORT;
		const analyseId = await analyseIdErmitteln(neu);
		let gespeichert = false;
		let speicherFehler = "";
		if (!analyseId) {
			speicherFehler = "Der Datensatz der Analyse wurde nicht gefunden.";
		} else if (!sb) {
			speicherFehler = "Keine Verbindung zur Datenbank.";
		} else {
			BERICHT_ERSETZT.add(altBericht);
			try {
				const laeuft = BERICHT_SCHREIBT.get(altBericht);
				if (laeuft) await laeuft;
			} catch (e) {}
			const r2 = await sb.rpc("fassung_speichern", {
				p_analyse: analyseId,
				p_report: neu,
				p_score: neu.gesamtScore,
				p_grund: "neubewertung",
				p_ergaenzungen: erg
			});
			if (r2 && r2.error) {
				speicherFehler = r2.error.message || "Unbekannter Datenbankfehler";
				BERICHT_ERSETZT.delete(altBericht);
			} else if (r2 && r2.data && r2.data.ok === false) {
				speicherFehler = r2.data.grund || "Speichern abgelehnt";
				BERICHT_ERSETZT.delete(altBericht);
			} else {
				gespeichert = true;
				if (r2 && r2.data && r2.data.fassung) neu._fassung = r2.data.fassung;
				neu._analyseId = analyseId;
				try {
					FASSUNG_GESPEICHERT.set(neu, analyseId);
				} catch (e) {}
				try {
					const row = HISTORY_ROWS.find(function(x) {
						return x.id === analyseId || x.pruef_id === neu.pruefId;
					});
					if (row) {
						row.report_json = neu;
						row._slim = false;
						row.score = neu.gesamtScore;
					}
				} catch (e) {}
			}
		}
		if (!gespeichert) {
			try {
				BERICHT_ERSETZT.add(neu);
			} catch (e) {}
		}
		BEARBEITEN_AN = false;
		ERGAENZUNGEN = {};
		ERG_QUELLEN = {};
		try {
			(document.getElementById("report") || document.body).classList.remove("bearb-modus");
		} catch (e) {}
		const alt = CURRENT_REPORT.gesamtScore;
		CURRENT_REPORT = neu;
		AKTE.ansichtStart = "analyse";
		showReport(neu, neu.firmenname, AUS_HISTORIE, true);
		setTimeout(function() {
			bearbLeisteZeichnen();
			const diff = (neu.gesamtScore || 0) - (alt || 0);
			if (gespeichert) {
				zeigeToast("Neu bewertet", "Score: " + alt + " → " + neu.gesamtScore + (diff ? " (" + (diff > 0 ? "+" : "") + diff + ")" : "") + ". Fassung " + neu._fassung + " gespeichert.");
				neubewertungHinweise(r);
				try {
					Promise.resolve(ladeHistorie()).catch(function(e) {
						console.warn("Historie neu laden:", e && e.message);
					});
				} catch (e) {}
			} else {
				NEU_FEHLER = "Der Bericht wurde neu bewertet und wird angezeigt – konnte aber NICHT gespeichert werden:\n\n" + speicherFehler + "\n\nBitte drucke ihn jetzt, falls du ihn brauchst, und versuche die Neubewertung später erneut. " + "Bleibt der Fehler, schreib an support@automatilabs.de.";
			}
		}, 80);
	} catch (e) {
		NEU_FEHLER = "Die Neubewertung ist fehlgeschlagen: " + (e && e.message || "unbekannter Fehler") + ". Bitte erneut versuchen.";
		if (btn) {
			btn.disabled = false;
			btn.classList.remove("laedt");
			btn.innerHTML = bearbIcoSvg() + "<span class=\"bearb-label\">Neu bewerten · " + n + "</span>";
		}
	}
}
function belegStatusUebernehmen(neu, r, belege) {
	const gelesen = CURRENT_REPORT && Array.isArray(CURRENT_REPORT._belegeAusgewertet) ? CURRENT_REPORT._belegeAusgewertet.slice() : [];
	const unlesbar = Object.assign({}, CURRENT_REPORT && CURRENT_REPORT._belegeUnlesbar || {});
	const dazu = function(p) {
		if (p && gelesen.indexOf(p) < 0) gelesen.push(p);
		delete unlesbar[p];
	};
	if (r && Array.isArray(r.dokStatus)) {
		r.dokStatus.forEach(function(d) {
			if (!d || !d.path) return;
			if (d.status === "gelesen") dazu(d.path);
			else if (d.status === "zu_gross" || d.status === "format") unlesbar[d.path] = d.status;
		});
	} else if (!(r && r.teilweise)) {
		(belege || []).forEach(function(b) {
			dazu(b.path);
		});
	}
	neu._belegeAusgewertet = gelesen;
	neu._belegeUnlesbar = unlesbar;
}
function neubewertungHinweise(r) {
	if (!r) return;
	const grund = {
		zu_gross: "zu groß",
		format: "Format nicht lesbar",
		verschoben: "beim nächsten Durchgang",
		nicht_gefunden: "nicht gefunden"
	};
	const offen = (Array.isArray(r.dokStatus) ? r.dokStatus : []).filter(function(d) {
		return d && d.status !== "gelesen";
	});
	setTimeout(function() {
		if (r.teilweise) {
			zeigeToast("Nachrecherche unvollständig", "Die KI-Prüfung konnte diesmal nicht abgeschlossen werden. Deine Angaben sind gespeichert – bitte später erneut „Neu bewerten“.");
		} else if (offen.length) {
			zeigeToast(offen.length === 1 ? "Ein Dokument nicht gelesen" : offen.length + " Dokumente nicht gelesen", offen.slice(0, 3).map(function(d) {
				return (d.name || "Dokument") + " (" + (grund[d.status] || d.status) + ")";
			}).join(", ") + ".");
		}
	}, 1600);
}
function sternHinweisZu() {
	try {
		localStorage.setItem("cc_stern_gesehen", "1");
	} catch (e) {}
	const h = document.getElementById("sternHinweis");
	if (!h) return;
	h.classList.add("weg");
	setTimeout(function() {
		if (h.parentNode) h.remove();
	}, 320);
}
function monBereichZeichnen(d) {
	const box = document.getElementById("monBereich");
	if (!box || !d || !d.firmenname) return;
	if (!CURRENT_FIRMA || CURRENT_FIRMA.typ === "einzel" && !CURRENT_FIRMA.firma_id) {
		box.innerHTML = "";
		return;
	}
	const kern = typeof firmenKern === "function" ? firmenKern(d.firmenname) : d.firmenname.toLowerCase();
	const fav = typeof FAV_KERNE !== "undefined" ? FAV_KERNE[kern] : null;
	const pruefId = d.pruefId || d.pruef_id || "";
	if (fav) {
		const naechste = fav.naechste_pruefung ? new Date(fav.naechste_pruefung).toLocaleDateString("de-DE") : "–";
		box.innerHTML = "<div class=\"mon-karte mon-aktiv\">" + "<div class=\"mon-ico\"><svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"currentColor\"><path d=\"M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.95z\"/></svg></div>" + "<div class=\"mon-text\"><div class=\"mon-t\">Wird laufend überwacht</div>" + "<div class=\"mon-d\">Nächste automatische Prüfung am <b>" + naechste + "</b>. Bei Änderungen – neuer Sanktionstreffer, Insolvenz, Wechsel in der Geschäftsführung – erfährst du es sofort.</div></div>" + "<button class=\"mon-btn mon-btn-aus\" data-pid=\"" + escapeHtml(pruefId) + "\" data-act-click=\"h93\">Beenden</button>" + "</div>";
	} else {
		box.innerHTML = "<div class=\"mon-karte\">" + "<div class=\"mon-ico mon-ico-leer\"><svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"><path d=\"M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.95z\"/></svg></div>" + "<div class=\"mon-text\"><div class=\"mon-t\">Dieses Unternehmen dauerhaft im Blick behalten?</div>" + "<div class=\"mon-d\">Eine Prüfung ist eine Momentaufnahme. Mit der Überwachung prüft der Compliance-Checker <b>alle drei Monate automatisch</b> neu und meldet dir jede Veränderung. Kostet je Prüfung eine Analyse aus deinem Kontingent.</div></div>" + "<button class=\"mon-btn\" data-pid=\"" + escapeHtml(pruefId) + "\" data-act-click=\"h93\">" + "<svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"currentColor\"><path d=\"M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.95z\"/></svg>" + " Überwachung starten</button>" + "</div>";
	}
	requestAnimationFrame(function() {
		const k = box.querySelector(".mon-karte");
		if (k) k.classList.add("an");
	});
}
async function monAusBericht(pruefId, btn) {
	if (!HISTORY_ROWS || !HISTORY_ROWS.length) {
		try {
			await ladeHistorie();
		} catch (e) {}
	}
	let r = (HISTORY_ROWS || []).find(function(x) {
		return x.pruef_id === pruefId;
	});
	if (!r && CURRENT_REPORT) {
		const d = CURRENT_REPORT;
		r = {
			pruef_id: pruefId,
			firmenname: d.firmenname,
			land: d.land || null,
			ust_id: d.ustId || null,
			score: d.gesamtScore,
			id: d._analyseId || null,
			ordner_id: null
		};
		HISTORY_ROWS.unshift(r);
	}
	if (!r) {
		alert("Bitte die Seite neu laden und erneut versuchen.");
		return;
	}
	if (btn) {
		btn.disabled = true;
	}
	await favToggle(null, pruefId);
	const d = CURRENT_REPORT || {};
	monBereichZeichnen(d.firmenname ? d : {
		firmenname: r.firmenname,
		pruefId
	});
}
async function favToggle(ev, pruefId) {
	if (ev) {
		ev.stopPropagation();
		ev.preventDefault();
	}
	const r = HISTORY_ROWS.find(function(x) {
		return x.pruef_id === pruefId;
	});
	if (!r || !sb || !CURRENT_FIRMA) return;
	const kern = firmenKern(r.firmenname);
	const vorhanden = FAV_KERNE[kern];
	const btn = ev && ev.currentTarget;
	if (btn) {
		btn.classList.add("fav-puls");
		setTimeout(function() {
			btn.classList.remove("fav-puls");
		}, 500);
	}
	try {
		if (vorhanden) {
			await sb.from("favoriten").update({ aktiv: false }).eq("id", vorhanden.id);
			await ladeFavoriten();
			renderHistoryList();
			zeigeToast("Aus der Überwachung entfernt", escapeHtml(r.firmenname) + " wird nicht mehr automatisch geprüft.");
		} else {
			const ja = await favBestaetigen(r.firmenname);
			if (!ja) return;
			const { error } = await sb.from("favoriten").insert({
				firma_id: CURRENT_FIRMA.firma_id,
				analyse_id: r.id || null,
				firmenname: r.firmenname,
				firmen_kern: kern,
				land: r.land || null,
				ust_id: r.ust_id || null,
				ordner_id: r.ordner_id || null,
				hinzugefuegt_von: CURRENT_USER_ID,
				letzter_score: typeof r.score === "number" ? r.score : null
			});
			if (error) throw error;
			await ladeFavoriten();
			renderHistoryList();
			zeigeToast("Zur Überwachung hinzugefügt", escapeHtml(r.firmenname) + " wird ab jetzt alle 3 Monate automatisch geprüft. Der Bericht landet in der Akte.");
		}
	} catch (e) {
		alert("Konnte nicht gespeichert werden: " + (e && e.message || ""));
	}
}
function setHistorySort(v) {
	setHISTORY_SORT(v);
	renderHistoryList();
}
var ORDNER_FARBEN = [
	"#22C55E",
	"#3B82F6",
	"#F59E0B",
	"#EF4444",
	"#8B5CF6",
	"#EC4899",
	"#14B8A6",
	"#6B7280"
];
var AUDIT_ROWS = [];
function sichereUrl(u) {
	const t = String(u == null ? "" : u).trim();
	if (!t || /\s/.test(t)) return "";
	if (/^https?:\/\/[^\s]+$/i.test(t)) return escapeHtml(t);
	if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/[^\s]*)?$/i.test(t)) return escapeHtml("https://" + t);
	return "";
}
function showBoot() {
	appAus();
	const b = document.getElementById("bootGate");
	if (b) b.classList.remove("hidden");
}
function hideBoot() {
	const b = document.getElementById("bootGate");
	if (b) b.classList.add("hidden");
}
function alleGatesAus() {
	const a = document.getElementById("authGate");
	if (a) a.classList.add("hidden");
	const o = document.getElementById("onboardingGate");
	if (o) o.style.display = "none";
	const p = document.getElementById("planGate");
	if (p) p.style.display = "none";
	const z = document.getElementById("zahlungGate");
	if (z) z.style.display = "none";
	const k = document.getElementById("kontoGate");
	if (k) k.style.display = "none";
}
function appAn() {
	const a = document.querySelector(".app");
	if (a) a.style.display = "";
}
function appAus() {
	const a = document.querySelector(".app");
	if (a) a.style.display = "none";
}
function appUnterseitenReset() {
	[
		"historyView",
		"teamView",
		"akteView",
		"supportView"
	].forEach(function(id) {
		const e = document.getElementById(id);
		if (e) e.style.display = "none";
	});
	const mv = document.getElementById("mainView");
	if (mv) mv.style.display = "block";
	const sc = document.querySelector(".search-card");
	if (sc) sc.style.display = "";
}
function fadeInView(el) {
	if (!el) return;
	el.classList.remove("view-anim", "view-out");
	void el.offsetWidth;
	el.classList.add("view-anim");
}
function mitAusBlende(cb) {
	const ids = [
		"mainView",
		"historyView",
		"teamView",
		"akteView"
	];
	let cur = null;
	for (let i = 0; i < ids.length; i++) {
		const el = document.getElementById(ids[i]);
		if (el && el.style.display !== "none" && el.offsetParent !== null) {
			cur = el;
			break;
		}
	}
	if (cur) {
		cur.classList.remove("view-anim");
		cur.classList.add("view-out");
		setTimeout(function() {
			cb();
			setTimeout(function() {
				if (cur && cur.style.display === "none") cur.classList.remove("view-out");
			}, 900);
		}, 190);
	} else {
		cb();
	}
}
function sichtbaresOverlay() {
	const ids = [
		"bootGate",
		"authGate",
		"onboardingGate",
		"planGate",
		"zahlungGate"
	];
	for (let i = 0; i < ids.length; i++) {
		const el = document.getElementById(ids[i]);
		if (el && getComputedStyle(el).display !== "none" && !el.classList.contains("hidden")) return el;
	}
	return null;
}
function sektionZu(el, after) {
	if (!el || getComputedStyle(el).display === "none") {
		if (after) after();
		return;
	}
	el.classList.add("sektion-out");
	setTimeout(function() {
		el.classList.remove("sektion-out");
		el.style.display = "none";
		if (after) after();
	}, 220);
}
var EINLADUNG_ERLEDIGT = false;
function einladungWechselFrage(firmaName, alteFirma) {
	return new Promise(function(res) {
		const box = document.createElement("div");
		box.className = "up-warn-back";
		box.innerHTML = "<div class=\"up-warn-card\">" + "<div class=\"up-warn-ico\">⇄</div>" + "<div class=\"up-warn-t\">Zu diesem Team wechseln?</div>" + "<div class=\"up-warn-d\">Du bist aktuell im Konto <b>" + escapeHtml(alteFirma || "Eigenes Konto") + "</b>.<br/>" + "Wenn du beitrittst, arbeitest du ab sofort im Team <b>" + escapeHtml(firmaName || "") + "</b>. " + "Deine bisherigen Prüfungen bleiben in deinem alten Konto gespeichert und sind im Team nicht sichtbar.</div>" + "<div class=\"up-warn-btns\">" + "<button class=\"kyc-btn\" id=\"ewNein\">Abbrechen</button>" + "<button class=\"up-senden up-warn-ok\" id=\"ewJa\">Ja, dem Team beitreten</button>" + "</div></div>";
		document.body.appendChild(box);
		einblenden(box);
		function schliessen(antwort) {
			box.classList.remove("an");
			setTimeout(function() {
				if (box.parentNode) box.remove();
				res(antwort);
			}, 240);
		}
		box.querySelector("#ewJa").onclick = function() {
			schliessen(true);
		};
		box.querySelector("#ewNein").onclick = function() {
			schliessen(false);
		};
	});
}
async function einladungPruefen() {
	if (!EINLADUNG_TOKEN || !sb || EINLADUNG_ERLEDIGT) return false;
	if (CURRENT_FIRMA && CURRENT_FIRMA.firma_id) {
		let zielName = "";
		try {
			const { data } = await sb.rpc("einladung_vorschau", { p_token: EINLADUNG_TOKEN });
			const v = data && data[0] || null;
			if (!v || !v.gueltig) {
				EINLADUNG_ERLEDIGT = true;
				einladungVergessen();
				return false;
			}
			zielName = v.firma_name || "";
			if (CURRENT_FIRMA.firma_name === zielName) {
				EINLADUNG_ERLEDIGT = true;
				einladungVergessen();
				return false;
			}
		} catch (e) {}
		const ja = await einladungWechselFrage(zielName, CURRENT_FIRMA.firma_name);
		if (!ja) {
			EINLADUNG_ERLEDIGT = true;
			einladungVergessen();
			return false;
		}
	}
	EINLADUNG_ERLEDIGT = true;
	try {
		const { data, error } = await sb.rpc("einladung_annehmen", { p_token: EINLADUNG_TOKEN });
		if (error) throw error;
		if (data && data.ok) {
			einladungVergessen();
			try {
				history.replaceState({}, "", location.pathname);
			} catch (e) {}
			if (data.hinweis !== "schon_mitglied") {
				try {
					await ladeMeinenRang();
				} catch (e) {}
				setTimeout(function() {
					zeigeToast("Willkommen im Team!", "Du wurdest dem Unternehmen als " + rangName(data.rang) + " hinzugefügt.");
				}, 1200);
			}
			return true;
		}
		einladungVergessen();
		const gruende = {
			abgelaufen: "Diese Einladung ist abgelaufen.",
			aufgebraucht: "Diese Einladung wurde bereits verwendet.",
			unbekannt: "Diese Einladung ist ungültig."
		};
		setTimeout(function() {
			alert(gruende[data && data.grund] || "Die Einladung konnte nicht angenommen werden.");
		}, 600);
	} catch (e) {
		console.warn("Einladung:", e && e.message);
		EINLADUNG_ERLEDIGT = false;
	}
	return false;
}
function showApp(session) {
	if (PW_ANSICHT_OFFEN) return;
	setSESSION_GEROUTET(true);
	setTimeout(function() {
		try {
			neuigkeitenPruefen();
		} catch (e) {}
	}, 2400);
	setTimeout(function() {
		try {
			googleWaechter();
		} catch (e) {}
	}, 3200);
	showBoot();
	if (session && session.user) {
		setCURRENT_USER_EMAIL(session.user.email || "");
		setCURRENT_USER_ID(session.user.id || "");
	}
	ladeKontingent();
}
function enterApp() {
	const aktiv = sichtbaresOverlay();
	[
		"authGate",
		"onboardingGate",
		"planGate",
		"zahlungGate"
	].forEach(function(id) {
		const g = document.getElementById(id);
		if (g && g !== aktiv) {
			if (id === "authGate") g.classList.add("hidden");
			else g.style.display = "none";
		}
	});
	appAn();
	try {
		hintergrundFlaschen();
	} catch (e) {}
	const appEl = document.querySelector(".app");
	if (appEl) {
		appEl.classList.remove("app-enter", "app-leave");
		void appEl.offsetWidth;
		appEl.classList.add("app-enter");
	}
	appUnterseitenReset();
	document.getElementById("logoutBtn").style.display = "";
	const hb = document.getElementById("historyBtn");
	if (hb) hb.style.display = "";
	setTimeout(function() {
		const leiste = document.querySelector(".header-actions");
		if (leiste && !leiste.classList.contains("nav-bereit")) leiste.classList.add("nav-bereit");
	}, 2500);
	if (WUNSCH_PAKET) {
		const wunsch = WUNSCH_PAKET;
		wunschPaketVergessen();
		setTimeout(function() {
			try {
				zeigePlaene("upgrade");
				setTimeout(function() {
					const karte = document.querySelector(".plan-card[data-plan=\"" + wunsch + "\"]");
					if (karte) {
						karte.classList.add("plan-hervor");
						karte.scrollIntoView({
							behavior: "smooth",
							block: "center"
						});
						setTimeout(function() {
							karte.classList.remove("plan-hervor");
						}, 2600);
					}
				}, 420);
			} catch (e) {}
		}, 900);
	}
	["infoBewertungBtn", "infoQuellenBtn"].forEach(function(id) {
		const b = document.getElementById(id);
		if (b) b.style.display = "";
	});
	setTimeout(function() {
		try {
			kycNeuePruefen();
		} catch (e) {}
	}, 1800);
	const kb = document.getElementById("kontoBtn");
	if (kb) kb.style.display = "";
	ladeOrdner();
	ladeMeineRolle().then(function() {
		try {
			ladeMeinenRang();
		} catch (e) {}
	});
	namenNachtragen();
	fadeInView(document.getElementById("mainView"));
	if (aktiv) {
		aktiv.classList.add("screen-out");
		setTimeout(function() {
			aktiv.classList.remove("screen-out");
			hideBoot();
			alleGatesAus();
		}, 210);
	} else {
		hideBoot();
		alleGatesAus();
	}
}
async function ladeMeineRolle() {
	if (!sb) return;
	setCURRENT_USER_ROLLE("");
	try {
		if (CURRENT_USER_ID) {
			const { data: prof } = await sb.from("profile").select("rolle").eq("id", CURRENT_USER_ID).maybeSingle();
			if (prof && prof.rolle) setCURRENT_USER_ROLLE(prof.rolle);
		}
		if (!CURRENT_USER_ROLLE) {
			const { data } = await sb.rpc("meine_rolle");
			if (data) {
				if (typeof data === "string") setCURRENT_USER_ROLLE(data);
				else if (Array.isArray(data)) setCURRENT_USER_ROLLE(data[0] && (data[0].rolle || data[0]) || "");
				else setCURRENT_USER_ROLLE(data.rolle || "");
			}
		}
	} catch (e) {
		console.warn("Rolle konnte nicht geladen werden:", e && e.message);
	}
	setCURRENT_USER_ROLLE((CURRENT_USER_ROLLE || "").toString().trim().toLowerCase());
	kopfzeileAktualisieren();
	const tb = document.getElementById("teamBtn");
	const einzel = !!(CURRENT_FIRMA && CURRENT_FIRMA.typ === "einzel");
	if (tb) tb.style.display = einzel ? "none" : "";
}
function kopfzeileAktualisieren() {
	try {
		if (RANG_GELADEN) {
			const leiste = document.querySelector(".header-actions");
			if (leiste && !leiste.classList.contains("nav-bereit")) {
				requestAnimationFrame(function() {
					leiste.classList.add("nav-bereit");
				});
			}
		}
	} catch (e) {}
	try {
		const istSupport = RANG_GELADEN && CURRENT_USER_RANG === "support";
		document.querySelectorAll(".al-footer").forEach(function(e) {
			e.style.display = istSupport ? "none" : "";
		});
	} catch (e) {}
	const wer = document.getElementById("werBinIch");
	if (wer) {
		const name = CURRENT_USER_NAME && CURRENT_USER_NAME.indexOf("@") < 0 ? CURRENT_USER_NAME : CURRENT_USER_EMAIL || "";
		const firma = CURRENT_FIRMA && CURRENT_FIRMA.typ === "firma" ? CURRENT_FIRMA.firma_name || "" : "";
		const info = RANG_INFO[CURRENT_USER_RANG] || RANG_INFO.member;
		wer.innerHTML = name ? "<span class=\"wbi-ico\">" + (RANG_SVG[CURRENT_USER_RANG] || RANG_SVG.member) + "</span>" + "<span class=\"wbi-text\"><b>" + escapeHtml(name) + "</b>" + (firma ? "<span class=\"wbi-firma\">" + escapeHtml(firma) + "</span>" : "") + "</span>" : "";
		wer.style.display = RANG_GELADEN && name && CURRENT_USER_RANG !== "support" ? "" : "none";
		wer.title = (CURRENT_USER_EMAIL || "") + " · " + info.name;
	}
	const sbtn = document.getElementById("supportBtn");
	if (sbtn) sbtn.style.display = RANG_GELADEN && CURRENT_USER_RANG === "support" ? "" : "none";
}
async function ladeMeinenRang() {
	try {
		const { data, error } = await sb.rpc("mein_rang");
		if (!error && data) {
			setCURRENT_USER_RANG(data);
		} else {
			setCURRENT_USER_RANG(CURRENT_USER_ROLLE === "admin" ? "president" : "member");
		}
		setRANG_GELADEN(true);
		try {
			kopfzeileAktualisieren();
		} catch (e) {}
	} catch (e) {
		setCURRENT_USER_RANG(CURRENT_USER_ROLLE === "admin" ? "president" : "member");
		setRANG_GELADEN(true);
		try {
			kopfzeileAktualisieren();
		} catch (e) {}
	}
}
function openTeam() {
	mitAusBlende(_openTeam);
}
async function _openTeam() {
	const main = document.getElementById("mainView");
	const hv = document.getElementById("historyView");
	const tv = document.getElementById("teamView");
	const akte = document.getElementById("akteView");
	if (main) main.style.display = "none";
	if (hv) hv.style.display = "none";
	if (akte) akte.style.display = "none";
	tv.style.display = "block";
	fadeInView(tv);
	window.scrollTo({
		top: 0,
		behavior: "smooth"
	});
	tv.innerHTML = `
    <div class="history-head">
      <div>
        <div class="history-eyebrow">${typeof rangWert === "function" && rangWert(CURRENT_USER_RANG) >= 3 ? "Unternehmens-Verwaltung" : "Dein Unternehmen"}</div>
        <div class="history-title">${typeof rangWert === "function" && rangWert(CURRENT_USER_RANG) >= 3 ? "Team verwalten" : "Dein Team"}</div>
        <div class="history-sub">${typeof rangWert === "function" && rangWert(CURRENT_USER_RANG) >= 3 ? "Mitglieder deines Unternehmens: Ränge ändern, einladen oder entfernen. Es muss immer mindestens ein President aktiv bleiben." : "Diese Kolleginnen und Kollegen arbeiten mit dir im selben Konto. Ränge vergeben können President und Vice President."}</div>
      </div>
      <button class="btn-action" data-act-click="h94">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Zurück zur Analyse
      </button>
    </div>
    <div id="teamSkeleton">
      <div class="sk-block"><div class="sk-line sk-w40"></div><div class="sk-line sk-w70"></div><div class="sk-row"><div class="sk-pill"></div><div class="sk-pill sk-flex"></div><div class="sk-pill sk-btn"></div></div></div>
      <div class="sk-line sk-w25" style="margin:22px 0 12px;"></div>
      <div class="sk-member"></div><div class="sk-member"></div><div class="sk-member"></div>
    </div>`;
	if (!sb) {
		teamError("Keine Verbindung zur Datenbank.");
		return;
	}
	try {
		try {
			await ladeMeinenRang();
		} catch (e) {}
		let { data, error } = await sb.rpc("team_mitglieder");
		if (error) {
			const alt = await sb.rpc("firma_mitglieder");
			if (alt.error) throw alt.error;
			data = (alt.data || []).map(function(m) {
				return Object.assign({}, m, { rang: m.rolle === "admin" ? "president" : "member" });
			});
		}
		setTEAM_MEMBERS((data || []).map(function(m) {
			return {
				user_id: m.user_id,
				email: m.email,
				rang: m.rang || (m.rolle === "admin" ? "president" : "member"),
				rolle: m.rolle,
				beigetreten: m.seit || m.beigetreten,
				anzeige: anzeigeName(m.vorname, m.nachname, m.email)
			};
		}));
		try {
			await gruppenLaden();
		} catch (e) {}
		renderTeam();
	} catch (e) {
		teamError(e && e.message || "Team konnte nicht geladen werden.");
		return;
	}
	try {
		await ladeAudit();
		renderAudit();
	} catch (e) {
		console.warn("Audit-Log konnte nicht geladen werden:", e && e.message);
	}
}
async function ladeAudit() {
	if (!sb) {
		AUDIT_ROWS = [];
		return;
	}
	try {
		let r = await sb.rpc("protokoll_liste");
		if (r.error) r = await sb.rpc("firma_audit_log");
		if (r.error) throw r.error;
		AUDIT_ROWS = r.data || [];
	} catch (e) {
		AUDIT_ROWS = [];
		console.warn("Audit-Log konnte nicht geladen werden:", e && e.message);
	}
}
function renderAudit() {
	const tv = document.getElementById("teamView");
	if (!tv) return;
	const old = document.getElementById("auditBody");
	if (old) old.remove();
	if (!darfVerwalten()) return;
	const verb = {
		befoerdert: "im Rang befördert",
		zurueckgestuft: "im Rang zurückgestuft",
		entfernt: "aus der Firma entfernt",
		ordner_geloescht: "einen Ordner gelöscht",
		ordner_angelegt: "einen Ordner angelegt",
		ordner_sichtbarkeit: "die Sichtbarkeit eines Ordners geändert",
		ordner_freigegeben: "Freigaben geändert",
		gruppe_angelegt: "eine Gruppe angelegt",
		gruppe_geloescht: "eine Gruppe gelöscht",
		gruppe_umbenannt: "eine Gruppe umbenannt",
		gruppe_mitglieder: "die Mitglieder einer Gruppe geändert",
		gruppe_ordner: "den Ordnerzugriff einer Gruppe geändert",
		geprueft: "eine Prüfung durchgeführt"
	};
	const icCls = {
		befoerdert: "up",
		zurueckgestuft: "down",
		entfernt: "kick",
		ordner_geloescht: "folder",
		ordner_angelegt: "folderplus",
		ordner_sichtbarkeit: "share",
		ordner_freigegeben: "share",
		gruppe_angelegt: "group",
		gruppe_geloescht: "group",
		gruppe_umbenannt: "group",
		gruppe_mitglieder: "group",
		gruppe_ordner: "share",
		geprueft: "check"
	};
	const icSvg = {
		up: "<path d=\"M12 19V5M5 12l7-7 7 7\"/>",
		down: "<path d=\"M12 5v14M5 12l7 7 7-7\"/>",
		kick: "<path d=\"M18 6 6 18M6 6l12 12\"/>",
		folder: "<path d=\"M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>",
		folderplus: "<path d=\"M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z\"/><path d=\"M12 10v6M9 13h6\"/>",
		share: "<circle cx=\"18\" cy=\"5\" r=\"3\"/><circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"19\" r=\"3\"/><path d=\"M8.6 13.5l6.8 4M15.4 6.5l-6.8 4\"/>",
		group: "<path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75\"/>",
		check: "<path d=\"M9 11l3 3L22 4\"/><path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/>"
	};
	const ausPruefungen = (HISTORY_ROWS || []).slice(0, 60).map(function(r) {
		return {
			aktion: "geprueft",
			akteur_email: r.report_json && (r.report_json._name || r.report_json._email) ? r.report_json._name || r.report_json._email : "",
			ziel_text: r.firmenname || "",
			created_at: r.created_at,
			_score: typeof r.score === "number" ? r.score : null
		};
	});
	(AUDIT_ROWS || []).forEach(function(a) {
		if (a.detail) a.detail = a.detail.replace(/\bpresident\b/g, "President").replace(/\bvice\b/g, "Vice President").replace(/\bsenior\b/g, "Senior").replace(/\bmember\b/g, "Member");
	});
	const alleAktivitaeten = (AUDIT_ROWS || []).concat(ausPruefungen).sort(function(a, b) {
		return new Date(b.created_at) - new Date(a.created_at);
	}).slice(0, 40);
	let listHtml;
	if (!alleAktivitaeten.length) {
		listHtml = "<div class=\"audit-empty\">Noch keine Aktivitäten protokolliert. Rangwechsel, Ordner (angelegt, freigegeben, gelöscht), Gruppen und Prüfungen erscheinen hier.</div>";
	} else {
		listHtml = "<div class=\"audit-list\">" + alleAktivitaeten.map(function(a, idx) {
			const cls = icCls[a.aktion] || "down";
			const v = escapeHtml(verb[a.aktion] || a.aktion);
			const dt = a.created_at ? new Date(a.created_at) : null;
			const when = dt ? dt.toLocaleDateString("de-DE", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric"
			}) + " · " + dt.toLocaleTimeString("de-DE", {
				hour: "2-digit",
				minute: "2-digit"
			}) : "";
			return "<div class=\"audit-row\" style=\"animation-delay:" + Math.min(idx * 40, 500) + "ms\">" + "<span class=\"audit-ic " + cls + "\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\">" + (icSvg[cls] || "") + "</svg></span>" + "<div class=\"audit-txt\"><b>" + escapeHtml(a.akteur_email || "(unbekannt)") + "</b> hat " + v + (a.ziel_text ? ": <b>" + escapeHtml(a.ziel_text) + "</b>" : "") + (a._score != null ? " <span class=\"audit-score audit-s-" + (a._score >= 75 ? "gruen" : a._score >= 50 ? "gelb" : "rot") + "\">Score " + a._score + "</span>" : "") + (a.detail ? "<div class=\"audit-detail\">" + escapeHtml(a.detail) + "</div>" : "") + "</div>" + "<span class=\"audit-time\">" + when + "</span>" + "</div>";
		}).join("") + "</div>";
	}
	tv.insertAdjacentHTML("beforeend", "<div id=\"auditBody\" class=\"audit-sec\"><div class=\"audit-head\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#16A34A\" stroke-width=\"2\"><path d=\"M12 8v4l3 2M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"/><path d=\"M3 3v5h5\"/></svg>Aktivitäts-Protokoll</div>" + listHtml + "</div>");
	sichtbarSicherstellen(tv);
}
function teamError(msg) {
	const tv = document.getElementById("teamView");
	const loading = tv ? tv.querySelector(".history-loading") : null;
	const html = "<div class=\"history-empty\">" + "<div class=\"empty-icon\" style=\"background:var(--bad-bg)\"><svg width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#EF4444\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z\"/></svg></div>" + "<p style=\"color:var(--bad-text);font-weight:600\">" + escapeHtml(friendlyError(msg)) + "</p>" + "<button class=\"btn-retry\" data-act-click=\"h63\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M23 4v6h-6M1 20v-6h6\"/><path d=\"M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15\"/></svg>Erneut laden</button>" + (msg ? "<p class=\"err-detail\">Technisches Detail: " + escapeHtml(String(msg)) + "</p>" : "") + "</div>";
	if (loading) loading.outerHTML = html;
	else if (tv) tv.insertAdjacentHTML("beforeend", html);
}
function renderTeam() {
	const tv = document.getElementById("teamView");
	const sk = document.getElementById("teamSkeleton");
	if (sk && sk.parentNode) sk.remove();
	const loading = tv.querySelector(".history-loading");
	if (loading) loading.remove();
	const old = document.getElementById("teamBody");
	if (old) old.remove();
	const presAnz = TEAM_MEMBERS.filter(function(m) {
		return m.rang === "president";
	}).length;
	const meinWert = rangWert(CURRENT_USER_RANG);
	const rows = TEAM_MEMBERS.map(function(m, idx) {
		const info = RANG_INFO[m.rang] || RANG_INFO.member;
		const istSelf = m.user_id === CURRENT_USER_ID;
		const dt = m.beigetreten ? new Date(m.beigetreten) : null;
		const datum = dt ? dt.toLocaleDateString("de-DE", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric"
		}) : "–";
		const badge = "<span class=\"tm-badge tm-" + info.farbe + "\"><span class=\"tm-badge-ico\">" + (RANG_SVG[m.rang] || RANG_SVG.member) + "</span>" + info.name + "</span>";
		let darf = meinWert >= 3;
		if (CURRENT_USER_RANG === "vice" && m.rang === "president") darf = false;
		const letzterPres = m.rang === "president" && presAnz <= 1;
		let actions = "";
		if (darf) {
			const optionen = [
				"president",
				"vice",
				"senior",
				"member"
			].filter(function(r) {
				if (r === m.rang) return false;
				if (istSelf && r === "president" && CURRENT_USER_RANG !== "president") return false;
				if (istSelf && rangWert(r) > meinWert && r !== "president") return false;
				return true;
			});
			if (optionen.length && !letzterPres) {
				actions += "<select class=\"tm-select\" data-act-change=\"h95\" data-a0=\"" + escapeAttr(m.user_id) + "\">" + "<option value=\"\">Rang ändern…</option>" + optionen.map(function(r) {
					return "<option value=\"" + r + "\">" + rangName(r) + "</option>";
				}).join("") + "</select>";
			}
			if (!istSelf && !letzterPres) {
				actions += "<button class=\"tm-btn kick\" data-act-click=\"h96\" data-a0=\"" + escapeAttr(m.user_id) + "\">Entfernen</button>";
			}
			if (letzterPres) actions += "<span class=\"tm-hinweis\">Letzter President</span>";
		}
		return "<div class=\"team-row\">" + "<div class=\"tm-main\">" + "<div class=\"tm-email\">" + escapeHtml(m.anzeige || m.email || "(unbekannt)") + (istSelf ? "<span class=\"tm-you\">Du</span>" : "") + "</div>" + "<div class=\"tm-meta\">" + (m.anzeige && m.anzeige !== m.email ? escapeHtml(m.email) + " · " : "") + "Beigetreten " + datum + "</div>" + "</div>" + "<div class=\"tm-right\">" + badge + "<div class=\"tm-actions\">" + actions + "</div></div>" + "</div>";
	}).join("");
	const einladungsBereich = darfVerwalten() ? "" + "<div class=\"team-block sec-in sec-in-1\">" + "<div class=\"team-block-h\">Neue Mitglieder einladen</div>" + "<div class=\"team-block-d\">Erzeuge einen Einladungslink und schick ihn per E-Mail oder Nachricht. Wer ihn öffnet, kann sich anmelden oder registrieren und landet automatisch in deinem Team.</div>" + "<div class=\"einl-neu\">" + "<select class=\"tm-select\" id=\"einlRang\">" + "<option value=\"member\">Als Member einladen</option>" + "<option value=\"senior\">Als Senior einladen</option>" + (CURRENT_USER_RANG === "president" ? "<option value=\"vice\">Als Vice President einladen</option>" : "") + "</select>" + "<input class=\"om-name-input\" id=\"einlNotiz\" placeholder=\"Notiz (optional) – z.B. für Herrn Meier\" />" + "<button class=\"btn-action primary\" data-act-click=\"h97\">Einladungslink erzeugen</button>" + "</div>" + "<div id=\"einlListe\" class=\"einl-liste\"><div class=\"einl-platzhalter\"></div></div>" + "</div>" : "";
	const rangErklaerung = "<div class=\"team-block sec-in sec-in-3\">" + "<div class=\"team-block-h\">Die vier Ränge</div>" + "<div class=\"rang-tabelle\">" + ((TEAM_MEMBERS || []).some(function(x) {
		return x.rang === "support";
	}) ? rangZeile("support", "Automati Labs Support – hilft bei Fragen und Problemen, verbraucht kein Kontingent.", 0) : "") + rangZeile("president", "Verwaltet das gesamte Team, vergibt alle Ränge, kauft Pakete. Kann als Einziger jemanden zum President machen.", 0) + rangZeile("vice", "Wie der President – kann jedoch den President nicht absetzen und niemanden zum President befördern.", 1) + rangZeile("senior", "Erstellt und verwaltet Ordner und teilt sie mit dem Team. Keine Team-Verwaltung.", 2) + rangZeile("member", "Führt Prüfungen durch und arbeitet mit den freigegebenen Ordnern.", 3) + "</div></div>";
	const _audit = document.getElementById("auditBody");
	const _ziel = _audit ? _audit : tv;
	_ziel.insertAdjacentHTML(_audit ? "beforebegin" : "beforeend", "<div id=\"teamBody\">" + einladungsBereich + "<div class=\"team-block sec-in sec-in-2\" style=\"margin-top:22px;\">" + "<div class=\"team-block-h\">Mitglieder (" + TEAM_MEMBERS.length + ")</div>" + "<div class=\"team-block-d\">Klicke bei einem Mitglied auf „Rang ändern“, um es zu befördern oder zurückzustufen.</div>" + "<div class=\"history-list team-liste\">" + rows + "</div>" + "</div>" + rangErklaerung + teamFussHtml() + "</div>");
	sichtbarSicherstellen(tv);
	ladeFirmencode();
	if (darfVerwalten()) ladeEinladungen();
}
var SUP_FIRMEN = [];
var SUP_TAB = "uebersicht";
var SD = {
	tage: 30,
	ohneIntern: true,
	tab: "uebersicht",
	d: null,
	dFehler: null,
	status: null,
	firmen: [],
	akt: [],
	laedt: false,
	info: {},
	infoDa: false,
	stand: null,
	filter: "alle",
	suche: "",
	sort: {
		k: "monat",
		ab: true
	},
	drawer: null,
	tabelle: false,
	aktSuche: "",
	zeichner: []
};
var SD_PAKET = {
	100: "Bronze",
	300: "Silber",
	600: "Gold",
	1e3: "Platinum"
};
var SD_SERIE = {
	tool: "#3987e5",
	api: "#d95926",
	support: "#199e70",
	firmen: "#d95926"
};
var SD_ST = {
	gut: "#0ca30c",
	warn: "#fab219",
	ernst: "#ec835a",
	krit: "#d03b3b",
	leer: "#4a515b"
};
var SD_SEQ = [
	"#0d366b",
	"#104281",
	"#184f95",
	"#1c5cab",
	"#256abf",
	"#2a78d6",
	"#3987e5",
	"#5598e7",
	"#6da7ec",
	"#86b6ef"
];
var SD_TABS = [
	{
		id: "uebersicht",
		t: "Übersicht",
		ico: "<path d=\"M3 13h8V3H3zM13 21h8V11h-8zM13 3v6h8V3zM3 21h8v-6H3z\"/>"
	},
	{
		id: "firmen",
		t: "Kunden",
		ico: "<path d=\"M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1\"/>"
	},
	{
		id: "nutzer",
		t: "Nutzer",
		ico: "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75\"/>"
	},
	{
		id: "aktivitaet",
		t: "Aktivität",
		ico: "<path d=\"M22 12h-4l-3 9L9 3l-3 9H2\"/>"
	},
	{
		id: "api",
		t: "REST-API",
		ico: "<path d=\"m16 18 6-6-6-6M8 6l-6 6 6 6\"/>"
	},
	{
		id: "system",
		t: "System",
		ico: "<rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M8 21h8M12 17v4\"/>"
	}
];
function sdZ(n) {
	return (Number(n) || 0).toLocaleString("de-DE");
}
function sdEuro(n) {
	n = Number(n) || 0;
	const k = Math.round(n * 100) % 100 !== 0 ? 2 : 0;
	return n.toLocaleString("de-DE", {
		style: "currency",
		currency: "EUR",
		minimumFractionDigits: k,
		maximumFractionDigits: k
	});
}
function sdKurz(n) {
	n = Number(n) || 0;
	return n >= 1e4 ? (n / 1e3).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + "K" : n >= 1e3 ? (n / 1e3).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "K" : String(n);
}
function sdTag(iso, mitWochentag) {
	const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
	if (isNaN(d.getTime())) return String(iso || "");
	return (mitWochentag ? [
		"So",
		"Mo",
		"Di",
		"Mi",
		"Do",
		"Fr",
		"Sa"
	][d.getDay()] + " " : "") + ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + ".";
}
function sdVor(iso) {
	if (!iso) return "nie";
	const t = (Date.now() - new Date(iso).getTime()) / 1e3;
	if (isNaN(t)) return "–";
	if (t < 90) return "gerade eben";
	if (t < 3600) return "vor " + Math.round(t / 60) + " Min.";
	if (t < 86400) return "vor " + Math.round(t / 3600) + " Std.";
	const tg = Math.round(t / 86400);
	return tg === 1 ? "gestern" : "vor " + tg + " Tagen";
}
function sdTicks(max, n) {
	max = Math.max(1, Number(max) || 0);
	n = n || 4;
	let p = Math.pow(10, Math.floor(Math.log10(max / n))), schritt = 1;
	if (p < 1) p = 1;
	for (const f of [
		1,
		2,
		5,
		10,
		20,
		50
	]) {
		schritt = f * p;
		if (Math.ceil(max / schritt) <= n + 1) break;
	}
	const out = [];
	for (let v = 0; out.length < 2 || out[out.length - 1] < max; v += schritt) {
		out.push(v);
		if (out.length > 12) break;
	}
	return out;
}
function sdDelta(jetzt, vorher, obenGut, einheit) {
	jetzt = Number(jetzt) || 0;
	vorher = Number(vorher) || 0;
	if (!vorher && !jetzt) return "";
	let txt, auf;
	if (einheit === "pkt") {
		const d = jetzt - vorher;
		if (!d) return "<span class=\"sd-delta\">± 0 Pkt.</span>";
		auf = d > 0;
		txt = (d > 0 ? "+" : "−") + Math.abs(d) + " Pkt.";
	} else if (!vorher) {
		auf = true;
		txt = "neu";
	} else {
		const p = Math.round((jetzt - vorher) / vorher * 100);
		if (!p) return "<span class=\"sd-delta\">± 0 %</span>";
		auf = p > 0;
		txt = (p > 0 ? "+" : "−") + Math.abs(p) + " %";
	}
	const gut = obenGut === null ? null : auf === obenGut;
	return "<span class=\"sd-delta " + (gut === null ? "" : gut ? "gut" : "schlecht") + "\">" + (auf ? "▲" : "▼") + " " + txt + "</span>";
}
function sdFirmaInfo(f) {
	const info = SD.info && SD.info[f.firma_id] || {};
	const lim = Number(f.monatslimit) || 0, intern = lim >= 999999 || info.intern === true;
	const betrag = info.umsatz_monat === null || info.umsatz_monat === undefined || info.umsatz_monat === "" ? null : Number(info.umsatz_monat);
	const zahlend = !intern && f.aktiv !== false && betrag !== null && betrag > 0;
	const letzte = f.letzte_analyse ? new Date(f.letzte_analyse) : null;
	const status = intern ? "intern" : f.aktiv === false ? "inaktiv" : zahlend ? "zahlend" : f.trial ? "test" : "aktiv";
	return {
		lim,
		intern,
		zahlend,
		betrag,
		umsatz: zahlend ? betrag : 0,
		status,
		betragFehlt: SD.infoDa && !intern && f.aktiv !== false && !f.trial && betrag === null,
		quote: lim && !intern ? Math.round((Number(f.analysen_monat) || 0) / lim * 100) : 0,
		tageRuhig: letzte ? Math.floor((Date.now() - letzte.getTime()) / 864e5) : null,
		paket: intern ? "Unbegrenzt" : f.trial ? "Testphase" : SD_PAKET[lim] ? SD_PAKET[lim] + " · " + lim : lim + " / Monat"
	};
}
var SD_STATUS_TXT = {
	zahlend: "Zahlend",
	test: "Testphase",
	aktiv: "Aktiv",
	inaktiv: "Inaktiv",
	intern: "Intern"
};
function sdKunden() {
	return (SD.firmen || []).filter(function(f) {
		return !SD.ohneIntern || !sdFirmaInfo(f).intern;
	});
}
function supportCenterOeffnen() {
	if (CURRENT_USER_RANG !== "support") {
		alert("Dieses Konto hat nicht den Rang „Support“ (aktuell: " + (CURRENT_USER_RANG || "unbekannt") + ").");
		return;
	}
	try {
		sdOeffnen();
	} catch (e) {
		alert("Support-Center: " + (e && e.message || "Fehler"));
	}
}
function supCenterAufbauen() {
	sdOeffnen();
}
function sdOeffnen() {
	let el = document.getElementById("supDash");
	if (!el) {
		el = document.createElement("div");
		el.id = "supDash";
		el.className = "sd";
		el.setAttribute("role", "dialog");
		el.setAttribute("aria-modal", "true");
		el.setAttribute("aria-label", "Support-Center");
		el.setAttribute("data-tr", "aus");
		document.body.appendChild(el);
	}
	el.classList.remove("weg");
	el.innerHTML = sdGeruest();
	document.body.classList.add("sd-offen");
	document.documentElement.classList.add("sd-offen");
	requestAnimationFrame(function() {
		el.classList.add("an");
	});
	document.addEventListener("keydown", sdTaste);
	window.addEventListener("resize", sdGroesse);
	sdTabZeigen(SD.tab, true);
	if (SD.d !== null) sdRender();
	sdLaden(false);
}
function sdSchliessen() {
	const el = document.getElementById("supDash");
	document.removeEventListener("keydown", sdTaste);
	window.removeEventListener("resize", sdGroesse);
	document.body.classList.remove("sd-offen");
	document.documentElement.classList.remove("sd-offen");
	sdTipWeg();
	if (!el) return;
	el.classList.remove("an");
	el.classList.add("weg");
	setTimeout(function() {
		if (el.classList.contains("weg")) el.remove();
	}, 200);
}
function sdTaste(e) {
	if (e.key !== "Escape") return;
	if (document.getElementById("frageGate")) return;
	if (SD.drawer) {
		sdDrawerZu();
		return;
	}
	sdSchliessen();
}
var _sdGroesseT = null;
function sdGroesse() {
	clearTimeout(_sdGroesseT);
	_sdGroesseT = setTimeout(function() {
		SD.zeichner.forEach(function(f) {
			try {
				f();
			} catch (e) {}
		});
	}, 120);
}
function sdIco(pfad, g) {
	return "<svg viewBox=\"0 0 24 24\" width=\"" + (g || 17) + "\" height=\"" + (g || 17) + "\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">" + pfad + "</svg>";
}
function sdGeruest() {
	return "<aside class=\"sd-side\">" + "<div class=\"sd-brand\"><span class=\"sd-logo\">" + sdIco("<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\"/>", 16) + "</span>" + "<div><b>Support-Center</b><small>Compliance-Checker · intern</small></div></div>" + "<nav class=\"sd-nav\" aria-label=\"Bereiche\">" + SD_TABS.map(function(t) {
		return "<button type=\"button\" class=\"sd-nav-btn\" data-tab=\"" + t.id + "\" data-act-click=\"h98\" data-a0=\"" + escapeAttr(t.id) + "\">" + sdIco(t.ico) + "<span>" + t.t + "</span><em class=\"sd-badge\" id=\"sdBadge_" + t.id + "\" hidden></em></button>";
	}).join("") + "</nav>" + "<div class=\"sd-side-fuss\"><button type=\"button\" class=\"sd-btn sd-voll\" data-act-click=\"h99\">" + sdIco("<path d=\"M19 12H5M12 19l-7-7 7-7\"/>", 15) + "Zum Tool</button>" + "<small class=\"sd-ver\">" + escapeHtml(typeof APP_VERSION !== "undefined" ? APP_VERSION : "") + " · " + escapeHtml(CURRENT_USER_EMAIL || "") + "</small></div>" + "</aside>" + "<main class=\"sd-main\" id=\"sdMain\">" + "<header class=\"sd-top\"><div class=\"sd-top-l\"><h1 id=\"sdTitel\">Übersicht</h1><span class=\"sd-stand\" id=\"sdStand\"><i class=\"sd-live\"></i>wird geladen …</span></div>" + "<div class=\"sd-filter\">" + "<div class=\"sd-seg\" role=\"radiogroup\" aria-label=\"Zeitraum\">" + [
		7,
		30,
		90
	].map(function(t) {
		return "<button type=\"button\" role=\"radio\" aria-checked=\"" + (SD.tage === t) + "\" class=\"" + (SD.tage === t ? "an" : "") + "\" data-act-click=\"h100\" data-a0=\"" + escapeAttr(t) + "\">" + t + " Tage</button>";
	}).join("") + "</div>" + "<label class=\"sd-schalter\" title=\"Interne Konten (unbegrenztes Kontingent, z. B. Automati Labs) aus allen Zahlen herausrechnen\">" + "<input type=\"checkbox\" id=\"sdIntern\"" + (SD.ohneIntern ? " checked" : "") + " data-act-change=\"h101\"><span class=\"sd-sch-bahn\"><i></i></span>Interne ausblenden</label>" + "<button type=\"button\" class=\"sd-btn sd-ico-btn\" id=\"sdNeu\" data-act-click=\"h102\" title=\"Aktualisieren\" aria-label=\"Aktualisieren\">" + sdIco("<path d=\"M21 12a9 9 0 1 1-2.64-6.36L21 8\"/><path d=\"M21 3v5h-5\"/>", 16) + "</button>" + "</div></header>" + "<div id=\"sdHinweis\"></div>" + "<div id=\"sdBody\" class=\"sd-body\"><div class=\"sd-leer-gross\"><span class=\"neu-spin\"></span>Daten werden geladen …</div></div>" + "</main>" + "<div class=\"sd-drawer-hg\" id=\"sdDrawerHg\" data-act-click=\"h103\"></div><aside class=\"sd-drawer\" id=\"sdDrawer\" aria-hidden=\"true\"></aside>" + "<div id=\"sdTip\" class=\"sd-tip\" role=\"tooltip\"></div>";
}
function sdTabZeigen(id, ohneRender) {
	SD.tab = SUP_TAB = id;
	document.querySelectorAll("#supDash .sd-nav-btn").forEach(function(b) {
		const an = b.getAttribute("data-tab") === id;
		b.classList.toggle("aktiv", an);
		b.setAttribute("aria-current", an ? "page" : "false");
	});
	const t = SD_TABS.find(function(x) {
		return x.id === id;
	});
	const h = document.getElementById("sdTitel");
	if (h && t) h.textContent = t.t;
	const m = document.getElementById("sdMain");
	if (m) m.scrollTop = 0;
	if (!ohneRender) sdRender();
}
function sdZeitraum(t) {
	SD.tage = t;
	document.querySelectorAll("#supDash .sd-seg button").forEach(function(b) {
		const an = b.textContent.indexOf(t + " ") === 0;
		b.classList.toggle("an", an);
		b.setAttribute("aria-checked", an ? "true" : "false");
	});
	sdLaden(true);
}
function sdInternSetzen(an) {
	SD.ohneIntern = !!an;
	sdLaden(true);
}
async function sdLaden(still) {
	if (SD.laedt) return;
	SD.laedt = true;
	const body = document.getElementById("sdBody"), knopf = document.getElementById("sdNeu");
	if (body && SD.d !== null) body.classList.add("lade");
	if (knopf) knopf.classList.add("dreht");
	const r = await Promise.allSettled([
		sb.rpc("sup_dashboard", {
			p_tage: SD.tage,
			p_ohne_intern: SD.ohneIntern
		}),
		sb.rpc("sup_status"),
		sb.rpc("sup_firmen"),
		sb.rpc("sup_aktivitaet", { p_max: 60 })
	]);
	const wert = function(x) {
		return x.status === "fulfilled" && x.value && !x.value.error ? x.value.data : null;
	};
	const fehler = function(x) {
		return x.status === "rejected" ? x.reason && x.reason.message || "Fehler" : x.value && x.value.error ? x.value.error.message || "Fehler" : null;
	};
	SD.d = wert(r[0]) || false;
	SD.dFehler = fehler(r[0]);
	SD.status = wert(r[1]) || {};
	SD.firmen = wert(r[2]) || [];
	SD.akt = wert(r[3]) || [];
	SD.basisFehler = fehler(r[1]) || fehler(r[2]);
	SD.infoDa = !!(SD.d && Array.isArray(SD.d.kunden_info));
	SD.info = {};
	if (SD.infoDa) SD.d.kunden_info.forEach(function(k) {
		if (k && k.firma_id) SD.info[k.firma_id] = k;
	});
	SUP_FIRMEN = SD.firmen;
	SD.stand = new Date();
	SD.laedt = false;
	if (body) body.classList.remove("lade");
	if (knopf) knopf.classList.remove("dreht");
	const st = document.getElementById("sdStand");
	if (st) st.innerHTML = "<i class=\"sd-live\"></i>Stand " + SD.stand.toLocaleTimeString("de-DE", {
		hour: "2-digit",
		minute: "2-digit"
	}) + " Uhr";
	sdRender();
	if (!still && SD.d === false && !SD.basisFehler) {}
}
async function supLade() {
	if (document.getElementById("supDash")) {
		await sdLaden(true);
		if (SD.drawer) sdFirmaOeffnen(SD.drawer, true);
	}
}
function sdRender() {
	const b = document.getElementById("sdBody");
	if (!b) return;
	SD.zeichner = [];
	sdTipWeg();
	const hw = document.getElementById("sdHinweis");
	if (hw) {
		let txt = "";
		if (SD.basisFehler) txt = "<b>Daten konnten nicht geladen werden.</b> " + escapeHtml(SD.basisFehler);
		else if (SD.d && !SD.infoDa) txt = "<b>Monatsbeträge fehlen noch:</b> Bitte die neue <code>migration_2026-10-11_support_dashboard.sql</code> noch einmal im Supabase SQL-Editor ausführen. Erst dann lassen sich Beträge pro Kunde hinterlegen und der Umsatz stimmt.";
		else if (SD.d === false) txt = "<b>Diagramme fehlen noch:</b> Bitte <code>migration_2026-10-11_support_dashboard.sql</code> einmal im Supabase SQL-Editor ausführen. Kennzahlen aus den bestehenden Funktionen werden schon angezeigt." + (SD.dFehler ? " <span class=\"sd-grau\">(" + escapeHtml(SD.dFehler) + ")</span>" : "");
		hw.innerHTML = txt ? "<div class=\"sd-banner\">" + sdIco("<path d=\"M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01\"/>", 16) + "<div>" + txt + "</div></div>" : "";
	}
	const hinweise = sdHinweise();
	SD.hinweise = hinweise;
	sdWegAufraeumen(hinweise);
	const sichtbar = hinweise.filter(function(h) {
		return !sdIstWeg(h);
	});
	const krit = sichtbar.filter(function(h) {
		return h.stufe === "krit" || h.stufe === "warn";
	}).length;
	sdBadge("uebersicht", krit, sichtbar.some(function(h) {
		return h.stufe === "krit";
	}) ? "" : "warn");
	const unbL = SD.d && SD.d.nutzer && Array.isArray(SD.d.nutzer.unbestaetigt_liste) ? SD.d.nutzer.unbestaetigt_liste : [];
	if (SD.tab === "nutzer" && SD.d) {
		const g = {};
		unbL.forEach(function(u) {
			g[u.user_id] = 1;
		});
		sdSchreib(SD_GESEHEN_KEY, g);
	}
	const gesehen = sdLies(SD_GESEHEN_KEY);
	sdBadge("nutzer", unbL.filter(function(u) {
		return !gesehen[u.user_id];
	}).length, "warn");
	const apiH = hinweise.find(function(h) {
		return h.id === "api5";
	});
	sdBadge("api", apiH && !sdIstWeg(apiH) ? sdApiServerfehler(2) : 0, "");
	try {
		if (SD.tab === "uebersicht") sdUebersicht(b, hinweise);
		else if (SD.tab === "firmen") sdKundenTab(b);
		else if (SD.tab === "nutzer") sdNutzerTab(b);
		else if (SD.tab === "aktivitaet") sdAktTab(b);
		else if (SD.tab === "api") sdApiTab(b);
		else sdSystemTab(b);
	} catch (e) {
		b.innerHTML = "<div class=\"sd-karte sd-fehlerkarte\"><b>Anzeige-Fehler</b><br/>" + escapeHtml(e && e.message || "") + "</div>";
		console.error("Support-Dashboard:", e);
	}
	SD.zeichner.forEach(function(f) {
		try {
			f();
		} catch (e) {
			console.warn("Diagramm:", e && e.message);
		}
	});
}
function sdBadge(tab, n, art) {
	const el = document.getElementById("sdBadge_" + tab);
	if (!el) return;
	el.hidden = !n;
	el.textContent = n > 99 ? "99+" : String(n || "");
	el.className = "sd-badge" + (art ? " " + art : "");
}
function sdKarte(titel, unter, inhalt, klasse, kopfExtra) {
	return "<section class=\"sd-karte " + (klasse || "") + "\"><div class=\"sd-k-kopf\"><div><h2 class=\"sd-k-t\">" + titel + "</h2>" + (unter ? "<div class=\"sd-k-u\">" + unter + "</div>" : "") + "</div>" + (kopfExtra || "") + "</div>" + inhalt + "</section>";
}
function sdLeer(txt) {
	return "<div class=\"sd-leer\">" + txt + "</div>";
}
function sdKpi(o) {
	return "<div class=\"sd-karte sd-kpi\">" + "<div class=\"sd-kpi-l\">" + o.label + (o.info ? " <span class=\"sd-i\" title=\"" + escapeHtml(o.info) + "\">i</span>" : "") + "</div>" + "<div class=\"sd-kpi-w\">" + o.wert + (o.einheit ? "<small>" + o.einheit + "</small>" : "") + "</div>" + "<div class=\"sd-kpi-u\">" + (o.delta || "") + (o.unter ? "<span>" + o.unter + "</span>" : "") + "</div>" + (o.spark ? "<div class=\"sd-spark\" id=\"" + o.spark + "\"></div>" : "") + "</div>";
}
function sdApiServerfehler(tage) {
	const api = SD.d && SD.d.api;
	if (!api || !Array.isArray(api.tage)) return 0;
	return api.tage.slice(-tage).reduce(function(s, t) {
		return s + (Number(t.server) || 0);
	}, 0);
}
function sdHinweise() {
	const l = [], s = SD.status || {}, d = SD.d || {};
	const sank = (s.sanktionen || [])[0] || {};
	const alt = sank.stand ? Math.floor((Date.now() - new Date(sank.stand).getTime()) / 864e5) : null;
	if (sank.meldung) l.push({
		id: "sank",
		sig: "fehler:" + sank.meldung,
		stufe: "krit",
		t: "Sanktionsliste: Fehler beim Aktualisieren",
		d: sank.meldung,
		ziel: "system"
	});
	else if (alt === null) l.push({
		id: "sank",
		sig: "fehlt",
		stufe: "krit",
		t: "Sanktionsliste nicht geladen",
		d: "Ohne Liste läuft kein Abgleich.",
		ziel: "system"
	});
	else if (alt > 2) l.push({
		id: "sank",
		sig: "alt:" + String(sank.stand).slice(0, 10) + (alt > 8 ? ":krit" : ""),
		stufe: alt > 8 ? "krit" : "warn",
		t: "Sanktionsliste veraltet",
		d: "Stand " + new Date(sank.stand).toLocaleDateString("de-DE") + " · vor " + alt + " Tagen",
		ziel: "system"
	});
	const api5 = sdApiServerfehler(2);
	if (api5) l.push({
		id: "api5",
		sig: sdLetzter5xx() || "n" + api5,
		stufe: "krit",
		t: "REST-API: " + api5 + " Serverfehler",
		d: "In den letzten 2 Tagen (Status 5xx).",
		ziel: "api"
	});
	const kunden = sdKunden().map(function(f) {
		return {
			f,
			i: sdFirmaInfo(f)
		};
	});
	const voll = kunden.filter(function(x) {
		return !x.i.intern && x.f.aktiv !== false && x.i.quote >= 90;
	}).sort(function(a, b) {
		return b.i.quote - a.i.quote;
	});
	if (voll.length) l.push({
		id: "voll",
		sig: sdSig(voll),
		stufe: "warn",
		t: "Kontingent fast aufgebraucht",
		d: voll.slice(0, 3).map(function(x) {
			return x.f.name + " (" + x.i.quote + " %)";
		}).join(", ") + (voll.length > 3 ? " und " + (voll.length - 3) + " weitere" : ""),
		ziel: "firmen",
		filter: "voll"
	});
	const ruhig = kunden.filter(function(x) {
		return !x.i.intern && x.f.aktiv !== false && x.i.status !== "test" && x.i.betrag !== 0 && (x.i.tageRuhig === null || x.i.tageRuhig >= 14);
	});
	if (ruhig.length) l.push({
		id: "ruhig",
		sig: sdSig(ruhig),
		stufe: "warn",
		t: ruhig.length + " " + (ruhig.length === 1 ? "Kunde" : "Kunden") + " seit 14+ Tagen ohne Prüfung",
		d: "Kündigungsrisiko – " + ruhig.slice(0, 3).map(function(x) {
			return x.f.name;
		}).join(", "),
		ziel: "firmen",
		filter: "ruhig"
	});
	const n = d.nutzer || {};
	const unbListe = (n.unbestaetigt_liste || []).filter(function(u) {
		return Date.now() - new Date(u.erstellt).getTime() > 864e5;
	});
	const unbAlt = unbListe.length;
	if (unbAlt) l.push({
		id: "unb",
		sig: unbListe.map(function(u) {
			return u.user_id;
		}).sort().join(","),
		stufe: "warn",
		t: unbAlt + " Nutzer seit über 24 Std. unbestätigt",
		d: "Bestätigungs-Mail nicht angekommen? Im Bereich Nutzer freischalten.",
		ziel: "nutzer"
	});
	if (Number(s.faellige_favoriten) > 0) l.push({
		id: "faellig",
		sig: "x",
		stufe: "warn",
		t: s.faellige_favoriten + " Überwachungen fällig",
		d: "Laufen beim nächsten Cron-Durchlauf.",
		ziel: "system"
	});
	const amb = d.api && d.api.pruefungen ? Number(d.api.pruefungen.ambiguous) || 0 : 0;
	if (amb) l.push({
		id: "amb",
		sig: "n" + amb,
		stufe: "info",
		t: amb + " API-Prüfungen mehrdeutig (409)",
		d: "Der Kunde musste präzisieren.",
		ziel: "api"
	});
	const ohneBetrag = kunden.filter(function(x) {
		return x.i.betragFehlt;
	});
	if (ohneBetrag.length) l.push({
		id: "betrag",
		sig: sdSig(ohneBetrag),
		stufe: "info",
		t: ohneBetrag.length + " " + (ohneBetrag.length === 1 ? "Kunde" : "Kunden") + " ohne Monatsbetrag",
		d: "Für den Umsatz eintragen (oder 0 €) – " + ohneBetrag.slice(0, 3).map(function(x) {
			return x.f.name;
		}).join(", "),
		ziel: "firmen",
		filter: "offen"
	});
	const test = kunden.filter(function(x) {
		return x.i.status === "test" && (Number(x.f.analysen_gesamt) || 0) >= 2;
	});
	if (test.length) l.push({
		id: "test",
		sig: sdSig(test),
		stufe: "gut",
		t: test.length + " aktive Testphase" + (test.length === 1 ? "" : "n") + " – Verkaufschance",
		d: test.slice(0, 3).map(function(x) {
			return x.f.name + " (" + x.f.analysen_gesamt + " Prüfungen)";
		}).join(", "),
		ziel: "firmen",
		filter: "test"
	});
	if (SD.d === false) l.push({
		id: "sql",
		sig: "x",
		stufe: "info",
		t: "Datenbank-Funktion für Diagramme fehlt",
		d: "migration_2026-10-11_support_dashboard.sql ausführen.",
		ziel: "system"
	});
	return l;
}
var SD_STUFE_ICO = {
	krit: "<path d=\"M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01\"/>",
	warn: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 8v4M12 16h.01\"/>",
	info: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4M12 8h.01\"/>",
	gut: "<path d=\"M20 6 9 17l-5-5\"/>"
};
var SD_STUFE_TXT = {
	krit: "Kritisch",
	warn: "Achtung",
	info: "Hinweis",
	gut: "Chance"
};
function sdHinweiseHTML(l) {
	const sichtbar = l.filter(function(h) {
		return !sdIstWeg(h);
	}), weg = l.length - sichtbar.length;
	const zeigen = weg ? "<button type=\"button\" class=\"sd-hw-zeigen\" data-act-click=\"h104\">" + weg + " ausgeblendet · wieder anzeigen</button>" : "";
	if (!sichtbar.length) return "<div class=\"sd-alles-gut\">" + sdIco(SD_STUFE_ICO.gut, 18) + "<div><b>" + (weg ? "Alles abgehakt" : "Alles im grünen Bereich") + "</b><span>" + (weg ? "Neue Punkte erscheinen automatisch wieder." : "Kein Handlungsbedarf erkannt.") + "</span></div></div>" + zeigen;
	const ord = {
		krit: 0,
		warn: 1,
		info: 2,
		gut: 3
	};
	return "<div class=\"sd-hw-rahmen\"><ul class=\"sd-hw-liste\">" + sichtbar.slice().sort(function(a, b) {
		return ord[a.stufe] - ord[b.stufe];
	}).map(function(h) {
		return "<li class=\"sd-hw-zeile\"><button type=\"button\" class=\"sd-hw sd-hw-" + h.stufe + "\" data-act-click=\"h105\" data-a0=\"" + escapeAttr(h.ziel) + "\" data-a1=\"" + escapeAttr(h.filter || "") + "\">" + "<span class=\"sd-hw-ico\" aria-hidden=\"true\">" + sdIco(SD_STUFE_ICO[h.stufe], 15) + "</span>" + "<span class=\"sd-hw-txt\"><b>" + escapeHtml(h.t) + "</b><span>" + escapeHtml(h.d || "") + "</span></span>" + "<span class=\"sd-hw-stufe\">" + SD_STUFE_TXT[h.stufe] + "</span></button>" + "<button type=\"button\" class=\"sd-hw-weg\" data-id=\"" + h.id + "\" data-act-click=\"h106\" data-a0=\"" + escapeAttr(h.id) + "\" title=\"Ausblenden – kommt wieder, sobald sich etwas ändert\" aria-label=\"Ausblenden: " + escapeHtml(h.t) + "\">" + sdIco("<path d=\"M18 6 6 18M6 6l12 12\"/>", 14) + "</button></li>";
	}).join("") + "</ul></div>" + zeigen;
}
var SD_WEG_KEY = "sd_ausgeblendet_v1";
var SD_GESEHEN_KEY = "sd_unb_gesehen_v1";
var _sdSpeicher = {};
function sdLies(k) {
	try {
		const v = JSON.parse(localStorage.getItem(k) || "null");
		if (v && typeof v === "object") return v;
	} catch (e) {}
	return _sdSpeicher[k] || {};
}
function sdSchreib(k, v) {
	_sdSpeicher[k] = v;
	try {
		localStorage.setItem(k, JSON.stringify(v));
	} catch (e) {}
}
function sdSig(liste) {
	return liste.map(function(x) {
		return x.f.firma_id;
	}).sort().join(",");
}
function sdLetzter5xx() {
	const api = SD.d && SD.d.api;
	if (!api) return "";
	const f = (api.letzte_fehler || []).find(function(e) {
		return Number(e.status) >= 500;
	});
	if (f && f.zeit) return String(f.zeit);
	const t = (api.tage || []).filter(function(x) {
		return Number(x.server) > 0;
	}).pop();
	return t ? "tag:" + t.d + ":" + t.server : "";
}
function sdIstWeg(h) {
	return !!h && !!h.id && sdLies(SD_WEG_KEY)[h.id] === h.sig;
}
function sdAusblenden(id) {
	const h = (SD.hinweise || []).find(function(x) {
		return x.id === id;
	});
	if (!h) return;
	const w = sdLies(SD_WEG_KEY);
	w[id] = h.sig;
	sdSchreib(SD_WEG_KEY, w);
	sdRender();
}
function sdAlleZeigen() {
	const w = sdLies(SD_WEG_KEY);
	(SD.hinweise || []).forEach(function(h) {
		delete w[h.id];
	});
	sdSchreib(SD_WEG_KEY, w);
	sdRender();
}
function sdWegAufraeumen(l) {
	if (!SD.d || SD.basisFehler || !SD.ohneIntern) return;
	const w = sdLies(SD_WEG_KEY);
	let neu = false;
	Object.keys(w).forEach(function(id) {
		if (!l.some(function(h) {
			return h.id === id;
		})) {
			delete w[id];
			neu = true;
		}
	});
	if (neu) sdSchreib(SD_WEG_KEY, w);
}
function sdHinweisOeffnen(ziel, filter) {
	if (filter) {
		SD.filter = filter;
		SD.suche = "";
	}
	sdTabZeigen(ziel);
}
function sdUebersicht(b, hinweise) {
	const d = SD.d || {}, s = SD.status || {}, p = d.pruefungen || {}, n = d.nutzer || {}, api = d.api || null;
	const kunden = sdKunden().map(function(f) {
		return {
			f,
			i: sdFirmaInfo(f)
		};
	});
	const zahlend = kunden.filter(function(x) {
		return x.i.zahlend;
	});
	const offenH = hinweise.filter(function(h) {
		return !sdIstWeg(h);
	}).length;
	const vonDatum = d.von ? new Date(d.von + "T00:00:00") : new Date(Date.now() - SD.tage * 864e5);
	const aktiveKunden = kunden.filter(function(x) {
		return !x.i.intern && x.f.letzte_analyse && new Date(x.f.letzte_analyse) >= vonDatum;
	}).length;
	const tage = Array.isArray(d.pruefungen_tage) ? d.pruefungen_tage : [];
	const fq = api && api.aufrufe_zeitraum ? Math.round((api.fehler_zeitraum || 0) / api.aufrufe_zeitraum * 1e3) / 10 : 0;
	const kpis = "<div class=\"sd-kpis\">" + sdKpi({
		label: "Prüfungen · " + SD.tage + " Tage",
		wert: SD.d ? sdZ(p.zeitraum) : sdZ(s.analysen_monat),
		delta: SD.d ? sdDelta(p.zeitraum, p.vorzeitraum, true) : "",
		unter: SD.d ? "vs. Vorzeitraum · heute " + sdZ(p.heute) : "diesen Monat",
		spark: tage.length ? "sdSp1" : ""
	}) + sdKpi({
		label: "Aktive Kunden",
		wert: sdZ(aktiveKunden),
		einheit: " / " + sdZ(kunden.filter(function(x) {
			return !x.i.intern;
		}).length),
		unter: zahlend.length + " zahlend · " + kunden.filter(function(x) {
			return x.i.status === "test";
		}).length + " Testphase",
		info: "Kunden mit mindestens einer Prüfung im Zeitraum"
	}) + sdKpi(sdUmsatzKpi(kunden)) + sdKpi({
		label: "Nutzer aktiv · 7 Tage",
		wert: SD.d ? sdZ(n.aktiv_7) : "–",
		einheit: SD.d ? " / " + sdZ(n.gesamt) : "",
		delta: SD.d ? sdDelta(n.neu_zeitraum, n.neu_vorher, true) : "",
		unter: SD.d ? sdZ(n.neu_zeitraum) + " neu im Zeitraum" : "Funktion fehlt",
		spark: (n.tage || []).length ? "sdSp4" : ""
	}) + sdKpi({
		label: "Ø Score",
		wert: p.score_schnitt != null ? p.score_schnitt : "–",
		einheit: p.score_schnitt != null ? " / 100" : "",
		delta: p.score_schnitt != null && p.score_schnitt_vorher != null ? sdDelta(p.score_schnitt, p.score_schnitt_vorher, null, "pkt") : "",
		unter: "aller Prüfungen im Zeitraum"
	}) + sdKpi({
		label: "REST-API",
		wert: api ? sdZ(api.aufrufe_zeitraum) : "–",
		einheit: api ? " Aufrufe" : "",
		unter: api ? (fq ? fq.toLocaleString("de-DE") + " % Fehlerquote" : "keine Fehler") + " · " + sdZ(api.schluessel_aktiv) + " Schlüssel" : "keine Daten",
		spark: api && (api.tage || []).length ? "sdSp6" : ""
	}) + "</div>";
	const leg = "<div class=\"sd-legende\">" + [
		["tool", "Im Tool"],
		["api", "Über API"],
		["support", "Durch Support"]
	].map(function(x) {
		return "<span><i class=\"sd-leg-sw\" style=\"background:" + SD_SERIE[x[0]] + "\"></i>" + x[1] + "</span>";
	}).join("") + "</div>";
	const tabKnopf = "<button type=\"button\" class=\"sd-btn sd-klein\" data-act-click=\"h107\">" + (SD.tabelle ? "Diagramm" : "Tabelle") + "</button>";
	const hauptInhalt = !tage.length ? sdLeer("Keine Verlaufsdaten – Datenbank-Funktion fehlt.") : SD.tabelle ? sdTabelleTage(tage) : leg + "<div class=\"sd-chart\" id=\"sdC1\"></div>";
	const ampel = p.ampel || null;
	const tr = d.trichter || null;
	const laender = d.laender || [];
	const volle = kunden.filter(function(x) {
		return !x.i.intern && x.f.aktiv !== false && x.i.lim;
	}).sort(function(a, b) {
		return b.i.quote - a.i.quote;
	}).slice(0, 7);
	b.innerHTML = kpis + "<div class=\"sd-grid\">" + sdKarte("Prüfungen pro Tag", "Letzte " + SD.tage + " Tage · " + sdZ(p.zeitraum || 0) + " gesamt", hauptInhalt, "sd-s8", tabKnopf) + sdKarte("Handlungsbedarf", offenH ? offenH + " offen · mit × abhaken" : "Stand jetzt", sdHinweiseHTML(hinweise), "sd-s4 sd-hw-karte") + sdKarte("Ergebnis-Ampel", "Prüfungen im Zeitraum", ampel ? sdAmpelHTML(ampel) + sdScoreVerteilung(p.score_verteilung) : sdLeer("Keine Daten"), "sd-s4") + sdKarte("Akten-Fortschritt", "Akten aus dem Zeitraum", tr ? sdTrichterHTML(tr) : sdLeer("Keine Daten"), "sd-s4") + sdKarte("Länder", "Sitz der geprüften Firmen", laender.length ? sdBalkenHTML(laender.map(function(x) {
		return {
			l: x.land,
			w: x.n
		};
	}), SD_SERIE.tool) : sdLeer("Keine Daten"), "sd-s4") + sdKarte("Kontingent-Auslastung", "Diesen Monat · höchste zuerst", volle.length ? sdMeterHTML(volle) : sdLeer("Keine Kunden mit Kontingent"), "sd-s6") + sdKarte("Wann wird geprüft?", "Wochentag × Uhrzeit · deutsche Zeit", (d.wochenstunden || []).length ? "<div class=\"sd-chart\" id=\"sdHeat\"></div>" + sdHeatKennzahlen(d.wochenstunden) : sdLeer("Keine Daten"), "sd-s6") + sdKarte("Neue Nutzer pro Tag", sdZ(n.neu_zeitraum || 0) + " im Zeitraum", (n.tage || []).length ? "<div class=\"sd-chart\" id=\"sdC2\"></div>" : sdLeer("Keine Daten"), "sd-s6") + sdKarte("Aktivste Kunden", "Prüfungen im Zeitraum", (d.top_firmen || []).length ? sdBalkenHTML(d.top_firmen.map(function(x) {
		return {
			l: x.name || "Ohne Firma",
			w: x.n
		};
	}), SD_SERIE.tool) : sdLeer("Keine Daten"), "sd-s6") + sdKarte("Live-Aktivität", "Letzte Prüfungen aller Kunden", sdFeedHTML(SD.akt.slice(0, 9)), "sd-s12", "<button type=\"button\" class=\"sd-btn sd-klein\" data-act-click=\"h108\">Alle anzeigen</button>") + "</div>";
	const summen = tage.map(function(t) {
		return (t.tool || 0) + (t.api || 0) + (t.support || 0);
	});
	if (tage.length && !SD.tabelle) SD.zeichner.push(function() {
		sdSaeulen(document.getElementById("sdC1"), {
			rows: tage,
			serien: [
				{
					k: "tool",
					n: "Im Tool",
					f: SD_SERIE.tool
				},
				{
					k: "api",
					n: "Über API",
					f: SD_SERIE.api
				},
				{
					k: "support",
					n: "Durch Support",
					f: SD_SERIE.support
				}
			],
			hoehe: 250,
			titel: "Prüfungen pro Tag"
		});
	});
	if (tage.length) SD.zeichner.push(function() {
		sdSpark(document.getElementById("sdSp1"), summen);
	});
	if ((n.tage || []).length) {
		SD.zeichner.push(function() {
			sdSpark(document.getElementById("sdSp4"), n.tage.map(function(t) {
				return t.neu;
			}));
		});
		SD.zeichner.push(function() {
			sdSaeulen(document.getElementById("sdC2"), {
				rows: n.tage,
				serien: [{
					k: "neu",
					n: "Neue Nutzer",
					f: SD_SERIE.tool
				}],
				hoehe: 170,
				titel: "Neue Nutzer pro Tag"
			});
		});
	}
	if (api && (api.tage || []).length) SD.zeichner.push(function() {
		sdSpark(document.getElementById("sdSp6"), api.tage.map(function(t) {
			return (t.ok || 0) + (t.client || 0) + (t.server || 0);
		}));
	});
	if ((d.wochenstunden || []).length) SD.zeichner.push(function() {
		sdHeatmap(document.getElementById("sdHeat"), d.wochenstunden);
	});
}
function sdTabelleTage(tage) {
	return "<div class=\"sd-tab-scroll\"><table class=\"sd-tab\"><thead><tr><th>Tag</th><th class=\"r\">Im Tool</th><th class=\"r\">Über API</th><th class=\"r\">Support</th><th class=\"r\">Summe</th></tr></thead><tbody>" + tage.slice().reverse().map(function(t) {
		const s = (t.tool || 0) + (t.api || 0) + (t.support || 0);
		return "<tr><td>" + sdTag(t.d, true) + "</td><td class=\"r\">" + sdZ(t.tool) + "</td><td class=\"r\">" + sdZ(t.api) + "</td><td class=\"r\">" + sdZ(t.support) + "</td><td class=\"r\"><b>" + sdZ(s) + "</b></td></tr>";
	}).join("") + "</tbody></table></div>";
}
function sdAmpelHTML(a) {
	const teile = [
		{
			k: "ok",
			n: "Geringe Auffälligkeiten",
			f: SD_ST.gut,
			ico: SD_STUFE_ICO.gut
		},
		{
			k: "warn",
			n: "Erhöhte Sorgfalt",
			f: SD_ST.warn,
			ico: SD_STUFE_ICO.warn
		},
		{
			k: "bad",
			n: "Verstärkte Sorgfalt",
			f: SD_ST.krit,
			ico: SD_STUFE_ICO.krit
		},
		{
			k: "ohne",
			n: "Ohne Ergebnis",
			f: SD_ST.leer,
			ico: SD_STUFE_ICO.info
		}
	];
	const summe = teile.reduce(function(s, t) {
		return s + (Number(a[t.k]) || 0);
	}, 0);
	if (!summe) return sdLeer("Keine Prüfungen im Zeitraum");
	const sicht = teile.filter(function(t) {
		return Number(a[t.k]) > 0;
	});
	return "<div class=\"sd-stapel\" role=\"img\" aria-label=\"Verteilung der Ergebnisse\">" + sicht.map(function(t) {
		const w = (Number(a[t.k]) || 0) / summe * 100;
		return "<span style=\"flex:" + w + " 1 0;background:" + t.f + "\" title=\"" + t.n + ": " + a[t.k] + "\"></span>";
	}).join("") + "</div>" + "<ul class=\"sd-ampel-liste\">" + teile.filter(function(t) {
		return t.k !== "ohne" || a.ohne;
	}).map(function(t) {
		const v = Number(a[t.k]) || 0;
		return "<li><span class=\"sd-am-ico\" style=\"color:" + t.f + "\">" + sdIco(t.ico, 14) + "</span><span class=\"sd-am-n\">" + t.n + "</span><b>" + sdZ(v) + "</b><em>" + Math.round(v / summe * 100) + " %</em></li>";
	}).join("") + "</ul>";
}
function sdTrichterHTML(t) {
	const akten = Number(t.akten) || 0;
	if (!akten) return sdLeer("Keine Akten im Zeitraum");
	const stufen = [
		[
			"Akte angelegt",
			akten,
			"#6da7ec"
		],
		[
			"Dokumente hochgeladen",
			t.dokumente,
			"#3987e5"
		],
		[
			"Endverbleib hochgeladen",
			t.endverbleib,
			"#256abf"
		],
		[
			"Abgeschlossen",
			t.abgeschlossen,
			"#184f95"
		]
	];
	return "<ul class=\"sd-balken\">" + stufen.map(function(s) {
		const v = Number(s[1]) || 0, pz = Math.round(v / akten * 100);
		return "<li><div class=\"sd-b-kopf\"><span>" + s[0] + "</span><span><b>" + sdZ(v) + "</b><em>" + pz + " %</em></span></div><div class=\"sd-b-bahn\"><i style=\"width:" + Math.max(v ? 1.5 : 0, pz) + "%;background:" + s[2] + "\"></i></div></li>";
	}).join("") + "</ul><div class=\"sd-fuss-notiz\">Abschlussquote <b>" + Math.round((Number(t.abgeschlossen) || 0) / akten * 100) + " %</b> · Endverbleib nur bei Autohandel</div>";
}
function sdBalkenHTML(items, farbe) {
	const max = Math.max(1, ...items.map(function(x) {
		return Number(x.w) || 0;
	}));
	return "<ul class=\"sd-balken\">" + items.map(function(x) {
		const v = Number(x.w) || 0;
		return "<li><div class=\"sd-b-kopf\"><span class=\"sd-b-l\">" + escapeHtml(String(x.l)) + "</span><span><b>" + sdZ(v) + "</b></span></div><div class=\"sd-b-bahn\"><i style=\"width:" + Math.max(v ? 1.5 : 0, v / max * 100) + "%;background:" + farbe + "\"></i></div></li>";
	}).join("") + "</ul>";
}
function sdMeterHTML(liste) {
	return "<ul class=\"sd-balken\">" + liste.map(function(x) {
		const q = x.i.quote, f = q >= 90 ? SD_ST.krit : q >= 70 ? SD_ST.warn : SD_SERIE.tool;
		const st = q >= 90 ? "kritisch" : q >= 70 ? "hoch" : "";
		return "<li class=\"sd-klickbar\" data-act-click=\"h109\" data-a0=\"" + escapeAttr(x.f.firma_id) + "\"><div class=\"sd-b-kopf\"><span class=\"sd-b-l\">" + escapeHtml(x.f.name) + " <small>" + escapeHtml(x.i.paket) + "</small></span>" + "<span>" + (st ? "<em class=\"sd-q-" + (q >= 90 ? "krit" : "warn") + "\">" + st + "</em>" : "") + "<b>" + q + " %</b><em>" + sdZ(x.f.analysen_monat) + " / " + sdZ(x.i.lim) + "</em></span></div>" + "<div class=\"sd-b-bahn sd-meter\"><i style=\"width:" + Math.min(100, Math.max(q ? 1.5 : 0, q)) + "%;background:" + f + "\"></i></div></li>";
	}).join("") + "</ul>";
}
function sdFeedHTML(l) {
	if (!l || !l.length) return sdLeer("Noch keine Aktivität.");
	return "<ul class=\"sd-feed\">" + l.map(function(a) {
		const sc = typeof a.score === "number" ? a.score : null;
		const f = sc === null ? SD_ST.leer : sc >= 75 ? SD_ST.gut : sc >= 50 ? SD_ST.warn : SD_ST.krit;
		return "<li><span class=\"sd-feed-z\">" + sdVor(a.zeit) + "</span><span class=\"sd-feed-t\"><b>" + escapeHtml(a.firma || "?") + "</b> · " + escapeHtml(a.akteur || "") + " prüfte <b>" + escapeHtml(a.ziel || "") + "</b></span>" + (sc !== null ? "<span class=\"sd-score\"><i style=\"background:" + f + "\"></i>" + sc + "</span>" : "") + "</li>";
	}).join("") + "</ul>";
}
function sdUmsatzKpi(kunden) {
	const zahlend = kunden.filter(function(x) {
		return x.i.zahlend;
	});
	const summe = zahlend.reduce(function(a, x) {
		return a + x.i.umsatz;
	}, 0);
	const fehlt = kunden.filter(function(x) {
		return x.i.betragFehlt;
	}).length;
	if (!SD.infoDa) return {
		label: "Umsatz / Monat",
		wert: "–",
		unter: "SQL-Update nötig",
		info: "Summe der im Kunden-Fenster hinterlegten Monatsbeträge."
	};
	return {
		label: "Umsatz / Monat",
		wert: sdEuro(summe),
		unter: zahlend.length + " zahlende" + (zahlend.length === 1 ? "r Kunde" : " Kunden") + (fehlt ? " · <span class=\"sd-warn-t\">" + fehlt + " ohne Betrag</span>" : ""),
		info: "Summe der im Kunden-Fenster hinterlegten Monatsbeträge aktiver Kunden. Interne Konten und inaktive Kunden zählen nicht."
	};
}
function sdKundenTab(b) {
	const alle = sdKunden().map(function(f) {
		return {
			f,
			i: sdFirmaInfo(f)
		};
	});
	const filter = {
		alle: function() {
			return true;
		},
		zahlend: function(x) {
			return x.i.zahlend;
		},
		test: function(x) {
			return x.i.status === "test";
		},
		inaktiv: function(x) {
			return x.i.status === "inaktiv";
		},
		voll: function(x) {
			return !x.i.intern && x.i.quote >= 80;
		},
		ruhig: function(x) {
			return !x.i.intern && x.f.aktiv !== false && (x.i.tageRuhig === null || x.i.tageRuhig >= 14);
		},
		offen: function(x) {
			return x.i.betragFehlt;
		}
	};
	const namen = {
		alle: "Alle",
		zahlend: "Zahlend",
		test: "Testphase",
		inaktiv: "Inaktiv",
		voll: "Kontingent ≥ 80 %",
		ruhig: "14+ Tage ruhig",
		offen: "Betrag fehlt"
	};
	if (!filter[SD.filter]) SD.filter = "alle";
	const q = SD.suche.toLowerCase();
	let l = alle.filter(filter[SD.filter]).filter(function(x) {
		return !q || String(x.f.name || "").toLowerCase().indexOf(q) >= 0 || String(x.f.code || "").toLowerCase().indexOf(q) >= 0;
	});
	const k = SD.sort.k, ab = SD.sort.ab ? -1 : 1;
	const wert = {
		name: function(x) {
			return String(x.f.name || "").toLowerCase();
		},
		status: function(x) {
			return x.i.status;
		},
		umsatz: function(x) {
			return x.i.umsatz;
		},
		mitglieder: function(x) {
			return Number(x.f.mitglieder) || 0;
		},
		monat: function(x) {
			return x.i.lim && !x.i.intern ? x.i.quote : -1;
		},
		gesamt: function(x) {
			return Number(x.f.analysen_gesamt) || 0;
		},
		zuletzt: function(x) {
			return x.f.letzte_analyse ? new Date(x.f.letzte_analyse).getTime() : 0;
		}
	};
	l.sort(function(a, c) {
		const va = wert[k](a), vc = wert[k](c);
		return va < vc ? -ab : va > vc ? ab : 0;
	});
	const th = function(key, txt, r) {
		const an = SD.sort.k === key;
		return "<th class=\"" + (r ? "r " : "") + "sd-sort" + (an ? " an" : "") + "\" aria-sort=\"" + (an ? SD.sort.ab ? "descending" : "ascending" : "none") + "\"><button type=\"button\" data-act-click=\"h110\" data-a0=\"" + escapeAttr(key) + "\">" + txt + (an ? SD.sort.ab ? " ↓" : " ↑" : "") + "</button></th>";
	};
	b.innerHTML = "<div class=\"sd-kpis sd-kpis-4\">" + sdKpi({
		label: "Kunden",
		wert: sdZ(alle.filter(function(x) {
			return !x.i.intern;
		}).length),
		unter: alle.filter(function(x) {
			return x.i.intern;
		}).length ? alle.filter(function(x) {
			return x.i.intern;
		}).length + " intern" : ""
	}) + sdKpi({
		label: "Zahlend",
		wert: sdZ(alle.filter(filter.zahlend).length),
		unter: "Testphase: " + alle.filter(filter.test).length
	}) + sdKpi(sdUmsatzKpi(alle)) + sdKpi({
		label: "Prüfungen diesen Monat",
		wert: sdZ(alle.reduce(function(s, x) {
			return s + (Number(x.f.analysen_monat) || 0);
		}, 0)),
		unter: sdZ(alle.reduce(function(s, x) {
			return s + (Number(x.f.analysen_gesamt) || 0);
		}, 0)) + " gesamt"
	}) + "</div>" + "<section class=\"sd-karte sd-s12\"><div class=\"sd-werkzeug\">" + "<div class=\"sd-chips\" role=\"group\" aria-label=\"Filter\">" + Object.keys(filter).map(function(id) {
		const c = alle.filter(filter[id]).length;
		return "<button type=\"button\" class=\"sd-chip" + (SD.filter === id ? " an" : "") + "\" aria-pressed=\"" + (SD.filter === id) + "\" data-act-click=\"h111\" data-a0=\"" + escapeAttr(id) + "\">" + namen[id] + "<em>" + c + "</em></button>";
	}).join("") + "</div>" + "<div class=\"sd-suchfeld\">" + sdIco("<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m21 21-4.3-4.3\"/>", 15) + "<input id=\"sdKSuche\" type=\"search\" placeholder=\"Kunde oder Code suchen …\" value=\"" + escapeHtml(SD.suche) + "\" data-act-input=\"h112\" autocomplete=\"off\" /></div>" + "</div>" + "<div class=\"sd-tab-scroll\"><table class=\"sd-tab sd-tab-klick\"><thead><tr>" + th("status", "Status") + th("name", "Kunde") + "<th>Paket</th>" + th("umsatz", "Umsatz", true) + th("mitglieder", "Nutzer", true) + th("monat", "Kontingent diesen Monat") + th("gesamt", "Gesamt", true) + th("zuletzt", "Zuletzt aktiv") + "</tr></thead><tbody id=\"sdKBody\">" + sdKundenZeilen(l) + "</tbody></table></div></section>";
}
function sdKundenNeu() {
	const pos = (document.getElementById("sdKSuche") || {}).selectionStart;
	sdRender();
	const i = document.getElementById("sdKSuche");
	if (i) {
		i.focus();
		try {
			i.setSelectionRange(pos, pos);
		} catch (e) {}
	}
}
function sdSortieren(k) {
	if (SD.sort.k === k) SD.sort.ab = !SD.sort.ab;
	else {
		SD.sort.k = k;
		SD.sort.ab = k !== "name";
	}
	sdRender();
}
function sdStatusPill(st) {
	return "<span class=\"sd-pill sd-pill-" + st + "\"><i></i>" + SD_STATUS_TXT[st] + "</span>";
}
function sdKundenZeilen(l) {
	if (!l.length) return "<tr><td colspan=\"8\" class=\"sd-leer\">Keine Kunden für diesen Filter.</td></tr>";
	return l.map(function(x) {
		const f = x.f, i = x.i, q = i.quote, farbe = q >= 90 ? SD_ST.krit : q >= 70 ? SD_ST.warn : SD_SERIE.tool;
		return "<tr tabindex=\"0\" data-act-click=\"h109\" data-a0=\"" + escapeAttr(f.firma_id) + "\" data-act-keydown=\"h113\" data-a0=\"" + escapeAttr(f.firma_id) + "\">" + "<td>" + sdStatusPill(i.status) + "</td>" + "<td class=\"sd-td-name\" title=\"" + escapeHtml(f.name || "") + "\"><b>" + escapeHtml(f.name || "") + "</b>" + (f.typ === "einzel" ? " <span class=\"sd-tag\">Einzel</span>" : "") + "</td>" + "<td class=\"sd-grau\">" + escapeHtml(i.paket) + "</td>" + "<td class=\"r\">" + (i.umsatz ? sdEuro(i.umsatz) : i.betragFehlt ? "<span class=\"sd-warn-t\">fehlt</span>" : "<span class=\"sd-grau\">" + (i.betrag === 0 && !i.intern ? "0 €" : "–") + "</span>") + "</td>" + "<td class=\"r\">" + sdZ(f.mitglieder) + "</td>" + "<td>" + (i.intern || !i.lim ? "<span class=\"sd-grau\">" + sdZ(f.analysen_monat) + " Prüfungen</span>" : "<div class=\"sd-mini-meter\"><div class=\"sd-b-bahn sd-meter\"><i style=\"width:" + Math.min(100, Math.max(q ? 2 : 0, q)) + "%;background:" + farbe + "\"></i></div><span><b>" + q + " %</b> " + sdZ(f.analysen_monat) + "/" + sdZ(i.lim) + "</span></div>") + "</td>" + "<td class=\"r\">" + sdZ(f.analysen_gesamt) + "</td>" + "<td class=\"" + (i.tageRuhig !== null && i.tageRuhig >= 14 && !i.intern ? "sd-warn-t" : "sd-grau") + "\">" + sdVor(f.letzte_analyse) + "</td>" + "</tr>";
	}).join("");
}
async function sdFirmaOeffnen(id, still) {
	const f = (SD.firmen || []).find(function(x) {
		return x.firma_id === id;
	});
	const dr = document.getElementById("sdDrawer"), hg = document.getElementById("sdDrawerHg");
	if (!f || !dr) return;
	SD.drawer = id;
	const i = sdFirmaInfo(f);
	const kopf = "<div class=\"sd-dr-kopf\"><div><div class=\"sd-k-u\">" + sdStatusPill(i.status) + "</div><h2>" + escapeHtml(f.name || "") + "</h2>" + "<div class=\"sd-k-u\">Code <b class=\"sd-mono\">" + escapeHtml(f.code || "–") + "</b> · " + (f.typ === "einzel" ? "Einzelperson" : "Unternehmen") + "</div></div>" + "<button type=\"button\" class=\"sd-btn sd-ico-btn\" data-act-click=\"h103\" aria-label=\"Schließen\">" + sdIco("<path d=\"M18 6 6 18M6 6l12 12\"/>", 16) + "</button></div>";
	const zahlen = "<div class=\"sd-dr-zahlen\">" + "<div><span>Diesen Monat</span><b>" + sdZ(f.analysen_monat) + "</b><small>" + (i.intern || !i.lim ? "unbegrenzt" : i.quote + " % von " + sdZ(i.lim)) + "</small></div>" + "<div><span>Gesamt</span><b>" + sdZ(f.analysen_gesamt) + "</b><small>Prüfungen</small></div>" + "<div><span>Nutzer</span><b>" + sdZ(f.mitglieder) + "</b><small>im Team</small></div>" + "<div><span>Umsatz / Monat</span><b>" + (i.umsatz ? sdEuro(i.umsatz) : i.intern ? "intern" : i.betragFehlt ? "fehlt" : i.betrag === 0 ? "0 €" : "–") + "</b><small>" + escapeHtml(i.paket) + "</small></div>" + "</div>" + "<div class=\"sd-k-u sd-dr-zuletzt\">Zuletzt aktiv: <b>" + (f.letzte_analyse ? new Date(f.letzte_analyse).toLocaleString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit"
	}) + " Uhr" : "nie") + "</b></div>";
	const form = "<section class=\"sd-dr-block\"><h3>Einstellungen</h3><div class=\"sd-form\">" + "<label>Name<input id=\"supFName\" value=\"" + escapeHtml(f.name || "") + "\" /></label>" + "<label>Typ<select id=\"supFTyp\"><option value=\"firma\"" + (f.typ === "firma" ? " selected" : "") + ">Unternehmen</option><option value=\"einzel\"" + (f.typ === "einzel" ? " selected" : "") + ">Einzelperson</option></select></label>" + "<label>Prüfungen / Monat<input id=\"supFLimit\" type=\"number\" min=\"0\" value=\"" + (Number(f.monatslimit) || 0) + "\" /><small>Bronze 100 · Silber 300 · Gold 600 · Platinum 1000 · intern 999999</small></label>" + "<label>Umsatz / Monat in €<input id=\"sdFUmsatz\" type=\"text\" inputmode=\"decimal\" placeholder=\"z. B. 350\" value=\"" + (i.betrag === null ? "" : (Number.isInteger(i.betrag) ? String(i.betrag) : i.betrag.toFixed(2)).replace(".", ",")) + "\"" + (SD.infoDa ? "" : " disabled") + " /><small>" + (SD.infoDa ? "Was der Kunde tatsächlich zahlt. Leer = noch nicht eingetragen, 0 = zahlt nichts." : "Erst nach dem SQL-Update möglich.") + "</small></label>" + "<div class=\"sd-form-chk\"><label><input type=\"checkbox\" id=\"supFTrial\"" + (f.trial ? " checked" : "") + " /> Testphase</label><label><input type=\"checkbox\" id=\"supFAktiv\"" + (f.aktiv ? " checked" : "") + " /> Aktiv</label>" + "<label title=\"Eigene Konten und Test-Konten: zählen nicht im Umsatz und werden mit „Interne ausblenden“ aus allen Zahlen herausgerechnet\"><input type=\"checkbox\" id=\"sdFIntern\"" + ((SD.info[id] || {}).intern ? " checked" : "") + (SD.infoDa ? "" : " disabled") + " /> Internes Konto / Test</label></div>" + "</div><div class=\"sd-dr-aktionen\"><button type=\"button\" class=\"sd-btn prim\" data-act-click=\"h114\" data-a0=\"" + escapeAttr(id) + "\">Speichern</button>" + "<button type=\"button\" class=\"sd-btn\" data-act-click=\"h115\" data-a0=\"" + escapeAttr(id) + "\">Als Support beitreten</button></div>" + "<div id=\"supFMsg\" class=\"sd-meldung\" style=\"display:none\"></div></section>";
	dr.innerHTML = kopf + "<div class=\"sd-dr-inhalt\">" + zahlen + form + "<section class=\"sd-dr-block\"><h3>Nutzer</h3><div id=\"sdDrM\"><div class=\"sd-leer\"><span class=\"neu-spin\"></span> Wird geladen …</div></div></section></div>";
	dr.setAttribute("aria-hidden", "false");
	dr.classList.add("an");
	if (hg) hg.classList.add("an");
	if (!still) setTimeout(function() {
		const x = dr.querySelector(".sd-ico-btn");
		if (x) x.focus();
	}, 60);
	try {
		const { data, error } = await sb.rpc("sup_mitglieder", { p_firma: id });
		if (SD.drawer !== id) return;
		const m = data || [], z = document.getElementById("sdDrM");
		if (z) z.innerHTML = error ? "<div class=\"sd-leer\">" + escapeHtml(error.message || "Fehler") + "</div>" : m.length ? m.map(sdNutzerZeile).join("") : sdLeer("Keine Mitglieder.");
	} catch (e) {
		const z = document.getElementById("sdDrM");
		if (z) z.innerHTML = sdLeer(escapeHtml(e && e.message || "Fehler"));
	}
}
function sdDrawerZu() {
	SD.drawer = null;
	const dr = document.getElementById("sdDrawer"), hg = document.getElementById("sdDrawerHg");
	if (dr) {
		dr.classList.remove("an");
		dr.setAttribute("aria-hidden", "true");
	}
	if (hg) hg.classList.remove("an");
}
async function sdFirmaSpeichern(id, knopf) {
	if (knopf) {
		knopf.disabled = true;
		knopf.textContent = "Speichert …";
	}
	const fu = document.getElementById("sdFUmsatz"), fi = document.getElementById("sdFIntern");
	const roh = fu && !fu.disabled ? String(fu.value || "").trim().replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".") : null;
	const betrag = roh === null || roh === "" ? null : Number(roh);
	const intern = !!(fi && fi.checked);
	if (roh && (isNaN(betrag) || betrag < 0 || betrag > 1e6)) {
		supMsg("Bitte einen gültigen Betrag in Euro eintragen (z. B. 350 oder 299,99).", "error");
		if (knopf) {
			knopf.disabled = false;
			knopf.textContent = "Speichern";
		}
		return;
	}
	await supFirmaSpeichern(id);
	const msg = document.getElementById("supFMsg");
	let meldung = msg ? {
		t: msg.textContent,
		c: msg.className
	} : null;
	const alt = SD.info[id] || {};
	const altBetrag = alt.umsatz_monat === null || alt.umsatz_monat === undefined ? null : Number(alt.umsatz_monat);
	if (fu && !fu.disabled && (betrag !== altBetrag || intern !== (alt.intern === true))) {
		try {
			const r = await sb.rpc("sup_kunde_info_setzen", {
				p_firma: id,
				p_umsatz: betrag,
				p_intern: intern
			});
			if (r.error || !(r.data && r.data.ok)) meldung = {
				t: "Betrag nicht gespeichert: " + (r.error && r.error.message || r.data && r.data.grund || "Fehler"),
				c: "auth-msg error"
			};
		} catch (e) {
			meldung = {
				t: "Betrag nicht gespeichert: " + (e && e.message || "Fehler"),
				c: "auth-msg error"
			};
		}
	}
	if (knopf) {
		knopf.disabled = false;
		knopf.textContent = "Speichern";
	}
	await sdLaden(true);
	if (SD.drawer === id) {
		await sdFirmaOeffnen(id, true);
		const m2 = document.getElementById("supFMsg");
		if (m2 && meldung) {
			m2.textContent = meldung.t;
			m2.className = meldung.c + " sd-meldung";
			m2.style.display = "";
		}
	}
}
function sdNutzerZeile(u) {
	const name = ((u.vorname || "") + " " + (u.nachname || "")).trim();
	const mail = u.email || "";
	const rang = u.rang || "";
	const info = rang ? RANG_INFO[rang] || RANG_INFO.member : null;
	const login = u.letzter_login !== undefined ? u.letzter_login : null;
	return "<div class=\"sd-nutzer\">" + "<div class=\"sd-avatar\" aria-hidden=\"true\">" + escapeHtml((name || mail || "?").charAt(0).toUpperCase()) + "</div>" + "<div class=\"sd-n-haupt\"><div class=\"sd-n-name\">" + escapeHtml(name || mail) + (u.bestaetigt === false ? " <span class=\"sd-tag sd-tag-warn\">unbestätigt</span>" : "") + "</div>" + "<div class=\"sd-n-meta\">" + (name ? escapeHtml(mail) + " · " : "") + escapeHtml(u.firma_name || u.firma || "") + (u.firma_name || u.firma ? " · " : "") + (u.erstellt ? "registriert " + sdVor(u.erstellt) + " · " : "") + "Login " + sdVor(login) + "</div></div>" + (info ? "<span class=\"sd-rang\">" + escapeHtml(info.name) + "</span>" : "") + "<div class=\"sd-n-btns\">" + (rang && rang !== "support" ? "<select class=\"sd-select\" aria-label=\"Rang ändern\" data-act-change=\"h116\" data-a0=\"" + escapeAttr(u.user_id) + "\"><option value=\"\">Rang …</option><option value=\"president\">President</option><option value=\"vice\">Vice</option><option value=\"senior\">Senior</option><option value=\"member\">Member</option></select>" : "") + (mail ? "<button type=\"button\" class=\"sd-btn sd-klein\" data-act-click=\"h117\" data-a0=\"" + escapeAttr(u.user_id) + "\" data-mail=\"" + escapeHtml(mail) + "\">Passwort</button>" : "") + (u.bestaetigt === false ? "<button type=\"button\" class=\"sd-btn sd-klein prim\" data-act-click=\"h118\" data-a0=\"" + escapeAttr(u.user_id) + "\">Bestätigen</button>" : "") + "</div></div>";
}
function sdNutzerTab(b) {
	const n = SD.d && SD.d.nutzer || null;
	b.innerHTML = (n ? "<div class=\"sd-kpis sd-kpis-4\">" + sdKpi({
		label: "Nutzer gesamt",
		wert: sdZ(n.gesamt),
		unter: sdZ(n.neu_zeitraum) + " neu in " + SD.tage + " Tagen",
		delta: sdDelta(n.neu_zeitraum, n.neu_vorher, true)
	}) + sdKpi({
		label: "Aktiv · 7 Tage",
		wert: sdZ(n.aktiv_7),
		unter: n.gesamt ? Math.round(n.aktiv_7 / n.gesamt * 100) + " % aller Nutzer" : ""
	}) + sdKpi({
		label: "Aktiv · 30 Tage",
		wert: sdZ(n.aktiv_30),
		unter: n.gesamt ? Math.round(n.aktiv_30 / n.gesamt * 100) + " % aller Nutzer" : ""
	}) + sdKpi({
		label: "Unbestätigt",
		wert: sdZ(n.unbestaetigt),
		unter: n.unbestaetigt ? "E-Mail nicht bestätigt" : "alle bestätigt"
	}) + "</div>" : "") + "<div class=\"sd-grid\">" + sdKarte("Nutzer suchen", "E-Mail, Name oder Firma – ändert Rang, Passwort, Freischaltung", "<div class=\"sd-suchfeld sd-suchfeld-gross\">" + sdIco("<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m21 21-4.3-4.3\"/>", 16) + "<input id=\"supSuche\" type=\"search\" placeholder=\"Mindestens 2 Zeichen …\" data-act-input=\"h119\" autocomplete=\"off\" /></div><div id=\"supSucheErg\"></div>", "sd-s12") + (n ? sdKarte("Unbestätigt", "Neueste zuerst", (n.unbestaetigt_liste || []).length ? n.unbestaetigt_liste.map(function(u) {
		return sdNutzerZeile({
			user_id: u.user_id,
			email: u.email,
			firma: u.firma,
			erstellt: u.erstellt,
			bestaetigt: false,
			letzter_login: null
		});
	}).join("") : sdLeer("Keine unbestätigten Nutzer."), "sd-s6") + sdKarte("Neueste Registrierungen", "Alle Kunden", (n.neueste || []).length ? n.neueste.map(function(u) {
		return sdNutzerZeile({
			user_id: u.user_id,
			email: u.email,
			firma: u.firma,
			erstellt: u.erstellt,
			bestaetigt: u.bestaetigt,
			letzter_login: u.letzter_login
		});
	}).join("") : sdLeer("Keine Daten."), "sd-s6") : "") + "</div>";
	setTimeout(function() {
		const s = document.getElementById("supSuche");
		if (s) s.focus();
	}, 80);
}
var _supSucheTimer = null;
function supSucheLauf() {
	clearTimeout(_supSucheTimer);
	_supSucheTimer = setTimeout(async function() {
		const q = ((document.getElementById("supSuche") || {}).value || "").trim();
		const erg = document.getElementById("supSucheErg");
		if (!erg) return;
		if (q.length < 2) {
			erg.innerHTML = "";
			return;
		}
		erg.innerHTML = "<div class=\"sd-leer\"><span class=\"neu-spin\"></span> Sucht …</div>";
		const { data, error } = await sb.rpc("sup_nutzer_suchen", { p_suche: q });
		if (((document.getElementById("supSuche") || {}).value || "").trim() !== q) return;
		const l = data || [];
		erg.innerHTML = error ? sdLeer(escapeHtml(error.message || "Fehler")) : l.length ? l.map(sdNutzerZeile).join("") : sdLeer("Nichts gefunden.");
	}, 250);
}
function sdAktTab(b) {
	const q = SD.aktSuche.toLowerCase();
	const l = (SD.akt || []).filter(function(a) {
		return !q || [
			a.firma,
			a.akteur,
			a.ziel
		].join(" ").toLowerCase().indexOf(q) >= 0;
	});
	const gruppen = [];
	l.forEach(function(a) {
		const tag = new Date(a.zeit).toLocaleDateString("de-DE", {
			weekday: "long",
			day: "2-digit",
			month: "long"
		});
		const g = gruppen[gruppen.length - 1];
		if (!g || g.tag !== tag) gruppen.push({
			tag,
			l: [a]
		});
		else g.l.push(a);
	});
	b.innerHTML = "<section class=\"sd-karte sd-s12\"><div class=\"sd-werkzeug\"><div class=\"sd-k-u\">Die letzten " + (SD.akt || []).length + " Prüfungen über alle Kunden</div>" + "<div class=\"sd-suchfeld\">" + sdIco("<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m21 21-4.3-4.3\"/>", 15) + "<input id=\"sdASuche\" type=\"search\" placeholder=\"Kunde, Person oder Firma filtern …\" value=\"" + escapeHtml(SD.aktSuche) + "\" data-act-input=\"h120\" autocomplete=\"off\" /></div></div>" + (gruppen.length ? gruppen.map(function(g) {
		return "<h3 class=\"sd-tag-kopf\">" + escapeHtml(g.tag) + "</h3>" + sdFeedHTML(g.l);
	}).join("") : sdLeer("Keine Einträge.")) + "</section>";
	b.querySelectorAll(".sd-feed li").forEach(function(li, i) {
		const a = l[i];
		const z = li.querySelector(".sd-feed-z");
		if (a && z) z.textContent = new Date(a.zeit).toLocaleTimeString("de-DE", {
			hour: "2-digit",
			minute: "2-digit"
		});
	});
}
function sdAktNeu() {
	const i0 = document.getElementById("sdASuche"), pos = i0 ? i0.selectionStart : 0;
	sdRender();
	const i = document.getElementById("sdASuche");
	if (i) {
		i.focus();
		try {
			i.setSelectionRange(pos, pos);
		} catch (e) {}
	}
}
function sdApiTab(b) {
	const api = SD.d && SD.d.api;
	if (!api) {
		b.innerHTML = sdKarte("REST-API", "", sdLeer(SD.d === false ? "Datenbank-Funktion für das Dashboard fehlt." : "Keine API-Daten gefunden (API-Tabellen fehlen oder noch nicht genutzt)."), "sd-s12");
		return;
	}
	const p = api.pruefungen || {};
	const fq = api.aufrufe_zeitraum ? Math.round((api.fehler_zeitraum || 0) / api.aufrufe_zeitraum * 1e3) / 10 : 0;
	b.innerHTML = "<div class=\"sd-kpis sd-kpis-4\">" + sdKpi({
		label: "Aufrufe · " + SD.tage + " Tage",
		wert: sdZ(api.aufrufe_zeitraum),
		unter: sdZ(api.schluessel_aktiv) + " aktive Schlüssel",
		spark: "sdSpA"
	}) + sdKpi({
		label: "Fehlerquote",
		wert: fq.toLocaleString("de-DE"),
		einheit: " %",
		unter: sdZ(api.fehler_zeitraum) + " Aufrufe mit Status ≥ 400"
	}) + sdKpi({
		label: "Prüfungen fertig",
		wert: sdZ(p.done),
		unter: sdZ(p.running) + " laufen gerade"
	}) + sdKpi({
		label: "Mehrdeutig / Fehler",
		wert: sdZ((p.ambiguous || 0) + (p.error || 0)),
		unter: sdZ(p.ambiguous) + " × 409 · " + sdZ(p.error) + " × abgebrochen"
	}) + "</div><div class=\"sd-grid\">" + sdKarte("API-Aufrufe pro Tag", "nach Ergebnis", "<div class=\"sd-legende\"><span><i class=\"sd-leg-sw\" style=\"background:" + SD_ST.gut + "\"></i>Erfolgreich</span><span><i class=\"sd-leg-sw\" style=\"background:" + SD_ST.warn + "\"></i>Fehler des Aufrufers (4xx)</span><span><i class=\"sd-leg-sw\" style=\"background:" + SD_ST.krit + "\"></i>Serverfehler (5xx)</span></div><div class=\"sd-chart\" id=\"sdCA\"></div>", "sd-s12") + sdKarte("Letzte Fehler", "Status ≥ 400, neueste zuerst", (api.letzte_fehler || []).length ? "<div class=\"sd-tab-scroll\"><table class=\"sd-tab\"><thead><tr><th>Zeit</th><th>Status</th><th>Endpunkt</th><th>Schlüssel</th><th>Kunde</th><th>Prüf-ID</th></tr></thead><tbody>" + api.letzte_fehler.map(function(e) {
		const s = Number(e.status) || 0;
		return "<tr><td class=\"sd-grau\">" + new Date(e.zeit).toLocaleString("de-DE", {
			day: "2-digit",
			month: "2-digit",
			hour: "2-digit",
			minute: "2-digit"
		}) + "</td><td><span class=\"sd-code sd-code-" + (s >= 500 ? "krit" : "warn") + "\">" + s + "</span></td><td class=\"sd-mono\">" + escapeHtml(e.endpunkt || "") + "</td><td>" + escapeHtml(e.schluessel || "–") + "</td><td>" + escapeHtml(e.firma || "–") + "</td><td class=\"sd-mono sd-grau\">" + escapeHtml(e.pruef_id || "–") + "</td></tr>";
	}).join("") + "</tbody></table></div>" : sdLeer("Keine Fehler – sehr gut."), "sd-s12") + "</div>";
	SD.zeichner.push(function() {
		sdSpark(document.getElementById("sdSpA"), (api.tage || []).map(function(t) {
			return (t.ok || 0) + (t.client || 0) + (t.server || 0);
		}));
	});
	SD.zeichner.push(function() {
		sdSaeulen(document.getElementById("sdCA"), {
			rows: api.tage || [],
			serien: [
				{
					k: "ok",
					n: "Erfolgreich",
					f: SD_ST.gut
				},
				{
					k: "client",
					n: "4xx",
					f: SD_ST.warn
				},
				{
					k: "server",
					n: "5xx",
					f: SD_ST.krit
				}
			],
			hoehe: 220,
			titel: "API-Aufrufe pro Tag"
		});
	});
}
function sdSystemTab(b) {
	const s = SD.status || {}, d = SD.d || {};
	const sank = (s.sanktionen || [])[0] || {};
	const alt = sank.stand ? Math.floor((Date.now() - new Date(sank.stand).getTime()) / 864e5) : null;
	const sankSt = sank.meldung || alt === null ? "krit" : alt > 8 ? "krit" : alt > 2 ? "warn" : "gut";
	const zeile = function(l, w, st) {
		return "<div class=\"sd-sys-z\"><span>" + l + "</span><b>" + (st ? "<i class=\"sd-punkt\" style=\"background:" + SD_ST[st] + "\"></i>" : "") + w + "</b></div>";
	};
	const fehler = Array.isArray(d.fehler) ? d.fehler : [];
	b.innerHTML = "<div class=\"sd-grid\">" + sdKarte("EU-Sanktionsliste", "Grundlage jedes Abgleichs", zeile("Status", sankSt === "gut" ? "Aktuell" : sankSt === "warn" ? "Etwas veraltet" : "Prüfen", sankSt) + zeile("Einträge", sdZ(sank.eintraege)) + zeile("Stand", sank.stand ? new Date(sank.stand).toLocaleString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit"
	}) + " Uhr" : "–") + zeile("Alter", alt === null ? "–" : alt + " Tag" + (alt === 1 ? "" : "e")) + (sank.meldung ? "<div class=\"sd-banner sd-banner-krit\">" + escapeHtml(sank.meldung) + "</div>" : ""), "sd-s6") + sdKarte("Laufende Überwachung", "Automatische Nachprüfung alle 3 Monate", zeile("Überwachte Firmen", sdZ(s.favoriten)) + zeile("Fällig", sdZ(s.faellige_favoriten), Number(s.faellige_favoriten) > 0 ? "warn" : "gut"), "sd-s6") + sdKarte("Datenbestand", "Alle Kunden", zeile("Prüfungen gesamt", sdZ(s.analysen_gesamt)) + zeile("Prüfungen diesen Monat", sdZ(s.analysen_monat)) + zeile("Dokumente abgelegt", sdZ(s.kyc_dokumente)) + zeile("Offene Team-Einladungen", sdZ(s.offene_einladungen)), "sd-s6") + sdKarte("Dashboard", "Technik", zeile("App-Version", escapeHtml(typeof APP_VERSION !== "undefined" ? APP_VERSION : "–")) + zeile("Datenbank-Funktion sup_dashboard", SD.d === false ? "fehlt" : "aktiv", SD.d === false ? "krit" : "gut") + zeile("Interne Konten", (d.intern_firmen != null ? sdZ(d.intern_firmen) : "–") + (SD.ohneIntern ? " (ausgeblendet)" : " (eingerechnet)")) + zeile("Daten erzeugt", d.erzeugt_am ? new Date(d.erzeugt_am).toLocaleTimeString("de-DE", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit"
	}) + " Uhr" : "–") + (fehler.length ? "<div class=\"sd-banner\">Teilbereiche ohne Daten: " + fehler.map(function(x) {
		return escapeHtml(String(x));
	}).join(" · ") + "</div>" : ""), "sd-s6") + "</div>";
}
function sdScoreVerteilung(v) {
	if (!Array.isArray(v) || v.length !== 4) return "";
	const summe = v.reduce(function(a, x) {
		return a + (Number(x) || 0);
	}, 0);
	if (!summe) return "";
	const stufen = [
		["75–100", v[3]],
		["50–74", v[2]],
		["25–49", v[1]],
		["0–24", v[0]]
	];
	return "<div class=\"sd-unterteil\"><div class=\"sd-unter-t\">Score-Verteilung</div>" + sdBalkenHTML(stufen.map(function(x) {
		return {
			l: "Score " + x[0],
			w: x[1]
		};
	}), SD_SERIE.tool) + "</div>";
}
function sdHeatKennzahlen(zellen) {
	let summe = 0, kern = 0, wochenende = 0, spitze = null;
	(zellen || []).forEach(function(z) {
		const n = Number(z.n) || 0;
		summe += n;
		if (z.w <= 5 && z.h >= 8 && z.h < 18) kern += n;
		if (z.w >= 6) wochenende += n;
		if (!spitze || n > spitze.n) spitze = {
			w: z.w,
			h: z.h,
			n
		};
	});
	if (!summe || !spitze) return "";
	const tg = [
		"Montag",
		"Dienstag",
		"Mittwoch",
		"Donnerstag",
		"Freitag",
		"Samstag",
		"Sonntag"
	][spitze.w - 1];
	return "<div class=\"sd-mini-zahlen\">" + "<div><span>Spitzenzeit</span><b>" + tg + ", " + spitze.h + "–" + (spitze.h + 1) + " Uhr</b></div>" + "<div><span>Werktags 8–18 Uhr</span><b>" + Math.round(kern / summe * 100) + " %</b></div>" + "<div><span>Wochenende</span><b>" + Math.round(wochenende / summe * 100) + " %</b></div>" + "</div>";
}
function sdTipZeigen(x, y, titel, zeilen) {
	const t = document.getElementById("sdTip");
	if (!t) return;
	t.textContent = "";
	const k = document.createElement("div");
	k.className = "sd-tip-t";
	k.textContent = titel;
	t.appendChild(k);
	zeilen.forEach(function(z) {
		const r = document.createElement("div");
		r.className = "sd-tip-z" + (z.summe ? " sd-tip-summe" : "");
		if (z.f) {
			const s = document.createElement("i");
			s.className = "sd-tip-key";
			s.style.background = z.f;
			r.appendChild(s);
		}
		const w = document.createElement("b");
		w.textContent = z.w;
		r.appendChild(w);
		const n = document.createElement("span");
		n.textContent = z.n;
		r.appendChild(n);
		t.appendChild(r);
	});
	t.classList.add("an");
	const bw = t.offsetWidth, bh = t.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
	let lx = x + 14, ly = y - bh - 12;
	if (lx + bw > vw - 8) lx = x - bw - 14;
	if (ly < 8) ly = y + 16;
	if (ly + bh > vh - 8) ly = vh - bh - 8;
	t.style.left = Math.max(8, lx) + "px";
	t.style.top = Math.max(8, ly) + "px";
}
function sdTipWeg() {
	const t = document.getElementById("sdTip");
	if (t) t.classList.remove("an");
}
function sdRundOben(x, y, w, h, r) {
	if (h <= 0 || w <= 0) return "";
	r = Math.max(0, Math.min(r, w / 2, h));
	return "M" + x + "," + (y + h) + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y + "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h) + "Z";
}
function sdSaeulen(el, o) {
	if (!el) return;
	const rows = o.rows || [], n = rows.length;
	const W = Math.max(260, Math.floor(el.clientWidth || 600)), H = o.hoehe || 220;
	const m = {
		l: 36,
		r: 6,
		t: 10,
		b: 24
	}, pw = W - m.l - m.r, ph = H - m.t - m.b;
	const summen = rows.map(function(r) {
		return o.serien.reduce(function(s, se) {
			return s + (Number(r[se.k]) || 0);
		}, 0);
	});
	const ticks = sdTicks(Math.max(1, Math.max.apply(null, summen.concat([1]))), 4), oben = ticks[ticks.length - 1];
	const slot = pw / Math.max(1, n), bw = Math.max(2, Math.min(24, slot * .66));
	const yv = function(v) {
		return m.t + ph - v / oben * ph;
	};
	let s = "";
	ticks.forEach(function(t) {
		const y = Math.round(yv(t)) + .5;
		s += "<line class=\"sd-gl\" x1=\"" + m.l + "\" x2=\"" + (W - m.r) + "\" y1=\"" + y + "\" y2=\"" + y + "\"/><text class=\"sd-ax\" x=\"" + (m.l - 7) + "\" y=\"" + (y + 3.5) + "\" text-anchor=\"end\">" + sdKurz(t) + "</text>";
	});
	rows.forEach(function(r, i) {
		const x = m.l + i * slot + (slot - bw) / 2;
		s += "<rect class=\"sd-band\" data-i=\"" + i + "\" x=\"" + (m.l + i * slot) + "\" y=\"" + m.t + "\" width=\"" + slot + "\" height=\"" + ph + "\"/>";
		let basis = m.t + ph;
		const segs = o.serien.map(function(se) {
			return {
				se,
				v: Number(r[se.k]) || 0
			};
		}).filter(function(z) {
			return z.v > 0;
		});
		segs.forEach(function(z, j) {
			const h = z.v / oben * ph, y = basis - h, hoch = h - (j > 0 ? 2 : 0);
			if (hoch > .4) s += j === segs.length - 1 ? "<path fill=\"" + z.se.f + "\" d=\"" + sdRundOben(x, y, bw, hoch, 4) + "\"/>" : "<rect fill=\"" + z.se.f + "\" x=\"" + x + "\" y=\"" + y + "\" width=\"" + bw + "\" height=\"" + hoch + "\"/>";
			basis = y;
		});
	});
	s += "<line class=\"sd-basis\" x1=\"" + m.l + "\" x2=\"" + (W - m.r) + "\" y1=\"" + (m.t + ph + .5) + "\" y2=\"" + (m.t + ph + .5) + "\"/>";
	const jede = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 64))));
	rows.forEach(function(r, i) {
		if (i % jede === 0 || i === n - 1) {
			if (i === n - 1 && i % jede !== 0 && (n - 1) % jede < jede * .6) return;
			s += "<text class=\"sd-ax\" x=\"" + (m.l + i * slot + slot / 2) + "\" y=\"" + (H - 6) + "\" text-anchor=\"middle\">" + sdTag(r.d) + "</text>";
		}
	});
	rows.forEach(function(r, i) {
		s += "<rect class=\"sd-hit\" tabindex=\"0\" data-i=\"" + i + "\" x=\"" + (m.l + i * slot) + "\" y=\"" + m.t + "\" width=\"" + slot + "\" height=\"" + ph + "\" aria-label=\"" + sdTag(r.d, true) + ": " + summen[i] + "\"/>";
	});
	el.innerHTML = "<svg viewBox=\"0 0 " + W + " " + H + "\" width=\"100%\" height=\"" + H + "\" role=\"img\" aria-label=\"" + escapeHtml(o.titel || "Diagramm") + "\">" + s + "</svg>";
	const zeigen = function(ev, i) {
		el.querySelectorAll(".sd-band").forEach(function(bd) {
			bd.classList.toggle("an", bd.getAttribute("data-i") === String(i));
		});
		const r = rows[i], box = ev.target.getBoundingClientRect();
		const px = ev.clientX || box.left + box.width / 2, py = ev.clientY || box.top + 30;
		const z = o.serien.slice().reverse().map(function(se) {
			return {
				f: se.f,
				w: sdZ(r[se.k]),
				n: se.n
			};
		});
		if (o.serien.length > 1) z.push({
			w: sdZ(summen[i]),
			n: "Summe",
			summe: true
		});
		sdTipZeigen(px, py, sdTag(r.d, true), z);
	};
	el.querySelectorAll(".sd-hit").forEach(function(h) {
		const i = Number(h.getAttribute("data-i"));
		h.addEventListener("pointermove", function(ev) {
			zeigen(ev, i);
		});
		h.addEventListener("focus", function(ev) {
			zeigen(ev, i);
		});
		const weg = function() {
			el.querySelectorAll(".sd-band").forEach(function(bd) {
				bd.classList.remove("an");
			});
			sdTipWeg();
		};
		h.addEventListener("pointerleave", weg);
		h.addEventListener("blur", weg);
	});
}
function sdSpark(el, werte) {
	if (!el || !werte || werte.length < 2) return;
	const W = Math.max(80, Math.floor(el.clientWidth || 160)), H = 30, max = Math.max(1, Math.max.apply(null, werte));
	const pkt = werte.map(function(v, i) {
		return [2 + i / (werte.length - 1) * (W - 6), 3 + (1 - (Number(v) || 0) / max) * (H - 7)];
	});
	const d = pkt.map(function(p, i) {
		return (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1);
	}).join("");
	const l = pkt[pkt.length - 1];
	el.innerHTML = "<svg viewBox=\"0 0 " + W + " " + H + "\" width=\"100%\" height=\"" + H + "\" aria-hidden=\"true\"><path d=\"" + d + "L" + l[0] + "," + (H - 1) + "L" + pkt[0][0] + "," + (H - 1) + "Z\" fill=\"rgba(57,135,229,.10)\"/>" + "<path d=\"" + d + "\" fill=\"none\" stroke=\"#5b6672\" stroke-width=\"1.5\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>" + "<circle cx=\"" + l[0] + "\" cy=\"" + l[1] + "\" r=\"3.5\" fill=\"#3987e5\" stroke=\"#14171c\" stroke-width=\"2\"/></svg>";
}
function sdHeatmap(el, zellen) {
	if (!el) return;
	const W = Math.max(300, Math.floor(el.clientWidth || 600));
	const m = {
		l: 26,
		t: 4,
		b: 20
	}, gap = 2, cw = (W - m.l) / 24, ch = Math.max(14, Math.min(24, cw * .9)), H = m.t + 7 * ch + m.b;
	const wert = {};
	let max = 0;
	zellen.forEach(function(z) {
		wert[z.w + "_" + z.h] = Number(z.n) || 0;
		max = Math.max(max, Number(z.n) || 0);
	});
	const tage = [
		"Mo",
		"Di",
		"Mi",
		"Do",
		"Fr",
		"Sa",
		"So"
	];
	let s = "";
	for (let w = 1; w <= 7; w++) {
		s += "<text class=\"sd-ax\" x=\"" + (m.l - 6) + "\" y=\"" + (m.t + (w - 1) * ch + ch / 2 + 3.5) + "\" text-anchor=\"end\">" + tage[w - 1] + "</text>";
		for (let h = 0; h < 24; h++) {
			const v = wert[w + "_" + h] || 0, stufe = v ? Math.min(SD_SEQ.length - 1, Math.floor(Math.sqrt(v / max) * (SD_SEQ.length - 1))) : -1;
			s += "<rect class=\"sd-zelle\" data-w=\"" + w + "\" data-h=\"" + h + "\" data-n=\"" + v + "\" x=\"" + (m.l + h * cw + gap / 2) + "\" y=\"" + (m.t + (w - 1) * ch + gap / 2) + "\" width=\"" + Math.max(1, cw - gap) + "\" height=\"" + (ch - gap) + "\" rx=\"2.5\" fill=\"" + (stufe < 0 ? "#1d2127" : SD_SEQ[stufe]) + "\"/>";
		}
	}
	[
		0,
		6,
		12,
		18,
		23
	].forEach(function(h) {
		s += "<text class=\"sd-ax\" x=\"" + (m.l + h * cw + cw / 2) + "\" y=\"" + (H - 5) + "\" text-anchor=\"middle\">" + h + " Uhr</text>";
	});
	el.innerHTML = "<svg viewBox=\"0 0 " + W + " " + H + "\" width=\"100%\" height=\"" + H + "\" role=\"img\" aria-label=\"Prüfungen nach Wochentag und Uhrzeit\">" + s + "</svg>" + "<div class=\"sd-skala\"><span>weniger</span>" + ["#1d2127"].concat(SD_SEQ.filter(function(x, i) {
		return i % 2 === 1;
	})).map(function(f) {
		return "<i style=\"background:" + f + "\"></i>";
	}).join("") + "<span>mehr</span></div>";
	el.querySelectorAll(".sd-zelle").forEach(function(c) {
		c.addEventListener("pointermove", function(ev) {
			const w = Number(c.getAttribute("data-w")), h = Number(c.getAttribute("data-h")), v = Number(c.getAttribute("data-n"));
			sdTipZeigen(ev.clientX, ev.clientY, [
				"Montag",
				"Dienstag",
				"Mittwoch",
				"Donnerstag",
				"Freitag",
				"Samstag",
				"Sonntag"
			][w - 1] + " · " + h + "–" + (h + 1) + " Uhr", [{
				w: sdZ(v),
				n: v === 1 ? "Prüfung" : "Prüfungen",
				f: "#3987e5"
			}]);
		});
		c.addEventListener("pointerleave", sdTipWeg);
	});
}
function supNutzerZeile(u) {
	const name = ((u.vorname || "") + " " + (u.nachname || "")).trim();
	const info = RANG_INFO[u.rang] || RANG_INFO.member;
	const mail = u.email || "";
	return "<div class=\"sup-nutzer\">" + "<div class=\"sup-n-haupt\"><div class=\"sup-n-name\">" + (name ? escapeHtml(name) + " <span class=\"sup-n-mail\">" + escapeHtml(mail) + "</span>" : escapeHtml(mail)) + (u.bestaetigt === false ? " <span class=\"sup-tag sup-tag-rot\">unbestätigt</span>" : "") + "</div>" + "<div class=\"sup-n-meta\">" + (u.firma_name ? escapeHtml(u.firma_name) + " · " : "") + "Login " + (u.letzter_login ? new Date(u.letzter_login).toLocaleDateString("de-DE") : "nie") + "</div></div>" + "<span class=\"tm-badge tm-" + info.farbe + "\"><span class=\"tm-badge-ico\">" + (RANG_SVG[u.rang] || RANG_SVG.member) + "</span>" + info.name + "</span>" + "<div class=\"sup-n-btns\">" + (u.rang !== "support" ? "<select class=\"tm-select sup-rang\" data-act-change=\"h116\" data-a0=\"" + escapeAttr(u.user_id) + "\"><option value=\"\">Rang…</option><option value=\"president\">President</option><option value=\"vice\">Vice</option><option value=\"senior\">Senior</option><option value=\"member\">Member</option></select>" : "") + "<button class=\"kyc-btn\" data-act-click=\"h117\" data-a0=\"" + escapeAttr(u.user_id) + "\" data-mail=\"" + escapeHtml(mail) + "\">Passwort</button>" + (u.bestaetigt === false ? "<button class=\"kyc-btn\" data-act-click=\"h118\" data-a0=\"" + escapeAttr(u.user_id) + "\">Bestätigen</button>" : "") + "</div></div>";
}
function supMsg(text, art) {
	const m = document.getElementById("supFMsg");
	if (!m) {
		zeigeToast(art === "ok" ? "Erledigt" : "Fehler", text);
		return;
	}
	m.textContent = text;
	m.className = "auth-msg " + (art === "ok" ? "ok" : "error");
	m.style.display = "";
}
async function supFirmaSpeichern(id) {
	const name = (document.getElementById("supFName") || {}).value;
	const typ = (document.getElementById("supFTyp") || {}).value;
	const limit = parseInt((document.getElementById("supFLimit") || {}).value, 10);
	const trial = !!(document.getElementById("supFTrial") || {}).checked;
	const aktiv = !!(document.getElementById("supFAktiv") || {}).checked;
	try {
		await sb.rpc("sup_firma_aendern", {
			p_firma: id,
			p_name: name,
			p_typ: typ
		});
		const { data } = await sb.rpc("sup_kontingent", {
			p_firma: id,
			p_limit: isNaN(limit) ? 3 : limit,
			p_trial: trial,
			p_aktiv: aktiv
		});
		supMsg(data && data.ok ? "Gespeichert." : "Fehler: " + (data && data.grund || ""), data && data.ok ? "ok" : "error");
		const r = await sb.rpc("sup_firmen");
		SUP_FIRMEN = r.data || SUP_FIRMEN;
	} catch (e) {
		supMsg("Fehler: " + (e && e.message || ""), "error");
	}
}
async function supBeitreten(id) {
	if (!await frageDialog({
		titel: "Als Support beitreten?",
		text: "Zurück geht es über „Einsatz beenden“ in der Team-Ansicht.",
		ok: "Beitreten"
	})) return;
	const { data } = await sb.rpc("sup_beitreten", { p_firma: id });
	if (data && data.ok) {
		zeigeToast("Beigetreten", "Seite wird neu geladen.");
		setTimeout(function() {
			location.reload();
		}, 1e3);
	} else alert("Fehler: " + (data && data.grund || ""));
}
async function supRang(userId, rang) {
	if (!rang) return;
	const { data } = await sb.rpc("sup_rang_setzen", {
		p_user: userId,
		p_rang: rang
	});
	zeigeToast(data && data.ok ? "Rang gesetzt" : "Fehler", data && data.ok ? "Der Nutzer ist jetzt " + rangName(rang) + "." : data && data.grund || "");
	if (data && data.ok) supLade();
}
async function supPasswort(userId, btn) {
	const email = btn && btn.getAttribute("data-mail") || "";
	const pw = prompt("Neues Passwort für " + email + " (mind. 8 Zeichen).\nLeer lassen, um eine Reset-Mail zu senden:");
	if (pw === null) return;
	if (btn) {
		btn.disabled = true;
		btn.textContent = "…";
	}
	try {
		const r = pw.trim() ? await workerCall("support_aktion", {
			was: "passwort",
			user_id: userId,
			passwort: pw.trim()
		}) : await workerCall("support_aktion", {
			was: "reset_mail",
			email
		});
		if (r && r.ok) zeigeToast(pw.trim() ? "Passwort gesetzt" : "Reset-Mail gesendet", pw.trim() ? "Bitte mündlich mitteilen." : "An " + email + ".");
		else alert("Fehler: " + (r && r.error || ""));
	} catch (e) {
		alert("Fehler: " + (e && e.message || ""));
	}
	if (btn) {
		btn.disabled = false;
		btn.textContent = "Passwort";
	}
}
async function supBestaetigen(userId) {
	const r = await workerCall("support_aktion", {
		was: "bestaetigen",
		user_id: userId
	});
	if (r && r.ok) {
		zeigeToast("Bestätigt", "Der Nutzer kann sich jetzt anmelden.");
		supLade();
	} else alert("Fehler: " + (r && r.error || ""));
}
function teamFussHtml() {
	const darf = darfVerwalten();
	const istSupport = CURRENT_USER_RANG === "support";
	let out = "";
	if (darf) out += gruppenBlockHtml();
	if (darf && !istSupport) {
		out += "<div class=\"team-block sec-in sec-in-4\" id=\"codeBlock\">" + "<div class=\"team-block-h\">Unternehmens-Code</div>" + "<div class=\"team-block-d\">Mit diesem Code kann jemand mit einem Einzelkonto eurem Unternehmen beitreten – unter Konto → „Einem Unternehmen beitreten“.</div>" + "<div class=\"code-zeile\"><span class=\"code-wert\" id=\"codeWert\">••••••</span>" + "<button class=\"kyc-btn\" data-act-click=\"h121\">Kopieren</button></div>" + "</div>";
	}
	const rest = (TEAM_MEMBERS || []).filter(function(m) {
		return m.rang === "president";
	}).length;
	const letzter = CURRENT_USER_RANG === "president" && rest <= 1;
	out += "<div class=\"team-block sec-in sec-in-4 verlassen-block\">" + "<div class=\"team-block-h\">" + (istSupport ? "Support-Einsatz beenden" : "Team verlassen") + "</div>" + "<div class=\"team-block-d\">" + (istSupport ? "Du kehrst in dein Support-Konto zurück. Das Unternehmen bleibt unverändert." : letzter ? "Du bist der einzige President. Ernenne zuerst jemanden zum President, bevor du gehst." : "Du verlässt dieses Unternehmen und kehrst in dein eigenes Konto zurück. Deine früheren Prüfungen dort bleiben erhalten.") + "</div>" + "<button class=\"verlassen-btn\" data-act-click=\"h122\"" + (letzter ? " disabled" : "") + ">" + "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9\"/></svg>" + (istSupport ? "Einsatz beenden" : "Team verlassen") + "</button>" + "</div>";
	return out;
}
async function ladeFirmencode() {
	const el = document.getElementById("codeWert");
	if (!el || !sb) return;
	try {
		const { data } = await sb.rpc("mein_firmencode");
		if (data) {
			el.textContent = data;
			el.classList.add("an");
		} else el.textContent = "–";
	} catch (e) {
		el.textContent = "–";
	}
}
function codeKopieren(btn) {
	const el = document.getElementById("codeWert");
	const code = el ? el.textContent.trim() : "";
	if (!code || code === "–") return;
	function ok() {
		const alt = btn.textContent;
		btn.textContent = "Kopiert ✓";
		btn.classList.add("kopiert");
		setTimeout(function() {
			btn.textContent = alt;
			btn.classList.remove("kopiert");
		}, 1400);
	}
	try {
		navigator.clipboard.writeText(code).then(ok).catch(function() {
			kopierNotloesung(code, ok);
		});
	} catch (e) {
		kopierNotloesung(code, ok);
	}
}
function teamVerlassenFrage() {
	const istSupport = CURRENT_USER_RANG === "support";
	const box = document.createElement("div");
	box.id = "verlGate";
	box.className = "up-warn-back";
	box.innerHTML = "<div class=\"up-warn-card verl-card\">" + "<div class=\"up-warn-ico\">→</div>" + "<div class=\"up-warn-t\">" + (istSupport ? "Einsatz beenden?" : "Team wirklich verlassen?") + "</div>" + "<div class=\"up-warn-d\">" + (istSupport ? "Du kehrst in dein Support-Konto zurück." : "Du verlierst den Zugriff auf die Prüfungen, Ordner und Akten dieses Unternehmens. Um zurückzukommen, brauchst du eine neue Einladung.<br/><br/>Dein eigenes Konto mit deinen bisherigen Prüfungen bleibt erhalten.") + "</div>" + "<div class=\"up-warn-btns\">" + "<button class=\"kyc-btn\" data-act-click=\"h123\">Abbrechen</button>" + "<button class=\"up-senden verl-ok\" data-act-click=\"h124\">" + (istSupport ? "Beenden" : "Ja, verlassen") + "</button>" + "</div></div>";
	document.body.appendChild(box);
	einblenden(box);
}
function verlGateZu() {
	const b = document.getElementById("verlGate");
	if (!b) return;
	const k = b.querySelector(".verl-card");
	if (k) k.classList.add("karte-weg");
	b.classList.remove("an");
	setTimeout(function() {
		if (b.parentNode) b.remove();
	}, 280);
}
async function teamVerlassen() {
	const btn = document.querySelector("#verlGate .verl-ok");
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Wird verlassen…";
	}
	try {
		const { data, error } = await sb.rpc("team_verlassen");
		if (error) throw error;
		if (data && data.ok) {
			verlGateZu();
			zeigeToast("Team verlassen", "Du bist zurück in deinem eigenen Konto.");
			setTimeout(function() {
				location.reload();
			}, 1200);
			return;
		}
		const g = data && data.grund || "";
		alert(g === "letzter_president" ? "Du bist der letzte President. Ernenne zuerst jemanden." : "Verlassen fehlgeschlagen: " + g);
	} catch (e) {
		alert("Verlassen fehlgeschlagen: " + (e && e.message || ""));
	}
	if (btn) {
		btn.disabled = false;
		btn.textContent = "Ja, verlassen";
	}
}
function rangZeile(r, text, idx) {
	const info = RANG_INFO[r];
	return "<div class=\"rang-zeile\">" + "<span class=\"tm-badge tm-" + info.farbe + "\"><span class=\"tm-badge-ico\">" + (RANG_SVG[r] || RANG_SVG.member) + "</span>" + info.name + "</span>" + "<span class=\"rang-text\">" + text + "</span></div>";
}
async function rangAendern(userId, rang, sel) {
	if (!rang || !sb) return;
	if (sel) sel.disabled = true;
	try {
		const { data, error } = await sb.rpc("rang_setzen", {
			p_user: userId,
			p_rang: rang
		});
		if (error) throw error;
		if (!data || data.ok !== true) throw new Error(data && data.grund || "Nicht möglich");
		await ladeMeinenRang();
		await _openTeam();
	} catch (e) {
		alert(e && e.message || "Rang konnte nicht geändert werden.");
		if (sel) {
			sel.disabled = false;
			sel.value = "";
		}
	}
}
function paketHinweisAnzeigen() {
	if (!WUNSCH_PAKET || typeof PLAENE === "undefined") return;
	const p = PLAENE.find(function(x) {
		return x.id === WUNSCH_PAKET;
	});
	const karte = document.querySelector(".auth-card");
	if (!p || !karte || document.getElementById("paketHinweis")) return;
	const box = document.createElement("div");
	box.id = "paketHinweis";
	box.className = "paket-hinweis";
	box.innerHTML = "<div class=\"ph-kopf\">" + "<span class=\"ph-marke\">" + escapeHtml(p.name) + "</span>" + "<button class=\"ph-weg\" data-act-click=\"h125\" title=\"Auswahl aufheben\">✕</button>" + "</div>" + "<div class=\"ph-text\">Nach der Registrierung kannst du direkt mit <b>" + escapeHtml(p.name) + "</b> starten – " + p.limit.toLocaleString("de-DE") + " Analysen für " + p.preis + " € im Monat.</div>" + "<div class=\"ph-frei\">Deine ersten 3 Analysen sind kostenlos – du zahlst erst danach.</div>";
	karte.insertBefore(box, karte.firstChild);
	einblenden(box);
}
function paketHinweisWeg() {
	const b = document.getElementById("paketHinweis");
	if (b) {
		b.classList.add("weg");
		setTimeout(function() {
			if (b.parentNode) b.remove();
		}, 280);
	}
	wunschPaketVergessen();
}
async function einladungHinweis() {
	if (!EINLADUNG_TOKEN || !sb) return;
	try {
		const { data } = await sb.rpc("einladung_vorschau", { p_token: EINLADUNG_TOKEN });
		const v = data && data[0] || null;
		const karte = document.querySelector(".auth-card");
		if (!karte) return;
		const box = document.createElement("div");
		box.className = "einl-willkommen";
		if (v && v.gueltig) {
			box.innerHTML = "<div class=\"einl-w-t\">Du wurdest eingeladen</div>" + "<div class=\"einl-w-d\">Melde dich an oder erstelle ein Konto – danach bist du automatisch Teil von <b>" + escapeHtml(v.firma_name || "diesem Unternehmen") + "</b>.</div>";
		} else {
			box.className += " einl-w-fehler";
			box.innerHTML = "<div class=\"einl-w-t\">Einladung ungültig</div>" + "<div class=\"einl-w-d\">Dieser Einladungslink ist abgelaufen oder wurde bereits verwendet. Bitte fordere einen neuen an.</div>";
		}
		karte.insertBefore(box, karte.firstChild);
	} catch (e) {}
}
var MAIL_DATEN = null;
function mailIconSvg() {
	return "<svg class=\"btn-ico\" viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" " + "stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + "<path d=\"M22 2 11 13\"/><path d=\"M22 2 15 22l-4-9-9-4z\"/></svg>";
}
function mailUploadLink() {
	if (!KYC || !KYC.link) return;
	const url = location.origin + location.pathname + "?upload=" + KYC.link.token;
	mailVersendenOeffnen("upload", url, {
		firma: CURRENT_FIRMA && CURRENT_FIRMA.firma_name || "",
		code: KYC.link.ref_code || "",
		absender: CURRENT_USER_NAME && CURRENT_USER_NAME.indexOf("@") < 0 ? CURRENT_USER_NAME : ""
	});
}
function mailEinladung(id) {
	const e = EINLADUNGEN_GELADEN.find(function(x) {
		return x.id === id;
	});
	if (!e) return;
	const url = location.origin + location.pathname + "?einladung=" + e.token;
	mailVersendenOeffnen("einladung", url, {
		firma: CURRENT_FIRMA && CURRENT_FIRMA.firma_name || "",
		rang: rangName(e.rang),
		absender: CURRENT_USER_NAME && CURRENT_USER_NAME.indexOf("@") < 0 ? CURRENT_USER_NAME : ""
	});
}
function mailVersendenOeffnen(art, link, extra) {
	MAIL_DATEN = {
		art,
		link,
		extra: extra || {}
	};
	const box = document.createElement("div");
	box.id = "mailGate";
	box.className = "up-warn-back";
	box.innerHTML = "<div class=\"up-warn-card mail-card\">" + "<div class=\"mail-ico\"><svg viewBox=\"0 0 24 24\" width=\"23\" height=\"23\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + "<rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"/><path d=\"m2 7 10 6 10-6\"/></svg></div>" + "<div class=\"up-warn-t\">Nachricht versenden</div>" + "<div class=\"up-warn-d\">Wir formulieren die Nachricht – du entscheidest, wie du sie verschickst.</div>" + "<div class=\"mail-feld\">" + "<label class=\"auth-label\">Sprache der Nachricht</label>" + "<div class=\"mail-sprachen\">" + "<button class=\"mail-sprache aktiv\" data-lang=\"de\" data-act-click=\"h126\"><span class=\"mail-flagge\">🇩🇪</span>Deutsch</button>" + "<button class=\"mail-sprache\" data-lang=\"en\" data-act-click=\"h127\"><span class=\"mail-flagge\">🇬🇧</span>English</button>" + "</div></div>" + "<div class=\"mail-vorschau\"><div class=\"mail-v-kopf\">Vorschau</div><div class=\"mail-v-text\" id=\"mailVorschau\"></div></div>" + "<div class=\"mail-wege\">" + "<button class=\"mail-weg\" data-act-click=\"h128\">" + "<span class=\"mail-weg-ico\"><svg viewBox=\"0 0 24 24\" width=\"17\" height=\"17\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"9\" y=\"9\" width=\"13\" height=\"13\" rx=\"2\"/><path d=\"M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\"/></svg></span>" + "<span class=\"mail-weg-t\">Text kopieren</span>" + "<span class=\"mail-weg-d\">Für WhatsApp, SMS oder eigene Mail</span></button>" + "<button class=\"mail-weg\" data-act-click=\"h129\">" + "<span class=\"mail-weg-ico\"><svg viewBox=\"0 0 24 24\" width=\"17\" height=\"17\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"/><path d=\"m2 7 10 6 10-6\"/></svg></span>" + "<span class=\"mail-weg-t\">Mailprogramm öffnen</span>" + "<span class=\"mail-weg-d\">Mit fertigem Betreff und Text</span></button>" + "</div>" + "<div class=\"up-warn-btns\">" + "<button class=\"kyc-btn\" data-act-click=\"h130\">Schließen</button>" + "</div></div>";
	document.body.appendChild(box);
	einblenden(box);
	MAIL_DATEN.sprache = "de";
	mailVorschauAktualisieren();
}
function mailSpracheWaehlen(l) {
	if (!MAIL_DATEN) return;
	MAIL_DATEN.sprache = l;
	document.querySelectorAll("#mailGate .mail-sprache").forEach(function(b) {
		b.classList.toggle("aktiv", b.getAttribute("data-lang") === l);
	});
	mailVorschauAktualisieren();
}
function mailTexte() {
	const d = MAIL_DATEN || {};
	const e = d.extra || {};
	const de = d.sprache !== "en";
	const firma = e.firma || "unser Unternehmen";
	if (d.art === "einladung") {
		return de ? {
			betreff: "Einladung zum Compliance-Checker – " + firma,
			text: "Hallo,\n\n" + "du wurdest eingeladen, den Compliance-Checker von " + firma + " mitzunutzen.\n\n" + "Mit dem folgenden Link kannst du dich anmelden oder ein Konto erstellen – danach bist du automatisch im Team:\n" + d.link + "\n\n" + (e.rang ? "Dein Rang: " + e.rang + "\n\n" : "") + "Der Link ist 7 Tage gültig und kann nur einmal verwendet werden.\n\n" + "Viele Grüße\n" + (e.absender || e.firma || "")
		} : {
			betreff: "Invitation to the Compliance Checker – " + firma,
			text: "Hello,\n\n" + "You have been invited to use the Compliance Checker of " + firma + ".\n\n" + "Use the following link to sign in or create an account – you will then automatically join the team:\n" + d.link + "\n\n" + (e.rang ? "Your role: " + e.rang + "\n\n" : "") + "The link is valid for 7 days and can only be used once.\n\n" + "Best regards\n" + (e.absender || e.firma || "")
		};
	}
	return de ? {
		betreff: "Identitätsprüfung – Dokumente hochladen",
		text: "Guten Tag,\n\n" + "für unsere gesetzlich vorgeschriebene Identitätsprüfung nach dem Geldwäschegesetz benötigen wir eine einmalige Bestätigung Ihrer Identität.\n\n" + "Über den folgenden Link können Sie Ihren Ausweis und ein Bestätigungsfoto sicher hochladen – ganz ohne Anmeldung:\n" + d.link + "\n\n" + (e.code ? "Bestätigungscode: " + e.code + "\n" + "Bitte gleichen Sie diesen Code mit uns ab, bevor Sie etwas hochladen. So wissen Sie sicher, dass der Link von uns stammt.\n\n" : "") + "Der Link ist 72 Stunden gültig und kann nur einmal verwendet werden. Ihre Daten werden verschlüsselt übertragen und auf Servern innerhalb der EU gespeichert.\n\n" + "Mit freundlichen Grüßen\n" + [e.absender, e.firma].filter(function(x) {
			return x;
		}).join("\n")
	} : {
		betreff: "Identity verification – please upload your documents",
		text: "Hello,\n\n" + "For our legally required identity verification under anti-money-laundering regulations, we need a one-time confirmation of your identity.\n\n" + "Please use the link below to securely upload your ID document and a confirmation photo – no account needed:\n" + d.link + "\n\n" + (e.code ? "Confirmation code: " + e.code + "\n" + "Please verify this code with us before uploading anything, so you can be certain the link came from us.\n\n" : "") + "The link is valid for 72 hours and can only be used once. Your data is transferred encrypted and stored on servers within the EU.\n\n" + "Kind regards\n" + [e.absender, e.firma].filter(function(x) {
			return x;
		}).join("\n")
	};
}
function mailVorschauAktualisieren() {
	const v = document.getElementById("mailVorschau");
	if (!v) return;
	const t = mailTexte();
	v.textContent = t.text;
	v.style.animation = "none";
	void v.offsetWidth;
	v.style.animation = "mailVor .35s cubic-bezier(.2,.7,.2,1) both";
}
function mailTextKopieren(btn) {
	const t = mailTexte();
	const txt = t.text;
	function erfolg() {
		if (!btn) return;
		btn.classList.add("mail-weg-ok");
		const label = btn.querySelector(".mail-weg-t");
		const alt = label ? label.textContent : "";
		if (label) label.textContent = "Kopiert ✓";
		setTimeout(function() {
			btn.classList.remove("mail-weg-ok");
			if (label) label.textContent = alt;
		}, 1800);
	}
	try {
		navigator.clipboard.writeText(txt).then(erfolg).catch(function() {
			kopierNotloesung(txt, erfolg);
		});
	} catch (e) {
		kopierNotloesung(txt, erfolg);
	}
}
function kopierNotloesung(txt, fertig) {
	try {
		const f = document.createElement("textarea");
		f.value = txt;
		f.style.cssText = "position:fixed;top:-9999px;opacity:0;";
		document.body.appendChild(f);
		f.select();
		f.setSelectionRange(0, 999999);
		document.execCommand("copy");
		f.remove();
		if (fertig) fertig();
	} catch (e) {
		alert("Kopieren nicht möglich – bitte den Text in der Vorschau markieren.");
	}
}
function mailOeffnen() {
	const t = mailTexte();
	const adresse = "mailto:?subject=" + encodeURIComponent(t.betreff) + "&body=" + encodeURIComponent(t.text);
	mailGateZu();
	setTimeout(function() {
		try {
			window.location.href = adresse;
		} catch (e) {
			alert("Mailprogramm konnte nicht geöffnet werden.");
		}
	}, 260);
}
function mailGateZu() {
	const b = document.getElementById("mailGate");
	if (!b) return;
	const k = b.querySelector(".mail-card");
	if (k) k.classList.add("karte-weg");
	b.classList.remove("an");
	setTimeout(function() {
		if (b.parentNode) b.remove();
		MAIL_DATEN = null;
	}, 280);
}
function einlToken() {
	const z = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
	const a = new Uint8Array(24);
	crypto.getRandomValues(a);
	let t = "";
	for (let i = 0; i < a.length; i++) t += z[a[i] % z.length];
	return t;
}
async function einladungErstellen() {
	if (!sb || !CURRENT_FIRMA) return;
	const rang = (document.getElementById("einlRang") || {}).value || "member";
	const notiz = ((document.getElementById("einlNotiz") || {}).value || "").trim().slice(0, 80);
	try {
		const { error } = await sb.from("team_einladungen").insert({
			token: einlToken(),
			firma_id: CURRENT_FIRMA.firma_id,
			rang,
			rolle: rang === "vice" || rang === "president" ? "admin" : "mitglied",
			erstellt_von: CURRENT_USER_ID,
			notiz: notiz || null,
			ablauf: new Date(Date.now() + 7 * 24 * 3600 * 1e3).toISOString(),
			max_nutzungen: 1
		});
		if (error) throw error;
		const n = document.getElementById("einlNotiz");
		if (n) n.value = "";
		await ladeEinladungen();
	} catch (e) {
		alert("Einladung konnte nicht erstellt werden: " + (e && e.message || ""));
	}
}
async function ladeEinladungen() {
	const ziel = document.getElementById("einlListe");
	if (!ziel || !sb) return;
	try {
		const { data } = await sb.from("team_einladungen").select("*").eq("aktiv", true).gt("ablauf", new Date().toISOString()).order("created_at", { ascending: false }).limit(10);
		const liste = data || [];
		setEINLADUNGEN_GELADEN(liste);
		if (!liste.length) {
			ziel.innerHTML = "<div class=\"einl-leer\">Noch keine offenen Einladungen.</div>";
			return;
		}
		ziel.innerHTML = liste.map(function(e) {
			const url = location.origin + location.pathname + "?einladung=" + e.token;
			const rest = Math.max(0, Math.ceil((new Date(e.ablauf).getTime() - Date.now()) / 864e5));
			return "<div class=\"einl-row\">" + "<div class=\"einl-info\">" + "<span class=\"tm-badge tm-" + (RANG_INFO[e.rang] || RANG_INFO.member).farbe + "\">" + rangName(e.rang) + "</span>" + (e.notiz ? "<span class=\"einl-notiz\">" + escapeHtml(e.notiz) + "</span>" : "") + "<span class=\"einl-rest\">noch " + rest + " Tag" + (rest === 1 ? "" : "e") + "</span>" + "</div>" + "<div class=\"einl-link-row\">" + "<input class=\"kyc-link-input\" readonly value=\"" + url + "\" data-act-click=\"h131\" />" + "<button class=\"kyc-btn\" data-act-click=\"h132\">Kopieren</button>" + "<button class=\"kyc-btn kyc-btn-mail\" data-act-click=\"h133\" data-a0=\"" + escapeAttr(e.id) + "\">" + mailIconSvg() + "Nachricht senden</button>" + "<button class=\"kyc-btn kyc-btn-del\" data-act-click=\"h134\" data-a0=\"" + escapeAttr(e.id) + "\">Widerrufen</button>" + "</div></div>";
		}).join("");
	} catch (e) {
		ziel.innerHTML = "";
	}
}
function einlKopieren(btn) {
	const inp = btn.parentNode.querySelector("input");
	if (!inp) return;
	inp.select();
	inp.setSelectionRange(0, 99999);
	try {
		navigator.clipboard.writeText(inp.value);
	} catch (e) {
		try {
			document.execCommand("copy");
		} catch (e2) {}
	}
	const alt = btn.textContent;
	btn.textContent = "Kopiert ✓";
	setTimeout(function() {
		btn.textContent = alt;
	}, 1400);
}
async function einlWiderrufen(id) {
	if (!await frageDialog({
		titel: "Einladungslink ungültig machen?",
		text: "Wer den Link schon hat, kann ihn danach nicht mehr nutzen.",
		ok: "Ungültig machen",
		gefahr: true
	})) return;
	try {
		await sb.from("team_einladungen").update({ aktiv: false }).eq("id", id);
		await ladeEinladungen();
	} catch (e) {
		alert("Konnte nicht widerrufen werden.");
	}
}
async function teamAktion(aktion, userId) {
	if (!sb || !userId) return;
	let rpc, frage;
	if (aktion === "entfernen") {
		rpc = "mitglied_entfernen";
		frage = "Dieses Mitglied wirklich aus der Firma entfernen?\n\nSeine bisherigen Prüfungen bleiben erhalten.";
	} else return;
	if (frage && !await frageDialog({
		titel: frage.split("\n")[0],
		text: frage.split("\n").slice(1).join("\n").trim(),
		ok: aktion === "entfernen" ? "Entfernen" : aktion === "befoerdern" ? "Befördern" : "Zurückstufen",
		gefahr: aktion === "entfernen"
	})) return;
	try {
		const { error } = await sb.rpc(rpc, { p_user: userId });
		if (error) throw error;
		await ladeMeineRolle();
		try {
			await ladeMeinenRang();
		} catch (e) {}
		try {
			await ladeMeinenNamen();
		} catch (e) {}
		try {
			await entferntHinweisPruefen();
		} catch (e) {}
		if (CURRENT_USER_ROLLE === "admin") await _openTeam();
		else backToMain();
	} catch (e) {
		alert(e && e.message || "Aktion fehlgeschlagen.");
	}
}
async function ladeOrdner() {
	if (!sb) return;
	try {
		const { data, error } = await sb.from("ordner").select("id, name, farbe, sichtbarkeit, ersteller_id").order("name", { ascending: true });
		if (error) throw error;
		setORDNER_LIST((data || []).map(function(o) {
			o.farbe = sichereFarbe(o.farbe);
			return o;
		}));
	} catch (e) {
		setORDNER_LIST([]);
		console.warn("Ordner konnten nicht geladen werden:", e && e.message);
	}
	fuelleOrdnerSelect();
}
function fuelleOrdnerSelect() {
	const sel = document.getElementById("ordnerSelect");
	if (!sel) return;
	const einzel = !!(CURRENT_FIRMA && CURRENT_FIRMA.typ === "einzel");
	const cur = sel.value;
	let html = "<option value=\"auto\">Automatisch (Länderordner)</option><option value=\"\">Kein Ordner</option>";
	ORDNER_LIST.forEach(function(o) {
		const tag = einzel ? "" : o.sichtbarkeit === "oeffentlich" ? " (öffentlich)" : " (privat)";
		html += "<option value=\"" + o.id + "\">" + escapeHtml(o.name) + tag + "</option>";
	});
	sel.innerHTML = html;
	sel.value = cur;
	if (sel.value !== cur) sel.value = "auto";
	ordnerChipsZeichnen();
}
var OD_OFFEN = false;
function ordnerChipsZeichnen() {
	odFeldAktualisieren();
}
function odFeldAktualisieren() {
	const sel = document.getElementById("ordnerSelect");
	const txt = document.getElementById("odText");
	const pkt = document.getElementById("odPunkt");
	if (!sel || !txt || !pkt) return;
	const o = ORDNER_LIST.find(function(x) {
		return x.id === sel.value;
	});
	if (o) {
		txt.textContent = o.name;
		pkt.className = "od-punkt";
		pkt.style.background = o.farbe || "#22C55E";
	} else {
		txt.textContent = sel.value === "auto" ? "Automatisch (Länderordner)" : "Kein Ordner";
		pkt.className = "od-punkt od-punkt-leer";
		pkt.style.background = "";
	}
}
function odToggle() {
	OD_OFFEN ? odZu() : odAuf();
}
function odAuf() {
	const menu = document.getElementById("odMenu");
	const feld = document.getElementById("odFeld");
	if (!menu) return;
	OD_OFFEN = true;
	odListeZeichnen("");
	const sw = document.getElementById("odSucheWrap");
	if (sw) sw.style.display = ORDNER_LIST.length > 6 ? "" : "none";
	menu.style.display = "";
	if (feld) feld.classList.add("offen");
	einblenden(menu);
	const su = document.getElementById("odSuche");
	if (su) {
		su.value = "";
		if (ORDNER_LIST.length > 6) setTimeout(function() {
			su.focus();
		}, 60);
	}
	setTimeout(function() {
		document.addEventListener("click", odAussenKlick);
	}, 0);
}
function odZu() {
	const menu = document.getElementById("odMenu");
	const feld = document.getElementById("odFeld");
	if (!menu || !OD_OFFEN) return;
	OD_OFFEN = false;
	menu.classList.remove("an");
	if (feld) feld.classList.remove("offen");
	setTimeout(function() {
		if (!OD_OFFEN) menu.style.display = "none";
	}, 200);
	document.removeEventListener("click", odAussenKlick);
}
function odAussenKlick(ev) {
	const w = document.getElementById("odWrap");
	if (w && !w.contains(ev.target)) odZu();
}
function odListeZeichnen(filter) {
	const box = document.getElementById("odListe");
	const sel = document.getElementById("ordnerSelect");
	if (!box) return;
	const f = (filter || "").toLowerCase().trim();
	const einzel = !!(CURRENT_FIRMA && CURRENT_FIRMA.typ === "einzel");
	const aktiv = sel ? sel.value : "auto";
	let out = "";
	if (!f) {
		out += "<div class=\"od-opt" + (aktiv === "auto" ? " aktiv" : "") + "\" data-act-click=\"h135\">" + "<span class=\"od-punkt od-punkt-leer\"></span><span class=\"od-opt-t\">Automatisch (Länderordner)</span>" + (aktiv === "auto" ? "<span class=\"od-haken\">✓</span>" : "") + "</div>";
		out += "<div class=\"od-opt" + (!aktiv ? " aktiv" : "") + "\" data-act-click=\"h136\">" + "<span class=\"od-punkt od-punkt-leer\"></span><span class=\"od-opt-t\">Kein Ordner</span>" + (!aktiv ? "<span class=\"od-haken\">✓</span>" : "") + "</div>";
	}
	const liste = ORDNER_LIST.filter(function(o) {
		return !f || o.name.toLowerCase().indexOf(f) >= 0;
	});
	liste.forEach(function(o, n) {
		const ist = aktiv === o.id;
		const geteilt = !einzel && o.sichtbarkeit === "oeffentlich";
		out += "<div class=\"od-opt" + (ist ? " aktiv" : "") + "\" style=\"--odd:" + n * .025 + "s\" data-act-click=\"h137\" data-a0=\"" + escapeAttr(o.id) + "\">" + "<span class=\"od-punkt\" style=\"background:" + (o.farbe || "#22C55E") + "\"></span>" + "<span class=\"od-opt-t\">" + escapeHtml(o.name) + "</span>" + (geteilt ? "<span class=\"od-tag\">Team</span>" : "") + (ist ? "<span class=\"od-haken\">✓</span>" : "") + "</div>";
	});
	if (!liste.length && f) out += "<div class=\"od-leer\">Kein Ordner mit „" + escapeHtml(f) + "“</div>";
	if (!ORDNER_LIST.length) out += "<div class=\"od-leer\">Noch keine Ordner angelegt.</div>";
	box.innerHTML = out;
}
function odFiltern() {
	const su = document.getElementById("odSuche");
	odListeZeichnen(su ? su.value : "");
}
function odTaste(ev) {
	if (ev.key === "Escape") {
		odZu();
		return;
	}
	if (ev.key === "Enter") {
		const erste = document.querySelector("#odListe .od-opt");
		if (erste) erste.click();
	}
}
function odWaehlen(id) {
	const sel = document.getElementById("ordnerSelect");
	if (sel) sel.value = id || "";
	odFeldAktualisieren();
	const feld = document.getElementById("odFeld");
	if (feld) {
		feld.classList.remove("od-puls");
		void feld.offsetWidth;
		feld.classList.add("od-puls");
	}
	odZu();
}
function setOrdnerSicht(s) {
	setNEUER_ORDNER_SICHT(s);
	const p = document.getElementById("ordnerOptPrivat"), o = document.getElementById("ordnerOptOeff");
	if (p) p.classList.toggle("active", s === "privat");
	if (o) o.classList.toggle("active", s === "oeffentlich");
}
function ordnerMsgShow(text, type) {
	const m = document.getElementById("ordnerMsg");
	if (!m) return;
	if (!text) {
		m.classList.remove("show");
		return;
	}
	m.textContent = text;
	m.className = "auth-msg show " + (type || "");
}
function infoOeffnen(welche) {
	const gate = document.getElementById("infoGate");
	const inner = document.getElementById("infoInner");
	if (!gate || !inner) return;
	inner.innerHTML = welche === "quellen" ? infoQuellenHtml() : infoBewertungHtml();
	gate.style.display = "flex";
	gate.scrollTop = 0;
	einblenden(gate);
	document.body.style.overflow = "hidden";
}
document.addEventListener("keydown", function(e) {
	if (e.key === "Escape") {
		const g = document.getElementById("infoGate");
		if (g && g.style.display === "flex") {
			infoSchliessen();
			return;
		}
		const p = document.getElementById("helpPop");
		if (p && p.style.display === "flex") toggleHelp();
	}
});
function infoSchliessen() {
	const gate = document.getElementById("infoGate");
	if (!gate) return;
	gate.classList.remove("an");
	document.body.style.overflow = "";
	setTimeout(function() {
		gate.style.display = "none";
	}, 280);
}
function infoBewertungHtml() {
	return "<div class=\"info-kicker\">Transparenz</div>" + "<h2 class=\"info-h1\">Wie die Bewertung funktioniert</h2>" + "<p class=\"info-lead\">Jede Prüfung endet mit einem Vertrauens-Score von 0 bis 100. Er ist kein Urteil über ein Unternehmen, sondern ein Hinweis darauf, wie belastbar und widerspruchsfrei die auffindbare Datenlage ist – und wo Sie im Rahmen Ihrer Sorgfältigkeitspflichten genauer hinsehen sollten.</p>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">1. Fünf Prüfbereiche</h3>" + "<p>Die Analyse betrachtet das Unternehmen aus fünf Blickwinkeln. Jeder Bereich wird eigenständig bewertet:</p>" + "<div class=\"info-grid\">" + infoKarte("🏛️", "Grunddaten", "Rechtsform, Registereintrag, Steuer-Identifikation, Geschäftsadresse und Gründungszeitpunkt – also die formale Existenz des Unternehmens.") + infoKarte("👥", "Personen", "Leitungsebene und wirtschaftlich Berechtigte: Sind sie benannt, plausibel und überprüfbar?") + infoKarte("📊", "Finanzen", "Größenordnung, Beschäftigte und wirtschaftliche Substanz – passt das Bild zusammen?") + infoKarte("📰", "Reputation", "Öffentliche Wahrnehmung, Berichterstattung und Auffälligkeiten im Marktumfeld.") + infoKarte("🌐", "Online-Präsenz", "Erreichbarkeit, Konsistenz der Kontaktdaten und Spuren einer echten Geschäftstätigkeit.") + "</div>" + "<p class=\"info-p\"><b>Gewichtung im Gesamtwert:</b> Grunddaten 30 % · Personen 30 % · Kontakt &amp; Online-Präsenz 20 % · Finanzen 15 % · Reputation 5 %. Unter dem Score steht jeweils die kurze Rechnung, wie der Wert zustande kam.</p>" + "<p class=\"info-hint\">Bereiche ohne belastbare Datenlage fließen <b>nicht</b> in den Gesamtwert ein. So drückt eine fehlende Information den Score nicht künstlich – sie wird stattdessen als Lücke ausgewiesen.</p></div>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">2. Fünf eigenständige Warnsignale</h3>" + "<p>Unabhängig vom Punktwert prüft das System auf fünf Sachverhalte, die eine eigene Bedeutung haben und den Gesamtwert begrenzen oder ihn überlagern:</p>" + "<div class=\"info-liste\">" + infoWarn("Sanktions-Treffer", "Steht das Unternehmen, seine Leitung oder ein wirtschaftlich Berechtigter auf einer einschlägigen Liste, ist das ein Ausschlusskriterium. Der Score wird hart begrenzt und der Befund deutlich hervorgehoben.", "rot") + infoWarn("Politisch exponierte Person", "Eine Verbindung zu einer politisch exponierten Person ist kein Ausschlussgrund, löst aber verstärkte Sorgfaltspflichten aus und begrenzt den Score.", "gelb") + infoWarn("Strohmann-Indizien", "Deuten konkrete Anhaltspunkte darauf hin, dass die formal handelnden Personen nicht die wirtschaftlich Handelnden sind, wird das gesondert ausgewiesen – nur bei belegbaren Indizien, nicht bei bloßen Vermutungen.", "rot") + infoWarn("Insolvenzhinweise", "Anzeichen für ein laufendes oder eröffnetes Insolvenzverfahren werden getrennt von der Finanzbewertung ausgewiesen, da sie eine eigene Risikodimension darstellen.", "gelb") + infoWarn("Abweichender Sitz", "Wurde der Sitz des Unternehmens angegeben und weicht der eingetragene Sitz laut Quelle davon ab, wird das deutlich markiert und der Score um " + SITZ_ABZUG + " Punkte gesenkt – möglicherweise wurde eine gleichnamige Firma an einem anderen Ort gefunden.", "gelb") + "</div></div>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">3. Was streng bewertet wird</h3>" + "<p>Bei Unternehmen, die im EU-Raum registriert sein müssen, gelten Registernummer und Steuer-Identifikation als Pflichtangaben. Sind sie nicht auffindbar, wertet das System das als ernsthaftes Warnsignal – ebenso wie eine reine Briefkastenadresse oder ein Missverhältnis zwischen angegebener Geschäftsgröße und nachweisbarer Substanz.</p></div>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">4. Die drei Einstufungen</h3>" + "<div class=\"info-stufen\">" + "<div class=\"info-stufe info-gruen\"><b>Geringe Auffälligkeiten</b><span>Die Datenlage ist stimmig. Die übliche Sorgfalt genügt.</span></div>" + "<div class=\"info-stufe info-gelb\"><b>Erhöhte Sorgfaltspflicht</b><span>Es bestehen Lücken oder Unstimmigkeiten. Einzelne Punkte sollten vor Geschäftsabschluss geklärt werden.</span></div>" + "<div class=\"info-stufe info-rot\"><b>Verstärkte Sorgfaltspflicht</b><span>Es liegen gewichtige Befunde vor. Eine vertiefte Prüfung und Dokumentation ist geboten.</span></div>" + "</div></div>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">5. Abgleich mit Sanktionslisten</h3>" + "<p class=\"info-p\">Unabhängig von der Recherche wird jeder Name unmittelbar gegen die <b>konsolidierte Sanktionsliste der Europäischen Union</b> abgeglichen – täglich aktualisiert, mit Erkennung abweichender Schreibweisen. Ein Treffer wird im Bericht deutlich ausgewiesen und wirkt sich unmittelbar auf die Einstufung aus.</p>" + "<div class=\"info-warn\"><b>Was ein Treffer bedeutet:</b> Ein Treffer in der Sanktionsliste ist nicht gleichbedeutend mit einer Personenidentität der gesuchten Person mit der in der Sanktionsliste gefundenen Person. Ein Treffer bedeutet lediglich, dass eine Namensgleichheit oder eine Namensähnlichkeit besteht. Die Ermittlung, ob es sich um dieselbe Person handelt, muss im Wege der Amtsermittlung erfolgen.</div>" + "</div>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">6. Gleiche Firmennamen</h3>" + "<p class=\"info-p\">Kommen für eine Eingabe mehrere Unternehmen in Betracht, wird vor der Analyse eine Auswahl angezeigt – mit Sitz, Registernummer, Gründungsjahr und Branche zur Unterscheidung. Erst nach Bestätigung läuft die vollständige Prüfung. So ist ausgeschlossen, dass versehentlich ein gleichnamiges, aber anderes Unternehmen geprüft wird.</p>" + "</div>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">7. Wiederholte Prüfung im Zeitverlauf</h3>" + "<p class=\"info-p\">Bei Unternehmen unter laufender Überwachung wird die neue Bewertung mit der vorherigen verglichen. Ausgewiesen werden neue Sanktionstreffer, neu aufgetretene Insolvenzhinweise, Wechsel bei Geschäftsführung oder wirtschaftlich Berechtigten sowie deutliche Veränderungen des Scores. Ein Absinken um mehr als 15 Punkte oder ein Wert unter 45 gilt als kritische Veränderung.</p>" + "</div>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">8. Eigene Ergänzungen und Dokumente</h3>" + "<p class=\"info-p\">Findet die Recherche eine Angabe nicht, können Sie sie im Bereich <b>Analyse</b> über „Angaben ergänzen“ selbst eintragen oder im Bereich <b>Dokumente</b> einen Nachweis wie einen Handelsregisterauszug hinterlegen. Mit „Neu bewerten“ wird die Akte dann gezielt nachrecherchiert:</p>" + "<ul class=\"info-liste\">" + "<li><b>Dokumente werden ausgelesen.</b> Die KI liest hinterlegte PDFs und Bilder und übernimmt belegte Angaben – bis zu drei Dokumente je Durchgang, neue zuerst. Ein Dokument gilt als stärkste Quelle; widerspricht ihm eine Internetquelle, wird der Widerspruch ausgewiesen.</li>" + "<li><b>Eine ergänzte USt-IdNr. wird amtlich geprüft.</b> Sie wird sofort über das EU-System VIES bestätigt.</li>" + "<li><b>Ergänzen senkt den Score nicht.</b> Eine Kategorie fällt nur unter ihren bisherigen Wert, wenn in diesem Durchgang ein konkret neuer Negativbefund auftaucht – etwa ein Sanktionstreffer, eine Insolvenz oder ein Widerspruch zu einem Dokument. Dieser Befund wird dann als Risiko-Hinweis benannt.</li>" + "<li><b>Nicht ausgewertet</b> werden eigene Aufnahmen, Ausweis und Bestätigungsfoto. Sie dienen als Nachweis in der Akte.</li>" + "</ul>" + "<div class=\"info-warn\">Selbst eingetragene Angaben sind im Bericht als „Manuell ergänzt“ gekennzeichnet. Für ihre Richtigkeit ist der Nutzer verantwortlich; eine amtliche Verifizierung durch die Automati Labs GmbH findet insoweit nicht statt.</div>" + "</div>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">9. Umsatzsteuer-Identifikationsnummer</h3>" + "<p class=\"info-p\">Eine angegebene USt-IdNr. wird über das amtliche EU-System <b>VIES</b> geprüft – mit mehreren Versuchen, da einzelne Mitgliedstaaten zeitweise nicht antworten. Unterschieden wird zwischen <b>gültig</b>, <b>ungültig</b> und <b>vorübergehend nicht abrufbar</b>. Ist das System nur nicht erreichbar, ist das kein Mangel des Unternehmens und führt zu keinem Abzug.</p>" + "</div>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">10. Die Akte</h3>" + "<p class=\"info-p\">Die Bewertung ist ein Teil der Akte. Daneben stehen die Bereiche Dokumente, Sanktionslisten und – im Fahrzeughandel – die Endverbleibserklärung. Mit dem <b>Abschluss</b> bestätigen Sie, dass die Sorgfaltsprüfung vollständig durchgeführt wurde. Der Abschluss verändert den Score nicht.</p>" + "</div>" + "<div class=\"info-warnbox\"><b>Wichtig zur Einordnung</b><br/>Der Score ist eine Entscheidungshilfe, keine Entscheidung. Er ersetzt weder Ihr eigenes Risikomanagement noch die gesetzlich vorgeschriebene Identifizierung von Vertragspartnern, und er trifft keine Aussage über die Rechtmäßigkeit einer Geschäftsbeziehung. Die abschließende Bewertung und jede Meldepflicht verbleiben bei Ihnen als verpflichtetem Unternehmen.</div>";
}
function infoQuellenHtml() {
	return "<div class=\"info-kicker\">Transparenz</div>" + "<h2 class=\"info-h1\">Woher die Informationen stammen</h2>" + "<p class=\"info-lead\">Jede Analyse stützt sich ausschließlich auf öffentlich zugängliche Informationen. Es werden keine internen Datenbanken Dritter angezapft, keine Auskünfte erschlichen und keine personenbezogenen Daten aus nicht-öffentlichen Quellen verarbeitet. Jede Angabe im Bericht ist mit ihrer Herkunft gekennzeichnet.</p>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">Die Quellen im Überblick</h3>" + "<div class=\"info-grid\">" + infoKarte("🏛️", "Amtliche Unternehmensregister", "Öffentliche Registerdaten zu Existenz, Rechtsform, Vertretungsberechtigten und Sitz – die formale Grundlage jeder Prüfung.") + infoKarte("⚖️", "Steuerliche Identifikationsdaten", "Amtliche Bestätigungsverfahren zur Prüfung, ob eine angegebene Steuer-Identifikation tatsächlich existiert und dem Unternehmen zugeordnet ist.") + infoKarte("🛡️", "Sanktions- und Embargolisten", "Direkter Abgleich gegen die konsolidierte Sanktionsliste der Europäischen Union. Die Liste wird täglich aktualisiert in unsere Datenbank gespiegelt – geprüft wird also gegen die amtliche Liste selbst, nicht über eine Internetsuche. Ergänzend fließen öffentlich dokumentierte Informationen zu politisch exponierten Personen ein.") + infoKarte("📰", "Presse und öffentliche Berichterstattung", "Redaktionelle Veröffentlichungen und öffentlich verfügbare Bekanntmachungen mit Bezug zum Unternehmen oder zu handelnden Personen.") + infoKarte("🌐", "Öffentliche Online-Präsenz", "Unternehmenseigene Auftritte, öffentlich einsehbare Profile in sozialen Netzwerken, Standort- und Kontaktangaben sowie öffentliche Bewertungen.") + infoKarte("📎", "Vom Nutzer hinterlegte Unterlagen", "Dokumente wie ein Handelsregisterauszug, die Sie in der Akte hinterlegen. Sie werden bei der Neubewertung ausgelesen und im Bericht mit dem Dateinamen als Quelle gekennzeichnet.") + "</div>" + "<p class=\"info-hint\">Amtliche Register werden für 56 Länder im Detail und in der jeweiligen Landessprache durchsucht (z. B. Handelsregister, KRS, EGRUL, Companies House); weltweit ist die Prüfung einsetzbar.</p></div>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">Der Sanktionslisten-Abgleich im Detail</h3>" + "<p class=\"info-p\">Namen werden unmittelbar gegen die <b>konsolidierte Sanktionsliste der Europäischen Union</b> abgeglichen. Diese Liste stellt die Europäische Kommission öffentlich bereit; sie ist dieselbe Grundlage, die auch Kreditinstitute und Behörden verwenden.</p>" + "<ul class=\"info-liste\">" + "<li><b>Täglich aktualisiert.</b> Der Abgleich läuft gegen den jeweils aktuellen Stand. In jedem Bericht ist festgehalten, gegen welchen Listenstand geprüft wurde.</li>" + "<li><b>Auch abweichende Schreibweisen.</b> Umlaute, Bindestriche und unterschiedliche Transkriptionen werden erkannt – geprüft wird auf Namensähnlichkeit, nicht nur auf exakte Übereinstimmung.</li>" + "<li><b>Alle Namensvarianten.</b> Sanktionierte Personen sind häufig unter mehreren Schreibweisen gelistet. Sämtliche hinterlegten Varianten fließen in den Abgleich ein.</li>" + "</ul>" + "<div class=\"info-warn\"><b>Was ein Treffer bedeutet:</b> Ein Treffer in der Sanktionsliste ist nicht gleichbedeutend mit einer Personenidentität der gesuchten Person mit der in der Sanktionsliste gefundenen Person. Ein Treffer bedeutet lediglich, dass eine Namensgleichheit oder eine Namensähnlichkeit besteht. Die Ermittlung, ob es sich um dieselbe Person handelt, muss im Wege der Amtsermittlung erfolgen.</div>" + "<div class=\"info-haft\">Wir weisen ausdrücklich darauf hin, dass wir uns zum Bezug unserer Daten der von der EU öffentlich zur Einsicht bereitgestellten Sanktionsliste als Quelle bedienen. Wir haften nicht für deren Inhalt, Vollständigkeit und/oder Stand.</div>" + "</div>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">Laufende Überwachung</h3>" + "<p class=\"info-p\">Unternehmen, die mit dem Stern markiert wurden, werden <b>alle drei Monate automatisch erneut geprüft</b> – mit denselben Quellen und derselben Prüftiefe wie bei einer manuellen Analyse. Das Ergebnis wird mit der vorherigen Prüfung verglichen; Veränderungen bei Sanktionslisten, Insolvenzhinweisen, Geschäftsführung oder Bewertung werden ausdrücklich ausgewiesen. Jede automatische Prüfung zählt wie eine normale Analyse gegen das gebuchte Kontingent.</p>" + "</div>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">Hochgeladene Ausweisdokumente</h3>" + "<p class=\"info-p\">Über einen sicheren Upload-Link können Geschäftspartner Ausweisdokumente und ein Bestätigungsfoto selbst hochladen – auf Servern innerhalb der EU, verschlüsselt übertragen. Je Dokumentart sind mehrere Dateien möglich, etwa Vorder- und Rückseite eines Personalausweises. Alle Dateien werden der Akte zugeordnet und beim Ausdruck als nummerierte Anlagen angehängt.</p>" + "<div class=\"info-warn\">Wir übernehmen keinerlei Haftung für die Authentizität, die Richtigkeit und/oder Vollständigkeit der hochgeladenen und/oder erstellten Aufnahmen. Es obliegt einzig und allein in der Verantwortung des Nutzers zu ermitteln, ob die verifizierte Person identisch mit den übermittelten Ausweisdokumenten ist. Jedwede Art von Verantwortlichkeit wird unsererseits ausdrücklich ausgeschlossen.</div>" + "</div>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">Was die KI auswertet – und was nicht</h3>" + "<div class=\"info-liste\">" + infoWarn("Ausgewertet", "Die öffentliche Recherche (Register, VIES, Presse, Online-Präsenz), vom Nutzer ergänzte Angaben sowie hinterlegte Dokumente – letztere bei der Neubewertung.", "gruen") + infoWarn("Nur als Nachweis abgelegt", "Eigene Aufnahmen, Ausweis, Bestätigungsfoto und die unterschriebene Endverbleibserklärung. Sie werden nicht analysiert und hängen beim Drucken als Anlagen an.", "gelb") + infoWarn("Endverbleibserklärung (Fahrzeughandel)", "Die Vorlage stellt der Nutzer bereit; das Tool füllt nur Käufer, Verkäufer, Ort und Datum ein und prüft den Inhalt nicht. Verbindlich ist allein die unterschriebene Fassung.", "gelb") + "</div></div>" + "<div class=\"info-sec\"><h3 class=\"info-h2\">Wie mit den Daten umgegangen wird</h3>" + "<div class=\"info-liste\">" + infoWarn("Herkunft nachvollziehbar", "Jede Kernaussage im Bericht wird der Quellenkategorie zugeordnet, aus der sie stammt. Was nicht belegbar ist, wird als Lücke ausgewiesen statt geschätzt.", "gruen") + infoWarn("Widersprüche werden benannt", "Weichen Angaben aus verschiedenen Kategorien voneinander ab, wird das im Bericht kenntlich gemacht – nicht stillschweigend geglättet.", "gruen") + infoWarn("Aktualität", "Jede Prüfung bildet den Stand zum Zeitpunkt der Abfrage ab und wird mit Datum und einer fälschungssicheren Prüf-ID dokumentiert.", "gruen") + infoWarn("Keine Bonitätsauskunft", "Es werden keine Scoring-Daten von Wirtschaftsauskunfteien verwendet. Die Bewertung ist eine geldwäscherechtliche Plausibilitätsprüfung, keine Kreditwürdigkeitsprüfung.", "gelb") + "</div></div>" + "<div class=\"info-warnbox\"><b>Grenzen der Recherche</b><br/>Öffentliche Quellen können unvollständig, veraltet oder widersprüchlich sein – gerade bei kleineren oder außereuropäischen Unternehmen. Ein unauffälliges Ergebnis ist daher kein Nachweis der Unbedenklichkeit, sondern die Feststellung, dass in öffentlich zugänglichen Quellen keine Auffälligkeiten gefunden wurden. Die persönliche Identifizierung Ihres Vertragspartners nach den gesetzlichen Vorgaben kann und darf diese Recherche nicht ersetzen.</div>";
}
function infoKarte(ico, titel, text) {
	return "<div class=\"info-karte\"><div class=\"info-ico\">" + ico + "</div><div class=\"info-karte-t\">" + titel + "</div><div class=\"info-karte-d\">" + text + "</div></div>";
}
function infoWarn(titel, text, farbe) {
	return "<div class=\"info-punkt info-" + farbe + "\"><div class=\"info-punkt-t\">" + titel + "</div><div class=\"info-punkt-d\">" + text + "</div></div>";
}
async function apiPdfRender() {
	document.body.classList.add("api-pdf-modus");
	const fertig = function(fehler) {
		if (document.getElementById("pdfRenderFertig")) return;
		const m = document.createElement("div");
		m.id = "pdfRenderFertig";
		m.setAttribute("data-fehler", fehler || "");
		m.style.display = "none";
		document.body.appendChild(m);
	};
	try {
		[
			"landingGate",
			"authGate",
			"planGate",
			"uploadGate"
		].forEach(function(id) {
			const x = document.getElementById(id);
			if (x) x.style.display = "none";
		});
		const app = document.querySelector(".app");
		if (app) app.style.display = "";
		const mv = document.getElementById("mainView");
		if (mv) mv.style.display = "block";
		const r = await workerCall("api_render_daten", { token: API_PDF_TOKEN });
		if (!r || !r.ok || !r.report) throw new Error(r && r.error || "Keine Daten");
		const d = r.report;
		d._analyseId = r.analyse_id || d._analyseId;
		if (r.abgeschlossen_am) d._abgeschlossen_am = r.abgeschlossen_am;
		if (r.uebersetzungen) {
			const u = r.uebersetzungen.en || r.uebersetzungen.de ? r.uebersetzungen : { en: r.uebersetzungen };
			["en", "de"].forEach(function(z) {
				const m = u[z], c = _trCache(z);
				if (m && typeof m === "object") Object.keys(m).forEach(function(q) {
					if (c[q] === undefined && typeof m[q] === "string") c[q] = m[q];
				});
			});
		}
		setCURRENT_USER_EMAIL(d._email || "");
		showReport(d, d.firmenname, true, true);
		await akteDruckBereit(null, 6e4);
		const w = {
			ordner: false,
			wurzeln: [document.getElementById("report")]
		};
		setDRUCK_SPRACHE(r.lang === "en" ? "en" : "de");
		let erg = { fehler: false };
		try {
			erg = await druckUebersetzungenSicherstellen(w, DRUCK_SPRACHE);
		} catch (e) {
			erg = { fehler: true };
		}
		druckSpracheSetzen(w.wurzeln, DRUCK_SPRACHE);
		if (erg.fehler) druckHinweisSetzen(w, DRUCK_SPRACHE);
		try {
			const neu = {}, cache = _trCache(DRUCK_SPRACHE);
			_trKnoten(w.wurzeln[0]).forEach(function(n) {
				const q = (_LANG_DE.get(n) || "").trim();
				if (q && typeof cache[q] === "string" && _druckBrauchtUebersetzung(q, DRUCK_SPRACHE, druckRegionSprache(n))) neu[q] = cache[q];
			});
			if (Object.keys(neu).length) workerCall("api_render_uebersetzungen", {
				token: API_PDF_TOKEN,
				sprache: DRUCK_SPRACHE,
				texte: neu
			});
		} catch (e) {}
		setDRUCK_TEIL(DT().teile.gesamt);
		druckEntwurfVorbereiten();
		document.title = druckDateiname();
		fertig("");
	} catch (e) {
		const p = document.createElement("p");
		p.style.cssText = "padding:40px;font:16px Arial";
		p.textContent = "PDF konnte nicht erstellt werden: " + (e && e.message || "Fehler");
		document.body.appendChild(p);
		fertig(e && e.message || "Fehler");
	}
}
var UPLOAD_TOKEN = (function() {
	try {
		return new URLSearchParams(location.search).get("upload") || "";
	} catch (e) {
		return "";
	}
})();
var PW_WIEDERHERSTELLUNG = (function() {
	try {
		const hash = (location.hash || "").replace(/^#/, "");
		const p = new URLSearchParams(hash);
		if (p.get("type") === "recovery") return true;
		const q = new URLSearchParams(location.search);
		if (q.get("type") === "recovery") return true;
		if (q.get("code") && !q.get("upload")) return true;
		if (p.get("error_code") || q.get("error_code")) return "fehler";
	} catch (e) {}
	return false;
})();
var EINLADUNG_TOKEN = (function() {
	let t = "";
	try {
		t = new URLSearchParams(location.search).get("einladung") || "";
	} catch (e) {}
	try {
		if (t) localStorage.setItem("cc_einladung", t);
		else t = localStorage.getItem("cc_einladung") || "";
	} catch (e) {}
	return t;
})();
function einladungVergessen() {
	try {
		localStorage.removeItem("cc_einladung");
	} catch (e) {}
}
async function showUploadGate() {
	hideBoot();
	alleGatesAus();
	const g = document.getElementById("uploadGate");
	if (!g) return;
	g.style.display = "flex";
	const bodyFruh = document.getElementById("uploadBody");
	if (bodyFruh) bodyFruh.innerHTML = "<div class=\"up-lade\"><div class=\"up-spin\"></div></div>";
	const lg = document.getElementById("uploadLogo");
	const src = document.querySelector(".auth-card .auth-logo");
	if (lg && src && src.src) lg.src = src.src;
	const sub = document.getElementById("uploadSub");
	const body = document.getElementById("uploadBody");
	try {
		const info = await workerCall("kyc_link_info", { token: UPLOAD_TOKEN });
		if (!info || !info.ok) throw new Error(info && info.error || "ungueltig");
		setUPLOAD_INFO(info);
		uploadSubSetzen();
		uploadRender();
	} catch (e) {
		if (sub) sub.textContent = "";
		if (body) body.innerHTML = uploadFehlerHtml();
	}
}
var UPLOAD_S_FERTIG = {};
var UPLOAD_D_GESEHEN = {};
function uploadRender() {
	const body = document.getElementById("uploadBody");
	if (!body || !UPLOAD_INFO) return;
	if (UPLOAD_ABGESCHLOSSEN) {
		uploadFertigRender();
		return;
	}
	function box(typ, titel, hinweis, kamera) {
		const schonDa = UPLOAD_INFO.vorhanden && UPLOAD_INFO.vorhanden[typ];
		const gewaehlt = UPLOAD_GEWAEHLT[typ];
		if (schonDa) {
			return "<div class=\"kyc-box up-box kyc-voll up-ok\">" + "<div class=\"kyc-plus\">✓</div>" + "<div class=\"kyc-box-t\">" + titel + "</div>" + "<div class=\"kyc-box-file\" style=\"white-space:normal;\">Bereits eingereicht – vielen Dank!</div>" + "</div>";
		}
		if (gewaehlt && gewaehlt.length) {
			const dateien = gewaehlt.map(function(g, n) {
				const bez = typ === "ausweis" ? n === 0 ? "Vorderseite" : n === 1 ? "Rückseite" : "Seite " + (n + 1) : "";
				const vor = g.vorschau ? "<img class=\"up-mini\" src=\"" + g.vorschau + "\" alt=\"\" />" : "<div class=\"up-mini up-mini-pdf\">PDF</div>";
				const dKey = typ + "|" + g.file.name + "|" + g.file.size + "|" + g.file.lastModified;
				const dAlt = !!UPLOAD_D_GESEHEN[dKey];
				UPLOAD_D_GESEHEN[dKey] = true;
				return "<div class=\"up-datei" + (dAlt ? " up-alt" : "") + "\" style=\"--ud:" + (dAlt ? 0 : .04) + "s\">" + vor + "<div class=\"up-datei-info\">" + (bez ? "<div class=\"up-datei-b\">" + bez + "</div>" : "") + "<div class=\"up-datei-n\">" + escapeHtml(g.file.name) + "</div></div>" + "<button class=\"up-datei-x\" data-act-click=\"h138\" data-a0=\"" + escapeAttr(typ) + "\" data-a1=\"" + escapeAttr(n) + "\" title=\"Entfernen\">" + "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M18 6 6 18M6 6l12 12\"/></svg></button>" + "</div>";
			}).join("");
			return "<div class=\"kyc-box up-box kyc-voll up-gewaehlt\">" + "<div class=\"kyc-box-t\">" + titel + "<span class=\"kyc-anzahl\">" + gewaehlt.length + (gewaehlt.length === 1 ? " Datei" : " Dateien") + "</span></div>" + "<div class=\"up-dateien\">" + dateien + "</div>" + "<div class=\"up-btns\">" + "<label class=\"kyc-btn up-mehr-btn\" for=\"upFile_" + typ + "\">" + "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M12 5v14M5 12h14\"/></svg> Weitere Datei</label>" + "<label class=\"kyc-btn\" for=\"upCam_" + typ + "\">Foto aufnehmen</label>" + "</div>" + "<input type=\"file\" id=\"upFile_" + typ + "\" accept=\"image/*,application/pdf\" multiple style=\"display:none\" data-act-change=\"h139\" data-a0=\"" + escapeAttr(typ) + "\" />" + "<input type=\"file\" id=\"upCam_" + typ + "\" accept=\"image/*\" capture=\"" + (typ === "selfie" ? "user" : "environment") + "\" style=\"display:none\" data-act-change=\"h139\" data-a0=\"" + escapeAttr(typ) + "\" />" + "</div>";
		}
		return "<div class=\"kyc-box up-box kyc-leer\" " + "data-act-dragover=\"h140\" " + "data-act-dragleave=\"h141\" " + "data-act-drop=\"h142\" data-a0=\"" + escapeAttr(typ) + "\">" + "<div class=\"kyc-plus\">+</div>" + "<div class=\"kyc-box-t\">" + titel + "</div>" + "<div class=\"kyc-box-file\" style=\"white-space:normal;\">" + hinweis + "</div>" + "<div class=\"up-btns\">" + "<button class=\"kyc-btn\" data-act-click=\"h143\" data-a0=\"" + escapeAttr(typ) + "\">📁 Datei auswählen</button>" + "<button class=\"kyc-btn\" data-act-click=\"h144\" data-a0=\"" + escapeAttr(typ) + "\">📷 Foto aufnehmen</button>" + "</div>" + "<input type=\"file\" id=\"upFile_" + typ + "\" accept=\"image/jpeg,image/png,image/webp,application/pdf\" style=\"display:none\" data-act-change=\"h145\" data-a0=\"" + escapeAttr(typ) + "\" />" + "<input type=\"file\" id=\"upCam_" + typ + "\" accept=\"image/*\" capture=\"" + kamera + "\" style=\"display:none\" data-act-change=\"h145\" data-a0=\"" + escapeAttr(typ) + "\" />" + "</div>";
	}
	const anzahl = Object.keys(UPLOAD_GEWAEHLT).reduce(function(s, t) {
		const v = UPLOAD_GEWAEHLT[t];
		return s + (Array.isArray(v) ? v.length : v ? 1 : 0);
	}, 0);
	const firma = UPLOAD_INFO && UPLOAD_INFO.firmenname ? escapeHtml(UPLOAD_INFO.firmenname) : "das prüfende Unternehmen";
	const erst = !UPLOAD_GEZEICHNET;
	setUPLOAD_GEZEICHNET(true);
	const fertigA = !!(UPLOAD_INFO.vorhanden && UPLOAD_INFO.vorhanden.ausweis) || !!UPLOAD_GEWAEHLT.ausweis;
	const fertigS = !!(UPLOAD_INFO.vorhanden && UPLOAD_INFO.vorhanden.selfie) || !!UPLOAD_GEWAEHLT.selfie;
	function schritt(nr, titel, text, erledigt, verzoeg) {
		const schonFertig = !!(erledigt && UPLOAD_S_FERTIG[nr]);
		UPLOAD_S_FERTIG[nr] = !!erledigt;
		return "<div class=\"up-schritt" + (erledigt ? " up-s-fertig" : "") + (schonFertig ? " up-s-alt" : "") + "\" style=\"--sd:" + verzoeg + "s\">" + "<div class=\"up-s-nr\">" + (erledigt ? "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\"/></svg>" : nr) + "</div>" + "<div class=\"up-s-inhalt\"><div class=\"up-s-t\">" + titel + "</div><div class=\"up-s-d\">" + text + "</div></div>" + "</div>";
	}
	const erklaerung = "<div class=\"up-erklaerung\">" + "<div class=\"up-e-kopf\">" + "<div class=\"up-e-ico\"><svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + "<rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/><circle cx=\"8.5\" cy=\"12\" r=\"2.5\"/><path d=\"M14 10h4M14 14h4M4.5 16.5c.9-1.6 2.3-2.4 4-2.4s3.1.8 4 2.4\"/></svg></div>" + "<div><div class=\"up-e-t\">Identitätsprüfung</div>" + "<div class=\"up-e-d\">" + (function() {
		const abs = UPLOAD_INFO && UPLOAD_INFO.absender ? escapeHtml(UPLOAD_INFO.absender) : "";
		const absFirma = UPLOAD_INFO && UPLOAD_INFO.absender_firma ? escapeHtml(UPLOAD_INFO.absender_firma) : "";
		const wer = abs ? "<b>" + abs + "</b>" + (absFirma ? " von <b>" + absFirma + "</b>" : "") : absFirma ? "<b>" + absFirma + "</b>" : "Dein Geschäftspartner";
		const fuer = UPLOAD_INFO && UPLOAD_INFO.firmenname ? " im Rahmen der Geschäftsbeziehung mit <b>" + firma + "</b>" : "";
		return wer + " benötigt" + fuer + " eine einmalige Bestätigung deiner Identität. ";
	})() + "Unternehmen sind gesetzlich verpflichtet, ihre Geschäftspartner zu identifizieren – das schreibt das Geldwäschegesetz vor (§§ 10–17 GwG). " + "Diese Seite ist der sichere Weg dafür: Du lädst deine Unterlagen direkt hoch, ohne sie per E-Mail oder Messenger zu verschicken.</div></div>" + "</div>" + "<div class=\"up-schritte\">" + schritt(1, "Code abgleichen", "Vergleiche den Bestätigungscode unten mit dem, den dir die Person genannt hat. Stimmt er nicht überein, lade nichts hoch.", false, .14) + schritt(2, "Ausweis fotografieren", "Personalausweis oder Reisepass – gut lesbar, alle Ecken sichtbar, ohne Spiegelungen.", fertigA, .22) + schritt(3, "Foto von dir aufnehmen", "Ein einfaches Foto deines Gesichts. Damit wird bestätigt, dass du die Person auf dem Ausweis bist.", fertigS, .3) + schritt(4, "Verbindlich absenden", "Zustimmung geben und absenden. Danach ist der Vorgang abgeschlossen und der Link erlischt.", false, .38) + "</div>" + "<div class=\"up-e-fuss\">" + "<span><svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/></svg> Verschlüsselt übertragen</span>" + "<span><svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></svg> Dauert 2 Minuten</span>" + "<span><svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><rect x=\"4\" y=\"10\" width=\"16\" height=\"11\" rx=\"2\"/><path d=\"M8 10V7a4 4 0 0 1 8 0v3\"/></svg> Speicherung in der EU</span>" + "</div></div>";
	const dsHtml = "<div class=\"ds-hinweis\">" + "<div class=\"ds-kopf\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/></svg>" + "<span>Datenschutzhinweis für diesen Upload</span></div>" + "<div class=\"ds-text\">Deine Dokumente werden ausschließlich an das Unternehmen übermittelt, das dich zu diesem Upload eingeladen hat. Dieses Unternehmen ist für die Verarbeitung deiner Daten verantwortlich. " + "Die Automati Labs GmbH stellt die Technik bereit und verarbeitet die Daten ausschließlich im Auftrag – auf Servern innerhalb der EU. " + "Grundlage sind deine Einwilligung sowie die gesetzlichen Sorgfaltspflichten nach dem Geldwäschegesetz. Einzelheiten findest du unten bei „Details zur Datenverarbeitung“.</div>" + "</div>";
	const refHtml = UPLOAD_INFO && UPLOAD_INFO.ref_code ? "<div class=\"ref-box ref-box-up\"><div class=\"ref-label\">Bestätigungscode</div><div class=\"ref-code\">" + escapeHtml(UPLOAD_INFO.ref_code) + "</div>" + "<div class=\"ref-hint\">Gleiche diesen Code mit der Person ab, die dir den Link geschickt hat. Stimmt er nicht überein, lade nichts hoch.</div></div>" : "";
	body.classList.toggle("up-steht", !erst);
	body.innerHTML = erklaerung + refHtml + dsHtml + "<div class=\"kyc-grid up-grid" + (erst ? " up-erst" : "") + "\" style=\"margin-top:6px;\">" + box("ausweis", "Personalausweis", "Bild oder PDF hierher ziehen – oder unten wählen", "environment") + box("selfie", "Bestätigungsfoto (Selfie)", "Ein Foto von dir mit Bezug zum Ausweis", "user") + "</div>" + (anzahl > 0 ? einwilligungHtml(firma) : "") + (anzahl > 0 ? "<button class=\"up-senden\" id=\"upSendenBtn\" disabled data-act-click=\"h146\">Verbindlich absenden (" + anzahl + ")</button>" : "") + "<div class=\"kyc-note\" id=\"uploadStatus\" style=\"text-align:center; margin-top:14px;\">Deine Dateien werden verschlüsselt übertragen und sicher in der Akte abgelegt.</div>";
	const cb = document.getElementById("einwCheck");
	if (cb) {
		cb.checked = EINWILLIGUNG_OK;
		einwilligungGeaendert();
	}
}
var EINWILLIGUNG_VERSION = "v2-2026-08";
var EINWILLIGUNG_OK = false;
function einwilligungHtml(firma) {
	const einwAlt = UPLOAD_EINW_GEZEIGT;
	setUPLOAD_EINW_GEZEIGT(true);
	return "<div class=\"einw-box" + (einwAlt ? " up-alt" : "") + "\">" + "<label class=\"einw-zeile\">" + "<input type=\"checkbox\" id=\"einwCheck\" data-act-change=\"h147\" />" + "<span class=\"einw-mark\"></span>" + "<span class=\"einw-text\">Ich bestätige, dass ich die abgebildete Person bin, die Dokumente echt und unverändert sind, und willige in die Verarbeitung meiner Ausweisdaten und meines Lichtbilds zum Zweck der gesetzlichen Identitätsprüfung ein.</span>" + "</label>" + "<button type=\"button\" class=\"einw-mehr\" data-act-click=\"h148\">Details zur Datenverarbeitung anzeigen</button>" + "<div class=\"einw-details\" id=\"einwDetails\">" + "<p><b>Wer verarbeitet die Daten?</b><br/>Verantwortlich ist " + firma + ". Die technische Bereitstellung erfolgt durch die Automati Labs GmbH als Auftragsverarbeiter; die Speicherung erfolgt auf Servern innerhalb der EU (Frankfurt am Main).</p>" + "<p><b>Welche Daten?</b><br/>Das hochgeladene Ausweisdokument (Bild oder PDF) sowie das Bestätigungsfoto, jeweils mit Zeitpunkt des Uploads.</p>" + "<p><b>Wozu?</b><br/>Zur Erfüllung der geldwäscherechtlichen Sorgfaltspflichten – insbesondere zur Identifizierung von Vertragspartnern nach den §§ 10 ff. GwG – sowie zur Dokumentation gegenüber Aufsichtsbehörden.</p>" + "<p><b>Rechtsgrundlage</b><br/>Deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) sowie die Erfüllung einer rechtlichen Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO i.V.m. dem Geldwäschegesetz).</p>" + "<p><b>Wie lange?</b><br/>Die Aufbewahrung richtet sich nach den gesetzlichen Fristen des Geldwäschegesetzes (in der Regel fünf Jahre nach Ende der Geschäftsbeziehung). Danach werden die Daten gelöscht.</p>" + "<p><b>Freiwilligkeit &amp; Widerruf</b><br/>Die Bereitstellung ist freiwillig; ohne die Dokumente kann die Geschäftsbeziehung jedoch gegebenenfalls nicht zustande kommen. Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft gegenüber " + firma + " widerrufen. Gesetzliche Aufbewahrungspflichten bleiben davon unberührt.</p>" + "<p><b>Deine Rechte</b><br/>Dir stehen Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch zu; außerdem das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde. Wende dich dazu bitte an " + firma + ".</p>" + "<p><b>Haftungsausschluss der Automati Labs GmbH</b><br/>Wir erklären ausdrücklich, dass wir keinerlei Haftung für die Authentizität, die Richtigkeit und/oder Vollständigkeit der hochgeladenen und/oder erstellten Aufnahmen übernehmen. Es obliegt einzig und allein in der Verantwortung des Nutzers zu ermitteln, ob die verifizierte Person identisch mit den übermittelten Ausweisdokumenten ist. Jedwede Art von Verantwortlichkeit wird unsererseits ausdrücklich ausgeschlossen.</p>" + "</div></div>";
}
function einwilligungGeaendert() {
	const cb = document.getElementById("einwCheck");
	const btn = document.getElementById("upSendenBtn");
	EINWILLIGUNG_OK = !!(cb && cb.checked);
	if (btn) {
		btn.disabled = !EINWILLIGUNG_OK;
		btn.classList.toggle("up-senden-aus", !EINWILLIGUNG_OK);
	}
}
function einwilligungDetails() {
	const d = document.getElementById("einwDetails");
	if (!d) return;
	const offen = d.classList.contains("auf");
	if (offen) {
		d.style.maxHeight = d.scrollHeight + "px";
		requestAnimationFrame(function() {
			d.style.maxHeight = "0px";
		});
		d.classList.remove("auf");
	} else {
		d.classList.add("auf");
		d.style.maxHeight = d.scrollHeight + "px";
		setTimeout(function() {
			if (d.classList.contains("auf")) d.style.maxHeight = "none";
		}, 420);
	}
}
function uploadFertigRender() {
	const body = document.getElementById("uploadBody");
	const sub = document.getElementById("uploadSub");
	if (sub) sub.textContent = "";
	if (body) body.innerHTML = "<div class=\"up-fertig\">" + "<div class=\"up-fertig-ring\"><span>✓</span></div>" + "<div class=\"up-fertig-t\">Dokumente erfolgreich übermittelt</div>" + "<div class=\"up-fertig-d\">Vielen Dank! Deine Unterlagen wurden verbindlich übermittelt und sicher abgelegt. Dieser Link ist damit abgelaufen und kann nicht erneut verwendet werden.</div>" + "</div>";
}
function uploadFehlerHtml() {
	return "<div class=\"up-fehler\">Dieser Link ist abgelaufen oder ungültig.<br/>Bitte fordere einen neuen Link an.</div>";
}
function uploadSubSetzen() {
	const sub = document.getElementById("uploadSub");
	if (!sub || !UPLOAD_INFO || UPLOAD_ABGESCHLOSSEN) return;
	const neu = "<span>Sichere Übermittlung an die Akte von</span> „<b>" + escapeHtml(UPLOAD_INFO.firmenname) + "</b>“ · <span>Prüf-ID</span> <span class=\"up-pid\">" + escapeHtml(UPLOAD_INFO.pruef_id) + "</span>";
	if (sub.innerHTML !== neu) sub.innerHTML = neu;
}
function uploadPick(typ, kamera) {
	const i = document.getElementById((kamera ? "upCam_" : "upFile_") + typ);
	if (i) i.click();
}
function uploadGewaehlt(typ, input) {
	uploadDateiWahl(typ, input.files);
}
function uploadDateiWahl(typ, files) {
	if (!files || !files.length) return;
	for (let i = 0; i < files.length; i++) uploadWaehlen(typ, files[i]);
}
function uploadDrop(ev, typ) {
	ev.preventDefault();
	ev.currentTarget.classList.remove("drag");
	const fs = ev.dataTransfer && ev.dataTransfer.files;
	if (fs && fs.length) uploadDateiWahl(typ, fs);
}
function uploadEntfernen(typ, n) {
	if (!Array.isArray(UPLOAD_GEWAEHLT[typ])) {
		delete UPLOAD_GEWAEHLT[typ];
		uploadRender();
		return;
	}
	if (typeof n === "number") UPLOAD_GEWAEHLT[typ].splice(n, 1);
	else UPLOAD_GEWAEHLT[typ] = [];
	if (!UPLOAD_GEWAEHLT[typ].length) delete UPLOAD_GEWAEHLT[typ];
	uploadRender();
}
function dateiAlsB64(file) {
	return new Promise(function(res, rej) {
		const r = new FileReader();
		r.onload = function() {
			const s = String(r.result || "");
			res(s.substring(s.indexOf(",") + 1));
		};
		r.onerror = function() {
			rej(new Error("Datei unlesbar"));
		};
		r.readAsDataURL(file);
	});
}
async function uploadWaehlen(typ, file) {
	const st = document.getElementById("uploadStatus");
	file = await dateiVorbereiten(file);
	const erlaubt = [
		"image/jpeg",
		"image/png",
		"image/webp",
		"application/pdf"
	];
	if (erlaubt.indexOf(file.type) < 0) {
		if (st) st.textContent = heicHinweis(file) || "Bitte ein Bild (JPG/PNG/WebP) oder PDF auswählen.";
		return;
	}
	if (file.size > 10 * 1024 * 1024) {
		if (st) st.textContent = "Datei zu groß (max. 10 MB).";
		return;
	}
	let vorschau = null;
	if (file.type.indexOf("image/") === 0) {
		try {
			vorschau = "data:" + file.type + ";base64," + await dateiAlsB64(file);
		} catch (e) {}
	}
	if (!Array.isArray(UPLOAD_GEWAEHLT[typ])) UPLOAD_GEWAEHLT[typ] = [];
	UPLOAD_GEWAEHLT[typ].push({
		file,
		vorschau
	});
	uploadRender();
}
function uploadBestaetigen() {
	const anzahl = Object.keys(UPLOAD_GEWAEHLT).reduce(function(s, t) {
		const v = UPLOAD_GEWAEHLT[t];
		return s + (Array.isArray(v) ? v.length : v ? 1 : 0);
	}, 0);
	if (!anzahl) return;
	if (!EINWILLIGUNG_OK) {
		const box = document.querySelector(".einw-box");
		if (box) {
			box.classList.remove("einw-wackel");
			void box.offsetWidth;
			box.classList.add("einw-wackel");
		}
		return;
	}
	const namen = Object.keys(UPLOAD_GEWAEHLT).map(function(t) {
		const liste = Array.isArray(UPLOAD_GEWAEHLT[t]) ? UPLOAD_GEWAEHLT[t] : [UPLOAD_GEWAEHLT[t]];
		const bez = t === "ausweis" ? "Personalausweis" : "Bestätigungsfoto";
		return liste.filter(function(g) {
			return g && g.file;
		}).map(function(g, n) {
			const zusatz = t === "ausweis" && liste.length > 1 ? " (" + (n === 0 ? "Vorderseite" : n === 1 ? "Rückseite" : "Seite " + (n + 1)) + ")" : "";
			return bez + zusatz + ": " + escapeHtml(g.file.name);
		}).join("<br/>");
	}).filter(function(s) {
		return s;
	}).join("<br/>");
	const w = document.createElement("div");
	w.id = "upWarnung";
	w.className = "up-warn-back";
	w.innerHTML = "<div class=\"up-warn-card\">" + "<div class=\"up-warn-ico\">!</div>" + "<div class=\"up-warn-t\">Verbindlich absenden?</div>" + "<div class=\"up-warn-d\">Nach dem Absenden können die Dokumente <b>nicht mehr geändert, ersetzt oder gelöscht</b> werden. Der Link wird sofort ungültig und lässt sich nicht erneut öffnen.</div>" + "<div class=\"up-warn-liste\">" + namen + "</div>" + "<div class=\"up-warn-einw\">✓ Einwilligung zur Datenverarbeitung erteilt</div>" + "<div class=\"up-warn-btns\">" + "<button class=\"kyc-btn\" data-act-click=\"h149\">Abbrechen</button>" + "<button class=\"up-senden up-warn-ok\" data-act-click=\"h150\">Ja, verbindlich absenden</button>" + "</div></div>";
	document.body.appendChild(w);
	einblenden(w);
}
function uploadWarnungZu() {
	const w = document.getElementById("upWarnung");
	if (!w) return;
	w.classList.remove("an");
	setTimeout(function() {
		if (w.parentNode) w.remove();
	}, 240);
}
async function uploadAbsenden() {
	const w = document.getElementById("upWarnung");
	const karte = w && w.querySelector(".up-warn-card");
	if (karte) karte.innerHTML = "<div class=\"up-lade\"><div class=\"up-spin\"></div></div>" + "<div class=\"up-warn-t\" style=\"margin-top:4px;\">Wird übermittelt…</div>";
	const typen = Object.keys(UPLOAD_GEWAEHLT);
	try {
		for (let i = 0; i < typen.length; i++) {
			const typ = typen[i];
			const liste = Array.isArray(UPLOAD_GEWAEHLT[typ]) ? UPLOAD_GEWAEHLT[typ] : [UPLOAD_GEWAEHLT[typ]];
			for (let n = 0; n < liste.length; n++) {
				const g = liste[n];
				if (!g || !g.file) continue;
				const b64 = await dateiAlsB64(g.file);
				const res = await workerCall("kyc_link_upload", {
					token: UPLOAD_TOKEN,
					typ,
					datei_b64: b64,
					datei_name: g.file.name,
					mime_type: g.file.type,
					einwilligung: true,
					einwilligung_version: EINWILLIGUNG_VERSION
				});
				if (!res || !res.ok) throw new Error(res && res.error || "Fehler beim Senden");
			}
		}
		try {
			await workerCall("kyc_link_abschluss", { token: UPLOAD_TOKEN });
		} catch (e) {}
		setUPLOAD_ABGESCHLOSSEN(true);
		setUPLOAD_GEWAEHLT({});
		uploadWarnungZu();
		setTimeout(uploadFertigRender, 200);
	} catch (e) {
		if (karte) karte.innerHTML = "<div class=\"up-warn-ico up-warn-ico-rot\">✕</div>" + "<div class=\"up-warn-t\">Übermittlung fehlgeschlagen</div>" + "<div class=\"up-warn-d\">" + escapeHtml(e && e.message || "Bitte erneut versuchen.") + "</div>" + "<div class=\"up-warn-btns\"><button class=\"kyc-btn\" data-act-click=\"h149\">Schließen</button></div>";
	}
}
var LP_SCROLL = {
	an: false,
	raf: 0,
	schiene: null
};
function lpScrollInit() {
	const g = document.getElementById("landingGate");
	if (!g) return;
	if (!LP_SCROLL.an) {
		LP_SCROLL.an = true;
		const kopf = g.querySelector(".lp-head");
		if (kopf && !kopf.querySelector(".lp-fortschritt")) {
			const f = document.createElement("div");
			f.className = "lp-fortschritt";
			f.setAttribute("aria-hidden", "true");
			f.innerHTML = "<span></span>";
			kopf.appendChild(f);
		}
		const steps = g.querySelector("#lpAblauf .lp-steps");
		if (steps && !steps.querySelector(".lp-schiene")) {
			const n = steps.querySelectorAll(".lp-step").length;
			const sch = document.createElement("div");
			sch.className = "lp-schiene";
			sch.setAttribute("aria-hidden", "true");
			sch.innerHTML = "<span class=\"lp-schiene-bahn\"><span class=\"lp-schiene-fuell\"></span></span>" + new Array(n + 1).join("<i class=\"lp-schiene-punkt\"></i>");
			steps.appendChild(sch);
			steps.classList.add("mit-schiene");
		}
		g.addEventListener("scroll", lpScrollPlanen, { passive: true });
		window.addEventListener("resize", function() {
			LP_SCROLL.schiene = null;
			lpScrollPlanen();
		}, { passive: true });
	}
	LP_SCROLL.schiene = null;
	lpScrollPlanen();
}
function lpScrollPlanen() {
	if (LP_SCROLL.raf) return;
	LP_SCROLL.raf = requestAnimationFrame(function() {
		LP_SCROLL.raf = 0;
		lpScrollRechnen();
	});
}
function lpSchieneVermessen(steps) {
	const sch = steps.querySelector(".lp-schiene");
	const nummern = [].slice.call(steps.querySelectorAll(".lp-step .lp-step-n"));
	if (!sch || !nummern.length) return null;
	const sb = steps.getBoundingClientRect();
	const senkrecht = getComputedStyle(steps).gridTemplateColumns.split(" ").length < 2;
	const mitten = nummern.map(function(nr) {
		const r = nr.getBoundingClientRect();
		return senkrecht ? r.top + r.height / 2 - sb.top : r.left + r.width / 2 - sb.left;
	});
	sch.classList.toggle("senkrecht", senkrecht);
	const bahn = sch.querySelector(".lp-schiene-bahn");
	const start = mitten[0], ende = mitten[mitten.length - 1];
	if (senkrecht) {
		bahn.style.top = start + "px";
		bahn.style.height = Math.max(0, ende - start) + "px";
		bahn.style.left = "";
		bahn.style.width = "";
	} else {
		bahn.style.left = start + "px";
		bahn.style.width = Math.max(0, ende - start) + "px";
		bahn.style.top = "";
		bahn.style.height = "";
	}
	const punkte = [].slice.call(sch.querySelectorAll(".lp-schiene-punkt"));
	punkte.forEach(function(pk, i) {
		if (senkrecht) {
			pk.style.top = mitten[i] + "px";
			pk.style.left = "";
		} else {
			pk.style.left = mitten[i] + "px";
			pk.style.top = "";
		}
	});
	return {
		senkrecht,
		punkte,
		schritte: [].slice.call(steps.querySelectorAll(".lp-step"))
	};
}
function lpScrollRechnen() {
	const g = document.getElementById("landingGate");
	if (!g || g.style.display === "none" || !g.getClientRects().length) return;
	const H = g.clientHeight || window.innerHeight;
	const ruhig = bewegungReduziert();
	const schmal = window.innerWidth <= 860;
	const fort = g.querySelector(".lp-fortschritt span");
	const max = g.scrollHeight - H;
	if (fort) fort.style.transform = "scaleX(" + (max > 0 ? lpKlemm(g.scrollTop / max) : 0).toFixed(4) + ")";
	const hero = g.querySelector(".lp-hero");
	const inner = hero && hero.querySelector(".lp-hero-inner");
	if (inner) {
		const p = ruhig ? 0 : lpKlemm(g.scrollTop / (H * .85));
		inner.style.translate = "0 " + (-p * (schmal ? 40 : 70)).toFixed(1) + "px";
		inner.style.scale = (1 - p * .035).toFixed(4);
		inner.style.opacity = (1 - p * .55).toFixed(3);
		const wasser = hero.querySelector(".lp-water");
		if (wasser) {
			wasser.style.translate = "0 " + (p * (schmal ? 50 : 90)).toFixed(1) + "px";
			wasser.style.rotate = (p * 7).toFixed(2) + "deg";
		}
		const ba = hero.querySelector(".lp-blob-a"), bb = hero.querySelector(".lp-blob-b");
		if (ba) ba.style.translate = "0 " + (p * 60).toFixed(1) + "px";
		if (bb) bb.style.translate = "0 " + (-p * 40).toFixed(1) + "px";
	}
	const box = g.querySelector("#lpDemo .dm-box");
	if (box) {
		const oben = box.getBoundingClientRect().top - g.getBoundingClientRect().top;
		const p = ruhig ? 1 : lpKlemm((H - oben) / (H * .62));
		const neig = schmal ? 7 : 13;
		box.style.rotate = "x " + ((1 - p) * neig).toFixed(2) + "deg";
		box.style.scale = (.95 + .05 * p).toFixed(4);
		box.style.translate = "0 " + ((1 - p) * 26).toFixed(1) + "px";
	}
	const steps = g.querySelector("#lpAblauf .lp-steps.mit-schiene");
	const sr = steps && steps.getBoundingClientRect();
	if (steps && sr.top < H * 1.6 && sr.bottom > -H * .6) {
		const sch = lpSchieneVermessen(steps);
		if (sch) {
			const r = sr, gr = g.getBoundingClientRect();
			const oben = r.top - gr.top;
			const p = ruhig ? 1 : lpKlemm((H * .8 - oben) / Math.max(H * .5, r.height - H * .1));
			const fuell = steps.querySelector(".lp-schiene-fuell");
			if (fuell) fuell.style.transform = (sch.senkrecht ? "scaleY(" : "scaleX(") + p.toFixed(4) + ")";
			const n = sch.schritte.length;
			sch.schritte.forEach(function(st, i) {
				const an = n < 2 ? p > 0 : p >= i / (n - 1) - .002;
				st.classList.toggle("lp-aktiv", an && p > 0);
				if (sch.punkte[i]) sch.punkte[i].classList.toggle("an", an && p > 0);
			});
		}
	}
}
var LP_VIDEO_AN = false;
function lpVideoInit() {
	const v = document.getElementById("lpVideoEl");
	if (!v || LP_VIDEO_AN) return;
	LP_VIDEO_AN = true;
	v.muted = true;
	v.defaultMuted = true;
	const ruhig = bewegungReduziert();
	if (ruhig) {
		v.setAttribute("controls", "");
		v.preload = "metadata";
		return;
	}
	const spielen = function() {
		const p = v.play();
		if (p && p.catch) p.catch(function() {
			v.setAttribute("controls", "");
		});
	};
	if (!("IntersectionObserver" in window)) {
		v.preload = "auto";
		spielen();
		return;
	}
	new IntersectionObserver(function(e, o) {
		if (e[0].isIntersecting) {
			v.preload = "auto";
			o.disconnect();
		}
	}, { rootMargin: "600px 0px" }).observe(v);
	new IntersectionObserver(function(e) {
		if (e[0].isIntersecting) spielen();
		else v.pause();
	}, { threshold: .35 }).observe(v);
}
function showLanding() {
	setTimeout(function() {
		try {
			lpScrollInit();
		} catch (e) {}
	}, 0);
	setTimeout(function() {
		try {
			lpVideoInit();
		} catch (e) {}
	}, 0);
	if (PW_ANSICHT_OFFEN) return;
	hideBoot();
	const lg = document.getElementById("landingGate");
	if (lg) {
		const schonGezeigt = lg.dataset.gezeigt === "1";
		lg.style.display = "block";
		try {
			demoWahlZeichnen();
		} catch (e) {}
		if (!schonGezeigt) {
			lg.dataset.gezeigt = "1";
			lg.scrollTop = 0;
			setTimeout(function() {
				lg.classList.add("lp-animiert");
			}, 1600);
		} else {
			lg.classList.add("lp-animiert");
			return;
		}
	}
	const asrc = document.querySelector(".auth-card .auth-logo");
	try {
		hintergrundFlaschen();
	} catch (e) {}
	["lpLogo", "lpFootLogo"].forEach(function(id) {
		const el = document.getElementById(id);
		if (el && asrc && asrc.src) el.src = asrc.src;
	});
	const fw = document.getElementById("lpFinalWater");
	const wsrc = document.getElementById("lpWater");
	if (fw && !fw.getAttribute("src") && wsrc && wsrc.src) fw.src = wsrc.src;
	initLpReveal();
	lpPreiseAufbauen();
	lpCountUp();
	applyLang(true);
}
function hintergrundFlaschen() {
	const q = document.getElementById("lpWater");
	const src = q && q.src ? q.src : null;
	if (!src) return;
	[
		"bgFlasche1",
		"bgFlasche2",
		"bgFlasche3"
	].forEach(function(id) {
		const el = document.getElementById(id);
		if (el && !el.getAttribute("src")) el.src = src;
	});
}
function lpSpringe(id) {
	const el = document.getElementById(id);
	const gate = document.getElementById("landingGate");
	if (!el || !gate) return;
	const y = el.getBoundingClientRect().top + gate.scrollTop - 70;
	gate.scrollTo({
		top: y,
		behavior: "smooth"
	});
}
function lpPreiseAufbauen() {
	const grid = document.getElementById("lpPreiseGrid");
	if (!grid || typeof PLAENE === "undefined") return;
	grid.innerHTML = PLAENE.map(function(p, i) {
		const proAnalyse = parseFloat(String(p.preis).replace(/\./g, "").replace(",", ".")) / p.limit;
		return "<div class=\"lp-preis-karte pk-an" + (p.empfohlen ? " lp-preis-top" : "") + "\" style=\"--pd:" + (.04 + i * .06) + "s\">" + (p.empfohlen ? "<div class=\"lp-preis-badge\">Beliebteste Wahl</div>" : "") + "<div class=\"lp-preis-name\">" + p.name + "</div>" + "<div class=\"lp-preis-zahl\"><b>" + p.limit.toLocaleString("de-DE") + "</b><span>Analysen / Monat</span></div>" + "<div class=\"lp-preis-betrag\">" + p.preis + " €<span>/ Monat</span></div>" + "<div class=\"lp-preis-je\">entspricht " + proAnalyse.toFixed(2).replace(".", ",") + " € pro Analyse</div>" + "<button class=\"lp-btn " + (p.empfohlen ? "lp-btn-solid" : "lp-btn-ghost") + "\" data-act-click=\"h151\" data-a0=\"" + escapeAttr(p.id) + "\">" + p.name + " wählen</button>" + "</div>";
	}).join("");
}
function lpCountUp() {
	document.querySelectorAll(".lp-stat b").forEach(function(b) {
		const ziel = parseInt(b.textContent, 10);
		if (!ziel || b.dataset.counted) return;
		b.dataset.counted = "1";
		let t0 = null;
		function schritt(ts) {
			if (!t0) t0 = ts;
			const p = Math.min((ts - t0) / 900, 1);
			b.textContent = Math.round(ziel * (.15 + .85 * p * p));
			if (p < 1) requestAnimationFrame(schritt);
			else b.textContent = ziel;
		}
		requestAnimationFrame(schritt);
	});
}
var DEMO_FIRMEN = [
	{
		name: "Nordwind Handels GmbH",
		land: "Deutschland",
		flagge: "🇩🇪",
		kurz: "Kfz-Handel · Hamburg",
		score: 91,
		stufe: "gut",
		marke: "Geringe Auffälligkeiten",
		kats: [
			["Grunddaten", 95],
			["Personen", 92],
			["Kontakt", 90],
			["Finanzen", 85],
			["Reputation", 88]
		],
		zeilen: [
			["ok", "<b>HRB 118422, Amtsgericht Hamburg</b> – eingetragen seit 2009, Rechtsform und Sitz bestätigt"],
			["ok", "<b>Kein Sanktionstreffer</b> – Unternehmen und beide Geschäftsführer gegen die EU-Liste geprüft"],
			["ok", "<b>Wirtschaftlich Berechtigte ermittelt</b> – zwei Gesellschafter mit je 50 Prozent"],
			["ok", "<b>USt-IdNr. über EU-VIES bestätigt</b> – Name und Anschrift stimmen überein"]
		]
	},
	{
		name: "Baltic Trade Solutions OÜ",
		land: "Estland",
		flagge: "🇪🇪",
		kurz: "Großhandel · Tallinn",
		score: 58,
		stufe: "mittel",
		marke: "Erhöhte Sorgfaltspflicht",
		kats: [
			["Grunddaten", 72],
			["Personen", 45],
			["Kontakt", 65],
			["Finanzen", 40],
			["Reputation", 70]
		],
		zeilen: [
			["ok", "<b>Registernummer 14 882 301</b> – im estnischen Handelsregister geführt, gegründet 2021"],
			["warn", "<b>Wirtschaftlich Berechtigte nicht feststellbar</b> – Anteile werden von einer Holding in Zypern gehalten"],
			["warn", "<b>Keine Jahresabschlüsse veröffentlicht</b> – wirtschaftliche Substanz nicht belegbar"],
			["warn", "<b>Anschrift mit 40 weiteren Firmen geteilt</b> – Hinweis auf Briefkastenadresse, vor Geschäftsabschluss klären"]
		]
	},
	{
		name: "Meridian Motors s.r.o.",
		land: "Slowakei",
		flagge: "🇸🇰",
		kurz: "Fahrzeugexport · Bratislava",
		score: 24,
		stufe: "schlecht",
		marke: "Verstärkte Sorgfaltspflicht",
		kats: [
			["Grunddaten", 55],
			["Personen", 15],
			["Kontakt", 48],
			["Finanzen", 30],
			["Reputation", 20]
		],
		zeilen: [
			["bad", "<b>Treffer in der EU-Sanktionsliste</b> – Namensähnlichkeit bei einem Gesellschafter. Ob Personenidentität vorliegt, muss im Wege der Amtsermittlung geklärt werden"],
			["bad", "<b>Insolvenzverfahren eröffnet</b> – Eintrag im Insolvenzregister vom März 2026"],
			["warn", "<b>Geschäftsführer erst seit drei Wochen im Amt</b> – zuvor vier Wechsel innerhalb eines Jahres"],
			["warn", "<b>Negative Presseberichte</b> – mehrere Meldungen zu ausstehenden Zahlungen an Lieferanten"]
		]
	}
];
var DEMO_SCHRITTE = [
	["Unternehmen im Handelsregister gesucht", "Amtliches Register"],
	["Rechtsform, Sitz und Gründung geprüft", "Register"],
	["Geschäftsführung und Gesellschafter ermittelt", "Register / North Data"],
	["USt-IdNr. über das EU-System abgeglichen", "VIES"],
	["Gegen die EU-Sanktionsliste geprüft", "Konsolidierte Liste"],
	["Presse und öffentliche Quellen durchsucht", "Web-Recherche"],
	["Bewertung erstellt und Quellen zugeordnet", "Auswertung"]
];
var DEMO_AKTIV = 0;
var DEMO_LAEUFT = false;
function demoWahlZeichnen() {
	const box = document.getElementById("dmWahl");
	if (!box) return;
	box.innerHTML = DEMO_FIRMEN.map(function(f, i) {
		return "<button class=\"dm-firma" + (i === DEMO_AKTIV ? " aktiv" : "") + "\" data-act-click=\"h152\" data-a0=\"" + escapeAttr(i) + "\">" + "<span class=\"dm-flagge\">" + f.flagge + "</span>" + "<span class=\"dm-firma-txt\"><span class=\"dm-firma-n\">" + f.name + "</span>" + "<span class=\"dm-firma-s\">" + f.kurz + "</span></span></button>";
	}).join("");
}
function demoWaehlen(i) {
	if (DEMO_LAEUFT) return;
	DEMO_AKTIV = i;
	demoWahlZeichnen();
	const ruhe = document.getElementById("dmRuhe");
	const lauf = document.getElementById("dmLauf");
	const ber = document.getElementById("dmBericht");
	if (ruhe) ruhe.style.display = "";
	if (lauf) lauf.style.display = "none";
	if (ber) ber.style.display = "none";
}
function demoWarte(ms) {
	return new Promise(function(f) {
		setTimeout(f, ms);
	});
}
async function demoStart() {
	if (DEMO_LAEUFT) return;
	DEMO_LAEUFT = true;
	const btn = document.getElementById("dmStart");
	const ruhe = document.getElementById("dmRuhe");
	const lauf = document.getElementById("dmLauf");
	const ber = document.getElementById("dmBericht");
	if (btn) {
		btn.disabled = true;
		btn.querySelector("span").textContent = "Prüfung läuft…";
	}
	if (ruhe) ruhe.style.display = "none";
	if (ber) {
		ber.style.display = "none";
		ber.innerHTML = "";
	}
	if (lauf) {
		lauf.style.display = "";
		lauf.innerHTML = "";
	}
	for (let i = 0; i < DEMO_SCHRITTE.length; i++) {
		const sch = DEMO_SCHRITTE[i];
		const el = document.createElement("div");
		el.className = "dm-schritt laeuft";
		el.style.setProperty("--dd", "0s");
		el.innerHTML = "<span class=\"dm-s-ico\"><span class=\"dm-s-dreh\"></span></span>" + "<span>" + sch[0] + "</span>" + "<span class=\"dm-s-quelle\">" + sch[1] + "</span>";
		if (lauf) lauf.appendChild(el);
		await demoWarte(360 + Math.random() * 300);
		el.className = "dm-schritt fertig";
		el.querySelector(".dm-s-ico").innerHTML = "<svg viewBox=\"0 0 24 24\" width=\"11\" height=\"11\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\"/></svg>";
	}
	await demoWarte(320);
	demoBerichtZeigen();
	if (lauf) lauf.style.display = "none";
	if (btn) {
		btn.disabled = false;
		btn.querySelector("span").textContent = "Erneut starten";
	}
	DEMO_LAEUFT = false;
}
function demoBerichtZeigen() {
	const f = DEMO_FIRMEN[DEMO_AKTIV];
	const ber = document.getElementById("dmBericht");
	if (!ber || !f) return;
	const u = 2 * Math.PI * 32;
	ber.innerHTML = "<div class=\"dm-b-kopf\">" + "<div class=\"dm-gauge\"><svg width=\"74\" height=\"74\" viewBox=\"0 0 74 74\">" + "<circle class=\"dm-gauge-ring\" cx=\"37\" cy=\"37\" r=\"32\" fill=\"none\" stroke-width=\"6\"/>" + "<circle class=\"dm-gauge-wert\" id=\"dmRing\" cx=\"37\" cy=\"37\" r=\"32\" fill=\"none\" stroke-width=\"6\" " + "stroke-dasharray=\"" + u.toFixed(1) + "\" stroke-dashoffset=\"" + u.toFixed(1) + "\"/>" + "</svg><div class=\"dm-gauge-zahl\"><b id=\"dmZahl\">0</b><span>/ 100</span></div></div>" + "<div class=\"dm-b-titel\">" + "<div class=\"dm-b-n\">" + f.name + "</div>" + "<div class=\"dm-b-s\">" + f.land + " · Prüfung gemäß §§ 10–17 GwG · Prüf-ID AL-DEMO-" + (DEMO_AKTIV + 1) + "</div>" + "<div class=\"dm-marke " + f.stufe + "\">" + (f.stufe === "gut" ? "✓ " : "⚠ ") + f.marke + "</div>" + "</div></div>" + "<div class=\"dm-kats\">" + f.kats.map(function(k, i) {
		return "<div class=\"dm-kat\" style=\"--dd:" + (.1 + i * .07) + "s\">" + "<div class=\"dm-kat-k\">" + k[0] + "</div>" + "<div class=\"dm-kat-w\"><b>" + k[1] + "</b><span>/ 100</span></div>" + "<div class=\"dm-balken\"><i data-w=\"" + k[1] + "\"></i></div></div>";
	}).join("") + "</div>" + "<div class=\"dm-zeilen\">" + f.zeilen.map(function(z, i) {
		const ico = z[0] === "ok" ? "<path d=\"M20 6 9 17l-5-5\"/>" : z[0] === "warn" ? "<path d=\"M12 9v4M12 17h.01\"/><path d=\"M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z\"/>" : "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M15 9l-6 6M9 9l6 6\"/>";
		return "<div class=\"dm-zeile " + z[0] + "\" style=\"--dd:" + (.4 + i * .09) + "s\">" + "<svg class=\"dm-z-ico\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + ico + "</svg>" + "<span class=\"dm-z-txt\">" + z[1] + "</span></div>";
	}).join("") + "</div>";
	ber.style.display = "";
	requestAnimationFrame(function() {
		const ring = document.getElementById("dmRing");
		if (ring) ring.style.strokeDashoffset = (u * (1 - f.score / 100)).toFixed(1);
		const farbe = f.stufe === "gut" ? "#359651" : f.stufe === "mittel" ? "#D9A441" : "#C0392B";
		if (ring) ring.style.stroke = farbe;
		ber.querySelectorAll(".dm-balken i").forEach(function(el) {
			el.style.width = (el.getAttribute("data-w") || 0) + "%";
			el.style.background = farbe;
		});
		const zahl = document.getElementById("dmZahl");
		if (zahl) {
			const start = performance.now();
			(function zaehl(t) {
				const p = Math.min(1, (t - start) / 1100);
				zahl.textContent = Math.round(f.score * (1 - Math.pow(1 - p, 3)));
				if (p < 1) requestAnimationFrame(zaehl);
			})(start);
		}
	});
}
function landingStart(mode, paketId) {
	if (paketId) {
		WUNSCH_PAKET = paketId;
		try {
			localStorage.setItem("cc_wunsch_paket", paketId);
		} catch (e) {}
	}
	const lg = document.getElementById("landingGate");
	if (lg) lg.style.display = "none";
	showGate();
	try {
		if (mode === "register" && typeof authMode !== "undefined" && authMode !== "register") toggleAuthMode();
		if (mode === "login" && typeof authMode !== "undefined" && authMode === "register") toggleAuthMode();
	} catch (e) {}
}
var _lpObs = null;
function initLpReveal() {
	if (_lpObs) return;
	try {
		_lpObs = new IntersectionObserver(function(entries) {
			entries.forEach(function(en) {
				if (en.isIntersecting) {
					en.target.classList.add("on");
					_lpObs.unobserve(en.target);
					setTimeout(function() {
						en.target.classList.add("done");
					}, 900);
				}
			});
		}, {
			threshold: 0,
			rootMargin: "0px 0px -6% 0px"
		});
		document.querySelectorAll(".lp-reveal").forEach(function(el) {
			_lpObs.observe(el);
		});
	} catch (e) {
		document.querySelectorAll(".lp-reveal").forEach(function(el) {
			el.classList.add("on");
		});
	}
}
function showGate() {
	setTimeout(function() {
		try {
			paketHinweisAnzeigen();
		} catch (e) {}
	}, 60);
	setTimeout(function() {
		try {
			const reg = typeof authMode !== "undefined" && authMode === "register";
			const nam = document.getElementById("authNamen");
			if (nam) nam.style.display = reg ? "" : "none";
			const verg = document.getElementById("authVergessen");
			if (verg) verg.style.display = reg ? "none" : "";
		} catch (e) {}
	}, 0);
	const lgd = document.getElementById("landingGate");
	if (lgd) lgd.style.display = "none";
	hideBoot();
	alleGatesAus();
	appUnterseitenReset();
	document.getElementById("authGate").classList.remove("hidden");
	setTimeout(appAus, 240);
	document.getElementById("logoutBtn").style.display = "none";
	const hb = document.getElementById("historyBtn");
	if (hb) hb.style.display = "none";
	["infoBewertungBtn", "infoQuellenBtn"].forEach(function(id) {
		const b = document.getElementById(id);
		if (b) b.style.display = "none";
	});
	const tb = document.getElementById("teamBtn");
	if (tb) tb.style.display = "none";
	const kb = document.getElementById("kontoBtn");
	if (kb) kb.style.display = "none";
	const kp = document.getElementById("kontingentPill");
	if (kp) kp.style.display = "none";
	const mb = document.getElementById("mehrAnalysenBtn");
	if (mb) mb.style.display = "none";
	setCURRENT_FIRMA(null);
}
function istTrialFirma(f) {
	if (!f) return false;
	if (f.trial === true) return true;
	if (f.trial === false) return false;
	return f.monatslimit === 3;
}
async function ladeKontingent() {
	if (!sb) return;
	if (EINLADUNG_TOKEN && !EINLADUNG_ERLEDIGT) {
		try {
			await einladungPruefen();
		} catch (e) {}
	}
	try {
		const { data, error } = await sb.rpc("kontingent_status");
		if (error) throw error;
		const row = data && data.length ? data[0] : null;
		if (!row) {
			setCURRENT_FIRMA(null);
			showOnboarding();
			return;
		}
		setCURRENT_FIRMA(row);
		try {
			brancheLaden();
		} catch (e) {}
		setTimeout(function() {
			try {
				brancheAbfragen();
			} catch (e) {}
		}, 900);
		if (row.aktiv && row.monatslimit > 0) {
			clearPendingPayment();
			enterApp();
			updateKontingentAnzeige();
		} else if (isPendingPayment()) {
			bestaetigeZahlung();
		} else {
			zeigePlaene("start");
		}
	} catch (e) {
		console.warn("Kontingent konnte nicht geladen werden:", e && e.message);
		enterApp();
	}
}
function updateKontingentAnzeige() {
	const pill = document.getElementById("kontingentPill");
	const txt = document.getElementById("kontingentText");
	if (!pill || !txt || !CURRENT_FIRMA) return;
	const f = CURRENT_FIRMA;
	const unbegrenzt = f.monatslimit >= 1e5;
	txt.textContent = unbegrenzt ? t("pill_demo", "Demo · unbegrenzt") : istTrialFirma(f) ? t("pill_trial", "Testphase") + " · " + f.verbraucht + " / " + f.monatslimit : f.verbraucht + " / " + f.monatslimit;
	pill.classList.remove("warn", "full");
	if (unbegrenzt) {} else if (!f.aktiv || f.monatslimit <= 0 || f.verbraucht >= f.monatslimit) pill.classList.add("full");
	else if (f.verbraucht >= f.monatslimit * .85) pill.classList.add("warn");
	pill.style.display = "inline-flex";
	const mehr = document.getElementById("mehrAnalysenBtn");
	if (mehr) {
		mehr.style.display = unbegrenzt ? "none" : "inline-flex";
		if (istTrialFirma(f)) {
			const rest = Math.max(0, f.monatslimit - f.verbraucht);
			mehr.textContent = rest > 0 ? "Bereit für ein Paket?" : "Jetzt Paket wählen";
			mehr.classList.add("mehr-trial");
		} else {
			mehr.textContent = "Mehr Analysen?";
			mehr.classList.remove("mehr-trial");
		}
	}
	kontingentHinweisPruefen(f, unbegrenzt);
}
function kontingentHinweisPruefen(f, unbegrenzt) {
	if (unbegrenzt || !f || !f.aktiv || f.monatslimit <= 0) return;
	if (istTrialFirma(f)) return;
	const rest = f.monatslimit - f.verbraucht;
	if (rest <= 0) return;
	const anteil = f.verbraucht / f.monatslimit;
	let stufe = null;
	if (anteil >= .95) stufe = "95";
	else if (anteil >= .8) stufe = "80";
	if (!stufe) return;
	const monat = new Date().getFullYear() + "-" + (new Date().getMonth() + 1);
	const schluessel = "cc_kont_" + monat + "_" + stufe;
	try {
		if (localStorage.getItem(schluessel)) return;
		localStorage.setItem(schluessel, "1");
	} catch (e) {}
	setTimeout(function() {
		zeigeKontingentHinweis(rest, f.monatslimit, stufe === "95");
	}, 1500);
}
function zeigeKontingentHinweis(rest, limit, knapp) {
	const t2 = document.createElement("div");
	t2.className = "tr-toast tr-toast-klick kont-toast" + (knapp ? " kont-knapp" : "");
	t2.innerHTML = "<button class=\"tr-toast-x\" title=\"Schließen\">✕</button>" + "<div class=\"tr-toast-t\">" + (knapp ? "⚠️ Kontingent fast aufgebraucht" : "📊 Kontingent zu 80 % genutzt") + "</div>" + "<div class=\"tr-toast-d\">Noch <b>" + rest + "</b> von " + limit + " Analysen in diesem Monat verfügbar." + (knapp ? " Danach ist keine weitere Prüfung möglich, bis der Monat wechselt." : "") + "</div>" + "<div class=\"tr-toast-cta\">Größeres Paket ansehen →</div>";
	function weg() {
		if (t2.dataset.weg) return;
		t2.dataset.weg = "1";
		t2.classList.remove("an");
		t2.classList.add("weg");
		setTimeout(function() {
			if (t2.parentNode) t2.remove();
		}, 340);
	}
	const x = t2.querySelector(".tr-toast-x");
	if (x) x.onclick = function(ev) {
		ev.stopPropagation();
		weg();
	};
	t2.onclick = function() {
		weg();
		setTimeout(function() {
			zeigePlaene("upgrade");
		}, 200);
	};
	document.body.appendChild(t2);
	einblenden(t2);
	setTimeout(weg, 12e3);
}
function kontingentVerfuegbar() {
	if (!CURRENT_FIRMA) return true;
	const f = CURRENT_FIRMA;
	if (!f.aktiv || f.monatslimit <= 0) {
		zeigePlaene("start");
		return false;
	}
	if (f.verbraucht >= f.monatslimit) {
		zeigePlaene(istTrialFirma(f) ? "trial" : "voll");
		return false;
	}
	return true;
}
var PLAENE = [
	{
		id: "bronze",
		name: "Bronze",
		limit: 100,
		preis: "299,99",
		empfohlen: false,
		tagline: "Für kleine Teams & den Einstieg",
		tagline_en: "For small teams and getting started",
		features: [
			"<b>100 Analysen</b> pro Monat",
			"Voller Funktionsumfang",
			"Alle Funktionen inklusive",
			"Geteiltes Team-Kontingent",
			"Support per E-Mail"
		],
		features_en: [
			"<b>100 analyses</b> per month",
			"Full range of functions",
			"All features included",
			"Shared team quota",
			"Email support"
		]
	},
	{
		id: "silber",
		name: "Silber",
		limit: 300,
		preis: "999,99",
		empfohlen: true,
		tagline: "Der Favorit für die meisten Kanzleien & Händler",
		tagline_en: "The favourite for most firms and dealers",
		features: [
			"<b>300 Analysen</b> pro Monat",
			"Voller Funktionsumfang",
			"Alle Funktionen inklusive",
			"Geteiltes Team-Kontingent",
			"Support per E-Mail"
		],
		features_en: [
			"<b>300 analyses</b> per month",
			"Full range of functions",
			"All features included",
			"Shared team quota",
			"Email support"
		]
	},
	{
		id: "gold",
		name: "Gold",
		limit: 600,
		preis: "1.999,99",
		empfohlen: false,
		tagline: "Für wachsendes Prüfvolumen",
		tagline_en: "For growing screening volumes",
		features: [
			"<b>600 Analysen</b> pro Monat",
			"Voller Funktionsumfang",
			"Alle Funktionen inklusive",
			"Geteiltes Team-Kontingent",
			"Support per E-Mail"
		],
		features_en: [
			"<b>600 analyses</b> per month",
			"Full range of functions",
			"All features included",
			"Shared team quota",
			"Email support"
		]
	},
	{
		id: "platinum",
		name: "Platinum",
		limit: 1e3,
		preis: "2.999,99",
		empfohlen: false,
		tagline: "Für hohes Volumen & Unternehmensgruppen",
		tagline_en: "For high volumes and corporate groups",
		features: [
			"<b>1.000 Analysen</b> pro Monat",
			"Voller Funktionsumfang",
			"Alle Funktionen inklusive",
			"Geteiltes Team-Kontingent",
			"Support per E-Mail"
		],
		features_en: [
			"<b>1,000 analyses</b> per month",
			"Full range of functions",
			"All features included",
			"Shared team quota",
			"Email support"
		]
	}
];
var STRIPE_LINKS = {
	bronze: "PLATZHALTER_STRIPE_TEST_LINK_BRONZE",
	silber: "PLATZHALTER_STRIPE_TEST_LINK_SILBER",
	gold: "PLATZHALTER_STRIPE_TEST_LINK_GOLD",
	platinum: "PLATZHALTER_STRIPE_TEST_LINK_PLATINUM"
};
function planMsg(text, type) {
	const m = document.getElementById("planMsg");
	if (!m) return;
	if (!text) {
		m.classList.remove("show");
		return;
	}
	m.textContent = text;
	m.className = "auth-msg show " + (type || "");
}
function zeigePlaene(grund) {
	hideBoot();
	alleGatesAus();
	document.getElementById("loading").classList.remove("active");
	const lg = document.getElementById("planLogo");
	const src = document.querySelector(".auth-card .auth-logo");
	if (lg && src && src.src) lg.src = src.src;
	planMsg("", "");
	const title = document.getElementById("planTitle");
	const sub = document.getElementById("planSubtitle");
	const back = document.getElementById("planBack");
	if (grund === "voll") {
		title.textContent = t("pl_voll_t", "Mehr Analysen gefällig?");
		sub.textContent = t("pl_voll_s", "Du hast dein Monats-Kontingent ausgeschöpft. Wähle einen größeren Plan und leg sofort wieder los – sonst setzt sich das Kontingent erst zum Monatsanfang zurück.");
		if (back) back.style.display = "";
	} else if (grund === "upgrade" && istTrialFirma(CURRENT_FIRMA)) {
		title.textContent = "Bereit, richtig loszulegen?";
		sub.textContent = "Du bist gerade in der kostenlosen Testphase. Wähle dein Paket und prüfe ohne Begrenzung weiter – deine bisherigen Analysen, Ordner und Akten bleiben selbstverständlich erhalten.";
		if (back) back.style.display = "";
	} else if (grund === "upgrade") {
		title.textContent = t("pl_up_t", "Brauchst du mehr Analysen?");
		sub.textContent = t("pl_up_s", "Wechsle jederzeit in ein größeres Paket – das neue Kontingent gilt sofort. Deine Analysen, Ordner und Team-Einstellungen bleiben natürlich erhalten.");
		if (back) back.style.display = "";
	} else if (grund === "trial") {
		title.textContent = t("pl_trial_t", "Gefällt dir der Compliance-Checker?");
		sub.textContent = t("pl_trial_s", "Deine 3 kostenlosen Testanalysen sind aufgebraucht. Wähle jetzt dein Paket und prüfe sofort weiter – deine bisherigen Analysen und Berichte bleiben selbstverständlich erhalten.");
		if (back) back.style.display = "";
	} else {
		title.textContent = "Wähle deinen Plan";
		sub.textContent = "Alle Pakete enthalten denselben vollen Funktionsumfang – sie unterscheiden sich nur in der Anzahl der Analysen pro Monat.";
		if (back) back.style.display = "none";
	}
	renderPlaene();
	document.getElementById("planGate").style.display = "flex";
	document.getElementById("planGate").scrollTop = 0;
	const appEl = document.querySelector(".app");
	if (appEl) {
		appEl.classList.remove("app-enter");
		appEl.classList.add("app-leave");
	}
	setTimeout(function() {
		const gateOffen = document.getElementById("planGate").style.display !== "none";
		if (!gateOffen) {
			if (appEl) appEl.classList.remove("app-leave");
			return;
		}
		appUnterseitenReset();
		appAus();
		if (appEl) appEl.classList.remove("app-leave");
		const kp = document.getElementById("kontingentPill");
		if (kp) kp.style.display = "none";
		const mb = document.getElementById("mehrAnalysenBtn");
		if (mb) mb.style.display = "none";
		window.scrollTo({
			top: 0,
			behavior: "auto"
		});
	}, 480);
}
var PLAN_LOGOS = {
	bronze: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGgAAABoCAYAAAAdHLWhAAAhBklEQVR42u19e5xdVX3v97fW3uc1k8wrr5kkQxJITEJ4xgAWLB+vVhAF1EuvVKxWSFGRolet9qGlldtbH6gUBcHWqtfS+2mp+KjYolVrhJqKgQAxgQB5Z/KayWRmzplzzt5r/b73j73P5MzkQSaZk4ze7PNZnzmzzz5r/dbvt37v31pHBr/zfpy+Ju8VkDyNhclNoEkBhwFgTPP0SQGNFvcJAE3baQ6qIcMP7T3NMpOMQCYlzlyx4YepfjaoACDp5wKg0QDWj0GIgRi7kz7+FIDtdTCeIgKdOuKkRJAswG9LkL0ALqqjzam6CAQZ0MeXAXIJwPgkLZRJx0GpnGe3iLnAV4aqdZ/ZOqTU64OJQFStD5M21t3zAABXhYg5n9RuAM/XPff/FYEYTl8k8b6NO0j/rMk2L2bKQfTRKHyIWAsTTLDWcyD9KLqJzQQAIUEGWi0+C2BHCiNPnYg7hQSK9j5nAJQBXKtR5aOg7yRVAFwiYppIVRFrVN1OqHt2glZyjSMXi9jZpFcRY0gt0VVWixhS/W6SdwAopzCeQh10ao242sQ30sdvr7v/NIw9h6pOgkyGcfkbAN43wWP/tQSZ2xiXHYzNUHUTgNeQh1jXp9TUnixmtgmmzBA3tJcj1h0JjjSEAA2AAIA70TknfUhY6z8dq6aTUAfLaT+otkrjwT1jBGA9gZR1hoJOANcqQI4h0Ai3HALL6UjC4a1d1rWGDFHru4FjnDCBJitkIyu7gdir9U1OXgpN3mBpHfuwgSzERrPpr3Ak4SVF3Iioa6QYxalyQX/FOUhwiAJvGAeNjHWaQMcnfk6GiJvEBJrcVlxDLaxfBStusnNQI8XPSRGjv+4EYgORx9Mi7rSjepqDfv05aPKyUBoobSCBan1PZgJNVi+NSSiGtXBPozgo9VYnKx4msQ5KuQdsnA6q9U2e1kHHr4NOgog7rYNOGwm/NiKu0LVEhns28KCZ3UARV+s7pdHI2Kc56MjEKe1cTwDhwTgZGhiLGyXiwtLO9ZOOSJOGQJnWTlvaud4DeLPY8Cx1kQIQJlcjqhlH+qaLVGx4Fn385tLO9Q9lWjttdGCXnwx4MRzjsZ+KVuhaIr46TAlzrQQ+T9KmnxlVLyT+lQQyLbN4omPV9fGvad8pDmgJfF7CXKuvDrPQtUQmA27kmXveOik4GUm1zt/YbGGlrw57ALCZvPVR+RsArkNSbTpRq7rW14M2k7/OR+VkvGzB+urwlwGsxMRUEE0AB+HUvjItsyxBR/DVYsOVrlryBAVixEeVfgJ/0DR7iRx0WSfkxaRP3OajSj/ECEFx1ZKXIHMTwVcTdClsp/R1SkVcU9dSIQibm5oncR+pJCEkVIKMUeqHSO6KivsNCZ3AsTXpk7uU+kEJMrX+hepJ4j6bm5qvHNiVwHgKcWTf/bplp4x9o8F9gasUvcbVv7KZwht8XFUAsGEu8FH53wF8INvaaasNUNiuUmS2tdO6ytAT6uPLbJg7S71TqtJmCtNcpZgF8Eg0uC/AKSxglCfvfsupGrumB1YYG6ym9yQoIoYQUwV4LtVvwsFa6oaIeAAUYxcA8jSoWVJFIBRrRb27BMDjE6z/fiXMbMm1dkGsDcp9279EGKOMFYCaMBv4aPhjAF48CYpaAQT07kUAH7OZwmc0GnYEjUFoSH4p3zF3Bb1n5UDPKdkjZG++8uxTsjBcZcjHw4N/ZLOFG3xU8QBggkzg48rPAfx+rq3TuHLxZIgW5to6rSsXV6uPrzRBppvqlerVZgtd0VBf1VWGVqWL5aSLOlnzud8+uZRpajWudEABLBETPElqAKpAhGICpY9XAHjqJIuV2ljniQ0fpzoDUiCGIsZR3QUANtTBfjId1dFByUY3E+YlfX8/jM1SPUiqCfNWXfRJkk+RDEj6kwiXT8d8Sl30SRPmLUlSPWBsluT9Y2A/ac3+/muXnrTVkG3rtNX+XR7ALTZbeI+Pyg6AkSC0GlXWQ+SGbGsn8tPO0OrAvnH1PWXu2QITWJubYvLTzsBxfJ8wgXXl4qPq4jdLEM6kKuidt9nCfHXxPlce+nk2EYcnTRedTCPBhM3tWjmwpxvgJ1xUUSR7cpgGK98FsgrADm5bd6xAmVx7lwDA4LZ1viYSK/t7kGvvsun7Y9rnM7htHXPtXWACw7tArmKCHOOiikLkE4B8N2xu317Z33PSdt3Zla9dclKok2vrMqU9Lyqof2+C3Dn0UeLzZJqsxpV7ANwHIHDlIX9UgrR1GVcZslPmLmN1cC9deYiuPEQArWKCNwBytmSyPXFxfzm9zylzl0l1cG+Qa+sSVxk6ojWWPh8A2EL102ym6RL1kYIKE+Ry9NHC6sDef0hhOCkrW1Z/+s0ngTidtpKItrfaTP6BEdFmA6F328QG59C74RRxnDp3Gcp9O8Rm81Lp3yW5tk6m3x/Dktm56uJXCvB6gv/NBJlZgEBdtBvgj0XMw2KDVRpXtx8BJsm1ddJXy8x3zOHg9nVI/S4RGxTo3TNig256RwBqM/nAR+UbAPxD3ZwaS6CffepNDRdtACA2aKf368XYDqoDAJowazWuvh7A9wBkAMRH9TXEzBFjzwX1Uqr+JoALTJhtEhGoj0FVnzxmrLEhSELjagkiTwL4qYg8RvIpUHccDScAQgARgKtMmH1Y46oHIGICUH2fWLuU3u2v86V+pXWQAeDo4rtspjDdR7VIdcH6aPiBlDhIEQIxQSg2aNW40gkx8wEsBnAOgGVQPUtM0CRBFlAPegcfV316OolJzWVQPdXFCjEQMU1ig8vE2MvoHeijEkReAPhLEM9AZIOI2Sw22EXvDlBdXIMFwPd8VHnAZgo3+GjY08dI53AXgLedDN9IHvvEGxsn2tq7bGV/jz90JVqQ2gdyWUv3sn0D29b9sQkzl2octQOYAaADYlpMEEKMRYp0UB2gVFJrh1qY9C/y7bMx/ezLAQD7fvkTlPfvrMubQgFQxBgYMWKCUf2qiwHqAIA+AHtNmNmvcfRYS/eyvxra9fw0ddEvRUwHEwYdxfl1c2wMgR79q2sb0nHLGefIcO92cZVSE9U9Iybopo8TWZ7NB76ayPL08UfDptZLXaUIQCACqPcJ9g6KvBoxJM0VoWnWArQvWI72RZcg3941avxyfw/2P7ca+zetQWn3JvioXE+westOIMYaa9PaByLINSMuHXgMwGXpM2+12fwDvlrTnaFQ3TYxwTlBrqlUmDaXA1ufaYgokp/+72sanYT7vM023eqrpfok3HcBXJ3qnQjAwybMXpFyWFBPCAAIcs3ITp2G/LS5mNK5EFPnLkXzrDMhYgAAxV3PY9+Gx9D33M8AAB0vewWmL7kUzZ0LE4pQUdz9Iga3r8fQrudR7t2O6mAvkgWBsYRzKYc8AuD1dTD+i83k33AwuddkfbV0D4BbGxkzlFV/OfEEyrd32XLC9peZIFilzmki2gxIlsTYZVPnLNk+sPWZIDUM/s1mclf4qOLFWjvv8t9F0/RuZKZ0INPcjrAwdTR39O3EwLZ16N/8JAZ3bEBUPHBYODLNrZg6Zwna5l+Aqd1no9AxZ9Tn8fAgouJ+REN9KO3bhi0/+TrovbeZnPVR5REAVwIIW844xw1u/+VckutEpCmRsKAJAqPO/SaAR+vmPOmNBEkLarMg708ScBQAasNs4CrDf0TVbQe2PB3kO7q03NdzcPmSyE7pwJxL3gQfVTC8bysGtq9Hpb8Hpd7tGN63DeX+XXDl4pgRBWIMUmMBEAOqojrUj30b/hP7NvxnMtl8M/JtnShM60Zh+lzk27qQbW7D1Llno+3M5eh54nuo9O8ZgQUA8h1demDL0xbANgB/ZHOFe1xl2CVhMgjJ+yFyIUGXzpMTS6CJj6Db4b6dDsCfB9mmpa4m2sJcEFdKPwVwb759ti3v3+nJJOWeiKGkFFe9B6nY8pOvY8fPv3NESzghSK00S0GvY7II6XMigAioirg8hLg8hMGejaN6m3PRNVjwmpuSsXGw5LgOLp/CfG9cKV1vw9wrfVzx3kU+neNHh/t2fqwRom6iOcimAJ5nbPiRuFLySJNw3sVVku8CAFcp1Y75GFmp9QFCEQOYIAmu2gxY44z0Lw8hyBEzCaOKHms6C+lfEQP1EWACiJhDApU1CpFkCjMAvMu7+ElAAlIlrpS8scFH1Mf/3Igo/ETWJEi+bTbSMqb7ISas0cCEOave3UFiA4mgWuw/pL5gpIB9FGIAVQ/1LmmqUNUThJOgamJeqz/smCOF+3UthTkgsUG9+7gJczalHZK54n4SJsXBhNUxTGS6wZb6dniS77eZwsUuqjiSYoKMjSultYXp3Z/Mt3fZUWkE1H0fo8t8OYarTrQBKbFVR/6OcC5wUJyNgmUMjKTPt3fZwvTuT8WV0loTZCxJcVHF2UzhYpLvT3FgJwruiRJxBoAXY88EcIerDnuSBiJU75XkzcU9W1zK/iMD8nAiDqNEy4SU/ooYqCrmrHgDZp3zKgzv78Hz3/8bxMODBykDjCXGITACYKl3B1IxfrN6vzpRUTSuOuzF2DtIfjutpZiQiPeEiLh8+2whQfX+i2LDQiqGaDN56138WRKPp+LBH1X01O0VJQ69f1yVmcYmxLnoGrzsqlvQMncJOs97NZZc8/6Dz43ioJcc06dzedy7+LM2k7eJ1FTABAX1/j4STHFy6kVcvr3Llnp3eJI32kz+t1y17EiK2MDE5dILJG/Pt3fZtnnnvESGdMxq5YmLODEW3jm0LzgfL3vdu0FNdBm9w5TOsyA2GOHS0YbK0cdum3eOT8X17XG59ILYwJAUVy07m8m/huSNpd4dtWdOLAN9gh2Y7JQOJdAJyJ0uqihJk2pOIfluksMA0LfpKR5OLxxJX9RvfzwunWMMvIuRa52Fc377TxIrRixEALEB9q5/DD6ORonVI8Iy5l7fpqeY3h8m+e50riSZJPcgdxLozE7pqOHjRAh0AkXvHbOlb9NTpPJuE+ba1CdMEmSbrIuqXybxQxJBcd8O/1JibayIG3sKSHI/9WleAi6IQJ2H2AAXvu0vEOabR0ppxQQ4sH0DNjz8xZG+6tTeUeGqb+mcAhI/dFH1y0G2yaZinibMtVF5d9+mp1joODFRd9y12YWOLlvs3eEJvtFmctfF1ZIjKGKsiSulHgB/mGluNe3zz/VHrpCuf19zDlkXGKszHESg1NT6quOyMS+AoCbvz7/+z9A0vRu14LeIQWWwF098/c/SPi1Gb1EeDcshMI55tc8/12eaW43N5D4UV0o9YqwhKHG15Gwmdx3BNxZ7d/hCR5c9gdrs8bNd+7xzpdi7gyQLJD/rXcyaaBMbiFL/QKn9NlOQ3k1reSx6h3Xb7uutuJqOUPXItczAlFlnQkkoE6QfIpLEQKlYfOXNmP6yi0D1EJNEYNTFeOLvb0d1eCBxTJOKooNWHHEYsXpkfdS7aS1tpiBxdfiAUv9AbDAi6lKcfJZkodi7g+3zzpWTJuJ6Nz1l02LzlUG2ab53sSZWW8HG1fI3SDxEIij27vBH7QuHEyUcZcUlCCfmLH8dXvm+v8Wl770Xy9/2FwAk5aaDIk/EwnuPOcuvxLxL/3tKHAuqQsTg6YfuxIGdz488d6gVx0PFGo5uRaZzDEg8FFfL37CZgiVB72INsk3zSawkoSnOTooVJ6mzmSf5QRdV0hCIiKuWhyDy/vb55wrTrQpHVeTEUay45L13MUyQweIrboINs6B6zFj8Clx04yeTbQp14st7h7bus7Hs2veBVIgxI0R64ccPYOfaH408NxoOHtGKO0ZrUtvnnysQeb+rlodSowEpbj6Q4sqnuBsfBx2H5rLpt68NMvludbGCpM3kDNXfQ+939L241iYBs6P3xcPeO+gHjQq5pDE4iIDeoWPB+bj4pk8nCEzDQdkp7Vh+w+1ptjQJkIqx2LXup3ju+19JuM67Q8av94OOBcbDNO17ca2l9zuo/h6byRmQVBdrkMmfAfLaFGd2vPget4jLNLfV4mgrVVMmEWPjSqkIE9zdvuA8Ob69PKOjyKhzNH1UwbOPfDkJdpKJ/6IeHWeej4tXfnqkjxXv+EtkmlvT4GriBw30vIA1D3z8qBbZwSF5Is6xti84T2CCu+NKqUgxNQeWqZirx90xt/GGekxlcL8CmA+RV7qoIiARhFlxleGHqPGu8kCv5egfRTharLnO1xgbi0s+U+9BEWxd/V3YIIuzr75lhDOoHtPOPB8r3vG/4KMyWrrOSiw2SdIM1eIB/Pwrf5o+b1Jrrh4AjvGDDqcLj/kMBS0P9Fp18S4ADwW57NtdZRguqgiAV4KcXxncv3m8IaBxEyjt/KogW8i4SskBMN45kPwakp3Txxw7O6wz6H2aEQgOHnTkPcQYvPjTfwYBLLv6loMGABUzl1wy0ocYGYlYP/7121Ee2AexQSLaDpuOSHwjAKD3LxWLO5b5CES+5p17O0kD0gW5poyrlK4CcE+jCVR7+Mok3kaKDY2PKtsg5jFQWdy7/ZgHr1uproaIqDwEqke+dcZoJe0Tx/PFVQ8CJJZd896UM2QkX1QzncVYrP3Gnejb9HRCHBcfcTYkk7HUJ2MfJJAbA+NLXuncCchjPqpsExt208c+xdUVKYHYqGCpkPCZ5tYmEit8XE3MwCAEiR9Rtdo0bY49dr0KFPdur3nZ/bWggatWUOzdibYzlqb5oIO2hjoHGIsXVv0znvnOPXViS9Lkm0sstlX/hC2rHwaMhTp3xPFrfbedsRTF3p1w1Qrq0lP9Y2A8lsamaXMsVaskfpTiBimuLjJhtikNtsqERxKaps0xBFEtDiyBMTPVOxKp2Qj+iCCG9m2X4/SYX0hXHghiz4bVmDprAbJTOxJnUg569uodYAxeWPUgnv72FyDGIqksdTA2wO4Nq/HMd+5N6qpqKezDvSSx/rJTOzB11gLs2bA61UVS004vHM9M6nDwoxQ3ot4Rxsz0cbSkHpcTGkkY2rdNSELVn2uC7MiemrgyrCTX1PyB8dj4TdPm1KIMj3vvRVUNSWxb832ICM5Y8bqR6ED999Q7QCxeWPUgnvrm3VAXw9gAfZvXYfVXP1anP/TIPlja5xkrXgcRwbY130/6VjXeeyH58zEwHmur4WBNXC1rba+TCbJQ9efW4/IYE3bjziEtTZeYmkT57sk2t22uFvsxXvmamzpNh/ZuByA/c9VyvxjbRvXs3/G89G1eh4Wvuh7P/+RBuKgMiIw6WJTeQcTghZ9+A7uf/Tlyza3o2/LLxEFNE3RHyeCBziHI5LHwVdejb/M69O94HgAoxhhXLfcDshpgHYzj1tNbQN1jbNCp3mmKs6XHkbAb92pfoLUYlliQ3FIZ2l+edub5tTjUMa+2vc8/kchsaj/Jh02YASCeJNZ+626EuSac96bbDstFKTcDEAzt3YZ9m55OagzS1PZRIxhpX+e96TaEuSas/dbdKdeJN2EGJB8mtb9p2hy79/knxstBTHExTHJLiqMaTAvGy5XHTKBcy7Qa63amVkkarud2kigf2Hdcgde6oOjdPo6h6gVisH/rBmz8j3/EvIuvQvfLr4C6eMT0PhyRRmJyqi+RxEusuu7lr8W8i6/Cxv/4R+zfuiGJ+akXH8cgefcY2MbV6nCxI8VRapCwcwwuJyxYKns3PsHpZ10gJFo1DTSm+ZS9JDA4PmtnpA3u3e5JWBKP+zh6KMgWrHrvSGDtN7+A3k1P46Ib/hQzFi6HHyHSodaYjhDmaOnvAN7FmLFwOS5620fRu+lprP3mF5I+vHdBtmB9HD2UpuhtCtvxzKmGiz21nFOKs9YaLhsSLN2//bkwCfzVI4ODE1C9khKfH4yrlSLEmKRr4idf/BAG92zB5e+9CzMXXwTv4kQfjaPqp6Z3vIsxc/FFuPy9d2Fwzxasuu9DtSoeQozE1UqR5AdTWDgB8xo8GJ1QpEHTsC7oPLEpb0AMSUsddT+egIno8IG9huQW9e62JPCqDmIQV0r44eduwUDPJlz+ns9gwW9cA/VJ2VQSSXjpugRVhXqPBb9xDS5/z2cw0LMJP/zcLYjKpVqZsLOZnFXv3kdySwqLnvC8UI+b5MizMN9sGpYPUlUl4cdU3IQTUb0yuGd7La/ylWi4eG9YmBKq97EYi0pxAI/cuRK71q/Gius/jItu+BOYIIR3LqkSFXOYtLcZKRoxQYiLbvgTrLj+w9i1fjUeuXMlKsWBhHjex2FhShgNF+8l8XckghSWEy88VIRjckw+xWFjUt5tcxbFBMujIr/g1Ak8fss3z5hjZyy84NaoNPRQmG8OvXcxROCiCn587wew7l+/ggWXvB5X3/4gZi1ekRYhJrG62qYVMQaqHt47zFq8Alff/iAWXPJ6rPu3r+DH934ALqokIs+7OMw3h9XS4DdnLLzg1uYZcyxBP4HzaRlV5w2WUxxOeMqbMxZeKLs3riHJ/uRXNFlLGXeSxJTpcydCZjPfMl13b1wjSn1LVC5+M8w3h6reIS2zfeq7X8IPPvseeBfjVbfehctuvAOFtpnwdaXB3jsUWmfi0nfegVfdehe8i/GDz92Cp/7lS7X4HlW9C/PNYVQufpPkW3ZvXCP5luk6EbqnDhezRtLqCc76d29cwxkLLzxmHXfMwdLh/r0mTSMcNB2T6O88AMi1TNOBPVtPuER193O/4MxFywHA79m45rq4XLo/zDWvjMtFJUhjArPnhSfx7T//bZx71U0456ob0X3hq7Hhh/8X6/7tawCAZVe8HUtek5wk+cz3/g7PfO/voOpgTADVxGkM881BNFz6MulvnrloOWtjT0SZ7cCerTUveX6Ko5pLsmMMLl+6Kvb/vPvice2YE8jHw3zTx6JyMRZjQqoOADgTQN+sRctl98Y1EzLJWYuWCwDs3riGAnzYBOEnAIh3sRNjglpup7mjE+df827Mv+iKkXyPGIPNjz+Ctd++D8W+XSP3qOpsEAYAoN59hOSnAJhZi5ZzIuFO++oA8KIY00LVOJNvDuNy6Q6CfzaebSr2jctnH9PAU2d2S7U4QIKtIvYt6uOEBTO5vHr3AwCbTRCYanFgQiZa7OtBsa9Hps7stpXiwKOq/lEArwxzhQ4XVRUAjQ2kWhrAtid/jK1P/AiFlukY3LsNP/nSH2PjqocQDQ/B2KCW1mQm32zVu83exf+D5Nenzuy21eIAi309E7YHxwSBrRYHAOA3gkzu972Lk92FYo338V0Anq3h8pg46Ks3rxhvsm4OgOdFJEcyziRy/G4kv7XdqL2atX47jA0+bWzwTpLwcdWJiIUYSXdg1x2pYAEqSXobZAIxBurcV1Xdh9Ld3I2G9a8z+ebbonIxFpGQZEXEnEXqzvEk7cZjZmtqlu8g8QsTZElC4moFJK4jUZi1aLmftWh5I874dFNndFsSfd65G11UuVrVrwtzzQEhot47JCc11sxuqveOEAlzzYGq/6WLKld7795Joi/ty000nLMWLZdZi5Z7EgUS16W4kRRXv1DVnSkOj9nUttde2DXeHXQKYEqQyb3Ox5FSlZl8U4uPo21DvT1rhnp7GnK4Q6U4wM7Fy8XYwFaKA89R9avq3ZCInBdmC1O8i4Wqjkk424a5JqPe71Pv7lDvVpJY3zKz27bNOQu9WzY05PCJod6eYKi3RwHcmMk3/Y5LDyoMMjnr4+gzAP6rDofHtnXmyzctP2YAOhe/XHY9+wuKyIxEzJkpql5NEBh63WmCYGmmMKVUHuhDI0/gaJl1hh3YvTXZ+xqEnaT+T0BuDjK5FgBwUWUAwN+od58D0DP2Ow26TL6lA9HwUJM6t16sma3OqTHWkDoEYCHJvTUcHjNHXDMODhrq7UFLorSLBGaGuaZXeBcpVRHmCq1xVJkVV8vfMjYI0l+wb8hVSRSsAAhUdZDkD4wx/+DiCOrdf6n63yP1QQBDqU5gpTjQyCNbxNggiMolr+rvC3OFy2uGTJhrsi6OvkjgoZaZ3bZ36/i41159Qed4kSNdi1+O0v49T/qoulKMyZEq3kU+zBaWexcPUfWxFDHjTuKN89KuxS8XYwNbHuo/QPIRUh8BMNAys9u2z1mIVOQ08jIALFUdgA+E2cJHorTayRgrPqoOiDHXd77swuF9WzaMGx/2mvNnjRcgig1tZah/COD+MN90jY+rDkCgLlabyV1J1WGQj6bABJ2LX85ibw8aJPeRmqy1w5QMAFSLAzrUoDFr4r6Y6FsPQCHmD22YvdNVy7620zvMNwU+rt5G6iqxoa0Wx3/eqb36/M5xA1ctDjAVdb/wcbQ0U5hyro+jhEje+TCbv0JVF5H8LwADQ709yLd0mLhSti0zu6UtWdkT/YsmtfN3tAFcK50pp1aKAzbf0oH+HS/Wxpstxt4XZHIfqCOOyxSmhNHw0D8B+OOWmd12YM+249J/cv87zj8uiLuWvFz6ezZLeaAvB5F/z+SaXhGVizGSs9Z8mG+yrlrZB/ALxgZf83G09bAnUtSdyTNJLx6O4DbMnKHevQOQW4NsbnpcLtWIk/iGldLPQL4m39JRaeuaz54NxxdGkvveft6Jyl8F0CbWfifMFi6Lhoccaie6W2vDbB5xebhI4Mci+AFVHxcbbBZgv/ojVRROrsvYICTQTu/mizErSPyWAK8K84XmuFoGva/l3TVTmBLE1eFH6f01APpPdLe3fPF3zzth+FMA8mLMvUE2/3s+qkK9cynQhEgQZnOAGKSfDQLoBXAAQBmn6Nj9Y/T78gBaAUwzNphqM1mAirhaAZLqU0nDToHNZOGiytfo/XvSeZ3wVvyJOCdBU0DK9P6dUbn078bavwzzTWe4qAp1sQfpovJwzTS2YsxUY+3UkTN3Jq2UYxqATSL33sX0Lq6dYScAxASBDTI5uKiyNRoufhTA349ZuDjVBKoRSQqt02T4QO8DXvVhVX2PiNxkM7kzjTFwcVSrkfb0XtV74lfrqp3wGJggRBBmktyTizZFleG/pfdfBHCg0DrNDB/oJSbIUZcvvHVif56mtXOePbBrS01kFYwNXkvgWpCXkbogyOaMSXcT1J/wMTkpknJ2WqSi6uCqFRUxmyDymDHmWz6Ovg9g+DBznxgYPv/Wif/9oNlLV8jO9Y/b+mixsUEI4CyQL1P1ZwLSBbA9lfF2knKNT3SJ7AfYY4x9ESLPBZnci1G5GNVLotlLV/id6x+f+MP37v6dhv76ibTOmmcA4MDuLR6/RlfrrHk2nVcj/K4J10FH1LL9uzb7ep+ntXOeHNi1RepE4qTWRWNhPbBrC8fMq6HXyfwl4mRiPVtG3Rz7/2S+TgWsk/e3vE9fAID/B4YKcENjAdzmAAAAAElFTkSuQmCC",
	silber: "data:image/png;base64,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",
	gold: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGgAAABoCAYAAAAdHLWhAAAf/klEQVR42u19eZhdxXXn71TVfWu31K1d3a0Wm4QBiU0CvIDjBQwGYpgMEyf22LEJMbY/7BAvsTPBzoyxZ7wSDMaGOCT2TPDnJZZXvAwYzxAwmzRCCztoaXW3NtT7W29V/eaPW6/7dWuhW3otNQ73fdV6eu/eqlPn1Dl1tjpPdj98NV65Zu5lSL6ChZlMoBkChwKgdGbhjFgtrrxbAPjQXuGgGjJsadcrLDPDOEgF4iwRMX9N+vawaCV8LwCmewXVj0FAQUT1kPaLAHbUwfjvjoMk+SNpgj9RJnsWXQUickxXDEmITsPHQ+cL5NUE46O0UA7CQcdOwgkAT7ATos5y1aEKxrCg65BSvx80AlG1PlRorPvMAYBzFUDUmaTvBPBc3X3HgIOOHYWYnn2KVAaf6gbd08o0v4q+kuDKV1EPl4jWkAZLY1qQro5qAqiUAQhRaXg7/DSA7gDjMUPSseQgVgaeUgBKAK6gK91AusUgBcCrIZIH6SFK0bsewD3doJVc48hXQVQ76D1EFMkCXOVhiJDe7QJxI4BSgPHf5R6Euok/Sxe/u+7zjSJmJRlbpdMpb4s/BPCXDR77q0qnP+xt0YqYFBlvAXAhyIn0OKaqtgFmhJqtTHax2NJO1ml3AIiwgCKAKmidtgGaqwUkSvoeVeBqexLqYJkJdtCMUPd9XNw5UZ0CGXZvji7rRhiPoY9EliY0Ssaq9b0fLK9w0EG3KYxf5Y1XqceZQDPRUJ2xrrhxHDSNFup4DpqBnoSZChk5vr1cxzhyO2gmC7hEDHHa1gBnuIB7OXAQML2re8Zz0AxmoQRvnEYJx6OyBn4/tbijpmFxwlgzjoNmKoFqK3zUWJ0mDuLoWDPxUjNbRfh9HOsVDvq94iAzcxcPg549jQt8tG/OWCY6lvGgSdBn7DU9Q4S+w1ivcNCUdeyjxEGcyRw0gw2hxNKfxj2oru9XtLjDsoOm3wSa0VbqzNbieBS1OL7CQZO9snNOO1YpTgxjv8JBByfOCinu20wA0THgoKi4bzOzc1ZIqW/zjEHKjPFmR/k2Xdq3yQH4I9Gpk+iqY3lwSXS60ddo33RVH8b8o9K+TWuifJuOC71uRoi4ek32WLXs3BXibZFisi2E3EpSh+8UvRUCv2RCRB7pWHV9/DL0rULcSRNyq5hsi7dFZueukJmAG3nm51fODE5OsnW+qaL8NT4uOABQJqdDytVVSLJNG7Wqa339QJncVd4Wk/GivPZx4U4A16AxGUQN4CDuH/k9mi3Kt2kSlsSboVLXuGrBkRCIEmdL/QQ+lJ27Quq2i0a0God82NlSP0QJCXHVghOV/nMSbyZhA2zHFD/qWDJwbu4KIQmdnp0FcDvoCVAAelFpBfqPgdwZl/YpgL6BY/u4tE+B3An6j4pK1/oX0hHA7To9O1sd6UFu7go5ljiSp356xUwQbV9SUe5jPg6ixmS0t+V7AVyUamrT1ZHp2bDr+r5HmcyF3paDqMtpHxe/DODjx1rUyZM/fduxGru2D5wjyjwM70hQBIoQVQF4Oum2YCyXerrsQIroEwDZCPo04UUghNJCb18N4LEG739TBPAYcW4q34Z0U6cB8Q8CpUgKCC8mo+ntp+jdCyA0CD+NcHgQmt69QG8/JSajQXiSIlAKxD+kmzpNKt8GEHIscKU/+CfLj4loc9VhZyuDn9RR7p2uJlp02nhbehTAX6Sb2pStDh+N3Gimm9q0rQ4/TBdfonS6k956eud1lGuLSy9WXHX4/iDqjnqutjzx48uPLmXSrcpW+j2AU0TMetIbwAsgFGU8vT0H4IajLFZqY50hKnqM3qpEWVEUUZa0ZwF4qg723181W5mchPd3QJk06UHCK5PV3sVfILmBhCHhjiJcLoy5wbv4C8pkdaLWeyQw4o4JsP9+qtmpfJuujHQ7gB9UJneBtyULUERFxsWFJwH5bCrfpvPzVrqp9p2ft1JS+TYdnpfDeN6l8m0a4GddXHhSVKQBirclq0zuAoAfrIx01+45ajg7momLymTm+GphVyfgP+9t2ZNBi0oSCK8FfAWAHtm7cbJQqXRTuwDAyN6NriYSKyM9SDe16/B+Uud8RvZuZLqpHSQqAK4V8v6QGay8LXtAPg+on5vMnB2VkZ6jdupOHS1eTeXbpLB3I+ntbaLSzfSWIKlMTntXvQ3kAyBNZbjbHaIflcq3aZAmP2+lgPSV4W4XnmkR0VeJqP+kdLal7nMf7jXh2YPOOdxvQD7gXfU2ZXIaJOktA8y3FfZuZCrfJkcLb7Lxh5dO+ypIN7XrykiPA/AObbJ3OVuyAJRSRuhtl6hopfdxscbXTfNPR3moS3SUl8pIj6Sb2hmeH7+6dHoJfXwBgMtAvkl0ehEEoKvuAvlbiLpblLnfu8qOg8Ak6aZ2urjAzKxOjuzdWPNyi1JRjj7eJMp0em8JwGuTNc6W3gngO3Vzml4tbuO/vvWoBAVFmTn07klRei69BQAGj8FlAH4BIAUgPmSwTnSHiDod9K8j/esBnKVMJg8R0MUgnQOSU+GiI4CEt+UCRK0H+G8CeZDABtB1v0QYIgJQBXCpMpm7g4dBRBnQu32i9Kn0ti/cP62iTjb8YNoJVHOV/IuOcu90wZ2jo5x2cfEuAP95HEBKR6JMi7eVxSJyPCCvArgSwAqAJ4lO50U0SA/6GKB3IaCnMFahhAC8iACitKgIIgqkA12lAMjzAJ4guEkgT0HUVlFmJ70doHfxBPgPBfe0u4Fkww8uORqi7VKlM3d7V78S/T6AK5rmr9w7snfj3yidfp13lTkAFgCYC1GzlUpBlE5y1rwHaUF6DyaOzXqipJs70Nr5JgBAf9d9qAyPMklQEoQQUSJKiRhAKQgE9A7eVwH6QQD7AOxROt3nXeXBpvmn/49i37PzvKs+IUqNcb7OaO8Szp9uUSePf//iaem4acEZUhnqEhcX8t7Hm5SYTu/jRJZHOePi4jsBfCfc/kCUaX2drY5AQoEYeguSri7lpkYMAQBtssi2LkPz4nMwu+21SDe3jxu/MtKDwZ7fYXjnYyj1PwdnS/UEq9PsREREizIhwAqYVBPicv+DAM4Pz7xDR7m7XFwMe2cknrZLqWiljvKF9KxOjuzZwJcVgerY/1Yd5a9zo0G4rPa29HMAfxj2nSqAu0WnLqaruvCc1Ikr6KgJUW4+MrM6kZtzMvLzTkOudRkgSc5Lse9ZDHTfj8HuBwAAszvOR0vH65GbE9xY9Cj2P4fCi0+g2PcMykNdiIt74eKRcS6f0KzolKar/hrAZXUw/kyZ7OXeloKoy2sXF24DcN10ijpZ/723NF60NXfoynC3A3C+UtH93sc+WaoaAAsQvSI/79QdI3s2mKAY/EqZ7MXelpwooxevfC8ys5Yiys5DlJ0Lk541njuGd2BkzyYM716HwotPIi73HTjPITMH+XmnonnhKuTnr0Rm1pJx39vKEOLSPsSlF1Ee2o6dm/4Z9NaFRfRrAJcAiJoWnGELezcvAbgZkHwoIUOlIuV9/HoAD9TNucGrvPGMmdgIkDTIOwgRMAkZKJMxLi58EvBdI7s3mHRzu68M94wpTwSi7DwsOPkqeFtCeXA7Ci9uRmW4B+WhLpSHtqMy3ANXHZkwogQlwIf/Ju/jUh8GdjyAgR0JZ+lUE9LN7cjM6kRm1lKkm9sRZeagaf4KzFp8Dl58/meojuwahSVZbO1+ZPcGDaALwCd1lL/NxQWb5HOIgLgDImcnG2Tjq2JNR/K8Lg93WwD/VUf5U0dFm84YG4/8G4Cv11ZbkrAxdgaRIOgdSI+dm76FPc/+6KBrQCSU7SESjY5j2u4ooaBGi56RHrY6DLvvaRT2PT2utwXL/wPazrw2GTucuKvBlcg9ugDz12088idKZy7wruzoKi7M8YbycPenpkPUNToepEFYEGeIRJ9w1YJLVpWAPq6AuBYEXLVQS7oefXb0FAiZIF+S05mJiqyRiMegJzAQclShOzA8iSruQV/TNRLFr9afqCikzpjAdRwHS11iPQPMAHEtfVwJXJbkMUj0CRBnhLnrRuJUcUKC4BE0STe3g6QieQckqYVDkomn2t5I8imSJi71+fqk9YOl3zIQwjsL72wdUQ4PxprCUCNawq37j4kJz5BEgNmQfMo7+5nE482kSk0y1ztIqoADaRReVUNF21C3A3C9jvLneVuxid2Z1q5aeDwz+7gvpJvbx8V46pEzKlI44eAwG7g1jhLXh3Fk3FijBKkbdAIBXbq5XWdmH/dFVy08rnRaAxBvK1ZH+fMAXB9woBu3BzXGna0AOFH6RAA3urjoSCqI0HvnSb6vNLDVBsC534qtE29jn4f/y5Gn/taUhvnLr8Cc496EynAvuv/fN2ArQ6NjjeegibCMvmd5qBthn3mf9+7hRABSubjoIPpGgD+hd1vQoFqnDYkHpZvbBSDp7TdERblEDSW1yWn66k0AHwNoAI6L85AHeD+OGPttCFNPfhAN0mHB8ivRufpDaJp3GuYefxGWnvcx7Hc6jIeAa6y5MJfH6Ks3aZPTST0uB1EmR29vB8iAkyPG7RFHVNNNHbo81O1IXK1M7iIXlywJEYmUrY48T+Lv0k0dumnBmftFSMH9C4rULdba/nzYsEEMvLdoXrgKS1Zfl3gnQsvNWQaRKIzH/cY/EIy11rTgTJdu6tAk/s5WR54XiRQJcXHJKpO7kMTV5aHu2j1HGFE9sh5UlJvrASwG5MvOln2ItxAiAvL9IIsEMLxr/X6YZh0myAkFJeqPJh5OHEU06GKk84tw4gWfHv0seNYxsOMBeFedcPxxAiwTYKy14V3rA11ZBPn+MNdE1CXBvS8DWBzl5vpDxZ8m044oeT7d3CFDux4nyVuUybTSJ0yiorx2tnIngd8QMOWhHe5Az9cQUK8W1B+sqy+mxJoxKy9tGUAUvLcQFeGkN/536FTT6IFhUQYjLz6J7Y/dOq4vYDytDgRjfQtzMgR+42zlThXldaLZOyqTaSV5y9Cux5lu7jiiJPzDpm6muUOXh3Y4kFcqk7nKVQsWpIho5eJCL4CPR5lW1bzwzINHSA/FQZhYTEmCXeNqVDgIbGOq8ol/8N+Qnb00qU0bjNtq8UU8d99/Se4VdcAxeRAYJ7bmhWe6KNOqlMl+zMWFXhGtQIqrFqwymatAXlke2uEyzR368DnoMJ5rXnimlAZ3kESOxE10lqEvioqEnh+iZ78yORnauf4QSe886H6E+nsA0Huk8ouQbT0p2Ef+gOsLokDvsWTVB9DS/mrQu0QCgfCuiud++7eIy4OA6KB210nVA+47B98Dh3aupzI5cdXiAD0/JCqqJfmrgJObSORKgzvYvPBMOWpZPUO71uuQbH6NjnLHe1f1ABmCWT8EuAagKQ/teInsnDpnyoTPR/+GVT5/2aVYecW3sOLyb2L5Gz8HiCR1r0XGNDalQW8x/6RLsejUP06Io3St8jK2/u6LKOx7ZvS+Ua1tgkObB4HxQC3M0QBc4+LiD3WUaHXeVb2OcscDvAagDzg7KlqchDyyLImPOlupBTTFxcVhQF0fVot/6b4OwUFhRXsXQ3QaS86+FkqnQe/QsuS1eNVFXxnlLEABouGdRdP8lTju1R+pldweJVLPxv+JF7fcO3pfvf4x3vaaPAfVNd+88EwB1PUJDkRIIODmIwFXLuBu2jlIh8ev0FG2kz72AKlMRpH+NtJ113EYDpeDxmOqpnb7hHO8xaxFZ+GUt9wUbnWgt4iyc7HsjZ+BKB2ipR6iNPq2/190r78zeHpsvbNugu01dQ6qHWcZ2rVek66b9Lcpk1WJXRh7HWWXArwiTEQfBgdNzTdkMq0+vL/Gex+cUUrbamEEYm5pXniWkPRT9pMdoHgfmWhdzpbQte6biRM1fEbvMGvR2TjlLTeN9nHyhZ9HlGlNlIkg8gp9z+HZ//N3Y3tZ/bg4iPdiQiGnSTbfvPAsgZhbbLUwAihNkgFH10zA3eTxPUVfl4qLfR7A8RC5wNuygICK0uKqxTV08c5qca8Gp5BTPVHHZd0eRMB7B0BhzzM/hTJpHHfuh4L40gmRFp+Nk9/8BXhbQn7OslGNDSKIy/14+p5PAN4DSiX/4gBuHRwABh4AxkNfvlrcq+ninQDWqCj9blctwtuyAHIByOPjYt/WqbqAFDGlV+3+S5XJpZhkHyrvLAh+mwhe3Mm+DnRv+MELETNW6IgOEIWdT3wf2x69NfGt1RQAerQueQ3mHv+mYIzKaFzp2ftuQLW4FwjEnDhWrYiShB/uIN3kYDz0fITAtwNOFOmtMrkUwUsn4HBSr6kqCTWV+RLSITlxZZSzlS5AHiTB0uAOP2lXzNjGbGuf2cow6B3STQvHuXq8d4Bo9G7+PrY9cusocRIj3tftT4nGtuV3X8bgro0QMWNKwX4mE4O7aiHoXTI2x8OEKTgywtwJ4EFnK10iRiU4cyBxMQ9gZjVSSRCALsq05AGe420lUW11CgDvI30lO6tD71+m6uCtNNhVcyj211DhbBnloW40zT+tJuPGNm9vIaLR+8T3sO2RWwInjRmh9BaiNHo3fxe7n/0ZRDS8jw8OQ+i7af5pKA91w9lyvS+jfwKMk2nMzurQpK8AvC/gBgFX5yqdzgdnqzRczc7MWqJIIC4PngLohT7JF5RQtf0+EigO7jjc4xnPh/ghSKC/+yHkW09AlJ0HTz+a5pBwkgVEo2fz97H14VsgSo9qdqIM+nf8Dlsf+Voivrw9BPcKPD2i7DzkW09Af/dDGMt/BEk8fzhzqcPBfQE34r0joBd6Vz2lHpcNdZaWBrokhJpPVyYdBDaNjYse5Lpwn5/KbLKzOmpGxmPeOyG9Aok9z/0aEMHC5ZcFbKrxctYFTtr8PWx56O8TW0kZDO3ehKfv/dvgP5NDy5LQ58LllwIiyZhJME957wTkoxNgnGyr4WCdjUs+JOM7ZdKgd6fX43Iy7XAqz59aU7CUMvDe7k5lWrdWy/1Tjn+mcvN9cXAHBHjIxaV+Ed0KOI7se1aGdm9C+8o/Rc+m78HZUmLX1Nv83kJEofeJf0V/9yNIZVoxtGdz2JfUuCSSA6ScwHsLbbJoX/kODO3ehJF9z4ZcHqVcXOoX4GHWwTiFqwbkNtDvVsos9t768MWp03b8pG4lnUDvg7NRA+S2aqmvNHvxWTJZs7vWBnrXBZnNfpB3K50GIQ4ktjx0M3SqCSe85vrxjs16TvIOAkFpoAuDuzYkjlRgLEnkYC30dcJrrodONWHLQzfXuM4pnQbIu0n2Z2d16IHedVPlIAZcFEFuCzhCwNkJU+XKSRuqqdz8mpG1eCzZQkByB0lUCnsPLwFlzHi8xbsq6J1AFIb3PImeTd/FwpMvx4Jlbx0VYxOfT+yksUTUl0oqEWXgXYz5J12ChSdfjp5N38XwnieDk9WJd1WQvOWAhu0kWx0uugOOagkqiyfgsmFJIzLQu46z284WAC1jtooCgD0AErl6GFdpoKuWZPGYd9U1OspremcBYMtDX8XQrg1Y/oZPoaV99SiR9pMpQc1+qdyFGnFa2lfj5Dd+GkO7NmDLQ1+tcZ3VUV57V12DUBshwHY4c6rhYnfAUc2+a6nhcgqHiCe/Mkb2PhORzNKP+3yoAelFnL34bEmcr6URiFIIP7y16Rd/hWL/Nqy87Fa0dpyH5HSIwujKnFS6VZIP512M1o7zsPKyW1Hs34bNv/xIjagMtYFGSHw0gSXxYh1hG8NNgrMsyVo6mkxD2pUoAHpCNmrcgKwgXynsVQC30bsPa5NVJK2IgouL2PCTa1HoewErLr0Zi0+5MiiQfjSEfeiMnnCWiA6LT7kSKy69GYW+F7DhJ9fCVgu1hEWrTVbTu78EuC2BpSEHs+IJaWXapJqnhPMp7hveJ2bxONkcNSJBrziw3YXEwH+OK8NfN6nmyCexBlTLA1i/5mr0dT2EZa//JJa/4QaIihKb6CDclITH9Wjoe/kbbsCy138SfV0PYf2aq1EtD4TvXWxSzVFcGf46yX8iaQIsjUg8jCY4g13A4RQSF6fg/W6ad3IMojTBAz+rgamuLju7U7e0rbourgyvManmiM7GCSeVsenu67F93Z1YdPLlOPcda9Dacd5otmnCTRLytkO01Fm0dpyHc9+xBotOvhzb1/0TNt19PVxcTjjH2YQ45aEftbStui47uzNx9DZuPrMnRC1KAYdTSP2dpBtwdtvZ0t+zlgT7k2QL1pyLiwkiO3sJp+h4PeA4qdw839+zVkj/dlsd+ZFJN0c+URpIEFsfvQOP//ha0FVx+uW34NS3fA7p5kXw3o4qC95bpJsW4pSLPovTL78FdFU8/uP3Y+ujt9dEDb131qSbI1sd+RHBt/f3rJVUbp6fonv0gK86XCyqOWADzvr7e9ZydtvZMtlxJh1uqBT2qhBG6K658HySwHEcAKTy831xoOuIhfZAzzq2tK8CADfQs+4qWy3cYVJN19jKiAdAUVoN9K7HI3f9Ryw95xoct/oazD/xQuzYcBe61n0LANB59nuw5Mx3Jtbi2n/E9rV31oW/nScIk24ytjJyJ+nf19K+irWxG5FmWxzoqu1fx/vRJBcFEN0TcPnSe+h9X1s9pRNzIvIZncp/ylZGYlEqoveDAE4EsK+1fbX096xtyCRb21cLAPT3rKWI/LWo6PMAxLuqFaVNzSjNzFqME877IBYuv2Tc+aDdz/4KWx/5BkpDvbXDyaB3VumUSVgo/gTJLwJQre2r2Ui4Q19zAbwgSs2m97FJN0WuWriR5KenckxF/9mlbZMaONvSKbY8SAAtIurttaQLZdJZencPgK2ijQr3HPFVHu5FebhXsi2dOi4PPkC6ByC4wET5ud5WatwktjyEvVt+i70v/Abp/HwUB7rwxK8+gd4n1sBWhhNnajCSTKpJe2+30sd/DOB/ZVs6tS0Psjzc27gUfW20LQ8CwGuVSf8FnQ2nC5Xy3t4M4Ok6XL50f7+5ddVUEuQ9gA4Az4lIhmRs0k2RrYzcguS3tqfrrGat37mizJeUMu8lPLytWohoSX4hff+E+cT76ZROGREF7+Nv0buPhdPc0w3rV0266cO2MhJLcjylLKJOIn3PVKKqU4kH+eT3rtkNcK3oFAGKi8sAeBXAXGv7Ktfavmo6anzaXEunBriPPr7a2fIf0vvNJpU3SQaNsxAhJAl1Q4Sks4CISeUNvXsieca+F+C+0JdtNJyt7auktX2VA5gDeFXAjQRcrSVdT8DhpOuv6ne/dfGUzgAFyjdrk3mrd1VPeppUfrZ3cVdpqHddaah3WgrfxeVBtnasFlFGx+XBZ0j/LXo7DJEzdJRvpouFSQDIC0TrKK/g3V56e6P39hoAT+ZaOnXTvGUY2vPUtFQHKQ31mtJQrwdwtUnl/7RWqFCbjPau+hUAj9ThcHIi896vnjX5DbBjtfR3ryVEFgB4DqKa4Z0XbRS971HKnGrSzYVqcR8wjSVScq1LdbF/e1L2RUeLQf9XgLxPmcxsAPDJJvBNevv3AHonPjNNl0rl5sJWhvPe2ydFqXY666G0Av0wgGUg94zicLIc8a4pcFBpqBe5ZNMeAbDQRPnXBC6CSeVanC0vcnHpx0oZQ/ppK3QWJxusJAfQ/BDJe0TUdxJvuH2EdO8h/Q8ADIc9gXF5cDpr6ohSxthqwZHudpPK/YELioxJHLDfALAm19Kpp8q9cs/NZ055pbR2nMOB3vULSPe0iJoVVN5aBZGPArgJYzU+p7XYUGvHOVIp7FETuSPXulSn8wt8f/dj010RT4VmAXxER7mv1CqShMSWIRH9qpa2s/b0dz825QrG+l0XL5oqQBRtdLXYPwyiz6Sb3uZs1QIw3sVeR5lL6F2RxANhpzNzlqxmabAX0yT3EZcGQwwbtaPgiEuDvmYDTcc1Z8lqKQ32GiRnbr2IfFyZzJddXKqFT5xJNxkXVz5M+vtFGx2Xps7F+l2XLDwsEZNrXarj8sBabyunmvSs072rWACG3jodZS8G/HLQPwJgsDTUi1RurnJxUedal0rTvGUoD/U0+hdNWMexjeYaae04R5Q2Oi4P6FRuLkb2PV8br12Uvl2ZzEfqiGNNelZkK0PfB/A3R7L/ya9vOuOwV1Chb6tUCvsyELnXpPKvsZWRGEmtNWdSee1seS/Ar4mYb3tX3X7A9IC6mjwz9DrgzxwqnVpK2j8D5DptMvNttVAjTmIbVgsPgbwwnZ9bzs85nn07Ds9TIb++6fQjlb8eQKuI/qlO5c63leFaDIAiWusoCxsXR5IKiHIP6B8T0Vsh0kdvY7wMLlEmAjmHdMdD1DkgL4LIG02Ua3JxqVZIUAB4k242rlp8gHRvA9CPIzztLb/6yspGbJIeQFZEf11H2fd4W4H3sQ1AU0QZbTLJ0cTkuyEALwIYAFDCMSq7P0m7LxtC1fOUimYlKWcezpbB5KiEICmsZJRJw9nyt+ntB8K8jjjw14hiSuGADkqke6+tFu4VpT9nUk1Lna2ALnakt7ZarKnGGkrNUqJnQVRSCGmGSjmOHn/x8HTwLqZ3sQsiT5KArdHaZOBsebutjNwA4F8mLNwj8xs1qJiSByDp3DypFF+8i87fTe8/IKL+XEWZE0V0jXMAwME77+CIl9dVq/BolIqgTBpMiLbFVov/SLpvABhI5+apSvFFokHmhfzySyumzcoHkBOl3wLgCpLnAzxBm4wSleQS7Ff2ZUbSBBCppXQ5hGP2W0TkQRH9Y++q/xtAcbq8FfKLL57W8GnN7TxX9nU9quu9xaJNBOAkECeT9kRA2kDOCTJez1AKOQAliPQB7BUxL0DwjDaZF2xlpFovieZ2nuv2dT3a8JU2LQSq7z/XulQBwDT7wY76lWtdqsO8/HSKgOn+HVUW+ra5epsnP+c4KfRtG9UK8nOOm9F70URYC33bOGFe03qZo23wFfq2TUTAy4ZrjgWsM/e3vF+5AAD/H+EjiYRtQGuDAAAAAElFTkSuQmCC",
	platinum: "data:image/png;base64,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"
};
function renderPlaene() {
	const wrap = document.getElementById("planCards");
	if (!wrap) return;
	const check = "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"><path d=\"M20 6 9 17l-5-5\"/></svg>";
	wrap.innerHTML = PLAENE.map(function(p) {
		const feats = (LANG === "en" && p.features_en ? p.features_en : p.features).map(function(f) {
			return "<li>" + check + "<span>" + f + "</span></li>";
		}).join("");
		return "<div class=\"plan-card" + (p.empfohlen ? " featured" : "") + "\" data-plan=\"" + p.id + "\">" + (p.empfohlen ? "<div class=\"plan-badge\">" + t("plan_badge", "★ Beliebteste Wahl") + "</div>" : "") + (PLAN_LOGOS[p.id] ? "<img class=\"plan-card-logo\" src=\"" + PLAN_LOGOS[p.id] + "\" alt=\"\" />" : "") + "<div class=\"plan-name\">" + p.name + "</div>" + "<div class=\"plan-tagline\">" + (LANG === "en" && p.tagline_en ? p.tagline_en : p.tagline) + "</div>" + "<div class=\"plan-price\"><span class=\"plan-amount\">" + p.preis + " €</span><span class=\"plan-per\">/ Monat</span></div>" + "<div class=\"plan-limit\">" + p.limit + " Analysen monatlich</div>" + "<ul class=\"plan-features\">" + feats + "</ul>" + "<button class=\"plan-btn" + (p.empfohlen ? " primary" : "") + "\" data-act-click=\"h153\" data-a0=\"" + escapeAttr(p.id) + "\">" + t("plan_choose", "Plan wählen") + "</button>" + "</div>";
	}).join("");
}
async function paketWaehlen(planId) {
	if (!sb) return;
	const link = STRIPE_LINKS[planId];
	if (!link) {
		planMsg("Unbekannter Plan.", "error");
		return;
	}
	document.querySelectorAll("#planCards .plan-btn").forEach(function(b) {
		b.disabled = true;
	});
	planMsg("Weiterleitung zur sicheren Zahlung…", "");
	try {
		const { data: sess } = await sb.auth.getSession();
		const user = sess && sess.session && sess.session.user;
		if (!user) throw new Error("Bitte zuerst anmelden.");
		const ref = user.id + "__" + planId;
		const url = link + "?client_reference_id=" + encodeURIComponent(ref) + "&prefilled_email=" + encodeURIComponent(user.email || "");
		setPendingPayment();
		window.location.href = url;
	} catch (e) {
		planMsg(e && e.message || "Weiterleitung fehlgeschlagen. Bitte erneut versuchen.", "error");
		document.querySelectorAll("#planCards .plan-btn").forEach(function(b) {
			b.disabled = false;
		});
	}
}
function hidePlaene() {
	const g = document.getElementById("planGate");
	if (g) g.style.display = "none";
}
function hidePlaeneBack() {
	hidePlaene();
	enterApp();
	updateKontingentAnzeige();
}
async function codeEinloesen() {
	if (!sb) return;
	const inp = document.getElementById("zugangscodeInput");
	const msg = document.getElementById("codeMsg");
	const code = (inp && inp.value || "").trim();
	const setMsg = function(t, type) {
		if (!msg) return;
		if (!t) {
			msg.classList.remove("show");
			return;
		}
		msg.textContent = t;
		msg.className = "auth-msg show " + (type || "");
	};
	if (!code) {
		setMsg("Bitte gib einen Code ein.", "error");
		return;
	}
	const btn = document.querySelector(".plan-code-btn");
	if (btn) btn.disabled = true;
	setMsg("Code wird geprüft…", "");
	try {
		const { data, error } = await sb.rpc("code_einloesen", { p_code: code });
		if (error) throw error;
		if (!data) throw new Error("Code ungültig.");
		setMsg("Code akzeptiert – du wirst freigeschaltet…", "success");
		hidePlaene();
		await ladeKontingent();
	} catch (e) {
		setMsg(e && e.message || "Code ungültig oder abgelaufen.", "error");
		if (btn) btn.disabled = false;
	}
}
function setPendingPayment() {
	try {
		sessionStorage.setItem("cc_pending_payment", "1");
	} catch (e) {}
}
function clearPendingPayment() {
	try {
		sessionStorage.removeItem("cc_pending_payment");
	} catch (e) {}
}
function isPendingPayment() {
	try {
		if (sessionStorage.getItem("cc_pending_payment") === "1") return true;
	} catch (e) {}
	try {
		if (new URLSearchParams(location.search).get("bezahlt") === "1") return true;
	} catch (e) {}
	return false;
}
function cleanPaymentParam() {
	try {
		const u = new URL(location.href);
		if (u.searchParams.has("bezahlt")) {
			u.searchParams.delete("bezahlt");
			history.replaceState({}, "", u.pathname + (u.search || "") + u.hash);
		}
	} catch (e) {}
}
function zeigeZahlungBestaetigung() {
	appAus();
	hideBoot();
	alleGatesAus();
	appUnterseitenReset();
	const ld = document.getElementById("loading");
	if (ld) ld.classList.remove("active");
	const lg = document.getElementById("zahlungLogo");
	const src = document.querySelector(".auth-card .auth-logo");
	if (lg && src && src.src) lg.src = src.src;
	const fb = document.getElementById("zahlungFallback");
	if (fb) fb.style.display = "none";
	const sp = document.getElementById("zahlungSpinner");
	if (sp) sp.style.display = "";
	const g = document.getElementById("zahlungGate");
	if (g) g.style.display = "flex";
	const kp = document.getElementById("kontingentPill");
	if (kp) kp.style.display = "none";
	const mb = document.getElementById("mehrAnalysenBtn");
	if (mb) mb.style.display = "none";
	window.scrollTo({
		top: 0,
		behavior: "auto"
	});
}
function hideZahlungGate() {
	const g = document.getElementById("zahlungGate");
	if (g) g.style.display = "none";
}
var ZAHLUNG_POLLS = 0;
async function bestaetigeZahlung() {
	if (!sb) {
		zeigePlaene("start");
		return;
	}
	ZAHLUNG_POLLS = 0;
	cleanPaymentParam();
	zeigeZahlungBestaetigung();
	const tick = async function() {
		ZAHLUNG_POLLS++;
		try {
			const { data } = await sb.rpc("kontingent_status");
			const row = data && data.length ? data[0] : null;
			if (row && row.aktiv && row.monatslimit > 0) {
				setCURRENT_FIRMA(row);
				clearPendingPayment();
				hideZahlungGate();
				enterApp();
				updateKontingentAnzeige();
				return;
			}
		} catch (e) {}
		if (ZAHLUNG_POLLS >= 12) {
			const sp = document.getElementById("zahlungSpinner");
			if (sp) sp.style.display = "none";
			const sub = document.getElementById("zahlungSub");
			if (sub) sub.textContent = "Die Bestätigung dauert gerade etwas länger als sonst.";
			const fb = document.getElementById("zahlungFallback");
			if (fb) fb.style.display = "block";
			return;
		}
		setTimeout(tick, 2500);
	};
	setTimeout(tick, 1500);
}
function obMsgShow(id, text, type) {
	const m = document.getElementById(id);
	if (!m) return;
	if (!text) {
		m.classList.remove("show");
		return;
	}
	m.textContent = text;
	m.className = "auth-msg show " + (type || "");
}
function showOnboarding() {
	appAus();
	const lg = document.getElementById("obLogo");
	const src = document.querySelector(".auth-card .auth-logo");
	if (lg && src && src.src) lg.src = src.src;
	obZurueck();
	hideBoot();
	alleGatesAus();
	document.getElementById("onboardingGate").style.display = "flex";
	if (EINLADUNG_TOKEN) {
		obEinladungSchritt();
	}
	const kp = document.getElementById("kontingentPill");
	if (kp) kp.style.display = "none";
	const mb = document.getElementById("mehrAnalysenBtn");
	if (mb) mb.style.display = "none";
	const hb = document.getElementById("historyBtn");
	if (hb) hb.style.display = "none";
	["infoBewertungBtn", "infoQuellenBtn"].forEach(function(id) {
		const b = document.getElementById(id);
		if (b) b.style.display = "none";
	});
	document.getElementById("logoutBtn").style.display = "none";
}
function hideOnboarding() {
	const g = document.getElementById("onboardingGate");
	if (g) g.style.display = "none";
}
function obZurueck() {
	if (EINLADUNG_TOKEN && document.getElementById("obStepEinladung") && document.getElementById("obStepEinladung").style.display !== "none") return;
	const einl = document.getElementById("obStepEinladung");
	if (einl) einl.style.display = "none";
	document.getElementById("obStep1").style.display = "";
	document.getElementById("obStepFirma").style.display = "none";
	document.getElementById("obStepCode").style.display = "none";
	document.getElementById("obStepEinzel").style.display = "none";
	obMsgShow("obMsg", "");
	obMsgShow("obMsgFirma", "");
	obMsgShow("obMsgEinzel", "");
}
function obWaehle(typ) {
	document.getElementById("obStep1").style.display = "none";
	if (typ === "firma") {
		document.getElementById("obStepFirma").style.display = "";
		obFirmaTab("neu");
	} else {
		document.getElementById("obStepEinzel").style.display = "";
	}
}
function obFirmaTab(t) {
	const neu = t === "neu";
	document.getElementById("obFirmaNeu").style.display = neu ? "" : "none";
	document.getElementById("obFirmaBei").style.display = neu ? "none" : "";
	document.getElementById("obTabNeu").classList.toggle("active", neu);
	document.getElementById("obTabBei").classList.toggle("active", !neu);
	obMsgShow("obMsgFirma", "");
}
async function obFirmaAnlegen() {
	const name = document.getElementById("obFirmaName").value.trim();
	if (!name) {
		obMsgShow("obMsgFirma", "Bitte einen Firmennamen eingeben.", "error");
		return;
	}
	const btn = document.getElementById("obBtnAnlegen");
	btn.disabled = true;
	try {
		const { data, error } = await sb.rpc("firma_anlegen", {
			p_name: name,
			p_typ: "firma"
		});
		if (error) throw error;
		document.getElementById("obCodeWert").textContent = data;
		document.getElementById("obStepFirma").style.display = "none";
		document.getElementById("obStepCode").style.display = "";
	} catch (e) {
		obMsgShow("obMsgFirma", e && e.message || "Firma konnte nicht angelegt werden.", "error");
		btn.disabled = false;
	}
}
async function obFirmaBeitreten() {
	const code = document.getElementById("obFirmaCode").value.trim().toUpperCase();
	if (!code) {
		obMsgShow("obMsgFirma", "Bitte den Firmen-Code eingeben.", "error");
		return;
	}
	const btn = document.getElementById("obBtnBeitreten");
	btn.disabled = true;
	try {
		const { data, error } = await sb.rpc("firma_beitreten", { p_code: code });
		if (error) throw error;
		if (data === true) {
			hideOnboarding();
			await ladeKontingent();
		} else {
			obMsgShow("obMsgFirma", "Dieser Firmen-Code ist unbekannt. Bitte prüfen.", "error");
			btn.disabled = false;
		}
	} catch (e) {
		obMsgShow("obMsgFirma", e && e.message || "Beitritt fehlgeschlagen.", "error");
		btn.disabled = false;
	}
}
async function obEinladungSchritt() {
	[
		"obStep1",
		"obStepFirma",
		"obStepEinzel",
		"obStepCode"
	].forEach(function(id) {
		const e = document.getElementById(id);
		if (e) e.style.display = "none";
	});
	const s = document.getElementById("obStepEinladung");
	if (s) s.style.display = "";
	const zurueck = document.querySelector("#onboardingGate .auth-toggle");
	if (zurueck) zurueck.style.display = "none";
	try {
		const { data } = await sb.rpc("einladung_vorschau", { p_token: EINLADUNG_TOKEN });
		const v = data && data[0] || null;
		const sub = document.getElementById("obEinlSub");
		if (v && v.gueltig && sub) {
			sub.innerHTML = "Du wurdest eingeladen, im Compliance-Checker von <b>" + escapeHtml(v.firma_name || "deinem Unternehmen") + "</b> mitzuarbeiten" + (v.rang ? " – als <b>" + rangName(v.rang) + "</b>" : "") + ".";
		} else if (v && !v.gueltig) {
			obEinlFehler("Diese Einladung ist nicht mehr gültig. Bitte lass dir einen neuen Link schicken.");
		}
	} catch (e) {}
}
function obEinlFehler(text) {
	const m = document.getElementById("obMsgEinladung");
	if (m) {
		m.textContent = text;
		m.className = "auth-msg error";
		m.style.display = "";
	}
	const b = document.getElementById("obBtnEinladung");
	if (b) {
		b.disabled = true;
		b.textContent = "Nicht möglich";
	}
	const s = document.getElementById("obStepEinladung");
	if (s && !document.getElementById("obEinlAus")) {
		const a = document.createElement("div");
		a.className = "auth-toggle";
		a.id = "obEinlAus";
		a.innerHTML = "<a data-act-click=\"h154\">Ohne Einladung fortfahren</a>";
		s.appendChild(a);
	}
}
function obEinladungVerwerfen() {
	EINLADUNG_TOKEN = "";
	einladungVergessen();
	const s = document.getElementById("obStepEinladung");
	if (s) s.style.display = "none";
	const zurueck = document.querySelector("#onboardingGate .auth-toggle");
	if (zurueck) zurueck.style.display = "";
	obZurueck();
}
async function obEinladungAnnehmen() {
	const btn = document.getElementById("obBtnEinladung");
	const msg = document.getElementById("obMsgEinladung");
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Wird beigetreten…";
	}
	if (msg) msg.style.display = "none";
	try {
		EINLADUNG_ERLEDIGT = false;
		const ok = await einladungPruefen();
		if (ok) {
			try {
				await ladeMeinenRang();
			} catch (e) {}
			await ladeKontingent();
			return;
		}
		obEinlFehler("Der Beitritt hat nicht geklappt. Möglicherweise ist die Einladung abgelaufen oder bereits verwendet.");
	} catch (e) {
		obEinlFehler("Beitritt fehlgeschlagen: " + (e && e.message || "unbekannter Fehler"));
	}
}
async function obEinzelAnlegen() {
	const btn = document.getElementById("obBtnEinzel");
	btn.disabled = true;
	try {
		const { error } = await sb.rpc("firma_anlegen", {
			p_name: CURRENT_USER_EMAIL || "Mein Konto",
			p_typ: "einzel"
		});
		if (error) throw error;
		hideOnboarding();
		await ladeKontingent();
	} catch (e) {
		obMsgShow("obMsgEinzel", e && e.message || "Konto konnte nicht eingerichtet werden.", "error");
		btn.disabled = false;
	}
}
async function obFertig() {
	hideOnboarding();
	await ladeKontingent();
}
if (sb) {
	let initialDone = false;
	(async () => {
		if (PW_WIEDERHERSTELLUNG) {
			initialDone = true;
			await new Promise(function(r) {
				setTimeout(r, 350);
			});
			if (PW_WIEDERHERSTELLUNG === "fehler") {
				zeigeNeuesPasswort("Der Link ist abgelaufen oder wurde bereits verwendet. Bitte fordere einen neuen an.");
			} else {
				zeigeNeuesPasswort();
			}
			return;
		}
		try {
			const { data } = await sb.auth.getSession();
			if (API_PDF_TOKEN) {
				apiPdfRender();
			} else if (UPLOAD_TOKEN) {
				showUploadGate();
			} else if (data && data.session) showApp(data.session);
			else if (EINLADUNG_TOKEN) {
				showGate();
				einladungHinweis();
			} else showLanding();
		} catch (e) {
			if (API_PDF_TOKEN) {
				apiPdfRender();
			} else if (UPLOAD_TOKEN) {
				showUploadGate();
			} else showLanding();
		}
		initialDone = true;
	})();
	sb.auth.onAuthStateChange((event, session) => {
		if (event === "PASSWORD_RECOVERY") {
			zeigeNeuesPasswort();
			return;
		}
		if (!initialDone) return;
		if (event === "SIGNED_IN" && session) {
			if (!SESSION_GEROUTET) showApp(session);
		} else if (event === "SIGNED_OUT") {
			setSESSION_GEROUTET(false);
			if (ABMELDEN_LAEUFT) return;
			showLanding();
		}
	});
} else {
	showGate();
}
var STEPS = [
	"Firma wird bei Google gesucht…",
	"Bewertungen werden geladen…",
	"Kontaktdaten werden geprüft…",
	"KI analysiert die Daten…",
	"Bericht wird erstellt…"
];
var stepIdx = 0;
var stepTimer = null;
var FIRMA_BESTAETIGT = false;
async function firmaKlaeren(name, land, sitz) {
	sitz = sitz || {
		ort: "",
		plz: ""
	};
	const mitOrt = !!(sitz.ort || sitz.plz);
	const ortText = [sitz.plz, sitz.ort].filter(Boolean).join(" ");
	const btn = document.getElementById("searchBtn");
	const haupt = btn ? btn.querySelector(".bs-haupt") : null;
	const sub = btn ? btn.querySelector(".bs-sub") : null;
	const alterHaupt = haupt ? haupt.textContent : "";
	const alterSub = sub ? sub.textContent : "";
	if (btn) btn.disabled = true;
	if (haupt) haupt.textContent = "Unternehmen wird gesucht…";
	if (sub) sub.textContent = mitOrt ? "Prüfe Name und Sitz" : "Prüfe, ob der Name eindeutig ist";
	let daten = null;
	try {
		daten = await workerCall("firmen_vorsuche", {
			name,
			land,
			ort: sitz.ort || "",
			plz: sitz.plz || ""
		});
	} catch (e) {
		daten = null;
	}
	if (btn) btn.disabled = false;
	if (haupt) haupt.textContent = alterHaupt;
	if (sub) sub.textContent = alterSub;
	if (!daten || !daten.ok || !Array.isArray(daten.treffer)) return { art: "weiter" };
	let treffer = trefferBereinigen(daten.treffer);
	if (!treffer.length) return { art: "weiter" };
	if (daten.eindeutig !== false && !gleichnamigeKonkurrenz(treffer)) treffer = [treffer[0]];
	if (treffer.length === 1) {
		const t = treffer[0];
		if (!mitOrt || !(t.ort || t.plz) || ortPasst(t, sitz)) return { art: "weiter" };
		return await firmaAuswahlDialog(name, treffer, { hinweis: "Gefunden wurde nur ein Unternehmen mit diesem Namen – mit Sitz außerhalb von „" + ortText + "“. Bitte prüfen." });
	}
	if (mitOrt) {
		const passend = treffer.filter(function(t) {
			return ortPasst(t, sitz);
		});
		if (passend.length === 1) return {
			art: "weiter",
			auswahl: passend[0],
			automatisch: true
		};
		if (passend.length > 1) return await firmaAuswahlDialog(name, passend, { hinweis: "In „" + ortText + "“ gibt es mehrere Unternehmen mit diesem Namen." });
		return await firmaAuswahlDialog(name, treffer, { hinweis: "Keines der gefundenen Unternehmen hat seinen Sitz in „" + ortText + "“. Bitte Name und Ort prüfen oder ein Unternehmen wählen." });
	}
	return await firmaAuswahlDialog(name, treffer);
}
function firmaAuswahlDialog(suchbegriff, treffer, opt) {
	opt = opt || {};
	return new Promise(function(res) {
		const zeilen = treffer.map(function(t, i) {
			const sitzTxt = [t.plz, t.ort].filter(Boolean).join(" ");
			const teile = [];
			if (t.register) teile.push(escapeHtml(t.register));
			if (t.gegruendet) teile.push("gegr. " + escapeHtml(t.gegruendet));
			if (t.branche) teile.push(escapeHtml(t.branche));
			return "<button class=\"fw-zeile\" style=\"--fwd:" + (.06 + i * .07) + "s\" data-act-click=\"h155\" data-a0=\"" + escapeAttr(i) + "\">" + "<div class=\"fw-haupt\">" + "<div class=\"fw-name\">" + escapeHtml(t.name || suchbegriff) + "</div>" + "<div class=\"fw-sitz\"><b>Sitz:</b> " + (sitzTxt ? escapeHtml(sitzTxt) : "nicht ermittelt") + "</div>" + (teile.length ? "<div class=\"fw-meta\">" + teile.join(" · ") + "</div>" : "") + (t.hinweis ? "<div class=\"fw-hinweis\">" + escapeHtml(t.hinweis) + "</div>" : "") + "</div>" + "<svg class=\"fw-pfeil\" viewBox=\"0 0 24 24\" width=\"17\" height=\"17\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 18l6-6-6-6\"/></svg>" + "</button>";
		}).join("");
		const box = document.createElement("div");
		box.id = "fwGate";
		box.className = "up-warn-back";
		box.innerHTML = "<div class=\"up-warn-card fw-card\">" + "<div class=\"fw-ico\"><svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m21 21-4.3-4.3\"/></svg></div>" + "<div class=\"up-warn-t\">Mehrere Unternehmen gefunden</div>" + "<div class=\"up-warn-d\">Zu „<b>" + escapeHtml(suchbegriff) + "</b>“ gibt es mehrere Einträge. Wähle das richtige aus, damit die Prüfung dem tatsächlichen Geschäftspartner gilt. Die Auswahl kostet kein Kontingent.</div>" + (opt.hinweis ? "<div class=\"fw-kopf-hinweis\">" + escapeHtml(opt.hinweis) + "</div>" : "") + "<div class=\"fw-liste\">" + zeilen + "</div>" + "<div class=\"fw-fuss\">" + "<button class=\"fw-eigene\" data-act-click=\"h156\">Keines davon – mit meiner Eingabe suchen</button>" + "<button class=\"kyc-btn\" data-act-click=\"h157\">Abbrechen</button>" + "</div></div>";
		document.body.appendChild(box);
		einblenden(box);
		window._fwTreffer = treffer;
		window._fwAntwort = res;
	});
}
function fwSchliessen() {
	const b = document.getElementById("fwGate");
	if (!b) return;
	const k = b.querySelector(".fw-card");
	if (k) k.classList.add("karte-weg");
	b.classList.remove("an");
	setTimeout(function() {
		if (b.parentNode) b.remove();
	}, 280);
}
function firmaGewaehlt(i) {
	const t = (window._fwTreffer || [])[i];
	const antwort = window._fwAntwort;
	fwSchliessen();
	window._fwTreffer = null;
	window._fwAntwort = null;
	if (antwort) antwort(t ? {
		art: "weiter",
		auswahl: t
	} : { art: "weiter" });
}
function firmaEigene() {
	const antwort = window._fwAntwort;
	fwSchliessen();
	window._fwTreffer = null;
	window._fwAntwort = null;
	if (antwort) antwort({ art: "weiter" });
}
function firmaAbbruch() {
	const antwort = window._fwAntwort;
	fwSchliessen();
	window._fwTreffer = null;
	window._fwAntwort = null;
	if (antwort) antwort({ art: "abbruch" });
}
var TRL_KYR = {
	"а": "a",
	"б": "b",
	"в": "v",
	"г": "g",
	"д": "d",
	"е": "e",
	"ё": "e",
	"ж": "zh",
	"з": "z",
	"и": "i",
	"й": "y",
	"к": "k",
	"л": "l",
	"м": "m",
	"н": "n",
	"о": "o",
	"п": "p",
	"р": "r",
	"с": "s",
	"т": "t",
	"у": "u",
	"ф": "f",
	"х": "h",
	"ц": "ts",
	"ч": "ch",
	"ш": "sh",
	"щ": "sht",
	"ъ": "a",
	"ы": "y",
	"ь": "",
	"э": "e",
	"ю": "yu",
	"я": "ya",
	"і": "i",
	"ї": "yi",
	"є": "ye",
	"ґ": "g",
	"ђ": "dj",
	"ј": "j",
	"љ": "lj",
	"њ": "nj",
	"ћ": "c",
	"џ": "dz",
	"ѝ": "i"
};
var TRL_GR = {
	"α": "a",
	"β": "v",
	"γ": "g",
	"δ": "d",
	"ε": "e",
	"ζ": "z",
	"η": "i",
	"θ": "th",
	"ι": "i",
	"κ": "k",
	"λ": "l",
	"μ": "m",
	"ν": "n",
	"ξ": "x",
	"ο": "o",
	"π": "p",
	"ρ": "r",
	"σ": "s",
	"ς": "s",
	"τ": "t",
	"υ": "y",
	"φ": "f",
	"χ": "ch",
	"ψ": "ps",
	"ω": "o"
};
var _NICHT_LATEIN = null;
try {
	_NICHT_LATEIN = new RegExp("[\\p{Script=Cyrillic}\\p{Script=Greek}\\p{Script=Arabic}\\p{Script=Hebrew}\\p{Script=Armenian}\\p{Script=Georgian}\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}\\p{Script=Thai}\\p{Script=Devanagari}]", "u");
} catch (e) {
	_NICHT_LATEIN = /[Ͱ-ϿЀ-ԯ԰-֏֐-׿؀-ۿႠ-ჿ฀-๿ऀ-ॿ぀-ヿ一-鿿가-힯]/;
}
function istNichtLatein(t) {
	return _NICHT_LATEIN.test(String(t || ""));
}
function translitRoh(text) {
	const z = Array.from(String(text == null ? "" : text));
	let out = "";
	z.forEach(function(ch, i) {
		const klein = ch.toLowerCase();
		let lat = TRL_KYR[klein];
		if (lat === undefined) lat = TRL_GR[klein];
		if (lat === undefined) {
			const basis = klein.normalize ? klein.normalize("NFD").charAt(0) : klein;
			if (TRL_GR[basis] !== undefined) lat = TRL_GR[basis];
		}
		if (lat === undefined) {
			out += ch;
			return;
		}
		if (ch !== klein && lat) {
			const nb = z[i + 1] || "", nbGross = nb && nb !== nb.toLowerCase() && nb === nb.toUpperCase();
			lat = nbGross || lat.length > 1 && (z[i - 1] || "") !== (z[i - 1] || "").toLowerCase() ? lat.toUpperCase() : lat.charAt(0).toUpperCase() + lat.slice(1);
		}
		out += lat;
	});
	return out;
}
function translitLatein(text) {
	let t = translitRoh(text);
	try {
		t = t.normalize("NFD").replace(/[̀-ͯ]/g, "");
	} catch (e) {}
	return t.toLowerCase().replace(/ß/g, "ss");
}
function suchLocker(t) {
	return String(t || "").replace(/ck/g, "k").replace(/ph/g, "f").replace(/[cq]/g, "k").replace(/w/g, "v").replace(/[yj]/g, "i").replace(/z/g, "s").replace(/x/g, "ks").replace(/(.)\1+/g, "$1");
}
function translitTitel(text) {
	return translitRoh(text).replace(/(^|[\s\-\/("„'.])(\p{Ll})/gu, function(m, a, b) {
		return a + b.toUpperCase();
	});
}
function nameOriginalWert(v) {
	v = v == null ? "" : String(v).trim();
	return !v || v === "null" || v === "N/A" ? "" : v;
}
function nameAnzeige(name, original) {
	const roh = String(name || "").trim();
	let orig = nameOriginalWert(original), haupt = roh;
	if (roh && istNichtLatein(roh)) {
		haupt = translitTitel(roh);
		if (!orig) orig = roh;
	}
	if (orig && orig.toLowerCase() === haupt.toLowerCase()) orig = "";
	return {
		haupt,
		original: orig
	};
}
function nameOriginalHTML(n, klasse) {
	return n && n.original ? "<div class=\"" + (klasse || "name-original") + "\" data-tr=\"aus\">Originalname: " + escapeHtml(n.original) + "</div>" : "";
}
function suchSchluessel(r) {
	const rj = r && r.report_json || {};
	const teile = [
		r && r.firmenname,
		rj.firmenname,
		nameOriginalWert(rj.firmennameOriginal)
	].filter(Boolean).map(String);
	const lat = teile.map(translitLatein);
	return teile.map(function(x) {
		return x.toLowerCase();
	}).concat(lat, lat.map(suchLocker)).join("  ");
}
function firmennameAbsichern(d, rawName) {
	if (!d) return;
	const orig = nameOriginalWert(d.firmennameOriginal);
	if (orig) d.firmennameOriginal = orig;
	else if (d.firmennameOriginal !== undefined) d.firmennameOriginal = null;
	const roh = String(d.firmenname || "").trim();
	if (!roh || !istNichtLatein(roh)) {
		if (d.firmennameOriginal && d.firmennameOriginal.toLowerCase() === roh.toLowerCase()) d.firmennameOriginal = null;
		return;
	}
	if (!d.firmennameOriginal) d.firmennameOriginal = roh;
	const eingabeFeld = document.getElementById("nameInput");
	const kandidaten = [
		rawName,
		eingabeFeld && eingabeFeld.value,
		typeof FIRMA_AUSWAHL !== "undefined" && FIRMA_AUSWAHL ? FIRMA_AUSWAHL.name : ""
	];
	const eingabe = kandidaten.map(function(x) {
		return String(x || "").trim();
	}).filter(function(x) {
		return x && !istNichtLatein(x);
	})[0];
	d.firmenname = eingabe || translitTitel(roh);
}
function firmenKern(n) {
	return String(n || "").toLowerCase().replace(/\b(gmbh|ag|kg|ohg|ug|mbh|se|e\.?k\.?|gbr|ltd|limited|inc|corp|s\.?a\.?|b\.?v\.?|n\.?v\.?|co|kgaa|haftungsbeschr(ä|ae)nkt)\b/g, " ").replace(/[^a-z0-9äöüß]+/g, " ").trim();
}
async function findeFruehereAnalyse(name) {
	if (!sb || !CURRENT_FIRMA) return null;
	const kern = firmenKern(translitLatein(name));
	if (kern.length < 3) return null;
	try {
		const { data } = await sb.from("analysen").select("id, pruef_id, firmenname, land, score, verdict, verdict_text, created_at, report_json").eq("firma_id", CURRENT_FIRMA.firma_id).order("created_at", { ascending: false }).limit(60);
		if (!data || !data.length) return null;
		const treffer = data.find(function(r) {
			const orig = r.report_json && r.report_json.firmennameOriginal;
			return firmenKern(translitLatein(r.firmenname)) === kern || !!orig && firmenKern(translitLatein(String(orig))) === kern;
		});
		return treffer || null;
	} catch (e) {
		return null;
	}
}
function zeigeDuplikatHinweis(alt) {
	const d = new Date(alt.created_at);
	const datum = d.toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "long",
		year: "numeric"
	});
	const tage = Math.max(0, Math.round((Date.now() - d.getTime()) / 864e5));
	const wieLange = tage === 0 ? "heute" : tage === 1 ? "gestern" : "vor " + tage + " Tagen";
	anzeigeDeckel(alt);
	const farbe = alt.score >= 75 ? "gruen" : alt.score >= 50 ? "gelb" : "rot";
	const box = document.createElement("div");
	box.id = "dupGate";
	box.className = "up-warn-back dup-back";
	box.innerHTML = "<div class=\"up-warn-card dup-card\">" + "<div class=\"dup-ico\">↻</div>" + "<div class=\"up-warn-t\">Diese Firma wurde bereits geprüft</div>" + "<div class=\"up-warn-d\">Es liegt schon eine Analyse zu diesem Unternehmen vor. Du kannst sie öffnen – oder eine neue Prüfung starten, die dein Kontingent verbraucht.</div>" + "<div class=\"dup-karte\">" + "<div class=\"dup-name\">" + escapeHtml(alt.firmenname || "") + "</div>" + "<div class=\"dup-meta\">" + escapeHtml(alt.land || "") + " · geprüft am " + datum + " (" + wieLange + ")</div>" + "<div class=\"dup-score dup-" + farbe + "\"><b>" + (alt.score != null ? alt.score : "–") + "</b><span>" + escapeHtml(alt.verdict_text || "") + "</span></div>" + "</div>" + "<div class=\"up-warn-btns\">" + "<button class=\"kyc-btn\" data-act-click=\"h158\">Trotzdem neu prüfen</button>" + "<button class=\"up-senden dup-ok\" data-act-click=\"h159\">Vorhandene Akte öffnen</button>" + "</div></div>";
	document.body.appendChild(box);
	DUP_TREFFER = alt;
	einblenden(box);
}
var DUP_TREFFER = null;
function dupSchliessen() {
	const b = document.getElementById("dupGate");
	if (!b) return;
	b.classList.remove("an");
	setTimeout(function() {
		if (b.parentNode) b.remove();
	}, 260);
}
function dupOeffnen() {
	const alt = DUP_TREFFER;
	dupSchliessen();
	if (!alt || !alt.report_json) return;
	setTimeout(function() {
		document.getElementById("emptyState").style.display = "none";
		showReport(alt.report_json, alt.firmenname, true);
		window.scrollTo({
			top: 0,
			behavior: "smooth"
		});
	}, 220);
}
function dupNeuePruefung() {
	dupSchliessen();
	setTimeout(function() {
		startSearch(true);
	}, 200);
}
var WUNSCH_PAKET = (function() {
	try {
		return localStorage.getItem("cc_wunsch_paket") || "";
	} catch (e) {
		return "";
	}
})();
function wunschPaketVergessen() {
	WUNSCH_PAKET = "";
	try {
		localStorage.removeItem("cc_wunsch_paket");
	} catch (e) {}
}
function druckDateiname() {
	const roh = (DRUCK_NAME || "").trim();
	if (!roh) return DT().pruefung + " - " + new Date().toLocaleDateString(druckSprache() === "en" ? "en-GB" : "de-DE");
	const sauber = roh.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 70);
	const d = new Date();
	const datum = ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear();
	return sauber + " - " + (DRUCK_TEIL || DT().pruefung) + (DRUCK_ID ? " - " + DRUCK_ID : "") + " - " + datum + (akteEntwurf() ? DT().dateiEntwurf : "");
}
function akteWirdAngezeigt() {
	const rep = document.getElementById("report");
	return !!(typeof CURRENT_REPORT !== "undefined" && CURRENT_REPORT && rep && rep.getClientRects().length);
}
function akteEntwurf() {
	if (API_RENDER) return false;
	return akteWirdAngezeigt() && !CURRENT_REPORT._abgeschlossen_am;
}
function druckOhneBrowserKopf() {
	try {
		return !!(window.CSS && CSS.supports && CSS.supports("box-decoration-break", "clone") && /(Chrome|Chromium|Edg)\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent));
	} catch (e) {
		return false;
	}
}
var DRUCK_OHNE_KOPF_CSS = "@page { margin: 0 !important; }" + "@media print {" + " html, body { margin: 0 !important; }" + " body { padding: 1.4cm !important; box-decoration-break: clone; -webkit-box-decoration-break: clone; }" + " #printWatermark .wm-fuss { bottom: 6mm !important; }" + " .druck-wz-fuss { bottom: 11mm !important; }" + "}";
function druckRandSetzen(an) {
	let st = document.getElementById("druckOhneKopf");
	if (an && druckOhneBrowserKopf()) {
		if (!st) {
			st = document.createElement("style");
			st.id = "druckOhneKopf";
			st.textContent = DRUCK_OHNE_KOPF_CSS;
			document.head.appendChild(st);
		}
	} else if (!an && st) {
		st.remove();
	}
}
function druckEntwurfVorbereiten() {
	try {
		document.body.classList.toggle("druck-einzelakte", !!akteWirdAngezeigt());
	} catch (e) {}
	druckRandSetzen(true);
	druckWasserzeichenAktualisieren();
	const offen = akteEntwurf();
	document.body.classList.toggle("druck-entwurf", offen);
	if (API_RENDER) {
		["druckWz", "druckEntwurfBanner"].forEach(function(id) {
			const x = document.getElementById(id);
			if (x) x.remove();
		});
		apiPdfZeileSetzen();
	}
	if (!offen) return false;
	const jetzt = druckZeitText();
	const id = CURRENT_REPORT.pruefId || DRUCK_ID || "";
	let wz = document.getElementById("druckWz");
	if (!wz) {
		wz = document.createElement("div");
		wz.id = "druckWz";
		wz.className = "druck-wz";
		wz.setAttribute("aria-hidden", "true");
		document.body.appendChild(wz);
	}
	wz.innerHTML = "<div class=\"druck-wz-diag\">" + DT().wzDiag + "</div>" + "<div class=\"druck-wz-fuss\">" + DT().wzFuss + escapeHtml(jetzt) + "</div>";
	let ban = document.getElementById("druckEntwurfBanner");
	if (!ban) {
		ban = document.createElement("div");
		ban.id = "druckEntwurfBanner";
		ban.className = "druck-entwurf-banner";
		document.body.insertBefore(ban, document.body.firstChild);
	}
	ban.innerHTML = "<div class=\"deb-titel\">⚠︎ " + DT().banTitel + "</div>" + "<div class=\"deb-text\">" + DT().banText1 + escapeHtml(jetzt) + DT().banText2 + (id ? DT().banAkte + escapeHtml(id) : "") + DT().banText3 + "</div>";
	return true;
}
function druckEntwurfAufraeumen() {
	document.body.classList.remove("druck-entwurf");
	document.body.classList.remove("druck-einzelakte");
	druckRandSetzen(false);
}
try {
	window.addEventListener("beforeprint", druckEntwurfVorbereiten);
	window.addEventListener("afterprint", druckEntwurfAufraeumen);
	if (window.matchMedia) {
		const mqDruck = window.matchMedia("print");
		const aufDruck = function(e) {
			if (e.matches) druckEntwurfVorbereiten();
			else druckEntwurfAufraeumen();
		};
		if (mqDruck.addEventListener) mqDruck.addEventListener("change", aufDruck);
		else if (mqDruck.addListener) mqDruck.addListener(aufDruck);
	}
} catch (e) {}
function druckenMoeglich() {
	const ua = navigator.userAgent || "";
	const iOS = /iPhone|iPad|iPod/.test(ua);
	if (!iOS) return true;
	const fremd = [
		"CriOS",
		"FxiOS",
		"EdgiOS",
		"OPT/",
		"YaBrowser",
		"DuckDuckGo",
		"Brave"
	].some(function(k) {
		return ua.indexOf(k) >= 0;
	});
	return !fremd;
}
var DRUCK_TEIL_NAME = {
	gesamt: "Akte",
	analyse: "Analyse",
	sanktion: "Sanktionsabgleich",
	dokumente: "Dokumente",
	endverbleib: "Endverbleibserklärung"
};
var DRUCK_KLASSEN = [
	"druck-analyse",
	"druck-sanktion",
	"druck-dokumente",
	"druck-endverbleib"
];
function druckBereichAufraeumen() {
	document.body.classList.remove.apply(document.body.classList, DRUCK_KLASSEN);
	document.querySelectorAll(".kyc-print-page.erste").forEach(function(p) {
		p.classList.remove("erste");
	});
	setDRUCK_TEIL("");
}
var _DRUCK_SPRACHE_AKTE = {};
function druckRegionSprache(n) {
	const p = n && n.parentNode;
	if (!p || !p.closest) return "de";
	const sec = p.closest("section.ordner-akte[data-analyse-id]");
	if (sec) {
		const id = sec.getAttribute("data-analyse-id");
		if (!_DRUCK_SPRACHE_AKTE[id]) {
			const row = (typeof HISTORY_ROWS !== "undefined" && HISTORY_ROWS || []).find(function(r) {
				return r.id === id;
			});
			_DRUCK_SPRACHE_AKTE[id] = berichtSprache(row && row.report_json);
		}
		return _DRUCK_SPRACHE_AKTE[id];
	}
	if (p.closest("#report")) return berichtSprache(typeof CURRENT_REPORT !== "undefined" ? CURRENT_REPORT : null);
	return "de";
}
function _druckBrauchtUebersetzung(q, ziel, region) {
	if (ziel === "en") return _TR_CACHE[q] !== undefined || textSprache(q) !== "en";
	const s = textSprache(q);
	if (s) return s === "en";
	return region === "en";
}
function druckHinweisSetzen(w, sprache) {
	const txt = sprache === "en" ? "Note: the translation service was not available – AI-generated texts are shown in their original language." : "Hinweis: Die Übersetzung war nicht verfügbar – KI-generierte Texte stehen in der Originalsprache.";
	w.wurzeln.forEach(function(r) {
		const ziele = w.ordner ? r.querySelectorAll("section.ordner-akte") : [r];
		Array.prototype.forEach.call(ziele, function(z) {
			const h = document.createElement("div");
			h.className = "druck-orig-hinweis";
			h.setAttribute("data-tr", "aus");
			h.textContent = txt;
			z.insertBefore(h, z.firstChild);
		});
	});
}
function druckHinweisWeg() {
	Array.prototype.forEach.call(document.querySelectorAll(".druck-orig-hinweis"), function(e) {
		e.remove();
	});
}
var MONATE_EN = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec"
];
function datumEN(t) {
	return String(t).replace(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g, function(m, d, mo, y) {
		const i = parseInt(mo, 10) - 1;
		return i >= 0 && i < 12 ? parseInt(d, 10) + " " + MONATE_EN[i] + " " + y : m;
	}).replace(/(\d{1,2}:\d{2}) Uhr\b/g, "$1");
}
function druckWurzeln() {
	const av = document.getElementById("akteView");
	const ordner = !!(av && av.getClientRects().length && av.querySelector(".ordner-akte, .akte-cover"));
	if (ordner) return {
		ordner: true,
		wurzeln: [av]
	};
	const rep = document.getElementById("report");
	return {
		ordner: false,
		wurzeln: rep ? [rep] : []
	};
}
function druckAnalyseIds(w) {
	if (w.ordner) return Array.prototype.map.call(w.wurzeln[0].querySelectorAll("section.ordner-akte[data-analyse-id]"), function(s) {
		return s.getAttribute("data-analyse-id");
	});
	const id = typeof KYC !== "undefined" && KYC && KYC.analyseId || CURRENT_REPORT && CURRENT_REPORT._analyseId;
	return id ? [id] : [];
}
function druckFehlendeTexte(wurzeln, ziel) {
	ziel = ziel === "de" ? "de" : "en";
	const cache = _trCache(ziel), offen = [];
	wurzeln.forEach(function(r) {
		_trKnoten(r).forEach(function(n) {
			const q = (_LANG_DE.get(n) || "").trim();
			if (!q || !_trUebersetzbar(q) || cache[q] !== undefined || offen.indexOf(q) >= 0) return;
			if (_druckBrauchtUebersetzung(q, ziel, druckRegionSprache(n))) offen.push(q);
		});
	});
	return offen;
}
function druckSpracheSetzen(wurzeln, sprache) {
	const ziel = sprache === "en" ? "en" : "de", cache = _trCache(ziel);
	wurzeln.forEach(function(r) {
		hrSpracheAnwenden(r, ziel);
		_trKnoten(r).forEach(function(n) {
			const orig = _LANG_DE.get(n);
			if (orig === undefined) return;
			const q = orig.trim(), t = cache[q];
			let neu = t !== undefined && t !== null && _druckBrauchtUebersetzung(q, ziel, druckRegionSprache(n)) ? orig.replace(q, t) : orig;
			if (ziel === "en") neu = datumEN(neu);
			n.nodeValue = neu;
		});
	});
}
function druckSpracheZurueck(wurzeln) {
	wurzeln.forEach(function(r) {
		hrSpracheAnwenden(r, LANG);
		_trKnoten(r).forEach(function(n) {
			const orig = _LANG_DE.get(n);
			if (orig === undefined) return;
			if (LANG !== "en") {
				n.nodeValue = orig;
				return;
			}
			const de = orig.trim(), en = _TR_CACHE[de];
			n.nodeValue = en !== undefined && en !== null ? orig.replace(de, en) : orig;
		});
	});
}
async function druckUebersetzungenSicherstellen(w, ziel) {
	ziel = ziel === "de" ? "de" : "en";
	const ids = druckAnalyseIds(w), gespeichert = {}, cache = _trCache(ziel);
	try {
		if (ids.length && sb) {
			const { data, error } = await sb.from("analysen").select("id, uebersetzungen").in("id", ids);
			if (!error) (data || []).forEach(function(r) {
				gespeichert[r.id] = r && r.uebersetzungen || {};
				["en", "de"].forEach(function(z) {
					const m = gespeichert[r.id][z], c = _trCache(z);
					if (m && typeof m === "object") Object.keys(m).forEach(function(q) {
						if (c[q] === undefined && typeof m[q] === "string") c[q] = m[q];
					});
				});
			});
		}
	} catch (e) {}
	const offen = druckFehlendeTexte(w.wurzeln, ziel);
	let fehler = false;
	if (offen.length) {
		const pakete = [];
		let akt = [], zeichen = 0;
		offen.forEach(function(t) {
			if (akt.length >= 25 || zeichen + t.length > 6e3) {
				if (akt.length) pakete.push(akt);
				akt = [];
				zeichen = 0;
			}
			akt.push(t);
			zeichen += t.length;
		});
		if (akt.length) pakete.push(akt);
		for (let i = 0; i < pakete.length; i++) {
			druckStatusText((LANG === "en" ? "Translating … " : "Übersetzung … ") + Math.round((i + 1) / pakete.length * 100) + " %");
			try {
				await _trPaket(pakete[i], 0, ziel, true);
			} catch (e) {
				fehler = true;
				break;
			}
		}
		try {
			_trSpeichern();
		} catch (e) {}
	}
	for (const id of ids) {
		try {
			const bereich = w.ordner ? w.wurzeln[0].querySelector("section.ordner-akte[data-analyse-id=\"" + id + "\"]") : w.wurzeln[0];
			if (!bereich) continue;
			const alt = gespeichert[id] || {}, m = Object.assign({}, alt[ziel] || {});
			let neu = 0;
			_trKnoten(bereich).forEach(function(n) {
				const q = (_LANG_DE.get(n) || "").trim(), t = cache[q];
				if (q && typeof t === "string" && m[q] !== t && Object.keys(m).length < 3e3 && _druckBrauchtUebersetzung(q, ziel, druckRegionSprache(n))) {
					m[q] = t;
					neu++;
				}
			});
			if (neu && sb) {
				const daten = Object.assign({}, alt);
				daten[ziel] = m;
				await sb.from("analysen").update({ uebersetzungen: daten }).eq("id", id);
			}
		} catch (e) {}
	}
	return { fehler: fehler || druckFehlendeTexte(w.wurzeln, ziel).length > 0 };
}
function exportProtokollieren(bereich, sprache, ordner) {
	try {
		if (!sb) return;
		const ids = druckAnalyseIds({
			ordner: false,
			wurzeln: []
		});
		sb.rpc("export_protokollieren", {
			p_analyse: ordner ? null : ids[0] || null,
			p_ordner: ordner ? ORDNER_DRUCK_ID : null,
			p_bereich: bereich || "gesamt",
			p_sprache: sprache
		}).then(function() {}, function() {});
	} catch (e) {}
}
function druckStatus(art, fehlertext, weiter) {
	let el = document.getElementById("druckStatus");
	if (!art) {
		if (el) {
			el.classList.add("weg");
			setTimeout(function() {
				const x = document.getElementById("druckStatus");
				if (x && x.classList.contains("weg")) x.remove();
			}, 200);
		}
		return;
	}
	if (!el) {
		el = document.createElement("div");
		el.id = "druckStatus";
		el.setAttribute("data-tr", "aus");
		el.setAttribute("role", "status");
		el.setAttribute("aria-live", "polite");
		document.body.appendChild(el);
	}
	el.className = "ds-status " + art;
	const en = LANG === "en";
	if (art === "laeuft") {
		el.innerHTML = "<div class=\"ds-karte\"><span class=\"neu-spin\"></span><div class=\"ds-txt\"><b>" + (en ? "Generating PDF …" : "PDF wird erstellt …") + "</b><small id=\"druckStatusText\">" + (en ? "Preparing all pages and texts" : "Alle Seiten und Texte werden vorbereitet") + "</small></div></div>";
	} else if (art === "bereit") {
		el.innerHTML = "<div class=\"ds-karte\"><span class=\"neu-ico\">✓</span><div class=\"ds-txt\"><b>" + (en ? "PDF is ready" : "PDF ist bereit") + "</b><small>" + (en ? "Click to open the print dialog." : "Zum Öffnen des Druckdialogs klicken.") + "</small></div><button type=\"button\" class=\"ds-btn\" id=\"druckStatusOk\">" + (en ? "Open PDF" : "PDF öffnen") + "</button></div>";
		const b = document.getElementById("druckStatusOk");
		if (b) {
			b.onclick = weiter;
			b.focus();
		}
	} else {
		el.innerHTML = "<div class=\"ds-karte\"><span class=\"neu-ico ds-x\">!</span><div class=\"ds-txt\"><b>" + (en ? "PDF could not be created" : "PDF konnte nicht erstellt werden") + "</b><small>" + escapeHtml(fehlertext || "") + "</small></div><button type=\"button\" class=\"ds-btn ds-btn-2\" data-act-click=\"h160\">" + (en ? "Close" : "Schließen") + "</button></div>";
	}
}
function druckStatusText(t) {
	const x = document.getElementById("druckStatusText");
	if (x) x.textContent = t;
}
function druckFertig(w, nachher) {
	const zurueck = function() {
		try {
			druckHinweisWeg();
		} catch (e) {}
		try {
			druckSpracheZurueck(w.wurzeln);
		} catch (e) {}
		setDRUCK_SPRACHE(null);
		try {
			if (w.ordner) buildAkteWatermark(DRUCK_NAME);
		} catch (e) {}
		if (nachher) {
			try {
				nachher();
			} catch (e) {}
		}
	};
	let erledigt = false;
	const einmal = function() {
		if (erledigt) return;
		erledigt = true;
		window.removeEventListener("afterprint", einmal);
		zurueck();
	};
	return einmal;
}
function druckAusloesen(w, bereich, nachher) {
	const fertig = druckFertig(w, nachher);
	window.addEventListener("afterprint", fertig);
	try {
		druckeJetztKern(bereich);
	} finally {
		setTimeout(fertig, 400);
	}
}
async function druckeInSprache(bereich, sprache) {
	if (DRUCK_LAEUFT) return;
	const w = druckWurzeln();
	setDRUCK_SPRACHE(sprache);
	if (!druckFehlendeTexte(w.wurzeln, sprache).length && !pdfAnlagenOffen(bereich)) {
		druckSpracheSetzen(w.wurzeln, sprache);
		if (w.ordner) buildAkteWatermark(DRUCK_NAME);
		exportProtokollieren(bereich, sprache, w.ordner);
		druckAusloesen(w, bereich);
		return;
	}
	setDRUCK_LAEUFT(true);
	druckStatus("laeuft");
	try {
		const t0 = Date.now();
		while (pdfAnlagenOffen(bereich) && Date.now() - t0 < 6e4) {
			try {
				kycPdfVorbereiten();
			} catch (e) {}
			await ordnerWarte(400);
		}
		const erg = await druckUebersetzungenSicherstellen(w, sprache);
		druckSpracheSetzen(w.wurzeln, sprache);
		if (erg.fehler) druckHinweisSetzen(w, sprache);
		if (w.ordner) buildAkteWatermark(DRUCK_NAME);
		exportProtokollieren(bereich, sprache, w.ordner);
		const meldung = erg.fehler ? function() {
			try {
				zeigeToast(LANG === "en" ? "PDF created in the original language" : "PDF in Originalsprache erstellt", LANG === "en" ? "The translation was not available. AI-generated texts remain in their original language – please try again later." : "Die Übersetzung war nicht erreichbar. KI-generierte Texte stehen in der Originalsprache – bitte später erneut versuchen.");
			} catch (e) {}
		} : null;
		const safari = /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent);
		const aktiv = !navigator.userActivation || navigator.userActivation.isActive;
		if (safari && !aktiv) druckStatus("bereit", "", function() {
			druckStatus(null);
			druckAusloesen(w, bereich, meldung);
		});
		else {
			druckStatus(null);
			druckAusloesen(w, bereich, meldung);
		}
	} catch (e) {
		try {
			druckHinweisWeg();
			druckSpracheZurueck(w.wurzeln);
		} catch (x) {}
		setDRUCK_SPRACHE(null);
		druckStatus("fehler", e && e.message || "");
	} finally {
		setDRUCK_LAEUFT(false);
	}
}
function druckSpracheWaehlen(bereich) {
	const alt = document.getElementById("druckSprachWahl");
	if (alt) alt.remove();
	const en = LANG === "en";
	let wahl = en ? "en" : "de";
	const vorher = document.activeElement;
	const el = document.createElement("div");
	el.id = "druckSprachWahl";
	el.className = "dsw";
	el.setAttribute("data-tr", "aus");
	el.setAttribute("role", "dialog");
	el.setAttribute("aria-modal", "true");
	el.setAttribute("aria-labelledby", "dswT");
	const opt = function(code, name, unter) {
		return "<button type=\"button\" class=\"dsw-opt\" role=\"radio\" data-l=\"" + code + "\"><span class=\"dsw-flag\">" + code.toUpperCase() + "</span><span class=\"dsw-name\"><b>" + name + "</b><small>" + unter + "</small></span><span class=\"dsw-haken\" aria-hidden=\"true\"></span></button>";
	};
	el.innerHTML = "<div class=\"dsw-karte\">" + "<div class=\"dsw-t\" id=\"dswT\">" + (en ? "Language of the PDF" : "Sprache des PDFs") + "</div>" + "<div class=\"dsw-d\">" + (en ? "The interface stays in its current language." : "Die Oberfläche bleibt in ihrer Sprache.") + "</div>" + "<div class=\"dsw-opts\" role=\"radiogroup\" aria-labelledby=\"dswT\">" + opt("de", "Deutsch", en ? "German" : "Originalsprache der Akte") + opt("en", "English", en ? "Translated where needed" : "Wird bei Bedarf übersetzt") + "</div><div class=\"dsw-btns\"><button type=\"button\" class=\"dsw-ab\">" + (en ? "Cancel" : "Abbrechen") + "</button>" + "<button type=\"button\" class=\"dsw-ok\">" + (en ? "Create PDF" : "PDF erstellen") + "</button></div></div>";
	document.body.appendChild(el);
	const opts = el.querySelectorAll(".dsw-opt");
	const zeigen = function() {
		Array.prototype.forEach.call(opts, function(o) {
			const an = o.getAttribute("data-l") === wahl;
			o.classList.toggle("an", an);
			o.setAttribute("aria-checked", an ? "true" : "false");
			o.tabIndex = an ? 0 : -1;
		});
	};
	const zu = function() {
		document.removeEventListener("keydown", taste, true);
		el.classList.add("weg");
		setTimeout(function() {
			el.remove();
		}, 170);
		try {
			if (vorher && vorher.focus) vorher.focus();
		} catch (e) {}
	};
	const los = function() {
		document.removeEventListener("keydown", taste, true);
		el.remove();
		druckeInSprache(bereich, wahl);
	};
	const taste = function(e) {
		if (e.key === "Escape") {
			e.preventDefault();
			zu();
		} else if (e.key === "Enter" && !(e.target && e.target.classList && e.target.classList.contains("dsw-ab"))) {
			e.preventDefault();
			los();
		} else if (/^Arrow(Left|Right|Up|Down)$/.test(e.key)) {
			e.preventDefault();
			wahl = wahl === "de" ? "en" : "de";
			zeigen();
			const o = el.querySelector(".dsw-opt.an");
			if (o) o.focus();
		}
	};
	Array.prototype.forEach.call(opts, function(o) {
		o.onclick = function() {
			wahl = o.getAttribute("data-l");
			zeigen();
		};
		o.ondblclick = los;
	});
	el.querySelector(".dsw-ab").onclick = zu;
	el.querySelector(".dsw-ok").onclick = los;
	el.addEventListener("click", function(e) {
		if (e.target === el) zu();
	});
	document.addEventListener("keydown", taste, true);
	zeigen();
	const ok = el.querySelector(".dsw-ok");
	if (ok) ok.focus();
}
(function() {
	const a0 = window.alert, c0 = window.confirm;
	function sofort(m) {
		if (LANG !== "en" || m == null) return m;
		return String(m).split("\n").map(function(z) {
			const s = z.trim();
			if (!s) return z;
			const en = _TR_CACHE[s];
			if (en === undefined && _trUebersetzbar(s)) {
				try {
					_trPaket([s], 0).then(_trSpeichern, function() {});
				} catch (e) {}
			}
			return en !== undefined && en !== null ? z.replace(s, en) : z;
		}).join("\n");
	}
	window.alert = function(m) {
		return a0.call(window, sofort(m));
	};
	window.confirm = function(m) {
		return c0.call(window, sofort(m));
	};
})();
function druckeJetzt(bereich) {
	druckSpracheWaehlen(bereich || "gesamt");
}
function druckeJetztKern(bereich) {
	bereich = bereich || "gesamt";
	druckBereichAufraeumen();
	if (bereich !== "gesamt") {
		document.body.classList.add("druck-" + bereich);
		if (bereich === "dokumente" || bereich === "endverbleib") {
			const typen = bereich === "dokumente" ? [
				"ausweis",
				"selfie",
				"standort",
				"beleg"
			] : ["endverbleib"];
			const erste = Array.prototype.slice.call(document.querySelectorAll(".kyc-print-page")).find(function(p) {
				return typen.indexOf(p.getAttribute("data-typ")) >= 0;
			});
			if (erste) erste.classList.add("erste");
		}
	}
	setDRUCK_TEIL(DT().teile[bereich] || DRUCK_TEIL_NAME[bereich] || "");
	if (!druckenMoeglich()) {
		druckAusweg();
		return;
	}
	if (pdfAnlagenOffen(bereich)) {
		druckBereichAufraeumen();
		KYC.druckWartet = true;
		try {
			zeigeToast("PDF-Anlagen werden vorbereitet", "Die PDF-Dateien der Akte werden gerade für den Ausdruck aufbereitet. Bitte in ein paar Sekunden erneut auf Drucken klicken.");
		} catch (e) {}
		try {
			kycPdfVorbereiten();
		} catch (e) {}
		return;
	}
	try {
		const offen = typeof ERGAENZUNGEN !== "undefined" ? Object.keys(ERGAENZUNGEN).length : 0;
		if (BEARBEITEN_AN && offen) {
			const weiter = confirm("Du hast " + offen + " Angabe" + (offen === 1 ? "" : "n") + " ergänzt, aber noch nicht auf „Neu bewerten“ geklickt.\n\n" + "Der Ausdruck würde diese Angaben ohne Neubewertung und ohne Speicherung enthalten.\n\n" + "Trotzdem drucken? (Abbrechen = erst neu bewerten)");
			if (!weiter) return;
		}
	} catch (e) {}
	const alterTitel = document.title;
	try {
		["helpPop", "trOverlay"].forEach(function(id) {
			const e = document.getElementById(id);
			if (e) e.style.display = "none";
		});
		document.querySelectorAll(".tr-toast").forEach(function(t) {
			t.remove();
		});
		druckEntwurfVorbereiten();
		document.title = druckDateiname();
	} catch (e) {}
	try {
		window.print();
	} catch (e) {
		druckHinweis();
	}
	setTimeout(function() {
		document.title = alterTitel;
	}, 3e3);
	const aufraeumen = setTimeout(druckBereichAufraeumen, 6e4);
	try {
		window.addEventListener("afterprint", function zurueck() {
			document.title = alterTitel;
			clearTimeout(aufraeumen);
			druckBereichAufraeumen();
			window.removeEventListener("afterprint", zurueck);
		});
	} catch (e) {}
}
function druckHinweis() {
	const mobil = /iPhone|iPad|Android/i.test(navigator.userAgent);
	alert(mobil ? "Bitte nutze die Teilen-Funktion deines Browsers und wähle dort „Drucken“ oder „Als PDF sichern“." : "Der Druckdialog konnte nicht geöffnet werden. Bitte nutze Strg+P bzw. Cmd+P.");
}
function druckAusweg() {
	const box = document.createElement("div");
	box.id = "druckGate";
	box.className = "up-warn-back";
	box.innerHTML = "<div class=\"up-warn-card druck-card\">" + "<div class=\"druck-ico\"><svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + "<polyline points=\"6 9 6 2 18 2 18 9\"/><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\"/></svg></div>" + "<div class=\"up-warn-t\">PDF-Export in diesem Browser</div>" + "<div class=\"up-warn-d\">Dieser Browser unterstützt das Drucken auf dem iPhone leider nicht. Du hast zwei Möglichkeiten:</div>" + "<div class=\"druck-weg\">" + "<div class=\"druck-weg-n\">1</div>" + "<div><div class=\"druck-weg-t\">In Safari öffnen <span class=\"druck-tipp\">empfohlen</span></div>" + "<div class=\"druck-weg-d\">Dort funktioniert der PDF-Export zuverlässig – du bleibst angemeldet.</div></div>" + "</div>" + "<div class=\"druck-weg\">" + "<div class=\"druck-weg-n\">2</div>" + "<div><div class=\"druck-weg-t\">Teilen-Menü verwenden</div>" + "<div class=\"druck-weg-d\">Unten oder oben auf das Teilen-Symbol tippen und dort „Drucken“ wählen. Im Druckfenster kannst du das PDF sichern.</div></div>" + "</div>" + "<div class=\"up-warn-btns\">" + "<button class=\"kyc-btn\" data-act-click=\"h161\">Schließen</button>" + "<button class=\"up-senden up-warn-ok\" data-act-click=\"h162\">In Safari öffnen</button>" + "</div></div>";
	document.body.appendChild(box);
	einblenden(box);
}
function druckGateZu() {
	const b = document.getElementById("druckGate");
	if (!b) return;
	const karte = b.querySelector(".druck-card");
	if (karte) karte.classList.add("karte-weg");
	b.classList.remove("an");
	setTimeout(function() {
		if (b.parentNode) b.remove();
	}, 280);
}
function inSafariOeffnen() {
	const ziel = location.href.replace(/^https?:\/\//, "");
	druckGateZu();
	setTimeout(function() {
		try {
			location.href = "x-safari-https://" + ziel;
		} catch (e) {
			alert("Bitte öffne die Seite manuell in Safari.");
		}
	}, 260);
}
function setStep(txt) {
	document.getElementById("loadingStep").textContent = txt;
}
var _fortTimer = null;
var _fortStart = 0;
var _fortWert = 0;
var FORT_DAUER = 15e4;
var _fortLang = false;
function _fortLangHinweis(an) {
	if (_fortLang === an) return;
	_fortLang = an;
	const h = document.querySelector("#loading .load-hinweis");
	if (h) h.textContent = an ? "Diese Prüfung braucht länger als üblich (z. B. bei Firmen im Ausland) – das kann bis zu 10 Minuten dauern. Bitte diese Seite geöffnet lassen." : "Bitte diese Seite geöffnet lassen und den Bildschirm nicht sperren, bis die Prüfung fertig ist.";
}
function fortschrittStart() {
	fortschrittStop();
	_fortStart = Date.now();
	_fortWert = 0;
	_fortLangHinweis(false);
	fortschrittSetzen(0, "Dauert meist 2–3 Minuten");
	_fortTimer = setInterval(function() {
		const t = Date.now() - _fortStart;
		let p = 95 * (1 - Math.exp(-t / (FORT_DAUER * .42)));
		if (p < _fortWert) p = _fortWert;
		_fortWert = p;
		const restMs = Math.max(0, FORT_DAUER - t);
		let rest;
		if (t > 24e4) {
			rest = "Gründliche Recherche läuft…";
			_fortLangHinweis(true);
		} else if (p >= 94) rest = "Gleich fertig…";
		else if (restMs > 75e3) rest = "Noch etwa 2 Minuten";
		else if (restMs > 45e3) rest = "Noch etwa 1 Minute";
		else if (restMs > 15e3) rest = "Noch weniger als 1 Minute";
		else rest = "Fast fertig…";
		fortschrittSetzen(p, rest);
	}, 700);
}
function fortschrittSetzen(p, restText) {
	const bar = document.getElementById("loadBarFill");
	const pct = document.getElementById("loadPct");
	const rest = document.getElementById("loadRest");
	if (bar) bar.style.width = p.toFixed(1) + "%";
	if (pct) pct.textContent = Math.round(p) + " %";
	if (rest && restText) rest.textContent = restText;
}
function fortschrittFertig() {
	fortschrittSetzen(100, "Fertig ✓");
	fortschrittStop();
}
function fortschrittStop() {
	if (_fortTimer) {
		clearInterval(_fortTimer);
		_fortTimer = null;
	}
}
function zumTool() {
	try {
		if (typeof CURRENT_FIRMA === "undefined" || !CURRENT_FIRMA) return;
		const gates = [
			"planGate",
			"kontoGate",
			"zahlungGate",
			"uploadGate"
		];
		let offen = false;
		gates.forEach(function(id) {
			const g = document.getElementById(id);
			if (g && g.style.display && g.style.display !== "none") offen = true;
		});
		if (offen) {
			if (typeof hidePlaeneBack === "function") hidePlaeneBack();
			else location.reload();
			return;
		}
		appUnterseitenReset();
		const rep = document.getElementById("report");
		if (rep) rep.classList.remove("active");
		const empty = document.getElementById("emptyState");
		if (empty && rep && !rep.classList.contains("active")) empty.style.display = "";
		window.scrollTo({
			top: 0,
			behavior: "smooth"
		});
	} catch (e) {}
}
var LAENDER = [
	"Deutschland",
	"Österreich",
	"Schweiz",
	"Frankreich",
	"Italien",
	"Spanien",
	"Niederlande",
	"Belgien",
	"Luxemburg",
	"Vereinigtes Königreich",
	"Irland",
	"Portugal",
	"Schweden",
	"Dänemark",
	"Finnland",
	"Norwegen",
	"Polen",
	"Tschechien",
	"Slowakei",
	"Ungarn",
	"Rumänien",
	"Bulgarien",
	"Griechenland",
	"Kroatien",
	"Slowenien",
	"Estland",
	"Lettland",
	"Litauen",
	"Island",
	"Malta",
	"Zypern",
	"Liechtenstein",
	"Monaco",
	"Andorra",
	"San Marino",
	"Vatikanstadt",
	"Vereinigte Staaten",
	"Kanada",
	"Mexiko",
	"Brasilien",
	"Argentinien",
	"Chile",
	"Kolumbien",
	"Peru",
	"Venezuela",
	"Ecuador",
	"Bolivien",
	"Paraguay",
	"Uruguay",
	"Guatemala",
	"Honduras",
	"El Salvador",
	"Nicaragua",
	"Costa Rica",
	"Panama",
	"Kuba",
	"Dominikanische Republik",
	"Haiti",
	"Jamaika",
	"Trinidad und Tobago",
	"Bahamas",
	"Barbados",
	"Belize",
	"Guyana",
	"Suriname",
	"Türkei",
	"Vereinigte Arabische Emirate",
	"Saudi-Arabien",
	"Katar",
	"Kuwait",
	"Bahrain",
	"Oman",
	"Jemen",
	"Israel",
	"Palästina",
	"Jordanien",
	"Libanon",
	"Syrien",
	"Irak",
	"Iran",
	"Ägypten",
	"Afghanistan",
	"Pakistan",
	"Indien",
	"Bangladesch",
	"Sri Lanka",
	"Nepal",
	"Bhutan",
	"Malediven",
	"China",
	"Japan",
	"Südkorea",
	"Nordkorea",
	"Taiwan",
	"Hongkong",
	"Mongolei",
	"Vietnam",
	"Thailand",
	"Kambodscha",
	"Laos",
	"Myanmar",
	"Malaysia",
	"Singapur",
	"Indonesien",
	"Philippinen",
	"Brunei",
	"Osttimor",
	"Kasachstan",
	"Usbekistan",
	"Turkmenistan",
	"Kirgisistan",
	"Tadschikistan",
	"Aserbaidschan",
	"Armenien",
	"Georgien",
	"Russland",
	"Ukraine",
	"Weißrussland",
	"Moldau",
	"Serbien",
	"Montenegro",
	"Nordmazedonien",
	"Bosnien und Herzegowina",
	"Albanien",
	"Kosovo",
	"Australien",
	"Neuseeland",
	"Fidschi",
	"Papua-Neuguinea",
	"Salomonen",
	"Vanuatu",
	"Samoa",
	"Tonga",
	"Kiribati",
	"Tuvalu",
	"Nauru",
	"Palau",
	"Marshallinseln",
	"Mikronesien",
	"Südafrika",
	"Nigeria",
	"Kenia",
	"Ghana",
	"Marokko",
	"Algerien",
	"Tunesien",
	"Libyen",
	"Äthiopien",
	"Tansania",
	"Uganda",
	"Ruanda",
	"Burundi",
	"Angola",
	"Mosambik",
	"Sambia",
	"Simbabwe",
	"Botsuana",
	"Namibia",
	"Senegal",
	"Elfenbeinküste",
	"Kamerun",
	"Gabun",
	"Kongo (Republik)",
	"Kongo (Demokratische Republik)",
	"Mali",
	"Burkina Faso",
	"Niger",
	"Tschad",
	"Sudan",
	"Südsudan",
	"Somalia",
	"Eritrea",
	"Dschibuti",
	"Mauretanien",
	"Gambia",
	"Guinea",
	"Guinea-Bissau",
	"Sierra Leone",
	"Liberia",
	"Togo",
	"Benin",
	"Zentralafrikanische Republik",
	"Äquatorialguinea",
	"São Tomé und Príncipe",
	"Kap Verde",
	"Komoren",
	"Madagaskar",
	"Mauritius",
	"Seychellen",
	"Malawi",
	"Lesotho",
	"Eswatini"
];
var landActiveIdx = -1;
function landFilter() {
	const inp = document.getElementById("landInput");
	const dd = document.getElementById("landDropdown");
	if (!inp || !dd) return;
	const q = (inp.value || "").trim().toLowerCase();
	let matches = LAENDER.filter((l) => l.toLowerCase().includes(q));
	if (q) matches.sort((a, b) => b.toLowerCase().startsWith(q) - a.toLowerCase().startsWith(q));
	matches = matches.slice(0, 8);
	landActiveIdx = -1;
	if (!matches.length) {
		dd.innerHTML = "<div class=\"land-empty\">Kein Treffer – du kannst das Land trotzdem eingeben.</div>";
		dd.style.display = "block";
		return;
	}
	dd.innerHTML = matches.map((l) => "<div class=\"land-opt\" data-act-mousedown=\"h163\">" + l + "</div>").join("");
	dd.style.display = "block";
}
function landPick(l) {
	const inp = document.getElementById("landInput");
	if (inp) inp.value = (l || "").trim();
	const dd = document.getElementById("landDropdown");
	if (dd) dd.style.display = "none";
}
function landClose() {
	setTimeout(function() {
		const dd = document.getElementById("landDropdown");
		if (dd) dd.style.display = "none";
	}, 150);
}
function landKey(e) {
	const dd = document.getElementById("landDropdown");
	if (!dd || dd.style.display === "none") return;
	const opts = dd.querySelectorAll(".land-opt");
	if (!opts.length) return;
	if (e.key === "ArrowDown") {
		e.preventDefault();
		landActiveIdx = Math.min(landActiveIdx + 1, opts.length - 1);
	} else if (e.key === "ArrowUp") {
		e.preventDefault();
		landActiveIdx = Math.max(landActiveIdx - 1, 0);
	} else if (e.key === "Enter") {
		if (landActiveIdx >= 0) {
			e.preventDefault();
			landPick(opts[landActiveIdx].textContent);
		}
		return;
	} else if (e.key === "Escape") {
		dd.style.display = "none";
		return;
	} else return;
	opts.forEach((o, i) => o.classList.toggle("active", i === landActiveIdx));
	opts[landActiveIdx].scrollIntoView({ block: "nearest" });
}
function openLegal(which) {
	var map = {
		agb: ["legalAgbHtml", "Allgemeine Geschäftsbedingungen (AGB)"],
		datenschutz: ["legalDatenschutzHtml", "Datenschutzerklärung"],
		impressum: ["legalImpressumHtml", "Impressum"]
	};
	var e = map[which] || map.agb;
	var src = document.getElementById(e[0]);
	document.getElementById("legalTitle").textContent = e[1];
	var c = document.getElementById("legalContent");
	c.innerHTML = src ? src.innerHTML : "";
	c.scrollTop = 0;
	document.getElementById("legalGate").style.display = "flex";
}
function closeLegal() {
	var g = document.getElementById("legalGate");
	if (g) g.style.display = "none";
}
function apiDarf() {
	return [
		"president",
		"vice",
		"support"
	].indexOf(CURRENT_USER_RANG) >= 0;
}
function apiKarteZeigen() {
	const k = document.getElementById("apiKarte");
	if (!k) return;
	k.style.display = apiDarf() ? "" : "none";
	if (apiDarf() && (k.style.animationName === "none" || getComputedStyle(k).animationName === "none")) k.style.animation = "histIn .42s cubic-bezier(.2,.7,.2,1) .04s both";
	const b = document.getElementById("apiBasisUrl");
	if (b) b.textContent = String("https://compliance-worker-test.julius-422.workers.dev" || "").replace(/\/$/, "") + "/api/check";
	if (apiDarf()) apiSchluesselLaden();
}
function apiMeldung(text, gut) {
	const m = document.getElementById("apiMsg");
	if (!m) return;
	m.style.display = text ? "block" : "none";
	m.className = "auth-msg " + (gut ? "ok" : "err");
	m.textContent = text || "";
}
function apiDatum(t) {
	return t ? new Date(t).toLocaleString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit"
	}) : "–";
}
async function apiSchluesselLaden() {
	const z = document.getElementById("apiListe");
	if (!z || !sb) return;
	try {
		const { data, error } = await sb.rpc("api_schluessel_liste");
		if (error) {
			z.innerHTML = "<p class=\"konto-card-p\">API-Zugang ist noch nicht eingerichtet.</p>";
			return;
		}
		const liste = data || [];
		if (!liste.length) {
			z.innerHTML = "<p class=\"konto-card-p api-leer\">Noch kein Schlüssel angelegt.</p>";
			return;
		}
		z.innerHTML = liste.map(function(k) {
			const aktiv = !k.widerrufen_am;
			return "<div class=\"api-zeile" + (aktiv ? "" : " aus") + "\"><div class=\"api-z-info\"><b>" + escapeHtml(k.name) + "</b> <code>" + escapeHtml(k.praefix || "") + "…</code>" + "<small>Erstellt " + apiDatum(k.erstellt_am) + (k.erstellt_von_name ? " von " + escapeHtml(k.erstellt_von_name) : "") + " · Zuletzt benutzt " + apiDatum(k.zuletzt_benutzt) + (aktiv ? "" : " · <span class=\"api-z-aus\">Widerrufen " + apiDatum(k.widerrufen_am) + "</span>") + "</small></div>" + (aktiv ? "<button class=\"plan-btn danger api-z-btn\" data-act-click=\"h164\" data-a0=\"" + escapeAttr(k.id) + "\">Widerrufen</button>" : "") + "</div>";
		}).join("");
		Array.prototype.forEach.call(z.querySelectorAll(".api-z-btn"), function(b, i) {
			b.dataset.name = (liste.filter(function(k) {
				return !k.widerrufen_am;
			})[i] || {}).name || "";
		});
	} catch (e) {
		z.innerHTML = "";
	}
}
async function apiSchluesselErzeugen() {
	const inp = document.getElementById("apiName"), btn = document.getElementById("apiNeuBtn");
	const name = (inp && inp.value || "").trim();
	if (!name) {
		apiMeldung("Bitte einen Namen für den Schlüssel eingeben.", false);
		if (inp) inp.focus();
		return;
	}
	btn.disabled = true;
	apiMeldung("", true);
	try {
		const { data, error } = await sb.rpc("api_schluessel_erzeugen", { p_name: name });
		if (error || !data || !data[0]) throw new Error(error && error.message || "Fehler");
		const k = data[0];
		document.getElementById("apiNeuAnzeige").innerHTML = "<div class=\"api-einmal\" role=\"alert\"><b>Neuer Schlüssel – jetzt kopieren, er wird nicht noch einmal angezeigt:</b>" + "<div class=\"api-einmal-z\"><code id=\"apiNeuKey\">" + escapeHtml(k.schluessel) + "</code><button class=\"plan-btn\" data-act-click=\"h165\">Kopieren</button></div>" + "<small>Im Car-Client als HTTP-Header <code>accesskey</code> eintragen. In der Datenbank liegt nur ein Hash.</small></div>";
		if (inp) inp.value = "";
		apiSchluesselLaden();
	} catch (e) {
		apiMeldung("Schlüssel konnte nicht erzeugt werden: " + (e && e.message || ""), false);
	} finally {
		btn.disabled = false;
	}
}
function apiKopieren() {
	const c = document.getElementById("apiNeuKey");
	if (!c) return;
	try {
		navigator.clipboard.writeText(c.textContent).then(function() {
			apiMeldung("Schlüssel kopiert.", true);
		});
	} catch (e) {}
}
async function apiSchluesselWiderrufen(id, btn) {
	const name = btn && btn.dataset && btn.dataset.name || "";
	if (!confirm("Schlüssel „" + name + "“ widerrufen?\n\nAnfragen mit diesem Schlüssel werden danach abgelehnt (403).")) return;
	try {
		const { error } = await sb.rpc("api_schluessel_widerrufen", { p_id: id });
		if (error) throw new Error(error.message);
		apiMeldung("Schlüssel „" + name + "“ wurde widerrufen.", true);
		const a = document.getElementById("apiNeuAnzeige");
		if (a) a.innerHTML = "";
		apiSchluesselLaden();
	} catch (e) {
		apiMeldung("Widerrufen fehlgeschlagen: " + (e && e.message || ""), false);
	}
}
function openKonto() {
	try {
		apiKarteZeigen();
	} catch (e) {}
	const lg = document.getElementById("kontoLogo");
	const src = document.querySelector(".auth-card .auth-logo");
	if (lg && src && src.src) lg.src = src.src;
	const em = document.getElementById("kontoEmail");
	if (em) em.textContent = CURRENT_USER_EMAIL || "";
	(async function() {
		try {
			const { data } = await sb.rpc("mein_name");
			const r = data && data[0] || {};
			const v = document.getElementById("kontoVorname");
			if (v) v.value = r.vorname || "";
			const n = document.getElementById("kontoNachname");
			if (n) n.value = r.nachname || "";
			const m = document.getElementById("kontoNameMsg");
			if (m) m.style.display = "none";
		} catch (e) {}
	})();
	const sank = document.getElementById("kontoSanktionenCard");
	if (sank) {
		const eigen = (CURRENT_USER_EMAIL || "").toLowerCase().indexOf("@automatilabs.de") > 0;
		sank.style.display = eigen ? "" : "none";
		if (eigen) sanktionenStandLaden();
	}
	try {
		const karten = Array.from(document.querySelectorAll("#kontoGate .konto-card"));
		let n = 0;
		karten.forEach(function(k) {
			k.style.animation = "none";
			if (k.style.display === "none" || k.offsetParent === null && k.style.display === "none") return;
		});
		requestAnimationFrame(function() {
			karten.forEach(function(k) {
				if (k.style.display === "none") return;
				k.style.animation = "histIn .42s cubic-bezier(.2,.7,.2,1) " + (.04 + n * .07) + "s both";
				n++;
			});
		});
	} catch (e) {}
	requestAnimationFrame(function() {
		try {
			const kg = document.getElementById("kontoGate");
			if (kg) {
				kg.scrollTop = 0;
				const inner = kg.querySelector(".plan-wrap, .konto-wrap");
				if (inner) inner.scrollTop = 0;
			}
			window.scrollTo({ top: 0 });
		} catch (e) {}
	});
	const bei = document.getElementById("kontoBeitretenCard");
	if (bei) {
		bei.style.display = CURRENT_FIRMA && CURRENT_FIRMA.typ === "einzel" ? "" : "none";
		const bm = document.getElementById("kontoBeitrittMsg");
		if (bm) bm.style.display = "none";
		const bc = document.getElementById("kontoBeitrittCode");
		if (bc) bc.value = "";
		const bb = document.getElementById("kontoBeitrittBtn");
		if (bb) {
			bb.disabled = false;
			bb.textContent = "Beitreten";
		}
	}
	const up = document.getElementById("kontoUpgradeCard");
	if (up) {
		up.style.display = CURRENT_FIRMA && CURRENT_FIRMA.typ === "einzel" ? "" : "none";
		const umsg = document.getElementById("kontoUpgradeMsg");
		if (umsg) umsg.style.display = "none";
		const ubtn = document.getElementById("kontoUpgradeBtn");
		if (ubtn) {
			ubtn.disabled = false;
			ubtn.textContent = "Unternehmens-Konto einrichten";
		}
	}
	const c = document.getElementById("kontoDelConfirm");
	if (c) c.style.display = "none";
	const m = document.getElementById("kontoMsg");
	if (m) m.style.display = "none";
	appAus();
	document.getElementById("kontoGate").style.display = "flex";
	window.scrollTo({
		top: 0,
		behavior: "auto"
	});
}
function closeKonto() {
	const g = document.getElementById("kontoGate");
	if (!g) {
		appAn();
		return;
	}
	g.classList.add("screen-out");
	setTimeout(function() {
		g.classList.remove("screen-out");
		g.style.display = "none";
		appAn();
	}, 200);
}
async function sanktionenStandLaden() {
	const ziel = document.getElementById("sankStand");
	if (!ziel || !sb) return;
	try {
		const { data } = await sb.rpc("sanktionen_stand_info");
		const liste = data || [];
		if (!liste.length) {
			ziel.innerHTML = "<div class=\"sank-leer\">Noch keine Liste geladen. Klicke auf „Jetzt aktualisieren“.</div>";
			return;
		}
		ziel.innerHTML = liste.map(function(s, i) {
			const d = s.stand ? new Date(s.stand).toLocaleDateString("de-DE") : "–";
			const alt = s.stand ? Math.floor((Date.now() - new Date(s.stand).getTime()) / 864e5) : null;
			const farbe = alt === null ? "grau" : alt <= 2 ? "gruen" : alt <= 7 ? "gelb" : "rot";
			return "<div class=\"sank-zeile\" style=\"--sz:" + (.05 + i * .08) + "s\">" + "<div class=\"sank-q\">" + escapeHtml(s.quelle) + "</div>" + "<div class=\"sank-info\"><b>" + (s.eintraege || 0).toLocaleString("de-DE") + "</b> Einträge" + "<span class=\"sank-datum\">Stand " + d + (alt !== null ? " · vor " + (alt === 0 ? "wenigen Stunden" : alt + " Tagen") : "") + "</span></div>" + "<span class=\"sank-punkt sank-" + farbe + "\"></span>" + "</div>";
		}).join("");
	} catch (e) {
		ziel.innerHTML = "<div class=\"sank-leer\">Stand konnte nicht geladen werden.</div>";
	}
}
async function sanktionenJetztLaden() {
	const btn = document.getElementById("sankBtn");
	const log = document.getElementById("sankLog");
	function schreib(text, art) {
		if (!log) {
			alert(text);
			return;
		}
		log.style.display = "";
		const z = document.createElement("div");
		z.className = "sank-log-z" + (art ? " sank-log-" + art : "");
		z.textContent = text;
		log.appendChild(z);
		log.scrollTop = log.scrollHeight;
	}
	if (log) log.innerHTML = "";
	schreib("Start – " + new Date().toLocaleTimeString("de-DE"), "info");
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Läuft …";
	}
	try {
		schreib("Sende Anfrage an den Server…", "info");
		const kopf = { "Content-Type": "application/json" };
		try {
			const s = (await sb.auth.getSession()).data.session;
			if (s && s.access_token) {
				kopf["Authorization"] = "Bearer " + s.access_token;
				schreib("Anmeldung erkannt ✓", "ok");
			} else schreib("Keine Anmeldung gefunden – das ist vermutlich das Problem.", "warn");
		} catch (e) {
			schreib("Anmeldung nicht lesbar: " + (e && e.message || ""), "warn");
		}
		const res = await fetch(WORKER, {
			method: "POST",
			headers: kopf,
			body: JSON.stringify({
				action: "sanktionen_laden",
				payload: {}
			})
		});
		schreib("Server antwortet mit Status " + res.status, res.ok ? "ok" : "warn");
		const roh = await res.text();
		schreib("Antwort (" + roh.length + " Zeichen):", "info");
		schreib(roh.slice(0, 600) || "(leer)", roh ? "daten" : "warn");
		let d = null;
		try {
			d = JSON.parse(roh.trim());
		} catch (e) {
			schreib("Antwort ist kein gueltiges JSON.", "warn");
		}
		if (d && d.ok) {
			const alles = d.vollstaendig !== false && d.gespeichert >= d.gefunden;
			schreib((alles ? "ERFOLG: " : "TEILWEISE: ") + (d.gespeichert || 0).toLocaleString("de-DE") + " von " + (d.gefunden || 0).toLocaleString("de-DE") + " Einträgen gespeichert.", alles ? "ok" : "warn");
			if (!alles) schreib("Nicht alles durchgelaufen – bitte erneut klicken oder Bescheid geben.", "warn");
			await sanktionenStandLaden();
		} else if (d && d.error) {
			schreib("FEHLER vom Server: " + d.error, "err");
			if (d.versuche && d.versuche.length) {
				schreib("Was bei den einzelnen Adressen passiert ist:", "info");
				d.versuche.forEach(function(v, i) {
					schreib("  " + (i + 1) + ". " + (v.quelle || ""), "daten");
					schreib("     " + (v.fehler ? "Fehler: " + v.fehler : "Status " + v.status + ", " + v.laenge + " Zeichen"), v.fehler ? "err" : "warn");
				});
			}
		}
	} catch (e) {
		schreib("Abbruch: " + (e && e.message || "unbekannter Fehler"), "err");
	}
	if (btn) {
		btn.disabled = false;
		btn.textContent = "Jetzt aktualisieren";
	}
}
async function kontoBeitreten() {
	const feld = document.getElementById("kontoBeitrittCode");
	const btn = document.getElementById("kontoBeitrittBtn");
	const msg = document.getElementById("kontoBeitrittMsg");
	const code = (feld && feld.value || "").trim().toUpperCase();
	function zeige(text, art) {
		if (!msg) return;
		msg.textContent = text;
		msg.className = "auth-msg " + (art === "ok" ? "ok" : "error");
		msg.style.display = "";
		msg.style.animation = "none";
		void msg.offsetWidth;
		msg.style.animation = "authMsgIn .4s cubic-bezier(.2,.7,.2,1) both";
	}
	if (!code) {
		zeige("Bitte den Unternehmens-Code eingeben.", "error");
		if (feld) {
			feld.focus();
			feld.classList.add("feld-wackel");
			setTimeout(function() {
				feld.classList.remove("feld-wackel");
			}, 500);
		}
		return;
	}
	const anzahl = Math.max(HISTORY_ROWS && HISTORY_ROWS.length || 0, HISTORY_TOTAL || 0);
	const ja = await beitrittFrage(anzahl);
	if (!ja) return;
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Wird geprüft…";
	}
	try {
		const { data, error } = await sb.rpc("firma_beitreten", { p_code: code });
		if (error) throw error;
		if (data === true) {
			zeige("Beitritt erfolgreich. Wir laden dein neues Team…", "ok");
			try {
				await ladeKontingent();
				await ladeMeinenRang();
			} catch (e) {}
			setTimeout(function() {
				location.reload();
			}, 1400);
			return;
		}
		zeige("Dieser Code ist unbekannt. Bitte prüfe die Schreibweise.", "error");
	} catch (e) {
		zeige(e && e.message || "Beitritt fehlgeschlagen.", "error");
	}
	if (btn) {
		btn.disabled = false;
		btn.textContent = "Beitreten";
	}
}
function beitrittFrage(anzahl) {
	return new Promise(function(res) {
		const box = document.createElement("div");
		box.id = "btGate";
		box.className = "up-warn-back";
		box.innerHTML = "<div class=\"up-warn-card bt-card\">" + "<div class=\"up-warn-ico\">⇄</div>" + "<div class=\"up-warn-t\">Konto wechseln?</div>" + "<div class=\"up-warn-d\">Du arbeitest ab sofort im Konto des Unternehmens und nutzt dessen Kontingent gemeinsam mit dem Team." + (anzahl ? "<br/><br/>Deine bisherigen <b>" + anzahl + " Prüfungen</b> bleiben in deinem eigenen Konto gespeichert und sind im Team nicht sichtbar." : "") + "</div>" + "<div class=\"up-warn-btns\">" + "<button class=\"kyc-btn\" data-act-click=\"h166\">Abbrechen</button>" + "<button class=\"up-senden up-warn-ok\" data-act-click=\"h167\">Ja, beitreten</button>" + "</div></div>";
		document.body.appendChild(box);
		einblenden(box);
		window._btRes = res;
	});
}
function btAntwort(ja) {
	const b = document.getElementById("btGate");
	const r = window._btRes;
	if (b) {
		const k = b.querySelector(".bt-card");
		if (k) k.classList.add("karte-weg");
		b.classList.remove("an");
		setTimeout(function() {
			if (b.parentNode) b.remove();
		}, 260);
	}
	window._btRes = null;
	if (r) r(!!ja);
}
async function kontoPwSpeichern() {
	const a = document.getElementById("kontoPw1"), b = document.getElementById("kontoPw2");
	const btn = document.getElementById("kontoPwBtn"), msg = document.getElementById("kontoPwMsg");
	const p1 = a && a.value || "", p2 = b && b.value || "";
	function zeige(text, art) {
		if (!msg) return;
		msg.textContent = text;
		msg.className = "auth-msg " + (art === "ok" ? "ok" : "error");
		msg.style.display = "";
		msg.style.animation = "none";
		void msg.offsetWidth;
		msg.style.animation = "authMsgIn .4s cubic-bezier(.2,.7,.2,1) both";
	}
	function wackel(f) {
		if (!f) return;
		f.focus();
		f.classList.remove("feld-wackel");
		void f.offsetWidth;
		f.classList.add("feld-wackel");
		setTimeout(function() {
			f.classList.remove("feld-wackel");
		}, 600);
	}
	if (p1.length < 8) {
		zeige("Mindestens 8 Zeichen.", "error");
		wackel(a);
		return;
	}
	if (p1 !== p2) {
		zeige("Die Passwörter stimmen nicht überein.", "error");
		wackel(b);
		return;
	}
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Wird gespeichert…";
	}
	try {
		const { error } = await sb.auth.updateUser({ password: p1 });
		if (error) throw error;
		zeige("Passwort geändert.", "ok");
		if (a) a.value = "";
		if (b) b.value = "";
	} catch (e) {
		let t = e && e.message || "Fehler.";
		if (/same|different/i.test(t)) t = "Bitte ein anderes Passwort als bisher wählen.";
		zeige(t, "error");
	}
	if (btn) {
		btn.disabled = false;
		btn.textContent = "Passwort speichern";
	}
}
async function kontoNameSpeichern() {
	const v = ((document.getElementById("kontoVorname") || {}).value || "").trim();
	const n = ((document.getElementById("kontoNachname") || {}).value || "").trim();
	const btn = document.getElementById("kontoNameBtn");
	const msg = document.getElementById("kontoNameMsg");
	function zeige(text, art) {
		if (!msg) return;
		msg.textContent = text;
		msg.className = "auth-msg " + (art === "ok" ? "ok" : "error");
		msg.style.display = "";
		msg.style.animation = "none";
		void msg.offsetWidth;
		msg.style.animation = "authMsgIn .4s cubic-bezier(.2,.7,.2,1) both";
	}
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Wird gespeichert…";
	}
	try {
		const { data, error } = await sb.rpc("name_setzen", {
			p_vorname: v,
			p_nachname: n
		});
		if (error) throw error;
		setCURRENT_USER_NAME(anzeigeName(v, n, ""));
		zeige(CURRENT_USER_NAME ? "Gespeichert – du erscheinst jetzt als " + CURRENT_USER_NAME + "." : "Name entfernt.", "ok");
	} catch (e) {
		zeige("Konnte nicht gespeichert werden.", "error");
	}
	if (btn) {
		btn.disabled = false;
		btn.textContent = "Name speichern";
	}
}
async function zuUnternehmenWechseln() {
	const feld = document.getElementById("kontoFirmaName");
	const btn = document.getElementById("kontoUpgradeBtn");
	const msg = document.getElementById("kontoUpgradeMsg");
	const name = (feld && feld.value || "").trim();
	function zeige(text, art) {
		if (!msg) return;
		msg.textContent = text;
		msg.className = "auth-msg " + (art === "ok" ? "ok" : "error");
		msg.style.display = "";
		msg.style.animation = "none";
		void msg.offsetWidth;
		msg.style.animation = "histIn .4s cubic-bezier(.2,.7,.2,1) both";
	}
	if (!name) {
		zeige("Bitte gib den Namen deines Unternehmens ein.", "error");
		if (feld) feld.focus();
		return;
	}
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Wird eingerichtet…";
	}
	try {
		const { data, error } = await sb.rpc("zu_unternehmen_wechseln", { p_name: name });
		if (error) throw error;
		if (!data || data.ok !== true) throw new Error(data && data.grund || "Wechsel nicht möglich.");
		zeige("Fertig! Dein Konto ist jetzt ein Unternehmen. Du bist President und kannst Mitarbeiter einladen.", "ok");
		try {
			await ladeKontingent();
			await ladeMeinenRang();
		} catch (e) {}
		setTimeout(function() {
			closeKonto();
			setTimeout(function() {
				zeigeToast("Unternehmens-Konto aktiv", "Du kannst jetzt über „Team verwalten“ Mitarbeiter einladen.");
			}, 500);
		}, 1700);
	} catch (e) {
		zeige(e && e.message || "Wechsel fehlgeschlagen.", "error");
		if (btn) {
			btn.disabled = false;
			btn.textContent = "Unternehmens-Konto einrichten";
		}
	}
}
function kontoMsgShow(msg, typ) {
	const m = document.getElementById("kontoMsg");
	if (!m) return;
	m.style.display = "block";
	m.textContent = msg;
	m.className = "auth-msg " + (typ === "error" ? "error" : "ok");
}
async function exportiereDaten() {
	const btn = document.getElementById("exportBtn");
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Wird vorbereitet…";
	}
	try {
		const hinweiseUnvollstaendig = [];
		const teilFehler = function(teil, grund) {
			hinweiseUnvollstaendig.push({
				teil,
				grund: grund || "Abfrage fehlgeschlagen"
			});
		};
		const teilLaden = async function(teil, abfrage) {
			try {
				const r = await abfrage();
				if (!r || r.error) {
					teilFehler(teil);
					return null;
				}
				return r;
			} catch (e) {
				teilFehler(teil);
				return null;
			}
		};
		const SEITE = 500, MAX_SEITEN = 200;
		let analysen = [], limitErreicht = false;
		if (!sb) {
			teilFehler("analysen", "Keine Verbindung");
		} else {
			for (let seite = 0; seite < MAX_SEITEN; seite++) {
				const von = seite * SEITE;
				let r = null;
				try {
					r = await sb.from("analysen").select("pruef_id,firmenname,land,ust_id,score,verdict,verdict_text,created_at,report_json").order("created_at", { ascending: false }).order("pruef_id", { ascending: false }).range(von, von + SEITE - 1);
				} catch (e) {
					r = null;
				}
				if (!r || r.error || !Array.isArray(r.data)) {
					teilFehler("analysen", seite ? "Abfrage fehlgeschlagen (nur teilweise geladen)" : "Abfrage fehlgeschlagen");
					break;
				}
				for (let i = 0; i < r.data.length; i++) analysen.push(r.data[i]);
				if (r.data.length < SEITE) break;
				if (seite === MAX_SEITEN - 1) {
					limitErreicht = true;
					teilFehler("analysen", "Obergrenze erreicht (nur " + analysen.length + " Prüfungen geladen)");
				}
			}
		}
		let profil = {}, favoriten = [], ordner = [], dokumente = [], freigaben = [];
		const rName = await teilLaden("mein_name", function() {
			return sb.rpc("mein_name");
		});
		if (rName) profil = rName.data && rName.data[0] || {};
		const rFav = await teilLaden("meine_favoriten", function() {
			return sb.rpc("meine_favoriten");
		});
		if (rFav) favoriten = rFav.data || [];
		const rOrdner = await teilLaden("ordner", function() {
			return sb.from("ordner").select("id,name,farbe,sichtbarkeit,created_at");
		});
		if (rOrdner) ordner = rOrdner.data || [];
		const rDok = await teilLaden("kyc_dokumente", function() {
			return sb.from("kyc_dokumente").select("analyse_id,typ,datei_name,mime_type,position,bezeichnung,created_at,einwilligung_am,einwilligung_version");
		});
		if (rDok) dokumente = rDok.data || [];
		const rFrei = await teilLaden("ordner_freigaben", function() {
			return sb.from("ordner_freigaben").select("ordner_id,user_id,created_at");
		});
		if (rFrei) freigaben = rFrei.data || [];
		const rSchl = await teilLaden("api_schluessel", function() {
			return sb.rpc("api_schluessel_liste");
		});
		const rApi = await teilLaden("api_pruefungen", function() {
			return sb.from("api_pruefungen").select("pruef_id,ref,status,eingabe,analyse_id,created_at,pdf_ablauf");
		});
		const exp = {
			hinweis: "Datenauskunft gemäß Art. 15 DSGVO – Automati Labs GmbH, Compliance-Checker",
			export_datum: new Date().toISOString(),
			hinweise_unvollstaendig: hinweiseUnvollstaendig,
			konto: {
				email: CURRENT_USER_EMAIL || "",
				user_id: CURRENT_USER_ID || "",
				vorname: profil.vorname || null,
				nachname: profil.nachname || null,
				rang: CURRENT_USER_RANG || null
			},
			firma: CURRENT_FIRMA ? {
				name: CURRENT_FIRMA.firma_name,
				typ: CURRENT_FIRMA.typ,
				paket_limit: CURRENT_FIRMA.monatslimit,
				testphase: !!CURRENT_FIRMA.trial
			} : null,
			pruefungen: Object.assign({
				anzahl: analysen.length,
				eintraege: analysen
			}, limitErreicht ? { limit_erreicht: true } : {}),
			api_zugang: {
				schluessel: rSchl && rSchl.data || [],
				pruefungen: rApi && rApi.data || []
			},
			ueberwachung: {
				anzahl: favoriten.length,
				eintraege: favoriten
			},
			ordner: {
				anzahl: ordner.length,
				eintraege: ordner
			},
			ordner_freigaben: {
				anzahl: freigaben.length,
				eintraege: freigaben
			},
			hochgeladene_dokumente: {
				anzahl: dokumente.length,
				hinweis: "Metadaten der Ausweis- und Fotodateien. Die Dateien selbst können über das Tool heruntergeladen werden.",
				eintraege: dokumente
			}
		};
		const blob = new Blob([JSON.stringify(exp, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "compliance-checker-daten-" + new Date().toISOString().slice(0, 10) + ".json";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(function() {
			URL.revokeObjectURL(url);
		}, 1e3);
		if (hinweiseUnvollstaendig.length) {
			const teileTxt = hinweiseUnvollstaendig.map(function(h) {
				return h.teil;
			}).filter(function(t, i, a) {
				return a.indexOf(t) === i;
			}).join(", ");
			kontoMsgShow("Export unvollständig: " + teileTxt + " – bitte später erneut versuchen oder Support kontaktieren. Die Datei enthält den Vermerk „hinweise_unvollstaendig“.", "error");
		} else kontoMsgShow("Export erstellt – die JSON-Datei wurde heruntergeladen.", "ok");
	} catch (e) {
		kontoMsgShow("Export fehlgeschlagen: " + (e && e.message ? e.message : e), "error");
	} finally {
		if (btn) {
			btn.disabled = false;
			btn.textContent = "Daten exportieren (JSON)";
		}
	}
}
function kontoLoeschenSchritt1() {
	const c = document.getElementById("kontoDelConfirm");
	if (c) c.style.display = "block";
}
function kontoLoeschenAbbrechen() {
	const c = document.getElementById("kontoDelConfirm");
	if (c) c.style.display = "none";
}
async function kontoLoeschenFinal() {
	const btn = document.getElementById("kontoDelFinal");
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Wird gelöscht…";
	}
	try {
		const { data: sess } = await sb.auth.getSession();
		const token = sess && sess.session && sess.session.access_token;
		if (!token) throw new Error("Nicht angemeldet");
		const res = await workerCall("konto_loeschen", { token });
		if (!res || res.error) throw new Error(res && res.error || "Unbekannter Fehler");
		const g = document.getElementById("kontoGate");
		if (g) g.style.display = "none";
		CHAT_DS_OK = null;
		CHAT_UID = null;
		await sb.auth.signOut();
		setTimeout(function() {
			showAuthMsg("Dein Konto wurde gelöscht. Du kannst dich jederzeit neu registrieren.", "ok");
		}, 250);
	} catch (e) {
		if (e && /abo_aktiv|abo_pruefung_nicht_moeglich/.test(String(e.message || ""))) kontoMsgShow(friendlyError(e.message), "error");
		else kontoMsgShow("Löschen fehlgeschlagen: " + (e && e.message ? e.message : e), "error");
		if (btn) {
			btn.disabled = false;
			btn.textContent = "Ja, endgültig löschen";
		}
	}
}
var UST_ART = "ust";
function ustArtWaehlen(art) {
	UST_ART = art;
	const f = document.getElementById("ustInput");
	const h = document.getElementById("ustHinweis");
	const a = document.getElementById("uwUst"), b = document.getElementById("uwStnr");
	if (a) a.classList.toggle("aktiv", art === "ust");
	if (b) b.classList.toggle("aktiv", art === "stnr");
	if (f) {
		f.placeholder = art === "ust" ? "z.B. DE 298 123 456" : "z.B. 143/824/51002";
		f.classList.remove("feld-wechsel");
		void f.offsetWidth;
		f.classList.add("feld-wechsel");
		try {
			f.focus();
		} catch (e) {}
	}
	if (h) {
		h.textContent = art === "ust" ? "Wird über das EU-System VIES geprüft – macht die Zuordnung eindeutig." : "Für Unternehmen ohne USt-IdNr. Wird nicht amtlich geprüft, hilft aber bei der Zuordnung.";
		h.classList.remove("feld-wechsel");
		void h.offsetWidth;
		h.classList.add("feld-wechsel");
	}
}
var SITZ_ABZUG = 10;
var FIRMA_AUSWAHL = null;
function sitzEingabe() {
	const o = document.getElementById("sitzOrtInput"), p = document.getElementById("sitzPlzInput");
	return {
		ort: o ? o.value.replace(/\s+/g, " ").trim().slice(0, 80) : "",
		plz: p ? p.value.replace(/[^0-9A-Za-z-]/g, "").slice(0, 10) : ""
	};
}
function plzAus(t) {
	const m = String(t || "").match(/\b\d{4,5}\b/);
	return m ? m[0] : "";
}
function ortWorte(t) {
	const fuell = {
		der: 1,
		die: 1,
		das: 1,
		dem: 1,
		den: 1,
		bei: 1,
		vor: 1,
		und: 1,
		auf: 1
	};
	return String(t || "").toLowerCase().replace(/\u00e4/g, "ae").replace(/\u00f6/g, "oe").replace(/\u00fc/g, "ue").replace(/\u00df/g, "ss").replace(/\u00f8/g, "o").replace(/\u0142/g, "l").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[0-9]+/g, " ").split(/[^a-z]+/).filter(function(w) {
		return w.length > 2 && !fuell[w];
	});
}
function orteGleich(a, b) {
	const x = ortWorte(a), y = ortWorte(b);
	if (!x.length || !y.length) return false;
	const k = x.length <= y.length ? x : y, l = x.length <= y.length ? y : x;
	return k.every(function(w, i) {
		return w === l[i];
	});
}
function ortPasst(t, soll) {
	if (!t || !soll) return false;
	const sPlz = plzAus(soll.plz), tPlz = plzAus(t.plz) || plzAus(t.ort);
	if (sPlz && tPlz && sPlz === tPlz) return true;
	return !!(soll.ort && t.ort && orteGleich(soll.ort, t.ort));
}
function googleOrt(adresse) {
	const teile = String(adresse || "").split(",").map(function(x) {
		return x.trim();
	});
	for (let i = 0; i < teile.length; i++) {
		const m = teile[i].match(/^(\d{4,5})\s+(.+)$/);
		if (m) return {
			plz: m[1],
			ort: m[2]
		};
	}
	return {
		plz: "",
		ort: teile.length >= 2 ? teile[teile.length - 2] : ""
	};
}
function trefferBereinigen(liste) {
	const gesehen = {}, raus = [];
	(Array.isArray(liste) ? liste : []).forEach(function(t) {
		if (!t || !t.name) return;
		const reg = String(t.register || "").toLowerCase().replace(/[^a-z0-9]/g, "");
		const key = (reg ? "r:" + reg : "n:" + firmenKern(t.name)) + "|" + ortWorte(t.ort).join(" ");
		if (gesehen[key]) return;
		gesehen[key] = true;
		raus.push({
			name: String(t.name).slice(0, 160),
			ort: String(t.ort || "").slice(0, 80),
			plz: String(t.plz || "").slice(0, 10),
			register: String(t.register || "").slice(0, 80),
			gegruendet: String(t.gegruendet || "").slice(0, 20),
			branche: String(t.branche || "").slice(0, 60),
			hinweis: String(t.hinweis || "").slice(0, 160)
		});
	});
	return raus;
}
function gleichnamigeKonkurrenz(treffer) {
	const z = {};
	return treffer.some(function(t) {
		const k = firmenKern(t.name);
		z[k] = (z[k] || 0) + 1;
		return z[k] > 1;
	});
}
var VIES_LAENDER = [
	"AT",
	"BE",
	"BG",
	"CY",
	"CZ",
	"DE",
	"DK",
	"EE",
	"EL",
	"ES",
	"FI",
	"FR",
	"HR",
	"HU",
	"IE",
	"IT",
	"LT",
	"LU",
	"LV",
	"MT",
	"NL",
	"PL",
	"PT",
	"RO",
	"SE",
	"SI",
	"SK",
	"XI"
];
function adrNorm(s) {
	return String(s == null ? "" : s).toLowerCase().replace(/\u00df/g, "ss").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}
function adrNormVgl(s) {
	return String(s == null ? "" : s).normalize("NFC").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/æ/g, "ae").replace(/ø/g, "o").replace(/ł/g, "l").replace(/ß/g, "ss").normalize("NFKD").replace(/[̀-ͯ]/g, "");
}
function hausnrRegex() {
	return /(\d+)(?:\s*-?\s*([a-z])(?![a-z0-9]))?(?:\s*([-\/])\s*(\d+)(?:\s*-?\s*([a-z])(?![a-z0-9]))?)?/g;
}
function hausnrMenge(t) {
	const re = hausnrRegex();
	let m, last = null;
	while ((m = re.exec(t)) !== null) last = m;
	if (!last) return [];
	const ohne0 = function(x) {
		return String(x).replace(/^0+(?=\d)/, "");
	};
	const a = ohne0(last[1]), la = last[2] || "", menge = [a + la];
	if (last[3] === "-" && last[4]) {
		const b = ohne0(last[4]), lb = last[5] || "", x = +a, y = +b, lo = Math.min(x, y), hi = Math.max(x, y);
		if (hi - lo <= 50) {
			for (let i = lo + 1; i < hi; i++) menge.push(String(i));
		}
		menge.push(b + lb);
	}
	return menge;
}
function strasseTeile(s) {
	const t = adrNormVgl(s).replace(/(strasse|strase|str)\.?/g, "str ");
	const nrs = hausnrMenge(t);
	const name = t.replace(hausnrRegex(), " ").replace(/[^a-z]/g, "");
	return {
		name,
		nr: nrs.length ? nrs[0] : "",
		nrs
	};
}
function strassenGleich(a, b) {
	const x = strasseTeile(a), y = strasseTeile(b);
	if (!x.name || !y.name) return null;
	const nameOk = x.name === y.name || x.name.length >= 5 && y.name.length >= 5 && (x.name.indexOf(y.name) >= 0 || y.name.indexOf(x.name) >= 0);
	if (!nameOk) return false;
	return x.nrs.length && y.nrs.length ? x.nrs.some(function(n) {
		return y.nrs.indexOf(n) >= 0;
	}) : true;
}
function plzNorm(z) {
	const s = adrNormVgl(z).replace(/[\s.\-]+/g, "").replace(/[^a-z0-9]/g, "");
	const m = /^(?:de|at|ch|li|lu|fr|it|nl|be|pl|cz|sk|hu|dk|se|fi|no|es|pt|si|hr|ro|bg|gr|ee|lv|lt|ie|mt|cy|d|a|l|f|i|b|e|p|s|n)(\d{3,})$/.exec(s);
	return m ? m[1] : s;
}
function plzInText(n, z) {
	const zahl = /^\d+$/.test(z), teil = z.split("").join("[\\s-]?");
	return new RegExp(zahl ? "(?:^|[^0-9])" + teil + "(?![0-9])" : "(?:^|[^a-z0-9])" + teil + "(?![a-z0-9])").test(n);
}
function ortNorm(s) {
	return adrNormVgl(s).replace(/[-.,;]+/g, " ").replace(/\s+/g, " ").trim();
}
function adresseVergleichen(text, eingabe) {
	const t = String(text == null ? "" : text);
	if (!t.trim() || !eingabe) return null;
	const n = adrNormVgl(t), teile = [];
	if (eingabe.zip) {
		const z = plzNorm(eingabe.zip);
		if (z) teile.push(plzInText(n, z));
	}
	if (eingabe.city) teile.push(ortNorm(t).indexOf(ortNorm(eingabe.city)) >= 0);
	if (eingabe.street) {
		const zeilen = t.split(/[\n,;]/).map(function(z) {
			return z.trim();
		}).filter(Boolean);
		teile.push(zeilen.some(function(z) {
			return strassenGleich(z, eingabe.street) === true;
		}));
	}
	if (!teile.length) return null;
	return teile.every(function(x) {
		return x === true;
	});
}
function domainNorm(u) {
	const s = String(u == null ? "" : u).trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\d?\./, "").split(/[\/?#:\s]/)[0].replace(/\.+$/, "");
	return /^[a-z0-9\u00e4\u00f6\u00fc-]+(\.[a-z0-9\u00e4\u00f6\u00fc-]+)*\.[a-z]{2,}$/.test(s) && s.length <= 100 ? s : "";
}
function domainsGleich(a, b) {
	const x = domainNorm(a), y = domainNorm(b);
	if (!x || !y) return null;
	return x === y || x.slice(-(y.length + 1)) === "." + y || y.slice(-(x.length + 1)) === "." + x;
}
function registerStatusErmitteln(d) {
	if (d && d._registerAuswahl) return "found";
	const f = (d && d.grunddaten && d.grunddaten.felder || []).find(function(x) {
		return /register/i.test(String(x && x.key || ""));
	});
	const v = String(f && f.value || "").trim();
	if (/nicht eintragungspflichtig|keine eintragungspflicht|not applicable|nicht anwendbar/i.test(v)) return "not_applicable";
	if (!v || isNA(v) || /nicht (gefunden|auffindbar|ermittelt|vorhanden|belegt)|kein(e|en)? (eintrag|register)|not found|no (entry|register)|unbekannt/i.test(v)) return "not_found";
	return "found";
}
function identitaetBewerten(d, vies, eingabe, website, google) {
	eingabe = eingabe || {};
	const notiz = function(de, en) {
		out.notizen.push({
			de,
			en
		});
	};
	const vat = String(eingabe.vat_id || "").toUpperCase().replace(/[\s.\-]/g, "");
	const land = vat.slice(0, 2), name = eingabe.company || d && d.firmenname || "";
	const out = {
		registerStatus: registerStatusErmitteln(d),
		basis: [],
		viesAnker: false,
		addressMatch: null,
		websiteMatch: null,
		notizen: [],
		vies: {
			checked: false,
			valid: null,
			name: null,
			address: null,
			name_match: null,
			address_match: null,
			status: vat ? null : "not_provided"
		}
	};
	if (vat) {
		if (VIES_LAENDER.indexOf(land) < 0) {
			out.vies.status = "not_applicable";
			notiz("USt-ID nicht über VIES prüfbar (Land außerhalb der EU).", "VAT ID cannot be checked via VIES (country outside the EU).");
		} else if (vies && (vies.valid === true || vies.status === "valid")) {
			const vn = String(vies.name || "").trim(), va = String(vies.address || "").trim();
			out.vies.checked = true;
			out.vies.valid = true;
			out.vies.status = "valid";
			out.vies.name = vn && vn !== "---" ? vn : null;
			out.vies.address = va && va !== "---" ? va : null;
			out.vies.name_match = out.vies.name ? !!(namenGleich(out.vies.name, name) || d && d.firmenname && namenGleich(out.vies.name, d.firmenname)) : null;
			out.vies.address_match = out.vies.address ? adresseVergleichen(out.vies.address, eingabe) : null;
			if (!out.vies.name) notiz("Firmenname von VIES nicht geliefert.", "Company name not provided by VIES.");
			if (!out.vies.address) notiz("Adresse von VIES nicht geliefert.", "Address not provided by VIES.");
			if (out.vies.name_match === false) notiz("Name laut VIES weicht ab: " + out.vies.name, "Name according to VIES differs: " + out.vies.name);
			if (out.vies.address_match === false) notiz("Adresse laut VIES weicht von der Eingabe ab: " + out.vies.address, "Address according to VIES differs from the input: " + out.vies.address);
		} else if (vies && vies.status === "unavailable") {
			out.vies.status = "unavailable";
			notiz("VIES war nicht erreichbar – USt-ID nicht bestätigt.", "VIES was not reachable – VAT ID not confirmed.");
		} else if (vies) {
			out.vies.checked = true;
			out.vies.valid = false;
			out.vies.status = "invalid";
			notiz("USt-ID laut VIES ungültig.", "VAT ID invalid according to VIES.");
		}
	}
	const wsBestaetigt = !!(website && website.erreichbar && website.nameGefunden);
	if (eingabe.website) {
		const bekannt = website && website.domain || google && google.websiteUri || "";
		const dom = bekannt ? domainsGleich(eingabe.website, bekannt) : null;
		out.websiteMatch = dom === false ? false : wsBestaetigt ? true : website && website.erreichbar === false ? false : null;
		if (website && website.erreichbar === false) notiz("Website " + domainNorm(eingabe.website) + " nicht erreichbar.", "Website " + domainNorm(eingabe.website) + " not reachable.");
		else if (website && website.erreichbar && !website.nameGefunden) notiz("Firmenname auf der Website nicht gefunden.", "Company name not found on the website.");
		if (dom === false) notiz("Angegebene Website passt nicht zur gefundenen Website (" + domainNorm(bekannt) + ").", "Given website does not match the website found (" + domainNorm(bekannt) + ").");
	}
	const gName = google && google.displayName && google.displayName.text;
	const gBestaetigt = !!(gName && namenGleich(gName, name) && google.formattedAddress && (!(eingabe.zip || eingabe.city) || ortPasst(googleOrt(google.formattedAddress), {
		ort: eingabe.city || "",
		plz: eingabe.zip || ""
	})));
	const amtlich = ((d && d.grunddaten && d.grunddaten.felder || []).find(function(x) {
		return /adresse|anschrift/i.test(String(x && x.key || ""));
	}) || {}).value;
	const quellen = [
		amtlich && !isNA(amtlich) ? amtlich : null,
		out.vies.address,
		google && google.formattedAddress
	].filter(Boolean);
	if (eingabe.street || eingabe.zip || eingabe.city) {
		const erg = quellen.map(function(q) {
			return adresseVergleichen(q, eingabe);
		}).filter(function(x) {
			return x !== null;
		});
		out.addressMatch = erg.length ? erg.some(function(x) {
			return x === true;
		}) : null;
		if (out.addressMatch === false) notiz("Angegebene Adresse weicht von den gefundenen Quellen ab.", "Given address differs from the sources found.");
	}
	if (out.registerStatus === "found") out.basis.push("register");
	if (out.vies.valid === true) out.basis.push("vies");
	if (wsBestaetigt) out.basis.push("website");
	if (gBestaetigt) out.basis.push("google");
	const nameOk = out.vies.name_match === true || out.vies.name_match === null && (wsBestaetigt || gBestaetigt);
	out.viesAnker = out.registerStatus !== "found" && out.vies.valid === true && nameOk && out.vies.address_match !== false;
	if (out.registerStatus !== "found") {
		const ausland = land && land !== "DE" ? land === "EL" ? "GR" : land : "";
		const istAusland = !!ausland || eingabe.country && String(eingabe.country).toUpperCase() !== "DE";
		if (out.viesAnker) {
			const nT = out.vies.name_match === true ? ["Name passt", "name matches"] : ["Name von VIES nicht geliefert", "name not provided by VIES"];
			const aT = out.vies.address_match === true ? ["Adresse passt", "address matches"] : ["Adresse von VIES nicht geliefert", "address not provided by VIES"];
			const best = [wsBestaetigt ? "Website" : "", gBestaetigt ? "Google" : ""].filter(Boolean);
			out.notizen.unshift({
				de: "Kein Handelsregister auffindbar" + (istAusland ? " (Ausland)" : "") + ". Identität über USt-ID (VIES gültig, " + nT[0] + ", " + aT[0] + ")" + (best.length ? ", " + best.join(" und ") + " bestätigt" : "") + ". Das fehlende Register wird nicht negativ gewertet.",
				en: "No commercial register found" + (istAusland ? " (foreign company)" : "") + ". Identity confirmed via VAT ID (VIES valid, " + nT[1] + ", " + aT[1] + ")" + (best.length ? ", " + best.join(" and ") + " confirmed" : "") + ". The missing register is not counted negatively."
			});
		} else {
			out.notizen.unshift({
				de: "Kein Handelsregister auffindbar. Die Identität ist nicht über die USt-ID belegt – Bewertung wie bisher.",
				en: "No commercial register found. Identity is not confirmed via the VAT ID – assessment unchanged."
			});
		}
	}
	return out;
}
function registerFairnessAktiv(d) {
	return !!(d && d._identitaet && d._identitaet.viesAnker === true);
}
function phantomNurRegister(d) {
	const p = d && d.phantom;
	if (!p || p.verdacht !== true) return false;
	if (p.nurRegister === true) return true;
	const ind = (p.indizien || []).map(function(i) {
		return String(i && i.text || "");
	});
	return ind.length > 0 && ind.every(function(x) {
		return /handelsregister|register|registry|registereintrag/i.test(x);
	});
}
function scoreBerechnen(d) {
	const fair = registerFairnessAktiv(d);
	const gd = d.grunddaten && d.grunddaten.score;
	const abzug = fair ? Math.max(0, Math.min(100, Number(d.grunddaten && d.grunddaten.registerAbzug) || 0)) : 0;
	const weighted = [
		{
			score: typeof gd === "number" && gd > 0 && abzug ? Math.min(100, gd + abzug) : gd,
			weight: .3
		},
		{
			score: d.personen && d.personen.score,
			weight: .3
		},
		{
			score: d.kontakt && d.kontakt.score,
			weight: .2
		},
		{
			score: d.reputation && d.reputation.score,
			weight: .05
		},
		{
			score: d.finanzen && d.finanzen.score,
			weight: .15
		}
	];
	const valid = weighted.filter(function(w) {
		return typeof w.score === "number" && w.score > 0;
	});
	let computedScore = null;
	if (valid.length > 0) {
		const totalWeight = valid.reduce(function(a, w) {
			return a + w.weight;
		}, 0);
		const weightedSum = valid.reduce(function(a, w) {
			return a + w.score * w.weight;
		}, 0);
		computedScore = Math.round(weightedSum / totalWeight);
	}
	d.gesamtScore = computedScore !== null ? computedScore : d.gesamtScore;
	if (d._sitz && d._sitz.abweichung && typeof d.gesamtScore === "number") {
		d.gesamtScore = Math.max(0, d.gesamtScore - (d._sitz.abzug || SITZ_ABZUG));
	}
	d.phantom = d.phantom || { verdacht: false };
	const phantomVerdacht = d.phantom && d.phantom.verdacht === true && !(fair && phantomNurRegister(d));
	if (phantomVerdacht) {
		const phantomScore = typeof d.phantom.score === "number" ? d.phantom.score : 25;
		const deckel = Math.min(30, phantomScore);
		d.gesamtScore = Math.min(d.gesamtScore != null ? d.gesamtScore : deckel, deckel);
	}
	if (d.insolvenz && d.insolvenz.verdacht === true) d.gesamtScore = Math.min(d.gesamtScore != null ? d.gesamtScore : 25, 25);
	const sank = d.sanktion || {};
	const kiSanktion = sank.treffer === true && (sank.art === "sanktion" || sank.art === "beides");
	const euSanktion = sankDeckelTreffer(d._sanktionen && d._sanktionen.treffer).length > 0;
	const sanktionTreffer = kiSanktion || euSanktion;
	const pepTreffer = sank.treffer === true && sank.art === "pep";
	if (sanktionTreffer) {
		const sScore = kiSanktion && typeof sank.score === "number" ? sank.score : 25;
		const deckelS = Math.min(30, sScore);
		d.gesamtScore = Math.min(d.gesamtScore != null ? d.gesamtScore : deckelS, deckelS);
	} else if (pepTreffer) {
		d.gesamtScore = Math.min(d.gesamtScore != null ? d.gesamtScore : 60, 60);
	}
	if (d.gesamtScore !== null && d.gesamtScore !== undefined) {
		if (phantomVerdacht) {
			d.verdict = "bad";
			d.verdictText = t("v_warn", "Erhöhte Sorgfaltspflicht");
		} else if (d.gesamtScore >= 75) {
			d.verdict = "ok";
			d.verdictText = t("v_ok", "Geringe Auffälligkeiten");
		} else if (d.gesamtScore >= 50) {
			d.verdict = "warn";
			d.verdictText = t("v_warn", "Erhöhte Sorgfaltspflicht");
		} else {
			d.verdict = "bad";
			d.verdictText = t("v_bad", "Verstärkte Sorgfaltspflicht");
		}
	}
	return d;
}
function sitzAuswerten(eingabe, auswahl, report, g) {
	eingabe = eingabe || {};
	const eigene = !!(eingabe.ort || eingabe.plz);
	const soll = eigene ? {
		ort: eingabe.ort || "",
		plz: eingabe.plz || ""
	} : {
		ort: auswahl && auswahl.ort || "",
		plz: auswahl && auswahl.plz || ""
	};
	const eingegeben = [soll.plz, soll.ort].filter(Boolean).join(" ");
	let quelle = String(report && report.sitzLautQuelle || "").replace(/\s+/g, " ").trim();
	let quelleName = String(report && report.sitzQuelle || "").trim();
	if (!quelle || isNA(quelle) || /nicht (gefunden|ermittelt|belegt)|unbekannt/i.test(quelle)) {
		quelle = "";
		quelleName = "";
	}
	if (!quelle && g && g.formattedAddress) {
		const go = googleOrt(g.formattedAddress);
		if (go.ort) {
			quelle = [go.plz, go.ort].filter(Boolean).join(" ");
			quelleName = "Google";
		}
	}
	if (!eingegeben && !quelle) return null;
	const vergleichbar = !!(eingegeben && quelle && (soll.ort && ortWorte(quelle).length || soll.plz && plzAus(quelle)));
	const abweichung = vergleichbar && !ortPasst({
		ort: quelle,
		plz: plzAus(quelle)
	}, soll);
	return {
		eingegeben: eingegeben.slice(0, 100),
		ausAuswahl: !eigene && !!auswahl,
		register: String(auswahl && auswahl.register || "").slice(0, 80),
		quelle: quelle.slice(0, 120),
		quelleName: quelleName.slice(0, 60),
		abweichung,
		abzug: abweichung ? SITZ_ABZUG : 0
	};
}
function sitzHinweise(d) {
	const z = d && d._sitz;
	if (!z || !z.abweichung) return [];
	return [{
		typ: "bad",
		kategorie: "Sitz",
		text: "Eingetragener Sitz laut " + (z.quelleName || "Quelle") + " („" + z.quelle + "“) weicht vom angegebenen Ort („" + z.eingegeben + "“) ab. Möglicherweise wurde eine gleichnamige Firma gefunden oder der Sitz wurde verlegt – Identität bitte prüfen. Score −" + (z.abzug || SITZ_ABZUG) + " Punkte."
	}];
}
function hochrisikoBlockHTML(d) {
	const h = d && d._hochrisiko;
	if (!h || typeof h !== "object" || typeof h.zeile !== "string" || !h.zeile) return "";
	const de = h.zeile, en = typeof h.zeile_en === "string" && h.zeile_en ? h.zeile_en : h.zeile;
	const en_ = LANG === "en";
	return "<div class=\"hr-block\" data-tr=\"aus\">" + "<div class=\"hr-kopf\" data-hr=\"1\" data-de=\"" + escapeHtml("Hochrisiko-Drittstaat (feste Prüfung)") + "\" data-en=\"" + escapeHtml("High-risk third country (fixed check)") + "\">" + escapeHtml(en_ ? "High-risk third country (fixed check)" : "Hochrisiko-Drittstaat (feste Prüfung)") + "</div>" + "<div class=\"hr-zeile\" data-hr=\"1\" data-de=\"" + escapeHtml(de) + "\" data-en=\"" + escapeHtml(en) + "\">" + escapeHtml(en_ ? en : de) + "</div>" + "</div>";
}
function hrSpracheAnwenden(root, sprache) {
	try {
		const en = (sprache || LANG) === "en";
		(root || document).querySelectorAll("[data-hr=\"1\"]").forEach(function(el) {
			const t = el.getAttribute(en ? "data-en" : "data-de");
			if (t !== null && el.textContent !== t) el.textContent = t;
		});
	} catch (e) {}
}
function sitzKarteHTML(d) {
	const z = d && d._sitz;
	if (!z || !z.abweichung) return "";
	return "<div class=\"sitz-karte\">" + "<div class=\"sitz-k-kopf\"><span class=\"sitz-k-ico\">!</span><span class=\"sitz-k-t\">Sitz weicht ab</span>" + "<span class=\"sitz-k-abzug\">−" + (z.abzug || SITZ_ABZUG) + " Punkte</span></div>" + "<div class=\"sitz-k-grid\">" + "<div><span class=\"sitz-k-l\">Sitz (eingegeben)</span><b>" + escapeHtml(z.eingegeben) + "</b></div>" + "<div><span class=\"sitz-k-l\">Sitz (laut " + escapeHtml(z.quelleName || "Quelle") + ")</span><b>" + escapeHtml(z.quelle) + "</b></div>" + "</div>" + "<div class=\"sitz-k-d\">Möglicherweise wurde eine gleichnamige Firma an einem anderen Ort gefunden oder der Sitz wurde verlegt. " + "Bitte Identität und Registereintrag prüfen, bevor die Akte abgeschlossen wird.</div>" + "</div>";
}
function sitzMeta(d) {
	const z = d && d._sitz;
	if (!z || !(z.quelle || z.eingegeben)) return "";
	return "Sitz: " + escapeHtml(z.quelle || z.eingegeben) + (z.abweichung ? " <span class=\"sitz-chip\">weicht ab</span>" : "");
}
function fehlendeSpalte(err) {
	const m = String(err && err.message || "");
	const x = m.match(/Could not find the '([a-z_]+)' column/i) || m.match(/column "?(?:[a-z_]+\.)?([a-z_]+)"?(?: of relation "?[a-z_]+"?)? does not exist/i);
	return x ? x[1] : null;
}
var START_SPERRE = false;
function pflichtHinweis(id, text) {
	const el = document.getElementById(id);
	if (!el) return;
	el.classList.remove("pflicht-fehler");
	void el.offsetWidth;
	el.classList.add("pflicht-fehler");
	let h = document.getElementById(id + "Hinweis");
	if (!h) {
		h = document.createElement("div");
		h.id = id + "Hinweis";
		h.className = "pflicht-hinweis";
		h.setAttribute("role", "alert");
		el.insertAdjacentElement("afterend", h);
	}
	h.textContent = text;
	try {
		el.focus({ preventScroll: false });
	} catch (e) {}
	const weg = function() {
		el.classList.remove("pflicht-fehler");
		const x = document.getElementById(id + "Hinweis");
		if (x) x.remove();
		el.removeEventListener("input", weg);
		el.removeEventListener("change", weg);
	};
	el.addEventListener("input", weg);
	el.addEventListener("change", weg);
}
async function startSearch(ignoriereDuplikat) {
	if (START_SPERRE) return;
	START_SPERRE = true;
	let gestartet = false;
	try {
		const nameEingabe = document.getElementById("nameInput").value.trim();
		if (!nameEingabe) {
			pflichtHinweis("nameInput", LANG === "en" ? "Please enter the company name." : "Bitte den Namen des Unternehmens eingeben.");
			return;
		}
		if (nameEingabe.length < 2 || nameEingabe.length > 120) {
			pflichtHinweis("nameInput", LANG === "en" ? "The company name must be between 2 and 120 characters." : "Der Firmenname muss zwischen 2 und 120 Zeichen lang sein.");
			return;
		}
		const land = document.getElementById("landInput").value;
		if (!land) {
			pflichtHinweis("landInput", LANG === "en" ? "Please select the country." : "Bitte das Land auswählen.");
			return;
		}
		if (!kontingentVerfuegbar()) return;
		if (ignoriereDuplikat !== true) {
			const alt = await findeFruehereAnalyse(nameEingabe);
			if (alt) {
				zeigeDuplikatHinweis(alt);
				return;
			}
		}
		const sitz = sitzEingabe();
		const klaerung = await firmaKlaeren(nameEingabe, land, sitz);
		if (!klaerung || klaerung.art === "abbruch") return;
		const auswahl = klaerung.auswahl || null;
		FIRMA_AUSWAHL = auswahl;
		const name = auswahl && auswahl.name ? auswahl.name : nameEingabe;
		if (auswahl && auswahl.name) document.getElementById("nameInput").value = auswahl.name;
		if (klaerung.automatisch && auswahl) {
			try {
				zeigeToast("Firma eindeutig zugeordnet", "Geprüft wird " + auswahl.name + " (" + [auswahl.plz, auswahl.ort].filter(Boolean).join(" ") + (auswahl.register ? ", " + auswahl.register : "") + ").");
			} catch (e) {}
		}
		const ordnerSel = document.getElementById("ordnerSelect");
		const ordnerWahl = ordnerSel ? ordnerSel.value : "auto";
		ORDNER_AUTO = ordnerWahl === "auto";
		setSELECTED_ORDNER_ID(ordnerWahl && ordnerWahl !== "auto" ? ordnerWahl : null);
		let ust = document.getElementById("ustInput").value.trim();
		if (ust && UST_ART === "stnr") ust = "StNr: " + ust;
		document.getElementById("emptyState").style.display = "none";
		document.getElementById("report").classList.remove("active");
		document.getElementById("loading").classList.add("active");
		document.getElementById("searchBtn").disabled = true;
		stepIdx = 0;
		setStep(STEPS[0]);
		fortschrittStart();
		stepTimer = setInterval(() => {
			stepIdx = (stepIdx + 1) % STEPS.length;
			setStep(STEPS[stepIdx]);
		}, 1200);
		gestartet = true;
		runAnalysis(name, ust, land, sitz, auswahl).finally(function() {
			START_SPERRE = false;
		});
	} finally {
		if (!gestartet) START_SPERRE = false;
	}
}
async function runAnalysis(name, ust, land, sitz, auswahl) {
	AUS_HISTORIE = false;
	const startDoks = {
		beleg: START_DOKS.beleg.slice(),
		ausweis: START_DOKS.ausweis.slice()
	};
	if (startDoks.beleg.length || startDoks.ausweis.length) {
		START_DOKS = {
			beleg: [],
			ausweis: []
		};
		try {
			startDoksRender();
		} catch (e) {}
	}
	sitz = sitz || {
		ort: "",
		plz: ""
	};
	const sollSitz = {
		ort: sitz.ort || auswahl && auswahl.ort || "",
		plz: sitz.plz || auswahl && auswahl.plz || ""
	};
	const ortTeil = [sollSitz.plz, sollSitz.ort].filter(Boolean).join(" ");
	let googleFehlerAnalyse = null;
	try {
		let viesData = null;
		let searchName = name;
		if (ust && ust.trim() && !/^StNr:/i.test(ust.trim())) {
			setStep("USt-ID wird offiziell geprüft (VIES)…");
			try {
				const viesRes = await workerCall("vies", { vatId: ust.trim() });
				if (viesRes && (viesRes.valid || viesRes.status)) {
					viesData = viesRes;
					if (viesRes.valid && viesRes.name && viesRes.name !== "---") searchName = viesRes.name;
				}
			} catch (e) {}
		}
		setStep("Firma wird bei Google gesucht…");
		const placesQuery = [
			searchName,
			ortTeil,
			land && land !== "Andere" ? land : ""
		].filter(Boolean).join(", ");
		const placesRes = await workerCall("places_search", { query: placesQuery });
		const placesListe = placesRes && Array.isArray(placesRes.places) ? placesRes.places : [];
		if (placesRes && placesRes.googleFehler) googleFehlerAnalyse = placesRes.googleFehler;
		const place = ortTeil ? placesListe.find(function(pl) {
			return ortPasst(googleOrt(pl.formattedAddress), sollSitz);
		}) || null : placesListe[0] || null;
		let googleData = null;
		if (place) {
			setStep("Bewertungen & Kontaktdaten werden geladen…");
			googleData = place;
		}
		setStep("Firma wird im Internet recherchiert…");
		const sitzFuerPruefung = ortTeil || auswahl && auswahl.register ? {
			ort: sollSitz.ort,
			plz: sollSitz.plz,
			register: auswahl && auswahl.register || ""
		} : null;
		const claudeRes = await workerCall("pruefen", {
			name,
			ust,
			land,
			googleData,
			viesData,
			sprache: LANG,
			sitz: sitzFuerPruefung
		});
		if (claudeRes.error) throw new Error(claudeRes.error.message || "Claude Fehler");
		if (claudeRes.stop_reason === "max_tokens") {
			console.warn("Antwort wurde wegen max_tokens abgeschnitten – Felder könnten fehlen");
		}
		let text = (claudeRes.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join("");
		text = text.replace(/```json|```/g, "").trim();
		const jsonStart = text.indexOf("{");
		const jsonEnd = text.lastIndexOf("}");
		if (jsonStart !== -1 && jsonEnd !== -1) text = text.substring(jsonStart, jsonEnd + 1);
		let report;
		try {
			report = JSON.parse(text);
		} catch (parseErr) {
			let fixed = text.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/}\s*{/g, "},{").replace(/"\s*\n\s*"/g, "\", \"").replace(/]\s*"/g, "], \"").replace(/}\s*"/g, "}, \"");
			try {
				report = JSON.parse(fixed);
			} catch (stillBroken) {
				setStep("Ergebnis wird finalisiert…");
				const retryRes = await workerCall("repair_json", { broken: text });
				let retryText = (retryRes.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join("");
				retryText = retryText.replace(/```json|```/g, "").trim();
				const rs = retryText.indexOf("{"), re_ = retryText.lastIndexOf("}");
				if (rs !== -1 && re_ !== -1) retryText = retryText.substring(rs, re_ + 1);
				report = JSON.parse(retryText);
			}
		}
		report._standort = standortWert();
		report._sprache = LANG === "en" ? "en" : "de";
		const viesOk = !!(viesData && viesData.valid);
		report._dataSource = (viesOk ? "vies" : "") + (googleData ? "google" : viesOk ? "" : "ki");
		if (viesData && viesData.status === "unavailable") report._viesUnavailable = true;
		if (land && land !== "Andere") report._land = land;
		delete report._hochrisiko;
		if (claudeRes && claudeRes._hochrisiko && typeof claudeRes._hochrisiko === "object" && typeof claudeRes._hochrisiko.zeile === "string") report._hochrisiko = claudeRes._hochrisiko;
		if ((report.googleTrefferKorrekt === false || report.googleTrefferKorrekt === "false") && googleData && googleData.displayName && namenGleich(googleData.displayName.text, name) && sitz && (sitz.ort || sitz.plz) && ortPasst(googleOrt(googleData.formattedAddress), sitz)) {
			report.googleTrefferKorrekt = true;
			report._googleNameNormalisiert = true;
		}
		const googleTrefferOk = report.googleTrefferKorrekt !== false && report.googleTrefferKorrekt !== "false";
		report._evidence = {
			photoNames: googleTrefferOk && googleData && Array.isArray(googleData.photos) ? googleData.photos.map((p) => p.name).filter(Boolean) : [],
			address: googleTrefferOk && googleData && googleData.formattedAddress ? googleData.formattedAddress : null,
			mapsUri: googleTrefferOk && googleData && googleData.googleMapsUri ? googleData.googleMapsUri : null,
			placeName: googleData && googleData.displayName && googleData.displayName.text ? googleData.displayName.text : name
		};
		report._evidence.placeId = googleTrefferOk && googleData && googleData.id ? googleData.id : null;
		const gLoc = googleTrefferOk && googleData && googleData.location ? googleData.location : null;
		if (gLoc && isFinite(Number(gLoc.latitude)) && isFinite(Number(gLoc.longitude))) {
			report._evidence.lat = Number(gLoc.latitude);
			report._evidence.lng = Number(gLoc.longitude);
		}
		report._sitz = sitzAuswerten(sitz, auswahl, report, googleTrefferOk && googleData ? googleData : null);
		if (auswahl && auswahl.register) report._registerAuswahl = auswahl.register;
		try {
			report._identitaet = identitaetBewerten(report, viesData, {
				company: name,
				vat_id: ust || "",
				zip: sollSitz.plz,
				city: sollSitz.ort,
				street: "",
				website: "",
				country: land
			}, null, googleTrefferOk && googleData ? googleData : null);
		} catch (e) {}
		if (googleFehlerAnalyse) report._googleFehler = {
			status: googleFehlerAnalyse.status || 0,
			grund: googleFehlerAnalyse.grund || "unbekannt"
		};
		showReport(report, name);
		if (startDoks.beleg.length || startDoks.ausweis.length) {
			try {
				startDoksNachStart(report, startDoks);
			} catch (e) {}
		}
	} catch (err) {
		if ((startDoks.beleg.length || startDoks.ausweis.length) && !START_DOKS.beleg.length && !START_DOKS.ausweis.length) {
			START_DOKS = startDoks;
			try {
				startDoksRender();
			} catch (e) {}
		}
		clearInterval(stepTimer);
		fortschrittStop();
		document.getElementById("loading").classList.remove("active");
		document.getElementById("searchBtn").disabled = false;
		document.getElementById("emptyState").style.display = "block";
		document.getElementById("emptyState").innerHTML = `<div class="empty-icon" style="background:var(--bad-bg)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg></div>` + `<p style="color:var(--bad-text);font-weight:600">${friendlyError(err && err.message)}</p>` + `<button class="btn-retry" data-act-click="h73"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Erneut versuchen</button>` + (err && err.message ? `<p class="err-detail">Technisches Detail: ${escapeHtml(err.message)}</p>` : "");
	}
}
var START_DOKS = {
	beleg: [],
	ausweis: []
};
var START_DOKS_TYPEN = [{
	typ: "beleg",
	titel: "Handelsregisterauszug / Nachweise",
	info: "Hierher ziehen oder auswählen · mehrere Dateien möglich"
}, {
	typ: "ausweis",
	titel: "Ausweis",
	info: "Vorder- und Rückseite · hierher ziehen oder auswählen"
}];
function startDoksRender() {
	const g = document.getElementById("startDoksGrid");
	if (!g) return;
	g.innerHTML = START_DOKS_TYPEN.map(function(k) {
		const liste = START_DOKS[k.typ] || [];
		const dateien = liste.map(function(x, n) {
			const bez = k.typ === "ausweis" ? n === 0 ? "Vorderseite" : n === 1 ? "Rückseite" : "Seite " + (n + 1) : "";
			return "<div class=\"up-datei\">" + (x.vorschau ? "<img class=\"up-mini\" src=\"" + x.vorschau + "\" alt=\"\" />" : "<div class=\"up-mini up-mini-pdf\">PDF</div>") + "<div class=\"up-datei-info\">" + (bez ? "<div class=\"up-datei-b\">" + bez + "</div>" : "") + "<div class=\"up-datei-n\">" + escapeHtml(x.file.name) + "</div></div>" + "<button type=\"button\" class=\"up-datei-x\" data-act-click=\"h168\" data-a0=\"" + escapeAttr(k.typ) + "\" data-a1=\"" + escapeAttr(n) + "\" title=\"Entfernen\" aria-label=\"Entfernen\">" + "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M18 6 6 18M6 6l12 12\"/></svg></button></div>";
		}).join("");
		return "<div class=\"kyc-box sd-box " + (liste.length ? "kyc-voll" : "kyc-leer") + "\" data-typ=\"" + k.typ + "\" " + "data-act-dragover=\"h140\" data-act-dragleave=\"h141\" data-act-drop=\"h169\" data-a0=\"" + escapeAttr(k.typ) + "\">" + "<div class=\"kyc-box-t\">" + k.titel + (liste.length ? "<span class=\"kyc-anzahl\">" + liste.length + (liste.length === 1 ? " Datei" : " Dateien") + "</span>" : "") + "</div>" + (liste.length ? "<div class=\"up-dateien\">" + dateien + "</div>" : "<div class=\"kyc-box-file\" style=\"white-space:normal;\">" + k.info + "</div>") + "<div class=\"up-btns\"><button type=\"button\" class=\"kyc-btn\" data-act-click=\"h170\" data-a0=\"" + escapeAttr(k.typ) + "\">" + (liste.length ? "+ Weitere Datei" : "Datei auswählen") + "</button></div>" + "<input type=\"file\" id=\"sdFile_" + k.typ + "\" accept=\"image/jpeg,image/png,image/webp,application/pdf\" multiple style=\"display:none\" data-act-change=\"h171\" data-a0=\"" + escapeAttr(k.typ) + "\" />" + "</div>";
	}).join("");
	const n = START_DOKS.beleg.length + START_DOKS.ausweis.length;
	const z = document.getElementById("startDoksZahl");
	if (z) z.textContent = n ? " · " + n + (n === 1 ? " Datei" : " Dateien") + " ausgewählt" : "";
	const st = document.getElementById("startDoksStatus");
	if (st && START_DOKS.beleg.length > 3 && !st.getAttribute("data-fehler")) st.textContent = START_DOKS.beleg.length + " Belege gewählt: bei der ersten Bewertung werden 3 gelesen, die übrigen bei der nächsten Neubewertung.";
	else if (st && !st.getAttribute("data-fehler")) st.textContent = "";
}
function startDoksPick(typ) {
	const i = document.getElementById("sdFile_" + typ);
	if (i) i.click();
}
async function startDoksDateien(typ, files) {
	if (!files || !files.length) return;
	const st = document.getElementById("startDoksStatus");
	if (st) {
		st.removeAttribute("data-fehler");
		st.textContent = "";
	}
	const fehler = [];
	const liste = Array.prototype.slice.call(files);
	for (let i = 0; i < liste.length; i++) {
		let file = liste[i];
		try {
			file = await dateiVorbereiten(file);
		} catch (e) {}
		const erlaubt = [
			"image/jpeg",
			"image/png",
			"image/webp",
			"application/pdf"
		];
		if (!file || erlaubt.indexOf(file.type) < 0) {
			fehler.push(heicHinweis(file || {}) || (file && file.name || "Datei") + ": bitte ein Bild (JPG/PNG/WebP) oder PDF.");
			continue;
		}
		if (file.size > 10 * 1024 * 1024) {
			fehler.push((file.name || "Datei") + ": zu groß (max. 10 MB).");
			continue;
		}
		let vorschau = null;
		if (file.type.indexOf("image/") === 0) {
			try {
				vorschau = "data:" + file.type + ";base64," + await dateiAlsB64(file);
			} catch (e) {}
		}
		START_DOKS[typ].push({
			file,
			vorschau
		});
	}
	startDoksRender();
	if (fehler.length && st) {
		st.setAttribute("data-fehler", "1");
		st.textContent = "Nicht übernommen: " + fehler.join(" ");
	}
}
function startDoksDrop(ev, typ) {
	ev.preventDefault();
	try {
		ev.currentTarget.classList.remove("drag");
	} catch (e) {}
	const fs = ev.dataTransfer && ev.dataTransfer.files;
	if (fs && fs.length) startDoksDateien(typ, fs);
}
function startDoksEntfernen(typ, n) {
	if (!Array.isArray(START_DOKS[typ])) return;
	START_DOKS[typ].splice(n, 1);
	const st = document.getElementById("startDoksStatus");
	if (st) {
		st.removeAttribute("data-fehler");
		st.textContent = "";
	}
	startDoksRender();
}
async function startDoksNachStart(d, doks) {
	const belege = doks && doks.beleg || [], ausweise = doks && doks.ausweis || [];
	if (!belege.length && !ausweise.length) return;
	const pid = d && d.pruefId;
	const weg = function() {
		return CURRENT_REPORT !== d;
	};
	const ende = function(titel, text) {
		try {
			neuStatus(null);
		} catch (e) {}
		try {
			zeigeToast(titel, text);
		} catch (e) {}
	};
	const OHNE = "Die Akte bleibt mit dem Score ohne Dokumente.";
	try {
		neuStatus("laeuft", "Dokumente werden hochgeladen …");
	} catch (e) {}
	try {
		const lauf = SPEICHERN_LAEUFT.get(d);
		if (lauf) await lauf;
	} catch (e) {}
	const id = d && d._analyseId || null;
	if (!id) {
		ende("Dokumente nicht hochgeladen", "Die Akte konnte nicht gespeichert werden – bitte die Dokumente in der Akte hochladen.");
		return;
	}
	for (let i = 0; i < 40 && !weg() && KYC.pruefId === pid && KYC.analyseId !== id; i++) await new Promise(function(r) {
		setTimeout(r, 250);
	});
	if (!weg() && KYC.pruefId === pid && !KYC.analyseId) {
		KYC.analyseId = id;
		try {
			await kycLaden();
		} catch (e) {}
	}
	if (weg() || KYC.pruefId !== pid || KYC.analyseId !== id) {
		ende("Dokumente nicht hochgeladen", "Die Akte wurde vorher gewechselt – es wurde nichts in eine andere Akte geladen. Bitte die Dokumente in der Akte hochladen.");
		return;
	}
	let belegOk = 0, fehlgeschlagen = 0, abgebrochen = false;
	const auftrag = belege.map(function(x) {
		return ["beleg", x.file];
	}).concat(ausweise.map(function(x) {
		return ["ausweis", x.file];
	}));
	for (const [typ, file] of auftrag) {
		if (weg() || KYC.analyseId !== id) {
			abgebrochen = true;
			break;
		}
		let ok = false;
		try {
			ok = await kycUpload(typ, file, id) === true;
		} catch (e) {
			ok = false;
		}
		if (ok) {
			if (typ === "beleg") belegOk++;
		} else fehlgeschlagen++;
	}
	if (abgebrochen) {
		ende("Dokumente nicht vollständig hochgeladen", "Die Akte wurde gewechselt – die restlichen Dokumente wurden nicht hochgeladen.");
		return;
	}
	if (!belegOk) {
		if (fehlgeschlagen) ende("Dokumente nicht vollständig hochgeladen", OHNE + " Bitte die fehlenden Dokumente im Bereich „Dokumente“ hochladen.");
		else ende("Dokumente in der Akte", ausweise.length === 1 ? "Der Ausweis liegt in der Akte." : "Die Dokumente liegen in der Akte.");
		return;
	}
	if (weg()) {
		ende("Dokumente in der Akte", "Die Akte wurde gewechselt – keine Neubewertung gestartet. „Neu bewerten“ ist in der Akte jederzeit möglich.");
		return;
	}
	const vorher = CURRENT_REPORT;
	await neuBewerten("Dokumente werden ausgewertet …");
	const erfolg = !NEU_FEHLER && CURRENT_REPORT !== vorher;
	if (!erfolg) {
		try {
			zeigeToast("Dokumente nicht ausgewertet", OHNE + " Die Dokumente liegen in der Akte – „Neu bewerten“ ist jederzeit manuell möglich.");
		} catch (e) {}
		if (!NEU_FEHLER) {
			try {
				neuStatus("fehler", OHNE + " Die Dokumente liegen in der Akte – bitte „Neu bewerten“ manuell starten.");
			} catch (e) {}
		}
		return;
	}
	const offen = Math.max(0, belegOk - (CURRENT_REPORT && CURRENT_REPORT._belegeAusgewertet || []).length);
	if (belegOk > 3 || fehlgeschlagen || offen > 0) {
		setTimeout(function() {
			try {
				zeigeToast(fehlgeschlagen ? "Nicht alle Dokumente hochgeladen" : "Weitere Belege offen", (fehlgeschlagen ? fehlgeschlagen + " Datei(en) konnten nicht hochgeladen werden. " : "") + (offen > 0 ? "Je Durchgang werden höchstens 3 Belege gelesen – die übrigen " + offen + " werden bei der nächsten Neubewertung ausgewertet." : ""));
			} catch (e) {}
		}, 2400);
	}
}
try {
	startDoksRender();
} catch (e) {}
function scC(n) {
	if (!n) return "var(--gray-l)";
	return n >= 75 ? "var(--ok-text)" : n >= 50 ? "var(--warn-text)" : "var(--bad-text)";
}
function barC(n) {
	if (!n) return "bar-amber";
	return n >= 75 ? "bar-green" : n >= 50 ? "bar-amber" : "bar-red";
}
function miniScore(n) {
	if (n === null || n === undefined) {
		return `<div class="mini-score"><span class="mini-num na" style="color:var(--gray-l);font-size:12px;font-style:italic">N/A</span></div>`;
	}
	return `<div class="mini-score"><span class="mini-num" style="color:${scC(n)}">${n}</span></div>`;
}
function gauge(score) {
	const r = 44, circ = 2 * Math.PI * r;
	const s = typeof score === "number" && score > 0 ? score : 0;
	const filled = s / 100 * circ;
	const col = s >= 75 ? "#22C55E" : s >= 50 ? "#F59E0B" : "#EF4444";
	return `<svg class="gauge-svg" viewBox="0 0 104 104">
    <circle class="gauge-track" cx="52" cy="52" r="${r}"/>
    <circle class="gauge-fill" cx="52" cy="52" r="${r}" stroke="${col}" stroke-dasharray="${filled} ${circ}"/>
  </svg>`;
}
function catIcon(title) {
	const I = {
		"Grunddaten": "<path d=\"M3 21h18M5 21V7l8-4v18M19 21V11l-6-4\"/>",
		"Personen": "<circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87\"/>",
		"Finanzen": "<line x1=\"12\" y1=\"1\" x2=\"12\" y2=\"23\"/><path d=\"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6\"/>",
		"Reputation": "<path d=\"M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21l2.3-7.4-6-4.6h7.6z\"/>",
		"Kontakt & Online": "<path d=\"M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/>"
	};
	return `<span class="sec-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[title] || I["Grunddaten"]}</svg></span>`;
}
function isNA(v) {
	return !v || v === "N/A" || v === "Nicht gefunden" || v === "Nicht verfügbar" || v === "Nicht geprüft" || v === "null";
}
function secCard(title, data, weight) {
	const rows = data.felder.map((f) => {
		const na = isNA(f.value);
		let status = na ? "na" : f.status || "neutral";
		const cls = na ? "na" : status === "neutral" ? "neutral" : status;
		const val = na ? "N/A" : escapeHtml(f.value);
		const dotColor = na ? "var(--gray-l)" : status === "ok" ? "var(--ok)" : status === "warn" ? "var(--warn)" : status === "bad" ? "var(--bad)" : "var(--gray-l)";
		const dot = `<span class="kv-dot" style="background:${dotColor}"></span>`;
		let src = "";
		if (!na) {
			if (Array.isArray(f.sources) && f.sources.length > 0) {
				const parts = f.sources.filter((s) => s && s.name && !isNA(s.name)).map((s) => sichereUrl(s.url) ? `<a class="kv-src-link" href="${sichereUrl(s.url)}" target="_blank" rel="noopener" title="Quelle öffnen: ${escapeHtml(s.name)}">${escapeHtml(s.name)} ↗</a>` : `<span class="kv-src-plain">${escapeHtml(s.name)}</span>`);
				if (parts.length) src = `<span class="kv-src">${parts.join("<span class=\"kv-src-sep\"> · </span>")}</span>`;
			} else if (f.source && !isNA(f.source)) {
				if (sichereUrl(f.sourceUrl)) {
					src = `<a class="kv-src kv-src-link" href="${sichereUrl(f.sourceUrl)}" target="_blank" rel="noopener" title="Quelle öffnen: ${escapeHtml(f.source)}">${escapeHtml(f.source)} ↗</a>`;
				} else {
					src = `<span class="kv-src">${escapeHtml(f.source)}</span>`;
				}
			}
		}
		const feldId = "kv_" + title.replace(/[^a-z0-9]/gi, "_") + "_" + String(f.key || "").replace(/[^a-z0-9]/gi, "_");
		const editierbar = BEARBEITEN_AN && !/gesamt|score|vertrauen/i.test(f.key || "");
		const stift = `<button class="kv-stift" data-act-click="h89" data-a0="${escapeAttr(feldId)}" title="Wert ergänzen oder korrigieren" tabindex="-1"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>`;
		return `<div class="kv" id="${feldId}" data-kat="${escapeHtml(title)}" data-feld="${escapeHtml(f.key || "")}">
      <span class="kv-k">${dot}${escapeHtml(feldLabel(f.key, f.value))}</span>
      <span class="kv-v ${cls}">${val}${src}</span>
      ${stift}
    </div>`;
	}).join("");
	const w = weight ? `<span class="sec-weight">${weight}</span>` : "";
	const rowsOrEmpty = rows || "<div class=\"kv\"><span class=\"kv-v na\" style=\"font-style:italic\">Für diese Kategorie konnten keine Daten ermittelt werden.</span></div>";
	return `<div class="sec-card">
    <div class="sec-header">
      <div class="sec-title">${catIcon(title)}${title}${w}</div>
      ${miniScore(data.score)}
    </div>${rowsOrEmpty}
  </div>`;
}
function identitaetHTML(d) {
	const idt = d && d._identitaet;
	if (!idt || idt.registerStatus === "found" || !idt.notizen || !idt.notizen.length) return "";
	const weitere = idt.notizen.slice(1).map(function(n) {
		return "<li>" + escapeHtml(n.de) + "</li>";
	}).join("");
	const basis = (idt.basis || []).map(function(b) {
		return {
			register: "Handelsregister",
			vies: "USt-ID (VIES)",
			website: "Website",
			google: "Google"
		}[b] || b;
	}).join(" · ");
	return "<div class=\"idt-box " + (idt.viesAnker ? "ok" : "warn") + "\"><div class=\"idt-t\">Identitätsprüfung" + (basis ? " · <span class=\"idt-basis\">" + escapeHtml(basis) + "</span>" : "") + "</div>" + "<div class=\"idt-text\">" + escapeHtml(idt.notizen[0].de) + "</div>" + (weitere ? "<ul class=\"idt-liste\">" + weitere + "</ul>" : "") + "</div>";
}
function phantomHTML(d) {
	if (!d.phantom || d.phantom.verdacht !== true) return "";
	if (registerFairnessAktiv(d) && phantomNurRegister(d)) return "";
	const indizien = (d.phantom.indizien || []).map((ind) => {
		const sw = ind.schwere || "mittel";
		const swCls = sw === "hoch" ? "schwere-hoch" : sw === "niedrig" ? "schwere-niedrig" : "schwere-mittel";
		const src = ind.source && !isNA(ind.source) ? `<span class="phantom-indiz-src">${escapeHtml(ind.source)}</span>` : "";
		return `<div class="phantom-indiz">
      <span class="phantom-schwere ${swCls}">${sw}</span>
      <span class="phantom-indiz-text">${escapeHtml(ind.text)}${src}</span>
    </div>`;
	}).join("");
	return `<div class="phantom-card reveal">
    <div class="phantom-header">
      <div class="phantom-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
      </div>
      <div>
        <div class="phantom-sub">Compliance-Warnung · Strohmann-Verdacht</div>
        <div class="phantom-title">Phantom-/Strohmann-Verdacht erkannt</div>
      </div>
    </div>
    <div class="phantom-summary">${d.phantom.zusammenfassung ? escapeHtml(d.phantom.zusammenfassung) : "Es bestehen Anzeichen für eine Strohmann-Konstruktion. Die offiziell eingetragene Person ist möglicherweise nicht der tatsächliche wirtschaftlich Berechtigte."}</div>
    ${indizien}
  </div>`;
}
function insolvenzHTML(d) {
	if (!d.insolvenz || d.insolvenz.verdacht !== true) return "";
	const details = (d.insolvenz.details || []).map((det) => {
		const src = det.source && !isNA(det.source) ? `<span class="phantom-indiz-src">${escapeHtml(det.source)}</span>` : "";
		const txt = typeof det === "string" ? det : det.text || "";
		return `<div class="phantom-indiz">
      <span class="phantom-schwere schwere-hoch">Insolvenz</span>
      <span class="phantom-indiz-text">${escapeHtml(txt)}${src}</span>
    </div>`;
	}).join("");
	return `<div class="insolvenz-card reveal">
    <div class="phantom-header">
      <div class="insolvenz-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9h.01M9 13h.01M9 17h.01"/></svg>
      </div>
      <div>
        <div class="phantom-sub">Compliance-Warnung \u00b7 Finanzielle Schieflage</div>
        <div class="insolvenz-title">Insolvenz-/Insolvenzverfahren erkannt</div>
      </div>
    </div>
    <div class="phantom-summary">${d.insolvenz.zusammenfassung ? escapeHtml(d.insolvenz.zusammenfassung) : "Es bestehen konkrete Anzeichen für eine Insolvenz oder ein laufendes Insolvenzverfahren. Dies ist ein schwerwiegendes Risikosignal und erfordert besondere Sorgfalt."}</div>
    ${details}
  </div>`;
}
function manuelleFelder(d) {
	let n = 0;
	[
		"grunddaten",
		"personen",
		"reputation",
		"finanzen"
	].forEach(function(kat) {
		const k = d && d[kat];
		if (!k || !Array.isArray(k.felder)) return;
		k.felder.forEach(function(f) {
			if (f && f._manuell) n++;
		});
	});
	const kt = d && d.kontakt || {};
	if (String(kt.source || "").indexOf("Manuell") >= 0) n++;
	return n;
}
var PP_STATUS = {
	bestaetigt: {
		t: "Bestätigt",
		k: "ok"
	},
	nicht_bestaetigt: {
		t: "Nicht bestätigt",
		k: "neutral"
	},
	widerspruch: {
		t: "Widerspruch",
		k: "bad"
	}
};
function pruefprotokollHTML(d) {
	const ep = d && d._ergPruefung && typeof d._ergPruefung === "object" ? d._ergPruefung : {};
	const dp = d && Array.isArray(d._dokPruefung) ? d._dokPruefung : [];
	const keys = Object.keys(ep);
	if (!keys.length && !dp.length) return "";
	const datum = function(iso) {
		const t = new Date(iso);
		return isNaN(t) ? "" : t.toLocaleDateString("de-DE", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric"
		});
	};
	let h = "<div class=\"sec-card pp-karte reveal\">" + "<div class=\"pp-kopf\"><span class=\"pp-ico\"><svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/></svg></span>" + "<div><div class=\"pp-sub\">KI-Prüfprotokoll</div><div class=\"pp-titel\">So wurden Ergänzungen und Dokumente geprüft</div></div></div>";
	if (keys.length) {
		h += "<div class=\"pp-abschnitt\">Ergänzte Angaben</div><div class=\"pp-liste\">" + keys.map(function(k) {
			const e = ep[k] || {};
			const st = PP_STATUS[e.status] || PP_STATUS.nicht_bestaetigt;
			const teile = String(k).split(">");
			const feld = teile.pop().trim();
			const kat = teile.join(">").trim();
			const link = sichereUrl(e.url);
			return "<div class=\"pp-zeile\">" + "<div class=\"pp-feld\"><b>" + escapeHtml(feld) + "</b>" + (kat ? "<span>" + escapeHtml(kat) + "</span>" : "") + "</div>" + "<span class=\"pp-badge " + st.k + "\">" + st.t + "</span>" + "<div class=\"pp-detail\">" + (e.notiz ? "<span>" + escapeHtml(e.notiz) + "</span>" : "") + (e.quelle ? "<span class=\"pp-quelle\">Quelle: " + (link ? "<a href=\"" + link + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + escapeHtml(e.quelle) + "</a>" : escapeHtml(e.quelle)) + "</span>" : "") + "</div></div>";
		}).join("") + "</div>";
	}
	if (dp.length) {
		h += "<div class=\"pp-abschnitt\">Ausgewertete Dokumente</div>" + dp.map(function(x) {
			x = x || {};
			const ab = (Array.isArray(x.abgleich) ? x.abgleich : []).filter(Boolean);
			const leer = function(v) {
				return /^\s*(n\/?a|\u2013|-|\u2014|unbekannt|keine angabe|nicht gefunden|nicht angegeben|null)?\s*$/i.test(String(v == null ? "" : v));
			};
			const istNeu = function(a) {
				return !a.passt && leer(a.bericht);
			};
			const vergleich = ab.filter(function(a) {
				return !istNeu(a);
			});
			const neuAnz = ab.length - vergleich.length;
			const passt = vergleich.filter(function(a) {
				return a.passt;
			}).length;
			const plakette = vergleich.length ? "<span class=\"pp-badge " + (passt === vergleich.length ? "ok" : "warn") + "\">" + passt + " von " + vergleich.length + " Angaben stimmen" + (neuAnz ? " · " + neuAnz + " neu" : "") + "</span>" : neuAnz ? "<span class=\"pp-badge ok\">" + neuAnz + (neuAnz === 1 ? " neue Angabe" : " neue Angaben") + "</span>" : "";
			const gel = Array.isArray(x.gelesen) ? x.gelesen : [];
			const hin = Array.isArray(x.hinweise) ? x.hinweise.slice() : [];
			if (x.lesbar === false) hin.push("Das Dokument war nur eingeschränkt lesbar.");
			return "<div class=\"pp-dok\">" + "<div class=\"pp-dok-kopf\"><div><b>" + escapeHtml(x.datei || "Dokument") + "</b><span>" + escapeHtml(x.art || "Dokument") + (x.stand ? " · Stand " + escapeHtml(x.stand) : "") + "</span></div>" + plakette + "</div>" + (gel.length ? "<div class=\"pp-gelesen\">" + gel.map(function(g) {
				return "<span><em>" + escapeHtml(g.feld) + "</em>" + escapeHtml(g.wert) + "</span>";
			}).join("") + "</div>" : "") + (ab.length ? "<div class=\"pp-abgleich\">" + ab.map(function(a) {
				if (istNeu(a)) return "<div class=\"pp-ab neu\"><span class=\"pp-ab-ico\">+</span><b>" + escapeHtml(a.feld) + "</b><span> – neu aus dem Dokument: „" + escapeHtml(a.dokument || "–") + "“</span></div>";
				return "<div class=\"pp-ab " + (a.passt ? "ok" : "bad") + "\"><span class=\"pp-ab-ico\">" + (a.passt ? "✓" : "✗") + "</span><b>" + escapeHtml(a.feld) + "</b>" + (a.passt ? "" : "<span> – Dokument: „" + escapeHtml(a.dokument || "–") + "“, Bericht: „" + escapeHtml(a.bericht || "–") + "“</span>") + "</div>";
			}).join("") + "</div>" : "") + (hin.length ? "<div class=\"pp-hinweise\">" + hin.map(function(t) {
				return "<div>" + escapeHtml(t) + "</div>";
			}).join("") + "</div>" : "") + "</div>";
		}).join("");
	}
	h += "<div class=\"pp-fuss\">Stand der Prüfung: " + (datum(d._pruefprotokollStand) || "–") + " · KI-gestützte Auswertung – bei Widersprüchen bitte manuell prüfen.</div></div>";
	return h;
}
function manuellHinweisHTML(d) {
	const n = manuelleFelder(d);
	const belege = typeof KYC !== "undefined" && KYC.doks && KYC.doks.beleg ? KYC.doks.beleg.length : 0;
	if (!n && !belege) return "";
	const was = [];
	if (n) was.push(n === 1 ? "eine Angabe" : n + " Angaben");
	if (belege) was.push(belege === 1 ? "ein Dokument" : belege + " Dokumente");
	return `<div class="manuell-haft">
    <div class="manuell-haft-t">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
      Vom Nutzer ergänzte Angaben
    </div>
    <div class="manuell-haft-txt">
      Dieser Bericht enthält ${was.join(" und ")}, die der prüfende Nutzer selbst eingetragen
      beziehungsweise hochgeladen hat. Diese Inhalte stammen nicht aus der automatischen Recherche.
      Sie sind im Bericht als „Manuell ergänzt“ gekennzeichnet und fließen in die Bewertung ein.
      Die Verantwortung für ihre Richtigkeit und Vollständigkeit liegt beim Nutzer; eine amtliche
      Verifizierung durch die Automati Labs GmbH findet insoweit nicht statt.
    </div>
  </div>`;
}
function evidenceHTML(d) {
	const ev = d._evidence || {};
	return `<div class="evidence-card reveal">
    <div class="evidence-header">
      <div class="evidence-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3"/><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>
      </div>
      <div>
        <div class="evidence-sub">Beweismittel · Bildrecherche</div>
        <div class="evidence-title">${eigeneBilderLesen(ev).length ? "Bilder zum Unternehmen" : "Bilder zum Unternehmen (Google Maps)"}</div>
      </div>
    </div>
    <div class="evidence-item">
      <div class="evidence-item-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        Standort &amp; Umgebung${eigeneBilderLesen(ev).length ? "" : " (Google)"} <span id="evidenceCount" style="margin-left:auto;font-weight:600;color:var(--gray-l);text-transform:none;letter-spacing:0"></span>
      </div>
      <div class="evidence-gallery" id="evidenceGallery">
        <div class="evidence-img-loading">Bilder werden geladen…</div>
      </div>
      <div class="evidence-quelle" id="evidenceQuelle"></div>
      <div class="evidence-note">${eigeneBilderLesen(ev).length ? "Hinterlegte Bilder zum Unternehmen. Herkunft und Urheber stehen direkt unter den Bildern." : "Automatisch über Google zugeordnete Bilder zur angegebenen Adresse. Die Zuordnung erfolgt anhand des Namens des Unternehmens und sollte bei Bedarf manuell verifiziert werden."}</div>
    </div>
    ${karteHTML(ev)}
  </div>`;
}
function karteHat(ev) {
	return !!(ev && (ev.lat != null && ev.lng != null && isFinite(Number(ev.lat)) && isFinite(Number(ev.lng)) || ev.address && String(ev.address).trim().length >= 5));
}
function karteLink(ev) {
	const eigen = sichereUrl(ev.mapsUri);
	if (eigen) return eigen;
	const q = ((ev.placeName || "") + " " + (ev.address || "")).trim();
	return sichereUrl("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q) + (ev.placeId ? "&query_place_id=" + encodeURIComponent(ev.placeId) : ""));
}
function karteHTML(ev) {
	if (!karteHat(ev)) return "";
	const link = karteLink(ev);
	return `<div class="evidence-item ev-karte-item">
      <div class="evidence-item-label">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>
        Standort auf der Karte (Google Maps) <span id="evidenceKarteZeit" class="ev-karte-zeit"></span>
      </div>
      <a class="evidence-karte" id="evidenceKarte" href="${link}" target="_blank" rel="noopener noreferrer" title="Auf Google Maps öffnen">
        <div class="evidence-img-loading">Karte wird geladen…</div>
      </a>
      <div class="ev-karte-fuss">
        <span class="ev-karte-adr">${escapeHtml(ev.address || "")}</span>
        <a class="ev-karte-link" href="${link}" target="_blank" rel="noopener noreferrer">Auf Google Maps öffnen ↗</a>
      </div>
    </div>`;
}
async function karteLaden(ev) {
	const box = document.getElementById("evidenceKarte");
	if (!box) return;
	ev = ev || {};
	const mitKoord = ev.lat != null && ev.lng != null && isFinite(Number(ev.lat)) && isFinite(Number(ev.lng));
	const payload = mitKoord ? {
		lat: Number(ev.lat),
		lng: Number(ev.lng)
	} : { adresse: ev.address || "" };
	let fehler = null;
	try {
		const res = await workerFetch("karte", payload);
		const typ = res.headers && res.headers.get("content-type") || "";
		if (res.ok && typ.indexOf("image") === 0) {
			const url = URL.createObjectURL(await res.blob());
			if (!box.isConnected) return;
			const img = new Image();
			img.className = "ev-karte-bild";
			img.alt = "Kartenausschnitt: Standort des Unternehmens laut Google Maps";
			img.onload = function() {
				if (!box.isConnected) return;
				box.innerHTML = "";
				box.appendChild(img);
				einblenden(img);
				const zeit = document.getElementById("evidenceKarteZeit");
				if (zeit) zeit.textContent = "abgerufen am " + new Date().toLocaleString("de-DE", {
					day: "2-digit",
					month: "2-digit",
					year: "numeric",
					hour: "2-digit",
					minute: "2-digit"
				}) + " Uhr";
			};
			img.onerror = function() {
				karteFehler(box, { grund: "unbekannt" });
			};
			img.src = url;
			return;
		}
		try {
			fehler = await res.json();
		} catch (e) {
			fehler = { grund: "unbekannt" };
		}
	} catch (e) {
		fehler = { grund: "netz" };
	}
	if (box.isConnected) karteFehler(box, fehler || {});
}
function karteFehler(box, f) {
	const gesperrt = /karte_gesperrt|abrechnung|schluessel|api_aus|zugriff|kein_schluessel/.test(f && f.grund || "");
	box.classList.add("ohne-bild");
	box.innerHTML = "<div class=\"ev-karte-leer\">" + (gesperrt ? "Kartenausschnitt derzeit nicht abrufbar – der Link zu Google Maps funktioniert trotzdem." : "Für diesen Standort konnte kein Kartenausschnitt erstellt werden.") + (gesperrt && googleAdmin() ? "<span class=\"ev-karte-admin\">Admin: „Maps Static API“ aktivieren und beim Google-Schlüssel erlauben.</span>" : "") + "</div>";
}
setTimeout(function() {
	try {
		akteVorschauZeichnen();
	} catch (e) {}
}, 0);
var _FEHLER_TOAST_LETZTER = 0;
function unerwarteterFehlerHinweis() {
	try {
		const jetzt = Date.now();
		if (jetzt - _FEHLER_TOAST_LETZTER < 3e4) return;
		_FEHLER_TOAST_LETZTER = jetzt;
		const t = document.createElement("div");
		t.className = "tr-toast";
		t.setAttribute("role", "status");
		t.innerHTML = "<button class=\"tr-toast-x\" title=\"Schließen\">✕</button>" + "<div class=\"tr-toast-t\">⚠️ Unerwarteter Fehler</div>" + "<div class=\"tr-toast-d\">Unerwarteter Fehler – bitte Seite neu laden oder Support kontaktieren</div>";
		function weg() {
			if (t.dataset.weg) return;
			t.dataset.weg = "1";
			t.classList.remove("an");
			t.classList.add("weg");
			setTimeout(function() {
				if (t.parentNode) t.remove();
			}, 340);
		}
		const x = t.querySelector(".tr-toast-x");
		if (x) x.onclick = function(ev) {
			ev.stopPropagation();
			weg();
		};
		t.onclick = weg;
		let stapel = document.getElementById("toastStapel");
		if (!stapel) {
			stapel = document.createElement("div");
			stapel.id = "toastStapel";
			document.body.appendChild(stapel);
		}
		stapel.appendChild(t);
		if (typeof einblenden === "function") einblenden(t);
		else t.classList.add("an");
		setTimeout(weg, 1e4);
	} catch (e) {}
}
window.addEventListener("unhandledrejection", function(ev) {
	try {
		console.error("Unbehandelter Promise-Fehler:", ev && ev.reason);
	} catch (e) {}
	try {
		const grund = ev && ev.reason;
		const nm = String(grund && grund.name || "");
		const tx = String(grund && grund.message || (typeof grund === "string" ? grund : "") || "");
		if (nm === "AbortError" || /AbortError/.test(tx)) return;
		if (/NavigatorLock|LockManager|\block\b/i.test(nm + " " + tx)) return;
		if (nm === "TypeError" && /Failed to fetch|NetworkError|Load failed|network/i.test(tx)) return;
	} catch (e) {}
	unerwarteterFehlerHinweis();
});
window.addEventListener("error", function(ev) {
	try {
		if (ev && ev.target && ev.target !== window && ev.target.tagName) return;
		console.error("Unbehandelter Fehler:", ev && (ev.error || ev.message) || ev);
		if (ev && !ev.error && /ResizeObserver loop|^Script error\.?$/i.test(String(ev.message || ""))) return;
	} catch (e) {}
	unerwarteterFehlerHinweis();
});
var NEU_VERSION = "v12.51";
var APP_VERSION = "v12.74";
try {
	document.querySelectorAll(".app-version").forEach(function(el) {
		el.textContent = APP_VERSION;
	});
} catch (e) {}
var UPDATE_KURZ = "Neu: Die Akten-Historie lädt schneller, die API meldet Störungen sauber und Fehler werden stabiler abgefangen.";
var NEUIGKEITEN = [
	{
		farbe: "#2E8749",
		v: "v12.70",
		ico: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"m9 15 2 2 4-4\"/>",
		t: "Aktueller Score im Ausdruck, Dokumente beim Anlegen",
		kurz: "Ausdruck zeigt immer den aktuellen Score; Dokumente schon beim Anlegen der Akte; Endverbleibserklärung per Drag & Drop",
		d: "Ausdruck zeigt immer den aktuellen Score; Dokumente schon beim Anlegen der Akte; Endverbleibserklärung per Drag & Drop."
	},
	{
		farbe: "#2E8749",
		v: "v12.69",
		ico: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/>",
		t: "Sanktionsabgleich: Originalschrift und fertiger Abgleich",
		kurz: "Sanktionsabgleich: Firmenname auch in Originalschrift abgeglichen, Schritt erst nach fertigem Abgleich erledigt",
		d: "Sanktionsabgleich: Firmenname auch in Originalschrift abgeglichen, Schritt erst nach fertigem Abgleich erledigt."
	},
	{
		farbe: "#2E8749",
		v: "v12.68",
		ico: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/>",
		t: "Sanktionsabgleich: Treffer aus API und Monitoring",
		kurz: "Sanktionsabgleich: Treffer aus API- und Monitoring-Akten werden angezeigt, Aktenname wird immer abgeglichen",
		d: "Sanktionsabgleich: Treffer aus API- und Monitoring-Akten werden angezeigt, Aktenname wird immer abgeglichen."
	},
	{
		farbe: "#2E8749",
		v: "v12.67",
		ico: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/>",
		t: "Sanktionsabgleich: keine Entwarnung ohne Aussage",
		kurz: "Sanktionsabgleich: alte Listen und fehlende Namen geben keine Entwarnung mehr",
		d: "Sanktionsabgleich: alte Listen und fehlende Namen geben keine Entwarnung mehr."
	},
	{
		farbe: "#2E8749",
		v: "v12.65",
		ico: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/>",
		t: "Sanktionsabgleich: klare Anzeige",
		kurz: "Sanktionsabgleich: Ist die EU-Liste nicht aktuell oder scheitert der Abgleich, wird das jetzt klar angezeigt.",
		d: "Ist die EU-Sanktionsliste älter als 14 Tage oder leer, oder scheitert der Abgleich, zeigen Bericht, Akte und PDF keine Entwarnung mehr, sondern einen grauen Hinweis mit der Bitte um manuelle Prüfung."
	},
	{
		farbe: "#2E8749",
		v: "v12.51",
		ico: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/>",
		t: "Sanktionsabgleich genauer",
		kurz: "Schwache Namensähnlichkeiten mit der EU-Sanktionsliste erscheinen jetzt gelb zur manuellen Prüfung statt rot.",
		d: "Nur eindeutige Treffer auf der EU-Sanktionsliste deckeln weiterhin den Score und erscheinen rot. Schwache Ähnlichkeiten – etwa bei sehr häufigen Namen – werden gelb mit „Manuell prüfen“ angezeigt, ohne Abzug im Score. Geprüft wird wie bisher gegen die vollständige Liste."
	},
	{
		farbe: "#2E8749",
		v: "v12.50",
		ico: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/>",
		t: "Score in der Akten-Übersicht",
		kurz: "Akten mit Treffer auf der EU-Sanktionsliste zeigen jetzt auch in Liste und Kennzahlen den gedeckelten Score.",
		d: "Auch ältere Akten mit Treffer auf der EU-Sanktionsliste erscheinen in „Akten & Ordner“, in den Kennzahlen und im Ordner-PDF mit dem gedeckelten Score und der Einstufung „Verstärkte Sorgfaltspflicht“ – genauso wie im Bericht. Die Farben der Kennzahlen, der Überwachung und der Aktivitäten folgen jetzt denselben Stufen wie der Bericht: grün ab 75, gelb ab 50. Gespeicherte Akten werden dabei nicht verändert."
	},
	{
		farbe: "#2E8749",
		v: "v12.49",
		ico: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/>",
		t: "Ordner & Historie verbessert",
		kurz: "Doppelte Ordnernamen werden klar gemeldet, Links zu älteren Akten öffnen zuverlässig und neue Prüfungen zeigen bei EU-Sanktionstreffern auch in der Historie den gedeckelten Score.",
		d: "Legst du einen Ordner mit einem schon vergebenen Namen an, bekommst du eine verständliche Meldung. Links zu Akten, die weiter hinten in der Historie liegen, öffnen jetzt die richtige Akte. Bei neuen Prüfungen mit Treffer auf der EU-Sanktionsliste stehen Score und Einstufung in „Akten & Ordner“ genauso wie im Bericht. Die Historie bleibt bei kurzen Verbindungsproblemen schnell, und die Kennzahlen zeigen, über wie viele Akten sie gerechnet sind."
	},
	{
		farbe: "#389650",
		v: "v12.47",
		ico: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/>",
		t: "Neues Logo",
		kurz: "Der Compliance Checker hat ein eigenes Logo – im Tool, auf der Startseite, beim Login und als App-Symbol.",
		d: "Das neue Logo zeigt den Kolben mit Schild und Haken. Es erscheint im Kopf des Tools, auf der Startseite, beim Login und in der Paketauswahl, im Browser-Tab sowie als Symbol, wenn du den Checker auf dem Handy-Homescreen ablegst. An den Funktionen ändert sich nichts."
	},
	{
		farbe: "#2E8749",
		v: "v12.46",
		ico: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/>",
		t: "Stabiler & sicherer",
		kurz: "Die Akten-Historie lädt schneller, die API meldet Störungen sauber und Fehler werden stabiler abgefangen.",
		d: "Die Historie lädt auch bei sehr vielen Akten zügig – sie erscheint seitenweise, weitere Akten holst du mit „Mehr laden“, und die Suche findet weiterhin alle. Die API meldet kurze Störungen jetzt sauber (mit Hinweis, es später erneut zu versuchen), statt fälschlich einen Zugriffsfehler zu zeigen. Treffer der EU-Sanktionsliste drücken die Bewertung jetzt konsequent. Unerwartete Fehler werden stabiler abgefangen."
	},
	{
		farbe: "#0C86A3",
		v: "v12.45",
		ico: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z\"/>",
		t: "Firmennamen lesbar & Länderordner",
		kurz: "Ausländische Firmennamen stehen in lateinischer Schrift, die Suche findet beide Schreibweisen, und neue Akten landen automatisch im Länderordner.",
		d: "Firmen aus dem Ausland, z. B. aus Bulgarien, erscheinen in lateinischer Schrift, darunter klein der Originalname (z. B. kyrillisch). Die Suche in „Akten & Ordner“ findet eine Akte mit beiden Schreibweisen – auch bestehende Akten. Neue Akten landen automatisch im Ordner ihres Landes, der bei Bedarf angelegt wird. Beim Start kannst du weiterhin einen eigenen Ordner oder „Kein Ordner“ wählen, und verschieben geht wie gewohnt."
	},
	{
		farbe: "#128F86",
		v: "v12.43",
		ico: "<path d=\"M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z\"/>",
		t: "Akte aufgeräumt",
		kurz: "Die Bereiche einer Akte reagieren einheitlich auf die Maus, und die Upload-Felder der KYC-Ablage werden wieder korrekt angezeigt.",
		d: "Alle Bereiche in der Akte heben sich beim Überfahren mit der Maus gleich hervor. Die KYC-Ablage hat wieder den gewohnten Abstand. Ein Fehler, bei dem statt der Upload-Felder „undefinedundefined“ stand, ist behoben. Ein Klick auf die leere Box öffnet die Dateiauswahl."
	},
	{
		farbe: "#B45309",
		v: "v12.42",
		ico: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01\"/>",
		t: "Klare Meldung bei sehr langen Recherchen",
		kurz: "Dauert die Recherche zu einer Firma ungewöhnlich lange, bekommst du eine klare Meldung mit Tipp.",
		d: "Bricht die Recherche zu einer Firma nach sehr langer Laufzeit ab, erklärt die Meldung das und empfiehlt, es mit Sitz (Ort) oder USt-ID erneut zu versuchen. Das geht meist schneller."
	},
	{
		farbe: "#2E8749",
		v: "v12.41",
		ico: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/>",
		t: "Mehr Zeit für gründliche Prüfungen",
		kurz: "Aufwändige Prüfungen, etwa von Firmen im Ausland, laufen jetzt bis zum Ende durch.",
		d: "Prüfungen und Neubewertungen dürfen bis zu 15 Minuten dauern, statt vorher abgebrochen zu werden. Läuft eine Prüfung länger als 4 Minuten, zeigt die Anzeige an, dass sie noch arbeitet."
	},
	{
		farbe: "#475569",
		v: "v12.40",
		ico: "<path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75\"/>",
		t: "Besserer Support im Hintergrund",
		kurz: "Unser Support-Team erkennt Probleme jetzt schneller.",
		d: "Unser Support-Team hat ein neues internes Übersichts-Dashboard (v12.38 bis v12.40). Fragen und Probleme lassen sich so schneller erkennen und bearbeiten. Für dich ändert sich in der Bedienung nichts."
	},
	{
		farbe: "#475569",
		v: "v12.38",
		ico: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"m9 15 2 2 4-4\"/>",
		t: "Kleine Korrekturen",
		kurz: "Der Hinweis „Gespeichert“ und der Sprachwechsel funktionieren wieder zuverlässig.",
		d: "Der Hinweis „Gespeichert“ erscheint wieder zuverlässig. Beim Wechsel auf Englisch bleibt die Anzeige „Translating …“ nicht mehr hängen."
	},
	{
		farbe: "#1E5D9A",
		v: "v12.37",
		ico: "<rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/>",
		t: "API-Zugang sofort sichtbar",
		kurz: "Die Karte „API-Zugang“ unter „Konto & Daten“ ist für die Teamleitung sofort sichtbar.",
		d: "Unter „Konto & Daten“ erscheint die Karte „API-Zugang“ für die Teamleitung gleich beim ersten Öffnen. Dort erzeugst und widerrufst du den API-Schlüssel für angebundene Systeme."
	},
	{
		farbe: "#475569",
		v: "v12.36",
		ico: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"m9 15 2 2 4-4\"/>",
		t: "API-PDFs ohne Entwurfs-Kennzeichnung",
		kurz: "PDFs aus der REST-API tragen keinen Entwurfs-Hinweis mehr, sondern eine neutrale Zeile mit Prüf-ID und Datum.",
		d: "PDFs, die über die REST-API (z. B. aus dem Car-Client) erstellt werden, tragen kein Entwurfs-Banner, kein Wasserzeichen „Akte nicht abgeschlossen“ und keinen Entwurfs-Zusatz im Dateinamen mehr. Stattdessen steht oben die Zeile „Automatische Prüfung über die REST-API“ mit Prüf-ID und Datum. Ausdrucke im Tool sind unverändert."
	},
	{
		farbe: "#0C86A3",
		v: "v12.35",
		ico: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z\"/>",
		t: "Firmen im Ausland zuverlässiger prüfen",
		kurz: "Firmen ohne Handelsregister werden jetzt über ihre USt-ID geprüft. Akte und PDF zeigen, worauf die Identität beruht.",
		d: "Gibt es für eine Firma kein auffindbares Register, wird die Identität über die USt-ID (EU-Abfrage VIES) bestätigt. Außerhalb der EU helfen Website und Google-Eintrag, mit deutlichem Hinweis. Akte und PDF zeigen, worauf die Identität beruht. Der Score bleibt dabei fair. Über die REST-API lassen sich zusätzlich Straße und Website übergeben."
	},
	{
		farbe: "#2B79C2",
		v: "v12.34",
		ico: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"m9 15 2 2 4-4\"/>",
		t: "KI-Texte im PDF in deiner Sprache",
		kurz: "Auch die KI-Texte einer Akte erscheinen im PDF jetzt auf Deutsch oder Englisch.",
		d: "Wählst du für das PDF die andere Sprache, werden auch die von der KI geschriebenen Texte übersetzt, in beide Richtungen. Ist die Übersetzung einmal nicht verfügbar, bleiben sie in der Originalsprache, und das PDF weist darauf hin."
	},
	{
		farbe: "#1E5D9A",
		v: "v12.33",
		ico: "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M19 8v6M22 11h-6\"/>",
		t: "Prüfungen über die REST-API",
		kurz: "Eigene Systeme können Prüfungen jetzt direkt über eine REST-API starten und erhalten Ergebnis und PDF.",
		d: "Angebundene Systeme, zum Beispiel ein Fahrzeug-Verkaufssystem, starten Prüfungen automatisch über eine REST-API und bekommen Score und PDF zurück. Die Prüfungen erscheinen in der Historie. Den API-Schlüssel legt die Teamleitung unter „Konto & Daten“ → „API-Zugang“ an."
	},
	{
		farbe: "#2B79C2",
		v: "v12.32",
		ico: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z\"/>",
		t: "PDF auf Deutsch oder Englisch",
		kurz: "Bei jedem Druck wählst du, ob das PDF auf Deutsch oder Englisch erstellt wird.",
		d: "Jeder Druck- und PDF-Knopf fragt zuerst nach der Sprache, unabhängig von der Sprache der Oberfläche. Auch Hinweisfenster erscheinen in deiner Sprache. Behoben: Nach dem Wechsel zurück auf Deutsch blieben einzelne Texte englisch."
	},
	{
		farbe: "#2E8749",
		v: "v12.30",
		ico: "<polyline points=\"6 9 6 2 18 2 18 9\"/><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\"/>",
		t: "Ordner als vollständiges PDF",
		kurz: "Ein Ordner lässt sich als PDF drucken, und jede Akte darin ist vollständig.",
		d: "Beim PDF eines Ordners erscheint jede Akte so, wie du sie per Klick öffnest: mit Fotos, Karte, Sanktionsabgleich, Endverbleib und Abschluss, jede auf einer neuen Seite."
	},
	{
		farbe: "#1E5D9A",
		v: "v12.29",
		ico: "<polyline points=\"6 9 6 2 18 2 18 9\"/><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\"/>",
		t: "Sicherer Einzeldruck",
		kurz: "Beim Drucken einer Akte kommt nur diese Akte ins PDF.",
		d: "Druckst du eine einzelne Akte, gelangen keine anderen Bereiche wie Ordner, Aktenliste oder Team ins PDF."
	},
	{
		farbe: "#475569",
		v: "v12.28",
		ico: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"m9 15 2 2 4-4\"/>",
		t: "Texte und Rechtliches aktualisiert",
		kurz: "Startseite, AGB und Datenschutzerklärung sind auf dem aktuellen Stand.",
		d: "Startseite, AGB und Datenschutzerklärung wurden korrigiert, unter anderem zu Vertragslaufzeit (12 Monate, monatliche Abrechnung), Datenspeicherung in der EU und täglich aktueller EU-Sanktionsliste. Die Website nutzt keine Analyse- oder Werbe-Tools."
	},
	{
		farbe: "#B45309",
		v: "v12.26",
		ico: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01\"/>",
		t: "Pflichtfelder deutlich markiert",
		kurz: "Fehlt eine Pflichtangabe, wird das Feld rot markiert und erklärt.",
		d: "Fehlt beim Start einer Prüfung eine Pflichtangabe wie Firmenname oder Land, wird das Feld rot markiert, kurz angestoßen und mit einem Hinweis versehen."
	},
	{
		farbe: "#0C86A3",
		v: "v12.24",
		ico: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"m21 15-5-5L5 21\"/>",
		t: "Produktvideo auf der Startseite",
		kurz: "Ein 80-Sekunden-Video zeigt den Compliance-Checker im Überblick.",
		d: "Auf der Startseite zeigt ein kurzes Produktvideo ohne Ton, wie der Compliance-Checker funktioniert. Es spielt nur, solange es sichtbar ist. In v12.25 wurde der Abstand zum Kopfbereich verbessert."
	},
	{
		farbe: "#128F86",
		v: "v12.23",
		ico: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"m9 15 2 2 4-4\"/>",
		t: "Dokumente vollständig und Score ganz oben",
		kurz: "Querformat-Dokumente werden ganz angezeigt und lassen sich drehen. Der Score steht oben in der Akte.",
		d: "Ausweise und Auszüge im Querformat werden vollständig und richtig herum angezeigt, mit Großansicht und Drehen-Knopf. Der Risk-Score steht ganz oben in der Akte. Die Neubewertung zeigt einen sichtbaren Ladezustand. Namen mit Akzenten (z. B. Plzeň) werden korrekt erkannt."
	},
	{
		farbe: "#2B79C2",
		v: "v12.22",
		ico: "<path d=\"M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z\"/>",
		t: "Ruhigere Upload-Seite",
		kurz: "Die Upload-Seite für Geschäftspartner bleibt beim Hochladen ruhig.",
		d: "Auf der Upload-Seite für Geschäftspartner laufen Animationen nur noch beim ersten Erscheinen oder wenn ein Schritt gerade erledigt wurde. Die Seite springt nicht mehr bei jeder Änderung."
	},
	{
		farbe: "#1E5D9A",
		v: "v12.21",
		ico: "<circle cx=\"12\" cy=\"8\" r=\"6\"/><path d=\"M15.48 12.89 17 22l-5-3-5 3 1.52-9.11\"/>",
		t: "Sanktionsabgleich und Abschluss nachvollziehbar",
		kurz: "Die Akte zeigt, welche Namen gegen die Sanktionsliste geprüft wurden, und wer sie wann abgeschlossen hat.",
		d: "Im Sanktionsabgleich stehen alle geprüften Namen. Der Abschluss-Verlauf zeigt jedes Abschließen und Wieder-Öffnen mit Datum und Person. Vor dem Hochladen der unterschriebenen Endverbleibserklärung bestätigst du die Unterschrift. HRA-Nummern werden richtig beschriftet. Ausdrucke aus Chrome und Edge haben keine Browser-Kopfzeile mehr."
	},
	{
		farbe: "#0C86A3",
		v: "v12.20",
		ico: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/>",
		t: "Sanktionsprüfung inklusive Personen",
		kurz: "Gegen die EU-Sanktionsliste werden jetzt auch Geschäftsführung, Gesellschafter und wirtschaftlich Berechtigte geprüft.",
		d: "Neben der Firma werden Geschäftsführung, Gesellschafter und wirtschaftlich Berechtigte gegen die EU-Sanktionsliste geprüft. Ältere Akten werden automatisch nachgeprüft. Das Druck-Wasserzeichen zeigt die Prüf-ID vollständig und den Zeitpunkt des Drucks."
	},
	{
		farbe: "#2E8749",
		v: "v12.18",
		ico: "<polyline points=\"6 9 6 2 18 2 18 9\"/><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\"/>",
		t: "Anlagen im Druck passend",
		kurz: "Bild-Anlagen werden im PDF nicht mehr abgeschnitten, auch in Safari.",
		d: "Bilder in den Anlagen werden beim Drucken in einer festen Höchstgröße gesetzt und erscheinen vollständig, auch in Safari."
	},
	{
		farbe: "#128F86",
		v: "v12.17",
		ico: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"m21 15-5-5L5 21\"/>",
		t: "Eigene Bilder in der Akte",
		kurz: "In der Akte hinterlegte Fotos werden direkt angezeigt.",
		d: "Fotos, die in einer Akte hinterlegt sind, werden ohne Google-Abfrage gezeigt. Erlaubt sind JPG, PNG und WebP."
	},
	{
		farbe: "#2E8749",
		v: "v12.16",
		ico: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z\"/>",
		t: "Neue Startseite in Bewegung",
		kurz: "Die Startseite hat ruhige Scroll-Animationen.",
		d: "Beim Scrollen der Startseite zeigt eine Linie den Fortschritt, und die Bereiche gleiten sanft ins Bild."
	},
	{
		farbe: "#B45309",
		v: "v12.15",
		ico: "<path d=\"M6 9V2h12v7\"/><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\"/>",
		t: "Entwürfe klar gekennzeichnet",
		kurz: "PDFs von Akten, die noch nicht abgeschlossen sind, tragen jetzt auf jeder Seite das Wasserzeichen „Akte nicht abgeschlossen“.",
		d: "Solange eine Akte nicht abgeschlossen ist, trägt jeder Ausdruck und jedes PDF auf jeder Seite das Wasserzeichen „Akte nicht abgeschlossen“, dazu oben einen Entwurfs-Hinweis mit Druckzeitpunkt. So ist jederzeit erkennbar, ob ein Dokument den verbindlichen, abgeschlossenen Stand zeigt. Nach dem Abschluss entfällt die Kennzeichnung."
	},
	{
		farbe: "#128F86",
		v: "v12.13",
		ico: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/>",
		t: "Gründlichere Neubewertung mit Prüfprotokoll",
		kurz: "Nach Ergänzungen und neuen Dokumenten prüft die KI gründlicher – und zeigt im Prüfprotokoll, was sie bestätigt und gelesen hat.",
		d: "Die Neubewertung nutzt ein neues KI-Modell, das vor der Antwort gründlich nachdenkt. Jede ergänzte Angabe wird gegen unabhängige Quellen geprüft (bestätigt, nicht bestätigt oder Widerspruch). Für jedes Dokument zeigt das KI-Prüfprotokoll Art, Stand, gelesene Angaben und den Abgleich mit dem Bericht – inklusive Hinweis bei veralteten Auszügen. Große Fotos und iPhone-Fotos werden beim Hochladen automatisch vorbereitet."
	},
	{
		farbe: "#2E8749",
		v: "v12.11",
		ico: "<path d=\"M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z\"/><path d=\"M9 4v14M15 6v14\"/>",
		t: "Standort auf der Karte",
		kurz: "Jede Akte zeigt jetzt einen Kartenausschnitt von Google Maps mit dem Standort des Unternehmens – auch im PDF.",
		d: "Unter „Beweismittel“ zeigt jede Akte einen Kartenausschnitt von Google Maps mit Pin am Standort des Unternehmens, dazu Adresse, Abrufzeitpunkt und den Link „Auf Google Maps öffnen“. Der Ausschnitt erscheint auch im PDF-Bericht."
	},
	{
		farbe: "#2E8749",
		v: "v12.3",
		ico: "<path d=\"M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z\"/>",
		t: "Ordner auf einen Blick",
		kurz: "Deine Ordner stehen jetzt als Mappen über der Liste – mit Suche, ein Klick öffnet den Ordner.",
		d: "In „Akten & Ordner“ stehen die Ordner als Mappen über der Liste. Ein Klick öffnet den Ordner und zeigt nur seine Akten, ein zweiter Klick zeigt wieder alle. Bei vielen Ordnern hilft die Suche."
	},
	{
		farbe: "#128F86",
		v: "v12.3",
		ico: "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M19 8v6M22 11h-6\"/>",
		t: "Gruppen und Ordner in einem Schritt",
		kurz: "Beim Anlegen eines Ordners wählst du gleich die Gruppen, die ihn sehen dürfen.",
		d: "Beim Anlegen eines Ordners wählst du direkt, wer ihn sieht: nur du, bestimmte Gruppen oder das ganze Team. Umgekehrt legst du bei einer Gruppe unter „Mitglieder & Ordner“ fest, welche Ordner sie sieht."
	},
	{
		farbe: "#0C86A3",
		v: "v12.2",
		ico: "<path d=\"M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/>",
		t: "Sitz des Unternehmens",
		kurz: "Gleichnamige Firmen? Gib den Sitz an – bei mehreren Treffern fragt der Checker vorher nach.",
		d: "Neues Feld „Sitz des geprüften Unternehmens“ (Ort, PLZ). Gibt es mehrere Firmen mit gleichem Namen, erscheint vor der Prüfung eine Auswahl mit Sitz und Registernummer – die Auswahl kostet kein Kontingent. Weicht der eingetragene Sitz vom angegebenen Ort ab, zeigt die Akte einen deutlichen Hinweis und der Score sinkt."
	},
	{
		farbe: "#128F86",
		v: "v12.2",
		ico: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"m21 15-5-5L5 21\"/>",
		t: "Firmenbilder zuverlässiger",
		kurz: "Firmenbilder werden jetzt bei jedem Öffnen frisch geladen – auch in älteren Akten.",
		d: "Die Bilder zum Unternehmen werden bei jedem Öffnen frisch von Google geladen, auch in älteren Akten. Unter den Bildern stehen jetzt Quelle und Urheber. Weitere Bilder lädst du per Klick nach."
	},
	{
		farbe: "#2B79C2",
		v: "v12.0",
		nurAuto: true,
		ico: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z\"/>",
		t: "Endverbleibserklärung auf Englisch",
		kurz: "Die Endverbleibserklärung lässt sich jetzt auch auf Englisch erstellen.",
		d: "In der Karte „Endverbleibserklärung“ wählst du zwischen Deutsch und English. Voreingestellt ist Englisch, wenn der Käufer seinen Sitz außerhalb des deutschsprachigen Raums hat."
	},
	{
		farbe: "#1E5D9A",
		v: "v11.97",
		ico: "<rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/>",
		t: "Abgeschlossene Akten sind schreibgeschützt",
		d: "Nach dem Abschluss lässt sich eine Akte nicht mehr verändern – keine Ergänzungen, keine Uploads. Zum Ändern öffnest du sie im Bereich „Abschluss“ wieder. Drucken und Überwachung bleiben möglich."
	},
	{
		farbe: "#2FA36B",
		ico: "<path d=\"M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z\"/>",
		t: "Akten statt Analysen",
		d: "Jedes Unternehmen bekommt eine eigene Akte mit Bereichen: Stammdaten, Analyse, Dokumente, Sanktionslisten und Abschluss. Oben in der Akte wechselst du zwischen den Bereichen."
	},
	{
		farbe: "#2B79C2",
		ico: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"m9 15 2 2 4-4\"/>",
		t: "Endverbleibserklärung",
		nurAuto: true,
		d: "Für den Fahrzeughandel: Der Käufer bestätigt, das Fahrzeug nicht in sanktionierte Länder weiterzuverkaufen. Das Tool füllt die Erklärung vor – du trägst Fahrzeug und FIN ein und legst die unterschriebene Fassung in der Akte ab."
	},
	{
		farbe: "#1E5D9A",
		ico: "<circle cx=\"12\" cy=\"8\" r=\"6\"/><path d=\"M15.48 12.89 17 22l-5-3-5 3 1.52-9.11\"/>",
		t: "Akte abschließen",
		d: "Sind alle Schritte erledigt, bestätigst du die Vollständigkeit. Abgeschlossene Akten sind in „Akten & Ordner“ mit einem Haken markiert."
	},
	{
		farbe: "#2E8749",
		ico: "<polyline points=\"6 9 6 2 18 2 18 9\"/><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\"/>",
		t: "Einzeln oder gesamt drucken",
		d: "Unter jeder Akte druckst du genau den Bereich, in dem du gerade bist – oder die gesamte Akte als ein PDF."
	},
	{
		farbe: "#128F86",
		ico: "<path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75\"/>",
		t: "Gruppen & Standorte",
		d: "Ordner lassen sich für Gruppen (z. B. Abteilungen oder Marken) und Ränge freigeben. Beim Anlegen einer Akte hältst du fest, welcher Standort prüft."
	},
	{
		farbe: "#0C86A3",
		ico: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01\"/>",
		t: "Hilfe-Assistent",
		d: "Unten rechts beantwortet der Assistent Fragen zur Bedienung – Schritt für Schritt, rund um die Uhr."
	}
];
function neuigkeitenPruefen(versuch) {
	versuch = versuch || 0;
	let gesehen = "";
	try {
		gesehen = localStorage.getItem("cc_neu_gesehen") || "";
	} catch (e) {}
	if (gesehen === NEU_VERSION) return;
	if (typeof BRANCHE_GEPRUEFT !== "undefined" && !BRANCHE_GEPRUEFT) {
		if (versuch < 40) setTimeout(function() {
			neuigkeitenPruefen(versuch + 1);
		}, 800);
		return;
	}
	const frische = NEUIGKEITEN.filter(function(n) {
		return n.v === NEU_VERSION && (!n.nurAuto || istAutohandel());
	});
	if (!frische.length) {
		try {
			localStorage.setItem("cc_neu_gesehen", NEU_VERSION);
		} catch (e) {}
		return;
	}
	const sichtbar = function(id) {
		const e = document.getElementById(id);
		return e && e.style.display !== "none" && !e.classList.contains("hidden") && e.offsetParent !== null;
	};
	if (sichtbar("landingGate") || sichtbar("authGate")) return;
	const blockiert = sichtbar("onboardingGate") || sichtbar("planGate") || sichtbar("bootGate") || document.getElementById("brancheGate") || document.querySelector(".up-warn-back.an") || document.getElementById("neuGate");
	if (blockiert) {
		if (versuch < 40) setTimeout(function() {
			neuigkeitenPruefen(versuch + 1);
		}, 1500);
		return;
	}
	updateHinweisZeigen();
}
function updateHinweisZeigen() {
	try {
		localStorage.setItem("cc_neu_gesehen", NEU_VERSION);
	} catch (e) {}
	const t = document.createElement("div");
	t.className = "tr-toast tr-toast-klick upd-toast";
	t.innerHTML = "<button class=\"tr-toast-x\" title=\"Schließen\">✕</button>" + "<div class=\"tr-toast-t\"><span class=\"upd-punkt\"></span>Neues Update · " + APP_VERSION + "</div>" + "<div class=\"tr-toast-d\">" + ((NEUIGKEITEN.filter(function(n) {
		return n.v === NEU_VERSION && (!n.nurAuto || istAutohandel());
	})[0] || {}).kurz || UPDATE_KURZ) + "</div>" + "<div class=\"tr-toast-cta\">Was ist neu? →</div>";
	function weg() {
		if (t.dataset.weg) return;
		t.dataset.weg = "1";
		t.classList.remove("an");
		t.classList.add("weg");
		setTimeout(function() {
			if (t.parentNode) t.remove();
		}, 340);
	}
	t.querySelector(".tr-toast-x").onclick = function(ev) {
		ev.stopPropagation();
		weg();
	};
	t.onclick = function() {
		weg();
		neuigkeitenZeigen();
	};
	let stapel = document.getElementById("toastStapel");
	if (!stapel) {
		stapel = document.createElement("div");
		stapel.id = "toastStapel";
		document.body.appendChild(stapel);
	}
	stapel.appendChild(t);
	einblenden(t);
	setTimeout(weg, 16e3);
}
function neuigkeitenZeigen() {
	if (document.getElementById("neuGate")) return;
	const liste = NEUIGKEITEN.filter(function(n) {
		return !n.nurAuto || istAutohandel();
	}).sort(function(a, b) {
		return (b.v === NEU_VERSION ? 1 : 0) - (a.v === NEU_VERSION ? 1 : 0);
	});
	const box = document.createElement("div");
	box.id = "neuGate";
	box.className = "up-warn-back";
	box.onclick = function(ev) {
		if (ev.target === box) neuigkeitenSchliessen();
	};
	box.innerHTML = "<div class=\"up-warn-card neu-card\" role=\"dialog\" aria-label=\"Neuigkeiten\">" + "<button class=\"neu-zu\" data-act-click=\"h172\" title=\"Schließen\"><svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"><path d=\"M18 6 6 18M6 6l12 12\"/></svg></button>" + "<div class=\"neu-badge\">Neu · " + APP_VERSION + "</div>" + "<div class=\"neu-t\">Das ist neu im Compliance-Checker</div>" + "<div class=\"neu-liste\">" + liste.map(function(n, i) {
		return "<div class=\"neu-punkt" + (n.v === NEU_VERSION ? " frisch" : "") + "\" style=\"--nf:" + n.farbe + ";animation-delay:" + (120 + i * 60) + "ms\">" + "<span class=\"neu-ico\"><svg viewBox=\"0 0 24 24\" width=\"17\" height=\"17\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + n.ico + "</svg></span>" + "<span class=\"neu-txt\"><b>" + n.t + (n.v === NEU_VERSION ? "<em class=\"neu-tag\">Neu</em>" : "") + "</b><span>" + n.d + "</span></span>" + "</div>";
	}).join("") + "</div>" + "<div class=\"neu-support\">" + "<svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z\"/><path d=\"m22 6-10 7L2 6\"/></svg>" + "<span>Technische Probleme oder Fragen? Schreib uns an <a href=\"mailto:support@automatilabs.de\">support@automatilabs.de</a> – wir kümmern uns darum.</span>" + "</div>" + "<button class=\"up-senden neu-ok\" data-act-click=\"h172\">Alles klar</button>" + "</div>";
	document.body.appendChild(box);
	einblenden(box);
}
function neuigkeitenSchliessen() {
	try {
		localStorage.setItem("cc_neu_gesehen", NEU_VERSION);
	} catch (e) {}
	const box = document.getElementById("neuGate");
	if (!box) return;
	box.classList.remove("an");
	setTimeout(function() {
		if (box.parentNode) box.remove();
	}, 240);
}
document.addEventListener("keydown", function(ev) {
	if (ev.key === "Escape" && document.getElementById("neuGate")) neuigkeitenSchliessen();
});
function akteVorschauZeichnen() {
	const box = document.getElementById("akteVorschau");
	if (!box) return;
	if (!BRANCHE_GEPRUEFT) {
		box.innerHTML = "";
		box.classList.remove("bereit");
		return;
	}
	const sig = akteSchritteAktiv().map(function(x) {
		return x.key;
	}).join(",");
	if (box.getAttribute("data-sig") === sig) return;
	box.setAttribute("data-sig", sig);
	requestAnimationFrame(function() {
		box.classList.add("bereit");
	});
	const teile = akteSchritteAktiv();
	box.innerHTML = "<span class=\"av-label\">Jede Akte enthält</span>" + teile.map(function(x) {
		return "<span class=\"av-chip\" style=\"--farbe:" + (AKTE_FARBE[x.key] || "#2E8749") + "\">" + "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + (AKTE_ICO[x.key] || "") + "</svg>" + AKTE_BEREICH_NAME[x.key] + "</span>";
	}).join("");
}
var FIRMA_BRANCHE = null;
var BRANCHE_GEPRUEFT = false;
var BRANCHEN = [
	{
		key: "autohandel",
		name: "Autohandel / Fahrzeughandel",
		hinweis: "Mit Endverbleibserklärung für den Export",
		ico: "<path d=\"M5 17h14M7 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM3 13l2-5h14l2 5\"/>"
	},
	{
		key: "immobilien",
		name: "Immobilien",
		hinweis: "Makler, Verwalter, Bauträger",
		ico: "<path d=\"M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6\"/>"
	},
	{
		key: "finanz",
		name: "Finanzdienstleistungen",
		hinweis: "Leasing, Vermittlung, Zahlungsdienste",
		ico: "<path d=\"M2 10h20M2 14h20M6 18h.01M6 6h.01\"/><rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"/>"
	},
	{
		key: "kanzlei",
		name: "Kanzlei / Steuerberatung",
		hinweis: "Rechtsanwälte, Notare, Steuerberater",
		ico: "<path d=\"M12 3v18M5 7l7-4 7 4M5 7v10l7 4 7-4V7\"/>"
	},
	{
		key: "handel",
		name: "Güterhandel",
		hinweis: "Luxusgüter, Schmuck, Kunst, Maschinen",
		ico: "<path d=\"M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0\"/>"
	},
	{
		key: "sonstige",
		name: "Sonstige",
		hinweis: "Andere Verpflichtete nach § 2 GwG",
		ico: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 8v4M12 16h.01\"/>"
	}
];
function brancheName(k) {
	const b = BRANCHEN.find(function(x) {
		return x.key === k;
	});
	return b ? b.name : "";
}
function istAutohandel() {
	return FIRMA_BRANCHE === "autohandel" || FIRMA_BRANCHE === null;
}
async function brancheLaden() {
	if (!sb) return;
	try {
		const { data, error } = await sb.rpc("meine_branche");
		if (!error && data) FIRMA_BRANCHE = data.branche || null;
	} catch (e) {}
	BRANCHE_GEPRUEFT = true;
	brancheKontoZeichnen();
	try {
		akteVorschauZeichnen();
	} catch (e) {}
}
async function brancheAbfragen() {
	if (!BRANCHE_GEPRUEFT) await brancheLaden();
	if (FIRMA_BRANCHE) return;
	const einzel = !CURRENT_FIRMA || CURRENT_FIRMA.typ === "einzel";
	if (!einzel && !darfVerwalten()) return;
	if (document.getElementById("brancheGate")) return;
	const box = document.createElement("div");
	box.id = "brancheGate";
	box.className = "up-warn-back";
	box.innerHTML = "<div class=\"up-warn-card br-card\">" + "<div class=\"br-eyebrow\">Einmalige Einstellung</div>" + "<div class=\"br-t\">In welcher Branche ist " + escapeHtml(CURRENT_FIRMA && CURRENT_FIRMA.firma_name || "dein Unternehmen") + " tätig?</div>" + "<div class=\"br-d\">Danach richtet sich, welche Schritte eine Akte enthält. Im Autohandel gehört zum Beispiel die Endverbleibserklärung dazu. Lässt sich später unter „Konto“ ändern.</div>" + "<div class=\"br-grid\">" + BRANCHEN.map(function(b, i) {
		return "<button class=\"br-wahl\" style=\"animation-delay:" + (60 + i * 40) + "ms\" data-act-click=\"h173\" data-a0=\"" + escapeAttr(b.key) + "\">" + "<span class=\"br-ico\"><svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + b.ico + "</svg></span>" + "<span class=\"br-txt\"><b>" + b.name + "</b><small>" + b.hinweis + "</small></span>" + "</button>";
	}).join("") + "</div></div>";
	document.body.appendChild(box);
	einblenden(box);
}
async function brancheWaehlen(key, btn) {
	if (btn) {
		btn.classList.add("an");
		btn.disabled = true;
	}
	const ok = await brancheSpeichern(key);
	const box = document.getElementById("brancheGate");
	if (ok && box) {
		box.classList.remove("an");
		setTimeout(function() {
			if (box.parentNode) box.remove();
		}, 240);
	} else if (btn) {
		btn.classList.remove("an");
		btn.disabled = false;
	}
}
async function brancheSpeichern(key) {
	if (!sb) return false;
	const { data, error } = await sb.rpc("firma_branche_setzen", { p_branche: key });
	if (error || !data || !data.ok) {
		alert("Branche konnte nicht gespeichert werden: " + (error && error.message || data && data.grund || ""));
		return false;
	}
	FIRMA_BRANCHE = key;
	brancheKontoZeichnen();
	try {
		akteVorschauZeichnen();
	} catch (e) {}
	try {
		if (CURRENT_REPORT) {
			akteZeichnen();
			akteAnsicht(AKTE.ansicht, true);
		}
	} catch (e) {}
	zeigeToast("Branche gespeichert", brancheName(key) + (key === "autohandel" ? " – Akten enthalten die Endverbleibserklärung." : " – Akten ohne Endverbleibserklärung."));
	return true;
}
function brancheKontoZeichnen() {
	const card = document.getElementById("kontoBrancheCard");
	if (!card) return;
	const einzel = !CURRENT_FIRMA || CURRENT_FIRMA.typ === "einzel";
	const darf = einzel || darfVerwalten();
	card.style.display = "";
	card.innerHTML = "<div class=\"konto-card-h\">Branche</div>" + "<p class=\"konto-card-p\">Bestimmt, welche Schritte eine Akte enthält. Im Autohandel gehört die Endverbleibserklärung dazu, in anderen Branchen nicht." + (darf ? "" : " Die Einstellung kann nur die Leitung (President / Vice President) ändern.") + "</p>" + "<div class=\"br-konto\">" + BRANCHEN.map(function(b) {
		return "<button class=\"br-chip" + (FIRMA_BRANCHE === b.key ? " an" : "") + "\"" + (darf ? " data-act-click=\"h174\" data-a0=\"" + escapeAttr(b.key) + "\"" : " disabled") + ">" + "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + b.ico + "</svg>" + b.name + "</button>";
	}).join("") + "</div>" + (FIRMA_BRANCHE ? "" : "<div class=\"auth-msg\" style=\"margin-top:10px;\">Noch nicht festgelegt – bis dahin gilt die vollständige Version mit allen Schritten.</div>");
}
var AKTE = {
	sankFertig: false,
	sankFehler: false,
	ansicht: "akte",
	ansichtStart: null,
	gaugeZiel: null,
	gaugeLief: false
};
var AKTE_SCHRITTE = [
	{
		n: 1,
		key: "akte",
		titel: "Akte angelegt",
		ziel: ".report-top"
	},
	{
		n: 2,
		key: "analyse",
		titel: "Analyse",
		ziel: ".score-card"
	},
	{
		n: 3,
		key: "dokumente",
		titel: "Dokumente",
		ziel: "#nwCard"
	},
	{
		n: 4,
		key: "sanktion",
		titel: "Sanktionslisten",
		ziel: "#sankBereich"
	},
	{
		n: 5,
		key: "endverbleib",
		titel: "Endverbleibs­erklärung",
		ziel: "#endverbleibCard"
	},
	{
		n: 6,
		key: "abschluss",
		titel: "Abschluss",
		ziel: "#abschlussCard"
	}
];
function akteStatus(key) {
	const d = CURRENT_REPORT || {};
	const doks = typeof KYC !== "undefined" && KYC.doks ? KYC.doks : {};
	const sch = d._schritte || {};
	switch (key) {
		case "akte": return d.pruefId ? "ok" : "offen";
		case "analyse": return typeof d.gesamtScore === "number" ? "ok" : "offen";
		case "dokumente": {
			const n = [
				"ausweis",
				"selfie",
				"standort",
				"beleg"
			].reduce(function(a, t) {
				return a + (doks[t] || []).length;
			}, 0);
			if (n > 0) return "ok";
			return sch.dokumente && sch.dokumente.status === "nicht_erforderlich" ? "uebersprungen" : "offen";
		}
		case "sanktion":
			if (d._sanktionen && d._sanktionen.fehler === true) return "teil";
			if (d._sanktionen && sankGrauTexte(d._sanktionen, d)) return "teil";
			if (AKTE.sankKarteFehler) return "teil";
			if (AKTE.sankFertig) return "ok";
			return AKTE.sankFehler ? "teil" : "laeuft";
		case "endverbleib": {
			if (!istAutohandel()) return "uebersprungen";
			if ((doks.endverbleib || []).length) return "ok";
			if (sch.endverbleib && sch.endverbleib.status === "nicht_erforderlich") return "uebersprungen";
			return sch.endverbleib && sch.endverbleib.erstellt_am ? "teil" : "offen";
		}
		case "abschluss": return d._abgeschlossen_am ? "ok" : "offen";
	}
	return "offen";
}
function akteSchritteAktiv() {
	return istAutohandel() ? AKTE_SCHRITTE : AKTE_SCHRITTE.filter(function(x) {
		return x.key !== "endverbleib";
	});
}
function akteZaehlung() {
	let ok = 0;
	akteSchritteAktiv().forEach(function(sch) {
		const st = akteStatus(sch.key);
		if (st === "ok" || st === "uebersprungen") ok++;
	});
	return ok;
}
function akteStepperHTML() {
	return "<div class=\"akte-hub\" id=\"akteHub\"><div class=\"akte-stepper\" id=\"akteStepper\"></div></div>";
}
function akteStammHTML(d) {
	const z = function(k, v) {
		return v ? "<div class=\"st-zeile\"><span class=\"st-k\">" + k + "</span><span class=\"st-v\">" + v + "</span></div>" : "";
	};
	const datum = d._createdAt ? new Date(d._createdAt).toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}) : "";
	const sz = d._sitz || null;
	const sitzE = sz && sz.eingegeben ? escapeHtml(sz.eingegeben) + (sz.ausAuswahl ? " <span class=\"st-hinweis\">aus Auswahl</span>" : "") : "";
	const sitzQ = sz && sz.quelle ? escapeHtml(sz.quelle) + (sz.quelleName ? " <span class=\"st-hinweis\">" + escapeHtml(sz.quelleName) + "</span>" : "") + (sz.abweichung ? " <span class=\"st-warn\">weicht ab</span>" : "") : "";
	return "<div class=\"sec-card st-card reveal\">" + "<div class=\"st-head\"><div class=\"st-ico\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z\"/></svg></div>" + "<div><div class=\"st-sub\">Schritt 1 · Stammdaten</div><div class=\"st-t\">Akte angelegt</div></div></div>" + "<div class=\"st-grid\">" + z("Unternehmen", escapeHtml(nameAnzeige(d.firmenname, d.firmennameOriginal).haupt)) + z("Originalname", escapeHtml(nameAnzeige(d.firmenname, d.firmennameOriginal).original)) + z("Land", escapeHtml(d._land || "")) + z("Sitz (eingegeben)", sitzE) + z("Sitz (laut Quelle)", sitzQ) + z("USt-IdNr.", d.ustId && d.ustId !== "null" ? escapeHtml(d.ustId) : "") + z("Registernummer (Auswahl)", escapeHtml(d._registerAuswahl || "")) + z("Eigener Standort", escapeHtml(d._standort || "")) + z("Prüf-ID", escapeHtml(d.pruefId || "")) + z("Angelegt am", datum) + z("Angelegt von", d._api ? "<span class=\"api-badge\">API</span> " + escapeHtml("über API · " + (d._api.schluessel || "") + (d._api.ref ? " · Ref. " + d._api.ref : "")) : escapeHtml(d._name || d._email || "")) + z("Fassung", d._fassung ? String(d._fassung) : "") + "</div>" + "<div class=\"st-fuss\">Die Akte ist angelegt und in der Übersicht „Akten &amp; Ordner“ abgelegt. Ordner-Zuordnung und Überwachung verwaltest du dort bzw. oben in der Übersicht.</div>" + "</div>";
}
function gaugeTeile() {
	const p = document.getElementById("panelAnalyse") || document;
	return {
		num: p.querySelector(".gauge-num-val"),
		fill: p.querySelector(".gauge-fill"),
		bar: p.querySelector(".bar-fill")
	};
}
function gaugeSetzen(wert) {
	if (wert === null || wert === undefined) return;
	const t = gaugeTeile();
	if (t.fill) {
		const r = parseFloat(t.fill.getAttribute("r")) || 44, circ = 2 * Math.PI * r;
		t.fill.style.transition = "none";
		t.fill.setAttribute("stroke-dasharray", circ * wert / 100 + " " + circ);
	}
	if (t.bar) {
		t.bar.style.transition = "none";
		t.bar.style.width = wert + "%";
	}
	if (t.num) t.num.textContent = wert;
}
function gaugeAnimieren() {
	if (AKTE.gaugeLief || AKTE.gaugeZiel === null) return;
	AKTE.gaugeLief = true;
	const ziel = AKTE.gaugeZiel, t = gaugeTeile();
	if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		gaugeSetzen(ziel);
		return;
	}
	let circ = 0;
	if (t.fill) {
		const r = parseFloat(t.fill.getAttribute("r")) || 44;
		circ = 2 * Math.PI * r;
		t.fill.style.transition = "none";
		t.fill.setAttribute("stroke-dasharray", "0 " + circ);
	}
	if (t.bar) {
		t.bar.style.transition = "none";
		t.bar.style.width = "0%";
	}
	if (t.num) t.num.textContent = "0";
	setTimeout(function() {
		if (t.fill) {
			t.fill.style.transition = "stroke-dasharray 1.3s cubic-bezier(.16,1,.3,1)";
			t.fill.setAttribute("stroke-dasharray", circ * ziel / 100 + " " + circ);
		}
		if (t.bar) {
			t.bar.style.transition = "width 1.3s cubic-bezier(.16,1,.3,1)";
			t.bar.style.width = ziel + "%";
		}
		if (t.num) {
			const start = performance.now(), dauer = 1300;
			(function tick(now) {
				const p = Math.min((now - start) / dauer, 1);
				t.num.textContent = Math.round((1 - Math.pow(1 - p, 3)) * ziel);
				if (p < 1) requestAnimationFrame(tick);
				else t.num.textContent = ziel;
			})(start);
		}
	}, 140);
}
function akteAnsicht(key, ohneScroll) {
	if (!akteSchritteAktiv().some(function(x) {
		return x.key === key;
	})) key = "analyse";
	const vorher = AKTE.ansicht;
	AKTE.ansicht = key;
	if (key === "analyse" && !AKTE.gaugeLief) {
		const t = gaugeTeile();
		if (t.fill) {
			const r = parseFloat(t.fill.getAttribute("r")) || 44;
			t.fill.style.transition = "none";
			t.fill.setAttribute("stroke-dasharray", "0 " + 2 * Math.PI * r);
		}
		if (t.bar) {
			t.bar.style.transition = "none";
			t.bar.style.width = "0%";
		}
		if (t.num) t.num.textContent = "0";
	}
	document.querySelectorAll(".akte-panel").forEach(function(p) {
		const pk = p.getAttribute("data-panel");
		const an = pk === key;
		if (!an && pk === vorher && p.classList.contains("an")) p.classList.add("gesehen");
		if (an) p.querySelectorAll(".reveal").forEach(function(el) {
			el.classList.add("in-view");
		});
		p.classList.toggle("an", an);
	});
	if (key === "analyse") gaugeAnimieren();
	akteStepperZeichnen();
	if (!ohneScroll) {
		const hub = document.getElementById("akteHub");
		if (hub) {
			const r = hub.getBoundingClientRect();
			if (r.top < -20) hub.scrollIntoView({
				behavior: "smooth",
				block: "start"
			});
		}
	}
}
var AKTE_ICO = {
	akte: "<path d=\"M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z\"/>",
	analyse: "<path d=\"M3 3v18h18\"/><path d=\"m7 15 4-4 3 3 5-6\"/>",
	dokumente: "<path d=\"M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48\"/>",
	sanktion: "<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/>",
	endverbleib: "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"m9 15 2 2 4-4\"/>",
	abschluss: "<circle cx=\"12\" cy=\"8\" r=\"6\"/><path d=\"M15.48 12.89 17 22l-5-3-5 3 1.52-9.11\"/>"
};
var AKTE_FARBE = {
	akte: "#2FA36B",
	analyse: "#2E8749",
	dokumente: "#128F86",
	sanktion: "#0C86A3",
	endverbleib: "#2B79C2",
	abschluss: "#1E5D9A"
};
var AKTE_BEREICH_NAME = {
	akte: "Stammdaten",
	analyse: "Analyse",
	dokumente: "Dokumente",
	sanktion: "Sanktionslisten",
	endverbleib: "Endverbleib",
	abschluss: "Abschluss"
};
var AKTE_STATUS_ICO = {
	ok: "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\"/></svg>",
	uebersprungen: "<svg viewBox=\"0 0 24 24\" width=\"12\" height=\"12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\"><path d=\"M5 12h14\"/></svg>",
	laeuft: "<span class=\"akte-dreh\"></span>",
	teil: "<svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\"><circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 4a8 8 0 0 1 0 16z\" fill=\"currentColor\" stroke=\"none\"/></svg>"
};
function akteStepperZeichnen() {
	const box = document.getElementById("akteStepper");
	if (!box) return;
	const d = CURRENT_REPORT || {};
	const schritte = akteSchritteAktiv();
	const zu = !!d._abgeschlossen_am;
	const modus = (zu ? "bereiche" : "schritte") + "|" + schritte.map(function(x) {
		return x.key;
	}).join(",") + "|" + (AUS_HISTORIE ? 1 : 0);
	const erstesMal = !box.hasAttribute("data-modus");
	if (box.getAttribute("data-modus") !== modus) {
		box.setAttribute("data-modus", modus);
		if (!erstesMal) {
			if (AKTE.abschlussAnim) {
				AKTE.abschlussAnim = false;
				box.classList.remove("ruhig");
				box.classList.add("versiegeln");
				setTimeout(function() {
					box.classList.remove("versiegeln");
					box.classList.add("ruhig");
				}, 1500);
			} else if (AKTE.oeffnenAnim) {
				AKTE.oeffnenAnim = false;
				box.classList.remove("ruhig");
				box.classList.add("entsiegeln");
				setTimeout(function() {
					box.classList.remove("entsiegeln");
					box.classList.add("ruhig");
				}, 1300);
			} else box.classList.add("ruhig");
		}
		box.classList.toggle("bereiche", zu);
		box.innerHTML = "<div class=\"akte-kopf\">" + (AUS_HISTORIE ? "<button class=\"akte-zurueck\" data-act-click=\"h62\" title=\"Zurück zu Akten &amp; Ordner\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M19 12H5M12 19l-7-7 7-7\"/></svg></button>" : "") + "<div class=\"akte-titel\"><span class=\"akte-eyebrow\" id=\"akteEyebrow\"></span><span class=\"akte-h\" id=\"akteH\"></span></div>" + (zu ? "<span class=\"akte-siegel\"><svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\"/></svg>Vollständig abgesichert</span>" : "<div class=\"akte-balken\"><i id=\"akteBalken\"></i></div>") + "</div>" + "<div class=\"akte-schritte" + (schritte.length === 5 ? " fuenf" : "") + "\">" + schritte.map(function(sch, i) {
			return "<button class=\"akte-schritt\" id=\"akteKachel_" + sch.key + "\" data-act-click=\"h175\" data-a0=\"" + escapeAttr(sch.key) + "\" style=\"--ad:" + (.04 + i * .045) + "s;--farbe:" + (AKTE_FARBE[sch.key] || "#2E8749") + "\">" + (zu ? "<span class=\"akte-bico\"><svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + (AKTE_ICO[sch.key] || "") + "</svg></span>" : "<span class=\"akte-nr\"></span>") + "<span class=\"akte-txt\"><b>" + (zu ? AKTE_BEREICH_NAME[sch.key] : sch.titel) + "</b><small></small></span>" + "</button>";
		}).join("") + "</div>";
	}
	const fertig = akteZaehlung();
	const alle = fertig === schritte.length;
	const eb = document.getElementById("akteEyebrow"), h = document.getElementById("akteH");
	if (zu) {
		if (eb) eb.textContent = "Akte · abgeschlossen";
		if (h) h.textContent = "Abgeschlossen am " + new Date(d._abgeschlossen_am).toLocaleDateString("de-DE", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric"
		});
	} else {
		if (eb) eb.textContent = "Akte · Vollständigkeit";
		if (h) h.textContent = alle ? "Vollständig abgesichert" : fertig + " von " + schritte.length + " Schritten erledigt";
		const bal = document.getElementById("akteBalken");
		if (bal) {
			const ziel = Math.round(fertig / schritte.length * 100) + "%";
			if (!bal.getAttribute("data-gewachsen")) {
				bal.setAttribute("data-gewachsen", "1");
				bal.style.width = "0%";
				void bal.offsetWidth;
			}
			bal.style.width = ziel;
		}
	}
	box.classList.toggle("alle-fertig", alle);
	try {
		aktionenZeichnen();
	} catch (e) {}
	try {
		dokHinweisZeichnen();
	} catch (e) {}
	try {
		akteSperreZeichnen();
	} catch (e) {}
	schritte.forEach(function(sch, i) {
		const k = document.getElementById("akteKachel_" + sch.key);
		if (!k) return;
		const st = akteStatus(sch.key);
		const cls = "akte-schritt st-" + st + (AKTE.ansicht === sch.key ? " offen" : "");
		if (k.className !== cls) k.className = cls;
		const small = k.querySelector("small");
		const txt = zu ? akteBereichText(sch.key, st) : akteStatusText(sch.key, st);
		if (small && small.textContent !== txt) small.textContent = txt;
		const nr = k.querySelector(".akte-nr");
		if (nr) {
			const soll = AKTE_STATUS_ICO[st] ? st : "nr";
			if (nr.getAttribute("data-st") !== soll) {
				nr.setAttribute("data-st", soll);
				nr.innerHTML = AKTE_STATUS_ICO[st] || String(i + 1);
			}
		}
	});
}
function akteGesperrt() {
	return !!(CURRENT_REPORT && CURRENT_REPORT._abgeschlossen_am);
}
function darfWiederOeffnen() {
	const d = CURRENT_REPORT || {};
	return d._abgeschlossen_von === CURRENT_USER_ID || [
		"president",
		"vice",
		"support"
	].indexOf(CURRENT_USER_RANG) >= 0;
}
function gesperrtMelden() {
	if (!akteGesperrt()) return false;
	zeigeToast("Akte ist abgeschlossen", "Zum Ändern oder Hochladen die Akte im Bereich „Abschluss“ wieder öffnen.");
	return true;
}
function akteSperreZeichnen() {
	const zu = akteGesperrt();
	const rep = document.getElementById("report");
	if (rep) rep.classList.toggle("akte-zu", zu);
	if (zu) {
		if (typeof NW !== "undefined" && NW.modus) {
			NW.modus = false;
			try {
				nwZeichnen();
			} catch (e) {}
		}
		if (typeof BEARBEITEN_AN !== "undefined" && BEARBEITEN_AN) {
			try {
				bearbeitenAbbruch();
			} catch (e) {}
		}
	}
	const html = zu ? "<div class=\"akte-lock-in\">" + "<span class=\"akte-lock-ico\"><svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/></svg></span>" + "<span class=\"akte-lock-txt\"><b>Diese Akte ist abgeschlossen und schreibgeschützt.</b> " + (darfWiederOeffnen() ? "Zum Ändern oder Hochladen wieder öffnen." : "Wieder öffnen kann, wer sie abgeschlossen hat, oder die Leitung.") + "</span>" + (darfWiederOeffnen() ? "<button class=\"nw-btn akte-lock-btn\" data-act-click=\"h176\">Akte wieder öffnen</button>" : "") + "</div>" : "";
	document.querySelectorAll(".akte-lock").forEach(function(el) {
		const sig = zu ? "zu" : "offen";
		if (el.getAttribute("data-sig") === sig) return;
		el.setAttribute("data-sig", sig);
		el.innerHTML = html;
	});
}
function dokInfoHTML() {
	return "<div class=\"dok-info reveal\">" + "<div class=\"dok-info-t\"><svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4M12 8h.01\"/></svg>So werden deine Dateien genutzt</div>" + "<div class=\"dok-info-zeilen\">" + "<div class=\"dok-info-z\"><span class=\"dok-punkt ki\"></span><span><b>Dokumente</b> (z. B. Handelsregisterauszug) liest die KI aus, sobald du „Neu bewerten“ klickst. Daraus übernommene Angaben stehen mit dem Dateinamen als Quelle im Bericht.</span></div>" + "<div class=\"dok-info-z\"><span class=\"dok-punkt\"></span><span><b>Aufnahmen</b>, <b>Ausweis</b> und <b>Bestätigungsfoto</b> werden nicht ausgewertet. Sie liegen als Nachweis in der Akte und hängen beim Drucken an.</span></div>" + "</div></div>";
}
function dokHinweisZeichnen() {
	const box = document.getElementById("dokHinweis");
	if (!box) return;
	const doks = typeof KYC !== "undefined" && KYC.doks && KYC.doks.beleg ? KYC.doks.beleg : [];
	const gelesen = CURRENT_REPORT && Array.isArray(CURRENT_REPORT._belegeAusgewertet) ? CURRENT_REPORT._belegeAusgewertet : [];
	const unl = CURRENT_REPORT && CURRENT_REPORT._belegeUnlesbar || {};
	const neu = doks.filter(function(x) {
		return gelesen.indexOf(x.storage_path) < 0 && !unl[x.storage_path];
	}).length;
	const sig = String(neu);
	if (box.getAttribute("data-sig") === sig) return;
	box.setAttribute("data-sig", sig);
	box.innerHTML = neu ? "<div class=\"dok-hinweis-in\">" + "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/></svg>" + "<span><b>" + neu + " neue" + (neu === 1 ? "s Dokument ist" : " Dokumente sind") + " noch nicht in dieser Analyse berücksichtigt.</b> Bei der Neubewertung liest die KI " + (neu === 1 ? "es" : "sie") + " aus und übernimmt belegte Angaben.</span>" + "<button class=\"nw-btn nw-btn-p\" data-act-click=\"h177\">" + bearbIcoSvg() + "Jetzt neu bewerten</button>" + "</div>" : "";
}
var DRUCK_ICO = "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><polyline points=\"6 9 6 2 18 2 18 9\"/><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\"/></svg>";
var AKTE_ICO_MAPPE = "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z\"/></svg>";
function druckDokAnzahl(typen) {
	const doks = typeof KYC !== "undefined" && KYC.doks ? KYC.doks : {};
	return typen.reduce(function(a, t) {
		return a + (doks[t] || []).length;
	}, 0);
}
function aktionenZeichnen() {
	const box = document.getElementById("akteAktionen");
	if (!box) return;
	const k = AKTE.ansicht || "akte";
	let haupt = null;
	if (k === "analyse") haupt = ["Analyse drucken / PDF", "druckeJetzt('analyse')"];
	else if (k === "sanktion") haupt = ["Sanktionsabgleich drucken / PDF", "druckeJetzt('sanktion')"];
	else if (k === "dokumente") {
		const n = druckDokAnzahl([
			"ausweis",
			"selfie",
			"standort",
			"beleg"
		]);
		haupt = [
			n ? "Dokumente drucken / PDF (" + n + ")" : "Keine Dokumente zum Drucken",
			"druckeJetzt('dokumente')",
			!n
		];
	} else if (k === "endverbleib") {
		const n = druckDokAnzahl(["endverbleib"]);
		haupt = n ? ["Unterschriebene Erklärung drucken / PDF", "druckeJetzt('endverbleib')"] : ["Vorausgefüllt erstellen & drucken", "endverbleibDrucken()"];
	}
	const gesamtLabel = k === "abschluss" ? "Gesamte Akte herunterladen / drucken" : "Gesamte Akte als PDF";
	const entwurf = !(CURRENT_REPORT && CURRENT_REPORT._abgeschlossen_am);
	const sig = k + "|" + (haupt ? haupt.join("/") : "") + "|" + gesamtLabel + "|" + (entwurf ? "offen" : "zu");
	if (box.getAttribute("data-sig") === sig) return;
	box.setAttribute("data-sig", sig);
	box.innerHTML = (entwurf ? "<div class=\"druck-entwurf-hinweis\"><svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/><circle cx=\"12\" cy=\"12\" r=\"9\"/></svg>" + "<span>Die Akte ist noch nicht abgeschlossen – Ausdrucke und PDFs tragen das Wasserzeichen <b>„Akte nicht abgeschlossen“</b>.</span></div>" : "") + (haupt ? "<button class=\"btn-action primary\"" + (haupt[2] ? " disabled" : "") + " data-act-click=\"hDruckHaupt\" data-a0=\"" + escapeAttr(haupt[1]) + "\">" + DRUCK_ICO + haupt[0] + "</button>" + "<button class=\"btn-action\" data-act-click=\"h178\">" + AKTE_ICO_MAPPE + gesamtLabel + "</button>" : "<button class=\"btn-action primary\" data-act-click=\"h178\">" + AKTE_ICO_MAPPE + gesamtLabel + "</button>") + "<button class=\"btn-action\" data-act-click=\"h179\"><svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"/><path d=\"M3 3v5h5\"/></svg>Neue Akte</button>";
}
function akteBereichText(key, st) {
	const d = CURRENT_REPORT || {};
	if (key === "akte") return d._standort ? escapeHtml(d._standort) : "Unternehmen & Prüf-ID";
	if (key === "analyse") return typeof d.gesamtScore === "number" ? "Score " + d.gesamtScore : "Bericht";
	if (key === "dokumente") {
		const doks = KYC.doks || {};
		const n = [
			"ausweis",
			"selfie",
			"standort",
			"beleg"
		].reduce(function(a, t) {
			return a + (doks[t] || []).length;
		}, 0);
		return n ? n + " Datei" + (n === 1 ? "" : "en") : "keine Dateien";
	}
	if (key === "sanktion") return st === "ok" ? "abgeglichen" : "nicht verfügbar";
	if (key === "endverbleib") return st === "ok" ? "unterschrieben" : "nicht erforderlich";
	if (key === "abschluss") return d._abgeschlossen_von_name ? escapeHtml(d._abgeschlossen_von_name) : "bestätigt";
	return "";
}
function akteStatusText(key, st) {
	if (st === "ok") {
		if (key === "dokumente") {
			const doks = KYC.doks || {};
			const n = [
				"ausweis",
				"selfie",
				"standort",
				"beleg"
			].reduce(function(a, t) {
				return a + (doks[t] || []).length;
			}, 0);
			return n + " Datei" + (n === 1 ? "" : "en");
		}
		if (key === "abschluss" && CURRENT_REPORT && CURRENT_REPORT._abgeschlossen_am) return new Date(CURRENT_REPORT._abgeschlossen_am).toLocaleDateString("de-DE");
		if (key === "endverbleib") return "unterschrieben";
		if (key === "sanktion") return "geprüft";
		return "erledigt";
	}
	if (st === "uebersprungen") return "nicht erforderlich";
	if (st === "laeuft") return "läuft …";
	if (st === "teil") return key === "sanktion" ? "Liste nicht verfügbar – manuell prüfen" : "erstellt, Unterschrift fehlt";
	return "offen";
}
function akteSpringe(sel) {
	const el = document.querySelector(sel);
	if (!el) return;
	el.scrollIntoView({
		behavior: "smooth",
		block: "start"
	});
	el.classList.add("akte-blitz");
	setTimeout(function() {
		el.classList.remove("akte-blitz");
	}, 1400);
}
function akteZeichnen() {
	akteStepperZeichnen();
	endverbleibZeichnen();
	abschlussZeichnen();
}
async function akteSchrittSetzen(schritt, wert) {
	if (akteGesperrt()) return false;
	const id = await analyseIdErmitteln(CURRENT_REPORT);
	if (!id || !sb) return false;
	const { data, error } = await sb.rpc("akte_schritt_setzen", {
		p_analyse: id,
		p_schritt: schritt,
		p_wert: wert
	});
	if (error || !data || !data.ok) {
		alert("Konnte nicht gespeichert werden: " + (error && error.message || data && data.grund || ""));
		return false;
	}
	CURRENT_REPORT._schritte = data.schritte || {};
	try {
		const row = HISTORY_ROWS.find(function(x) {
			return x.id === id;
		});
		if (row) row.schritte = CURRENT_REPORT._schritte;
	} catch (e) {}
	return true;
}
function endverbleibCardHTML() {
	return "<div class=\"sec-card ev-card reveal\" id=\"endverbleibCard\"></div>";
}
function endverbleibZeichnen() {
	const box = document.getElementById("endverbleibCard");
	if (!box) return;
	const d = CURRENT_REPORT || {};
	const st = akteStatus("endverbleib");
	const doks = KYC.doks && KYC.doks.endverbleib || [];
	const urls = KYC.urls && KYC.urls.endverbleib || [];
	const sch = d._schritte && d._schritte.endverbleib || {};
	let status;
	if (st === "ok") status = "<span class=\"ev-status ok\"><svg viewBox=\"0 0 24 24\" width=\"11\" height=\"11\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\"/></svg>Unterschrieben hinterlegt</span>";
	else if (st === "uebersprungen") status = "<span class=\"ev-status grau\">Nicht erforderlich</span>";
	else if (st === "teil") status = "<span class=\"ev-status gelb\">Erstellt · Unterschrift fehlt</span>";
	else status = "<span class=\"ev-status grau\">Offen</span>";
	const fahrzeug = escapeHtml(sch.fahrzeug || "");
	const fin = escapeHtml(sch.fin || "");
	box.innerHTML = "<div class=\"ev-head\">" + "<div class=\"ev-ico\"><svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"m9 15 2 2 4-4\"/></svg></div>" + "<div class=\"ev-titel\"><div class=\"ev-sub\">Schritt 5 · Fahrzeughandel</div><div class=\"ev-t\">Endverbleibserklärung</div></div>" + status + "</div>" + "<div class=\"ev-txt\">Der Käufer bestätigt mit seiner Unterschrift, das Fahrzeug nicht in sanktionierte Länder weiterzuverkaufen. " + "Das Tool füllt Käufer, Verkäufer, Ort und Datum vor – Fahrzeug und FIN trägst du ein. Unterschrieben wird beim Kauf; die unterschriebene Fassung gehört danach in diese Akte.</div>" + (st === "uebersprungen" ? "<div class=\"ev-zeile-grau\">Für diesen Fall als nicht erforderlich markiert. <a data-act-click=\"h180\">Rückgängig</a></div>" : "<div class=\"ev-form\">" + "<div class=\"ev-feld\"><label>Fahrzeug (Marke, Modell)</label><input type=\"text\" id=\"evFahrzeug\" maxlength=\"80\" placeholder=\"z. B. Porsche 911 Carrera\" value=\"" + fahrzeug + "\" /></div>" + "<div class=\"ev-feld ev-feld-sp\"><label>Sprache der Erklärung</label><div class=\"ev-sprachen\">" + "<button type=\"button\" class=\"ev-sp" + (evSprache() === "de" ? " an" : "") + "\" data-sp=\"de\" data-act-click=\"h181\">Deutsch</button>" + "<button type=\"button\" class=\"ev-sp" + (evSprache() === "en" ? " an" : "") + "\" data-sp=\"en\" data-act-click=\"h182\">English</button>" + "</div></div>" + "<div class=\"ev-feld\"><label>FIN (Fahrgestellnummer)</label><input type=\"text\" id=\"evFin\" maxlength=\"17\" placeholder=\"17 Zeichen\" value=\"" + fin + "\" style=\"text-transform:uppercase;letter-spacing:.05em\" /></div>" + "</div>" + "<div class=\"ev-btns\">" + "<button class=\"nw-btn nw-btn-p\" data-act-click=\"h183\"><svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"6 9 6 2 18 2 18 9\"/><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\"/></svg>Vorausgefüllt erstellen &amp; drucken</button>" + "<label class=\"ev-best\"><input type=\"checkbox\" id=\"evBestaetigt\" data-act-change=\"h184\" /><span class=\"einw-mark\"></span>" + "<span>Die Erklärung ist vom Käufer mit <b>Ort, Datum und Unterschrift</b> versehen.</span></label>" + "<label class=\"nw-btn ev-hoch-aus\" id=\"evUploadKnopf\" for=\"evUpload\" data-act-click=\"h185\"><svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><path d=\"M17 8l-5-5-5 5M12 3v12\"/></svg>Unterschriebene Fassung hochladen</label>" + "<input type=\"file\" id=\"evUpload\" accept=\"application/pdf,image/jpeg,image/png,image/webp\" style=\"display:none\" data-act-change=\"h186\" />" + (st !== "ok" ? "<button class=\"ev-link\" data-act-click=\"h187\">Nicht erforderlich</button>" : "") + (!akteGesperrt() ? "<div class=\"ev-ablage\" id=\"evAblage\" role=\"button\" tabindex=\"0\" data-act-dragover=\"h188\" data-act-dragleave=\"h189\" data-act-drop=\"h190\" data-act-click=\"h191\" data-act-keydown=\"h192\">" + "<svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><path d=\"M17 8l-5-5-5 5M12 3v12\"/></svg>" + "<span>Unterschriebene Fassung hierher ziehen oder auswählen</span></div>" : "") + "</div>") + (doks.length ? "<div class=\"ev-doks\">" + doks.map(function(x, n) {
		const url = urls[n];
		return "<div class=\"ev-dok\">" + "<span class=\"nw-doc-ico pdf\">" + ((x.mime_type || "").indexOf("pdf") >= 0 ? "PDF" : "IMG") + "</span>" + "<span class=\"ev-dok-txt\"><b>" + escapeHtml(bezText(x.bezeichnung) || "Unterschriebene Fassung") + "</b><small>" + escapeHtml(x.datei_name || "") + (x.created_at ? " · " + new Date(x.created_at).toLocaleDateString("de-DE") : "") + "</small></span>" + (url ? "<button type=\"button\" class=\"nw-icobtn\" data-act-click=\"h193\" data-a0=\"" + escapeAttr(n) + "\" title=\"Drehen 90° (nur Anzeige)\" aria-label=\"Drehen 90 Grad\">" + DREH_SVG + "</button>" : "") + (url ? "<a class=\"nw-icobtn\" href=\"" + url + "\" target=\"_blank\" title=\"Ansehen\" data-act-click=\"h194\" data-a0=\"" + escapeAttr(n) + "\"><svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"/><path d=\"M15 3h6v6M10 14 21 3\"/></svg></a>" : "") + "<button class=\"nw-icobtn nw-weg\" data-act-click=\"h195\" data-a0=\"" + escapeAttr(n) + "\" title=\"Entfernen\"><svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"><path d=\"M18 6 6 18M6 6l12 12\"/></svg></button>" + "</div>";
	}).join("") + "</div>" : "") + "<div class=\"ev-fuss\">Vorlage wie vom Nutzer bereitgestellt – das Tool füllt nur Namen, Ort und Datum ein und prüft den Inhalt nicht. Verbindlich ist allein die unterschriebene Fassung.</div>";
	box.ondragover = function(e) {
		if (e && e.preventDefault) e.preventDefault();
	};
	box.ondrop = function(e) {
		if (e && e.preventDefault) e.preventDefault();
	};
}
function endverbleibWerte() {
	const f = document.getElementById("evFahrzeug"), n = document.getElementById("evFin");
	return {
		fahrzeug: (f && f.value || "").trim().slice(0, 80),
		fin: (n && n.value || "").trim().toUpperCase().slice(0, 17)
	};
}
function endverbleibKundenAdresse(d) {
	let adr = "";
	try {
		const f = (d.grunddaten && d.grunddaten.felder || []).find(function(x) {
			return /adresse|anschrift|sitz/i.test(x.key || "");
		});
		if (f && f.value && !/^n\/?a$/i.test(f.value)) adr = String(f.value);
	} catch (e) {}
	return adr;
}
function evWasserzeichenEinfuegen(html) {
	try {
		const d = typeof CURRENT_REPORT !== "undefined" && CURRENT_REPORT || {};
		const kennung = d.pruefId ? "Prüf-ID " + d.pruefId : "Endverbleibserklärung";
		const stil = "<style>" + ".evwm{display:none}" + "@media print{" + ".evwm{display:block;position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}" + ".evwm .wm-row{position:absolute;left:50%;width:135mm;transform:translate(-50%,-50%) rotate(-28deg);filter:blur(0.1px);white-space:normal;overflow-wrap:anywhere;text-align:center;line-height:1.35;font-family:Inter,Arial,sans-serif;font-weight:700;color:rgba(20,83,45,0.16);letter-spacing:0.02em}" + ".evwm .r1{top:13%}.evwm .r2{top:37%}.evwm .r3{top:61%}.evwm .r4{top:85%}" + ".evwm .wm-kopf{display:block;font-size:10pt}.evwm .wm-rest{display:block;font-size:8pt;font-weight:600}" + ".evwm .wm-fuss{position:absolute;left:0;right:0;bottom:0.6mm;text-align:center}" + ".evwm .wm-fuss span{display:inline-block;max-width:96%;padding:0.4mm 2.5mm;border-radius:1.5mm;background:rgba(255,255,255,0.9);font:600 7.5pt/1.3 Inter,Arial,sans-serif;color:#374151;overflow-wrap:anywhere}" + "}</style>";
		const ohneKopf = druckOhneBrowserKopf() ? "<style>@page{margin:0 !important}@media print{html,body{margin:0 !important}body{padding:22mm 20mm !important;box-decoration-break:clone;-webkit-box-decoration-break:clone}.evwm .wm-fuss{bottom:6mm}}</style>" : "";
		const block = stil + ohneKopf + "<div class=\"evwm\" aria-hidden=\"true\">" + wasserzeichenHTML(kennung, d._email || CURRENT_USER_EMAIL || "") + "</div>";
		return html.indexOf("</body>") >= 0 ? html.replace("</body>", block + "</body>") : html + block;
	} catch (e) {
		return html;
	}
}
function evBestaetigtAendern(box) {
	const k = document.getElementById("evUploadKnopf");
	if (k) k.classList.toggle("ev-hoch-aus", !box.checked);
}
function evUploadErlaubt(ev) {
	const box = document.getElementById("evBestaetigt");
	if (box && box.checked) return true;
	if (ev) ev.preventDefault();
	try {
		zeigeToast("Bitte zuerst bestätigen", "Hochgeladen wird die unterschriebene Fassung – bitte bestätige, dass Ort, Datum und Unterschrift vorhanden sind.");
	} catch (e) {}
	if (box) {
		box.closest(".ev-best").classList.remove("wackeln");
		void box.offsetWidth;
		box.closest(".ev-best").classList.add("wackeln");
	}
	return false;
}
function evAblageDragOver(ev) {
	if (!ev) return;
	ev.preventDefault();
	if (akteGesperrt()) return;
	try {
		if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
	} catch (e) {}
	try {
		ev.currentTarget.classList.add("drag");
	} catch (e) {}
}
function evAblageDrop(ev) {
	if (!ev) return;
	ev.preventDefault();
	if (ev.stopPropagation) ev.stopPropagation();
	try {
		ev.currentTarget.classList.remove("drag");
	} catch (e) {}
	if (akteGesperrt() || akteStatus("endverbleib") === "uebersprungen") return;
	const fs = ev.dataTransfer && ev.dataTransfer.files;
	if (!fs || !fs.length) return;
	if (!evUploadErlaubt(ev)) return;
	if (gesperrtMelden()) return;
	endverbleibHochladen(fs);
}
function evAblageKlick(ev) {
	if (akteGesperrt() || akteStatus("endverbleib") === "uebersprungen") return;
	if (!evUploadErlaubt(ev)) return;
	const i = document.getElementById("evUpload");
	if (i) i.click();
}
function endverbleibImRahmenDrucken(html, titel) {
	const alt = document.getElementById("evDruckRahmen");
	if (alt) alt.remove();
	const f = document.createElement("iframe");
	f.id = "evDruckRahmen";
	f.className = "ev-druck";
	f.setAttribute("aria-hidden", "true");
	f.setAttribute("tabindex", "-1");
	f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
	document.body.appendChild(f);
	const doc = f.contentWindow.document;
	html = evWasserzeichenEinfuegen(html);
	doc.open();
	doc.write(html);
	doc.close();
	const alterTitel = document.title;
	try {
		doc.title = titel;
		document.title = titel;
	} catch (e) {}
	const aufraeumen = function() {
		document.title = alterTitel;
		setTimeout(function() {
			if (f.parentNode) f.remove();
		}, 500);
	};
	setTimeout(function() {
		try {
			f.contentWindow.addEventListener("afterprint", aufraeumen);
			f.contentWindow.focus();
			f.contentWindow.print();
		} catch (e) {
			aufraeumen();
			alert("Drucken war nicht möglich. Bitte versuche es erneut oder nutze einen anderen Browser.");
			return;
		}
		setTimeout(aufraeumen, 6e4);
	}, 250);
}
var EV_TEXT = {
	de: {
		lang: "de",
		titel: "Endverbleibserklärung",
		datei: "Endverbleibserklärung",
		kunde: "Der Kunde:",
		bestaetigt: "akzeptiert und bestätigt Folgendes:",
		p1: function(fz, fin, vk) {
			return "1. Das hier vertragsgegenständliche Fahrzeug " + fz + " mit der FIN: " + fin + " wurde von der " + vk + ", gemäß den europäischen, US-amerikanischen und/oder britischen Exportkontroll- und Sanktionsbestimmungen verkauft.";
		},
		p2: "2. Der Kauf ist ausschließlich für die Nutzung im Land des endgültigen Bestimmungs- und Endverwendungsortes bestimmt.",
		p3: "3. Das Fahrzeug kann nicht nach Russland oder an einen anderen in Abschnitt 6 aufgeführten Orte re-exportiert werden.",
		p4: "4. Eine den jeweiligen Vorschriften widersprechende Umleitung ist untersagt.",
		p5: "5. Mit der Annahme der Lieferung des Fahrzeugs verpflichtet sich der Kunde, alle geltenden Export-, Wiederausfuhr-, Transfer- und Umladevorschriften einzuhalten.",
		p6: function(vk) {
			return "6. Jede Wiederausfuhr des Fahrzeugs durch den Kunden kann den Exportkontrollvorschriften der EU, der USA und/oder des Vereinigten Königreichs unterliegen. Es liegt in der Verantwortung des Kunden und nicht in der Verantwortung der " + vk + ", diese Vorschriften vor einer solchen Wiederausfuhr einzuhalten. Unter keinen Umständen darf der Kunde das Fahrzeug oder Teile davon nach Kuba, Iran, Nordkorea, Sudan/Südsudan, Syrien, Russland und bestimmte Regionen der Ukraine: die Krimregion, die s. g. Volksrepublik Luhansk, die s. g. Volksrepublik Donezk und die nicht von der Regierung kontrollierten Gebiete der Oblasten Saporischschja und Cherson, re-exportieren.";
		},
		unterschrift: "Unterschrift Kunde",
		hinweis: "Vorausgefüllt über den Compliance-Checker · Prüf-ID ",
		datum: function() {
			return new Date().toLocaleDateString("de-DE", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric"
			});
		}
	},
	en: {
		lang: "en",
		titel: "End-Use Declaration",
		datei: "End-Use Declaration",
		kunde: "The customer:",
		bestaetigt: "accepts and confirms the following:",
		p1: function(fz, fin, vk) {
			return "1. The vehicle subject to this contract, " + fz + ", with the VIN: " + fin + ", was sold by " + vk + " in accordance with European, US and/or British export control and sanctions regulations.";
		},
		p2: "2. The purchase is intended exclusively for use in the country of final destination and end use.",
		p3: "3. The vehicle may not be re-exported to Russia or to any other location listed in Section 6.",
		p4: "4. Any diversion contrary to the applicable regulations is prohibited.",
		p5: "5. By accepting delivery of the vehicle, the customer undertakes to comply with all applicable export, re-export, transfer and transshipment regulations.",
		p6: function(vk) {
			return "6. Any re-export of the vehicle by the customer may be subject to the export control regulations of the EU, the USA and/or the United Kingdom. It is the responsibility of the customer, and not the responsibility of " + vk + ", to comply with these regulations before any such re-export. Under no circumstances may the customer re-export the vehicle or any parts thereof to Cuba, Iran, North Korea, Sudan/South Sudan, Syria, Russia or certain regions of Ukraine: the Crimea region, the so-called Luhansk People’s Republic, the so-called Donetsk People’s Republic and the areas of the Zaporizhzhia and Kherson oblasts not controlled by the government.";
		},
		unterschrift: "Customer signature",
		hinweis: "Pre-filled via the Compliance Checker · Check ID ",
		datum: function() {
			return new Date().toLocaleDateString("en-GB", {
				day: "numeric",
				month: "long",
				year: "numeric"
			});
		}
	}
};
function evStandardSprache() {
	const d = CURRENT_REPORT || {};
	const sch = d._schritte && d._schritte.endverbleib || {};
	if (sch.sprache === "de" || sch.sprache === "en") return sch.sprache;
	const land = String(d._land || "").toLowerCase();
	return /deutschland|germany|\u00f6sterreich|oesterreich|austria|schweiz|switzerland|liechtenstein/.test(land) || !land ? "de" : "en";
}
function evSprache() {
	return AKTE.evSprache === "de" || AKTE.evSprache === "en" ? AKTE.evSprache : evStandardSprache();
}
function evSpracheWaehlen(sp, btn) {
	AKTE.evSprache = sp;
	if (btn && btn.parentNode) btn.parentNode.querySelectorAll(".ev-sp").forEach(function(b) {
		b.classList.toggle("an", b.getAttribute("data-sp") === sp);
	});
}
async function endverbleibDrucken() {
	const d = CURRENT_REPORT || {};
	const w = endverbleibWerte();
	const sp = evSprache();
	const T = EV_TEXT[sp];
	const kunde = d.firmenname || "";
	const adresse = endverbleibKundenAdresse(d);
	const verkaeufer = CURRENT_FIRMA && CURRENT_FIRMA.firma_name ? CURRENT_FIRMA.firma_name : CURRENT_USER_NAME || "";
	const ort = d._standort || "";
	const datum = T.datum();
	const X = function(v, breite) {
		return v ? escapeHtml(v) : "<span class=\"leer\">" + "&nbsp;".repeat(breite || 18) + "</span>";
	};
	const html = "<!DOCTYPE html><html lang=\"" + T.lang + "\"><head><meta charset=\"utf-8\"><title>" + T.titel + " – " + escapeHtml(kunde) + "</title>" + "<style>" + "@page{size:A4;margin:22mm 20mm}body{font-family:Calibri,\"Segoe UI\",Arial,sans-serif;font-size:11.5pt;line-height:1.5;color:#111;margin:0}" + "h1{font-size:15pt;margin:0 0 18pt}p{margin:0 0 11pt}.k{white-space:pre-line}.leer{display:inline-block;border-bottom:1px solid #111;line-height:1}" + ".sig{margin-top:60pt}.sig .l{border-top:1px solid #111;width:70mm;padding-top:4pt;font-size:10pt}.ort{margin-top:36pt}" + ".hinweis{margin-top:30pt;font-size:8.5pt;color:#666}@media print{.hinweis{display:none}}" + "</style></head><body>" + "<h1>" + T.titel + "</h1>" + "<p>" + T.kunde + "</p>" + "<p class=\"k\"><b>" + X(kunde, 30) + "</b>" + (adresse ? "\n" + escapeHtml(adresse) : "\n" + X("", 30) + "\n" + X("", 30)) + "</p>" + "<p>" + T.bestaetigt + "</p>" + "<p>" + T.p1(X(w.fahrzeug, 22), X(w.fin, 20), X(verkaeufer, 24)) + "</p>" + "<p>" + T.p2 + "</p>" + "<p>" + T.p3 + "</p>" + "<p>" + T.p4 + "</p>" + "<p>" + T.p5 + "</p>" + "<p>" + T.p6(X(verkaeufer, 24)) + "</p>" + "<p class=\"ort\">" + X(ort, 20) + ", " + datum + "</p>" + "<div class=\"sig\"><div class=\"l\">" + T.unterschrift + "</div></div>" + "<div class=\"hinweis\">" + T.hinweis + escapeHtml(d.pruefId || "") + "</div>" + "</body></html>";
	endverbleibImRahmenDrucken(html, T.datei + " - " + (kunde || "Kunde") + " - " + datum);
	const sch = CURRENT_REPORT._schritte && CURRENT_REPORT._schritte.endverbleib || {};
	await akteSchrittSetzen("endverbleib", {
		status: "erstellt",
		erstellt_am: new Date().toISOString(),
		fahrzeug: w.fahrzeug,
		fin: w.fin,
		sprache: sp,
		unterschrieben: sch.unterschrieben || false
	});
	akteZeichnen();
}
async function endverbleibHochladen(files) {
	if (gesperrtMelden()) return;
	if (!files || !files.length) return;
	const w = endverbleibWerte();
	const ok = await kycUpload("endverbleib", files[0]);
	if (ok) {
		await akteSchrittSetzen("endverbleib", {
			status: "unterschrieben",
			fahrzeug: w.fahrzeug,
			fin: w.fin,
			unterschrieben: true,
			hochgeladen_am: new Date().toISOString()
		});
		zeigeToast("Endverbleibserklärung hinterlegt", "Die unterschriebene Fassung liegt in der Akte und hängt beim Drucken an.");
	}
	akteZeichnen();
}
async function endverbleibLoeschen(n) {
	if (gesperrtMelden()) return;
	const x = KYC.doks && KYC.doks.endverbleib ? KYC.doks.endverbleib[n] : null;
	if (!x) return;
	if (!await frageDialog({
		titel: "Unterschriebene Erklärung entfernen?",
		text: "Die hochgeladene Endverbleibserklärung wird aus der Akte gelöscht.",
		ok: "Entfernen",
		gefahr: true
	})) return;
	try {
		try {
			await sb.storage.from("kyc").remove([x.storage_path]);
		} catch (e) {}
		const r = await sb.from("kyc_dokumente").delete().eq("id", x.id);
		if (r && r.error) throw r.error;
		await kycLaden();
	} catch (e) {
		alert("Entfernen fehlgeschlagen: " + (e && e.message || ""));
	}
}
async function endverbleibNichtErforderlich() {
	if (gesperrtMelden()) return;
	if (!await frageDialog({
		titel: "Als nicht erforderlich markieren?",
		text: "Zum Beispiel, wenn kein Fahrzeugverkauf stattfindet.",
		ok: "Markieren"
	})) return;
	await akteSchrittSetzen("endverbleib", {
		status: "nicht_erforderlich",
		am: new Date().toISOString()
	});
	akteZeichnen();
}
async function endverbleibErforderlich() {
	if (gesperrtMelden()) return;
	await akteSchrittSetzen("endverbleib", { status: "offen" });
	akteZeichnen();
}
function abschlussCardHTML() {
	return "<div class=\"sec-card ab-card reveal\" id=\"abschlussCard\"></div>";
}
function abschlussZeichnen() {
	const box = document.getElementById("abschlussCard");
	if (!box) return;
	const d = CURRENT_REPORT || {};
	const zu = !!d._abgeschlossen_am;
	const vor = akteSchritteAktiv().filter(function(x) {
		return x.key !== "abschluss";
	});
	const liste = vor.map(function(sch, i) {
		const st = akteStatus(sch.key);
		const ic = st === "ok" ? "✓" : st === "uebersprungen" ? "–" : st === "laeuft" ? "…" : "○";
		return "<div class=\"ab-zeile st-" + st + "\"><span class=\"ab-ic\">" + ic + "</span><span class=\"ab-name\">" + (i + 1) + ". " + sch.titel + "</span><span class=\"ab-st\">" + akteStatusText(sch.key, st) + "</span></div>";
	}).join("");
	const offen = vor.filter(function(sch) {
		const st = akteStatus(sch.key);
		return st !== "ok" && st !== "uebersprungen";
	});
	box.innerHTML = "<div class=\"ab-head\">" + "<div class=\"ab-ico" + (zu ? " zu" : "") + "\">" + (zu ? "<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\"/></svg>" : "<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 11l3 3L22 4\"/><path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/></svg>") + "</div>" + "<div class=\"ab-titel\"><div class=\"ab-sub\">Schritt " + akteSchritteAktiv().length + " · Abschluss</div><div class=\"ab-t\">" + (zu ? "Akte abgeschlossen" : "Akte abschließen") + "</div></div>" + "</div>" + "<div class=\"ab-liste\">" + liste + "</div>" + (zu ? "<div class=\"ab-fertig\">" + "<div class=\"ab-fertig-t\">Vollständig abgesichert</div>" + "<div class=\"ab-fertig-s\">Bestätigt am " + new Date(d._abgeschlossen_am).toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	}) + " um " + new Date(d._abgeschlossen_am).toLocaleTimeString("de-DE", {
		hour: "2-digit",
		minute: "2-digit"
	}) + " Uhr" + (d._abgeschlossen_von_name ? " durch " + escapeHtml(d._abgeschlossen_von_name) : "") + ". Alle erforderlichen Schritte der Sorgfaltsprüfung wurden durchgeführt und dokumentiert.</div>" + "<button class=\"ev-link\" data-act-click=\"h176\">Wieder öffnen</button>" + "</div>" : "<div class=\"ab-form\">" + (offen.length ? "<div class=\"ab-warn\">Noch offen: " + offen.map(function(x) {
		return x.titel;
	}).join(", ") + ". Du kannst trotzdem abschließen – offene Schritte bleiben im Bericht sichtbar.</div>" : "<div class=\"ab-gut\">Alle Schritte erledigt.</div>") + "<label class=\"ab-check\"><input type=\"checkbox\" id=\"abBox\" data-act-change=\"h196\" /><span class=\"einw-mark\"></span>" + "<span>Ich bestätige, dass die Sorgfaltsprüfung für <b>" + escapeHtml(d.firmenname || "dieses Unternehmen") + "</b> nach bestem Wissen vollständig durchgeführt wurde und die hinterlegten Unterlagen zutreffend sind.</span></label>" + "<button class=\"nw-btn nw-btn-p ab-btn\" id=\"abBtn\" disabled data-act-click=\"h197\">Akte abschließen</button>" + "</div>") + "<div id=\"abVerlauf\" class=\"ab-verlauf\"></div>" + "<div class=\"ev-fuss\">Der Abschluss dokumentiert, dass der Prüfende alle vorgesehenen Schritte durchgeführt hat. Er ersetzt weder die gesetzliche Identifizierung noch die eigene Entscheidung über die Geschäftsbeziehung.</div>";
	setTimeout(abschlussVerlaufLaden, 0);
}
async function abschlussVerlaufLaden() {
	const ziel = document.getElementById("abVerlauf");
	const id = typeof KYC !== "undefined" && KYC && KYC.analyseId || CURRENT_REPORT && CURRENT_REPORT._analyseId;
	if (!ziel || !sb || !id) return;
	try {
		const { data, error } = await sb.from("analysen").select("abschluss_verlauf").eq("id", id).limit(1);
		if (error || !data || !data[0]) return;
		const v = Array.isArray(data[0].abschluss_verlauf) ? data[0].abschluss_verlauf : [];
		if (v.length < 2) {
			ziel.innerHTML = "";
			return;
		}
		ziel.innerHTML = "<div class=\"ab-v-t\">Verlauf dieser Akte</div>" + v.map(function(e) {
			const am = e && e.am ? new Date(e.am).toLocaleString("de-DE", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit"
			}) + " Uhr" : "";
			const zu = e && e.art === "abgeschlossen";
			return "<div class=\"ab-v-z " + (zu ? "zu" : "auf") + "\"><span class=\"ab-v-p\"></span><b>" + (zu ? "Abgeschlossen" : "Wieder geöffnet") + "</b> " + escapeHtml(am) + (e && e.von ? " · " + escapeHtml(e.von) : "") + "</div>";
		}).join("");
	} catch (e) {}
}
function abschlussSiegelStarten() {
	const card = document.getElementById("abschlussCard");
	const panel = document.getElementById("panelAbschluss");
	if (!card || !panel) return null;
	panel.style.position = "relative";
	const ov = document.createElement("div");
	ov.className = "ab-siegel-anim";
	ov.style.top = card.offsetTop + "px";
	ov.style.height = card.offsetHeight + "px";
	ov.innerHTML = "<div class=\"asa-mitte\">" + "<div class=\"asa-ring\"></div><div class=\"asa-ring asa-ring2\"></div>" + "<div class=\"asa-siegel\"><svg viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + "<circle class=\"asa-kreis\" cx=\"32\" cy=\"32\" r=\"27\"/><path class=\"asa-haken\" d=\"M20 33.5l8 8 16-17\"/></svg></div>" + "<div class=\"asa-t\">Akte abgeschlossen</div>" + "<div class=\"asa-s\">Vollständig abgesichert · " + new Date().toLocaleDateString("de-DE") + "</div>" + "</div>";
	panel.appendChild(ov);
	return ov;
}
async function akteAbschliessen() {
	const box = document.getElementById("abBox");
	if (!box || !box.checked) return;
	try {
		if (BEARBEITEN_AN) bearbeitenAbbruch();
	} catch (e) {}
	try {
		if (NW.modus) {
			NW.modus = false;
			nwZeichnen();
		}
	} catch (e) {}
	const id = await analyseIdErmitteln(CURRENT_REPORT);
	if (!id) {
		alert("Die Analyse ist noch nicht gespeichert. Bitte einen Moment warten.");
		return;
	}
	const btn = document.getElementById("abBtn");
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Wird abgeschlossen…";
	}
	const { data, error } = await sb.rpc("akte_abschliessen", {
		p_analyse: id,
		p_wieder_oeffnen: false
	});
	if (error || !data || !data.ok) {
		alert("Abschluss fehlgeschlagen: " + (error && error.message || data && data.grund || ""));
		if (btn) {
			btn.disabled = false;
			btn.textContent = "Akte abschließen";
		}
		return;
	}
	const ruhigModus = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const overlay = ruhigModus ? null : abschlussSiegelStarten();
	const bal = document.getElementById("akteBalken");
	if (bal) bal.style.width = "100%";
	if (overlay) await new Promise(function(r) {
		setTimeout(r, 1650);
	});
	CURRENT_REPORT._abgeschlossen_am = data.am || new Date().toISOString();
	CURRENT_REPORT._abgeschlossen_von = CURRENT_USER_ID;
	CURRENT_REPORT._abgeschlossen_von_name = data.von || CURRENT_USER_NAME || "";
	try {
		const row = HISTORY_ROWS.find(function(x) {
			return x.id === id;
		});
		if (row) {
			row.abgeschlossen_am = CURRENT_REPORT._abgeschlossen_am;
			row.abgeschlossen_von_name = CURRENT_REPORT._abgeschlossen_von_name;
		}
	} catch (e) {}
	AKTE.abschlussAnim = !ruhigModus;
	akteZeichnen();
	if (overlay) {
		overlay.classList.add("weg");
		setTimeout(function() {
			if (overlay.parentNode) overlay.remove();
		}, 460);
	}
	zeigeToast("Akte abgeschlossen", "Vollständigkeit bestätigt – die Akte ist jetzt schreibgeschützt.");
}
function entsiegelnStarten() {
	const card = document.getElementById("abschlussCard");
	const panel = document.getElementById("panelAbschluss");
	if (!card || !panel) return null;
	panel.style.position = "relative";
	const ov = document.createElement("div");
	ov.className = "ab-siegel-anim entsiegeln";
	ov.style.top = card.offsetTop + "px";
	ov.style.height = card.offsetHeight + "px";
	ov.innerHTML = "<div class=\"asa-mitte\">" + "<div class=\"asa-siegel\"><svg viewBox=\"0 0 64 64\" width=\"64\" height=\"64\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + "<circle class=\"asa-kreis\" cx=\"32\" cy=\"32\" r=\"27\"/><path class=\"asa-haken\" d=\"M20 33.5l8 8 16-17\"/></svg></div>" + "<div class=\"ase-schloss\"><svg viewBox=\"0 0 32 32\" width=\"42\" height=\"42\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + "<rect x=\"7\" y=\"14\" width=\"18\" height=\"13\" rx=\"3\"/><path class=\"ase-buegel\" d=\"M11 14v-4a5 5 0 0 1 10 0v4\"/>" + "<circle cx=\"16\" cy=\"20.5\" r=\"1.5\" fill=\"currentColor\" stroke=\"none\"/></svg></div>" + "<div class=\"asa-t\">Akte wieder geöffnet</div>" + "<div class=\"asa-s\">Ergänzungen und Uploads sind wieder möglich</div>" + "</div>";
	panel.appendChild(ov);
	return ov;
}
function sperrhinweisZuklappen() {
	const liste = [];
	document.querySelectorAll(".akte-panel.an .akte-lock").forEach(function(el) {
		if (!el.firstElementChild) return;
		el.style.overflow = "hidden";
		el.style.height = el.offsetHeight + "px";
		void el.offsetWidth;
		el.style.transition = "height .42s cubic-bezier(.4,0,.2,1), opacity .3s ease";
		el.style.height = "0px";
		el.style.opacity = "0";
		liste.push(el);
	});
	return liste;
}
async function akteWiederOeffnen() {
	const ja = await frageDialog({
		titel: "Akte wieder öffnen?",
		text: "Der Abschluss wird zurückgenommen. Danach sind Ergänzungen und Uploads wieder möglich – zum Schluss die Akte erneut abschließen.",
		ok: "Wieder öffnen",
		art: "blau",
		ico: FRAGE_ICO.offen
	});
	if (!ja) return;
	const id = await analyseIdErmitteln(CURRENT_REPORT);
	if (!id) return;
	const { data, error } = await sb.rpc("akte_abschliessen", {
		p_analyse: id,
		p_wieder_oeffnen: true
	});
	if (error || !data || !data.ok) {
		alert("Konnte nicht geöffnet werden: " + (error && error.message || data && data.grund || ""));
		return;
	}
	const ruhigModus = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	let overlay = null, hinweise = [];
	if (!ruhigModus) {
		if (AKTE.ansicht === "abschluss") overlay = entsiegelnStarten();
		const pille = document.querySelector("#akteStepper .akte-siegel");
		if (pille) pille.classList.add("weg");
		hinweise = sperrhinweisZuklappen();
		await new Promise(function(r) {
			setTimeout(r, overlay ? 1400 : 480);
		});
	}
	CURRENT_REPORT._abgeschlossen_am = null;
	CURRENT_REPORT._abgeschlossen_von = null;
	CURRENT_REPORT._abgeschlossen_von_name = null;
	try {
		const row = HISTORY_ROWS.find(function(x) {
			return x.id === id;
		});
		if (row) {
			row.abgeschlossen_am = null;
			row.abgeschlossen_von_name = null;
		}
	} catch (e) {}
	AKTE.oeffnenAnim = !ruhigModus;
	akteZeichnen();
	hinweise.forEach(function(el) {
		el.removeAttribute("style");
	});
	if (!ruhigModus) {
		const rep = document.getElementById("report");
		if (rep) {
			rep.classList.add("entsperrt");
			setTimeout(function() {
				rep.classList.remove("entsperrt");
			}, 900);
		}
	}
	if (overlay) {
		overlay.classList.add("weg");
		setTimeout(function() {
			if (overlay.parentNode) overlay.remove();
		}, 460);
	}
	zeigeToast("Akte wieder geöffnet", "Ergänzungen und Uploads sind wieder möglich. Zum Schluss erneut abschließen.");
}
var NW = {
	modus: false,
	tab: "aufnahmen",
	laeuft: 0,
	gesamt: 0,
	drag: false
};
var NW_MAX_MB = 10;
var NW_TYPEN = {
	aufnahmen: {
		typ: "standort",
		accept: "image/jpeg,image/png,image/webp",
		bilderNur: true,
		titel: "Aufnahmen",
		leer: "Noch keine eigenen Aufnahmen",
		hinweis: "Firmenschild, Gebäude, Geschäftsräume. Aufnahmen werden nicht von der KI ausgewertet – sie dienen als Nachweis und hängen beim Drucken an."
	},
	dokumente: {
		typ: "beleg",
		accept: "application/pdf,image/jpeg,image/png,image/webp",
		bilderNur: false,
		titel: "Dokumente",
		leer: "Noch keine Dokumente hinterlegt",
		hinweis: "Handelsregisterauszug, Gewerbeanmeldung, Gesellschafterliste. Die KI liest sie aus, sobald du „Neu bewerten“ klickst – bis zu drei je Durchgang, neue zuerst."
	}
};
function nachweisCardHTML() {
	return `<div class="sec-card nw-card reveal" id="nwCard" data-act-dragover="h198" data-act-dragleave="h199" data-act-drop="h200">
    <div class="nw-head">
      <div class="nw-ico">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
      </div>
      <div class="nw-titel">
        <div class="nw-sub">Nachweise \u00b7 Eigene Unterlagen</div>
        <div class="nw-t">Bilder &amp; Dokumente zum Unternehmen</div>
      </div>
      <button class="nw-modus" id="nwModusBtn" data-act-click="h201">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
        <span>Bearbeiten</span>
      </button>
    </div>
    <div class="nw-tabs" role="tablist">
      <button class="nw-tab aktiv" data-tab="aufnahmen" data-act-click="h202">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        Aufnahmen <span class="nw-z" id="nwZAuf">0</span>
      </button>
      <button class="nw-tab" data-tab="dokumente" data-act-click="h203">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/></svg>
        Dokumente <span class="nw-z" id="nwZDok">0</span>
      </button>
    </div>
    <div class="nw-inhalt" id="nwInhalt"></div>
    <div class="nw-drop-overlay" id="nwDropOverlay">
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>
      <span>Loslassen zum Hochladen</span>
    </div>
  </div>`;
}
function nwDaten(tab) {
	const k = NW_TYPEN[tab] || NW_TYPEN.aufnahmen;
	const doks = typeof KYC !== "undefined" && KYC.doks && KYC.doks[k.typ] ? KYC.doks[k.typ] : [];
	const urls = typeof KYC !== "undefined" && KYC.urls && KYC.urls[k.typ] ? KYC.urls[k.typ] : [];
	return {
		k,
		doks,
		urls
	};
}
function nwUnlesbar(path) {
	const u = CURRENT_REPORT && CURRENT_REPORT._belegeUnlesbar || {};
	return u[path] === "zu_gross" ? "zu groß" : u[path] === "format" ? "Format" : "";
}
function nwAusgewertet(path) {
	const liste = CURRENT_REPORT && Array.isArray(CURRENT_REPORT._belegeAusgewertet) ? CURRENT_REPORT._belegeAusgewertet : [];
	return liste.indexOf(path) >= 0;
}
function nwGroesse(bytes) {
	if (!bytes && bytes !== 0) return "";
	if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
	return (bytes / (1024 * 1024)).toFixed(1).replace(".", ",") + " MB";
}
function nwZeichnen() {
	const card = document.getElementById("nwCard");
	const box = document.getElementById("nwInhalt");
	if (!card || !box) return;
	if (card.getAttribute("data-gezeichnet")) card.classList.add("ruhig");
	card.setAttribute("data-gezeichnet", "1");
	const auf = nwDaten("aufnahmen"), dok = nwDaten("dokumente");
	const zA = document.getElementById("nwZAuf"), zD = document.getElementById("nwZDok");
	if (zA) zA.textContent = auf.doks.length;
	if (zD) zD.textContent = dok.doks.length;
	card.querySelectorAll(".nw-tab").forEach(function(t) {
		t.classList.toggle("aktiv", t.getAttribute("data-tab") === NW.tab);
	});
	card.classList.toggle("modus", NW.modus);
	const mb = document.getElementById("nwModusBtn");
	if (mb) {
		mb.classList.toggle("an", NW.modus);
		mb.querySelector("span").textContent = NW.modus ? "Fertig" : "Bearbeiten";
	}
	const d = nwDaten(NW.tab);
	let html = "";
	if (NW.modus) {
		if (!KYC.analyseId) {
			html += "<div class=\"nw-warte\"><span class=\"ev-eigen-spin\"></span> Die Analyse wird gerade gespeichert – gleich kannst du Dateien hinzufügen.</div>";
		} else {
			html += "<div class=\"nw-drop\" id=\"nwDrop\">" + "<input type=\"file\" id=\"nwFile\" accept=\"" + d.k.accept + "\" multiple style=\"display:none\" data-act-change=\"h204\" />" + (d.k.bilderNur ? "<input type=\"file\" id=\"nwCam\" accept=\"image/*\" capture=\"environment\" style=\"display:none\" data-act-change=\"h204\" />" : "") + "<div class=\"nw-drop-ico\"><svg viewBox=\"0 0 24 24\" width=\"22\" height=\"22\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><path d=\"M17 8l-5-5-5 5M12 3v12\"/></svg></div>" + "<div class=\"nw-drop-t\">Dateien hierher ziehen</div>" + "<div class=\"nw-drop-s\">" + (d.k.bilderNur ? "JPG, PNG oder WebP" : "PDF, JPG, PNG oder WebP") + " · bis " + NW_MAX_MB + " MB je Datei · auch per Einfügen (Strg+V)</div>" + "<div class=\"nw-drop-btns\">" + "<label class=\"nw-btn nw-btn-p\" for=\"nwFile\"><svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\"><path d=\"M12 5v14M5 12h14\"/></svg>Datei auswählen</label>" + (d.k.bilderNur ? "<label class=\"nw-btn\" for=\"nwCam\"><svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z\"/><circle cx=\"12\" cy=\"13\" r=\"4\"/></svg>Foto aufnehmen</label>" : "") + "</div>" + "</div>";
			if (NW.gesamt) {
				html += "<div class=\"nw-fortschritt\"><span class=\"ev-eigen-spin\"></span> Wird hochgeladen … " + NW.laeuft + " von " + NW.gesamt + "<i style=\"width:" + Math.round((NW.laeuft - 1) / NW.gesamt * 100) + "%\"></i></div>";
			}
		}
	}
	if (!d.doks.length) {
		html += "<div class=\"nw-leer" + (NW.modus ? " im-modus" : "") + "\">" + "<div class=\"nw-leer-ico\">" + (NW.tab === "aufnahmen" ? "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><circle cx=\"8.5\" cy=\"8.5\" r=\"1.5\"/><path d=\"m21 15-5-5L5 21\"/></svg>" : "<svg viewBox=\"0 0 24 24\" width=\"26\" height=\"26\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6\"/><path d=\"M9 13h6M9 17h4\"/></svg>") + "</div>" + "<div class=\"nw-leer-t\">" + d.k.leer + "</div>" + "<div class=\"nw-leer-s\">" + d.k.hinweis + "</div>" + (NW.modus ? "" : "<button class=\"nw-btn nw-btn-p\" data-act-click=\"h205\"><svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\"><path d=\"M12 5v14M5 12h14\"/></svg>Hinzufügen</button>") + "</div>";
	} else if (NW.tab === "aufnahmen") {
		html += "<div class=\"nw-galerie\">" + d.doks.map(function(x, n) {
			const url = d.urls[n];
			return "<div class=\"nw-kachel\" style=\"--nd:" + (.03 + n * .05) + "s\">" + (url ? "<a class=\"nw-bild\" href=\"" + url + "\" target=\"_blank\" title=\"In voller Größe ansehen\" data-act-click=\"h206\" data-a0=\"" + escapeAttr(d.k.typ) + "\" data-a1=\"" + escapeAttr(n) + "\"><img class=\"" + drehKlasse(x.storage_path).trim() + "\" data-dreh=\"" + escapeHtml(x.storage_path || "") + "\" src=\"" + url + "\" alt=\"" + escapeHtml(x.bezeichnung || "Aufnahme") + "\" loading=\"lazy\" /></a>" + "<button type=\"button\" class=\"dok-dreh dok-dreh-kachel\" data-act-click=\"h207\" data-a0=\"" + escapeAttr(d.k.typ) + "\" data-a1=\"" + escapeAttr(n) + "\" title=\"Drehen 90° (nur Anzeige)\" aria-label=\"Drehen 90 Grad\">" + DREH_SVG + "</button>" : "<div class=\"nw-bild nw-bild-leer\"></div>") + "<div class=\"nw-kachel-fuss\">" + "<span class=\"nw-nr\">" + (n + 1) + "</span>" + "<span class=\"nw-kachel-name\" " + (NW.modus ? "contenteditable=\"true\" spellcheck=\"false\" data-act-blur=\"h208\" data-a0=\"" + escapeAttr(n) + "\" data-act-keydown=\"h209\"" : "") + ">" + escapeHtml(x.bezeichnung || "Aufnahme " + (n + 1)) + "</span>" + (NW.modus ? "<button class=\"nw-x\" data-act-click=\"h210\" data-a0=\"" + escapeAttr(n) + "\" title=\"Entfernen\"><svg viewBox=\"0 0 24 24\" width=\"12\" height=\"12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\"><path d=\"M18 6 6 18M6 6l12 12\"/></svg></button>" : "") + "</div></div>";
		}).join("") + "</div>";
	} else {
		html += "<div class=\"nw-liste\">" + d.doks.map(function(x, n) {
			const url = d.urls[n];
			const pdf = (x.mime_type || "").indexOf("pdf") >= 0;
			const seiten = KYC.pdfSeiten && KYC.pdfSeiten[x.storage_path] ? KYC.pdfSeiten[x.storage_path].length : 0;
			const ausgew = nwAusgewertet(x.storage_path);
			const unlesbar = !ausgew && nwUnlesbar(x.storage_path);
			return "<div class=\"nw-zeile\" style=\"--nd:" + (.03 + n * .05) + "s\">" + "<span class=\"nw-doc-ico " + (pdf ? "pdf" : "bild") + "\">" + (pdf ? "PDF" : "IMG") + "</span>" + "<span class=\"nw-doc-txt\">" + "<span class=\"nw-doc-name\" " + (NW.modus ? "contenteditable=\"true\" spellcheck=\"false\" data-act-blur=\"h211\" data-a0=\"" + escapeAttr(n) + "\" data-act-keydown=\"h209\"" : "") + ">" + escapeHtml(x.bezeichnung || x.datei_name || "Nachweis " + (n + 1)) + "</span>" + "<span class=\"nw-doc-sub\">" + escapeHtml(x.datei_name || "") + (seiten ? " · " + seiten + " Seite" + (seiten > 1 ? "n" : "") : "") + (x.groesse ? " · " + nwGroesse(x.groesse) : "") + "</span>" + "</span>" + (ausgew ? "<span class=\"nw-tag ok\" title=\"Wurde bei der letzten Neubewertung ausgelesen\"><svg viewBox=\"0 0 24 24\" width=\"10\" height=\"10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\"/></svg>Ausgewertet</span>" : unlesbar ? "<span class=\"nw-tag nw-unl\" title=\"Die KI konnte dieses Dokument nicht lesen - bitte kleiner bzw. als PDF oder JPG hochladen\">Nicht lesbar · " + unlesbar + "</span>" : "<span class=\"nw-tag neu\" title=\"Noch nicht in eine Neubewertung eingeflossen\">Neu</span>") + (url ? "<button type=\"button\" class=\"nw-icobtn\" data-act-click=\"h207\" data-a0=\"" + escapeAttr(d.k.typ) + "\" data-a1=\"" + escapeAttr(n) + "\" title=\"Drehen 90° (nur Anzeige)\" aria-label=\"Drehen 90 Grad\">" + DREH_SVG + "</button>" : "") + (url ? "<a class=\"nw-icobtn\" href=\"" + url + "\" target=\"_blank\" title=\"Ansehen\" data-act-click=\"h206\" data-a0=\"" + escapeAttr(d.k.typ) + "\" data-a1=\"" + escapeAttr(n) + "\"><svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"/><path d=\"M15 3h6v6M10 14 21 3\"/></svg></a>" : "") + (NW.modus ? "<button class=\"nw-icobtn nw-weg\" data-act-click=\"h212\" data-a0=\"" + escapeAttr(n) + "\" title=\"Entfernen\"><svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"><path d=\"M18 6 6 18M6 6l12 12\"/></svg></button>" : "") + "</div>";
		}).join("") + "</div>";
		const neue = d.doks.filter(function(x) {
			return !nwAusgewertet(x.storage_path) && !nwUnlesbar(x.storage_path);
		}).length;
		if (neue && !NW.gesamt) {
			html += "<div class=\"nw-cta\">" + "<div class=\"nw-cta-txt\"><b>" + neue + " Dokument" + (neue === 1 ? "" : "e") + " noch nicht ausgewertet.</b> " + "Bei der Neubewertung liest die Prüfung die Unterlagen und übernimmt Registernummer, Geschäftsführung und Co. in den Bericht.</div>" + (NEU_LAEUFT ? "<button class=\"nw-btn nw-btn-p laedt\" id=\"nwNeuBtn\" disabled><span class=\"bearb-spin\"></span>Neue Bewertung läuft …</button>" : "<button class=\"nw-btn nw-btn-p\" id=\"nwNeuBtn\" data-act-click=\"h177\">" + bearbIcoSvg() + "Mit Dokumenten neu bewerten</button>") + "</div>";
		}
	}
	const gesamt = auf.doks.length + dok.doks.length;
	html += "<div class=\"nw-fuss\">" + "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"6 9 6 2 18 2 18 9\"/><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\"/></svg>" + (gesamt ? "<span>" + gesamt + " Datei" + (gesamt === 1 ? "" : "en") + " häng" + (gesamt === 1 ? "t" : "en") + " beim Drucken als nummerierte Anlagen an.</span>" : "<span>Hinterlegte Dateien hängen beim Drucken automatisch als Anlagen an.</span>") + "<span class=\"nw-fuss-r\">Verschlüsselt · Speicherung in der EU</span>" + "</div>";
	box.innerHTML = html;
}
function nwModus(an) {
	if ((an === true || an === undefined && !NW.modus) && gesperrtMelden()) return;
	NW.modus = typeof an === "boolean" ? an : !NW.modus;
	nwZeichnen();
	if (NW.modus) {
		const card = document.getElementById("nwCard");
		if (card) {
			const r = card.getBoundingClientRect();
			if (r.top < 0 || r.top > window.innerHeight - 200) card.scrollIntoView({
				behavior: "smooth",
				block: "start"
			});
		}
	}
}
function nwTab(t) {
	NW.tab = t;
	const card = document.getElementById("nwCard");
	if (card) {
		card.classList.remove("ruhig");
		card.removeAttribute("data-gezeichnet");
	}
	nwZeichnen();
}
function nwNameTaste(ev) {
	if (ev.key === "Enter") {
		ev.preventDefault();
		ev.target.blur();
	}
	if (ev.key === "Escape") {
		ev.target.textContent = ev.target.getAttribute("data-alt") || ev.target.textContent;
		ev.target.blur();
	}
}
async function nwUmbenennen(typ, n, el) {
	if (gesperrtMelden()) {
		nwZeichnen();
		return;
	}
	const d = KYC.doks && KYC.doks[typ] ? KYC.doks[typ][n] : null;
	if (!d || !el) return;
	const neu = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
	if (!neu || neu === (d.bezeichnung || "")) {
		nwZeichnen();
		return;
	}
	try {
		const r = await sb.from("kyc_dokumente").update({ bezeichnung: neu }).eq("id", d.id);
		if (r && r.error) throw r.error;
		d.bezeichnung = neu;
	} catch (e) {
		alert("Umbenennen fehlgeschlagen: " + (e && e.message || ""));
	}
	nwZeichnen();
}
function nwPruefen(file, k) {
	const mime = (file.type || "").toLowerCase();
	const ok = k.bilderNur ? /^image\/(jpeg|png|webp)$/.test(mime) : /^image\/(jpeg|png|webp)$/.test(mime) || mime === "application/pdf";
	if (!ok) return heicHinweis(file) || (file.name || "Datei") + ": Dateityp nicht unterstützt.";
	if (file.size > NW_MAX_MB * 1024 * 1024) return (file.name || "Datei") + ": größer als " + NW_MAX_MB + " MB.";
	return "";
}
var BILD_MAX_BYTES = 4 * 1024 * 1024;
var BILD_MAX_PX = 3e3;
function istHeic(file) {
	return /heic|heif/i.test(String(file && file.type || "")) || /\.(heic|heif)$/i.test(String(file && file.name || ""));
}
function heicHinweis(file) {
	return istHeic(file) ? (file.name || "Foto") + ": iPhone-Foto (HEIC) konnte in diesem Browser nicht umgewandelt werden – bitte in Safari hochladen oder als JPG exportieren." : "";
}
async function dateiVorbereiten(file) {
	if (!file) return file;
	const typ = String(file.type || "").toLowerCase();
	const heic = istHeic(file);
	if (!heic && !/^image\/(jpeg|png|webp)$/.test(typ)) return file;
	const exifDreh = !heic && typ === "image/jpeg" ? await exifDrehungDatei(file) : 0;
	if (!heic && !exifDreh && file.size <= BILD_MAX_BYTES) return file;
	try {
		const url = URL.createObjectURL(file);
		const img = await new Promise(function(ok, fehl) {
			const i = new Image();
			i.onload = function() {
				ok(i);
			};
			i.onerror = fehl;
			i.src = url;
		});
		const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
		if (!w0 || !h0) {
			URL.revokeObjectURL(url);
			return file;
		}
		const f = Math.min(1, BILD_MAX_PX / Math.max(w0, h0));
		const c = document.createElement("canvas");
		c.width = Math.round(w0 * f);
		c.height = Math.round(h0 * f);
		const ctx = c.getContext("2d");
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, c.width, c.height);
		ctx.drawImage(img, 0, 0, c.width, c.height);
		URL.revokeObjectURL(url);
		let q = .88;
		let blob = await new Promise(function(r) {
			c.toBlob(r, "image/jpeg", q);
		});
		while (blob && blob.size > BILD_MAX_BYTES && q > .5) {
			q -= .12;
			blob = await new Promise(function(r) {
				c.toBlob(r, "image/jpeg", q);
			});
		}
		if (!blob) return file;
		const name = String(file.name || "foto").replace(/\.[^.]+$/, "") + ".jpg";
		return new File([blob], name, {
			type: "image/jpeg",
			lastModified: Date.now()
		});
	} catch (e) {
		return file;
	}
}
async function nwWaehlen(files) {
	if (gesperrtMelden()) return;
	if (!files || !files.length || NW.gesamt) return;
	const k = NW_TYPEN[NW.tab];
	const liste = await Promise.all(Array.prototype.slice.call(files).map(dateiVorbereiten));
	const fehler = [];
	const gut = liste.filter(function(f) {
		const m = nwPruefen(f, k);
		if (m) fehler.push(m);
		return !m;
	});
	if (fehler.length) alert(fehler.join("\n"));
	if (!gut.length) return;
	NW.gesamt = gut.length;
	NW.laeuft = 1;
	nwZeichnen();
	let ok = 0;
	try {
		for (let i = 0; i < gut.length; i++) {
			NW.laeuft = i + 1;
			nwZeichnen();
			if (await kycUpload(k.typ, gut[i])) ok++;
		}
	} catch (e) {
		console.warn("Nachweis:", e && e.message);
	}
	NW.gesamt = 0;
	NW.laeuft = 0;
	nwZeichnen();
	if (ok) zeigeToast(ok === 1 ? "Datei hinzugefügt" : ok + " Dateien hinzugefügt", NW.tab === "dokumente" ? "Bei der nächsten Neubewertung wird sie ausgelesen." : "Hängt beim Drucken als Anlage an.");
}
async function nwLoeschen(typ, n) {
	if (gesperrtMelden()) return;
	const d = KYC.doks && KYC.doks[typ] ? KYC.doks[typ][n] : null;
	if (!d) return;
	if (!await frageDialog({
		titel: "„" + (d.bezeichnung || d.datei_name || "Datei") + "“ entfernen?",
		ok: "Entfernen",
		gefahr: true
	})) return;
	try {
		try {
			await sb.storage.from("kyc").remove([d.storage_path]);
		} catch (e) {}
		const r = await sb.from("kyc_dokumente").delete().eq("id", d.id);
		if (r && r.error) throw r.error;
		await kycLaden();
	} catch (e) {
		alert("Entfernen fehlgeschlagen: " + (e && e.message || ""));
	}
}
function nwNeuBewerten() {
	if (gesperrtMelden()) return;
	NW.modus = false;
	nwZeichnen();
	try {
		neuBewerten();
	} catch (e) {
		console.warn(e);
	}
}
function nwDragOver(ev) {
	if (!NW.modus || !KYC.analyseId) return;
	ev.preventDefault();
	const card = document.getElementById("nwCard");
	if (card && !card.classList.contains("drag")) card.classList.add("drag");
}
function nwDragLeave(ev) {
	const card = document.getElementById("nwCard");
	if (!card) return;
	if (ev.relatedTarget && card.contains(ev.relatedTarget)) return;
	card.classList.remove("drag");
}
function nwDrop(ev) {
	const card = document.getElementById("nwCard");
	if (card) card.classList.remove("drag");
	if (!NW.modus || !KYC.analyseId) return;
	ev.preventDefault();
	const files = ev.dataTransfer && ev.dataTransfer.files;
	if (files && files.length) nwWaehlen(files);
}
document.addEventListener("paste", function(ev) {
	if (!NW.modus || !KYC.analyseId) return;
	const t = ev.target;
	if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
	const items = ev.clipboardData && ev.clipboardData.items;
	if (!items) return;
	const files = [];
	for (let i = 0; i < items.length; i++) {
		if (items[i].kind === "file") {
			const f = items[i].getAsFile();
			if (f) files.push(f);
		}
	}
	if (files.length) {
		ev.preventDefault();
		nwWaehlen(files);
	}
});
async function kycPdfVorbereiten() {
	const meinKyc = KYC;
	meinKyc.pdfSeiten = meinKyc.pdfSeiten || {};
	meinKyc.pdfFehler = meinKyc.pdfFehler || {};
	if (meinKyc.pdfLaeuft) return;
	meinKyc.pdfLaeuft = true;
	const typen = [
		"ausweis",
		"selfie",
		"standort",
		"beleg",
		"endverbleib"
	];
	try {
		for (const typ of typen) {
			const doks = meinKyc.doks[typ] || [];
			for (let n = 0; n < doks.length; n++) {
				const d = doks[n];
				if ((d.mime_type || "").indexOf("pdf") < 0) continue;
				const schluessel = d.storage_path;
				if (!schluessel || meinKyc.pdfSeiten[schluessel] || meinKyc.pdfFehler[schluessel]) continue;
				const url = (meinKyc.urls[typ] || [])[n];
				if (!url) continue;
				try {
					const seiten = await pdfSeitenAlsBilder(url, 15);
					if (KYC !== meinKyc) return;
					meinKyc.pdfSeiten[schluessel] = seiten;
					try {
						nwZeichnen();
					} catch (e) {}
					try {
						kycDruckAktualisieren();
					} catch (e) {}
				} catch (e) {
					meinKyc.pdfFehler[schluessel] = true;
					console.warn("PDF-Seiten:", e && e.message);
				}
			}
		}
	} finally {
		meinKyc.pdfLaeuft = false;
	}
	if (KYC !== meinKyc) return;
	if (pdfAnlagenOffen("gesamt")) {
		setTimeout(function() {
			try {
				kycPdfVorbereiten();
			} catch (e) {}
		}, 0);
		return;
	}
	if (meinKyc.druckWartet) {
		meinKyc.druckWartet = false;
		try {
			zeigeToast("Bereit zum Drucken", "Die PDF-Anlagen sind aufbereitet – du kannst jetzt drucken.");
		} catch (e) {}
	}
}
var BILD_CACHE = {};
var BILD_START = 3;
var BILD_MAX = 6;
var BILD_STAND = null;
var BILD_ICON = "<svg width=\"40\" height=\"40\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"m21 15-5-5L5 21\"/></svg>";
function bildGrundText(f) {
	const g = f && f.grund || "unbekannt";
	if (/abrechnung|schluessel|api_aus|zugriff/.test(g)) return "Der Bilddienst von Google lehnt den Zugang gerade ab. Bitte kurz an support@automatilabs.de melden.";
	if (g === "kontingent") return "Google begrenzt gerade die Zahl der Bildabrufe. Bitte die Akte später erneut öffnen.";
	if (g === "verweis_ungueltig") return "Die gespeicherten Bildverweise sind abgelaufen und konnten nicht erneuert werden.";
	return "Google ist gerade nicht erreichbar. Bitte die Akte später erneut öffnen.";
}
async function fotoLaden(foto) {
	if (BILD_CACHE[foto.name]) return { url: BILD_CACHE[foto.name] };
	try {
		const res = await workerFetch("place_photo", {
			photoName: foto.name,
			maxWidth: 800
		});
		const typ = res.headers && res.headers.get("content-type") || "";
		if (res.ok && typ.indexOf("image") === 0) {
			const url = URL.createObjectURL(await res.blob());
			BILD_CACHE[foto.name] = url;
			return { url };
		}
		let j = null;
		try {
			j = await res.json();
		} catch (e) {}
		return { fehler: {
			status: j && j.status || res.status,
			grund: j && j.grund || "unbekannt"
		} };
	} catch (e) {
		return { fehler: { grund: "netz" } };
	}
}
function kiAdresse(d) {
	const felder = d && d.grunddaten && Array.isArray(d.grunddaten.felder) ? d.grunddaten.felder : [];
	const f = felder.find(function(x) {
		return x && /^(adresse|anschrift|gesch(ae|\u00e4)ftsadresse)/i.test(String(x.key || "").trim());
	});
	const v = f ? String(f.value || "").trim() : "";
	return /\b\d{4,5}\b/.test(v) && v.length <= 240 ? v : "";
}
function placeIdMerken(akte, placeId) {
	if (!akte || !placeId) return;
	akte._googlePlaceId = placeId;
	const pid = akte.pruefId || akte.pruef_id;
	if (!sb || !pid) return;
	try {
		sb.from("analysen").update({ google_place_id: placeId }).eq("pruef_id", pid).then(function() {}, function() {});
	} catch (e) {}
}
function urheberHTML(bilder, quelle) {
	const gesehen = {}, teile = [];
	(bilder || []).forEach(function(b) {
		(b.autoren || []).forEach(function(a) {
			if (!a || !a.name || gesehen[a.name]) return;
			gesehen[a.name] = true;
			let uri = String(a.uri || "");
			if (uri.indexOf("//") === 0) uri = "https:" + uri;
			const u = sichereUrl(uri);
			teile.push(u ? "<a href=\"" + u + "\" target=\"_blank\" rel=\"noopener\">" + escapeHtml(a.name) + "</a>" : escapeHtml(a.name));
		});
	});
	return "Bildquelle: " + (quelle || "Google Maps") + (teile.length ? " · Fotos: " + teile.join(", ") : "");
}
function galerieZeichnen(stand) {
	const g = stand.gallery;
	if (!g || !g.isConnected) return;
	g.innerHTML = stand.geladen.map(function(b, i) {
		return "<a class=\"evidence-thumb\" href=\"" + b.url + "\" target=\"_blank\" title=\"Bild " + (i + 1) + " in voller Größe öffnen\">" + "<img src=\"" + b.url + "\" alt=\"Unternehmensbild " + (i + 1) + "\" /></a>";
	}).join("") + (stand.rest.length ? "<button type=\"button\" class=\"evidence-mehr\" data-act-click=\"h213\">+ " + stand.rest.length + " weitere Bilder laden</button>" : "");
	const countEl = document.getElementById("evidenceCount");
	if (countEl) countEl.textContent = stand.geladen.length === 1 ? "1 Bild" : stand.geladen.length + " Bilder";
	const q = document.getElementById("evidenceQuelle");
	if (q) q.innerHTML = urheberHTML(stand.geladen, stand.quelle || "Google Maps");
}
var EIGENE_BILD_MUSTER = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/;
function eigeneBilderLesen(ev) {
	const liste = ev && Array.isArray(ev.eigeneBilder) ? ev.eigeneBilder : [];
	return liste.filter(function(b) {
		return b && typeof b.src === "string" && b.src.length < 15e5 && EIGENE_BILD_MUSTER.test(b.src);
	}).slice(0, 8);
}
function eigenesBildUrl(src) {
	try {
		const teile = src.split(",");
		const typ = teile[0].slice(5, teile[0].indexOf(";"));
		const roh = atob(teile[1]);
		const bytes = new Uint8Array(roh.length);
		for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
		return URL.createObjectURL(new Blob([bytes], { type: typ }));
	} catch (e) {
		return src;
	}
}
async function bilderPaarweise(liste, stand) {
	for (let i = 0; i < liste.length; i += 2) {
		const paar = liste.slice(i, i + 2);
		const erg = await Promise.all(paar.map(fotoLaden));
		erg.forEach(function(x, j) {
			if (x.url) stand.geladen.push({
				url: x.url,
				autoren: paar[j].autoren || []
			});
			else if (x.fehler) stand.fehler = x.fehler;
		});
		if (!stand.gallery.isConnected) return;
	}
}
async function weitereBilderLaden() {
	const stand = BILD_STAND;
	if (!stand || !stand.rest.length || !stand.gallery.isConnected) return;
	const knopf = stand.gallery.querySelector(".evidence-mehr");
	if (knopf) {
		knopf.disabled = true;
		knopf.textContent = "Bilder werden geladen…";
	}
	const liste = stand.rest;
	stand.rest = [];
	await bilderPaarweise(liste, stand);
	galerieZeichnen(stand);
}
async function loadEvidenceImage(ev) {
	const gallery = document.getElementById("evidenceGallery");
	const countEl = document.getElementById("evidenceCount");
	const quelleEl = document.getElementById("evidenceQuelle");
	if (!gallery) return;
	ev = ev || {};
	const akte = CURRENT_REPORT;
	const stand = {
		gallery,
		geladen: [],
		rest: [],
		fehler: null
	};
	BILD_STAND = stand;
	const zeigeText = function(titel, detail) {
		if (!gallery.isConnected) return;
		gallery.innerHTML = "<div class=\"evidence-img-none\">" + BILD_ICON + "<div>" + titel + "</div>" + (detail ? "<div class=\"evidence-img-detail\">" + escapeHtml(detail) + "</div>" : "") + "</div>";
		if (countEl) countEl.textContent = "";
		if (quelleEl) quelleEl.innerHTML = "";
	};
	const eigene = eigeneBilderLesen(ev);
	if (eigene.length) {
		stand.geladen = eigene.map(function(b) {
			return {
				url: eigenesBildUrl(b.src),
				autoren: b.autor ? [{
					name: String(b.autor).slice(0, 80),
					uri: String(b.autorUrl || "")
				}] : []
			};
		});
		stand.quelle = String(eigene[0].quelle || "Eigene Aufnahmen").slice(0, 60);
		galerieZeichnen(stand);
		return;
	}
	let fotos = [];
	const placeId = ev.placeId || akte && akte._googlePlaceId || "";
	const suchAdresse = ev.address || (placeId ? "" : kiAdresse(akte));
	const suchName = ev.address ? ev.placeName || "" : akte && akte.firmenname || ev.placeName || "";
	if (placeId || suchName && suchAdresse) {
		try {
			const r = await workerCall("place_fotos", {
				placeId,
				name: suchName,
				adresse: suchAdresse,
				anzahl: BILD_MAX
			});
			if (r && r.ok) {
				fotos = Array.isArray(r.fotos) ? r.fotos : [];
				if (r.placeId && r.placeId !== placeId) placeIdMerken(akte, r.placeId);
			} else if (r && r.googleFehler) stand.fehler = r.googleFehler;
		} catch (e) {}
	}
	if (!gallery.isConnected) return;
	if (!fotos.length && !stand.fehler && Array.isArray(ev.photoNames) && ev.photoNames.length) {
		fotos = ev.photoNames.slice(0, BILD_MAX).map(function(n) {
			return {
				name: n,
				autoren: []
			};
		});
	}
	stand.rest = fotos.slice(BILD_START);
	await bilderPaarweise(fotos.slice(0, BILD_START), stand);
	if (!gallery.isConnected) return;
	if (stand.geladen.length) {
		galerieZeichnen(stand);
		return;
	}
	stand.rest = [];
	const gesperrt = !!(stand.fehler && /abrechnung|schluessel|api_aus|zugriff/.test(stand.fehler.grund || ""));
	if (ev.address && !gesperrt) {
		try {
			const res = await workerFetch("street_view", { address: ev.address });
			const typ = res.headers && res.headers.get("content-type") || "";
			if (res.ok && typ.indexOf("image") === 0) {
				const url = URL.createObjectURL(await res.blob());
				if (!gallery.isConnected) return;
				gallery.innerHTML = "<a class=\"evidence-thumb evidence-thumb-wide\" href=\"" + url + "\" target=\"_blank\" title=\"Street View in voller Größe öffnen\"><img src=\"" + url + "\" alt=\"Street View\" /></a>";
				if (countEl) countEl.textContent = "Street View";
				if (quelleEl) quelleEl.innerHTML = "Bildquelle: Google Street View";
				return;
			}
		} catch (e) {}
	}
	if (stand.fehler && stand.fehler.grund !== "verweis_ungueltig") zeigeText("Bilder derzeit nicht abrufbar", bildGrundText(stand.fehler));
	else if (akte && akte._googleFehler && !ev.address) zeigeText("Keine Bilder vorhanden", "Bei der Erstellung dieser Akte war der Google-Dienst nicht erreichbar.");
	else zeigeText("Keine Bilder zum Unternehmen gefunden");
}
async function wartungGoogleDiagnose() {
	const r = await workerCall("google_diagnose", {});
	if (!r || r.error) {
		console.error("Diagnose nicht möglich:", r && r.error, "(nur mit @automatilabs.de-Konto)");
		return r;
	}
	console.table((r.pruefungen || []).map(function(p) {
		return {
			Test: p.test,
			OK: p.ok ? "ja" : "NEIN",
			Status: p.status || "",
			Grund: p.grund || "",
			Erklaerung: p.erklaerung || "",
			Google: p.meldung || ""
		};
	}));
	console.log(r.fazit);
	return r;
}
async function wartungBilderNachladen(opt) {
	opt = opt || {};
	const summe = {
		verarbeitet: 0,
		gefunden: 0,
		nicht_gefunden: 0,
		ohne_google: 0
	};
	for (let runde = 1; runde <= (opt.maxRunden || 50); runde++) {
		const r = await workerCall("bilder_nachladen", {
			limit: opt.limit || 20,
			probe: !!opt.probe
		});
		if (!r || r.error) {
			console.error("Abbruch:", r && r.error);
			summe.fehler = r && r.error || "keine Antwort";
			break;
		}
		Object.keys(summe).forEach(function(k) {
			if (typeof summe[k] === "number") summe[k] += r[k] || 0;
		});
		if (typeof r.offen === "number") summe.offen = r.offen;
		if (opt.fortschritt) {
			try {
				opt.fortschritt(summe);
			} catch (e) {}
		}
		console.log("Runde " + runde + ": " + r.verarbeitet + " geprüft · " + r.gefunden + " gefunden · " + r.nicht_gefunden + " nicht gefunden · " + r.ohne_google + " ohne Google" + (typeof r.offen === "number" ? " · noch offen: " + r.offen : ""), r.beispiele || "");
		if (r.abbruch) {
			console.error(r.abbruch, r.googleFehler || "");
			summe.fehler = r.abbruch;
			break;
		}
		if (opt.probe || !r.verarbeitet || r.offen === 0) break;
	}
	console.log("Fertig:", summe);
	return summe;
}
var GOOGLE_LOESUNG = {
	abrechnung: {
		t: "Google-Abrechnung ist nicht aktiv",
		d: "Google lehnt alle Anfragen ab, weil das Abrechnungskonto des Google-Cloud-Projekts nicht aktiv ist – typisch nach Ende des kostenlosen Testzeitraums oder bei abgelaufener Karte. Lösung: In der Google Cloud unter „Abrechnung“ das Konto aktivieren bzw. „Vollständiges Konto aktivieren“.",
		link: "https://console.cloud.google.com/billing",
		knopf: "Abrechnung öffnen"
	},
	api_aus: {
		t: "Places API (New) ist nicht aktiviert",
		d: "Die Schnittstelle für Firmen und Fotos ist im Google-Projekt ausgeschaltet. Lösung: „Places API (New)“ aktivieren.",
		link: "https://console.cloud.google.com/apis/library/places.googleapis.com",
		knopf: "API aktivieren"
	},
	schluessel_gesperrt: {
		t: "Google-Schlüssel ist eingeschränkt",
		d: "Der Schlüssel darf diese Schnittstelle oder diesen Aufrufer nicht nutzen. Der Worker ruft ohne Website auf – eine Einschränkung auf „Websites“ blockiert ihn. Lösung: Beim Schlüssel die Anwendungs-Einschränkung auf „Keine“ stellen und bei den API-Einschränkungen „Places API (New)“ und „Street View Static API“ erlauben.",
		link: "https://console.cloud.google.com/apis/credentials",
		knopf: "Schlüssel öffnen"
	},
	schluessel_ungueltig: {
		t: "Google-Schlüssel ist ungültig",
		d: "Der hinterlegte Schlüssel wurde gelöscht oder ist falsch. Lösung: Neuen Schlüssel anlegen und in Cloudflare als Secret GOOGLE_API_KEY hinterlegen.",
		link: "https://console.cloud.google.com/apis/credentials",
		knopf: "Schlüssel öffnen"
	},
	kontingent: {
		t: "Google-Kontingent ist ausgeschöpft",
		d: "Ein Tages- oder Minutenlimit ist erreicht. Lösung: Kontingente der Places API (New) prüfen bzw. erhöhen.",
		link: "https://console.cloud.google.com/iam-admin/quotas",
		knopf: "Kontingente öffnen"
	},
	kein_schluessel: {
		t: "Im Worker fehlt der Google-Schlüssel",
		d: "In Cloudflare ist kein Secret GOOGLE_API_KEY hinterlegt. Lösung: Workers → compliance-worker → Settings → Variables and Secrets → GOOGLE_API_KEY anlegen.",
		link: "https://dash.cloudflare.com/",
		knopf: "Cloudflare öffnen"
	},
	zugriff_verweigert: {
		t: "Google verweigert den Zugriff",
		d: "Google antwortet mit „Zugriff verweigert“. Bitte Abrechnung, API-Aktivierung und Schlüssel-Einschränkungen prüfen – in dieser Reihenfolge.",
		link: "https://console.cloud.google.com/billing",
		knopf: "Google Cloud öffnen"
	},
	worker_alt: {
		t: "Worker ist veraltet",
		d: "Der Worker in Cloudflare kennt die Diagnose noch nicht und kann deshalb auch keine Bilder frisch laden. Lösung: die aktuelle worker_secure.js in Cloudflare einfügen und speichern.",
		link: "https://dash.cloudflare.com/",
		knopf: "Cloudflare öffnen"
	},
	karte_gesperrt: {
		t: "Maps Static API nicht freigeschaltet",
		d: "Der Kartenausschnitt im Bericht braucht die „Maps Static API“. Lösung: 1. Die API in der Google Cloud aktivieren. 2. Beim Google-Schlüssel unter „API-Einschränkungen“ zusätzlich „Maps Static API“ anhaken und speichern.",
		link: "https://console.cloud.google.com/apis/library/static-maps-backend.googleapis.com",
		knopf: "API aktivieren"
	},
	unbekannt: {
		t: "Google-Zugang gestört",
		d: "Google antwortet mit einem unerwarteten Fehler. Die Meldung von Google steht unten.",
		link: "https://console.cloud.google.com/apis/dashboard",
		knopf: "Google Cloud öffnen"
	}
};
var GOOGLE_OK_MERKER = "cc_google_ok_bis2";
function googleAdmin() {
	return /@automatilabs\.de$/i.test(CURRENT_USER_EMAIL || "");
}
async function googleWaechter(erzwingen) {
	if (!googleAdmin()) return;
	if (!erzwingen) {
		try {
			if (Number(localStorage.getItem(GOOGLE_OK_MERKER) || 0) > Date.now()) return;
		} catch (e) {}
	}
	let r = null;
	try {
		r = await workerCall("google_diagnose", {});
	} catch (e) {
		r = null;
	}
	if (!r) {
		if (erzwingen) googleLeisteZeigen({
			grund: "unbekannt",
			meldung: "Der Worker hat nicht geantwortet."
		});
		return;
	}
	if (r.error) {
		if (/unknown action|unbekannte aktion/i.test(String(r.error))) googleLeisteZeigen({ grund: "worker_alt" });
		else if (erzwingen) googleLeisteZeigen({
			grund: "unbekannt",
			meldung: String(r.error)
		});
		return;
	}
	if (r.ok) {
		try {
			localStorage.setItem(GOOGLE_OK_MERKER, String(Date.now() + 6 * 3600 * 1e3));
		} catch (e) {}
		console.info("Google-Zugang: in Ordnung");
		if (erzwingen || document.getElementById("googleLeiste")) googleLeisteZeigen({ gut: true });
		return;
	}
	try {
		localStorage.removeItem(GOOGLE_OK_MERKER);
	} catch (e) {}
	const f = (r.pruefungen || []).filter(function(p) {
		return !p.ok;
	})[0] || {};
	let grund = f.grund || "unbekannt";
	if (/Karte/.test(f.test || "") && /api_aus|schluessel_gesperrt|zugriff_verweigert|unbekannt/.test(grund)) grund = "karte_gesperrt";
	googleLeisteZeigen({
		grund,
		meldung: f.meldung || "",
		test: f.test || ""
	});
}
function googleLeisteZeigen(z) {
	let el = document.getElementById("googleLeiste");
	const neu = !el;
	if (neu) {
		el = document.createElement("div");
		el.id = "googleLeiste";
		el.className = "g-leiste";
		el.setAttribute("role", "status");
		const kopf = document.querySelector(".app header.header");
		if (kopf) kopf.insertAdjacentElement("afterend", el);
		else document.body.insertBefore(el, document.body.firstChild);
	}
	const ico = z.gut ? "<svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m8 12.5 2.6 2.6L16 9.5\"/></svg>" : "<svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg>";
	if (z.gut) {
		el.classList.add("gut");
		el.innerHTML = "<span class=\"g-ico\">" + ico + "</span><div class=\"g-inhalt\">" + "<div class=\"g-t\">Google-Zugang funktioniert</div>" + "<div class=\"g-d\">Neue Akten bekommen wieder Firmenbilder. Ältere Akten holst du mit einem Klick zurück.</div>" + "<div class=\"g-knoepfe\"><button type=\"button\" class=\"g-btn g-haupt\" data-act-click=\"h214\">Ältere Bilder nachladen</button></div>" + "<div class=\"g-stand\" id=\"googleStand\"></div>" + "<div class=\"g-nur\">Nur für Automati Labs sichtbar</div></div>" + "<button type=\"button\" class=\"g-zu\" data-act-click=\"h215\" title=\"Schließen\">×</button>";
	} else {
		const l = GOOGLE_LOESUNG[z.grund] || GOOGLE_LOESUNG.unbekannt;
		el.classList.remove("gut");
		el.innerHTML = "<span class=\"g-ico\">" + ico + "</span><div class=\"g-inhalt\">" + "<div class=\"g-t\">" + (z.grund === "karte_gesperrt" ? "Kartenausschnitt gesperrt: " : "Firmenbilder gesperrt: ") + escapeHtml(l.t) + "</div>" + "<div class=\"g-d\">" + escapeHtml(l.d) + "</div>" + (z.meldung ? "<div class=\"g-meldung\">Google meldet" + (z.test ? " (" + escapeHtml(z.test) + ")" : "") + ": " + escapeHtml(String(z.meldung).slice(0, 240)) + "</div>" : "") + "<div class=\"g-knoepfe\">" + "<a class=\"g-btn g-haupt\" href=\"" + sichereUrl(l.link) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + escapeHtml(l.knopf) + " ↗</a>" + "<button type=\"button\" class=\"g-btn\" data-act-click=\"h216\">Erneut prüfen</button>" + "</div>" + "<div class=\"g-nur\">Nur für Automati Labs sichtbar</div></div>" + "<button type=\"button\" class=\"g-zu\" data-act-click=\"h215\" title=\"Schließen\">×</button>";
	}
	if (neu) einblenden(el);
}
function googleLeisteSchliessen() {
	const el = document.getElementById("googleLeiste");
	if (!el) return;
	el.classList.remove("an");
	setTimeout(function() {
		if (el.parentNode) el.remove();
	}, 320);
}
async function googleErneutPruefen(btn) {
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Wird geprüft…";
	}
	await googleWaechter(true);
}
async function googleBilderNachladen(btn) {
	const stand = document.getElementById("googleStand");
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Läuft…";
	}
	if (stand) stand.textContent = "Suche ältere Akten ohne Bilder…";
	const summe = await wartungBilderNachladen({ fortschritt: function(x) {
		if (stand) stand.textContent = x.verarbeitet + " Akten geprüft · " + x.gefunden + " mit Bildern" + (typeof x.offen === "number" ? " · noch " + x.offen + " offen" : "");
	} });
	if (stand) {
		stand.textContent = summe.fehler ? "Abgebrochen: " + summe.fehler : "Fertig: " + summe.verarbeitet + " Akten geprüft, " + summe.gefunden + " haben wieder Bilder" + (summe.ohne_google ? ", " + summe.ohne_google + " ohne Adresse (nicht rettbar)" : "") + ".";
	}
	if (btn) {
		btn.disabled = false;
		btn.textContent = summe.fehler ? "Erneut versuchen" : "Nochmal prüfen";
	}
}
function generatePruefId() {
	return "AL-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}
function apiPdfZeileSetzen() {
	if (!API_RENDER) return;
	const rep = document.getElementById("report");
	if (!rep) return;
	const d = typeof CURRENT_REPORT !== "undefined" && CURRENT_REPORT || {};
	const id = d.pruefId || DRUCK_ID || "";
	const t0 = d._createdAt ? new Date(d._createdAt) : null;
	const zeit = druckZeitFormat(t0 && !isNaN(t0.getTime()) ? t0 : new Date());
	let z = document.getElementById("apiPdfZeile");
	if (!z) {
		z = document.createElement("div");
		z.id = "apiPdfZeile";
		z.className = "api-pdf-zeile";
		z.setAttribute("data-tr", "aus");
	}
	z.textContent = DT().apiTitel + " · " + DT().pruefId + " " + id + " · " + DT().apiErstellt + " " + zeit;
	const kopf = rep.querySelector(".report-top");
	if (kopf && kopf.parentNode) {
		if (kopf.nextSibling !== z) kopf.parentNode.insertBefore(z, kopf.nextSibling);
	} else if (rep.firstChild !== z) rep.insertBefore(z, rep.firstChild);
}
function wasserzeichenHTML(kennung, email) {
	const zeit = druckZeitText();
	const kopf = "Automati Labs · " + escapeHtml(kennung);
	const rest = DT().gedruckt + " " + escapeHtml(zeit) + (email ? " · " + escapeHtml(email) : "");
	let zeilen = "";
	for (let i = 1; i <= 4; i++) {
		zeilen += "<div class=\"wm-row r" + i + "\"><span class=\"wm-kopf\">" + kopf + "</span><span class=\"wm-rest\">" + rest + "</span></div>";
	}
	return zeilen + "<div class=\"wm-fuss\"><span>" + kopf + " · " + rest + "</span></div>";
}
function buildWatermark(d) {
	const el = document.getElementById("printWatermark");
	if (!el) return;
	const pruefId = d && d.pruefId ? d.pruefId : generatePruefId();
	const email = d && d._email ? d._email : CURRENT_USER_EMAIL || "";
	el.innerHTML = wasserzeichenHTML(DT().pruefId + " " + pruefId, email);
}
function druckWasserzeichenAktualisieren() {
	try {
		const ordnerDruck = document.getElementById("akteView");
		if (ordnerDruck && ordnerDruck.getClientRects().length) return;
		if (typeof CURRENT_REPORT !== "undefined" && CURRENT_REPORT && akteWirdAngezeigt()) buildWatermark(CURRENT_REPORT);
	} catch (e) {}
}
async function initKyc(pruefId, versuch) {
	const mount = document.getElementById("kycMount");
	if (!mount || !sb || !CURRENT_FIRMA || !pruefId) return;
	if (versuch && (!CURRENT_REPORT || CURRENT_REPORT.pruefId !== pruefId)) return;
	setKYC({
		analyseId: null,
		doks: {},
		urls: {},
		pruefId,
		firmenname: "",
		link: null,
		pdfSeiten: {}
	});
	const meinKyc = KYC;
	try {
		const { data } = await sb.from("analysen").select("id, firmenname").eq("pruef_id", pruefId).limit(1);
		if (KYC !== meinKyc) return;
		if (!data || !data.length) {
			if ((versuch || 0) < 3) setTimeout(function() {
				initKyc(pruefId, (versuch || 0) + 1);
			}, 1500);
			return;
		}
		meinKyc.analyseId = data[0].id;
		meinKyc.firmenname = data[0].firmenname || "";
		await kycLaden();
	} catch (e) {
		console.warn("KYC init:", e && e.message);
	}
}
async function kycLaden() {
	const meinKyc = KYC;
	const id = meinKyc && meinKyc.analyseId;
	if (!id) return;
	const nochAktuell = function() {
		return KYC === meinKyc && meinKyc.analyseId === id;
	};
	try {
		const { data } = await sb.from("kyc_dokumente").select("*").eq("analyse_id", id);
		if (!nochAktuell()) return;
		const doks = {}, urls = {};
		(data || []).forEach(function(d) {
			if (!doks[d.typ]) doks[d.typ] = [];
			doks[d.typ].push(d);
		});
		Object.keys(doks).forEach(function(t) {
			doks[t].sort(function(a, b) {
				const pa = a.position || 1, pb = b.position || 1;
				if (pa !== pb) return pa - pb;
				return new Date(a.created_at) - new Date(b.created_at);
			});
		});
		const typen = [
			"ausweis",
			"selfie",
			"standort",
			"beleg",
			"endverbleib"
		];
		const pfade = [];
		typen.forEach(function(t) {
			(doks[t] || []).forEach(function(d) {
				if (d.storage_path) pfade.push(d.storage_path);
			});
		});
		const linkVon = {};
		if (pfade.length) {
			try {
				const r = await sb.storage.from("kyc").createSignedUrls(pfade, 300);
				(r && r.data || []).forEach(function(x, i) {
					const p = x && x.path || pfade[i];
					if (x && x.signedUrl && p) linkVon[p] = x.signedUrl;
				});
			} catch (e) {}
			for (const p of pfade) {
				if (linkVon[p] || !nochAktuell()) continue;
				try {
					const r1 = await sb.storage.from("kyc").createSignedUrl(p, 300);
					if (r1 && r1.data && r1.data.signedUrl) linkVon[p] = r1.data.signedUrl;
				} catch (e) {}
			}
		}
		if (!nochAktuell()) return;
		typen.forEach(function(t) {
			urls[t] = (doks[t] || []).map(function(d) {
				return linkVon[d.storage_path] || null;
			});
		});
		let link = null;
		try {
			const l = await sb.from("kyc_upload_links").select("*").eq("analyse_id", id).eq("aktiv", true).gt("ablauf", new Date().toISOString()).order("created_at", { ascending: false }).limit(1);
			link = l && l.data && l.data[0] || null;
		} catch (e) {
			link = null;
		}
		if (!nochAktuell()) return;
		meinKyc.doks = doks;
		meinKyc.urls = urls;
		meinKyc.link = link;
		kycRender();
		try {
			nwZeichnen();
		} catch (e) {}
		try {
			akteZeichnen();
		} catch (e) {}
		try {
			kycPdfVorbereiten();
		} catch (e) {}
	} catch (e) {
		console.warn("KYC laden:", e && e.message);
	}
}
function kycRender() {
	const mount = document.getElementById("kycMount");
	if (!mount) return;
	function box(typ, titel, hinweis) {
		const h = box0(typ, titel, hinweis);
		const u = KYC.hochladen;
		if (!u || u.typ !== typ) return h;
		return h.replace(/<\/div>\s*$/, "<div class=\"kyc-laedt\"><span class=\"ev-eigen-spin\"></span> Wird hochgeladen … " + Math.min(u.fertig + 1, u.gesamt) + " von " + u.gesamt + "</div></div>");
	}
	function box0(typ, titel, hinweis) {
		const liste = KYC.doks[typ] || [];
		if (liste.length) {
			const teile = liste.map(function(d, n) {
				const istPdf = (d.mime_type || "").indexOf("pdf") >= 0;
				const url = (KYC.urls[typ] || [])[n];
				const bez = escapeHtml(bezText(d.bezeichnung) || (typ === "ausweis" ? n === 0 ? "Vorderseite" : n === 1 ? "Rückseite" : "Seite " + (n + 1) : ""));
				KYC.gesehen = KYC.gesehen || {};
				const kAlt = !!(d.storage_path && KYC.gesehen[d.storage_path]);
				if (d.storage_path) KYC.gesehen[d.storage_path] = true;
				return "<div class=\"kyc-datei" + (kAlt ? " kyc-alt" : "") + "\" style=\"--kd:" + (kAlt ? 0 : .04 + n * .07) + "s\">" + (!istPdf && url ? "<img class=\"kyc-mini" + drehKlasse(d.storage_path) + "\" data-dreh=\"" + escapeHtml(d.storage_path || "") + "\" src=\"" + url + "\" alt=\"\" data-act-click=\"h217\" data-a0=\"" + escapeAttr(typ) + "\" data-a1=\"" + escapeAttr(n) + "\" />" : "<div class=\"kyc-mini kyc-mini-pdf\" data-act-click=\"h217\" data-a0=\"" + escapeAttr(typ) + "\" data-a1=\"" + escapeAttr(n) + "\">PDF</div>") + "<div class=\"kyc-datei-info\">" + (bez ? "<div class=\"kyc-datei-b\">" + bez + "</div>" : "") + "<div class=\"kyc-datei-n\">" + escapeHtml(d.datei_name || "Dokument") + "</div>" + "</div>" + "<button type=\"button\" class=\"dok-dreh\" data-act-click=\"h207\" data-a0=\"" + escapeAttr(typ) + "\" data-a1=\"" + escapeAttr(n) + "\" title=\"Drehen 90° (nur Anzeige)\" aria-label=\"Drehen 90 Grad\">" + DREH_SVG + "</button>" + "<button class=\"kyc-datei-x\" data-act-click=\"h218\" data-a0=\"" + escapeAttr(typ) + "\" data-a1=\"" + escapeAttr(n) + "\" title=\"Entfernen\">" + "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M18 6 6 18M6 6l12 12\"/></svg></button>" + "</div>";
			}).join("");
			return "<div class=\"kyc-box kyc-voll kyc-mehrfach\">" + "<div class=\"kyc-box-t\">" + titel + " <span class=\"kyc-ok\">✓</span>" + "<span class=\"kyc-anzahl\">" + liste.length + (liste.length === 1 ? " Datei" : " Dateien") + "</span></div>" + "<div class=\"kyc-dateien\">" + teile + "</div>" + "<label class=\"kyc-mehr\" for=\"kycAdd_" + typ + "\">" + "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M12 5v14M5 12h14\"/></svg>" + " Weitere Datei hinzufügen</label>" + "<input type=\"file\" id=\"kycAdd_" + typ + "\" accept=\"image/*,application/pdf\" multiple style=\"display:none\"" + " data-act-change=\"h219\" data-a0=\"" + escapeAttr(typ) + "\" />" + "</div>";
		}
		return "<div class=\"kyc-box kyc-leer\" data-act-click=\"h220\" data-a0=\"" + escapeAttr(typ) + "\"" + " data-act-dragover=\"h140\" data-act-dragleave=\"h141\"" + " data-act-drop=\"h221\" data-a0=\"" + escapeAttr(typ) + "\">" + "<div class=\"kyc-plus\">+</div>" + "<div class=\"kyc-box-t\">" + titel + "</div>" + "<div class=\"kyc-box-file\" style=\"white-space:normal;\">" + hinweis + "</div>" + "<input type=\"file\" id=\"kycFile_" + typ + "\" accept=\"image/*,application/pdf\" multiple style=\"display:none\"" + " data-act-change=\"h222\" data-a0=\"" + escapeAttr(typ) + "\" />" + "</div>";
	}
	mount.innerHTML = "<div class=\"kyc-card\">" + "<div class=\"kyc-head\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#16A34A\" stroke-width=\"2\"><path d=\"M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z\"/></svg> KYC-Ablage · Dokumente zur Akte" + "<button class=\"kyc-btn kyc-refresh\" data-act-click=\"h223\" title=\"Prüfen, ob neue Dokumente angekommen sind\"><span class=\"kyc-refresh-ico\">⟳</span> Aktualisieren</button></div>" + "<div class=\"kyc-grid\">" + box("ausweis", "Personalausweis", "Bild oder PDF hierher ziehen oder klicken") + box("selfie", "Bestätigungsfoto (Selfie)", "Foto der Person mit Bezug zum Ausweis") + "</div>" + (KYC.doks.ausweis || KYC.doks.selfie ? "" : "") + kycLinkHtml() + "<div class=\"kyc-note\">Beim Drucken der Akte werden hochgeladene Bilder automatisch als Anlagen angehängt. Zugriff nur für dein Unternehmen.</div>" + "<div class=\"haft-box\"><div class=\"haft-t\">Haftungsausschluss</div>" + "<div class=\"haft-d\">Wir übernehmen keinerlei Haftung für die Authentizität, die Richtigkeit und/oder Vollständigkeit der hochgeladenen und/oder erstellten Aufnahmen. " + "Es obliegt einzig und allein in Ihrer Verantwortung zu ermitteln, ob die verifizierte Person identisch mit den übermittelten Ausweisdokumenten ist. " + "Jedwede Art von Verantwortlichkeit wird unsererseits ausdrücklich ausgeschlossen.</div></div>" + "</div>" + "<div id=\"kycDruck\">" + kycPrintHtml() + "</div>";
	mount.style.display = "block";
}
function kycDruckAktualisieren() {
	const k = document.getElementById("kycDruck");
	if (k) k.innerHTML = kycPrintHtml();
}
function pdfAnlagenOffen(bereich) {
	if (typeof KYC === "undefined" || !KYC.doks) return 0;
	const typen = bereich === "dokumente" ? [
		"ausweis",
		"selfie",
		"standort",
		"beleg"
	] : bereich === "endverbleib" ? ["endverbleib"] : bereich === "gesamt" || !bereich ? [
		"ausweis",
		"selfie",
		"standort",
		"beleg",
		"endverbleib"
	] : [];
	let offen = 0;
	typen.forEach(function(typ) {
		(KYC.doks[typ] || []).forEach(function(d, n) {
			if ((d.mime_type || "").indexOf("pdf") < 0 || !d.storage_path) return;
			if ((KYC.pdfSeiten || {})[d.storage_path] || (KYC.pdfFehler || {})[d.storage_path]) return;
			if (!(KYC.urls[typ] || [])[n]) return;
			offen++;
		});
	});
	return offen;
}
function kycPrintHtml() {
	let out = "";
	let nr = 0;
	const kopf = " · " + escapeHtml(KYC.firmenname) + " · " + escapeHtml(KYC.pruefId || "");
	function seite(titel, bildUrl, fuss) {
		return "<div class=\"kyc-print-page\">" + "<div class=\"kyc-print-t\">" + titel + kopf + "</div>" + "<div class=\"kyc-print-rahmen\"><img class=\"kyc-print-img\" src=\"" + bildUrl + "\" alt=\"\" /></div>" + "<div class=\"kyc-print-fuss\">" + fuss + "</div>" + "</div>";
	}
	[
		["ausweis", "Personalausweis"],
		["selfie", "Bestätigungsfoto"],
		["standort", "Eigene Aufnahme"],
		["beleg", "Nachweis"],
		["endverbleib", "Endverbleibserklärung"]
	].forEach(function(p) {
		const typ = p[0], basis = p[1];
		const vorher = out.length;
		(KYC.doks[typ] || []).forEach(function(d, n) {
			const url = (KYC.urls[typ] || [])[n];
			const bez = d.bezeichnung ? " (" + escapeHtml(bezText(d.bezeichnung)) + ")" : KYC.doks[typ].length > 1 ? " (" + (n + 1) + " von " + KYC.doks[typ].length + ")" : "";
			const dateiname = escapeHtml(d.datei_name || "");
			const istPdf = (d.mime_type || "").indexOf("pdf") >= 0;
			if (istPdf) {
				const seiten = (KYC.pdfSeiten || {})[d.storage_path] || [];
				if (seiten.length) {
					const anlage = ++nr;
					seiten.forEach(function(bild, si) {
						const titel = "Anlage " + anlage + " · " + basis + bez + (seiten.length > 1 ? " · Seite " + (si + 1) + " von " + seiten.length : "");
						out += seite(titel, bild, dateiname);
					});
				} else if (url) {
					const titel = "Anlage " + ++nr + " · " + basis + bez;
					out += "<div class=\"kyc-print-page\"><div class=\"kyc-print-t\">" + titel + kopf + "</div>" + "<div class=\"kyc-print-fehlt\">Dieses Dokument liegt als PDF-Datei in der digitalen Akte vor" + (dateiname ? "<br/>(" + dateiname + ")" : "") + "</div></div>";
				}
				return;
			}
			if (url) out += seite("Anlage " + ++nr + " · " + basis + bez, url, dateiname);
		});
		out = out.slice(0, vorher) + out.slice(vorher).split("<div class=\"kyc-print-page\">").join("<div class=\"kyc-print-page\" data-typ=\"" + typ + "\">");
	});
	return out;
}
function kycLinkHtml() {
	if (KYC.link) {
		const url = location.origin + location.pathname + "?upload=" + KYC.link.token;
		const rest = Math.max(0, Math.ceil((new Date(KYC.link.ablauf).getTime() - Date.now()) / 36e5));
		return "<div class=\"kyc-link\">" + "<div class=\"kyc-link-t\">🔗 Upload-Link · gültig noch " + rest + " Std.</div>" + (KYC.link.ref_code ? "<div class=\"ref-box\"><div class=\"ref-label\">Bestätigungscode</div><div class=\"ref-code\">" + escapeHtml(KYC.link.ref_code) + "</div>" + "<div class=\"ref-hint\">Nenne der Person diesen Code am Telefon. Sie sieht ihn auf der Upload-Seite – so weiß sie sicher, dass der Link wirklich von dir stammt.</div></div>" : "") + "<div class=\"kyc-link-row\">" + "<input class=\"kyc-link-input\" id=\"kycLinkInput\" readonly value=\"" + url + "\" data-act-click=\"h131\" />" + "<button class=\"kyc-btn\" data-act-click=\"h224\">Kopieren</button>" + "<button class=\"kyc-btn kyc-btn-mail\" data-act-click=\"h225\">" + mailIconSvg() + "Nachricht senden</button>" + "<button class=\"kyc-btn kyc-btn-del\" data-act-click=\"h226\">Neu</button>" + "</div>" + "<div class=\"kyc-note\" style=\"margin-top:8px;\">Schick diesen Link der Person – sie kann Ausweis und Foto ohne Anmeldung hochladen. Die Dateien landen automatisch hier in der Akte.</div>" + "</div>";
	}
	return "<div class=\"kyc-link\">" + "<button class=\"kyc-btn kyc-link-gen\" data-act-click=\"h226\">🔗 Upload-Link generieren</button>" + "<div class=\"kyc-note\" style=\"margin-top:8px;\">Erzeugt einen sicheren Link (72 Std. gültig), über den die Person ihre Dokumente selbst hochladen kann.</div>" + "</div>";
}
function kycToken() {
	const zeichen = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const a = new Uint8Array(28);
	crypto.getRandomValues(a);
	let t = "";
	for (let i = 0; i < a.length; i++) t += zeichen[a[i] % 62];
	return t;
}
function kycRefCode() {
	const z = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	const a = new Uint8Array(6);
	crypto.getRandomValues(a);
	let c = "";
	for (let i = 0; i < 6; i++) c += z[a[i] % z.length];
	return c.slice(0, 3) + "-" + c.slice(3);
}
async function kycLinkNeu() {
	if (gesperrtMelden()) return;
	if (!KYC.analyseId || !CURRENT_FIRMA || !sb) return;
	try {
		if (KYC.link) {
			await sb.from("kyc_upload_links").update({ aktiv: false }).eq("id", KYC.link.id);
		}
		const { error } = await sb.from("kyc_upload_links").insert({
			token: kycToken(),
			analyse_id: KYC.analyseId,
			firma_id: CURRENT_FIRMA.firma_id,
			erstellt_von: typeof CURRENT_USER_ID !== "undefined" ? CURRENT_USER_ID : null,
			ref_code: kycRefCode(),
			ablauf: new Date(Date.now() + 72 * 3600 * 1e3).toISOString()
		});
		if (error) throw error;
		await kycLaden();
	} catch (e) {
		alert("Link konnte nicht erstellt werden: " + (e && e.message || "Fehler"));
	}
}
function kycLinkKopieren() {
	const i = document.getElementById("kycLinkInput");
	if (!i) return;
	i.select();
	i.setSelectionRange(0, 99999);
	try {
		navigator.clipboard.writeText(i.value);
	} catch (e) {
		try {
			document.execCommand("copy");
		} catch (e2) {}
	}
	const btn = event && event.target;
	if (btn) {
		const alt = btn.textContent;
		btn.textContent = "Kopiert ✓";
		setTimeout(function() {
			btn.textContent = alt;
		}, 1400);
	}
}
document.addEventListener("visibilitychange", function() {
	if (document.visibilityState === "visible" && typeof KYC !== "undefined" && KYC && KYC.analyseId) {
		try {
			kycLaden();
		} catch (e) {}
	}
});
async function kycNeuePruefen() {
	if (!sb || !CURRENT_FIRMA) return;
	let seit = null;
	try {
		seit = localStorage.getItem("cc_kyc_gesehen");
	} catch (e) {}
	const jetzt = new Date().toISOString();
	try {
		let q = sb.from("kyc_dokumente").select("id, typ, analyse_id, created_at").eq("firma_id", CURRENT_FIRMA.firma_id).is("hochgeladen_von", null);
		if (seit) q = q.gt("created_at", seit);
		const { data } = await q.order("created_at", { ascending: false }).limit(20);
		try {
			localStorage.setItem("cc_kyc_gesehen", jetzt);
		} catch (e) {}
		if (!seit) return;
		if (data && data.length) {
			const ids = [];
			data.forEach(function(d) {
				if (ids.indexOf(d.analyse_id) < 0) ids.push(d.analyse_id);
			});
			const ziel = ids.length === 1 ? { analyse_id: ids[0] } : {};
			zeigeToast(data.length === 1 ? "Neues Dokument eingegangen" : data.length + " neue Dokumente eingegangen", ids.length === 1 ? "Per Upload-Link übermittelt – tippe hier, um die Akte zu öffnen." : "Per Upload-Link übermittelt – tippe hier, um zur Historie zu gehen.", ziel);
		}
	} catch (e) {
		console.warn("KYC-Hinweis:", e && e.message);
	}
}
function einblenden(el, danach) {
	if (!el) return;
	void el.offsetWidth;
	requestAnimationFrame(function() {
		el.classList.add("an");
		if (danach) {
			try {
				danach();
			} catch (e) {}
		}
	});
}
var FRAGE_ICO = {
	frage: "<svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6\"/><path d=\"M12 17h.01\"/></svg>",
	gefahr: "<svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6\"/></svg>",
	offen: "<svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"11\" width=\"16\" height=\"10\" rx=\"2\"/><path d=\"M8 11V7a4 4 0 0 1 7.8-1.3\"/></svg>"
};
function frageDialog(opt) {
	opt = opt || {};
	return new Promise(function(res) {
		const alt = document.getElementById("frageGate");
		if (alt) alt.remove();
		const box = document.createElement("div");
		box.id = "frageGate";
		box.className = "up-warn-back";
		box.setAttribute("role", "dialog");
		box.setAttribute("aria-modal", "true");
		box.innerHTML = "<div class=\"up-warn-card frage-card" + (opt.gefahr ? " frage-gefahr" : "") + (opt.art ? " frage-" + opt.art : "") + "\">" + "<div class=\"frage-ico\">" + (opt.ico || (opt.gefahr ? FRAGE_ICO.gefahr : FRAGE_ICO.frage)) + "</div>" + "<div class=\"up-warn-t\">" + escapeHtml(opt.titel || "Bist du sicher?") + "</div>" + (opt.text ? "<div class=\"up-warn-d\">" + escapeHtml(opt.text).replace(/\n/g, "<br>") + "</div>" : "") + "<div class=\"up-warn-btns\">" + "<button type=\"button\" class=\"kyc-btn frage-nein\">" + escapeHtml(opt.abbrechen || "Abbrechen") + "</button>" + "<button type=\"button\" class=\"up-senden up-warn-ok frage-ja" + (opt.gefahr ? " frage-rot" : "") + "\">" + escapeHtml(opt.ok || "OK") + "</button>" + "</div></div>";
		let fertig = false;
		function schliessen(antwort) {
			if (fertig) return;
			fertig = true;
			document.removeEventListener("keydown", taste, true);
			box.classList.remove("an");
			const k = box.querySelector(".up-warn-card");
			if (k) k.classList.add("karte-weg");
			setTimeout(function() {
				if (box.parentNode) box.remove();
			}, 260);
			res(antwort);
		}
		function taste(e) {
			if (e.key === "Escape") {
				e.preventDefault();
				schliessen(false);
			}
		}
		box.querySelector(".frage-nein").onclick = function() {
			schliessen(false);
		};
		box.querySelector(".frage-ja").onclick = function() {
			schliessen(true);
		};
		box.addEventListener("mousedown", function(e) {
			if (e.target === box) schliessen(false);
		});
		document.addEventListener("keydown", taste, true);
		document.body.appendChild(box);
		einblenden(box, function() {
			const f = box.querySelector(opt.gefahr ? ".frage-nein" : ".frage-ja");
			if (f) f.focus();
		});
	});
}
function zeigeToast(titel, text, ziel) {
	const t = document.createElement("div");
	t.className = "tr-toast" + (ziel ? " tr-toast-klick" : "");
	t.innerHTML = "<button class=\"tr-toast-x\" title=\"Schließen\">✕</button>" + "<div class=\"tr-toast-t\">📥 " + escapeHtml(titel) + "</div>" + "<div class=\"tr-toast-d\">" + escapeHtml(text) + "</div>" + (ziel ? "<div class=\"tr-toast-cta\">Akte öffnen →</div>" : "");
	function toastWeg() {
		if (t.dataset.weg) return;
		t.dataset.weg = "1";
		t.classList.remove("an");
		t.classList.add("weg");
		setTimeout(function() {
			if (t.parentNode) t.remove();
		}, 340);
	}
	const x = t.querySelector(".tr-toast-x");
	if (x) x.onclick = function(ev) {
		ev.stopPropagation();
		toastWeg();
	};
	t.onclick = function() {
		if (ziel) {
			toastWeg();
			toastZielOeffnen(ziel);
		} else toastWeg();
	};
	let stapel = document.getElementById("toastStapel");
	if (!stapel) {
		stapel = document.createElement("div");
		stapel.id = "toastStapel";
		document.body.appendChild(stapel);
	}
	stapel.appendChild(t);
	einblenden(t);
	setTimeout(toastWeg, 1e4);
}
function toastZielOeffnen(ziel) {
	try {
		if (ziel.analyse_id) {
			const idx = HISTORY_ROWS.findIndex(function(r) {
				return r.id === ziel.analyse_id;
			});
			if (idx >= 0) {
				openFromHistory(idx);
				return;
			}
			if (HISTORY_ROWS.length) {
				akteNachladenUndOeffnen(ziel.analyse_id);
				return;
			}
			setKYC_ZIEL_NACH_LADEN(ziel.analyse_id);
			openHistory();
			return;
		}
		openHistory();
	} catch (e) {
		try {
			openHistory();
		} catch (e2) {}
	}
}
function kycBoxWahl(typ, ev) {
	if (ev && ev.target && ev.target.tagName === "INPUT") return;
	kycPick(typ);
}
function kycPick(typ) {
	if (gesperrtMelden()) return;
	const i = document.getElementById("kycFile_" + typ);
	if (i) i.click();
}
function kycGewaehlt(typ, input) {
	if (input.files && input.files[0]) kycUpload(typ, input.files[0]);
}
function kycDrop(ev, typ) {
	ev.preventDefault();
	if (gesperrtMelden()) return;
	ev.currentTarget.classList.remove("drag");
	const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
	if (f) kycUpload(typ, f);
}
async function kycUpload(typ, file, zielId) {
	if (gesperrtMelden()) return false;
	if (!KYC.analyseId || !CURRENT_FIRMA) return;
	const zielKyc = KYC;
	const zielOk = function() {
		return !zielId || KYC === zielKyc && KYC.analyseId === zielId;
	};
	if (!zielOk()) return false;
	file = await dateiVorbereiten(file);
	if (!zielOk()) return false;
	const erlaubt = [
		"image/jpeg",
		"image/png",
		"image/webp",
		"application/pdf"
	];
	if (erlaubt.indexOf(file.type) < 0) {
		alert(heicHinweis(file) || "Bitte ein Bild (JPG/PNG/WebP) oder PDF hochladen.");
		return;
	}
	if (file.size > 10 * 1024 * 1024) {
		alert("Datei zu groß (max. 10 MB).");
		return;
	}
	try {
		const bisher = (KYC.doks[typ] || []).length;
		const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
		const pfad = CURRENT_FIRMA.firma_id + "/" + KYC.analyseId + "/" + typ + "_" + Date.now() + "_" + (bisher + 1) + "." + ext;
		const up = await sb.storage.from("kyc").upload(pfad, file, { contentType: file.type });
		if (up && up.error) throw up.error;
		if (!zielOk()) {
			try {
				await sb.storage.from("kyc").remove([pfad]);
			} catch (e) {}
			return false;
		}
		const db = await sb.from("kyc_dokumente").insert({
			analyse_id: KYC.analyseId,
			firma_id: CURRENT_FIRMA.firma_id,
			typ,
			storage_path: pfad,
			datei_name: file.name,
			mime_type: file.type,
			position: bisher + 1,
			bezeichnung: typ === "ausweis" ? bisher === 0 ? "Vorderseite" : bisher === 1 ? "Rückseite" : "Seite " + (bisher + 1) : typ === "standort" ? "Aufnahme " + (bisher + 1) : typ === "beleg" ? String(file.name || "").replace(/\.[a-z0-9]{2,5}$/i, "").slice(0, 80) || "Nachweis " + (bisher + 1) : typ === "endverbleib" ? "Unterschriebene Fassung" : null,
			hochgeladen_von: typeof CURRENT_USER_ID !== "undefined" ? CURRENT_USER_ID : null
		});
		if (db && db.error) throw db.error;
		await kycLaden();
		return true;
	} catch (e) {
		console.warn("KYC Upload:", e && e.message);
		let t = e && e.message || "Unbekannter Fehler";
		if (/typ_check|check constraint/i.test(t)) {
			t = "Die Datenbank kennt diese Dokumentart noch nicht. Bitte einmal das SQL " + "„sql_eigene_aufnahmen“ in Supabase ausführen.";
		}
		alert("Upload fehlgeschlagen: " + t);
		return false;
	}
}
function kycAnsehen(typ) {
	kycAnsehenEin(typ, 0);
}
var DREH_KEY = "cc_dok_drehung";
var DREH_SVG = "<svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12a9 9 0 1 1-3-6.7\"/><path d=\"M21 3v6h-6\"/></svg>";
function drehungVon(pfad) {
	if (!pfad) return 0;
	try {
		const m = JSON.parse(localStorage.getItem(DREH_KEY) || "{}");
		return [
			90,
			180,
			270
		].indexOf(m[pfad]) >= 0 ? m[pfad] : 0;
	} catch (e) {
		return 0;
	}
}
function drehungSetzen(pfad, grad) {
	try {
		const m = JSON.parse(localStorage.getItem(DREH_KEY) || "{}");
		if (grad) m[pfad] = grad;
		else delete m[pfad];
		localStorage.setItem(DREH_KEY, JSON.stringify(m));
	} catch (e) {}
}
function drehKlasse(pfad) {
	const g = drehungVon(pfad);
	return g ? " dreh-" + g : "";
}
function dokDrehen(pfad) {
	if (!pfad) return;
	const g = (drehungVon(pfad) + 90) % 360;
	drehungSetzen(pfad, g);
	document.querySelectorAll("[data-dreh]").forEach(function(el) {
		if (el.getAttribute("data-dreh") !== pfad) return;
		el.classList.remove("dreh-90", "dreh-180", "dreh-270");
		if (g) el.classList.add("dreh-" + g);
	});
	if (DOK_VIEWER && DOK_VIEWER.pfad === pfad) dokViewerLayout();
}
function dokDrehenTyp(typ, n, ev) {
	if (ev) {
		ev.preventDefault();
		ev.stopPropagation();
	}
	const d = (typeof KYC !== "undefined" && KYC.doks && KYC.doks[typ] || [])[n];
	if (d && d.storage_path) dokDrehen(d.storage_path);
	return false;
}
function dokAnsehenTyp(typ, n, ev) {
	if (ev) {
		ev.preventDefault();
		ev.stopPropagation();
	}
	const d = (KYC.doks[typ] || [])[n], url = (KYC.urls[typ] || [])[n];
	if (d && url) dokAnsehen(url, d.mime_type || "", d.storage_path || "", bezText(d.bezeichnung) || d.datei_name || "Dokument");
	return false;
}
async function dokAnsehen(url, mime, pfad, titel) {
	dokViewerZu();
	const ov = document.createElement("div");
	ov.className = "dok-viewer";
	ov.id = "dokViewer";
	ov.setAttribute("role", "dialog");
	ov.setAttribute("aria-modal", "true");
	ov.setAttribute("aria-label", "Dokument ansehen");
	ov.innerHTML = "<div class=\"dv-leiste\"><div class=\"dv-titel\">" + escapeHtml(titel) + "</div>" + "<button type=\"button\" class=\"dv-btn\" data-act-click=\"h227\">" + DREH_SVG + "<span>Drehen 90°</span></button>" + "<a class=\"dv-btn\" href=\"" + escapeHtml(url) + "\" target=\"_blank\" rel=\"noopener\">Original öffnen ↗</a>" + "<button type=\"button\" class=\"dv-btn dv-zu\" data-act-click=\"h228\" aria-label=\"Schließen\">✕</button></div>" + "<div class=\"dv-buehne\" id=\"dvBuehne\"><div class=\"dv-laedt\"><span class=\"neu-spin\"></span> Wird geladen …</div></div>" + "<div class=\"dv-fuss\">„Drehen“ ändert nur die Anzeige – die Originaldatei bleibt unverändert.</div>";
	ov.addEventListener("click", function(e) {
		if (e.target === ov) dokViewerZu();
	});
	document.body.appendChild(ov);
	setDOK_VIEWER({ pfad });
	document.addEventListener("keydown", dokViewerTaste);
	window.addEventListener("resize", dokViewerLayout);
	let bilder = [];
	if (String(mime).indexOf("pdf") >= 0) {
		bilder = KYC.pdfSeiten && KYC.pdfSeiten[pfad] || [];
		if (!bilder.length) {
			try {
				bilder = await pdfSeitenAlsBilder(url, 30);
			} catch (e) {
				bilder = [];
			}
		}
	} else {
		bilder = [url];
	}
	const b = document.getElementById("dvBuehne");
	if (!b || !DOK_VIEWER || DOK_VIEWER.pfad !== pfad) return;
	if (!bilder.length) {
		b.innerHTML = "<div class=\"dv-laedt\">Die Datei kann hier nicht angezeigt werden – bitte „Original öffnen“.</div>";
		return;
	}
	b.innerHTML = bilder.map(function(src, i) {
		return "<div class=\"dv-seite\"><img src=\"" + escapeHtml(src) + "\" alt=\"Seite " + (i + 1) + "\" data-act-load=\"h229\" />" + (bilder.length > 1 ? "<span class=\"dv-nr\">Seite " + (i + 1) + " von " + bilder.length + "</span>" : "") + "</div>";
	}).join("");
	dokViewerLayout();
}
function dokViewerLayout() {
	const b = document.getElementById("dvBuehne");
	if (!b || !DOK_VIEWER) return;
	const grad = drehungVon(DOK_VIEWER.pfad);
	const breit = Math.max(160, b.clientWidth - 32), hoch = Math.max(160, window.innerHeight - 190);
	b.querySelectorAll(".dv-seite").forEach(function(seite) {
		const img = seite.querySelector("img");
		if (!img || !img.naturalWidth) return;
		const w = img.naturalWidth, h = img.naturalHeight, quer = grad % 180 !== 0;
		const rw = quer ? h : w, rh = quer ? w : h;
		const f = Math.min(breit / rw, hoch / rh, 2);
		img.style.width = Math.round(w * f) + "px";
		img.style.height = Math.round(h * f) + "px";
		img.style.transform = "translate(-50%, -50%) rotate(" + grad + "deg)";
		seite.style.width = Math.round(rw * f) + "px";
		seite.style.height = Math.round(rh * f) + "px";
	});
}
function dokViewerTaste(e) {
	if (e.key === "Escape") dokViewerZu();
}
function dokViewerZu() {
	const v = document.getElementById("dokViewer");
	if (v) v.remove();
	setDOK_VIEWER(null);
	document.removeEventListener("keydown", dokViewerTaste);
	window.removeEventListener("resize", dokViewerLayout);
}
var NEU_LAEUFT = false;
var NEU_FEHLER = "";
var NEU_UHR = null;
function neuStatus(art, text) {
	let el = document.getElementById("neuStatus");
	clearInterval(NEU_UHR);
	NEU_UHR = null;
	if (!art) {
		if (el) {
			el.classList.add("weg");
			setTimeout(function() {
				const x = document.getElementById("neuStatus");
				if (x && x.classList.contains("weg")) x.remove();
			}, 320);
		}
		return;
	}
	if (!el) {
		el = document.createElement("div");
		el.id = "neuStatus";
		el.setAttribute("role", "status");
		el.setAttribute("aria-live", "polite");
		document.body.appendChild(el);
	}
	el.className = "neu-status " + art;
	if (art === "laeuft") {
		const start = Date.now();
		const zeichne = function() {
			const sek = Math.round((Date.now() - start) / 1e3);
			el.innerHTML = "<span class=\"neu-spin\"></span><div class=\"neu-txt\"><b>" + (text ? escapeHtml(text) : "Neue Bewertung läuft …") + "</b>" + "<small>Dokumente und Ergänzungen werden gegen unabhängige Quellen geprüft · meist 1–3 Minuten · " + Math.floor(sek / 60) + ":" + String(sek % 60).padStart(2, "0") + "</small></div>";
		};
		zeichne();
		NEU_UHR = setInterval(zeichne, 1e3);
	} else {
		el.innerHTML = "<span class=\"neu-ico\">" + (art === "fehler" ? "!" : "✓") + "</span><div class=\"neu-txt\"><b>" + (art === "fehler" ? "Neubewertung nicht abgeschlossen" : "Neue Bewertung abgeschlossen") + "</b><small>" + escapeHtml(text || "") + "</small></div>" + "<button type=\"button\" class=\"neu-x\" data-act-click=\"h230\" aria-label=\"Schließen\">✕</button>";
		if (art === "fertig") setTimeout(function() {
			const x = document.getElementById("neuStatus");
			if (x && x.classList.contains("fertig")) neuStatus(null);
		}, 6e3);
	}
}
async function neuBewerten(titel) {
	if (NEU_LAEUFT) {
		try {
			zeigeToast("Neubewertung läuft bereits", "Bitte warten, bis die laufende Bewertung fertig ist.");
		} catch (e) {}
		return;
	}
	if (gesperrtMelden()) return;
	const vorher = CURRENT_REPORT && typeof CURRENT_REPORT.gesamtScore === "number" ? CURRENT_REPORT.gesamtScore : null;
	NEU_LAEUFT = true;
	NEU_FEHLER = "";
	neuStatus("laeuft", titel);
	try {
		nwZeichnen();
	} catch (e) {}
	let gestartet = true;
	try {
		gestartet = await neuBewertenKern() !== false;
	} catch (e) {
		NEU_FEHLER = "Die Neubewertung ist fehlgeschlagen: " + (e && e.message || "unbekannter Fehler") + ". Bitte erneut versuchen.";
	}
	NEU_LAEUFT = false;
	try {
		nwZeichnen();
	} catch (e) {}
	if (NEU_FEHLER) neuStatus("fehler", NEU_FEHLER);
	else if (!gestartet) neuStatus(null);
	else neuStatus("fertig", "Score " + (vorher != null ? vorher + " → " : "") + (CURRENT_REPORT && CURRENT_REPORT.gesamtScore != null ? CURRENT_REPORT.gesamtScore : "–") + " · Das Ergebnis wird angezeigt.");
}
function akteScoreHTML(d) {
	const sc = typeof d.gesamtScore === "number" ? d.gesamtScore : null;
	const v = /^(ok|warn|bad)$/.test(d.verdict) ? d.verdict : "warn";
	const ico = v === "ok" ? "✓" : v === "bad" ? "✕" : "⚠";
	const roh = d._bewertetAm || d._createdAt || null;
	const datum = roh ? new Date(roh).toLocaleString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit"
	}) + " Uhr" : escapeHtml(d.datum || "");
	return "<button type=\"button\" class=\"akte-score akte-score-" + v + "\" data-act-click=\"h231\" title=\"Zur vollständigen Analyse\">" + "<div class=\"gauge-wrap akte-gauge\">" + gauge(sc) + "<div class=\"gauge-num\"><span class=\"gauge-num-val\" style=\"color:" + (sc != null ? scC(sc) : "var(--gray-l)") + "\">" + (sc != null ? sc : "N/A") + "</span><span class=\"akte-score-max\">/ 100</span></div></div>" + "<div class=\"akte-score-info\"><div class=\"akte-score-t\">Risk-Score</div>" + "<span class=\"verdict " + v + "\">" + ico + " " + escapeHtml(d.verdictText || "") + "</span>" + "<div class=\"akte-score-meta\">Letzte Bewertung: " + datum + (d._fassung > 1 ? " · Fassung " + d._fassung : "") + "<br>Prüf-ID " + escapeHtml(d.pruefId || "–") + "</div></div>" + "<span class=\"akte-score-pfeil\">Zur Analyse →</span></button>";
}
var RECHTSFORM_TOKEN = {
	sro: 1,
	spzoo: 1,
	gmbh: 1,
	mbh: 1,
	ag: 1,
	kg: 1,
	ohg: 1,
	ug: 1,
	gbr: 1,
	ek: 1,
	se: 1,
	as: 1,
	sa: 1,
	sarl: 1,
	srl: 1,
	spa: 1,
	bv: 1,
	nv: 1,
	ltd: 1,
	limited: 1,
	llc: 1,
	inc: 1,
	corp: 1,
	plc: 1,
	oy: 1,
	ab: 1,
	aps: 1,
	kft: 1,
	doo: 1,
	sl: 1,
	eood: 1,
	ood: 1,
	ou: 1,
	uab: 1,
	sia: 1,
	co: 1,
	kgaa: 1,
	haftungsbeschrankt: 1
};
function nameNormalisiert(s, umlautAe) {
	let t = String(s == null ? "" : s);
	if (umlautAe) t = t.replace(/[Ää]/g, "ae").replace(/[Öö]/g, "oe").replace(/[Üü]/g, "ue");
	t = t.replace(/ß/g, "ss").replace(/[Øø]/g, "o").replace(/[Ææ]/g, "ae").replace(/[Œœ]/g, "oe").replace(/[Łł]/g, "l").replace(/[Đđ]/g, "d").replace(/[Þþ]/g, "th").replace(/ı/g, "i");
	t = t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
	t = t.replace(/\bspol(ecnost)?\.?\s*s\s*\.?\s*r\.?\s*o\.?(?![a-z])/g, " sro ").replace(/\bs\.\s*r\.\s*o\.?(?![a-z])/g, " sro ").replace(/\bsp\.?\s*z\s*\.?\s*o\.?\s*o\.?(?![a-z])/g, " spzoo ").replace(/\bspolka z ograniczona odpowiedzialnoscia\b/g, " spzoo ").replace(/\bgesellschaft mit beschrankter haftung\b/g, " gmbh ").replace(/\ba\.\s*s\.(?![a-z])/g, " as ").replace(/\bd\.\s*o\.\s*o\.?(?![a-z])/g, " doo ");
	return t.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function nameOhneRechtsform(n) {
	return n.split(" ").filter(function(w) {
		return w && !RECHTSFORM_TOKEN[w];
	}).join(" ");
}
function hatRechtsform(n) {
	return n.split(" ").some(function(w) {
		return RECHTSFORM_TOKEN[w];
	});
}
function namenGleich(a, b) {
	if (!a || !b) return false;
	for (const ae of [false, true]) {
		const x = nameNormalisiert(a, ae), y = nameNormalisiert(b, ae);
		if (!x || !y) continue;
		if (x === y) return true;
		const kx = nameOhneRechtsform(x), ky = nameOhneRechtsform(y);
		if (kx && kx === ky && (!hatRechtsform(x) || !hatRechtsform(y))) return true;
	}
	return false;
}
function kycAnsehenEin(typ, n) {
	return dokAnsehenTyp(typ, n);
}
async function kycDateienWaehlen(typ, files) {
	if (gesperrtMelden()) return;
	if (!files || !files.length) return;
	KYC.hochladen = {
		typ,
		gesamt: files.length,
		fertig: 0
	};
	kycRender();
	try {
		for (let i = 0; i < files.length; i++) {
			await kycUpload(typ, files[i]);
			if (KYC.hochladen) {
				KYC.hochladen.fertig = i + 1;
				kycRender();
			}
		}
	} finally {
		KYC.hochladen = null;
		kycRender();
	}
}
async function kycLoeschen(typ) {
	return kycLoeschenEin(typ, 0);
}
async function kycLoeschenEin(typ, n) {
	if (gesperrtMelden()) return;
	const d = (KYC.doks[typ] || [])[n];
	if (!d) return;
	if (!await frageDialog({
		titel: "Datei löschen?",
		text: "Die Datei wird aus der Akte entfernt.",
		ok: "Löschen",
		gefahr: true
	})) return;
	try {
		try {
			await sb.storage.from("kyc").remove([d.storage_path]);
		} catch (e) {}
		await sb.from("kyc_dokumente").delete().eq("id", d.id);
		await kycLaden();
	} catch (e) {
		console.warn("KYC löschen:", e && e.message);
	}
}
function showReport(d, rawName, fromHistory, nichtSpeichern) {
	try {
		const ordnerAnsicht = document.getElementById("akteView");
		if (ordnerAnsicht) {
			ordnerAnsicht.style.display = "none";
			ordnerAnsicht.innerHTML = "";
		}
		const hauptAnsicht = document.getElementById("mainView");
		if (hauptAnsicht && hauptAnsicht.style.display === "none") hauptAnsicht.style.display = "";
	} catch (e) {}
	const sc = document.querySelector(".search-card");
	if (sc) sc.style.display = fromHistory ? "none" : "";
	clearInterval(stepTimer);
	fortschrittFertig();
	document.getElementById("loading").classList.remove("active");
	document.getElementById("searchBtn").disabled = false;
	d = d || {};
	if (!d.pruefId) d.pruefId = generatePruefId();
	if (!d._createdAt) d._createdAt = new Date().toISOString();
	if (!d._email) d._email = CURRENT_USER_EMAIL || "";
	if (!d._name) d._name = CURRENT_USER_NAME || "";
	CURRENT_REPORT = d;
	AKTE.sankFertig = false;
	AKTE.sankFehler = false;
	AKTE.sankKarteFehler = false;
	AKTE.evSprache = null;
	d.firmenname = d.firmenname || rawName || "Unbekanntes Unternehmen";
	if (!fromHistory && !nichtSpeichern) {
		try {
			firmennameAbsichern(d, rawName);
		} catch (e) {}
	}
	try {
		sanktionenAbgleichen(d);
	} catch (e) {}
	try {
		setTimeout(function() {
			monBereichZeichnen(d);
		}, 120);
	} catch (e) {}
	try {
		setTimeout(function() {
			bearbLeisteZeichnen();
		}, 140);
	} catch (e) {}
	setDRUCK_NAME(d.firmenname);
	setDRUCK_ID(d.pruefId || "");
	d.kontakt = d.kontakt || {};
	d.kontakt.socialLinks = Array.isArray(d.kontakt.socialLinks) ? d.kontakt.socialLinks : [];
	d.grunddaten = d.grunddaten || { felder: [] };
	d.finanzen = d.finanzen || { felder: [] };
	d.reputation = d.reputation || { felder: [] };
	d.personen = d.personen || { felder: [] };
	d.phantom = d.phantom || { verdacht: false };
	d.insolvenz = d.insolvenz || { verdacht: false };
	if (!Array.isArray(d.grunddaten.felder)) d.grunddaten.felder = [];
	if (!Array.isArray(d.finanzen.felder)) d.finanzen.felder = [];
	if (!Array.isArray(d.reputation.felder)) d.reputation.felder = [];
	if (!Array.isArray(d.personen.felder)) d.personen.felder = [];
	if (!d.empfehlung || d.empfehlung.length < 20) {
		const sc = d.gesamtScore || 0;
		if (sc >= 75) {
			d.empfehlung = "Die Firma weist eine solide und überwiegend unauffällige Datenlage auf. Eine Standard-Sorgfaltspflicht ist in der Regel ausreichend. Vor Geschäftsabschluss sollten die wirtschaftlich Berechtigten gemäß §11 GwG identifiziert und dokumentiert sowie ein aktueller Handelsregisterauszug zur Akte genommen werden.";
		} else if (sc >= 50) {
			d.empfehlung = "Es bestehen einzelne Punkte, die eine erhöhte Sorgfaltspflicht gemäß §15 GwG nahelegen. Vor Geschäftsabschluss sollten die auffälligen Angaben durch offizielle Dokumente (Handelsregisterauszug, Gewerbeanmeldung) verifiziert und die wirtschaftlich Berechtigten dokumentiert werden.";
		} else {
			d.empfehlung = "Aufgrund mehrerer Auffälligkeiten ist eine verstärkte Sorgfaltspflicht gemäß §15 GwG geboten. Vor Geschäftsabschluss sollten umfassende Unterlagen angefordert, die wirtschaftlich Berechtigten zweifelsfrei identifiziert und die Hintergründe der festgestellten Auffälligkeiten geklärt werden.";
		}
	}
	if (!Array.isArray(d.risikoHinweise)) {
		d.risikoHinweise = Array.isArray(d.risiken) ? d.risiken : Array.isArray(d.hinweise) ? d.hinweise : [];
	}
	d.datum = d.datum || new Date().toLocaleDateString("de-DE");
	const metaParts = [d.datum];
	if (d._land) metaParts.push("Land: " + escapeHtml(d._land));
	if (sitzMeta(d)) metaParts.push(sitzMeta(d));
	if (d.ustId && d.ustId !== "null") metaParts.push("USt-ID: " + escapeHtml(d.ustId));
	if (d._standort) metaParts.push("Eigener Standort: " + escapeHtml(d._standort));
	const vIcon = d.verdict === "ok" ? "✓" : d.verdict === "bad" ? "✕" : "⚠";
	const flagsHTML = sitzHinweise(d).concat(d.risikoHinweise || []).map((f) => {
		if (!f) return "";
		if (typeof f === "string") return `<div class="flag"><span class="flag-icon warn">⚠</span><span class="flag-text">${escapeHtml(f)}</span></div>`;
		const typ = f.typ || f.type || f.status || "warn";
		const text = f.text || f.hinweis || f.beschreibung || f.value || "";
		if (!text) return "";
		const kat = f.kategorie || f.category || f.kat || "";
		const icon = typ === "ok" ? "✓" : typ === "warn" ? "⚠" : typ === "bad" ? "✕" : "⚠";
		const katLabel = kat ? `<b>[${escapeHtml(kat)}]</b> ` : "";
		const typSicher = /^(ok|warn|bad|info)$/.test(typ) ? typ : "warn";
		return `<div class="flag"><span class="flag-icon ${typSicher}">${icon}</span><span class="flag-text">${katLabel}${escapeHtml(text)}</span></div>`;
	}).filter(Boolean).join("");
	let banner = "";
	const ds = d._dataSource || "";
	const teile = ["Register-, Presse- und Online-Recherche", "Abgleich mit der EU-Sanktionsliste"];
	if (ds.includes("vies")) teile.push("USt-IdNr. amtlich über EU-VIES bestätigt");
	if (ds.includes("google")) teile.push("Kontakt und Standort über Google");
	banner = `<div class="data-banner"><span class="data-banner-dot"></span>${teile.join(" · ")}</div>`;
	const na = (v) => isNA(v) ? "<span class=\"cc-value na\">N/A</span>" : `<div class="cc-value">${escapeHtml(v)}</div>`;
	scoreBerechnen(d);
	const sank = d.sanktion || {};
	const vIcon2 = d.verdict === "ok" ? "✓" : d.verdict === "bad" ? "✕" : "⚠";
	document.getElementById("report").innerHTML = `
    ${banner}
    <div class="report-top">
      <div>
        <div class="report-eyebrow">Compliance-Auswertung · Prüfung gemäß §§ 10–17 GwG</div>
        <div class="report-name">${escapeHtml(nameAnzeige(d.firmenname, d.firmennameOriginal).haupt)}</div>${nameOriginalHTML(nameAnzeige(d.firmenname, d.firmennameOriginal))}
        <div class="report-meta">${metaParts.join(" · ")}</div>
      </div>
      <span class="verdict ${/^(ok|warn|bad)$/.test(d.verdict) ? d.verdict : "warn"}">${vIcon2} ${escapeHtml(d.verdictText)}</span>
    </div>
    ${akteStepperHTML()}
    <div class="akte-panel" data-panel="akte" id="panelAkte">${akteScoreHTML(d)}${akteStammHTML(d)}<div id="monBereich" class="mon-bereich"></div></div>
    <div class="akte-panel" data-panel="analyse" id="panelAnalyse">
    <div class="akte-lock"></div>
    <div id="dokHinweis" class="dok-hinweis"></div>
    ${hochrisikoBlockHTML(d)}
    ${sitzKarteHTML(d)}
    <div class="score-card reveal">
      <div class="gauge-wrap">${gauge(d.gesamtScore)}<div class="gauge-num"><span class="gauge-num-val" style="color:${d.gesamtScore ? scC(d.gesamtScore) : "var(--gray-l)"}">${d.gesamtScore || "N/A"}</span><span class="gauge-num-label">${d.gesamtScore ? "/ 100" : ""}</span></div></div>
      <div class="score-right">
        <div class="score-title">Gesamt-Vertrauens-Score</div>
        <div class="bar-track"><div class="bar-fill ${barC(d.gesamtScore)}" style="width:${d.gesamtScore || 0}%"></div></div>
        <div class="score-desc">${escapeHtml(d.empfehlung && d.empfehlung.length > 20 ? d.empfehlung.split(".")[0] + "." : (d.verdictText || "Prüfung abgeschlossen") + ".")}</div>
        ${d._score_begruendung ? `<div class="score-rechnung" title="So setzt sich der Wert zusammen"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>${escapeHtml(d._score_begruendung)}</div>` : ""}
      </div>
    </div>
    <div class="grid4 reveal">
      ${secCard("Grunddaten", d.grunddaten, "30%")}
      ${secCard("Personen", d.personen, "30%")}
      ${secCard("Reputation", d.reputation, "5%")}
      ${secCard("Finanzen", d.finanzen, "15%")}
    </div>
    ${identitaetHTML(d)}
    ${phantomHTML(d)}
    ${insolvenzHTML(d)}
    <div class="contact-card reveal">
      <div class="contact-header">
        <div class="sec-title">${catIcon("Kontakt & Online")}Kontaktdaten & Online-Präsenz<span class="sec-weight">20%</span></div>
        ${miniScore(d.kontakt.score)}
      </div>
      <div class="contact-grid">
        <div class="cc" id="cc_website" data-kat="Kontakt" data-feld="Website">${ccStift("cc_website")}<div class="cc-label">Website</div><span class="cc-wert">${isNA(d.kontakt.website) ? "<span class=\"cc-value na\">N/A</span>" : sichereUrl(d.kontakt.website) ? `<a class="maps-link" href="${sichereUrl(d.kontakt.website)}" target="_blank" rel="noopener">${escapeHtml(d.kontakt.website)} ↗</a>` : `<div class="cc-value">${escapeHtml(d.kontakt.website)}</div>`}${!isNA(d.kontakt.website) ? `<span class="cc-badge ${d.kontakt.httpsOk ? "ok" : "warn"}" style="margin-left:6px">${d.kontakt.httpsOk ? "HTTPS ✓" : /^https:\/\//i.test(String(d.kontakt.website || "").trim()) ? "HTTPS nicht bestätigt" : "Kein HTTPS"}</span>` : ""}</span></div>
        <div class="cc" id="cc_email" data-kat="Kontakt" data-feld="E-Mail">${ccStift("cc_email")}<div class="cc-label">E-Mail</div><span class="cc-wert">${na(d.kontakt.email)}</span></div>
        <div class="cc" id="cc_telefon" data-kat="Kontakt" data-feld="Telefon">${ccStift("cc_telefon")}<div class="cc-label">Telefon</div><span class="cc-wert">${na(d.kontakt.telefon)}</span></div>
        <div class="cc" id="cc_linkedin" data-kat="Kontakt" data-feld="LinkedIn">${ccStift("cc_linkedin")}<div class="cc-label">LinkedIn</div><span class="cc-wert">${d.kontakt.linkedinAktiv && sichereUrl(d.kontakt.linkedinUrl) && !isNA(d.kontakt.linkedinUrl) ? `<a class="maps-link" href="${sichereUrl(d.kontakt.linkedinUrl)}" target="_blank" rel="noopener">Profil öffnen ↗</a>` : `<div class="cc-value ${d.kontakt.linkedinAktiv ? "" : "na"}">${d.kontakt.linkedinAktiv ? "Vorhanden" : "N/A"}</div>`}</span></div>
        <div class="cc" id="cc_social" data-kat="Kontakt" data-feld="Social Media">${ccStift("cc_social")}<div class="cc-label">Social Media</div><span class="cc-wert">${(() => {
		const links = (d.kontakt.socialLinks || []).filter((s) => s && sichereUrl(s.url) && !isNA(s.url));
		if (links.length > 0) return links.map((s) => `<a class="maps-link" href="${sichereUrl(s.url)}" target="_blank" rel="noopener" style="display:block;font-size:11px">${escapeHtml(s.platform || "Profil")} ↗</a>`).join("");
		return `<div class="cc-value ${isNA(d.kontakt.socialMedia) ? "na" : ""}" style="font-size:11px">${isNA(d.kontakt.socialMedia) ? "N/A" : escapeHtml(d.kontakt.socialMedia)}</div>`;
	})()}</span></div>
      </div>
      ${d.kontakt.source && !isNA(d.kontakt.source) ? `<div style="margin-top:10px;font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray-l)">Quelle: ${escapeHtml(d.kontakt.source)}</div>` : ""}
    </div>
    <div class="flags-card reveal">
      <div class="flags-heading"><span class="sec-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg></span>Risiko-Hinweise</div>
      ${flagsHTML || "<div class=\"flag\"><span class=\"flag-icon warn\">⚠</span><span class=\"flag-text\">Es konnten keine spezifischen Risiko-Hinweise automatisch ermittelt werden. Bitte prüfen Sie die Einzelangaben oben sorgfältig im Rahmen Ihrer Sorgfaltspflicht.</span></div>"}
    </div>
    <div class="rec-card reveal">
      <div class="rec-label">Compliance-Empfehlung</div>
      <div class="rec-text">${escapeHtml(d.empfehlung)}</div>
    </div>
    ${evidenceHTML(d)}
    <div id="bearbLeiste" class="bearb-leiste"></div>
    ${manuellHinweisHTML(d)}
    ${pruefprotokollHTML(d)}
    </div>
    <div class="akte-panel" data-panel="sanktion" id="panelSanktion">
      <div class="sec-card sk-intro reveal">
        <div class="sk-head"><div class="sk-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg></div>
          <div><div class="sk-sub">Schritt 4 \u00b7 Abgleich</div><div class="sk-t">Sanktionslisten</div></div></div>
        <div class="sk-txt">Unternehmen, Gesch\u00e4ftsf\u00fchrung und wirtschaftlich Berechtigte werden gegen die konsolidierte Sanktionsliste der Europ\u00e4ischen Union abgeglichen \u2013 t\u00e4glich gespiegelt, auch mit abweichenden Schreibweisen. Ein Treffer bedeutet Namens\u00e4hnlichkeit, nicht Personenidentit\u00e4t.</div>
      </div>
      <div id="sankBereich" class="sank-bereich"><div class="sank-laedt">Sanktionslisten werden abgeglichen&hellip;</div></div>
    </div>
    <div class="akte-panel" data-panel="dokumente" id="panelDokumente">
      <div class="akte-lock"></div>
      ${dokInfoHTML()}
      <div id="kycMount" style="display:none;"></div>
      ${nachweisCardHTML()}
    </div>
    <div class="akte-panel" data-panel="endverbleib" id="panelEndverbleib"><div class="akte-lock"></div>${endverbleibCardHTML()}</div>
    <div class="akte-panel" data-panel="abschluss" id="panelAbschluss">${abschlussCardHTML()}</div>
    <div class="actions akte-aktionen" id="akteAktionen"></div>`;
	document.getElementById("report").classList.add("active");
	NW.modus = false;
	NW.gesamt = 0;
	NW.laeuft = 0;
	try {
		nwZeichnen();
	} catch (e) {}
	try {
		akteZeichnen();
		akteAnsicht(AKTE.ansichtStart || "akte", true);
		AKTE.ansichtStart = null;
	} catch (e) {}
	if (d && d.pruefId) initKyc(d.pruefId);
	buildWatermark(d);
	loadEvidenceImage(d._evidence || {});
	karteLaden(d._evidence || {});
	const revealEls = document.querySelectorAll(".report .reveal");
	if ("IntersectionObserver" in window) {
		const obs = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.classList.add("in-view");
					obs.unobserve(entry.target);
				}
			});
		}, {
			threshold: .15,
			rootMargin: "0px 0px -60px 0px"
		});
		revealEls.forEach((el) => obs.observe(el));
		setTimeout(() => {
			revealEls.forEach((el) => {
				const rect = el.getBoundingClientRect();
				if (rect.top < window.innerHeight) el.classList.add("in-view");
			});
		}, 100);
	} else {
		revealEls.forEach((el) => el.classList.add("in-view"));
	}
	AKTE.gaugeLief = false;
	AKTE.gaugeZiel = d.gesamtScore !== null && d.gesamtScore !== undefined && !isNaN(d.gesamtScore) ? parseInt(d.gesamtScore) : null;
	gaugeSetzen(AKTE.gaugeZiel);
	if (!fromHistory && !nichtSpeichern) {
		const speicherLauf = saveAnalysisToHistory(d, rawName);
		try {
			SPEICHERN_LAEUFT.set(d, speicherLauf);
		} catch (e) {}
	}
}
var ORDNER_AUTO = true;
var _LAENDER_ORDNER_LAEUFT = {};
function laenderOrdnerFinden(land) {
	const l = String(land || "").trim().toLowerCase();
	const liste = ORDNER_LIST || [];
	const gleich = function(o, n) {
		return String(o.name || "").trim().toLowerCase() === n;
	};
	const direkt = liste.find(function(o) {
		return gleich(o, l);
	});
	if (direkt) return direkt;
	for (let n = 2; n <= 5; n++) {
		const alt = liste.find(function(o) {
			return gleich(o, l + " (" + n + ")");
		});
		if (alt) return alt;
	}
	return null;
}
async function laenderOrdnerSichern(land) {
	land = String(land || "").trim();
	if (!land || land === "Andere" || !sb || !CURRENT_FIRMA || !CURRENT_FIRMA.firma_id) return null;
	let o = laenderOrdnerFinden(land);
	if (o) return o.id;
	const schluessel = land.toLowerCase();
	if (_LAENDER_ORDNER_LAEUFT[schluessel]) return _LAENDER_ORDNER_LAEUFT[schluessel];
	const lauf = (async function() {
		await ladeOrdner();
		let x = laenderOrdnerFinden(land);
		if (x) return x.id;
		const einzel = CURRENT_FIRMA.typ === "einzel";
		const { data, error } = await sb.from("ordner").insert({
			firma_id: CURRENT_FIRMA.firma_id,
			ersteller_id: CURRENT_USER_ID,
			name: land,
			farbe: "#22C55E",
			sichtbarkeit: einzel ? "privat" : "oeffentlich"
		}).select("id");
		if (error) {
			if (error.code === "23505" || /duplicate key|unique/i.test(error.message || "")) {
				await ladeOrdner();
				x = laenderOrdnerFinden(land);
				if (x) return x.id;
				for (let n = 2; n <= 5; n++) {
					const alt = await sb.from("ordner").insert({
						firma_id: CURRENT_FIRMA.firma_id,
						ersteller_id: CURRENT_USER_ID,
						name: land + " (" + n + ")",
						farbe: "#22C55E",
						sichtbarkeit: einzel ? "privat" : "oeffentlich"
					}).select("id");
					if (!alt.error) {
						await ladeOrdner();
						const y = laenderOrdnerFinden(land);
						const id2 = y && y.id || alt.data && alt.data[0] && alt.data[0].id || null;
						if (id2) return id2;
						break;
					}
					if (!(alt.error.code === "23505" || /duplicate key|unique/i.test(alt.error.message || ""))) break;
				}
			}
			throw error;
		}
		const neuId = data && data[0] && data[0].id;
		await ladeOrdner();
		x = laenderOrdnerFinden(land);
		const id = x && x.id || neuId || null;
		if (!id) throw new Error("Ordner-ID fehlt");
		return id;
	})();
	_LAENDER_ORDNER_LAEUFT[schluessel] = lauf;
	try {
		return await lauf;
	} finally {
		delete _LAENDER_ORDNER_LAEUFT[schluessel];
	}
}
async function saveAnalysisToHistory(d, rawName) {
	if (!sb) return;
	try {
		const { data: sess } = await sb.auth.getSession();
		const user = sess && sess.session && sess.session.user;
		if (!user) return;
		let firmaId = CURRENT_FIRMA ? CURRENT_FIRMA.firma_id : null;
		if (!firmaId) {
			try {
				const { data: ks } = await sb.rpc("kontingent_status");
				if (ks && ks.length && ks[0] && ks[0].firma_id) {
					firmaId = ks[0].firma_id;
					setCURRENT_FIRMA(ks[0]);
				}
			} catch (e) {}
		}
		let ordnerId = SELECTED_ORDNER_ID || null;
		if (!ordnerId && ORDNER_AUTO) {
			const landAkte = String(d._land || "").trim();
			if (!landAkte || landAkte === "Andere") {
				try {
					zeigeToast("Ohne Ordner gespeichert", "Kein eindeutiges Land – Akte liegt unter ‚Ohne Ordner‘.");
				} catch (e) {}
			} else {
				try {
					ordnerId = await laenderOrdnerSichern(landAkte);
				} catch (e) {
					ordnerId = null;
					console.warn("Laenderordner:", e && e.message);
				}
				if (!ordnerId) {
					try {
						zeigeToast("Ohne Ordner gespeichert", "Länderordner konnte nicht angelegt werden – Akte liegt unter ‚Ohne Ordner‘.");
					} catch (e) {}
				}
			}
		}
		let attempts = 0;
		const ohneSpalten = {};
		while (attempts < 12) {
			const row = {
				user_id: user.id,
				firma_id: firmaId,
				ordner_id: ordnerId,
				pruef_id: d.pruefId,
				firmenname: d.firmenname || rawName || "Unbekanntes Unternehmen",
				land: d._land || null,
				ust_id: d.ustId && d.ustId !== "null" ? d.ustId : null,
				standort: d._standort || null,
				sitz_eingegeben: d._sitz && d._sitz.eingegeben || null,
				sitz_quelle: d._sitz && d._sitz.quelle || null,
				sitz_abweichung: d._sitz ? !!d._sitz.abweichung : null,
				google_place_id: d._evidence && d._evidence.placeId || null,
				von_support: CURRENT_USER_RANG === "support",
				score: typeof d.gesamtScore === "number" && !isNaN(d.gesamtScore) ? Math.round(d.gesamtScore) : null,
				verdict: d.verdict || null,
				verdict_text: d.verdictText || null,
				report_json: d
			};
			Object.keys(ohneSpalten).forEach(function(k) {
				delete row[k];
			});
			const _ins = await sb.from("analysen").insert(row).select("id");
			const error = _ins ? _ins.error : null;
			try {
				if (_ins && _ins.data && _ins.data[0]) d._analyseId = _ins.data[0].id;
			} catch (e) {}
			if (!error) {
				if (CURRENT_FIRMA) {
					CURRENT_FIRMA.verbraucht = (CURRENT_FIRMA.verbraucht || 0) + 1;
					updateKontingentAnzeige();
				}
				return;
			}
			const fehlt = fehlendeSpalte(error);
			if (fehlt && Object.prototype.hasOwnProperty.call(row, fehlt) && [
				"standort",
				"sitz_eingegeben",
				"sitz_quelle",
				"sitz_abweichung",
				"google_place_id",
				"von_support"
			].indexOf(fehlt) >= 0) {
				console.warn("Spalte \"" + fehlt + "\" fehlt noch in der Datenbank - Akte wird ohne sie gespeichert (Daten bleiben im Bericht).");
				ohneSpalten[fehlt] = true;
				attempts++;
				continue;
			}
			if (error.code === "23505" || /duplicate|unique/i.test(error.message || "")) {
				d.pruefId = generatePruefId();
				buildWatermark(d);
				attempts++;
				continue;
			}
			console.warn("Historie konnte nicht gespeichert werden:", error.message);
			return;
		}
	} catch (e) {
		console.warn("Historie-Speichern fehlgeschlagen:", e && e.message);
	}
}
function openHistory() {
	mitAusBlende(_openHistory);
}
async function _openHistory() {
	ORDNER_NAV_FRISCH = true;
	const main = document.getElementById("mainView");
	const view = document.getElementById("historyView");
	const team = document.getElementById("teamView");
	const akte = document.getElementById("akteView");
	if (main) main.style.display = "none";
	if (team) team.style.display = "none";
	if (akte) akte.style.display = "none";
	view.style.display = "block";
	fadeInView(view);
	window.scrollTo({
		top: 0,
		behavior: "smooth"
	});
	view.innerHTML = `
    <div class="history-head">
      <div>
        <div class="history-eyebrow">Geprüfte Unternehmen</div>
        <div class="history-title">Akten & Ordner</div>
        <div class="history-sub">Alle Compliance-Prüfungen deines Unternehmens. Klicke einen Eintrag an, um den vollständigen Bericht erneut zu öffnen oder zu drucken – mit derselben Prüf-ID wie auf dem Ausdruck.</div>
      </div>
      <button class="btn-action" data-act-click="h94">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Zurück zur Analyse
      </button>
    </div>
    <div class="hist-controls">
      <div class="hist-search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input id="histSearch" class="hist-search" placeholder="${t("ph_such", "Unternehmen suchen…")}" data-act-input="h232" autocomplete="off" />
      </div>
      <button class="btn-action" id="btnVerwalten" data-act-click="h233">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
        Ordner verwalten
      </button>
    </div>
    <div id="ordnerManage" class="ordner-manage" style="display:none;"></div>
    <div class="history-loading"><div class="spinner"></div><div>Historie wird geladen…</div></div>`;
	if (!sb) {
		renderHistoryError("Keine Verbindung zur Datenbank.");
		return;
	}
	setHISTORY_FILTER("alle");
	setHU_GEZEIGT(false);
	try {
		await ladeOrdner();
		await ladeHistorie();
		try {
			await ladeFavoriten();
		} catch (e) {}
		try {
			await ladeFreigaben();
		} catch (e) {}
		renderHistoryList();
		if (KYC_ZIEL_NACH_LADEN) {
			const ziel = KYC_ZIEL_NACH_LADEN;
			setKYC_ZIEL_NACH_LADEN(null);
			const idx = HISTORY_ROWS.findIndex(function(r) {
				return r.id === ziel;
			});
			if (idx >= 0) setTimeout(function() {
				openFromHistory(idx);
			}, 260);
			else akteNachladenUndOeffnen(ziel);
		}
	} catch (e) {
		renderHistoryError(e && e.message || "Historie konnte nicht geladen werden.");
	}
}
var HISTORIE_GRUNDSPALTEN = [
	"id",
	"pruef_id",
	"firmenname",
	"land",
	"ust_id",
	"score",
	"verdict",
	"verdict_text",
	"created_at",
	"ordner_id"
];
var HISTORIE_ZUSATZSPALTEN = [
	"standort",
	"schritte",
	"abgeschlossen_am",
	"abgeschlossen_von",
	"abgeschlossen_von_name",
	"sitz_eingegeben",
	"sitz_quelle",
	"sitz_abweichung",
	"google_place_id"
];
var HISTORIE_FEHLEND = {};
var HIST_SEITE = 200;
var HIST_SLIM_SPALTEN = [
	"rj_firmenname:report_json->>firmenname",
	"rj_orig:report_json->firmennameOriginal",
	"rj_name:report_json->>_name",
	"rj_email:report_json->>_email",
	"rj_api:report_json->_api",
	"rj_sank:report_json->_sanktionen->treffer",
	"rj_ki_treffer:report_json->sanktion->treffer",
	"rj_ki_art:report_json->sanktion->>art",
	"rj_ki_score:report_json->sanktion->score"
];
var HIST_SLIM = true;
var HISTORY_TOTAL = null;
var HISTORY_VOLL = true;
var HIST_OFFSET = 0;
var HIST_ZAEHLER = null;
var HIST_SUCHE_TIMER = null;
var SANK_SCHWELLE_HART = .7;
function sankAehnlichkeit(x) {
	if (!x || typeof x !== "object") return null;
	const e = x.eintrag && typeof x.eintrag === "object" ? x.eintrag : x;
	const a = e.aehnlichkeit !== undefined && e.aehnlichkeit !== null ? e.aehnlichkeit : x.aehnlichkeit;
	const n = typeof a === "number" ? a : typeof a === "string" && a.trim() !== "" ? Number(a) : NaN;
	return isFinite(n) ? n : null;
}
function sankDeckelTreffer(liste) {
	return Array.isArray(liste) ? liste.filter(function(x) {
		if (!x) return false;
		const a = sankAehnlichkeit(x);
		return a === null || a >= SANK_SCHWELLE_HART;
	}) : [];
}
function anzeigeDeckelWert(score, rj, slim) {
	if (typeof score !== "number" || isNaN(score)) return score;
	rj = rj || {};
	const euListe = slim ? slim.sank : rj._sanktionen && rj._sanktionen.treffer;
	const eu = sankDeckelTreffer(euListe).length > 0;
	let kiTreffer, kiArt, kiScore;
	if (slim) {
		kiTreffer = slim.kiTreffer;
		kiArt = slim.kiArt;
		kiScore = slim.kiScore;
	} else {
		const s = rj.sanktion || {};
		kiTreffer = s.treffer;
		kiArt = s.art;
		kiScore = s.score;
	}
	const ki = kiTreffer === true && (kiArt === "sanktion" || kiArt === "beides");
	if (!eu && !ki) return score;
	const sScore = ki && typeof kiScore === "number" ? kiScore : 25;
	return Math.min(score, Math.min(30, sScore));
}
function anzeigeDeckel(r) {
	if (!r) return r;
	let slim = null;
	if ("rj_sank" in r || "rj_ki_treffer" in r || "rj_ki_art" in r || "rj_ki_score" in r) {
		slim = {
			sank: r.rj_sank,
			kiTreffer: r.rj_ki_treffer,
			kiArt: r.rj_ki_art,
			kiScore: r.rj_ki_score
		};
	}
	delete r.rj_sank;
	delete r.rj_ki_treffer;
	delete r.rj_ki_art;
	delete r.rj_ki_score;
	const neuerScore = anzeigeDeckelWert(r.score, r.report_json, slim);
	if (typeof neuerScore === "number" && typeof r.score === "number" && neuerScore < r.score) {
		r._dbScore = r.score;
		r._dbVerdict = r.verdict;
		r._dbVerdictText = r.verdict_text;
		r.score = neuerScore;
		r.verdict = "bad";
		r.verdict_text = t("v_bad", "Verstärkte Sorgfaltspflicht");
	}
	return r;
}
async function historieSeite(von, mitZaehler, filterFn) {
	if (!sb) return {
		rows: [],
		count: null
	};
	for (let versuch = 0; versuch < 12; versuch++) {
		const basis = HIST_SLIM ? HISTORIE_GRUNDSPALTEN.concat(HIST_SLIM_SPALTEN) : HISTORIE_GRUNDSPALTEN.concat(["report_json"]);
		const spalten = basis.concat(HISTORIE_ZUSATZSPALTEN.filter(function(x) {
			return !HISTORIE_FEHLEND[x];
		}));
		let q = sb.from("analysen").select(spalten.join(", "), mitZaehler ? { count: "exact" } : {});
		if (filterFn) q = filterFn(q);
		q = q.order("created_at", { ascending: false }).order("id", { ascending: false }).range(von, von + HIST_SEITE - 1);
		const r = await q;
		if (!r.error) return {
			rows: (r.data || []).map(function(z) {
				return anzeigeDeckel(historieZeileSlim(z));
			}),
			count: typeof r.count === "number" ? r.count : null
		};
		const fehlt = fehlendeSpalte(r.error);
		if (fehlt && HISTORIE_ZUSATZSPALTEN.indexOf(fehlt) >= 0 && !HISTORIE_FEHLEND[fehlt]) {
			console.warn("Historie: Spalte \"" + fehlt + "\" fehlt noch (SQL einspielen) - wird ausgelassen.");
			HISTORIE_FEHLEND[fehlt] = true;
			continue;
		}
		if (/column|schema cache|does not exist/i.test(r.error.message || "") && HISTORIE_ZUSATZSPALTEN.some(function(x) {
			return !HISTORIE_FEHLEND[x];
		})) {
			HISTORIE_ZUSATZSPALTEN.forEach(function(x) {
				HISTORIE_FEHLEND[x] = true;
			});
			continue;
		}
		if (HIST_SLIM && !filterFn && historieSlimAbgelehnt(r.error)) {
			console.warn("Historie: schlanke Abfrage nicht moeglich - lade vollstaendig.", r.error && r.error.message);
			HIST_SLIM = false;
			continue;
		}
		throw r.error;
	}
	throw new Error("Akten konnten nicht geladen werden.");
}
async function ladeHistorie() {
	if (!sb) return [];
	const ziel = Math.max(HIST_SEITE, HIST_OFFSET);
	let alle = [], total = null, letzte = 0;
	for (let von = 0; von < ziel; von += HIST_SEITE) {
		const s = await historieSeite(von, von === 0);
		if (von === 0) total = s.count;
		alle = alle.concat(s.rows);
		letzte = s.rows.length;
		if (s.rows.length < HIST_SEITE) break;
	}
	setHISTORY_ROWS(alle);
	HIST_OFFSET = alle.length;
	HISTORY_TOTAL = total;
	HISTORY_VOLL = letzte < HIST_SEITE || total !== null && alle.length >= total;
	HIST_ZAEHLER = null;
	if (!HISTORY_VOLL) historieZaehlerLaden();
	return HISTORY_ROWS;
}
async function historieMehrLaden() {
	if (HISTORY_VOLL) return 0;
	const s = await historieSeite(HIST_OFFSET, false);
	const dazu = historieZeilenMischen(s.rows);
	HIST_OFFSET += s.rows.length;
	if (s.rows.length < HIST_SEITE || HISTORY_TOTAL !== null && HIST_OFFSET >= HISTORY_TOTAL) HISTORY_VOLL = true;
	return dazu;
}
async function historieAlleLaden() {
	let schutz = 0;
	while (!HISTORY_VOLL && schutz++ < 500) await historieMehrLaden();
}
async function historieZaehlerLaden() {
	try {
		if (!sb) return;
		let z = null;
		try {
			const rz = await sb.rpc("analysen_ordner_zaehler");
			if (!rz.error && Array.isArray(rz.data)) {
				z = { __ohne: 0 };
				rz.data.forEach(function(x) {
					const n = Number(x && x.anzahl);
					if (isNaN(n)) throw new Error("zaehler");
					if (x.ordner_id) z[x.ordner_id] = n;
					else z.__ohne = n;
				});
				(ORDNER_LIST || []).forEach(function(o) {
					if (typeof z[o.id] !== "number") z[o.id] = 0;
				});
			}
		} catch (e) {
			z = null;
		}
		if (!z) {
			z = { __ohne: 0 };
			const jobs = (ORDNER_LIST || []).map(function(o) {
				return sb.from("analysen").select("id", {
					count: "exact",
					head: true
				}).eq("ordner_id", o.id).then(function(r) {
					if (!r.error && typeof r.count === "number") z[o.id] = r.count;
					else throw new Error("zaehler");
				});
			});
			jobs.push(sb.from("analysen").select("id", {
				count: "exact",
				head: true
			}).is("ordner_id", null).then(function(r) {
				if (!r.error && typeof r.count === "number") z.__ohne = r.count;
				else throw new Error("zaehler");
			}));
			await Promise.all(jobs);
		}
		HIST_ZAEHLER = z;
		if (document.getElementById("histBody")) renderHistoryList();
	} catch (e) {
		HIST_ZAEHLER = null;
	}
}
function historieServerSuche() {
	clearTimeout(HIST_SUCHE_TIMER);
	if (HISTORY_VOLL) return;
	const eingabe = document.getElementById("histSearch");
	const roh = (eingabe && eingabe.value || "").trim();
	if (roh.length < 2) return;
	HIST_SUCHE_TIMER = setTimeout(async function() {
		try {
			const begriffe = [];
			[roh, translitLatein(roh.toLowerCase())].forEach(function(t) {
				const sauber = String(t || "").replace(/[,()*%"\\]/g, " ").trim();
				if (sauber.length >= 2 && begriffe.indexOf(sauber) < 0) begriffe.push(sauber);
			});
			if (!begriffe.length) return;
			const teile = [];
			begriffe.forEach(function(t) {
				teile.push("firmenname.ilike.*" + t + "*");
				teile.push("report_json->>firmennameOriginal.ilike.*" + t + "*");
			});
			const s = await historieSeite(0, false, function(q) {
				return q.or(teile.join(","));
			});
			if (historieZeilenMischen(s.rows) && document.getElementById("histBody")) renderHistoryList();
		} catch (e) {
			console.warn("Serversuche:", e && e.message);
			try {
				if (!HIST_SUCHE_HINWEIS) {
					HIST_SUCHE_HINWEIS = true;
					zeigeToast(LANG === "en" ? "Search limited" : "Suche eingeschränkt", LANG === "en" ? "Searching the loaded records only – please use “Load more”." : "Suche nur in den geladenen Akten – bitte „Mehr laden“ nutzen.");
				}
			} catch (e2) {}
		}
	}, 350);
}
async function ensureVolleAkte(r) {
	if (!r || !r._slim) return r;
	if (!sb || !r.id) throw new Error("Bericht konnte nicht geladen werden.");
	const q = await sb.from("analysen").select("report_json").eq("id", r.id).limit(1);
	if (q.error) throw q.error;
	const rj = q.data && q.data[0] && q.data[0].report_json;
	if (!rj) throw new Error("Bericht nicht gefunden.");
	r.report_json = rj;
	r._slim = false;
	return r;
}
function renderHistoryError(msg) {
	const loading = document.querySelector("#historyView .history-loading");
	const html = `<div class="history-empty">
    <div class="empty-icon" style="background:var(--bad-bg)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg></div>
    <p style="color:var(--bad-text);font-weight:600">${escapeHtml(friendlyError(msg))}</p>
    <button class="btn-retry" data-act-click="h62"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Erneut laden</button>
  </div>`;
	if (loading) loading.outerHTML = html;
	else {
		const v = document.getElementById("historyView");
		if (v) v.insertAdjacentHTML("beforeend", html);
	}
}
async function historieFilterVorbereiten() {
	if (HISTORY_VOLL) return;
	try {
		await historieAlleLaden();
	} catch (e) {
		console.warn("Historie nachladen:", e && e.message);
		try {
			zeigeToast("Nicht alle Akten geladen", "Bitte „Mehr laden“ nutzen oder erneut versuchen.");
		} catch (e2) {}
	}
}
async function setHistoryFilter(val) {
	setHISTORY_FILTER(val);
	if (val !== "alle" && !HISTORY_VOLL) {
		renderHistoryList();
		await historieFilterVorbereiten();
	}
	renderHistoryList();
}
function histSuche() {
	renderHistoryList();
	historieServerSuche();
}
async function historieMehrKlick(btn) {
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Lade …";
	}
	try {
		await historieMehrLaden();
	} catch (e) {
		try {
			zeigeToast("Laden fehlgeschlagen", "Bitte erneut versuchen.");
		} catch (e2) {}
	}
	renderHistoryList();
}
function sichtbarSicherstellen(wurzel) {
	try {
		const reduziert = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (!reduziert) return;
		const el = (wurzel || document).querySelectorAll(".hr-anim, .tm-anim, .rang-anim, .tb-anim, .sec-in, .fav-zeile, .fg-zeile, .audit-row, " + ".of-gruppe, .up-schritt, .sank-zeile, .pk-an, .lp-an, .mail-weg, .druck-weg, .ob-frei-z");
		el.forEach(function(e) {
			e.style.opacity = "1";
			e.style.transform = "none";
		});
	} catch (e) {}
}
function renderHistoryList() {
	try {
		standortVorschlaege();
	} catch (e) {}
	const view = document.getElementById("historyView");
	const loading = view.querySelector(".history-loading");
	if (loading) loading.remove();
	const oldBody = document.getElementById("histBody");
	if (oldBody) oldBody.remove();
	if (!HISTORY_ROWS.length) {
		view.insertAdjacentHTML("beforeend", `<div id="histBody">
      <div class="history-empty">
        <div class="empty-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2"><path d="M12 8v4l3 3M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></div>
        <p>Noch keine Prüfungen vorhanden. Starte deine erste Analyse – sie erscheint dann automatisch hier.</p>
      </div></div>`);
		return;
	}
	const einzel = !!(CURRENT_FIRMA && CURRENT_FIRMA.typ === "einzel");
	const teilweise = !HISTORY_VOLL;
	const total = teilweise ? Math.max(HISTORY_TOTAL || 0, HISTORY_ROWS.length) : HISTORY_ROWS.length;
	const jetzt = new Date();
	const monatStart = new Date(jetzt.getFullYear(), jetzt.getMonth(), 1).getTime();
	const scores = HISTORY_ROWS.map(function(r) {
		return r.score != null ? r.score : null;
	}).filter(function(s) {
		return s !== null;
	});
	const schnitt = scores.length ? Math.round(scores.reduce(function(a, b) {
		return a + b;
	}, 0) / scores.length) : null;
	const nGruen = HISTORY_ROWS.filter(function(r) {
		return r.score >= 75;
	}).length;
	const nGelb = HISTORY_ROWS.filter(function(r) {
		return r.score >= 50 && r.score < 75;
	}).length;
	const nRot = HISTORY_ROWS.filter(function(r) {
		return r.score != null && r.score < 50;
	}).length;
	const nMonat = HISTORY_ROWS.filter(function(r) {
		return new Date(r.created_at).getTime() >= monatStart;
	}).length;
	const gesamtBewertet = nGruen + nGelb + nRot;
	function anteil(n) {
		return gesamtBewertet ? Math.round(n / gesamtBewertet * 100) : 0;
	}
	const schnittFarbe = schnitt === null ? "grau" : schnitt >= 75 ? "gruen" : schnitt >= 50 ? "gelb" : "rot";
	const uebersicht = "<div class=\"hu-leiste" + (HU_GEZEIGT ? " ruhig" : "") + "\">" + "<div class=\"hu-karte\"><div class=\"hu-wert\">" + total + "</div><div class=\"hu-label\">Akten gesamt</div></div>" + "<div class=\"hu-karte\"><div class=\"hu-wert\">" + nMonat + "</div><div class=\"hu-label\">Diesen Monat</div></div>" + "<div class=\"hu-karte\"><div class=\"hu-wert hu-" + schnittFarbe + "\">" + (schnitt === null ? "–" : schnitt) + "</div><div class=\"hu-label\">Ø Vertrauens-Score</div></div>" + "<div class=\"hu-karte hu-weit\">" + "<div class=\"hu-label\" style=\"margin-bottom:8px;\">Verteilung der Einstufungen" + (teilweise ? "<span style=\"display:block;font-weight:400;text-transform:none;letter-spacing:0;opacity:0.75;margin-top:2px;\">" + (LANG === "en" ? "based on the " + HISTORY_ROWS.length + " of " + total + " loaded records" : "über die geladenen " + HISTORY_ROWS.length + " von " + total + " Akten") + "</span>" : "") + "</div>" + "<div class=\"hu-balken\">" + (nGruen ? "<span class=\"hu-teil hu-b-gruen\" style=\"width:" + anteil(nGruen) + "%\" title=\"Geringe Auffälligkeiten: " + nGruen + "\"></span>" : "") + (nGelb ? "<span class=\"hu-teil hu-b-gelb\"  style=\"width:" + anteil(nGelb) + "%\" title=\"Erhöhte Sorgfaltspflicht: " + nGelb + "\"></span>" : "") + (nRot ? "<span class=\"hu-teil hu-b-rot\"   style=\"width:" + anteil(nRot) + "%\" title=\"Verstärkte Sorgfaltspflicht: " + nRot + "\"></span>" : "") + (gesamtBewertet ? "" : "<span class=\"hu-teil hu-b-leer\" style=\"width:100%\"></span>") + "</div>" + "<div class=\"hu-legende\">" + "<span><i class=\"hu-p hu-b-gruen\"></i>" + nGruen + " unauffällig</span>" + "<span><i class=\"hu-p hu-b-gelb\"></i>" + nGelb + " zu prüfen</span>" + "<span><i class=\"hu-p hu-b-rot\"></i>" + nRot + " kritisch</span>" + "</div></div></div>";
	let ohneCount = HISTORY_ROWS.filter(function(r) {
		return !r.ordner_id;
	}).length;
	const cByFolder = {};
	HISTORY_ROWS.forEach(function(r) {
		if (r.ordner_id) cByFolder[r.ordner_id] = (cByFolder[r.ordner_id] || 0) + 1;
	});
	if (teilweise && HIST_ZAEHLER) {
		ohneCount = HIST_ZAEHLER.__ohne;
		Object.keys(HIST_ZAEHLER).forEach(function(k) {
			if (k !== "__ohne") cByFolder[k] = HIST_ZAEHLER[k];
		});
	}
	const plus = teilweise && !HIST_ZAEHLER ? "+" : "";
	let chips = "<button class=\"hist-chip " + (HISTORY_FILTER === "alle" ? "active" : "") + "\" data-act-click=\"h234\">Alle (" + total + ")</button>";
	chips += "<button class=\"hist-chip " + (HISTORY_FILTER === "ohne" ? "active" : "") + "\" data-act-click=\"h235\">Ohne Ordner (" + ohneCount + plus + ")</button>";
	if (!(CURRENT_FIRMA && CURRENT_FIRMA.typ === "einzel")) {
		const geteilteIds = ORDNER_LIST.filter(function(o) {
			return o.sichtbarkeit === "oeffentlich";
		}).map(function(o) {
			return o.id;
		});
		const privateIds = ORDNER_LIST.filter(function(o) {
			return o.sichtbarkeit !== "oeffentlich";
		}).map(function(o) {
			return o.id;
		});
		const cGeteilt = geteilteIds.reduce(function(a, id) {
			return a + (cByFolder[id] || 0);
		}, 0);
		const cPrivat = privateIds.reduce(function(a, id) {
			return a + (cByFolder[id] || 0);
		}, 0);
		chips += "<button class=\"hist-chip chip-geteilt " + (HISTORY_FILTER === "__geteilt" ? "active" : "") + "\" data-act-click=\"h236\">" + "<svg width=\"11\" height=\"11\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><circle cx=\"18\" cy=\"5\" r=\"3\"/><circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"19\" r=\"3\"/><path d=\"M8.6 13.5l6.8 4M15.4 6.5l-6.8 4\"/></svg>" + " Geteilte Ordner (" + cGeteilt + plus + ")</button>";
		chips += "<button class=\"hist-chip chip-fav " + (HISTORY_FILTER === "__fav" ? "active" : "") + "\" data-act-click=\"h237\">" + "<svg width=\"11\" height=\"11\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.95z\"/></svg>" + " Überwachung (" + FAVORITEN.length + ")</button>";
		chips += "<button class=\"hist-chip chip-privat " + (HISTORY_FILTER === "__privat" ? "active" : "") + "\" data-act-click=\"h238\">" + "<svg width=\"11\" height=\"11\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><rect x=\"4\" y=\"10\" width=\"16\" height=\"11\" rx=\"2\"/><path d=\"M8 10V7a4 4 0 0 1 8 0v3\"/></svg>" + " Private Ordner (" + cPrivat + plus + ")</button>";
	}
	const pruefer = {};
	(HISTORY_ROWS || []).forEach(function(r) {
		const rj = r.report_json || {};
		const wer = rj._name && rj._name.indexOf("@") < 0 ? rj._name : rj._email || "";
		if (wer) pruefer[wer] = (pruefer[wer] || 0) + 1;
	});
	const pruefListe = Object.keys(pruefer).sort();
	const prueferWahl = pruefListe.length > 1 ? "<select class=\"hist-pruefer\" data-act-change=\"h239\">" + "<option value=\"\">Alle Mitarbeiter</option>" + pruefListe.map(function(p) {
		return "<option value=\"" + escapeHtml(p) + "\"" + (HISTORY_PRUEFER === p ? " selected" : "") + ">" + escapeHtml(p) + " (" + pruefer[p] + ")</option>";
	}).join("") + "</select>" : "";
	const standorte = {};
	(HISTORY_ROWS || []).forEach(function(r) {
		const st = (r.standort || "").trim();
		if (st) standorte[st] = (standorte[st] || 0) + 1;
	});
	const stListe = Object.keys(standorte).sort();
	const standortWahl = stListe.length ? "<select class=\"hist-pruefer\" data-act-change=\"h240\">" + "<option value=\"\">Alle Standorte</option>" + stListe.map(function(st) {
		return "<option value=\"" + escapeHtml(st) + "\"" + (HISTORY_STANDORT === st ? " selected" : "") + ">" + escapeHtml(st) + " (" + standorte[st] + ")</option>";
	}).join("") + "</select>" : "";
	const filterBar = "<div class=\"hist-filter\">" + chips + prueferWahl + standortWahl + "</div>";
	const keineFavs = !(FAVORITEN && FAVORITEN.length);
	let sternGesehen = false;
	try {
		sternGesehen = !!localStorage.getItem("cc_stern_gesehen");
	} catch (e) {}
	const sternHinweis = keineFavs && HISTORY_ROWS.length >= 2 && !sternGesehen ? "<div class=\"stern-hinweis\" id=\"sternHinweis\">" + "<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"#F59E0B\"><path d=\"M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.95z\"/></svg>" + "<span><b>Tipp:</b> Mit dem Stern rechts in jeder Zeile nimmst du ein Unternehmen in die laufende Überwachung – es wird dann alle 3 Monate automatisch neu geprüft.</span>" + "<button class=\"stern-hinweis-x\" data-act-click=\"h241\" title=\"Ausblenden\">×</button>" + "</div>" : "";
	const q = (document.getElementById("histSearch") && document.getElementById("histSearch").value || "").trim().toLowerCase();
	let rowsData = HISTORY_ROWS;
	if (HISTORY_PRUEFER) {
		rowsData = rowsData.filter(function(r) {
			const rj = r.report_json || {};
			const wer = rj._name && rj._name.indexOf("@") < 0 ? rj._name : rj._email || "";
			return wer === HISTORY_PRUEFER;
		});
	}
	if (HISTORY_STANDORT) rowsData = rowsData.filter(function(r) {
		return (r.standort || "").trim() === HISTORY_STANDORT;
	});
	if (HISTORY_FILTER === "ohne") rowsData = rowsData.filter(function(r) {
		return !r.ordner_id;
	});
	else if (HISTORY_FILTER === "__geteilt") {
		const ids = ORDNER_LIST.filter(function(o) {
			return o.sichtbarkeit === "oeffentlich";
		}).map(function(o) {
			return o.id;
		});
		rowsData = rowsData.filter(function(r) {
			return r.ordner_id && ids.indexOf(r.ordner_id) >= 0;
		});
	} else if (HISTORY_FILTER === "__fav") {
		const kerne = Object.keys(FAV_KERNE);
		rowsData = rowsData.filter(function(r) {
			return kerne.indexOf(firmenKern(r.firmenname)) >= 0;
		});
	} else if (HISTORY_FILTER === "__privat") {
		const ids = ORDNER_LIST.filter(function(o) {
			return o.sichtbarkeit !== "oeffentlich";
		}).map(function(o) {
			return o.id;
		});
		rowsData = rowsData.filter(function(r) {
			return r.ordner_id && ids.indexOf(r.ordner_id) >= 0;
		});
	} else if (HISTORY_FILTER !== "alle") rowsData = rowsData.filter(function(r) {
		return r.ordner_id === HISTORY_FILTER;
	});
	if (q) {
		const qLat = translitLatein(q), qLocker = suchLocker(qLat);
		rowsData = rowsData.filter(function(r) {
			const sk = suchSchluessel(r);
			return sk.indexOf(q) !== -1 || sk.indexOf(qLat) !== -1 || qLocker.length >= 3 && sk.indexOf(qLocker) !== -1;
		});
	}
	const moveOpts = "<option value=\"\">In Ordner verschieben…</option><option value=\"__none\">→ Ohne Ordner</option>" + ORDNER_LIST.map(function(o) {
		return "<option value=\"" + o.id + "\">" + escapeHtml(o.name) + "</option>";
	}).join("");
	rowsData = rowsData.slice().sort(function(a, b) {
		const sa = a.score != null ? a.score : -1, sb = b.score != null ? b.score : -1;
		switch (HISTORY_SORT) {
			case "alt": return new Date(a.created_at) - new Date(b.created_at);
			case "score_auf": return sa - sb;
			case "score_ab": return sb - sa;
			case "name": return String(a.firmenname || "").localeCompare(String(b.firmenname || ""), "de");
			default: return new Date(b.created_at) - new Date(a.created_at);
		}
	});
	let listHtml;
	if (!rowsData.length) {
		listHtml = "<div class=\"history-empty\"><p>" + (q ? "Keine Treffer für „" + escapeHtml(q) + "“." : "In diesem Ordner sind noch keine Prüfungen.") + "</p></div>";
	} else {
		listHtml = "<div class=\"history-list\">" + rowsData.map(function(r) {
			const idx = HISTORY_ROWS.indexOf(r);
			const dt = r.created_at ? new Date(r.created_at) : null;
			const datum = dt ? dt.toLocaleDateString("de-DE", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric"
			}) : "–";
			const uhr = dt ? dt.toLocaleTimeString("de-DE", {
				hour: "2-digit",
				minute: "2-digit"
			}) : "";
			const score = typeof r.score === "number" ? r.score : null;
			const scoreCol = score === null ? "var(--gray-l)" : score >= 75 ? "var(--ok-text)" : score >= 50 ? "var(--warn-text)" : "var(--bad-text)";
			const vt = r.verdict_text || (score === null ? "Geprüft" : "");
			const land = r.land ? " · " + escapeHtml(r.land) : "";
			const autor = r.report_json && (r.report_json._name || r.report_json._email) ? r.report_json._name || r.report_json._email : "";
			const einzelPruef = false;
			const autorZeile = autor ? "<div class=\"hr-author\">Geprüft von " + escapeHtml(autor) + "</div>" : "";
			const folder = r.ordner_id ? ORDNER_LIST.find(function(o) {
				return o.id === r.ordner_id;
			}) : null;
			const folderTag = folder ? "<span class=\"hr-folder\" style=\"background:" + hexToRgba(folder.farbe, .12) + ";color:" + (folder.farbe || "#16A34A") + "\">" + "<span class=\"fdot\" style=\"background:" + (folder.farbe || "#22C55E") + "\"></span>" + escapeHtml(folder.name) + (!einzel && folder.sichtbarkeit === "privat" ? " · privat" : "") + "</span>" : "";
			const mappe = folder && folder.farbe ? folder.farbe : "#2E8749";
			return "<div class=\"history-row hr-anim akte-mappe" + (r.abgeschlossen_am ? " versiegelt" : "") + "\" data-reiter=\"" + escapeHtml(r.pruef_id || "Akte") + "\" style=\"--mappe:" + mappe + ";animation-delay:" + Math.min(idx * 45, 600) + "ms\">" + "<div class=\"hr-click\" data-act-click=\"h242\" data-a0=\"" + escapeAttr(idx) + "\">" + "<div class=\"hr-main\">" + "<div class=\"hr-name\">" + escapeHtml(nameAnzeige(r.firmenname, r.report_json && r.report_json.firmennameOriginal).haupt || "Unbekanntes Unternehmen") + (r.report_json && r.report_json._api ? " <span class=\"api-badge\" title=\"über API\">API</span>" : "") + (r.abgeschlossen_am ? " <span class=\"hr-akte-ok\" title=\"Akte abgeschlossen – Vollständigkeit bestätigt\"><svg viewBox=\"0 0 24 24\" width=\"10\" height=\"10\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\"/></svg>Abgeschlossen</span>" : "") + "</div>" + nameOriginalHTML(nameAnzeige(r.firmenname, r.report_json && r.report_json.firmennameOriginal), "hr-orig") + "<div class=\"hr-meta\">" + datum + (uhr ? " · " + uhr : "") + land + "</div>" + autorZeile + "<div class=\"hr-id\">" + escapeHtml(r.pruef_id || "") + "</div>" + folderTag + "</div>" + "<div class=\"hr-right\">" + (einzelPruef ? "" : "<button class=\"fav-stern" + (istFavorit(r.firmenname) ? " ist-fav" : "") + "\" data-pid=\"" + escapeHtml(r.pruef_id || "") + "\" data-act-click=\"h243\" title=\"" + (istFavorit(r.firmenname) ? "Wird alle 3 Monate automatisch geprüft – klicken zum Entfernen" : "Zur laufenden Überwachung hinzufügen") + "\">" + "<svg viewBox=\"0 0 24 24\" width=\"17\" height=\"17\"><path d=\"M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5 6.2 20.5l1.1-6.5-4.7-4.6 6.5-.95z\"/></svg></button>") + "<span class=\"hr-score\" style=\"color:" + scoreCol + "\">" + (score === null ? "N/A" : score) + "</span>" + "<span class=\"verdict " + histVerdictClass(r.verdict) + "\">" + histVerdictIcon(r.verdict) + " " + escapeHtml(vt) + "</span>" + "<svg class=\"hr-arrow\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M9 18l6-6-6-6\"/></svg>" + "</div>" + "</div>" + "<div class=\"hr-tools\">" + "<select class=\"hr-move\" data-pid=\"" + escapeHtml(r.pruef_id || "") + "\" data-act-change=\"h244\">" + moveOpts + "</select>" + "</div>" + "</div>";
		}).join("") + "</div>";
	}
	let exportBar = "";
	if (HISTORY_FILTER !== "alle" && HISTORY_FILTER !== "ohne") {
		const f = ORDNER_LIST.find(function(o) {
			return o.id === HISTORY_FILTER;
		});
		const cnt = HISTORY_ROWS.filter(function(r) {
			return r.ordner_id === HISTORY_FILTER;
		}).length;
		if (f && cnt > 0) {
			exportBar = "<div class=\"akte-export-bar\"><button class=\"btn-action primary\" data-act-click=\"h245\" data-a0=\"" + escapeAttr(HISTORY_FILTER) + "\">" + "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6M9 15h6M9 11h6\"/></svg>" + "Akte „" + escapeHtml(f.name) + "“ als PDF (" + cnt + ")</button></div>";
		}
	}
	const sortLeiste = "<div class=\"hs-leiste\">" + "<div class=\"hs-anzahl\">" + rowsData.length + (rowsData.length === 1 ? " Eintrag" : " Einträge") + "</div>" + "<div class=\"hs-sort\"><label>Sortieren</label>" + "<select class=\"tm-select\" data-act-change=\"h246\">" + "<option value=\"neu\"" + (HISTORY_SORT === "neu" ? " selected" : "") + ">Neueste zuerst</option>" + "<option value=\"alt\"" + (HISTORY_SORT === "alt" ? " selected" : "") + ">Älteste zuerst</option>" + "<option value=\"score_auf\"" + (HISTORY_SORT === "score_auf" ? " selected" : "") + ">Score: niedrigster zuerst</option>" + "<option value=\"score_ab\"" + (HISTORY_SORT === "score_ab" ? " selected" : "") + ">Score: höchster zuerst</option>" + "<option value=\"name\"" + (HISTORY_SORT === "name" ? " selected" : "") + ">Name A–Z</option>" + "</select></div></div>";
	const favPanel = HISTORY_FILTER === "__fav" ? favUebersichtHtml() : "";
	const mehrBox = HISTORY_VOLL ? "" : "<div class=\"hist-mehr\" style=\"text-align:center;margin:16px 0 4px;\">" + "<button class=\"btn-action\" data-act-click=\"h247\">Mehr laden (" + HISTORY_ROWS.length + " von " + (HISTORY_TOTAL || "?") + " geladen)</button></div>";
	view.insertAdjacentHTML("beforeend", "<div id=\"histBody\">" + uebersicht + ordnerRegalHTML(cByFolder) + filterBar + sternHinweis + favPanel + sortLeiste + exportBar + listHtml + mehrBox + "</div>");
	setHU_GEZEIGT(true);
	try {
		ordnerNavNachZeichnen();
	} catch (e) {}
	sichtbarSicherstellen(view);
}
var ORDNER_NAV_OFFEN = false;
var ORDNER_NAV_SUCHE = "";
var ORDNER_NAV_GEZEIGT = null;
var ORDNER_NAV_FRISCH = true;
var ORDNER_NAV_ZU_AB = 8;
var ORDNER_NAV_LUPE = "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.5-3.5\"/></svg>";
function ordnerRegalHTML(cByFolder) {
	if (!ORDNER_LIST.length) return "";
	const einzel = !!(CURRENT_FIRMA && CURRENT_FIRMA.typ === "einzel");
	const viele = ORDNER_LIST.length > ORDNER_NAV_ZU_AB;
	const q = ORDNER_NAV_SUCHE.trim().toLowerCase();
	const wechsel = ORDNER_NAV_GEZEIGT !== HISTORY_FILTER;
	let treffer = 0;
	const kacheln = ORDNER_LIST.map(function(o, i) {
		const n = cByFolder && cByFolder[o.id] || 0;
		const an = HISTORY_FILTER === o.id;
		const warAn = wechsel && ORDNER_NAV_GEZEIGT === o.id;
		const team = o.sichtbarkeit === "oeffentlich";
		const frei = !team && (ORDNER_FREIGABEN[o.id] || []).length > 0;
		const sicht = einzel ? "" : team ? "Team" : frei ? "Freigegeben" : "Privat";
		const sichtbar = !q || String(o.name || "").toLowerCase().indexOf(q) >= 0;
		if (sichtbar) treffer++;
		const klasse = "on-ordner" + (an && !wechsel || warAn ? " an" : "") + (an && wechsel ? " wird-an" : "") + (warAn ? " war-an" : "") + (sichtbar ? "" : " weg") + (ORDNER_NAV_FRISCH ? " frisch" : "");
		return "<button type=\"button\" class=\"" + klasse + "\" style=\"--of:" + sichereFarbe(o.farbe) + (ORDNER_NAV_FRISCH ? ";--od:" + Math.min(i * 22, 330) + "ms" : "") + "\"" + " aria-pressed=\"" + (an ? "true" : "false") + "\" title=\"" + escapeHtml(o.name) + "\"" + " data-act-click=\"h248\" data-a0=\"" + escapeAttr(o.id) + "\">" + "<span class=\"on-blatt\" aria-hidden=\"true\"></span>" + "<span class=\"on-name\">" + escapeHtml(o.name) + "</span>" + "<span class=\"on-meta\">" + (n === 0 ? "leer" : n + (n === 1 ? " Akte" : " Akten")) + (sicht ? " · " + sicht : "") + "</span>" + "</button>";
	}).join("");
	return "<section class=\"ordner-nav\" aria-label=\"Ordner\">" + "<div class=\"on-kopf\">" + "<span class=\"on-titel\">Ordner<span class=\"on-anzahl\">" + ORDNER_LIST.length + "</span></span>" + (viele ? "<label class=\"on-suche\">" + ORDNER_NAV_LUPE + "<input type=\"search\" id=\"onSuche\" placeholder=\"Ordner suchen\" aria-label=\"Ordner suchen\" value=\"" + escapeHtml(ORDNER_NAV_SUCHE) + "\" data-act-input=\"h249\" autocomplete=\"off\" /></label>" : "") + "<button type=\"button\" class=\"on-neu\" data-act-click=\"h250\">+ Neuer Ordner</button>" + "</div>" + "<div class=\"on-raster" + (viele && !ORDNER_NAV_OFFEN && !q ? " zu" : "") + "\" id=\"onRaster\">" + kacheln + "</div>" + "<div class=\"on-leer\" id=\"onLeer\"" + (q && !treffer ? "" : " hidden") + ">Kein Ordner gefunden.</div>" + (viele ? "<button type=\"button\" class=\"on-mehr\" id=\"onMehr\" data-act-click=\"h251\"" + (q ? " hidden" : "") + ">" + (ORDNER_NAV_OFFEN ? "Weniger anzeigen" : "Alle " + ORDNER_LIST.length + " Ordner anzeigen") + "</button>" : "") + "</section>";
}
function ordnerNavNachZeichnen() {
	ORDNER_NAV_FRISCH = false;
	const raster = document.getElementById("onRaster");
	if (!raster) {
		ORDNER_NAV_GEZEIGT = HISTORY_FILTER;
		return;
	}
	const neu = raster.querySelector(".on-ordner.wird-an");
	const alt = raster.querySelector(".on-ordner.war-an");
	if (neu || alt) {
		void raster.offsetWidth;
		if (neu) {
			neu.classList.add("an");
			neu.classList.remove("wird-an");
		}
		if (alt) {
			alt.classList.remove("an");
			alt.classList.remove("war-an");
		}
	}
	ORDNER_NAV_GEZEIGT = HISTORY_FILTER;
	if (raster.classList.contains("zu") && raster.clientHeight > 0) {
		const aktiv = raster.querySelector(".on-ordner.an");
		if (aktiv && aktiv.getBoundingClientRect().bottom - raster.getBoundingClientRect().top > raster.clientHeight + 4) {
			ORDNER_NAV_OFFEN = true;
			raster.classList.remove("zu");
			const m = document.getElementById("onMehr");
			if (m) m.textContent = "Weniger anzeigen";
		} else if (raster.scrollHeight <= raster.clientHeight + 4) {
			raster.classList.remove("zu");
			const m = document.getElementById("onMehr");
			if (m) m.hidden = true;
		}
	}
}
function ordnerNavWahl(id) {
	const y = window.scrollY || 0;
	setHistoryFilter(HISTORY_FILTER === id ? "alle" : id);
	try {
		window.scrollTo(0, y);
	} catch (e) {}
}
function ordnerNavSuche(text) {
	ORDNER_NAV_SUCHE = String(text || "").slice(0, 60);
	const q = ORDNER_NAV_SUCHE.trim().toLowerCase();
	const raster = document.getElementById("onRaster");
	if (!raster) return;
	let treffer = 0;
	raster.querySelectorAll(".on-ordner").forEach(function(k) {
		const ja = !q || (k.getAttribute("title") || "").toLowerCase().indexOf(q) >= 0;
		k.classList.toggle("weg", !ja);
		if (ja) treffer++;
	});
	raster.classList.toggle("zu", !q && !ORDNER_NAV_OFFEN && ORDNER_LIST.length > ORDNER_NAV_ZU_AB);
	const leer = document.getElementById("onLeer");
	if (leer) leer.hidden = treffer > 0;
	const mehr = document.getElementById("onMehr");
	if (mehr) mehr.hidden = !!q;
}
function ordnerNavUmschalten() {
	const raster = document.getElementById("onRaster");
	if (!raster) return;
	ORDNER_NAV_OFFEN = !ORDNER_NAV_OFFEN;
	const von = raster.offsetHeight;
	raster.classList.toggle("zu", !ORDNER_NAV_OFFEN);
	const bis = raster.offsetHeight;
	raster.style.overflow = "hidden";
	raster.style.height = von + "px";
	void raster.offsetWidth;
	raster.style.transition = "height .38s cubic-bezier(.2,.8,.3,1)";
	raster.style.height = bis + "px";
	setTimeout(function() {
		raster.style.height = "";
		raster.style.transition = "";
		raster.style.overflow = "";
	}, 420);
	const m = document.getElementById("onMehr");
	if (m) m.textContent = ORDNER_NAV_OFFEN ? "Weniger anzeigen" : "Alle " + ORDNER_LIST.length + " Ordner anzeigen";
}
function ordnerRegalNeu() {
	const box = document.getElementById("ordnerManage");
	if (box && box.style.display === "none") toggleOrdnerVerwalten();
	setTimeout(function() {
		const i = document.getElementById("omNeuName");
		if (i) {
			i.focus();
			try {
				i.scrollIntoView({
					behavior: "smooth",
					block: "center"
				});
			} catch (e) {}
		}
	}, 140);
}
var OM_FRISCH = false;
var OM_LETZTES = "";
function toggleOrdnerVerwalten() {
	const box = document.getElementById("ordnerManage");
	if (!box) return;
	const offen = box.style.display !== "none";
	if (offen) {
		sektionZu(box);
	} else {
		OM_FRISCH = true;
		OM_LETZTES = "";
		const start = Date.now();
		const nachladen = function() {
			setTimeout(renderOrdnerManage, Math.max(0, 480 - (Date.now() - start)));
		};
		Promise.all([ladeFreigaben(), gruppenLaden()]).then(nachladen, nachladen);
		renderOrdnerManage();
		box.style.display = "block";
	}
	const btn = document.getElementById("btnVerwalten");
	if (btn) btn.classList.toggle("active", !offen);
}
function renderOrdnerManage() {
	const box = document.getElementById("ordnerManage");
	if (!box) return;
	const einzel = !!(CURRENT_FIRMA && CURRENT_FIRMA.typ === "einzel");
	const counts = {};
	HISTORY_ROWS.forEach(function(r) {
		if (r.ordner_id) counts[r.ordner_id] = (counts[r.ordner_id] || 0) + 1;
	});
	if (!HISTORY_VOLL && HIST_ZAEHLER) Object.keys(HIST_ZAEHLER).forEach(function(k) {
		if (k !== "__ohne") counts[k] = HIST_ZAEHLER[k];
	});
	const geteilte = ORDNER_LIST.filter(function(o) {
		return o.sichtbarkeit === "oeffentlich";
	});
	const private_ = ORDNER_LIST.filter(function(o) {
		return o.sichtbarkeit !== "oeffentlich";
	});
	function karte(o) {
		const cnt = counts[o.id] || 0;
		const geteilt = o.sichtbarkeit === "oeffentlich";
		const darfTeilen = rangWert(CURRENT_USER_RANG) >= 2 || o.ersteller_id === CURRENT_USER_ID;
		const fgAnzahl = (ORDNER_FREIGABEN[o.id] || []).length;
		const swatches = ORDNER_FARBEN.map(function(f) {
			return "<span class=\"om-swatch " + (o.farbe === f ? "active" : "") + "\" style=\"background:" + f + "\" data-act-click=\"h252\" data-a0=\"" + escapeAttr(o.id) + "\" data-a1=\"" + escapeAttr(f) + "\" title=\"Farbe wählen\"></span>";
		}).join("");
		return "<div class=\"of-karte\" style=\"--of-farbe:" + (o.farbe || "#22C55E") + "\">" + "<div class=\"of-kopf\">" + "<span class=\"of-ruecken\" aria-hidden=\"true\"></span>" + "<input class=\"of-name\" value=\"" + escapeHtml(o.name) + "\" data-act-change=\"h253\" data-a0=\"" + escapeAttr(o.id) + "\" title=\"Zum Umbenennen tippen\" />" + "<span class=\"of-anzahl\">" + cnt + (cnt === 1 ? " Akte" : " Akten") + "</span>" + "</div>" + "<div class=\"of-fuss\">" + "<div class=\"om-swatches\">" + swatches + "</div>" + "<div class=\"of-aktionen\">" + (einzel ? "" : darfTeilen ? "<button class=\"of-vis " + (geteilt ? "ist-geteilt" : "ist-privat") + "\" data-act-click=\"h254\" data-a0=\"" + escapeAttr(o.id) + "\" data-a1=\"" + escapeAttr(geteilt ? "privat" : "oeffentlich") + "\">" + (geteilt ? "<svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><circle cx=\"18\" cy=\"5\" r=\"3\"/><circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"19\" r=\"3\"/><path d=\"M8.6 13.5l6.8 4M15.4 6.5l-6.8 4\"/></svg> Mit Team geteilt" : "<svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><rect x=\"4\" y=\"10\" width=\"16\" height=\"11\" rx=\"2\"/><path d=\"M8 10V7a4 4 0 0 1 8 0v3\"/></svg> Nur für mich") + "</button>" : "<span class=\"of-vis nur-info\">" + (geteilt ? "Geteilt" : "Privat") + "</span>") + (einzel || geteilt ? "" : "<button class=\"of-fg" + (fgAnzahl ? " hat-fg" : "") + "\" data-act-click=\"h255\" data-a0=\"" + escapeAttr(o.id) + "\" title=\"Gezielt freigeben: Gruppen, Ränge oder einzelne Personen\">" + "<svg width=\"12\" height=\"12\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\"><path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 11h-6\"/></svg>" + (fgAnzahl ? " " + fgAnzahl : " Freigeben") + "</button>") + "<button class=\"of-del\" data-act-click=\"h256\" data-a0=\"" + escapeAttr(o.id) + "\" title=\"Ordner löschen\">" + "<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6\"/></svg></button>" + "</div></div></div>";
	}
	function gruppe(titel, hinweis, liste, klasse) {
		if (!liste.length) return "";
		return "<div class=\"of-gruppe " + klasse + "\">" + "<div class=\"of-gruppe-kopf\"><span class=\"of-gruppe-t\">" + titel + "</span><span class=\"of-gruppe-n\">" + liste.length + "</span></div>" + "<div class=\"of-gruppe-d\">" + hinweis + "</div>" + "<div class=\"of-liste\">" + liste.map(karte).join("") + "</div>" + "</div>";
	}
	const leer = !ORDNER_LIST.length;
	const anlegen = "<div class=\"of-neu\">" + "<div class=\"of-neu-t\">Neuen Ordner anlegen</div>" + "<div class=\"of-neu-row\">" + "<input id=\"omNeuName\" class=\"om-name-input\" placeholder=\"Name – z.B. Kunden 2026\" maxlength=\"60\" data-act-keydown=\"h257\" />" + "<button class=\"om-new-btn\" data-act-click=\"h258\">Ordner erstellen</button>" + "</div>" + (einzel ? "" : "<div id=\"omZugriff\">" + zugriffWahlHTML() + "</div>") + "</div>";
	const omHtml = "<div class=\"of-kopfzeile\">" + "<div>" + "<div class=\"of-titel\">Ordnerverwaltung</div>" + "<div class=\"of-untertitel\">" + (einzel ? "Sortiere deine Prüfungen in Ordner. Farbe und Name kannst du jederzeit ändern." : "Sortiere Akten in Ordner und entscheide, wer sie sehen darf: nur du, bestimmte Gruppen oder das ganze Team.") + "</div>" + "</div>" + "<div class=\"of-zaehler\"><b>" + ORDNER_LIST.length + "</b><span>" + (ORDNER_LIST.length === 1 ? "Ordner" : "Ordner") + "</span></div>" + "</div>" + anlegen + (leer ? "<div class=\"of-leer\"><div class=\"of-leer-ico\">📁</div><div class=\"of-leer-t\">Noch keine Ordner</div><div class=\"of-leer-d\">Lege oben deinen ersten Ordner an, um Prüfungen zu sortieren – zum Beispiel nach Kunde, Jahr oder Standort.</div></div>" : einzel ? "<div class=\"of-gruppe\"><div class=\"of-liste\">" + ORDNER_LIST.map(karte).join("") + "</div></div>" : gruppe("Mit dem Team geteilt", "Diese Ordner sehen alle Mitglieder deines Unternehmens.", geteilte, "gr-geteilt") + gruppe("Nur für mich", "Diese Ordner sieht außer dir niemand.", private_, "gr-privat"));
	if (omHtml === OM_LETZTES && box.firstElementChild) return;
	OM_LETZTES = omHtml;
	const felder = [].slice.call(box.querySelectorAll("input"));
	const aktiv = document.activeElement;
	const aktivIndex = felder.indexOf(aktiv);
	const aktivWert = aktivIndex >= 0 ? aktiv.value : null;
	const cursor = aktivIndex >= 0 ? aktiv.selectionStart : null;
	const entwurfFeld = document.getElementById("omNeuName");
	const entwurf = entwurfFeld ? entwurfFeld.value : "";
	box.classList.toggle("om-frisch", OM_FRISCH);
	OM_FRISCH = false;
	box.innerHTML = omHtml;
	const neuEntwurf = document.getElementById("omNeuName");
	if (neuEntwurf && entwurf) neuEntwurf.value = entwurf;
	if (aktivIndex >= 0) {
		const neuFelder = box.querySelectorAll("input");
		const ziel = neuFelder.length === felder.length ? neuFelder[aktivIndex] : null;
		if (ziel) {
			ziel.value = aktivWert;
			ziel.focus();
			try {
				if (cursor !== null) ziel.setSelectionRange(cursor, cursor);
			} catch (e) {}
		}
	}
	sichtbarSicherstellen(box);
}
var GRUPPEN = [];
var GRUPPEN_FARBEN = [
	"#2E8749",
	"#1E4E8C",
	"#B45309",
	"#7C3AED",
	"#0F766E",
	"#BE123C",
	"#4B5563",
	"#0369A1"
];
async function gruppenLaden() {
	GRUPPEN = [];
	if (!sb || !CURRENT_FIRMA || CURRENT_FIRMA.typ === "einzel") return;
	const { data, error } = await sb.rpc("gruppen_liste");
	if (error) {
		console.warn("Gruppen:", error.message);
		return;
	}
	GRUPPEN = (data || []).map(function(g) {
		return {
			id: g.id,
			name: g.name,
			farbe: sichereFarbe(g.farbe, "#2E8749"),
			mitglieder: g.mitglieder || [],
			ordner_anzahl: g.ordner_anzahl || 0
		};
	});
}
function gruppenBlockHtml() {
	const zeilen = GRUPPEN.length ? GRUPPEN.map(function(g, i) {
		const namen = g.mitglieder.slice(0, 3).map(mitgliedName);
		const rest = g.mitglieder.length - namen.length;
		return "<div class=\"gr-zeile\" style=\"animation-delay:" + Math.min(40 + i * 40, 320) + "ms\">" + "<span class=\"gr-punkt\" style=\"background:" + g.farbe + "\"></span>" + "<span class=\"gr-txt\">" + "<span class=\"gr-name\">" + escapeHtml(g.name) + "</span>" + "<span class=\"gr-sub\">" + g.mitglieder.length + " Mitglied" + (g.mitglieder.length === 1 ? "" : "er") + (g.mitglieder.length ? " · " + escapeHtml(namen.join(", ")) + (rest > 0 ? " +" + rest : "") : "") + " · " + g.ordner_anzahl + " Ordner</span>" + "</span>" + "<button class=\"kyc-btn gr-btn\" data-act-click=\"h259\" data-a0=\"" + escapeAttr(g.id) + "\">Mitglieder &amp; Ordner</button>" + "<button class=\"gr-ico\" data-act-click=\"h260\" data-a0=\"" + escapeAttr(g.id) + "\" title=\"Umbenennen\"><svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.1\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/><path d=\"M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z\"/></svg></button>" + "<button class=\"gr-ico gr-weg\" data-act-click=\"h261\" data-a0=\"" + escapeAttr(g.id) + "\" title=\"Löschen\"><svg viewBox=\"0 0 24 24\" width=\"13\" height=\"13\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.3\" stroke-linecap=\"round\"><path d=\"M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14\"/></svg></button>" + "</div>";
	}).join("") : "<div class=\"gr-leer\">Noch keine Gruppen. Lege z.B. „Geschäftsleitung“ oder eine Abteilung an und gib Ordner gezielt dafür frei.</div>";
	return "<div class=\"team-block sec-in sec-in-3\" id=\"gruppenBlock\">" + "<div class=\"team-block-h\">Gruppen</div>" + "<div class=\"team-block-d\">Fasse Personen zu Gruppen zusammen – etwa nach Abteilung oder Marke. Ordner lassen sich dann für ganze Gruppen freigeben, statt jede Person einzeln anzukreuzen. Eine Person kann in mehreren Gruppen sein.</div>" + "<div class=\"gr-liste\">" + zeilen + "</div>" + "<div class=\"gr-neu\">" + "<input type=\"text\" id=\"grNeuName\" class=\"gr-input\" placeholder=\"Neue Gruppe, z.B. Bentley\" maxlength=\"40\" data-act-keydown=\"h262\" />" + "<div class=\"gr-farben\" id=\"grFarben\">" + GRUPPEN_FARBEN.map(function(f, i) {
		return "<button class=\"gr-farbe" + (i === 0 ? " an" : "") + "\" style=\"background:" + f + "\" data-f=\"" + f + "\" data-act-click=\"h263\" title=\"Farbe\"></button>";
	}).join("") + "</div>" + "<button class=\"up-senden\" data-act-click=\"h264\">Gruppe anlegen</button>" + "</div>" + "</div>";
}
function gruppenBlockAuffrischen() {
	const alt = document.getElementById("gruppenBlock");
	if (!alt) {
		renderTeam();
		return;
	}
	const y = window.scrollY;
	alt.outerHTML = gruppenBlockHtml();
	const neu = document.getElementById("gruppenBlock");
	if (neu) neu.classList.remove("sec-in", "sec-in-3");
	window.scrollTo(0, y);
}
function grFarbeWahl(el) {
	document.querySelectorAll("#grFarben .gr-farbe").forEach(function(b) {
		b.classList.remove("an");
	});
	el.classList.add("an");
}
async function gruppeAnlegen() {
	const inp = document.getElementById("grNeuName");
	const name = (inp && inp.value || "").trim();
	if (name.length < 2) {
		if (inp) inp.focus();
		return;
	}
	const f = document.querySelector("#grFarben .gr-farbe.an");
	const farbe = f ? f.getAttribute("data-f") : "#2E8749";
	const { data, error } = await sb.rpc("gruppe_speichern", {
		p_id: null,
		p_name: name,
		p_farbe: farbe
	});
	if (error || !data || !data.ok) {
		alert("Gruppe konnte nicht angelegt werden: " + (error && error.message || data && data.grund || ""));
		return;
	}
	await gruppenLaden();
	gruppenBlockAuffrischen();
	zeigeToast("Gruppe angelegt", "„" + name + "“ – jetzt Mitglieder und Ordner zuordnen.");
	setTimeout(function() {
		gruppeMitgliederOeffnen(data.id);
	}, 320);
}
async function gruppeUmbenennen(id) {
	const g = GRUPPEN.find(function(x) {
		return x.id === id;
	});
	if (!g) return;
	const neu = prompt("Neuer Name für die Gruppe:", g.name);
	if (neu === null) return;
	const name = neu.trim();
	if (name.length < 2 || name === g.name) return;
	const { data, error } = await sb.rpc("gruppe_speichern", {
		p_id: id,
		p_name: name,
		p_farbe: g.farbe
	});
	if (error || !data || !data.ok) {
		alert("Umbenennen fehlgeschlagen: " + (error && error.message || data && data.grund || ""));
		return;
	}
	await gruppenLaden();
	gruppenBlockAuffrischen();
}
async function gruppeLoeschen(id) {
	const g = GRUPPEN.find(function(x) {
		return x.id === id;
	});
	if (!g) return;
	if (!await frageDialog({
		titel: "Gruppe „" + g.name + "“ löschen?",
		text: "Die Ordner bleiben erhalten – die Mitglieder dieser Gruppe verlieren nur die Freigabe, die über die Gruppe lief.",
		ok: "Löschen",
		gefahr: true
	})) return;
	const { data, error } = await sb.rpc("gruppe_loeschen", { p_id: id });
	if (error || !data || !data.ok) {
		alert("Löschen fehlgeschlagen: " + (error && error.message || data && data.grund || ""));
		return;
	}
	await gruppenLaden();
	gruppenBlockAuffrischen();
	try {
		await ladeFreigaben();
	} catch (e) {}
}
var GRUPPE_OFFEN = null;
var GM_ORDNER_OK = false;
function gruppeMitgliederOeffnen(id) {
	const g = GRUPPEN.find(function(x) {
		return x.id === id;
	});
	if (!g) return;
	GRUPPE_OFFEN = g;
	GM_ORDNER_OK = false;
	const zeilen = (TEAM_MEMBERS || []).length ? TEAM_MEMBERS.map(function(m, i) {
		const an = g.mitglieder.indexOf(m.user_id) >= 0;
		const info = RANG_INFO[m.rang] || RANG_INFO.member;
		return "<label class=\"fg-zeile\" style=\"animation-delay:" + Math.min(60 + i * 40, 400) + "ms\">" + "<input type=\"checkbox\" class=\"gm-check\" value=\"" + m.user_id + "\"" + (an ? " checked" : "") + " data-act-change=\"h265\" />" + "<span class=\"einw-mark\"></span>" + "<span class=\"fg-mail\">" + escapeHtml(m.anzeige || m.email || "") + "</span>" + "<span class=\"tm-badge tm-" + info.farbe + "\">" + info.name + "</span>" + "</label>";
	}).join("") : "<div class=\"fg-leer\">Noch keine Mitglieder im Team.</div>";
	const box = document.createElement("div");
	box.id = "gmGate";
	box.className = "up-warn-back";
	box.innerHTML = "<div class=\"up-warn-card fg-card gm-card\">" + "<div class=\"fg-kopf\"><span class=\"of-punkt\" style=\"background:" + g.farbe + "\"></span>" + "<span class=\"fg-titel\">" + escapeHtml(g.name) + "</span></div>" + "<div class=\"up-warn-d\">Wer gehört zu dieser Gruppe – und welche Ordner sieht sie? Alle Mitglieder sehen automatisch die gewählten Ordner.</div>" + "<div class=\"gm-abschnitt\"><div class=\"gm-h\"><span>Mitglieder</span><span class=\"gm-zaehler\" id=\"gmZaehler\"></span></div>" + "<div class=\"fg-liste\">" + zeilen + "</div></div>" + "<div class=\"gm-abschnitt\"><div class=\"gm-h\"><span>Ordner</span><span class=\"gm-zaehler\" id=\"gmOrdnerZaehler\"></span></div>" + "<div class=\"fg-liste\" id=\"gmOrdner\"><div class=\"fg-leer\">Ordner werden geladen…</div></div></div>" + "<div class=\"up-warn-btns\">" + "<button class=\"kyc-btn\" data-act-click=\"h266\">Abbrechen</button>" + "<button class=\"up-senden up-warn-ok\" data-act-click=\"h267\">Speichern</button>" + "</div></div>";
	document.body.appendChild(box);
	einblenden(box, function() {
		gmZaehlen();
	});
	gmOrdnerLaden(g);
}
async function gmOrdnerLaden(g) {
	try {
		if (!ORDNER_LIST.length) await ladeOrdner();
	} catch (e) {}
	let gewaehlt = [];
	try {
		const { data, error } = await sb.rpc("gruppe_ordner_liste", { p_gruppe: g.id });
		if (error) throw error;
		gewaehlt = Array.isArray(data) ? data : [];
		GM_ORDNER_OK = true;
	} catch (e) {
		GM_ORDNER_OK = false;
	}
	const ziel = document.getElementById("gmOrdner");
	if (GRUPPE_OFFEN !== g || !ziel) return;
	if (!GM_ORDNER_OK) {
		ziel.innerHTML = "<div class=\"fg-leer\">Die Ordner-Zuordnung steht nach dem Datenbank-Update bereit. Bis dahin Ordner über „Freigeben“ in der Ordnerverwaltung zuordnen.</div>";
		gmZaehlen();
		return;
	}
	if (!ORDNER_LIST.length) {
		ziel.innerHTML = "<div class=\"fg-leer\">Noch keine Ordner angelegt.</div>";
		gmZaehlen();
		return;
	}
	ziel.innerHTML = ORDNER_LIST.map(function(o, i) {
		const team = o.sichtbarkeit === "oeffentlich";
		const an = gewaehlt.indexOf(o.id) >= 0;
		return "<label class=\"fg-zeile" + (team ? " gm-team" : "") + "\" style=\"animation-delay:" + Math.min(60 + i * 40, 400) + "ms\">" + "<input type=\"checkbox\" class=\"go-check\" value=\"" + o.id + "\"" + (an ? " checked" : "") + (team && !an ? " disabled" : "") + " data-act-change=\"h265\" />" + "<span class=\"einw-mark\"></span>" + "<span class=\"of-ruecken\" style=\"--of-farbe:" + sichereFarbe(o.farbe) + "\" aria-hidden=\"true\"></span>" + "<span class=\"fg-mail\">" + escapeHtml(o.name) + "</span>" + (team ? "<span class=\"gm-hinweis\">sieht ohnehin das ganze Team</span>" : "") + "</label>";
	}).join("");
	gmZaehlen();
}
function gmZaehlen() {
	const n = document.querySelectorAll("#gmGate .gm-check:checked").length;
	const z = document.getElementById("gmZaehler");
	if (z) z.textContent = n + " ausgewählt";
	const o = document.querySelectorAll("#gmGate .go-check:checked").length;
	const zo = document.getElementById("gmOrdnerZaehler");
	if (zo) zo.textContent = GM_ORDNER_OK ? o + " ausgewählt" : "";
}
function gruppeMitgliederSchliessen() {
	const b = document.getElementById("gmGate");
	if (!b) return;
	b.classList.remove("an");
	setTimeout(function() {
		if (b.parentNode) b.remove();
	}, 240);
}
async function gruppeMitgliederSpeichern() {
	if (!GRUPPE_OFFEN) return;
	const g = GRUPPE_OFFEN;
	const ids = [], ordnerIds = [];
	document.querySelectorAll("#gmGate .gm-check").forEach(function(c) {
		if (c.checked) ids.push(c.value);
	});
	document.querySelectorAll("#gmGate .go-check").forEach(function(c) {
		if (c.checked) ordnerIds.push(c.value);
	});
	const btn = document.querySelector("#gmGate .up-warn-ok");
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Wird gespeichert…";
	}
	const { data, error } = await sb.rpc("gruppe_mitglieder_setzen", {
		p_gruppe: g.id,
		p_user_ids: ids
	});
	if (error || !data || !data.ok) {
		alert("Speichern fehlgeschlagen: " + (error && error.message || data && data.grund || ""));
		if (btn) {
			btn.disabled = false;
			btn.textContent = "Speichern";
		}
		return;
	}
	let ordnerText = "";
	if (GM_ORDNER_OK) {
		const r = await sb.rpc("gruppe_ordner_setzen", {
			p_gruppe: g.id,
			p_ordner: ordnerIds
		});
		if (r.error || !r.data || !r.data.ok) {
			alert("Mitglieder gespeichert, die Ordner-Zuordnung ist fehlgeschlagen: " + (r.error && r.error.message || r.data && r.data.grund || ""));
			if (btn) {
				btn.disabled = false;
				btn.textContent = "Speichern";
			}
			return;
		}
		ordnerText = " und sieht " + ordnerIds.length + " Ordner";
	}
	gruppeMitgliederSchliessen();
	await gruppenLaden();
	gruppenBlockAuffrischen();
	try {
		await ladeFreigaben();
	} catch (e) {}
	zeigeToast("Gruppe aktualisiert", "„" + g.name + "“ hat jetzt " + ids.length + " Mitglied" + (ids.length === 1 ? "" : "er") + ordnerText + ".");
}
var ORDNER_FREIGABEN = {};
async function ladeFreigaben() {
	ORDNER_FREIGABEN = {};
	if (!sb || !CURRENT_FIRMA || CURRENT_FIRMA.typ === "einzel") return;
	try {
		const { data } = await sb.from("ordner_freigaben").select("ordner_id, user_id");
		(data || []).forEach(function(f) {
			if (!ORDNER_FREIGABEN[f.ordner_id]) ORDNER_FREIGABEN[f.ordner_id] = [];
			ORDNER_FREIGABEN[f.ordner_id].push(f.user_id);
		});
	} catch (e) {
		ORDNER_FREIGABEN = {};
	}
}
var FREIGABE_ORDNER = null;
var FG_RAENGE = [
	["president", "President"],
	["vice", "Vice President"],
	["senior", "Senior"],
	["member", "Member"]
];
async function freigabeOeffnen(ordnerId) {
	const o = ORDNER_LIST.find(function(x) {
		return x.id === ordnerId;
	});
	if (!o) return;
	FREIGABE_ORDNER = o;
	if (!TEAM_MEMBERS.length) {
		try {
			const { data } = await sb.rpc("team_mitglieder");
			setTEAM_MEMBERS((data || []).map(function(m) {
				return {
					user_id: m.user_id,
					email: m.email,
					rang: m.rang || "member",
					anzeige: anzeigeName(m.vorname, m.nachname, m.email)
				};
			}));
		} catch (e) {}
	}
	try {
		await gruppenLaden();
	} catch (e) {}
	let info = {
		gruppen: [],
		raenge: [],
		direkt: []
	};
	try {
		const { data } = await sb.rpc("ordner_freigabe_info", { p_ordner: ordnerId });
		if (data && data.ok) info = data;
	} catch (e) {}
	const gruppenHtml = GRUPPEN.length ? GRUPPEN.map(function(g, i) {
		const an = (info.gruppen || []).indexOf(g.id) >= 0;
		return "<label class=\"fg-kachel\" style=\"animation-delay:" + Math.min(40 + i * 35, 300) + "ms\">" + "<input type=\"checkbox\" class=\"fg-gruppe\" value=\"" + g.id + "\"" + (an ? " checked" : "") + " data-act-change=\"h268\" />" + "<span class=\"einw-mark\"></span>" + "<span class=\"of-punkt\" style=\"background:" + g.farbe + "\"></span>" + "<span class=\"fg-kachel-txt\"><b>" + escapeHtml(g.name) + "</b><small>" + g.mitglieder.length + " Mitglied" + (g.mitglieder.length === 1 ? "" : "er") + "</small></span>" + "</label>";
	}).join("") : "<div class=\"fg-leer\">Noch keine Gruppen angelegt. Unter „Team“ kannst du welche erstellen.</div>";
	const raengeHtml = FG_RAENGE.map(function(r, i) {
		const an = (info.raenge || []).indexOf(r[0]) >= 0;
		const anz = (TEAM_MEMBERS || []).filter(function(m) {
			return m.rang === r[0];
		}).length;
		const infoR = RANG_INFO[r[0]] || RANG_INFO.member;
		return "<label class=\"fg-kachel fg-rang\" style=\"animation-delay:" + Math.min(60 + i * 35, 300) + "ms\">" + "<input type=\"checkbox\" class=\"fg-rangbox\" value=\"" + r[0] + "\"" + (an ? " checked" : "") + " data-act-change=\"h268\" />" + "<span class=\"einw-mark\"></span>" + "<span class=\"tm-badge tm-" + infoR.farbe + "\">" + r[1] + "</span>" + "<small>" + anz + "</small>" + "</label>";
	}).join("");
	const andere = TEAM_MEMBERS.filter(function(m) {
		return m.user_id !== CURRENT_USER_ID && m.user_id !== o.ersteller_id;
	});
	const personenHtml = andere.length ? andere.map(function(m, i) {
		const an = (info.direkt || []).indexOf(m.user_id) >= 0;
		const infoR = RANG_INFO[m.rang] || RANG_INFO.member;
		return "<label class=\"fg-zeile\" style=\"animation-delay:" + Math.min(60 + i * 30, 360) + "ms\">" + "<input type=\"checkbox\" class=\"fg-check\" value=\"" + m.user_id + "\"" + (an ? " checked" : "") + " data-act-change=\"h268\" />" + "<span class=\"einw-mark\"></span>" + "<span class=\"fg-mail\">" + escapeHtml(m.anzeige || m.email || "") + "</span>" + "<span class=\"tm-badge tm-" + infoR.farbe + "\">" + infoR.name + "</span>" + "</label>";
	}).join("") : "<div class=\"fg-leer\">Keine weiteren Personen im Team.</div>";
	const box = document.createElement("div");
	box.id = "fgGate";
	box.className = "up-warn-back";
	box.innerHTML = "<div class=\"up-warn-card fg-card fg-card-gross\">" + "<div class=\"fg-kopf\"><span class=\"of-punkt\" style=\"background:" + (o.farbe || "#22C55E") + "\"></span>" + "<span class=\"fg-titel\">" + escapeHtml(o.name) + "</span></div>" + "<div class=\"up-warn-d\">Wer darf diesen Ordner und alle Prüfungen darin sehen? Gruppen, Ränge und einzelne Personen lassen sich kombinieren.</div>" + "<div class=\"fg-abschnitt\"><div class=\"fg-abschnitt-h\">Gruppen</div><div class=\"fg-kacheln\">" + gruppenHtml + "</div></div>" + "<div class=\"fg-abschnitt\"><div class=\"fg-abschnitt-h\">Ränge <small>alle Personen mit diesem Rang, auch künftige</small></div><div class=\"fg-kacheln fg-kacheln-rang\">" + raengeHtml + "</div></div>" + "<div class=\"fg-abschnitt\"><div class=\"fg-abschnitt-h\">Einzelne Personen</div><div class=\"fg-liste\">" + personenHtml + "</div></div>" + "<div class=\"fg-vorschau\" id=\"fgVorschau\"></div>" + "<div class=\"up-warn-btns\">" + "<button class=\"kyc-btn\" data-act-click=\"h269\">Abbrechen</button>" + "<button class=\"up-senden up-warn-ok\" data-act-click=\"h270\">Freigaben speichern</button>" + "</div></div>";
	document.body.appendChild(box);
	einblenden(box, function() {
		fgZaehlen();
	});
}
function fgZaehlen() {
	const gewGruppen = [], gewRaenge = [], gewPersonen = [];
	document.querySelectorAll("#fgGate .fg-gruppe:checked").forEach(function(c) {
		gewGruppen.push(c.value);
	});
	document.querySelectorAll("#fgGate .fg-rangbox:checked").forEach(function(c) {
		gewRaenge.push(c.value);
	});
	document.querySelectorAll("#fgGate .fg-check:checked").forEach(function(c) {
		gewPersonen.push(c.value);
	});
	const sicht = {};
	gewPersonen.forEach(function(u) {
		sicht[u] = true;
	});
	GRUPPEN.forEach(function(g) {
		if (gewGruppen.indexOf(g.id) >= 0) g.mitglieder.forEach(function(u) {
			sicht[u] = true;
		});
	});
	(TEAM_MEMBERS || []).forEach(function(m) {
		if (gewRaenge.indexOf(m.rang) >= 0) sicht[m.user_id] = true;
	});
	if (FREIGABE_ORDNER && FREIGABE_ORDNER.ersteller_id) sicht[FREIGABE_ORDNER.ersteller_id] = true;
	if (CURRENT_USER_ID) delete sicht[CURRENT_USER_ID];
	const ids = Object.keys(sicht);
	const namen = ids.map(mitgliedName).filter(function(n) {
		return n && n !== "?";
	}).sort();
	const v = document.getElementById("fgVorschau");
	if (!v) return;
	if (!ids.length) {
		v.innerHTML = "<span class=\"fg-vorschau-l\">Sichtbar nur für dich" + (FREIGABE_ORDNER && FREIGABE_ORDNER.ersteller_id && FREIGABE_ORDNER.ersteller_id !== CURRENT_USER_ID ? " und den Ersteller" : "") + ".</span>";
	} else {
		v.innerHTML = "<span class=\"fg-vorschau-l\">Sichtbar für " + ids.length + " weitere Person" + (ids.length === 1 ? "" : "en") + ":</span> " + escapeHtml(namen.slice(0, 8).join(", ")) + (namen.length > 8 ? " +" + (namen.length - 8) + " weitere" : "");
	}
}
function freigabeSchliessen() {
	const b = document.getElementById("fgGate");
	if (!b) return;
	b.classList.remove("an");
	setTimeout(function() {
		if (b.parentNode) b.remove();
	}, 240);
}
async function freigabeSpeichern() {
	if (!FREIGABE_ORDNER || !sb) return;
	const gruppen = [], raenge = [], personen = [];
	document.querySelectorAll("#fgGate .fg-gruppe:checked").forEach(function(c) {
		gruppen.push(c.value);
	});
	document.querySelectorAll("#fgGate .fg-rangbox:checked").forEach(function(c) {
		raenge.push(c.value);
	});
	document.querySelectorAll("#fgGate .fg-check:checked").forEach(function(c) {
		personen.push(c.value);
	});
	const btn = document.querySelector("#fgGate .up-warn-ok");
	if (btn) {
		btn.disabled = true;
		btn.textContent = "Wird gespeichert…";
	}
	try {
		const { data, error } = await sb.rpc("ordner_freigaben_setzen", {
			p_ordner: FREIGABE_ORDNER.id,
			p_gruppen: gruppen,
			p_raenge: raenge,
			p_user_ids: personen
		});
		if (error) throw error;
		if (!data || !data.ok) throw new Error(data && data.grund || "Speichern abgelehnt");
		await ladeFreigaben();
		try {
			await gruppenLaden();
		} catch (e) {}
		freigabeSchliessen();
		setTimeout(renderOrdnerManage, 260);
		const n = data.sichtbar || 0;
		zeigeToast("Freigaben aktualisiert", n ? "Der Ordner ist jetzt für " + n + " Person" + (n === 1 ? "" : "en") + " sichtbar." : "Der Ordner ist wieder nur für dich sichtbar.");
	} catch (e) {
		alert("Freigaben konnten nicht gespeichert werden: " + (e && e.message || ""));
		if (btn) {
			btn.disabled = false;
			btn.textContent = "Freigaben speichern";
		}
	}
}
async function ordnerSichtbarkeit(id, neu) {
	if (!sb) return;
	try {
		const { error } = await sb.from("ordner").update({ sichtbarkeit: neu }).eq("id", id);
		if (error) throw error;
		await ladeOrdner();
		renderOrdnerManage();
		if (typeof renderHistoryList === "function") renderHistoryList();
		zeigeToast(neu === "oeffentlich" ? "Ordner geteilt" : "Ordner ist jetzt privat", neu === "oeffentlich" ? "Alle Mitglieder deines Teams sehen diesen Ordner ab sofort." : "Nur du siehst diesen Ordner.");
	} catch (e) {
		alert("Sichtbarkeit konnte nicht geändert werden: " + (e && e.message || ""));
	}
}
var NEU_ZUGRIFF = "privat";
var NEU_GRUPPEN = [];
function zugriffWahlHTML() {
	const opt = function(wert, text) {
		const an = NEU_ZUGRIFF === wert;
		return "<button type=\"button\" class=\"zw-opt" + (an ? " an" : "") + "\" aria-pressed=\"" + an + "\" data-act-click=\"h271\" data-a0=\"" + escapeAttr(wert) + "\">" + text + "</button>";
	};
	let html = "<div class=\"zw\"><span class=\"zw-l\">Wer darf ihn sehen?</span>" + "<div class=\"zw-seg\" role=\"group\" aria-label=\"Wer darf den Ordner sehen?\">" + opt("privat", "Nur ich") + opt("gruppen", "Bestimmte Gruppen") + opt("oeffentlich", "Ganzes Team") + "</div></div>";
	if (NEU_ZUGRIFF === "gruppen") {
		html += GRUPPEN && GRUPPEN.length ? "<div class=\"zw-gruppen\">" + GRUPPEN.map(function(g) {
			const an = NEU_GRUPPEN.indexOf(g.id) >= 0;
			return "<button type=\"button\" class=\"zw-gruppe" + (an ? " an" : "") + "\" aria-pressed=\"" + an + "\" data-act-click=\"h272\" data-a0=\"" + escapeAttr(g.id) + "\">" + "<span class=\"zw-punkt\" style=\"background:" + g.farbe + "\"></span>" + escapeHtml(g.name) + "<span class=\"zw-n\">" + g.mitglieder.length + "</span></button>";
		}).join("") + "</div>" : "<div class=\"zw-leer\">Noch keine Gruppen angelegt. " + (darfVerwalten() ? "<a data-act-click=\"h63\">Gruppen im Bereich Team anlegen</a>" : "Gruppen legt die Geschäftsleitung im Bereich Team an.") + "</div>";
	}
	return html;
}
function neuZugriff(w) {
	NEU_ZUGRIFF = w;
	zugriffNeuZeichnen();
}
function neuGruppeUmschalten(id) {
	const i = NEU_GRUPPEN.indexOf(id);
	if (i >= 0) NEU_GRUPPEN.splice(i, 1);
	else NEU_GRUPPEN.push(id);
	zugriffNeuZeichnen();
}
function zugriffNeuZeichnen() {
	const z = document.getElementById("omZugriff");
	if (z) z.innerHTML = zugriffWahlHTML();
}
var SPEICHERN_LAEUFT = new WeakMap();
var BERICHT_ERSETZT = new WeakSet();
var BERICHT_SCHREIBT = new WeakMap();
var FASSUNG_GESPEICHERT = new WeakMap();
async function akteNachladenUndOeffnen(analyseId) {
	try {
		let idx = HISTORY_ROWS.findIndex(function(r) {
			return r.id === analyseId;
		});
		if (idx < 0) {
			const s = await historieSeite(0, false, function(q) {
				return q.eq("id", analyseId);
			});
			if (historieZeilenMischen(s.rows) && document.getElementById("histBody")) {
				try {
					renderHistoryList();
				} catch (e) {}
			}
			idx = HISTORY_ROWS.findIndex(function(r) {
				return r.id === analyseId;
			});
		}
		if (idx >= 0) {
			openFromHistory(idx);
			return true;
		}
	} catch (e) {
		console.warn("Akte nachladen:", e && e.message);
	}
	try {
		zeigeToast("Akte nicht gefunden", "Die Akte ist nicht (mehr) verfügbar.");
	} catch (e2) {}
	return false;
}
var HIST_SUCHE_HINWEIS = false;
async function ordnerAnlegenVerwaltung() {
	const inp = document.getElementById("omNeuName");
	const name = (inp && inp.value || "").trim();
	if (!name) {
		if (inp) inp.focus();
		return;
	}
	if (!sb || !CURRENT_FIRMA) return;
	const einzel = CURRENT_FIRMA.typ === "einzel";
	const zugriff = einzel ? "privat" : NEU_ZUGRIFF;
	const gruppen = zugriff === "gruppen" ? NEU_GRUPPEN.filter(function(id) {
		return (GRUPPEN || []).some(function(g) {
			return g.id === id;
		});
	}) : [];
	if (zugriff === "gruppen" && !gruppen.length) {
		zeigeToast("Gruppe wählen", "Wähle mindestens eine Gruppe – oder „Nur ich“.");
		return;
	}
	const btn = document.querySelector("#ordnerManage .om-new-btn");
	if (btn) btn.disabled = true;
	try {
		const { data, error } = await sb.from("ordner").insert({
			firma_id: CURRENT_FIRMA.firma_id,
			ersteller_id: CURRENT_USER_ID,
			name,
			farbe: "#22C55E",
			sichtbarkeit: zugriff === "oeffentlich" ? "oeffentlich" : "privat"
		}).select("id");
		if (error) throw error;
		const neuId = data && data[0] && data[0].id;
		let hinweis = zugriff === "oeffentlich" ? "für das ganze Team sichtbar." : "nur für dich sichtbar.";
		if (gruppen.length && neuId) {
			const r = await sb.rpc("ordner_freigaben_setzen", {
				p_ordner: neuId,
				p_gruppen: gruppen,
				p_raenge: [],
				p_user_ids: []
			});
			if (r.error || !r.data || !r.data.ok) {
				hinweis = "angelegt, aber die Gruppenfreigabe ist fehlgeschlagen (" + (r.error && r.error.message || r.data && r.data.grund || "unbekannt") + ") – bitte über „Freigeben“ nachholen.";
			} else {
				hinweis = "sichtbar für " + gruppen.map(function(id) {
					const g = GRUPPEN.find(function(x) {
						return x.id === id;
					});
					return g ? g.name : "";
				}).filter(Boolean).join(", ") + ".";
			}
		}
		NEU_ZUGRIFF = "privat";
		NEU_GRUPPEN = [];
		await ladeOrdner();
		try {
			await ladeFreigaben();
		} catch (e) {}
		renderOrdnerManage();
		try {
			renderHistoryList();
		} catch (e) {}
		if (!HISTORY_VOLL) {
			try {
				historieZaehlerLaden();
			} catch (e) {}
		}
		zeigeToast("Ordner angelegt", "„" + name + "“ – " + hinweis);
	} catch (e) {
		console.warn("Ordner anlegen (Verwaltung):", e && e.message);
		zeigeToast("Ordner nicht angelegt", ordnerFehlerText(e) || "Bitte erneut versuchen.");
	} finally {
		if (btn) btn.disabled = false;
	}
}
async function ordnerUmbenennen(id, name) {
	name = (name || "").trim();
	const o = ORDNER_LIST.find(function(x) {
		return x.id === id;
	});
	if (!name) {
		renderOrdnerManage();
		return;
	}
	if (o && o.name === name) return;
	try {
		const { error } = await sb.from("ordner").update({ name }).eq("id", id);
		if (error) throw error;
		if (o) o.name = name;
		fuelleOrdnerSelect();
		renderHistoryList();
		renderOrdnerManage();
	} catch (e) {
		alert("Umbenennen fehlgeschlagen: " + (ordnerFehlerText(e) || "Fehler"));
		renderOrdnerManage();
	}
}
async function ordnerFarbe(id, farbe) {
	try {
		const { error } = await sb.from("ordner").update({ farbe }).eq("id", id);
		if (error) throw error;
		const o = ORDNER_LIST.find(function(x) {
			return x.id === id;
		});
		if (o) o.farbe = farbe;
		fuelleOrdnerSelect();
		renderHistoryList();
		renderOrdnerManage();
	} catch (e) {
		console.warn("Farbe konnte nicht geändert werden:", e && e.message);
	}
}
async function ordnerLoeschen(id) {
	const o = ORDNER_LIST.find(function(x) {
		return x.id === id;
	});
	const name = o ? o.name : "diesen Ordner";
	if (!await frageDialog({
		titel: "Ordner „" + name + "“ löschen?",
		text: "Die Akten darin bleiben erhalten und wandern automatisch zu „Ohne Ordner“.",
		ok: "Löschen",
		gefahr: true
	})) return;
	try {
		const { error } = await sb.from("ordner").delete().eq("id", id);
		if (error) throw error;
		HISTORY_ROWS.forEach(function(r) {
			if (r.ordner_id === id) r.ordner_id = null;
		});
		if (HISTORY_FILTER === id) setHISTORY_FILTER("alle");
		await ladeOrdner();
		renderHistoryList();
		renderOrdnerManage();
		if (!HISTORY_VOLL) {
			try {
				historieZaehlerLaden();
			} catch (e) {}
		}
	} catch (e) {
		alert("Löschen fehlgeschlagen: " + (e && e.message || "Fehler"));
	}
}
async function moveAnalyse(pruefId, val) {
	if (val === "") return;
	if (!pruefId) return;
	const ordnerId = val === "__none" ? null : val;
	try {
		const { error } = await sb.from("analysen").update({ ordner_id: ordnerId }).eq("pruef_id", pruefId);
		if (error) throw error;
		const r = HISTORY_ROWS.find(function(x) {
			return x.pruef_id === pruefId;
		});
		if (r) r.ordner_id = ordnerId;
		renderHistoryList();
		if (!HISTORY_VOLL) {
			try {
				historieZaehlerLaden();
			} catch (e) {}
		}
		if (document.getElementById("ordnerManage") && document.getElementById("ordnerManage").style.display !== "none") renderOrdnerManage();
	} catch (e) {
		alert("Verschieben fehlgeschlagen: " + (e && e.message || "Fehler"));
		renderHistoryList();
	}
}
var AUS_HISTORIE = false;
var CURRENT_REPORT = null;
function openFromHistory(i) {
	AUS_HISTORIE = true;
	mitAusBlende(function() {
		_openFromHistory(i);
	});
}
async function _openFromHistory(i) {
	const r = HISTORY_ROWS[i];
	if (!r || !r.report_json) return;
	if (r._slim) {
		try {
			await ensureVolleAkte(r);
		} catch (e) {
			console.error("Akte laden:", e);
			try {
				zeigeToast("Akte konnte nicht geladen werden", "Bitte erneut versuchen.");
			} catch (e2) {}
			return;
		}
	}
	const d = r.report_json;
	if (!d.pruefId && r.pruef_id) d.pruefId = r.pruef_id;
	if (r.id) d._analyseId = r.id;
	if (r.standort && !d._standort) d._standort = r.standort;
	if (r.google_place_id) d._googlePlaceId = r.google_place_id;
	d._schritte = r.schritte || {};
	d._abgeschlossen_am = r.abgeschlossen_am || null;
	d._abgeschlossen_von = r.abgeschlossen_von || null;
	d._abgeschlossen_von_name = r.abgeschlossen_von_name || null;
	if (!d._createdAt && r.created_at) d._createdAt = r.created_at;
	const view = document.getElementById("historyView");
	const main = document.getElementById("mainView");
	if (view) view.style.display = "none";
	if (main) main.style.display = "block";
	fadeInView(main);
	const empty = document.getElementById("emptyState");
	if (empty) empty.style.display = "none";
	showReport(d, d.firmenname, true);
	window.scrollTo({
		top: 0,
		behavior: "smooth"
	});
}
function backToMain() {
	mitAusBlende(_backToMain);
}
function _backToMain() {
	const view = document.getElementById("historyView");
	const team = document.getElementById("teamView");
	const akte = document.getElementById("akteView");
	const main = document.getElementById("mainView");
	if (view) view.style.display = "none";
	if (team) team.style.display = "none";
	if (akte) akte.style.display = "none";
	if (main) main.style.display = "block";
	fadeInView(main);
}
var SANK_STAND = null;
var SANK_ROLLEN = [
	{
		muster: /gesch(\u00e4|ae|a)ftsf|vertret|vorstand|inhaber|prokur|managing|director|\bceo\b|\bowner\b|legal rep/i,
		rolle: "Geschäftsführung"
	},
	{
		muster: /berechtigt|\bubo\b|beneficial|eigent(\u00fc|ue)mer/i,
		rolle: "Wirtschaftlich Berechtigte"
	},
	{
		muster: /gesellschafter|shareholder|anteilseigner|aktion(\u00e4|ae)r|partner/i,
		rolle: "Gesellschafter"
	}
];
function sankNameTeile(text) {
	if (!text || typeof text !== "string") return [];
	return text.replace(/\([^)]*\)/g, " ").split(/[,;\n\/]|\s+und\s+|\s+and\s+/).map(function(t) {
		return t.replace(/^\s*[A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df ]{2,30}:\s*/, "").replace(/\b(?:Dipl\.-\w+\.?|Dr\.?\s*-\s*Ing\.?|Dr\.?\s*h\.\s?c\.?(?:\s*mult\.?)?|Dr\.?\s*med\.?|(?:Herrn|Herr|Frau|Hr|Fr|Mrs|Mr|Ms|Dr|Prof)\b\.?)\s+/gi, "").replace(/\s+/g, " ").trim();
	}).filter(function(n) {
		return n.length >= 4 && n.length <= 80 && /[A-Za-z\u00c0-\u024f]/.test(n) && !/\d/.test(n) && n.split(" ").length <= 7 && !/nicht|keine|kein |unbekannt|n\/a|verf(\u00fc|ue)gbar|angegeben|wechsel|siehe|not available|unknown|none/i.test(n);
	});
}
function sanktionenNamen(d, opt) {
	const namen = [];
	if (d.firmenname) namen.push({
		name: String(d.firmenname).trim(),
		rolle: "Unternehmen"
	});
	const felder = [];
	if (d.personen && Array.isArray(d.personen.felder)) felder.push.apply(felder, d.personen.felder);
	(d.kategorien || []).forEach(function(k) {
		(k.felder || k.eintraege || []).forEach(function(f) {
			felder.push(f);
		});
	});
	SANK_ROLLEN.forEach(function(r) {
		felder.forEach(function(f) {
			const label = String(f.key || f.label || f.feld || f.name || "");
			if (/weitere firmen|beteiligung/i.test(label) || !r.muster.test(label)) return;
			sankNameTeile(String(f.value || f.wert || f.text || "")).forEach(function(n) {
				namen.push({
					name: n,
					rolle: r.rolle
				});
			});
		});
	});
	const gesehen = {};
	const liste = namen.filter(function(n) {
		if (!sankNamePruefbar(n.name)) return false;
		const k = n.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
		if (gesehen[k]) return false;
		gesehen[k] = true;
		return true;
	}).slice(0, 15);
	if (!(opt && opt.ohneOriginal)) {
		const orig = typeof nameOriginalWert === "function" ? nameOriginalWert(d.firmennameOriginal) : (function(v) {
			v = v == null ? "" : String(v).trim();
			return !v || v === "null" || v === "N/A" ? "" : v;
		})(d.firmennameOriginal);
		let nichtLatein = false;
		if (orig) {
			if (typeof istNichtLatein === "function") nichtLatein = istNichtLatein(orig);
			else {
				let schrift = null;
				try {
					schrift = new RegExp("[\\p{Script=Cyrillic}\\p{Script=Greek}\\p{Script=Arabic}\\p{Script=Hebrew}\\p{Script=Armenian}\\p{Script=Georgian}\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}\\p{Script=Thai}\\p{Script=Devanagari}]", "u");
				} catch (e) {
					schrift = /[Ͱ-ϿЀ-ԯ԰-֏֐-׿؀-ۿႠ-ჿ฀-๿ऀ-ॿ぀-ヿ一-鿿가-힯]/;
				}
				nichtLatein = schrift.test(String(orig || ""));
			}
		}
		if (orig && nichtLatein && sankNamePruefbar(orig)) {
			const ko = orig.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
			const doppelt = liste.some(function(n) {
				return n.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === ko;
			});
			if (!doppelt) liste.splice(liste.length && liste[0].rolle === "Unternehmen" ? 1 : 0, 0, {
				name: orig,
				rolle: "Unternehmen"
			});
		}
	}
	return liste;
}
function sankListeVeraltet(stand) {
	if (!stand || typeof stand !== "object") return true;
	const anz = stand.eintraege;
	if (anz !== undefined && anz !== null && anz !== "" && Number(anz) <= 0) return true;
	const sd = Date.parse(String(stand.stand || stand.datum || ""));
	if (isFinite(sd) && Date.now() - sd > 14 * 864e5) return true;
	return false;
}
function sankGrauTexte(erg, akte) {
	let veraltet = !!(erg && erg.veraltet === true);
	const fehlgeschlagen = !!(erg && erg.fehlgeschlagen === true);
	let keineNamen = !!(erg && erg.keineNamen === true);
	let gespTreffer = [];
	if (!veraltet && !fehlgeschlagen && !keineNamen && erg && erg.fehler !== true && erg.stand && erg.stand.eintraege) {
		const hatTreffer = Array.isArray(erg.treffer) && erg.treffer.length > 0;
		const nurPlatzhalter = Array.isArray(erg.namen) && erg.namen.length > 0 && erg.namen.every(function(n) {
			return !sankNamePruefbar(n && n.name);
		});
		if (!hatTreffer && (erg.geprueft === 0 || nurPlatzhalter)) keineNamen = true;
		else {
			let bezug = NaN;
			[
				erg.am,
				akte && akte._abgeschlossen_am,
				akte && akte._createdAt
			].forEach(function(x) {
				if (!isFinite(bezug) && x) bezug = Date.parse(String(x));
			});
			if (!isFinite(bezug)) bezug = Date.now();
			if (sankListeVeraltetAm(erg.stand, bezug)) {
				veraltet = true;
				if (hatTreffer) gespTreffer = erg.treffer;
			}
		}
	}
	if (!veraltet && !fehlgeschlagen && !keineNamen) return null;
	const sd = Date.parse(String(erg.stand && (erg.stand.stand || erg.stand.datum) || ""));
	const standTxt = isFinite(sd) ? new Date(sd).toLocaleDateString("de-DE") : null;
	const gefNamen = [], gefGesehen = {};
	gespTreffer.forEach(function(x) {
		const e = x && x.eintrag && typeof x.eintrag === "object" ? x.eintrag : x || {};
		const nm = String(e.name || "").trim();
		if (!nm) return;
		const ges = String(x && x.gesucht || "").trim();
		const txt = escapeHtml(nm) + (ges && ges.toLowerCase() !== nm.toLowerCase() ? " (gesucht: " + escapeHtml(ges) + ")" : "");
		if (gefGesehen[txt]) return;
		gefGesehen[txt] = true;
		gefNamen.push(txt);
	});
	return {
		t: veraltet ? "Liste veraltet, keine Aussage" : keineNamen ? "Kein Name abgeglichen, keine Aussage" : "Prüfung fehlgeschlagen, keine Aussage",
		d: (standTxt ? "Listenstand " + standTxt + ". " : "") + "Bitte prüfen Sie ergänzend manuell.",
		gefunden: gefNamen.length ? "Auf der veralteten Liste gefunden: " + gefNamen.join(", ") : ""
	};
}
function sankListeVeraltetAm(stand, bezug) {
	if (!stand || typeof stand !== "object") return true;
	const anz = stand.eintraege;
	if (anz !== undefined && anz !== null && anz !== "" && Number(anz) <= 0) return true;
	const sd = Date.parse(String(stand.stand || stand.datum || ""));
	const b = Number(bezug);
	if (isFinite(sd) && (isFinite(b) ? b : Date.now()) - sd > 14 * 864e5) return true;
	return false;
}
function sankNamePruefbar(name) {
	const s = String(name === undefined || name === null ? "" : name).replace(/\s+/g, "").toLowerCase();
	return s.length > 0 && s !== "unbekanntesunternehmen";
}
async function sanktionenAbgleichen(d) {
	if (!sb && d && d._sanktionen && d._sanktionen.fehler === true) {
		setTimeout(function() {
			if (CURRENT_REPORT === d) sanktionenAnzeigen(d._sanktionen, 0);
		}, 0);
		return;
	}
	if (!sb) return;
	const apiOhneOriginal = typeof API_RENDER !== "undefined" && !!API_RENDER;
	const namen = sanktionenNamen(d, apiOhneOriginal ? { ohneOriginal: true } : undefined);
	const sankSchluessel = function(x) {
		return String(x === undefined || x === null ? "" : x).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
	};
	const aktenName = namen.filter(function(n) {
		return n.rolle === "Unternehmen";
	})[0];
	const aktenNameGeprueft = !aktenName || !!(d._sanktionen && Array.isArray(d._sanktionen.namen) && d._sanktionen.namen.some(function(n) {
		return !!n && sankSchluessel(n.name) === sankSchluessel(aktenName.name);
	}));
	const unternehmenGeprueft = aktenNameGeprueft && namen.filter(function(n) {
		return n.rolle === "Unternehmen";
	}).every(function(u) {
		return !!(d._sanktionen && Array.isArray(d._sanktionen.namen) && d._sanktionen.namen.some(function(n) {
			return !!n && sankSchluessel(n.name) === sankSchluessel(u.name);
		}));
	});
	const vollstaendig = d._sankGeprueft && d._sanktionen && d._sanktionen.stand && Array.isArray(d._sanktionen.namen) && (d._sanktionen.geprueft || 0) >= namen.length;
	if (vollstaendig && unternehmenGeprueft) {
		setTimeout(function() {
			if (CURRENT_REPORT === d) sanktionenAnzeigen(d._sanktionen, d._sanktionen.geprueft || 0);
		}, 0);
		return;
	}
	const nachpruefung = !!(d._sankGeprueft && d._sanktionen && d._sanktionen.stand);
	if (!SANK_STAND) {
		let standRow = null, standFehler = false;
		try {
			const rs = await sb.rpc("sanktionen_stand_info");
			if (!rs || rs.error) standFehler = true;
			else standRow = rs.data && rs.data[0] || {
				quelle: "EU",
				stand: null,
				eintraege: 0
			};
		} catch (e) {
			standFehler = true;
		}
		if (standFehler) {
			d._sankGeprueft = false;
			d._sanktionen = {
				fehler: true,
				fehlgeschlagen: true,
				treffer: [],
				geprueft: 0,
				stand: SANK_STAND
			};
			if (CURRENT_REPORT === d) sanktionenAnzeigen(d._sanktionen, namen.length);
			return;
		}
		SANK_STAND = standRow;
	}
	if (sankListeVeraltet(SANK_STAND)) {
		d._sankGeprueft = false;
		d._sanktionen = {
			fehler: true,
			veraltet: true,
			treffer: [],
			geprueft: 0,
			stand: SANK_STAND
		};
		if (CURRENT_REPORT === d) sanktionenAnzeigen(d._sanktionen, namen.length);
		return;
	}
	if (!namen.length) {
		d._sankGeprueft = false;
		d._sanktionen = {
			fehler: true,
			keineNamen: true,
			treffer: [],
			geprueft: 0,
			stand: SANK_STAND
		};
		if (CURRENT_REPORT === d) sanktionenAnzeigen(d._sanktionen, 0);
		return;
	}
	if (!SANK_STAND.eintraege) {
		sanktionenAnzeigen(null, namen.length);
		return;
	}
	const treffer = [];
	let namenFehler = false;
	for (const n of namen) {
		try {
			const r = await sb.rpc("sanktionen_pruefen", {
				p_name: n.name,
				p_schwelle: .62,
				p_max: 5
			});
			if (!r || r.error || !Array.isArray(r.data)) {
				namenFehler = true;
				break;
			}
			r.data.forEach(function(t) {
				treffer.push({
					gesucht: n.name,
					rolle: n.rolle,
					eintrag: t
				});
			});
		} catch (e) {
			namenFehler = true;
			break;
		}
	}
	if (namenFehler) {
		d._sankGeprueft = false;
		d._sanktionen = {
			fehler: true,
			fehlgeschlagen: true,
			treffer: [],
			geprueft: 0,
			stand: SANK_STAND
		};
		if (CURRENT_REPORT === d) sanktionenAnzeigen(d._sanktionen, namen.length);
		return;
	}
	d._sankGeprueft = true;
	d._sanktionen = {
		treffer,
		geprueft: namen.length,
		stand: SANK_STAND,
		namen,
		am: new Date().toISOString(),
		nachpruefung: nachpruefung || undefined
	};
	const zu = !!d._abgeschlossen_am;
	if (zu) d._sanktionen.nichtGespeichert = true;
	if (CURRENT_REPORT === d) sanktionenAnzeigen(d._sanktionen, namen.length);
	if (zu) return;
	try {
		if (d.pruef_id || d.pruefId) {
			const speicherLauf = SPEICHERN_LAEUFT.get(d);
			if (speicherLauf) {
				try {
					await speicherLauf;
				} catch (e) {}
				if (typeof BERICHT_ERSETZT !== "undefined" && BERICHT_ERSETZT.has(d)) return;
				if (treffer.length) scoreBerechnen(d);
				const werte = {
					report_json: d,
					score: typeof d.gesamtScore === "number" && !isNaN(d.gesamtScore) ? Math.round(d.gesamtScore) : null,
					verdict: d.verdict || null,
					verdict_text: d.verdictText || null
				};
				let upd = sb.from("analysen").update(werte);
				upd = d._analyseId ? upd.eq("id", d._analyseId) : upd.eq("pruef_id", d.pruefId || d.pruef_id);
				const schreibLauf = Promise.resolve(upd.select("id"));
				try {
					if (typeof BERICHT_SCHREIBT !== "undefined") BERICHT_SCHREIBT.set(d, schreibLauf);
				} catch (e) {}
				const res = await schreibLauf;
				if (res && res.error) console.warn("Sanktionsabgleich: Akte nicht aktualisiert (" + (res.error.code || "Fehler") + ").");
				else if (!res || !res.data || !res.data.length) console.warn("Sanktionsabgleich: keine Akte aktualisiert (0 Treffer).");
			} else {
				if (typeof BERICHT_ERSETZT !== "undefined" && BERICHT_ERSETZT.has(d)) return;
				const gespeichertId = typeof FASSUNG_GESPEICHERT !== "undefined" ? FASSUNG_GESPEICHERT.get(d) : undefined;
				if (gespeichertId) {
					if (treffer.length) scoreBerechnen(d);
					const fassungWerte = {
						report_json: d,
						score: typeof d.gesamtScore === "number" && !isNaN(d.gesamtScore) ? Math.round(d.gesamtScore) : null,
						verdict: d.verdict || null,
						verdict_text: d.verdictText || null
					};
					const fassungLauf = Promise.resolve(sb.from("analysen").update(fassungWerte).eq("id", gespeichertId));
					try {
						if (typeof BERICHT_SCHREIBT !== "undefined") BERICHT_SCHREIBT.set(d, fassungLauf);
					} catch (e) {}
					await fassungLauf;
					return;
				}
				const altLauf = Promise.resolve(sb.from("analysen").update({ report_json: d }).eq("pruef_id", d.pruefId || d.pruef_id));
				try {
					if (typeof BERICHT_SCHREIBT !== "undefined") BERICHT_SCHREIBT.set(d, altLauf);
				} catch (e) {}
				await altLauf;
			}
		}
	} catch (e) {}
}
function sanktionenAnzeigen(erg, anzahlNamen) {
	let neuZeichnen = null;
	try {
		if (erg && Array.isArray(erg.treffer) && erg.treffer.length && CURRENT_REPORT && CURRENT_REPORT._sanktionen === erg) {
			const alt = CURRENT_REPORT.gesamtScore;
			scoreBerechnen(CURRENT_REPORT);
			if (CURRENT_REPORT.gesamtScore !== alt) {
				neuZeichnen = CURRENT_REPORT;
			}
		}
	} catch (e) {
		console.error("Score-Deckel:", e);
	}
	try {
		const ziel = document.getElementById("sankBereich");
		if (!ziel) return;
		const grauGesp = erg && erg.fehler !== true ? sankGrauTexte(erg, CURRENT_REPORT && CURRENT_REPORT._sanktionen === erg ? CURRENT_REPORT : null) : null;
		const sankFertigWert = !!(erg && erg.stand && erg.stand.eintraege && erg.fehler !== true) && !grauGesp;
		AKTE.sankFertig = false;
		AKTE.sankKarteFehler = false;
		AKTE.sankFehler = !sankFertigWert;
		setTimeout(function() {
			try {
				akteZeichnen();
			} catch (e) {}
		}, 0);
		const standTxt = erg && erg.stand && erg.stand.stand ? new Date(erg.stand.stand).toLocaleDateString("de-DE") : null;
		if (!erg || !erg.stand || !erg.stand.eintraege || erg.fehler === true || grauGesp) {
			const nichtGeprueft = !!(erg && erg.fehler === true);
			const grau = grauGesp || sankGrauTexte(erg);
			ziel.innerHTML = "<div class=\"sank-karte sank-k-grau\">" + "<div class=\"sank-k-kopf\"><span class=\"sank-k-ico\">⚠</span>" + "<span class=\"sank-k-t\">" + (grau ? grau.t : nichtGeprueft ? "EU-Sanktionsabgleich nicht möglich – nicht geprüft" : "Sanktionslisten-Abgleich nicht verfügbar") + "</span></div>" + "<div class=\"sank-k-d\">" + (grau ? grau.d : "Die Sanktionsliste konnte nicht herangezogen werden. Bitte prüfen Sie ergänzend manuell.") + "</div>" + (grau && grau.gefunden ? "<div class=\"sank-k-d\">" + grau.gefunden + "</div>" : "") + "</div>";
			return;
		}
		let sankKarteAusnahme = false;
		try {
			const alleTreffer = erg.treffer || [];
			const t = sankDeckelTreffer(alleTreffer);
			const tSchwach = alleTreffer.filter(function(x) {
				return x && t.indexOf(x) < 0;
			});
			if (tSchwach.length && !t.length) {
				ziel.innerHTML = sankGelbKarte(erg, anzahlNamen, standTxt, tSchwach, false);
				return;
			}
			const geprueftListe = Array.isArray(erg.namen) && erg.namen.length ? "<div class=\"sank-namen\"><span class=\"sank-namen-t\">Geprüft:</span> " + erg.namen.map(function(n) {
				return "<span class=\"sank-name\">" + escapeHtml(n.name) + " <em>(" + escapeHtml(n.rolle) + ")</em></span>";
			}).join("") + "</div>" : "";
			const nachHinweis = erg.nichtGespeichert ? "<div class=\"sank-nach\">Nachprüfung beim Öffnen am " + new Date(erg.am).toLocaleDateString("de-DE") + " – nicht Teil des Abschlussstands dieser Akte. Zum dauerhaften Festhalten die Akte wieder öffnen.</div>" : erg.nachpruefung ? "<div class=\"sank-nach\">Personen nachträglich abgeglichen am " + new Date(erg.am).toLocaleDateString("de-DE") + ".</div>" : "";
			if (!t.length) {
				ziel.innerHTML = "<div class=\"sank-karte sank-k-gruen\">" + "<div class=\"sank-k-kopf\"><span class=\"sank-k-ico\">✓</span>" + "<span class=\"sank-k-t\">Kein Treffer in der EU-Sanktionsliste</span></div>" + "<div class=\"sank-k-d\">" + anzahlNamen + " Name" + (anzahlNamen === 1 ? "" : "n") + " abgeglichen – das Unternehmen sowie alle im Bericht genannten Geschäftsführer, wirtschaftlich Berechtigten und Gesellschafter. " + "Geprüft gegen die konsolidierte Sanktionsliste der Europäischen Union" + (standTxt ? ", Listenstand " + standTxt + (isFinite(Date.parse(erg.stand.stand)) ? ", " + Math.max(0, Math.floor((Date.now() - Date.parse(erg.stand.stand)) / 864e5)) + " Tage alt" : "") : "") + " (" + (erg.stand.eintraege || 0).toLocaleString("de-DE") + " Einträge).</div>" + geprueftListe + nachHinweis + sankRechtstexte() + "</div>";
				return;
			}
			const zeilen = t.map(function(x, i) {
				const e = x.eintrag && typeof x.eintrag === "object" ? x.eintrag : x;
				const proz = Math.round((e.aehnlichkeit || 0) * 100);
				const teile = [];
				if (e.typ) teile.push(e.typ === "person" ? "Person" : "Organisation");
				if (e.staat) teile.push(escapeHtml(e.staat));
				if (e.geburtsdatum) teile.push("geb. " + escapeHtml(e.geburtsdatum));
				if (e.programm) teile.push(escapeHtml(e.programm));
				return "<div class=\"sank-treffer\" style=\"--st:" + (.05 + i * .07) + "s\">" + "<div class=\"sank-tr-kopf\">" + "<span class=\"sank-tr-name\">" + escapeHtml(e.name) + "</span>" + "<span class=\"sank-tr-quote\">" + proz + "% Ähnlichkeit</span>" + "</div>" + "<div class=\"sank-tr-meta\">" + teile.join(" · ") + "</div>" + "<div class=\"sank-tr-gesucht\">Gesucht wurde: <b>" + escapeHtml(x.gesucht) + "</b> (" + escapeHtml(x.rolle) + ")</div>" + (e.bemerkung ? "<div class=\"sank-tr-bem\">" + escapeHtml(e.bemerkung) + "</div>" : "") + "</div>";
			}).join("");
			ziel.innerHTML = "<div class=\"sank-karte sank-k-rot\">" + "<div class=\"sank-k-kopf\"><span class=\"sank-k-ico\">⚠</span>" + "<span class=\"sank-k-t\">" + t.length + (t.length === 1 ? " möglicher Treffer" : " mögliche Treffer") + " in der EU-Sanktionsliste</span></div>" + "<div class=\"sank-k-d\">Beim Abgleich von " + anzahlNamen + " Namen wurden Namensgleichheiten oder Ähnlichkeiten festgestellt. " + "Listenstand " + (standTxt || "unbekannt") + ".</div>" + geprueftListe + nachHinweis + "<div class=\"sank-treffer-liste\">" + zeilen + "</div>" + sankSchwachAbschnitt(tSchwach) + sankRechtstexte() + "</div>";
		} catch (e) {
			sankKarteAusnahme = true;
			AKTE.sankFertig = false;
			AKTE.sankFehler = true;
			AKTE.sankKarteFehler = true;
			try {
				console.error("Sanktionskarte:", e);
			} catch (e2) {}
			try {
				const grauK = sankGrauTexte({
					fehler: true,
					fehlgeschlagen: true,
					treffer: [],
					geprueft: 0,
					stand: erg.stand
				});
				ziel.innerHTML = "<div class=\"sank-karte sank-k-grau\">" + "<div class=\"sank-k-kopf\"><span class=\"sank-k-ico\">⚠</span>" + "<span class=\"sank-k-t\">" + (grauK ? grauK.t : "EU-Sanktionsabgleich nicht möglich – nicht geprüft") + "</span></div>" + "<div class=\"sank-k-d\">" + (grauK ? grauK.d : "Die Sanktionsliste konnte nicht herangezogen werden. Bitte prüfen Sie ergänzend manuell.") + "</div>" + "</div>";
			} catch (e3) {}
		} finally {
			if (!sankKarteAusnahme) AKTE.sankFertig = sankFertigWert;
		}
	} finally {
		if (neuZeichnen) {
			const dd = neuZeichnen;
			setTimeout(function() {
				try {
					if (CURRENT_REPORT === dd) showReport(dd, dd.firmenname, AUS_HISTORIE, true);
				} catch (e) {
					console.error(e);
				}
			}, 0);
		}
	}
}
function sanktionenAkteHtml(d) {
	const s = d && d._sanktionen;
	const grauGesp = s && s.fehler !== true ? sankGrauTexte(s, d) : null;
	if (s && (s.fehler === true || grauGesp)) {
		const grau = grauGesp || sankGrauTexte(s);
		return "<div class=\"sank-bereich\"><div class=\"sank-karte sank-k-grau\">" + "<div class=\"sank-k-kopf\"><span class=\"sank-k-ico\">⚠</span><span class=\"sank-k-t\">" + (grau ? grau.t : "EU-Sanktionsabgleich nicht möglich – nicht geprüft") + "</span></div>" + "<div class=\"sank-k-d\">" + (grau ? grau.d : "Die Sanktionsliste konnte nicht herangezogen werden. Bitte prüfen Sie ergänzend manuell.") + "</div>" + (grau && grau.gefunden ? "<div class=\"sank-k-d\">" + grau.gefunden + "</div>" : "") + "</div></div>";
	}
	if (!s || !s.stand || !s.stand.eintraege) return "";
	const standTxt = s.stand.stand ? new Date(s.stand.stand).toLocaleDateString("de-DE") : "unbekannt";
	const alleTreffer = s.treffer || [];
	const t = sankDeckelTreffer(alleTreffer);
	const tSchwach = alleTreffer.filter(function(x) {
		return x && t.indexOf(x) < 0;
	});
	if (tSchwach.length && !t.length) return "<div class=\"sank-bereich\">" + sankGelbKarte(s, s.geprueft || 0, standTxt, tSchwach, true) + "</div>";
	if (!t.length) {
		return "<div class=\"sank-bereich\"><div class=\"sank-karte sank-k-gruen\">" + "<div class=\"sank-k-kopf\"><span class=\"sank-k-ico\">✓</span>" + "<span class=\"sank-k-t\">Kein Treffer in der EU-Sanktionsliste</span></div>" + "<div class=\"sank-k-d\">" + (s.geprueft || 0) + " Name" + (s.geprueft === 1 ? "" : "n") + " abgeglichen. Listenstand " + standTxt + (isFinite(Date.parse(s.stand.stand)) ? ", " + Math.max(0, Math.floor((Date.now() - Date.parse(s.stand.stand)) / 864e5)) + " Tage alt" : "") + " (" + (s.stand.eintraege || 0).toLocaleString("de-DE") + " Einträge).</div>" + sankRechtstexte() + "</div></div>";
	}
	const zeilen = t.map(function(x) {
		const e = x.eintrag && typeof x.eintrag === "object" ? x.eintrag : x;
		const teile = [];
		if (e.typ) teile.push(e.typ === "person" ? "Person" : "Organisation");
		if (e.staat) teile.push(escapeHtml(e.staat));
		if (e.geburtsdatum) teile.push("geb. " + escapeHtml(e.geburtsdatum));
		if (e.programm) teile.push(escapeHtml(e.programm));
		return "<div class=\"sank-treffer\">" + "<div class=\"sank-tr-kopf\"><span class=\"sank-tr-name\">" + escapeHtml(e.name) + "</span>" + "<span class=\"sank-tr-quote\">" + Math.round((e.aehnlichkeit || 0) * 100) + "% Ähnlichkeit</span></div>" + "<div class=\"sank-tr-meta\">" + teile.join(" · ") + "</div>" + "<div class=\"sank-tr-gesucht\">Gesucht wurde: <b>" + escapeHtml(x.gesucht) + "</b> (" + escapeHtml(x.rolle) + ")</div>" + "</div>";
	}).join("");
	return "<div class=\"sank-bereich\"><div class=\"sank-karte sank-k-rot\">" + "<div class=\"sank-k-kopf\"><span class=\"sank-k-ico\">⚠</span>" + "<span class=\"sank-k-t\">" + t.length + " mögliche Treffer in der EU-Sanktionsliste</span></div>" + "<div class=\"sank-k-d\">Listenstand " + standTxt + ".</div>" + "<div class=\"sank-treffer-liste\">" + zeilen + "</div>" + sankSchwachAbschnitt(tSchwach) + sankRechtstexte() + "</div></div>";
}
function sankTrefferZeileEinfach(x) {
	const e = x && x.eintrag && typeof x.eintrag === "object" ? x.eintrag : x || {};
	const a = sankAehnlichkeit(x);
	const teile = [];
	if (e.typ) teile.push(e.typ === "person" ? "Person" : "Organisation");
	if (e.staat) teile.push(escapeHtml(e.staat));
	if (e.geburtsdatum) teile.push("geb. " + escapeHtml(e.geburtsdatum));
	if (e.programm) teile.push(escapeHtml(e.programm));
	return "<div class=\"sank-treffer\" style=\"border-color:rgba(234,154,11,.4)\">" + "<div class=\"sank-tr-kopf\"><span class=\"sank-tr-name\">" + escapeHtml(e.name || e.listen_name || "") + "</span>" + "<span class=\"sank-tr-quote\">" + (a === null ? "Ähnlichkeit unbekannt" : Math.round(a * 100) + "% Ähnlichkeit") + "</span></div>" + "<div class=\"sank-tr-meta\">" + teile.join(" · ") + "</div>" + "<div class=\"sank-tr-gesucht\">Gesucht wurde: <b>" + escapeHtml(x && x.gesucht || "") + "</b> (" + escapeHtml(x && x.rolle || "") + ")</div>" + "</div>";
}
function sankSchwachTitel(n) {
	return "Manuell prüfen – " + n + (n === 1 ? " schwache Ähnlichkeit" : " schwache Ähnlichkeiten") + " in der EU-Sanktionsliste";
}
function sankSchwachText() {
	return "Diese Namen ähneln einem Listeneintrag nur schwach (unter " + Math.round(SANK_SCHWELLE_HART * 100) + " % Ähnlichkeit). Kein Score-Abzug. Bitte prüfen Sie manuell, ob es sich um dieselbe Person bzw. Organisation handelt.";
}
function sankSchwachAbschnitt(liste) {
	if (!Array.isArray(liste) || !liste.length) return "";
	return "<div class=\"sank-karte sank-k-gelb\" style=\"margin-top:14px\">" + "<div class=\"sank-k-kopf\"><span class=\"sank-k-ico\">!</span><span class=\"sank-k-t\">" + sankSchwachTitel(liste.length) + "</span></div>" + "<div class=\"sank-k-d\">" + sankSchwachText() + "</div>" + "<div class=\"sank-treffer-liste\">" + liste.map(function(x) {
		return sankTrefferZeileEinfach(x);
	}).join("") + "</div>" + "</div>";
}
function sankGelbKarte(erg, anzahlNamen, standTxt, liste, pdf) {
	const n = Array.isArray(liste) ? liste.length : 0;
	let namenListe = "", nachHinweis = "";
	if (!pdf && erg) {
		if (Array.isArray(erg.namen) && erg.namen.length) {
			namenListe = "<div class=\"sank-namen\"><span class=\"sank-namen-t\">Geprüft:</span> " + erg.namen.map(function(nm) {
				return "<span class=\"sank-name\">" + escapeHtml(nm.name) + " <em>(" + escapeHtml(nm.rolle) + ")</em></span>";
			}).join("") + "</div>";
		}
		if (erg.nichtGespeichert) nachHinweis = "<div class=\"sank-nach\">Nachprüfung beim Öffnen am " + new Date(erg.am).toLocaleDateString("de-DE") + " – nicht Teil des Abschlussstands dieser Akte.</div>";
		else if (erg.nachpruefung) nachHinweis = "<div class=\"sank-nach\">Personen nachträglich abgeglichen am " + new Date(erg.am).toLocaleDateString("de-DE") + ".</div>";
	}
	return "<div class=\"sank-karte sank-k-gelb\">" + "<div class=\"sank-k-kopf\"><span class=\"sank-k-ico\">!</span><span class=\"sank-k-t\">" + sankSchwachTitel(n) + "</span></div>" + "<div class=\"sank-k-d\">" + (anzahlNamen ? "Beim Abgleich von " + anzahlNamen + " Namen wurden nur schwache Namensähnlichkeiten festgestellt. " : "") + sankSchwachText() + " Listenstand " + (standTxt || "unbekannt") + ".</div>" + namenListe + nachHinweis + "<div class=\"sank-treffer-liste\">" + (liste || []).map(function(x) {
		return sankTrefferZeileEinfach(x);
	}).join("") + "</div>" + sankRechtstexte() + "</div>";
}
function sankRechtstexte() {
	return "<div class=\"sank-recht\">" + "<div class=\"sank-recht-b\"><b>Bedeutung eines Treffers:</b> Ein Treffer in der Finanz-Sanktionsliste ist nicht gleichbedeutend mit einer Personenidentität der gesuchten Person mit der in der Sanktionsliste gefundenen Person. Ein Treffer bedeutet lediglich, dass eine Namensgleichheit oder eine Namensähnlichkeit besteht. Die Ermittlung, ob es sich um dieselbe Person handelt, muss im Wege der Amtsermittlung erfolgen.</div>" + "<div class=\"sank-recht-h\">Wir weisen ausdrücklich darauf hin, dass wir uns zum Bezug unserer Daten der von der EU öffentlich zur Einsicht bereitgestellten Sanktionsliste als Quelle bedienen. Wir haften nicht für deren Inhalt, Vollständigkeit und/oder Stand.</div>" + "</div>";
}
function buildFlagsHTML(d) {
	const arr = sitzHinweise(d).concat(Array.isArray(d.risikoHinweise) ? d.risikoHinweise : []);
	const html = arr.map(function(f) {
		if (!f) return "";
		if (typeof f === "string") return "<div class=\"flag\"><span class=\"flag-icon warn\">⚠</span><span class=\"flag-text\">" + escapeHtml(f) + "</span></div>";
		const typ = f.typ || f.type || f.status || "warn";
		const text = f.text || f.hinweis || f.beschreibung || f.value || "";
		if (!text) return "";
		const kat = f.kategorie || f.category || f.kat || "";
		const icon = typ === "ok" ? "✓" : typ === "bad" ? "✕" : "⚠";
		const katLabel = kat ? "<b>[" + escapeHtml(kat) + "]</b> " : "";
		return "<div class=\"flag\"><span class=\"flag-icon " + typ + "\">" + icon + "</span><span class=\"flag-text\">" + katLabel + escapeHtml(text) + "</span></div>";
	}).filter(Boolean).join("");
	return "<div class=\"flags-card\"><div class=\"flags-heading\"><span class=\"sec-icon\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#16A34A\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z\"/></svg></span>Risiko-Hinweise</div>" + (html || "<div class=\"flag\"><span class=\"flag-icon warn\">⚠</span><span class=\"flag-text\">Keine spezifischen Risiko-Hinweise.</span></div>") + "</div>";
}
function buildKontaktAkte(d) {
	const k = d.kontakt || {};
	const cell = function(label, val) {
		return "<div class=\"cc\"><div class=\"cc-label\">" + label + "</div>" + (isNA(val) ? "<span class=\"cc-value na\">N/A</span>" : "<div class=\"cc-value\">" + escapeHtml(val) + "</div>") + "</div>";
	};
	return "<div class=\"contact-card\"><div class=\"contact-header\"><div class=\"sec-title\">" + catIcon("Kontakt & Online") + "Kontaktdaten &amp; Online-Präsenz<span class=\"sec-weight\">20%</span></div>" + miniScore(k.score) + "</div><div class=\"contact-grid\">" + cell("Website", k.website) + cell("E-Mail", k.email) + cell("Telefon", k.telefon) + cell("LinkedIn", k.linkedinAktiv ? k.linkedinUrl || "Vorhanden" : "N/A") + cell("Social Media", k.socialMedia) + "</div></div>";
}
function buildAkteAnalyse(d) {
	d = d || {};
	const meta = [];
	if (d.datum) meta.push(escapeHtml(d.datum));
	if (d._land) meta.push("Land: " + escapeHtml(d._land));
	if (sitzMeta(d)) meta.push(sitzMeta(d));
	if (d.ustId && d.ustId !== "null") meta.push("USt-ID: " + escapeHtml(d.ustId));
	if (d._standort) meta.push("Eigener Standort: " + escapeHtml(d._standort));
	if (d.pruefId) meta.push("Prüf-ID: " + escapeHtml(d.pruefId));
	if (d._email) meta.push("Geprüft von " + escapeHtml(d._email));
	const score = typeof d.gesamtScore === "number" ? d.gesamtScore : null;
	const vIcon = d.verdict === "ok" ? "✓" : d.verdict === "bad" ? "✕" : "⚠";
	return "<div class=\"akte-analyse\">" + "<div class=\"akte-firm-head\">" + "<div><div class=\"report-eyebrow\">Compliance-Auswertung · §§ 10–17 GwG</div>" + "<div class=\"report-name\">" + escapeHtml(nameAnzeige(d.firmenname, d.firmennameOriginal).haupt || "Unbekanntes Unternehmen") + "</div>" + nameOriginalHTML(nameAnzeige(d.firmenname, d.firmennameOriginal)) + "<div class=\"report-meta\">" + meta.join(" · ") + "</div></div>" + "<div class=\"akte-score-box\"><div class=\"gauge-wrap\">" + gauge(score) + "<div class=\"gauge-num\"><span class=\"gauge-num-val\" style=\"color:" + (score ? scC(score) : "var(--gray-l)") + "\">" + (score == null ? "N/A" : score) + "</span><span class=\"gauge-num-label\">" + (score != null ? "/ 100" : "") + "</span></div></div>" + "<span class=\"verdict " + (d.verdict || "warn") + "\">" + vIcon + " " + escapeHtml(d.verdictText || "") + "</span></div>" + "</div>" + hochrisikoBlockHTML(d) + sitzKarteHTML(d) + "<div class=\"grid4\">" + secCard("Grunddaten", d.grunddaten || { felder: [] }, "30%") + secCard("Personen", d.personen || { felder: [] }, "30%") + secCard("Reputation", d.reputation || { felder: [] }, "5%") + secCard("Finanzen", d.finanzen || { felder: [] }, "15%") + "</div>" + phantomHTML(d) + insolvenzHTML(d) + buildKontaktAkte(d) + sanktionenAkteHtml(d) + buildFlagsHTML(d) + "<div class=\"rec-card\"><div class=\"rec-label\">Compliance-Empfehlung</div><div class=\"rec-text\">" + escapeHtml(d.empfehlung || "") + "</div></div>" + "</div>";
}
function buildAkteWatermark(folderName) {
	const el = document.getElementById("printWatermark");
	if (!el) return;
	el.innerHTML = wasserzeichenHTML(DT().ordner + ": " + (folderName || ""), CURRENT_USER_EMAIL || "");
}
function akteDrucken(folderId) {
	mitAusBlende(function() {
		_akteDrucken(folderId);
	});
}
var ORDNER_DRUCK_ABBRUCH = false;
var ORDNER_DRUCK_ID = null;
async function akteDruckBereit(analyseId, maxMs) {
	const start = Date.now();
	let letzte = "", stabilSeit = Date.now();
	await ordnerWarte(1200);
	while (Date.now() - start < maxMs) {
		if (ORDNER_DRUCK_ABBRUCH) return false;
		const rep = document.getElementById("report");
		const bilder = rep ? Array.prototype.slice.call(rep.querySelectorAll("img")) : [];
		const offen = bilder.filter(function(i) {
			return !i.complete;
		}).length;
		let pdfOffen = 0;
		try {
			pdfOffen = pdfAnlagenOffen("gesamt") || 0;
		} catch (e) {}
		const kycDa = typeof KYC !== "undefined" && KYC;
		const kycPasst = !analyseId || kycDa && KYC.analyseId === analyseId || Date.now() - start > 8e3 && (!kycDa || !KYC.analyseId);
		const sig = (rep ? rep.innerHTML.length : 0) + "|" + bilder.length;
		if (sig !== letzte) {
			letzte = sig;
			stabilSeit = Date.now();
		}
		if (!offen && !pdfOffen && kycPasst && Date.now() - stabilSeit > 1500) return true;
		await ordnerWarte(300);
	}
	return false;
}
function ordnerAkteAbschnitt(r, vollstaendig) {
	const d = r.report_json || {};
	const rep = document.getElementById("report");
	const sec = document.createElement("section");
	sec.className = "ordner-akte";
	if (r.id) sec.setAttribute("data-analyse-id", r.id);
	const name = d.firmenname || r.firmenname || "";
	const pid = d.pruefId || r.pruef_id || "";
	let kopf = "";
	if (!r.abgeschlossen_am) {
		kopf += "<div class=\"ordner-entwurf\"><b>⚠ ENTWURF – AKTE NICHT ABGESCHLOSSEN</b> · " + escapeHtml(name) + (pid ? " · " + escapeHtml(pid) : "") + "<br/>Dieser Ausdruck zeigt einen vorläufigen Stand. Verbindlich ist erst die abgeschlossene Akte.</div>";
	}
	if (!vollstaendig) {
		kopf += "<div class=\"ordner-hinweis\">Hinweis: Einzelne Inhalte dieser Akte (z. B. Bilder oder Anlagen) konnten nicht rechtzeitig geladen werden. " + "Bitte die Akte einzeln über „Gesamte Akte als PDF“ drucken.</div>";
	}
	if (kopf) sec.insertAdjacentHTML("beforeend", kopf);
	if (rep) {
		const kopie = kloneMitOriginal(rep);
		const orig = rep.querySelectorAll("canvas"), ziel = kopie.querySelectorAll("canvas");
		Array.prototype.forEach.call(orig, function(c, i) {
			try {
				const img = document.createElement("img");
				img.src = c.toDataURL("image/png");
				img.className = c.className;
				img.style.cssText = c.style.cssText;
				ziel[i].replaceWith(img);
			} catch (e) {}
		});
		Array.prototype.forEach.call(kopie.querySelectorAll("*"), function(el) {
			Array.prototype.slice.call(el.attributes).forEach(function(a) {
				if (/^on/i.test(a.name)) el.removeAttribute(a.name);
			});
		});
		sec.appendChild(kopie);
		sec.inert = true;
		sec.setAttribute("inert", "");
	}
	return sec;
}
function ordnerDruckStatus(gesamt) {
	const alt = document.getElementById("ordnerDruckStatus");
	if (alt) alt.remove();
	const el = document.createElement("div");
	el.id = "ordnerDruckStatus";
	el.className = "od-status";
	el.setAttribute("role", "status");
	el.setAttribute("aria-live", "polite");
	el.innerHTML = "<div class=\"od-status-karte\"><span class=\"neu-spin\"></span><div class=\"od-status-txt\">" + "<b>Ordner wird als PDF vorbereitet …</b><small id=\"odStatusText\">Akte 1 von " + gesamt + "</small>" + "<div class=\"od-status-balken\"><i id=\"odStatusBalken\"></i></div>" + "<small class=\"od-status-info\">Jede Akte wird vollständig aufgebaut – mit Fotos, Dokumenten und Sanktionsabgleich. Das dauert einige Sekunden pro Akte.</small></div>" + "<button type=\"button\" class=\"od-status-x\" data-act-click=\"h273\">Abbrechen</button></div>";
	document.body.appendChild(el);
	return {
		setze: function(i, n, name) {
			const t = document.getElementById("odStatusText"), b = document.getElementById("odStatusBalken");
			if (t) t.textContent = "Akte " + (i + 1) + " von " + n + (name ? ": " + name : "");
			if (b) b.style.width = Math.round(i / n * 100) + "%";
		},
		weg: function() {
			const x = document.getElementById("ordnerDruckStatus");
			if (x) x.remove();
		}
	};
}
async function _akteDrucken(folderId) {
	const folder = ORDNER_LIST.find(function(o) {
		return o.id === folderId;
	});
	if (!folder) {
		alert("Ordner nicht gefunden.");
		return;
	}
	try {
		await historieAlleLaden();
	} catch (e) {
		alert("Akten konnten nicht vollständig geladen werden. Bitte erneut versuchen.");
		return;
	}
	const rows = HISTORY_ROWS.filter(function(r) {
		return r.ordner_id === folderId && r.report_json;
	});
	if (!rows.length) {
		alert("Dieser Ordner enthält keine Prüfungen zum Exportieren.");
		return;
	}
	const av = document.getElementById("akteView");
	const main = document.getElementById("mainView"), hv = document.getElementById("historyView"), tv = document.getElementById("teamView");
	ORDNER_DRUCK_ABBRUCH = false;
	ORDNER_DRUCK_ID = folderId;
	const status = ordnerDruckStatus(rows.length);
	const abschnitte = [];
	for (let i = 0; i < rows.length; i++) {
		if (ORDNER_DRUCK_ABBRUCH) break;
		const r = rows[i];
		status.setze(i, rows.length, r.report_json && r.report_json.firmenname || r.firmenname || "");
		try {
			await _openFromHistory(HISTORY_ROWS.indexOf(r));
			const fertig = await akteDruckBereit(r.id, 3e4);
			if (ORDNER_DRUCK_ABBRUCH) break;
			abschnitte.push(ordnerAkteAbschnitt(r, fertig));
		} catch (e) {
			console.warn("Ordner-PDF:", e && e.message);
			const sec = document.createElement("section");
			sec.className = "ordner-akte";
			sec.innerHTML = "<div class=\"ordner-hinweis\">Die Akte „" + escapeHtml(r.report_json && r.report_json.firmenname || r.firmenname || "") + "“ konnte nicht aufgebaut werden. Bitte einzeln drucken.</div>";
			abschnitte.push(sec);
		}
	}
	status.weg();
	if (ORDNER_DRUCK_ABBRUCH) {
		try {
			openHistory();
		} catch (e) {}
		return;
	}
	const heute = new Date().toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric"
	});
	const firma = CURRENT_FIRMA && CURRENT_FIRMA.firma_name ? CURRENT_FIRMA.firma_name : "";
	const toc = rows.map(function(r, i) {
		const d = r.report_json || {};
		const sc0 = typeof d.gesamtScore === "number" ? d.gesamtScore : typeof r.score === "number" ? r.score : null;
		const sc = anzeigeDeckelWert(sc0, d, null);
		return "<div class=\"akte-toc-row\"><span>" + (i + 1) + ". " + escapeHtml(nameAnzeige(d.firmenname || r.firmenname, d.firmennameOriginal).haupt || "—") + " <em class=\"akte-toc-st " + (r.abgeschlossen_am ? "zu" : "offen") + "\">" + (r.abgeschlossen_am ? "abgeschlossen" : "offen") + "</em></span>" + "<span class=\"akte-toc-id\">" + escapeHtml(d.pruefId || r.pruef_id || "") + "</span>" + "<span class=\"akte-toc-score\" style=\"color:" + (sc ? scC(sc) : "var(--gray-l)") + "\">" + (sc == null ? "N/A" : sc) + "</span></div>";
	}).join("");
	const cover = "<div class=\"akte-cover\">" + "<div class=\"akte-cover-eyebrow\">Compliance-Akten · §§ 10–17 GwG</div>" + "<div class=\"akte-cover-title\">" + escapeHtml(folder.name) + "</div>" + "<div class=\"akte-cover-meta\">" + (firma ? "Unternehmen: " + escapeHtml(firma) + " · " : "") + "Erstellt am " + heute + (CURRENT_USER_EMAIL ? " von " + escapeHtml(CURRENT_USER_EMAIL) : "") + "</div>" + "<div class=\"akte-cover-count\">" + rows.length + " " + (rows.length === 1 ? "Akte" : "Akten") + " in diesem Ordner</div>" + "<div class=\"akte-toc\"><div class=\"akte-toc-head\">Inhalt</div>" + toc + "</div>" + "</div>";
	const actions = "<div class=\"akte-actions\">" + "<button class=\"btn-action primary\" data-act-click=\"h274\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><polyline points=\"6 9 6 2 18 2 18 9\"/><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\"/><rect x=\"6\" y=\"14\" width=\"12\" height=\"8\"/></svg>Drucken / Als PDF speichern</button>" + "<button class=\"btn-action\" data-act-click=\"h94\"><svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M19 12H5M12 19l-7-7 7-7\"/></svg>Zurück</button>" + "</div>";
	if (main) main.style.display = "none";
	if (hv) hv.style.display = "none";
	if (tv) tv.style.display = "none";
	setDRUCK_NAME(folder && folder.name ? folder.name : "Ordner");
	setDRUCK_ID("");
	av.innerHTML = actions.replace("data-act-click=\"h94\"", "data-act-click=\"h62\"") + cover;
	abschnitte.forEach(function(sec) {
		av.appendChild(sec);
	});
	av.style.display = "block";
	fadeInView(av);
	buildAkteWatermark(folder.name);
	window.scrollTo({
		top: 0,
		behavior: "auto"
	});
}
registriere("h0", function(event) {
	toggleLang();
});
registriere("h1", function(event) {
	toggleHelp();
});
registriere("h2", function(event) {
	chatNeu();
});
registriere("h3", function(event) {
	chatTorPruefen();
});
registriere("h4", function(event) {
	event.preventDefault();
	event.stopPropagation();
	openLegal("datenschutz");
});
registriere("h5", function(event) {
	chatTorOk();
});
registriere("h6", function(event) {
	chatScrollGeprueft();
});
registriere("h7", function(event) {
	chatNachUnten(true);
});
registriere("h8", function(event) {
	chatTaste(event);
});
registriere("h9", function(event) {
	chatFeldHoehe(this);
});
registriere("h10", function(event) {
	chatSenden();
});
registriere("h11", function(event) {
	openLegal("datenschutz");
});
registriere("h12", function(event) {
	infoSchliessen();
});
registriere("h13", function(event) {
	landingStart("login");
});
registriere("h14", function(event) {
	landingStart("register");
});
registriere("h15", function(event) {
	infoOeffnen("bewertung");
});
registriere("h16", function(event) {
	infoOeffnen("quellen");
});
registriere("h17", function(event) {
	demoStart();
});
registriere("h18", function(event) {
	lpSpringe("lpVorteile");
});
registriere("h19", function(event) {
	lpSpringe("lpAblauf");
});
registriere("h20", function(event) {
	lpSpringe("lpAkte");
});
registriere("h21", function(event) {
	lpSpringe("lpMonitoring");
});
registriere("h22", function(event) {
	lpSpringe("lpSanktionen");
});
registriere("h23", function(event) {
	lpSpringe("lpPreise");
});
registriere("h24", function(event) {
	lpSpringe("lpFuerWen");
});
registriere("h25", function(event) {
	openLegal("impressum");
});
registriere("h26", function(event) {
	openLegal("agb");
});
registriere("h27", function(event) {
	pwAuge("authPassword", this);
});
registriere("h28", function(event) {
	doAuth();
});
registriere("h29", function(event) {
	passwortVergessen();
});
registriere("h30", function(event) {
	toggleAuthMode();
});
registriere("h31", function(event) {
	obWaehle("firma");
});
registriere("h32", function(event) {
	obWaehle("einzel");
});
registriere("h33", function(event) {
	obFirmaTab("neu");
});
registriere("h34", function(event) {
	obFirmaTab("bei");
});
registriere("h35", function(event) {
	obFirmaAnlegen();
});
registriere("h36", function(event) {
	obFirmaBeitreten();
});
registriere("h37", function(event) {
	obZurueck();
});
registriere("h38", function(event) {
	obFertig();
});
registriere("h39", function(event) {
	obEinladungAnnehmen();
});
registriere("h40", function(event) {
	obEinzelAnlegen();
});
registriere("h41", function(event) {
	doLogout();
});
registriere("h42", function(event) {
	zumTool();
});
registriere("h43", function(event) {
	codeEinloesen();
});
registriere("h44", function(event) {
	hidePlaeneBack();
});
registriere("h45", function(event) {
	ladeKontingent();
});
registriere("h46", function(event) {
	clearPendingPayment();
	hideZahlungGate();
	zeigePlaene("start");
});
registriere("h47", function(event) {
	kontoNameSpeichern();
});
registriere("h48", function(event) {
	sanktionenJetztLaden();
});
registriere("h49", function(event) {
	kontoBeitreten();
});
registriere("h50", function(event) {
	zuUnternehmenWechseln();
});
registriere("h51", function(event) {
	pwAuge("kontoPw1", this);
});
registriere("h52", function(event) {
	kontoPwSpeichern();
});
registriere("h53", function(event) {
	exportiereDaten();
});
registriere("h54", function(event) {
	apiSchluesselErzeugen();
});
registriere("h55", function(event) {
	kontoLoeschenSchritt1();
});
registriere("h56", function(event) {
	kontoLoeschenAbbrechen();
});
registriere("h57", function(event) {
	kontoLoeschenFinal();
});
registriere("h58", function(event) {
	closeKonto();
});
registriere("h59", function(event) {
	closeLegal();
});
registriere("h60", function(event) {
	neuigkeitenZeigen();
});
registriere("h61", function(event) {
	zeigePlaene("upgrade");
});
registriere("h62", function(event) {
	openHistory();
});
registriere("h63", function(event) {
	openTeam();
});
registriere("h64", function(event) {
	supportCenterOeffnen();
});
registriere("h65", function(event) {
	openKonto();
});
registriere("h66", function(event) {
	landFilter();
});
registriere("h67", function(event) {
	landClose();
});
registriere("h68", function(event) {
	landKey(event);
});
registriere("h69", function(event) {
	odToggle();
});
registriere("h70", function(event) {
	odFiltern();
});
registriere("h71", function(event) {
	odTaste(event);
});
registriere("h72", function(event) {
	odZu();
	openHistory();
	setTimeout(function() {
		try {
			toggleOrdnerVerwalten();
		} catch (e) {}
	}, 500);
});
registriere("h73", function(event) {
	startSearch();
});
registriere("h74", function(event) {
	chatVorschlag(Number(this.dataset.a0));
});
registriere("h75", function(event) {
	chatKopieren(Number(this.dataset.a0), this);
});
registriere("h76", function(event) {
	if (event.key === "Enter") pwSpeichern();
});
registriere("h77", function(event) {
	pwAuge("pwNeu1", this);
});
registriere("h78", function(event) {
	pwAuge("pwNeu2", this);
});
registriere("h79", function(event) {
	pwSpeichern();
});
registriere("h80", function(event) {
	pwFertig();
});
registriere("h81", function(event) {
	entfGateZu();
});
registriere("h82", function(event) {
	favEntfernen(this.dataset.a0, event);
});
registriere("h83", function(event) {
	favCheckGeaendert();
});
registriere("h84", function(event) {
	favDlgSchliessen(false);
});
registriere("h85", function(event) {
	favDlgSchliessen(true);
});
registriere("h86", function(event) {
	bearbeitenStart();
});
registriere("h87", function(event) {
	bearbeitenAbbruch();
});
registriere("h88", function(event) {
	neuBewerten();
});
registriere("h89", function(event) {
	feldBearbeiten(this.dataset.a0, event);
});
registriere("h90", function(event) {
	feldTaste(event, this.dataset.a0);
});
registriere("h91", function(event) {
	feldAbbruch(this.dataset.a0);
});
registriere("h92", function(event) {
	feldUebernehmen(this.dataset.a0);
});
registriere("h93", function(event) {
	monAusBericht(this.dataset.pid, this);
});
registriere("h94", function(event) {
	backToMain();
});
registriere("h95", function(event) {
	rangAendern(this.dataset.a0, this.value, this);
});
registriere("h96", function(event) {
	teamAktion("entfernen", this.dataset.a0);
});
registriere("h97", function(event) {
	einladungErstellen();
});
registriere("h98", function(event) {
	sdTabZeigen(this.dataset.a0);
});
registriere("h99", function(event) {
	sdSchliessen();
});
registriere("h100", function(event) {
	sdZeitraum(Number(this.dataset.a0));
});
registriere("h101", function(event) {
	sdInternSetzen(this.checked);
});
registriere("h102", function(event) {
	sdLaden(true);
});
registriere("h103", function(event) {
	sdDrawerZu();
});
registriere("h104", function(event) {
	sdAlleZeigen();
});
registriere("h105", function(event) {
	sdHinweisOeffnen(this.dataset.a0, this.dataset.a1);
});
registriere("h106", function(event) {
	sdAusblenden(this.dataset.a0);
});
registriere("h107", function(event) {
	SD.tabelle = !SD.tabelle;
	sdRender();
});
registriere("h108", function(event) {
	sdTabZeigen("aktivitaet");
});
registriere("h109", function(event) {
	sdFirmaOeffnen(this.dataset.a0);
});
registriere("h110", function(event) {
	sdSortieren(this.dataset.a0);
});
registriere("h111", function(event) {
	SD.filter = this.dataset.a0;
	sdRender();
});
registriere("h112", function(event) {
	SD.suche = this.value;
	sdKundenNeu();
});
registriere("h113", function(event) {
	if (event.key === "Enter") sdFirmaOeffnen(this.dataset.a0);
});
registriere("h114", function(event) {
	sdFirmaSpeichern(this.dataset.a0, this);
});
registriere("h115", function(event) {
	supBeitreten(this.dataset.a0);
});
registriere("h116", function(event) {
	supRang(this.dataset.a0, this.value);
});
registriere("h117", function(event) {
	supPasswort(this.dataset.a0, this);
});
registriere("h118", function(event) {
	supBestaetigen(this.dataset.a0);
});
registriere("h119", function(event) {
	supSucheLauf();
});
registriere("h120", function(event) {
	SD.aktSuche = this.value;
	sdAktNeu();
});
registriere("h121", function(event) {
	codeKopieren(this);
});
registriere("h122", function(event) {
	teamVerlassenFrage();
});
registriere("h123", function(event) {
	verlGateZu();
});
registriere("h124", function(event) {
	teamVerlassen();
});
registriere("h125", function(event) {
	paketHinweisWeg();
});
registriere("h126", function(event) {
	mailSpracheWaehlen("de");
});
registriere("h127", function(event) {
	mailSpracheWaehlen("en");
});
registriere("h128", function(event) {
	mailTextKopieren(this);
});
registriere("h129", function(event) {
	mailOeffnen();
});
registriere("h130", function(event) {
	mailGateZu();
});
registriere("h131", function(event) {
	this.select();
});
registriere("h132", function(event) {
	einlKopieren(this);
});
registriere("h133", function(event) {
	mailEinladung(this.dataset.a0);
});
registriere("h134", function(event) {
	einlWiderrufen(this.dataset.a0);
});
registriere("h135", function(event) {
	odWaehlen("auto");
});
registriere("h136", function(event) {
	odWaehlen("");
});
registriere("h137", function(event) {
	odWaehlen(this.dataset.a0);
});
registriere("h138", function(event) {
	uploadEntfernen(this.dataset.a0, Number(this.dataset.a1));
});
registriere("h139", function(event) {
	uploadDateiWahl(this.dataset.a0, this.files);
});
registriere("h140", function(event) {
	event.preventDefault();
	this.classList.add("drag");
});
registriere("h141", function(event) {
	this.classList.remove("drag");
});
registriere("h142", function(event) {
	uploadDrop(event, this.dataset.a0);
});
registriere("h143", function(event) {
	uploadPick(this.dataset.a0, false);
});
registriere("h144", function(event) {
	uploadPick(this.dataset.a0, true);
});
registriere("h145", function(event) {
	uploadGewaehlt(this.dataset.a0, this);
});
registriere("h146", function(event) {
	uploadBestaetigen();
});
registriere("h147", function(event) {
	einwilligungGeaendert();
});
registriere("h148", function(event) {
	einwilligungDetails();
});
registriere("h149", function(event) {
	uploadWarnungZu();
});
registriere("h150", function(event) {
	uploadAbsenden();
});
registriere("h151", function(event) {
	landingStart("register", this.dataset.a0);
});
registriere("h152", function(event) {
	demoWaehlen(Number(this.dataset.a0));
});
registriere("h153", function(event) {
	paketWaehlen(this.dataset.a0);
});
registriere("h154", function(event) {
	obEinladungVerwerfen();
});
registriere("h155", function(event) {
	firmaGewaehlt(Number(this.dataset.a0));
});
registriere("h156", function(event) {
	firmaEigene();
});
registriere("h157", function(event) {
	firmaAbbruch();
});
registriere("h158", function(event) {
	dupNeuePruefung();
});
registriere("h159", function(event) {
	dupOeffnen();
});
registriere("h160", function(event) {
	druckStatus(null);
});
registriere("h161", function(event) {
	druckGateZu();
});
registriere("h162", function(event) {
	inSafariOeffnen();
});
registriere("h163", function(event) {
	landPick(this.textContent);
});
registriere("h164", function(event) {
	apiSchluesselWiderrufen(this.dataset.a0, this);
});
registriere("h165", function(event) {
	apiKopieren();
});
registriere("h166", function(event) {
	btAntwort(false);
});
registriere("h167", function(event) {
	btAntwort(true);
});
registriere("h168", function(event) {
	startDoksEntfernen(this.dataset.a0, Number(this.dataset.a1));
});
registriere("h169", function(event) {
	startDoksDrop(event, this.dataset.a0);
});
registriere("h170", function(event) {
	startDoksPick(this.dataset.a0);
});
registriere("h171", function(event) {
	startDoksDateien(this.dataset.a0, this.files);
	this.value = "";
});
registriere("h172", function(event) {
	neuigkeitenSchliessen();
});
registriere("h173", function(event) {
	brancheWaehlen(this.dataset.a0, this);
});
registriere("h174", function(event) {
	brancheSpeichern(this.dataset.a0);
});
registriere("h175", function(event) {
	akteAnsicht(this.dataset.a0);
});
registriere("h176", function(event) {
	akteWiederOeffnen();
});
registriere("h177", function(event) {
	nwNeuBewerten();
});
registriere("h178", function(event) {
	druckeJetzt("gesamt");
});
registriere("h179", function(event) {
	location.reload();
});
registriere("h180", function(event) {
	endverbleibErforderlich();
});
registriere("h181", function(event) {
	evSpracheWaehlen("de", this);
});
registriere("h182", function(event) {
	evSpracheWaehlen("en", this);
});
registriere("h183", function(event) {
	endverbleibDrucken();
});
registriere("h184", function(event) {
	evBestaetigtAendern(this);
});
registriere("h185", function(event) {
	return evUploadErlaubt(event);
});
registriere("h186", function(event) {
	if (evUploadErlaubt()) endverbleibHochladen(this.files);
	this.value = "";
});
registriere("h187", function(event) {
	endverbleibNichtErforderlich();
});
registriere("h188", function(event) {
	evAblageDragOver(event);
});
registriere("h189", function(event) {
	this.classList.remove("drag");
});
registriere("h190", function(event) {
	evAblageDrop(event);
});
registriere("h191", function(event) {
	evAblageKlick(event);
});
registriere("h192", function(event) {
	if (event.key === "Enter" || event.key === " ") {
		event.preventDefault();
		evAblageKlick(event);
	}
});
registriere("h193", function(event) {
	dokDrehenTyp("endverbleib", Number(this.dataset.a0), event);
});
registriere("h194", function(event) {
	return dokAnsehenTyp("endverbleib", Number(this.dataset.a0), event);
});
registriere("h195", function(event) {
	endverbleibLoeschen(Number(this.dataset.a0));
});
registriere("h196", function(event) {
	document.getElementById("abBtn").disabled = !this.checked;
});
registriere("h197", function(event) {
	akteAbschliessen();
});
registriere("h198", function(event) {
	nwDragOver(event);
});
registriere("h199", function(event) {
	nwDragLeave(event);
});
registriere("h200", function(event) {
	nwDrop(event);
});
registriere("h201", function(event) {
	nwModus();
});
registriere("h202", function(event) {
	nwTab("aufnahmen");
});
registriere("h203", function(event) {
	nwTab("dokumente");
});
registriere("h204", function(event) {
	nwWaehlen(this.files);
});
registriere("h205", function(event) {
	nwModus(true);
});
registriere("h206", function(event) {
	return dokAnsehenTyp(this.dataset.a0, Number(this.dataset.a1), event);
});
registriere("h207", function(event) {
	dokDrehenTyp(this.dataset.a0, Number(this.dataset.a1), event);
});
registriere("h208", function(event) {
	nwUmbenennen("standort", Number(this.dataset.a0), this);
});
registriere("h209", function(event) {
	nwNameTaste(event);
});
registriere("h210", function(event) {
	nwLoeschen("standort", Number(this.dataset.a0));
});
registriere("h211", function(event) {
	nwUmbenennen("beleg", Number(this.dataset.a0), this);
});
registriere("h212", function(event) {
	nwLoeschen("beleg", Number(this.dataset.a0));
});
registriere("h213", function(event) {
	weitereBilderLaden();
});
registriere("h214", function(event) {
	googleBilderNachladen(this);
});
registriere("h215", function(event) {
	googleLeisteSchliessen();
});
registriere("h216", function(event) {
	googleErneutPruefen(this);
});
registriere("h217", function(event) {
	kycAnsehenEin(this.dataset.a0, Number(this.dataset.a1));
});
registriere("h218", function(event) {
	kycLoeschenEin(this.dataset.a0, Number(this.dataset.a1));
});
registriere("h219", function(event) {
	kycDateienWaehlen(this.dataset.a0, this.files);
});
registriere("h220", function(event) {
	kycBoxWahl(this.dataset.a0, event);
});
registriere("h221", function(event) {
	kycDrop(event, this.dataset.a0);
});
registriere("h222", function(event) {
	kycDateienWaehlen(this.dataset.a0, this.files);
	this.value = "";
});
registriere("h223", function(event) {
	kycLaden();
});
registriere("h224", function(event) {
	kycLinkKopieren();
});
registriere("h225", function(event) {
	mailUploadLink();
});
registriere("h226", function(event) {
	kycLinkNeu();
});
registriere("h227", function(event) {
	dokDrehen(DOK_VIEWER && DOK_VIEWER.pfad);
});
registriere("h228", function(event) {
	dokViewerZu();
});
registriere("h229", function(event) {
	dokViewerLayout();
});
registriere("h230", function(event) {
	neuStatus(null);
});
registriere("h231", function(event) {
	akteAnsicht("analyse");
});
registriere("h232", function(event) {
	histSuche();
});
registriere("h233", function(event) {
	toggleOrdnerVerwalten();
});
registriere("h234", function(event) {
	setHistoryFilter("alle");
});
registriere("h235", function(event) {
	setHistoryFilter("ohne");
});
registriere("h236", function(event) {
	setHistoryFilter("__geteilt");
});
registriere("h237", function(event) {
	setHistoryFilter("__fav");
});
registriere("h238", function(event) {
	setHistoryFilter("__privat");
});
registriere("h239", function(event) {
	setPruefer(this.value);
});
registriere("h240", function(event) {
	setStandortFilter(this.value);
});
registriere("h241", function(event) {
	sternHinweisZu();
});
registriere("h242", function(event) {
	openFromHistory(Number(this.dataset.a0));
});
registriere("h243", function(event) {
	favToggle(event, this.dataset.pid);
});
registriere("h244", function(event) {
	moveAnalyse(this.dataset.pid, this.value);
	this.value = "";
});
registriere("h245", function(event) {
	akteDrucken(this.dataset.a0);
});
registriere("h246", function(event) {
	setHistorySort(this.value);
});
registriere("h247", function(event) {
	historieMehrKlick(this);
});
registriere("h248", function(event) {
	ordnerNavWahl(this.dataset.a0);
});
registriere("h249", function(event) {
	ordnerNavSuche(this.value);
});
registriere("h250", function(event) {
	ordnerRegalNeu();
});
registriere("h251", function(event) {
	ordnerNavUmschalten();
});
registriere("h252", function(event) {
	ordnerFarbe(this.dataset.a0, this.dataset.a1);
});
registriere("h253", function(event) {
	ordnerUmbenennen(this.dataset.a0, this.value);
});
registriere("h254", function(event) {
	ordnerSichtbarkeit(this.dataset.a0, this.dataset.a1);
});
registriere("h255", function(event) {
	freigabeOeffnen(this.dataset.a0);
});
registriere("h256", function(event) {
	ordnerLoeschen(this.dataset.a0);
});
registriere("h257", function(event) {
	if (event.key === "Enter") ordnerAnlegenVerwaltung();
});
registriere("h258", function(event) {
	ordnerAnlegenVerwaltung();
});
registriere("h259", function(event) {
	gruppeMitgliederOeffnen(this.dataset.a0);
});
registriere("h260", function(event) {
	gruppeUmbenennen(this.dataset.a0);
});
registriere("h261", function(event) {
	gruppeLoeschen(this.dataset.a0);
});
registriere("h262", function(event) {
	if (event.key === "Enter") {
		gruppeAnlegen();
	}
});
registriere("h263", function(event) {
	grFarbeWahl(this);
});
registriere("h264", function(event) {
	gruppeAnlegen();
});
registriere("h265", function(event) {
	gmZaehlen();
});
registriere("h266", function(event) {
	gruppeMitgliederSchliessen();
});
registriere("h267", function(event) {
	gruppeMitgliederSpeichern();
});
registriere("h268", function(event) {
	fgZaehlen();
});
registriere("h269", function(event) {
	freigabeSchliessen();
});
registriere("h270", function(event) {
	freigabeSpeichern();
});
registriere("h271", function(event) {
	neuZugriff(this.dataset.a0);
});
registriere("h272", function(event) {
	neuGruppeUmschalten(this.dataset.a0);
});
registriere("h273", function(event) {
	ORDNER_DRUCK_ABBRUCH = true;
	this.disabled = true;
	this.textContent = "Wird abgebrochen …";
});
registriere("h274", function(event) {
	druckeJetzt();
});
registriere("hDruckHaupt", function(event) {
	var w = this.dataset.a0;
	if (w === "endverbleibDrucken()") {
		endverbleibDrucken();
		return;
	}
	var m = /^druckeJetzt\('([a-z]+)'\)$/.exec(w);
	if (m) druckeJetzt(m[1]);
});

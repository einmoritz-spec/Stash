// ═══════════════════════════════════════════════════════════════
// Vorrat – App-Logik
// ═══════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, doc, getDoc, setDoc, addDoc,
  updateDoc, deleteDoc, collection, query, where, limit, getDocs,
  onSnapshot, serverTimestamp, runTransaction, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ───────────────────────── Firebase Setup ─────────────────────────
const firebaseApp = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(firebaseApp);
const db = initializeFirestore(firebaseApp, { localCache: persistentLocalCache({}) });

// ───────────────────────── Eingebauter Katalog ─────────────────────────
// Dient nur als Vorschlag/Kategorie-Rateshilfe beim Anlegen neuer Artikel.
// Wird nicht automatisch gespeichert.
const CATALOG = [
  ["Milch","essen","Liter"],["Butter","essen","Packung"],["Eier","essen","10er Pack"],
  ["Käse","essen","Packung"],["Joghurt","essen","Becher"],["Brot","essen","Laib"],
  ["Mehl","essen","kg"],["Zucker","essen","kg"],["Salz","essen","Packung"],
  ["Nudeln","essen","Packung"],["Reis","essen","Packung"],["Kaffee","essen","Packung"],
  ["Tee","essen","Packung"],["Öl","essen","Flasche"],["Essig","essen","Flasche"],
  ["Honig","essen","Glas"],["Marmelade","essen","Glas"],["Ketchup","essen","Flasche"],
  ["Senf","essen","Tube"],["Mayonnaise","essen","Glas"],["Tomaten (Dose)","essen","Dose"],
  ["Passierte Tomaten","essen","Packung"],["Thunfisch","essen","Dose"],["Kichererbsen","essen","Dose"],
  ["Kartoffeln","essen","kg"],["Zwiebeln","essen","kg"],["Knoblauch","essen","Stück"],
  ["Äpfel","essen","kg"],["Bananen","essen","kg"],["Zitronen","essen","Stück"],
  ["Orangensaft","essen","Liter"],["Wasser","essen","Kiste"],["Bier","essen","Kiste"],
  ["Wein","essen","Flasche"],["Schokolade","essen","Tafel"],["Kekse","essen","Packung"],
  ["Müsli","essen","Packung"],["Haferflocken","essen","Packung"],["Backpulver","essen","Packung"],
  ["Tiefkühlgemüse","essen","Packung"],["Hackfleisch","essen","kg"],["Hähnchenbrust","essen","kg"],
  ["Frischkäse","essen","Packung"],["Sahne","essen","Becher"],
  ["Klopapier","haushalt","Packung"],["Küchenrolle","haushalt","Rolle"],
  ["Spülmittel","haushalt","Flasche"],["Spülmaschinentabs","haushalt","Packung"],
  ["Waschmittel","haushalt","Packung"],["Weichspüler","haushalt","Flasche"],
  ["Müllbeutel","haushalt","Rolle"],["Gefrierbeutel","haushalt","Packung"],
  ["Alufolie","haushalt","Rolle"],["Frischhaltefolie","haushalt","Rolle"],
  ["Backpapier","haushalt","Rolle"],["Batterien","haushalt","Packung"],
  ["Zahnpasta","haushalt","Tube"],["Duschgel","haushalt","Flasche"],
  ["Shampoo","haushalt","Flasche"],["Deo","haushalt","Stück"],
  ["Rasierklingen","haushalt","Packung"],["Seife","haushalt","Stück"],
  ["Allzweckreiniger","haushalt","Flasche"],["WC-Reiniger","haushalt","Flasche"],
  ["Glasreiniger","haushalt","Flasche"],["Kerzen","haushalt","Stück"],
  ["Feuerzeug","haushalt","Stück"],["Taschentücher","haushalt","Packung"],
  ["Wattepads","haushalt","Packung"],["Kaffeefilter","haushalt","Packung"]
].map(([name, category, unit]) => ({ name, category, unit }));

const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// ───────────────────────── State ─────────────────────────
const state = {
  user: null,
  uid: null,
  householdId: null,
  joinCode: "—",
  items: [],
  unsubItems: null,
  vorratFilter: "alle",
  pendingCheckoffs: new Map(), // itemId -> { timer }
};
let currentEditId = null;
let authMode = "login";
let toastTimer = null;
let suggestDebounce = null;

// ───────────────────────── Helpers ─────────────────────────
function $(id) { return document.getElementById(id); }

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function normalize(s) {
  return (s || "").toLowerCase().replace(/ß/g, "ss").trim();
}

function roundHalf(n) { return Math.round((n + Number.EPSILON) * 10) / 10; }

function formatQty(n) {
  const r = roundHalf(n || 0);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function itemRef(id) { return doc(db, "households", state.householdId, "items", id); }

function generateJoinCode(len = 6) {
  let out = "";
  for (let i = 0; i < len; i++) out += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  return out;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function matchScore(qRaw, nameRaw) {
  const q = normalize(qRaw), n = normalize(nameRaw);
  if (!q) return -1;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.includes(q)) return 60;
  if (q.length >= 3) {
    for (const word of n.split(" ")) {
      if (Math.abs(word.length - q.length) <= 2 && levenshtein(q, word) <= 1) return 40;
    }
  }
  return -1;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Code kopiert");
  } catch {
    showToast("Code: " + text);
  }
}

function showToast(message, onUndo) {
  clearTimeout(toastTimer);
  const el = $("toast");
  el.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = message;
  el.appendChild(span);
  if (onUndo) {
    const btn = document.createElement("button");
    btn.className = "undo-btn";
    btn.textContent = "Rückgängig";
    btn.onclick = () => { onUndo(); hideToast(); };
    el.appendChild(btn);
  }
  el.classList.remove("hidden");
  toastTimer = setTimeout(hideToast, 4000);
}
function hideToast() { $("toast").classList.add("hidden"); }

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function switchTab(tab) {
  document.querySelectorAll(".tabpanel").forEach((p) => p.classList.add("hidden"));
  $("tab-" + tab).classList.remove("hidden");
  document.querySelectorAll(".navbtn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
}

// ───────────────────────── Auth ─────────────────────────
function translateAuthError(code) {
  const map = {
    "auth/invalid-email": "Ungültige E-Mail-Adresse.",
    "auth/user-not-found": "Kein Konto mit dieser E-Mail gefunden.",
    "auth/wrong-password": "Falsches Passwort.",
    "auth/invalid-credential": "E-Mail oder Passwort ist falsch.",
    "auth/email-already-in-use": "Für diese E-Mail existiert schon ein Konto.",
    "auth/weak-password": "Das Passwort muss mindestens 6 Zeichen haben.",
    "auth/network-request-failed": "Keine Verbindung. Prüfe dein Internet.",
  };
  return map[code] || "Etwas ist schiefgelaufen. Versuch es noch einmal.";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (state.unsubItems) { state.unsubItems(); state.unsubItems = null; }
    state.householdId = null;
    state.items = [];
    showScreen("screen-auth");
    return;
  }
  state.user = user;
  state.uid = user.uid;
  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const data = userSnap.exists() ? userSnap.data() : null;
    if (data && data.householdId) {
      await enterHousehold(data.householdId);
    } else {
      showScreen("screen-household");
    }
  } catch (err) {
    console.error(err);
    showScreen("screen-household");
  }
});

async function enterHousehold(hid) {
  state.householdId = hid;
  try {
    const hSnap = await getDoc(doc(db, "households", hid));
    state.joinCode = hSnap.exists() ? hSnap.data().joinCode : "—";
  } catch {
    state.joinCode = "—";
  }
  $("account-email").textContent = state.user.email;
  $("account-code").textContent = state.joinCode;
  subscribeItems(hid);
  showScreen("screen-main");
}

// ───────────────────────── Firestore Sync ─────────────────────────
function subscribeItems(hid) {
  if (state.unsubItems) state.unsubItems();
  state.unsubItems = onSnapshot(
    collection(db, "households", hid, "items"),
    (snap) => {
      state.items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAll();
      runAutoDecrementCheck();
    },
    (err) => {
      console.error("Sync-Fehler", err);
      showToast("Sync-Problem – prüfe deine Internetverbindung");
    }
  );
}

// Baut aus den letzten Verbrauchs-Intervallen (Zeit zwischen zwei "−"-Klicks)
// die Felder, die für die Durchschnittsberechnung nötig sind.
// Erst ab 2 gemessenen Intervallen (= 3 Klicks) gibt es einen Durchschnitt.
function buildTrackingFields(cur, now) {
  const samples = Array.isArray(cur.intervalSamples) ? [...cur.intervalSamples] : [];
  if (cur.lastDecrementAt) {
    const interval = now - cur.lastDecrementAt;
    if (interval > 0) {
      samples.push(interval);
      if (samples.length > 5) samples.shift();
    }
  }
  const fields = { intervalSamples: samples, lastDecrementAt: now };
  if (samples.length >= 2) {
    fields.avgIntervalMs = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  }
  return fields;
}

async function adjustStock(itemId, delta, { track = false } = {}) {
  const ref = itemRef(itemId);
  const now = Date.now();
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const cur = snap.data();
      const next = Math.max(0, roundHalf((cur.stock || 0) + delta));
      const update = {
        stock: next,
        snoozed: false,
        updatedAt: serverTimestamp(),
        updatedBy: state.uid,
        autoLastAppliedAt: now, // jede manuelle Änderung startet die Auto-Uhr neu
      };
      if (track && delta < 0) Object.assign(update, buildTrackingFields(cur, now));
      tx.update(ref, update);
    });
  } catch (err) {
    console.error(err);
  }
}

// Prüft alle Artikel mit aktiviertem Auto-Verbrauch: Wie viele durchschnittliche
// Intervalle sind seit der letzten (echten oder automatischen) Änderung vergangen?
// Zieht entsprechend viele ganze Einheiten ab. Läuft periodisch im Hintergrund,
// nicht als Server-Cron - deshalb wirkt sie beim nächsten App-Öffnen nachträglich.
let autoDecrementRunning = false;
async function runAutoDecrementCheck() {
  if (autoDecrementRunning || !state.householdId) return;
  autoDecrementRunning = true;
  try {
    const now = Date.now();
    for (const item of state.items) {
      if (!item.autoDecrement || !item.avgIntervalMs || item.active === false) continue;
      const base = item.autoLastAppliedAt || item.lastDecrementAt;
      if (!base || (item.stock || 0) <= 0) continue;
      const units = Math.floor((now - base) / item.avgIntervalMs);
      if (units < 1) continue;

      const ref = itemRef(item.id);
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists()) return;
          const cur = snap.data();
          if (!cur.autoDecrement || !cur.avgIntervalMs) return;
          const curBase = cur.autoLastAppliedAt || cur.lastDecrementAt;
          if (!curBase) return;
          const curUnits = Math.floor((now - curBase) / cur.avgIntervalMs);
          if (curUnits < 1 || (cur.stock || 0) <= 0) return;
          const dec = Math.min(curUnits, cur.stock || 0);
          tx.update(ref, {
            stock: Math.max(0, roundHalf((cur.stock || 0) - dec)),
            autoLastAppliedAt: curBase + curUnits * cur.avgIntervalMs,
            updatedAt: serverTimestamp(),
          });
        });
      } catch (err) {
        console.error("Auto-Verbrauch fehlgeschlagen für", item.name, err);
      }
    }
  } finally {
    autoDecrementRunning = false;
  }
}

async function setStockAbsolute(itemId, value) {
  const v = Math.max(0, roundHalf(parseFloat(value) || 0));
  await updateDoc(itemRef(itemId), {
    stock: v, snoozed: false, updatedAt: serverTimestamp(), updatedBy: state.uid, autoLastAppliedAt: Date.now(),
  });
}

async function commitBuy(itemId, qty) {
  state.pendingCheckoffs.delete(itemId);
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;
  if (item.oneOff) {
    await deleteDoc(itemRef(itemId));
    return;
  }
  const ref = itemRef(itemId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const cur = snap.data();
      const next = Math.max(0, roundHalf((cur.stock || 0) + (parseFloat(qty) || 0)));
      tx.update(ref, {
        stock: next,
        forced: false,
        snoozed: false,
        lastBought: serverTimestamp(),
        buyCount: (cur.buyCount || 0) + 1,
        updatedAt: serverTimestamp(),
        updatedBy: state.uid,
        autoLastAppliedAt: Date.now(),
      });
    });
  } catch (err) {
    console.error(err);
  }
}

async function snoozeItem(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  if (item.oneOff) {
    await deleteDoc(itemRef(id));
    return;
  }
  await updateDoc(itemRef(id), { snoozed: true, forced: false });
  showToast(`${item.name} von der Liste entfernt`, async () => {
    await updateDoc(itemRef(id), { snoozed: false });
  });
}

// ───────────────────────── Rendering: Vorrat ─────────────────────────
function computeStatus(item) {
  const stock = item.stock || 0;
  if (stock <= 0) return "empty";
  if (stock <= (item.minStock || 0)) return "low";
  return "good";
}

function gaugePercent(item) {
  const stock = item.stock || 0;
  if (stock <= 0) return 0;
  const target = item.targetStock && item.targetStock > 0 ? item.targetStock : Math.max((item.minStock || 0) * 2, 1);
  return Math.max(6, Math.min(100, Math.round((stock / target) * 100)));
}

function itemRowHtml(item) {
  const status = computeStatus(item);
  const pct = gaugePercent(item);
  const catLabel = item.category === "essen" ? "Essen" : "Haushalt";
  return `
  <div class="item-row" data-id="${item.id}">
    <div class="gauge"><div class="gauge-fill ${status}" style="height:${pct}%"></div></div>
    <div class="item-main">
      <div class="item-name">${item.staple ? '<span class="staple-pin">📌</span> ' : ""}${esc(item.name)}</div>
      <div class="item-meta">${item.unit ? esc(item.unit) : ""} · ${catLabel}${item.location ? " · " + esc(item.location) : ""}${item.autoDecrement ? ' <span class="auto-pin" title="Automatischer Verbrauch aktiv">⏱</span>' : ""}</div>
    </div>
    <button class="round-btn" data-action="minus" data-id="${item.id}" aria-label="Weniger">−</button>
    <button class="item-stock-tap" data-action="open" data-id="${item.id}">${formatQty(item.stock)}</button>
    <button class="round-btn" data-action="plus" data-id="${item.id}" aria-label="Mehr">+</button>
  </div>`;
}

function distinctLocations() {
  const locs = new Set(["Keller"]); // soll laut Anforderung immer verfügbar sein
  state.items.forEach((it) => { if (it.location) locs.add(it.location); });
  return [...locs].sort((a, b) => a.localeCompare(b, "de"));
}

function refreshLocationDatalist() {
  $("location-list").innerHTML = distinctLocations().map((l) => `<option value="${esc(l)}"></option>`).join("");
}

function renderFilterChips() {
  const base = [["alle", "Alle"], ["essen", "Essen"], ["haushalt", "Haushalt"], ["fehlt", "Fehlt"]];
  const locChips = distinctLocations().map((l) => ["loc:" + l, l]);
  const all = [...base, ...locChips];
  // Falls der aktuell aktive Lagerort-Filter nicht mehr existiert, zurück auf "Alle"
  if (!all.some(([val]) => val === state.vorratFilter)) state.vorratFilter = "alle";
  $("vorrat-filters").innerHTML = all
    .map(([val, label]) => `<button class="chip${state.vorratFilter === val ? " active" : ""}" data-filter="${esc(val)}">${esc(label)}</button>`)
    .join("");
}

function renderVorrat() {
  renderFilterChips();
  refreshLocationDatalist();
  const q = normalize($("vorrat-search").value);
  const filter = state.vorratFilter;
  const allActive = state.items.filter((it) => it.active !== false);

  if (allActive.length === 0) {
    $("vorrat-list").innerHTML = "";
    $("vorrat-empty").textContent = 'Noch nichts im Vorrat. Leg unter „Neu" euren ersten Artikel an.';
    $("vorrat-empty").classList.remove("hidden");
    return;
  }

  let items = allActive.filter((it) => it.showInVorrat !== false);
  if (filter === "essen" || filter === "haushalt") items = items.filter((it) => it.category === filter);
  else if (filter === "fehlt") items = items.filter((it) => computeStatus(it) !== "good");
  else if (filter.startsWith("loc:")) items = items.filter((it) => it.location === filter.slice(4));
  if (q) items = items.filter((it) => normalize(it.name).includes(q));

  items.sort((a, b) => {
    const staDiff = (b.staple ? 1 : 0) - (a.staple ? 1 : 0);
    if (staDiff !== 0) return staDiff;
    if (a.category !== b.category) return a.category === "essen" ? -1 : 1;
    return a.name.localeCompare(b.name, "de");
  });

  if (items.length === 0) {
    $("vorrat-list").innerHTML = "";
    $("vorrat-empty").textContent = "Keine Treffer.";
    $("vorrat-empty").classList.remove("hidden");
    return;
  }
  $("vorrat-empty").classList.add("hidden");
  $("vorrat-list").innerHTML = items.map(itemRowHtml).join("");
}

// ───────────────────────── Rendering: Einkaufsliste ─────────────────────────
function listRowHtml(item) {
  const suggested = item.oneOff ? 1 : Math.max(1, roundHalf((item.targetStock || 1) - (item.stock || 0)));
  return `
  <div class="list-row" data-id="${item.id}">
    <button class="check-btn" data-action="check" data-id="${item.id}" aria-label="Erledigt"></button>
    <div class="item-main">
      <div class="item-name">${esc(item.name)}</div>
      <div class="item-meta">${item.unit ? esc(item.unit) : ""} · Bestand ${formatQty(item.stock || 0)}</div>
    </div>
    <input type="number" class="buy-qty" data-id="${item.id}" value="${suggested}" step="0.5" min="0" inputmode="decimal" />
    <button class="round-btn" data-action="snooze" data-id="${item.id}" aria-label="Jetzt nicht">✕</button>
  </div>`;
}

function groupHtml(title, items) {
  return `<div class="group-heading">${title}</div>` + items.map(listRowHtml).join("");
}

function renderListe() {
  const items = state.items.filter(
    (it) => it.active !== false && !it.snoozed && (it.forced || (it.stock || 0) <= (it.minStock || 0))
  );
  items.sort((a, b) => {
    if (a.category !== b.category) return a.category === "essen" ? -1 : 1;
    return a.name.localeCompare(b.name, "de");
  });

  const essen = items.filter((i) => i.category === "essen");
  const haushalt = items.filter((i) => i.category === "haushalt");

  let html = "";
  if (essen.length) html += groupHtml("Essen", essen);
  if (haushalt.length) html += groupHtml("Haushalt", haushalt);
  $("liste-groups").innerHTML = html;
  $("liste-empty").classList.toggle("hidden", items.length > 0);

  for (const id of state.pendingCheckoffs.keys()) {
    const row = $("liste-groups").querySelector(`.list-row[data-id="${id}"]`);
    if (row) {
      row.classList.add("checked");
      const cb = row.querySelector(".check-btn");
      if (cb) cb.classList.add("checked");
    }
  }

  updateBadge(Math.max(0, items.length - state.pendingCheckoffs.size));
}

function updateBadge(count) {
  const badge = $("liste-badge");
  if (count > 0) {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function handleCheckToggle(itemId) {
  if (state.pendingCheckoffs.has(itemId)) {
    clearTimeout(state.pendingCheckoffs.get(itemId).timer);
    state.pendingCheckoffs.delete(itemId);
    renderListe();
    return;
  }
  const row = $("liste-groups").querySelector(`.list-row[data-id="${itemId}"]`);
  const qtyInput = row ? row.querySelector(".buy-qty") : null;
  const qty = qtyInput ? parseFloat(qtyInput.value) || 0 : 1;
  const item = state.items.find((i) => i.id === itemId);

  if (row) {
    row.classList.add("checked");
    const cb = row.querySelector(".check-btn");
    if (cb) cb.classList.add("checked");
  }

  const timer = setTimeout(() => commitBuy(itemId, qty), 4000);
  state.pendingCheckoffs.set(itemId, { timer });
  updateBadge(Math.max(0, $("liste-groups").querySelectorAll(".list-row").length - state.pendingCheckoffs.size));
  showToast(`${item ? item.name : "Artikel"} erledigt`, () => {
    clearTimeout(timer);
    state.pendingCheckoffs.delete(itemId);
    renderListe();
  });
}

// ───────────────────────── Item-Modal ─────────────────────────
function formatAutoStatus(item) {
  const samples = Array.isArray(item.intervalSamples) ? item.intervalSamples : [];
  if (samples.length < 2 || !item.avgIntervalMs) {
    return `Noch nicht genug Messwerte (${samples.length} von 2 gemessenen Zeitspannen). Jedes Mal, wenn du „−" drückst, merkt sich die App, wie lange der Vorrat gehalten hat.`;
  }
  const days = item.avgIntervalMs / 86400000;
  const daysLabel = days < 1 ? `${Math.round(item.avgIntervalMs / 3600000)} Std.` : `${roundHalf(days)} Tagen`;
  let text = `Ø wird alle ${daysLabel} um 1 verbraucht.`;
  if (item.autoDecrement) {
    const base = item.autoLastAppliedAt || item.lastDecrementAt || Date.now();
    const remainingMs = base + item.avgIntervalMs - Date.now();
    const remainingDays = Math.max(0, remainingMs / 86400000);
    const remainingLabel = remainingDays < 1 ? `${Math.max(0, Math.round(remainingMs / 3600000))} Std.` : `${roundHalf(remainingDays)} Tagen`;
    text += ` Nächster automatischer Abzug in etwa ${remainingLabel}.`;
  } else {
    text += ` Automatik ist ausgeschaltet.`;
  }
  return text;
}

function openItemModal(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  currentEditId = id;
  $("item-modal-title").textContent = item.name;
  $("item-stock-value").value = formatQty(item.stock || 0);
  $("item-stock-unit").textContent = item.unit || "";
  $("item-minstock").value = item.minStock ?? 1;
  $("item-target").value = item.targetStock ?? 2;
  $("item-category").value = item.category || "essen";
  $("item-unit").value = item.unit || "";
  $("item-location").value = item.location || "";
  $("item-staple").checked = !!item.staple;
  $("item-autodecrement").checked = !!item.autoDecrement;
  $("item-autodecrement-status").textContent = formatAutoStatus(item);
  $("modal-item").classList.remove("hidden");
}

function closeItemModal() {
  $("modal-item").classList.add("hidden");
  currentEditId = null;
}

function refreshOpenModalIfNeeded() {
  if (!currentEditId) return;
  const item = state.items.find((i) => i.id === currentEditId);
  if (!item) { closeItemModal(); return; }
  if (document.activeElement !== $("item-stock-value")) {
    $("item-stock-value").value = formatQty(item.stock || 0);
  }
  $("item-autodecrement-status").textContent = formatAutoStatus(item);
}

function renderAll() {
  renderVorrat();
  renderListe();
  refreshOpenModalIfNeeded();
}

// ───────────────────────── Autovervollständigung ─────────────────────────
function getSuggestions(query, limitN = 6) {
  const q = query.trim();
  if (!q) return [];
  const seen = new Set();
  const results = [];
  for (const it of state.items) {
    const s = matchScore(q, it.name);
    if (s > 0) {
      results.push({ name: it.name, category: it.category, unit: it.unit, existingId: it.id, buyCount: it.buyCount || 0, active: it.active !== false, score: s });
      seen.add(normalize(it.name));
    }
  }
  for (const c of CATALOG) {
    if (seen.has(normalize(c.name))) continue;
    const s = matchScore(q, c.name);
    if (s > 0) results.push({ name: c.name, category: c.category, unit: c.unit, buyCount: 0, score: s - 5 });
  }
  results.sort((a, b) => b.score - a.score || b.buyCount - a.buyCount || a.name.localeCompare(b.name, "de"));
  return results.slice(0, limitN);
}

function showSuggestions(query, container, onPick) {
  clearTimeout(suggestDebounce);
  suggestDebounce = setTimeout(() => {
    const results = getSuggestions(query);
    if (!results.length) { container.classList.add("hidden"); container.innerHTML = ""; return; }
    container.innerHTML = results
      .map((r, i) => `<div class="suggestion-item" data-idx="${i}"><span>${esc(r.name)}</span><span class="suggestion-cat">${r.category === "essen" ? "Essen" : "Haushalt"}${r.existingId ? (r.active ? " · im Vorrat" : " · archiviert") : ""}</span></div>`)
      .join("");
    container.classList.remove("hidden");
    container.querySelectorAll(".suggestion-item").forEach((el) => {
      el.addEventListener("click", () => onPick(results[+el.dataset.idx]));
    });
  }, 120);
}

function hideSuggestions(container) {
  container.classList.add("hidden");
  container.innerHTML = "";
}

// ───────────────────────── Wiring ─────────────────────────
function wireAuthScreen() {
  $("auth-toggle").addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";
    $("auth-submit").textContent = authMode === "login" ? "Anmelden" : "Konto erstellen";
    $("auth-toggle").textContent = authMode === "login" ? "Noch kein Konto? Registrieren" : "Schon ein Konto? Anmelden";
    $("auth-error").classList.add("hidden");
  });

  $("form-auth").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;
    $("auth-error").classList.add("hidden");
    $("auth-submit").disabled = true;
    try {
      if (authMode === "login") await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      $("auth-error").textContent = translateAuthError(err.code);
      $("auth-error").classList.remove("hidden");
    } finally {
      $("auth-submit").disabled = false;
    }
  });
}

function showHouseholdError(msg) {
  $("household-error").textContent = msg;
  $("household-error").classList.remove("hidden");
}

function wireHouseholdScreen() {
  $("btn-create-household").addEventListener("click", async () => {
    $("household-error").classList.add("hidden");
    const code = generateJoinCode();
    try {
      const ref = await addDoc(collection(db, "households"), {
        joinCode: code, name: "Unser Haushalt", memberIds: [state.uid], createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "users", state.uid), { householdId: ref.id, email: state.user.email }, { merge: true });
      state.householdId = ref.id;
      state.joinCode = code;
      $("code-display").textContent = code;
      $("household-created").classList.remove("hidden");
    } catch (err) {
      console.error(err);
      showHouseholdError("Konnte Haushalt nicht anlegen. Prüfe deine Internetverbindung.");
    }
  });

  $("btn-join-household").addEventListener("click", async () => {
    $("household-error").classList.add("hidden");
    const code = $("join-code").value.trim().toUpperCase();
    if (code.length < 4) { showHouseholdError("Bitte gib den vollständigen Code ein."); return; }
    try {
      const q = query(collection(db, "households"), where("joinCode", "==", code), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) { showHouseholdError("Kein Haushalt mit diesem Code gefunden."); return; }
      const hDoc = snap.docs[0];
      await updateDoc(doc(db, "households", hDoc.id), { memberIds: arrayUnion(state.uid) });
      await setDoc(doc(db, "users", state.uid), { householdId: hDoc.id, email: state.user.email }, { merge: true });
      await enterHousehold(hDoc.id);
    } catch (err) {
      console.error(err);
      showHouseholdError("Beitritt fehlgeschlagen. Prüfe deine Internetverbindung.");
    }
  });

  $("btn-copy-code").addEventListener("click", () => copyText($("code-display").textContent));
  $("btn-enter-app").addEventListener("click", () => enterHousehold(state.householdId));
  $("btn-signout-household").addEventListener("click", () => signOut(auth));
}

function wireMainScreen() {
  document.querySelectorAll(".navbtn").forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

  $("btn-account").addEventListener("click", () => $("modal-account").classList.remove("hidden"));
  $("modal-account-close").addEventListener("click", () => $("modal-account").classList.add("hidden"));
  $("account-copy-code").addEventListener("click", () => copyText(state.joinCode));
  $("btn-signout").addEventListener("click", () => { $("modal-account").classList.add("hidden"); signOut(auth); });

  // Vorrat
  $("vorrat-search").addEventListener("input", renderVorrat);
  $("vorrat-filters").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    state.vorratFilter = chip.dataset.filter;
    renderVorrat();
  });
  $("vorrat-list").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === "plus") adjustStock(id, 1);
    else if (btn.dataset.action === "minus") adjustStock(id, -1, { track: true });
    else if (btn.dataset.action === "open") openItemModal(id);
  });

  // Einkaufsliste
  $("liste-groups").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === "check") handleCheckToggle(id);
    else if (btn.dataset.action === "snooze") snoozeItem(id);
  });

  $("quickadd-input").addEventListener("input", () =>
    showSuggestions($("quickadd-input").value, $("quickadd-suggestions"), (picked) => {
      $("quickadd-input").value = picked.name;
      hideSuggestions($("quickadd-suggestions"));
    })
  );
  $("quickadd-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); submitQuickAdd(); }
  });
  $("quickadd-submit").addEventListener("click", submitQuickAdd);

  // Neu anlegen
  $("new-name").addEventListener("input", () =>
    showSuggestions($("new-name").value, $("new-name-suggestions"), (picked) => {
      if (picked.existingId) {
        hideSuggestions($("new-name-suggestions"));
        $("new-name").value = "";
        openItemModal(picked.existingId);
        switchTab("vorrat");
      } else {
        $("new-name").value = picked.name;
        $("new-category").value = picked.category;
        $("new-unit").value = picked.unit;
        hideSuggestions($("new-name-suggestions"));
      }
    })
  );
  $("form-new-item").addEventListener("submit", submitNewItem);

  document.addEventListener("click", (e) => {
    document.querySelectorAll(".suggestions").forEach((s) => {
      if (!s.classList.contains("hidden") && !e.target.closest(".autocomplete-wrap")) {
        s.classList.add("hidden");
        s.innerHTML = "";
      }
    });
  });

  // Item-Modal
  $("modal-item-close").addEventListener("click", closeItemModal);
  $("modal-item").addEventListener("click", (e) => { if (e.target === $("modal-item")) closeItemModal(); });
  $("modal-account").addEventListener("click", (e) => { if (e.target === $("modal-account")) $("modal-account").classList.add("hidden"); });

  $("item-stock-minus").addEventListener("click", () => currentEditId && adjustStock(currentEditId, -1, { track: true }));
  $("item-stock-plus").addEventListener("click", () => currentEditId && adjustStock(currentEditId, 1));
  $("item-stock-value").addEventListener("change", () => currentEditId && setStockAbsolute(currentEditId, $("item-stock-value").value));

  $("item-minstock").addEventListener("change", () => currentEditId &&
    updateDoc(itemRef(currentEditId), { minStock: parseFloat($("item-minstock").value) || 0, updatedAt: serverTimestamp() }));
  $("item-target").addEventListener("change", () => currentEditId &&
    updateDoc(itemRef(currentEditId), { targetStock: parseFloat($("item-target").value) || 0, updatedAt: serverTimestamp() }));
  $("item-category").addEventListener("change", () => currentEditId &&
    updateDoc(itemRef(currentEditId), { category: $("item-category").value, updatedAt: serverTimestamp() }));
  $("item-unit").addEventListener("change", () => currentEditId &&
    updateDoc(itemRef(currentEditId), { unit: $("item-unit").value.trim(), updatedAt: serverTimestamp() }));
  $("item-location").addEventListener("change", () => currentEditId &&
    updateDoc(itemRef(currentEditId), { location: $("item-location").value.trim(), updatedAt: serverTimestamp() }));
  $("item-staple").addEventListener("change", () => currentEditId &&
    updateDoc(itemRef(currentEditId), { staple: $("item-staple").checked, updatedAt: serverTimestamp() }));
  $("item-autodecrement").addEventListener("change", () => {
    if (!currentEditId) return;
    const enabled = $("item-autodecrement").checked;
    updateDoc(itemRef(currentEditId), {
      autoDecrement: enabled,
      autoLastAppliedAt: Date.now(), // Uhr startet beim Ein-/Ausschalten neu
      updatedAt: serverTimestamp(),
    });
  });

  $("item-archive").addEventListener("click", async () => {
    if (!currentEditId) return;
    if (!confirm('Diesen Artikel archivieren? Er verschwindet aus Vorrat und Liste, bleibt aber für die Autovervollständigung gespeichert.')) return;
    await updateDoc(itemRef(currentEditId), { active: false, forced: false, snoozed: false });
    closeItemModal();
  });
}

async function submitQuickAdd() {
  const name = $("quickadd-input").value.trim();
  if (!name) return;
  hideSuggestions($("quickadd-suggestions"));
  $("quickadd-input").value = "";

  const existing = state.items.find((it) => normalize(it.name) === normalize(name));
  if (existing) {
    await updateDoc(itemRef(existing.id), { forced: true, active: true, snoozed: false, updatedAt: serverTimestamp() });
    return;
  }
  const catalogMatch = CATALOG.find((c) => normalize(c.name) === normalize(name));
  await addDoc(collection(db, "households", state.householdId, "items"), {
    name, nameLower: normalize(name),
    category: catalogMatch ? catalogMatch.category : "haushalt",
    unit: catalogMatch ? catalogMatch.unit : "Stück",
    location: "",
    stock: 0, minStock: 1, targetStock: 1,
    staple: false, active: true, showInVorrat: false, oneOff: true, forced: true, snoozed: false,
    lastBought: null, buyCount: 0,
    autoDecrement: false, intervalSamples: [], lastDecrementAt: null, avgIntervalMs: null, autoLastAppliedAt: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: state.uid,
  });
}

async function submitNewItem(e) {
  e.preventDefault();
  const name = $("new-name").value.trim();
  if (!name) return;

  const dup = state.items.find((it) => it.active !== false && normalize(it.name) === normalize(name));
  if (dup) {
    $("new-item-hint").textContent = `„${dup.name}" gibt es schon – öffne den Artikel zum Bearbeiten.`;
    $("new-item-hint").classList.remove("hidden");
    openItemModal(dup.id);
    switchTab("vorrat");
    return;
  }

  const data = {
    name, nameLower: normalize(name),
    category: $("new-category").value,
    unit: $("new-unit").value.trim() || "Stück",
    location: $("new-location").value.trim(),
    stock: parseFloat($("new-stock").value) || 0,
    minStock: parseFloat($("new-minstock").value) || 0,
    targetStock: parseFloat($("new-target").value) || 1,
    staple: $("new-staple").checked,
    active: true, showInVorrat: true, oneOff: false, forced: false, snoozed: false,
    lastBought: null, buyCount: 0,
    autoDecrement: false, intervalSamples: [], lastDecrementAt: null, avgIntervalMs: null, autoLastAppliedAt: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: state.uid,
  };
  await addDoc(collection(db, "households", state.householdId, "items"), data);

  $("new-item-hint").textContent = `„${name}" wurde angelegt.`;
  $("new-item-hint").classList.remove("hidden");
  $("new-name").value = "";
  $("new-stock").value = 1;
  $("new-minstock").value = 1;
  $("new-target").value = 2;
  $("new-location").value = "";
  $("new-staple").checked = false;
  $("new-name").focus();
}

// ───────────────────────── Start ─────────────────────────
wireAuthScreen();
wireHouseholdScreen();
wireMainScreen();

// Auto-Verbrauch: läuft alle 30 Minuten, solange die App offen ist, und sofort
// wenn die App/Tab nach einer Pause wieder in den Vordergrund kommt.
setInterval(runAutoDecrementCheck, 30 * 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") runAutoDecrementCheck();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => console.error("SW-Registrierung fehlgeschlagen", err));
  });
}

// ═══════════════════════════════════════════════════════════════
// Stash – App-Logik
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
function showFatalError(message) {
  const wrap = document.querySelector("#screen-loading .loading-wrap");
  if (wrap) {
    wrap.innerHTML = `<div class="fatal-error"><strong>Start fehlgeschlagen</strong><p>${message}</p></div>`;
  }
}

if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.apiKey || window.FIREBASE_CONFIG.apiKey.includes("HIER_")) {
  showFatalError('firebase-config.js fehlt oder enthält noch den Platzhalter. Prüfe, ob der apiKey wirklich eingetragen wurde.');
  throw new Error("FIREBASE_CONFIG fehlt oder unvollständig");
}

let firebaseApp, auth, db;
try {
  firebaseApp = initializeApp(window.FIREBASE_CONFIG);
  auth = getAuth(firebaseApp);
  try {
    db = initializeFirestore(firebaseApp, { localCache: persistentLocalCache({}) });
  } catch (cacheErr) {
    console.warn("Offline-Cache nicht verfügbar, starte ohne:", cacheErr);
    db = initializeFirestore(firebaseApp, {});
  }
} catch (err) {
  console.error("Firebase-Init fehlgeschlagen", err);
  showFatalError(`${err.message || err} <br><br>Prüfe die Werte in firebase-config.js auf Tippfehler (fehlende Anführungszeichen, Kommas).`);
  throw err;
}

// Falls das Laden ungewöhnlich lange dauert, einen Hinweis einblenden
// (z. B. weil kein Internet da ist oder die Firebase-Domain nicht erreichbar ist).
setTimeout(() => {
  if (!$("screen-loading").classList.contains("hidden")) {
    const wrap = document.querySelector("#screen-loading .loading-wrap");
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Das dauert länger als gewöhnlich. Prüfe deine Internetverbindung oder ob firebase-config.js korrekt ist.";
    wrap.appendChild(hint);
  }
}, 7000);

// ───────────────────────── Eingebauter Katalog ─────────────────────────
// Dient als Vorschlag beim Anlegen neuer Artikel und ordnet bekannte Namen
// automatisch einer Themen-Gruppe zu. "group: null" heißt bewusst: passt zu
// keiner Gruppe, bleibt lose stehen (z. B. Klopapier, Batterien).
const CATALOG = [
  ["Brot","Laib","Brot & Getreide"],
  ["Wasser","Kiste","Getränke"],
  ["Wein","Flasche","Getränke"],
  ["Öl","Flasche","Gewürze & Zutaten"],
  ["Tee","Packung","Getränke"],
  ["Deo","Stück","Hygiene"],
  ["Taschentücher","Packung","Hygiene"],
  ["Gefrierbeutel","Packung",null],
  ["Tomaten (Dose)","Dose","Konserven & Vorrat"],
  ["Thunfisch","Dose","Konserven & Vorrat"],
  ["Tiefkühlgemüse","Packung","Gemüse"],
  ["Milch","Liter","Milchprodukte"],
  ["Vollmilch","Liter","Milchprodukte"],
  ["Hafermilch","Liter","Milchprodukte"],
  ["Sojamilch","Liter","Milchprodukte"],
  ["Buttermilch","Liter","Milchprodukte"],
  ["Ayran","Flasche","Milchprodukte"],
  ["Kefir","Flasche","Milchprodukte"],
  ["Kaffeesahne","Packung","Milchprodukte"],
  ["Butter","Packung","Milchprodukte"],
  ["Margarine","Packung","Milchprodukte"],
  ["Joghurt","Becher","Milchprodukte"],
  ["Naturjoghurt","Becher","Milchprodukte"],
  ["Quark","Becher","Milchprodukte"],
  ["Sahne","Becher","Milchprodukte"],
  ["Schlagsahne","Becher","Milchprodukte"],
  ["Schmand","Becher","Milchprodukte"],
  ["Crème fraîche","Becher","Milchprodukte"],
  ["Mascarpone","Becher","Milchprodukte"],
  ["Ricotta","Becher","Milchprodukte"],
  ["Käse","Packung","Milchprodukte"],
  ["Gouda","Packung","Milchprodukte"],
  ["Emmentaler","Packung","Milchprodukte"],
  ["Mozzarella","Packung","Milchprodukte"],
  ["Parmesan","Stück","Milchprodukte"],
  ["Feta","Packung","Milchprodukte"],
  ["Camembert","Stück","Milchprodukte"],
  ["Gorgonzola","Packung","Milchprodukte"],
  ["Ziegenkäse","Packung","Milchprodukte"],
  ["Schafskäse","Packung","Milchprodukte"],
  ["Frischkäse","Packung","Milchprodukte"],
  ["Äpfel","kg","Obst"],
  ["Bananen","kg","Obst"],
  ["Orangen","kg","Obst"],
  ["Zitronen","Stück","Obst"],
  ["Kartoffeln","kg","Gemüse"],
  ["Zwiebeln","kg","Gemüse"],
  ["Knoblauch","Stück","Gemüse"],
  ["Gurke","Stück","Gemüse"],
  ["Tomaten","kg","Gemüse"],
  ["Rispentomaten","Packung","Gemüse"],
  ["Paprika","Stück","Gemüse"],
  ["Karotten","kg","Gemüse"],
  ["Brokkoli","Stück","Gemüse"],
  ["Blumenkohl","Stück","Gemüse"],
  ["Zucchini","Stück","Gemüse"],
  ["Aubergine","Stück","Gemüse"],
  ["Champignons","Packung","Gemüse"],
  ["Eisbergsalat","Stück","Gemüse"],
  ["Rucola","Packung","Gemüse"],
  ["Spinat","Packung","Gemüse"],
  ["Lauch","Stück","Gemüse"],
  ["Frühlingszwiebeln","Bund","Gemüse"],
  ["Petersilie","Bund","Gemüse"],
  ["Schnittlauch","Bund","Gemüse"],
  ["Basilikum","Topf","Gemüse"],
  ["Tiefkühlerbsen","Packung","Gemüse"],
  ["Hähnchenbrust","kg","Fleisch & Fisch"],
  ["Hähnchenschenkel","kg","Fleisch & Fisch"],
  ["Rindfleisch","kg","Fleisch & Fisch"],
  ["Rindersteak","Stück","Fleisch & Fisch"],
  ["Schweinefilet","kg","Fleisch & Fisch"],
  ["Hackfleisch","kg","Fleisch & Fisch"],
  ["Suppenhuhn","Stück","Fleisch & Fisch"],
  ["Salami","Packung","Fleisch & Fisch"],
  ["Schinken","Packung","Fleisch & Fisch"],
  ["Putenbrustaufschnitt","Packung","Fleisch & Fisch"],
  ["Leberwurst","Packung","Fleisch & Fisch"],
  ["Teewurst","Packung","Fleisch & Fisch"],
  ["Fleischwurst","Packung","Fleisch & Fisch"],
  ["Wiener Würstchen","Packung","Fleisch & Fisch"],
  ["Tofu","Packung","Fleisch & Fisch"],
  ["Räuchertofu","Packung","Fleisch & Fisch"],
  ["Zander","Stück","Fleisch & Fisch"],
  ["Kabeljau","Stück","Fleisch & Fisch"],
  ["Garnelen","Packung","Fleisch & Fisch"],
  ["Muscheln","Packung","Fleisch & Fisch"],
  ["Tintenfisch","Packung","Fleisch & Fisch"],
  ["Lachs","Packung","Fleisch & Fisch"],
  ["Fischstäbchen","Packung","Fleisch & Fisch"],
  ["Mehl","kg","Brot & Getreide"],
  ["Weizenmehl","kg","Brot & Getreide"],
  ["Roggenmehl","kg","Brot & Getreide"],
  ["Dinkelmehl","kg","Brot & Getreide"],
  ["Sojamehl","kg","Brot & Getreide"],
  ["Nudeln","Packung","Brot & Getreide"],
  ["Spaghetti","Packung","Brot & Getreide"],
  ["Makkaroni","Packung","Brot & Getreide"],
  ["Hartweizennudeln","Packung","Brot & Getreide"],
  ["Reis","Packung","Brot & Getreide"],
  ["Basmatireis","Packung","Brot & Getreide"],
  ["Milchreis","Packung","Brot & Getreide"],
  ["Haferflocken","Packung","Brot & Getreide"],
  ["Müsli","Packung","Brot & Getreide"],
  ["Cornflakes","Packung","Brot & Getreide"],
  ["Toastbrot","Packung","Brot & Getreide"],
  ["Couscous","Packung","Brot & Getreide"],
  ["Linsen","Packung","Konserven & Vorrat"],
  ["Kichererbsen","Dose","Konserven & Vorrat"],
  ["Erbsen","Dose","Konserven & Vorrat"],
  ["Bohnen","Dose","Konserven & Vorrat"],
  ["Kidneybohnen","Dose","Konserven & Vorrat"],
  ["Tomatenmark","Tube","Konserven & Vorrat"],
  ["passierte Tomaten","Packung","Konserven & Vorrat"],
  ["gehackte Tomaten","Dose","Konserven & Vorrat"],
  ["Stückige Tomaten","Dose","Konserven & Vorrat"],
  ["Sardellen","Glas","Konserven & Vorrat"],
  ["Thunfischdosen","Dose","Konserven & Vorrat"],
  ["Maisdosen","Dose","Konserven & Vorrat"],
  ["Gewürzgurken","Glas","Konserven & Vorrat"],
  ["Kapern","Glas","Konserven & Vorrat"],
  ["Zucker","kg","Gewürze & Zutaten"],
  ["Rohrzucker","Packung","Gewürze & Zutaten"],
  ["brauner Zucker","Packung","Gewürze & Zutaten"],
  ["Würfelzucker","Packung","Gewürze & Zutaten"],
  ["Gelierzucker","Packung","Gewürze & Zutaten"],
  ["Salz","Packung","Gewürze & Zutaten"],
  ["Pfeffer","Streuer","Gewürze & Zutaten"],
  ["Paprikapulver","Glas","Gewürze & Zutaten"],
  ["Currypulver","Glas","Gewürze & Zutaten"],
  ["Oregano","Glas","Gewürze & Zutaten"],
  ["Thymian","Glas","Gewürze & Zutaten"],
  ["Rosmarin","Glas","Gewürze & Zutaten"],
  ["Muskatnuss","Glas","Gewürze & Zutaten"],
  ["Zimt","Glas","Gewürze & Zutaten"],
  ["Nelken","Glas","Gewürze & Zutaten"],
  ["Lorbeerblätter","Packung","Gewürze & Zutaten"],
  ["Chilipulver","Glas","Gewürze & Zutaten"],
  ["Kreuzkümmel","Glas","Gewürze & Zutaten"],
  ["Korianderpulver","Glas","Gewürze & Zutaten"],
  ["Kurkuma","Glas","Gewürze & Zutaten"],
  ["Ingwerpulver","Glas","Gewürze & Zutaten"],
  ["Olivenöl","Flasche","Gewürze & Zutaten"],
  ["Sonnenblumenöl","Flasche","Gewürze & Zutaten"],
  ["Rapsöl","Flasche","Gewürze & Zutaten"],
  ["Essig","Flasche","Gewürze & Zutaten"],
  ["Balsamico","Flasche","Gewürze & Zutaten"],
  ["Hefe","Packung","Gewürze & Zutaten"],
  ["Trockenhefe","Packung","Gewürze & Zutaten"],
  ["Backpulver","Packung","Gewürze & Zutaten"],
  ["Vanillezucker","Packung","Gewürze & Zutaten"],
  ["Speisestärke","Packung","Gewürze & Zutaten"],
  ["Paniermehl","Packung","Gewürze & Zutaten"],
  ["Brühe","Packung","Gewürze & Zutaten"],
  ["Gemüsebrühe","Packung","Gewürze & Zutaten"],
  ["Hühnerbrühe","Packung","Gewürze & Zutaten"],
  ["Rinderbrühe","Packung","Gewürze & Zutaten"],
  ["Senf","Tube","Gewürze & Zutaten"],
  ["Ketchup","Flasche","Gewürze & Zutaten"],
  ["Mayonnaise","Glas","Gewürze & Zutaten"],
  ["Pinienkerne","Packung","Gewürze & Zutaten"],
  ["Kürbiskerne","Packung","Gewürze & Zutaten"],
  ["Sesam","Packung","Gewürze & Zutaten"],
  ["Kokosraspeln","Packung","Gewürze & Zutaten"],
  ["Sojasauce","Flasche","Asiatisch"],
  ["Kokosmilch","Dose","Asiatisch"],
  ["Currypaste","Glas","Asiatisch"],
  ["Sojasprossen","Dose","Asiatisch"],
  ["Bambussprossen","Dose","Asiatisch"],
  ["Mie-Nudeln","Packung","Asiatisch"],
  ["Reisnudeln","Packung","Asiatisch"],
  ["Glasnudeln","Packung","Asiatisch"],
  ["Wasabi","Tube","Asiatisch"],
  ["Miso","Glas","Asiatisch"],
  ["Honig","Glas","Süßes & Snacks"],
  ["Marmelade","Glas","Süßes & Snacks"],
  ["Erdbeermarmelade","Glas","Süßes & Snacks"],
  ["Nuss-Nougat-Creme","Glas","Süßes & Snacks"],
  ["Walnüsse","Packung","Süßes & Snacks"],
  ["Haselnüsse","Packung","Süßes & Snacks"],
  ["Mandeln","Packung","Süßes & Snacks"],
  ["Cashewkerne","Packung","Süßes & Snacks"],
  ["Rosinen","Packung","Süßes & Snacks"],
  ["getrocknete Aprikosen","Packung","Süßes & Snacks"],
  ["Datteln","Packung","Süßes & Snacks"],
  ["Kuvertüre","Packung","Süßes & Snacks"],
  ["Marzipan","Packung","Süßes & Snacks"],
  ["Puderzucker","Packung","Süßes & Snacks"],
  ["Gelatine","Packung","Süßes & Snacks"],
  ["Tortenguss","Packung","Süßes & Snacks"],
  ["Schokostreusel","Packung","Süßes & Snacks"],
  ["Mandelsplitter","Packung","Süßes & Snacks"],
  ["Knabberzeug","Packung","Süßes & Snacks"],
  ["Chips","Packung","Süßes & Snacks"],
  ["Paprikachips","Packung","Süßes & Snacks"],
  ["Tortillachips","Packung","Süßes & Snacks"],
  ["Salzstangen","Packung","Süßes & Snacks"],
  ["Erdnussflips","Packung","Süßes & Snacks"],
  ["Popcorn","Packung","Süßes & Snacks"],
  ["Erdnüsse","Packung","Süßes & Snacks"],
  ["Pistazien","Packung","Süßes & Snacks"],
  ["Macadamianüsse","Packung","Süßes & Snacks"],
  ["Dips","Becher","Süßes & Snacks"],
  ["Schokolade","Tafel","Süßes & Snacks"],
  ["Vollmilchschokolade","Tafel","Süßes & Snacks"],
  ["Zartbitterschokolade","Tafel","Süßes & Snacks"],
  ["Gummibärchen","Packung","Süßes & Snacks"],
  ["Bonbons","Packung","Süßes & Snacks"],
  ["Kekse","Packung","Süßes & Snacks"],
  ["Butterkekse","Packung","Süßes & Snacks"],
  ["Schokokekse","Packung","Süßes & Snacks"],
  ["Kaffee","Packung","Getränke"],
  ["Kaffeebohnen","Packung","Getränke"],
  ["Kaffeepulver","Packung","Getränke"],
  ["Schwarztee","Packung","Getränke"],
  ["Früchtetee","Packung","Getränke"],
  ["Kamillentee","Packung","Getränke"],
  ["Kakao","Packung","Getränke"],
  ["Kakaopulver","Packung","Getränke"],
  ["Mineralwasser","Kiste","Getränke"],
  ["Stilles Wasser","Kiste","Getränke"],
  ["Apfelsaft","Liter","Getränke"],
  ["Orangensaft","Liter","Getränke"],
  ["Traubensaft","Liter","Getränke"],
  ["Limonade","Flasche","Getränke"],
  ["Cola","Flasche","Getränke"],
  ["Eistee","Flasche","Getränke"],
  ["Energydrink","Dose","Getränke"],
  ["Tonic Water","Flasche","Getränke"],
  ["Ginger Ale","Flasche","Getränke"],
  ["Bitter Lemon","Flasche","Getränke"],
  ["Bier","Kiste","Getränke"],
  ["Pils","Kiste","Getränke"],
  ["Weizenbier","Kiste","Getränke"],
  ["Rotwein","Flasche","Getränke"],
  ["Weißwein","Flasche","Getränke"],
  ["Apfelwein","Flasche","Getränke"],
  ["Glühwein","Flasche","Getränke"],
  ["Sekt","Flasche","Getränke"],
  ["Rum","Flasche","Getränke"],
  ["Wodka","Flasche","Getränke"],
  ["Gin","Flasche","Getränke"],
  ["Cognac","Flasche","Getränke"],
  ["Whiskey","Flasche","Getränke"],
  ["Likör","Flasche","Getränke"],
  ["Amaretto","Flasche","Getränke"],
  ["Baileys","Flasche","Getränke"],
  ["Spülmittel","Flasche","Putzmittel"],
  ["Klarspüler","Flasche","Putzmittel"],
  ["Spülmaschinentabs","Packung","Putzmittel"],
  ["Spülmaschinensalz","Packung","Putzmittel"],
  ["Maschinenpfleger","Flasche","Putzmittel"],
  ["Allzweckreiniger","Flasche","Putzmittel"],
  ["Glasreiniger","Flasche","Putzmittel"],
  ["Badreiniger","Flasche","Putzmittel"],
  ["Essigreiniger","Flasche","Putzmittel"],
  ["WC-Reiniger","Flasche","Putzmittel"],
  ["Toilettenstein","Stück","Putzmittel"],
  ["Scheuermilch","Flasche","Putzmittel"],
  ["Bodenreiniger","Flasche","Putzmittel"],
  ["Rohrreiniger","Flasche","Putzmittel"],
  ["Entkalker","Flasche","Putzmittel"],
  ["Fettlöser","Flasche","Putzmittel"],
  ["Waschmittel","Packung","Putzmittel"],
  ["Vollwaschmittel","Packung","Putzmittel"],
  ["Colorwaschmittel","Packung","Putzmittel"],
  ["Feinwaschmittel","Packung","Putzmittel"],
  ["Wollwaschmittel","Packung","Putzmittel"],
  ["Weichspüler","Flasche","Putzmittel"],
  ["Fleckenspray","Flasche","Putzmittel"],
  ["Gallseife","Stück","Putzmittel"],
  ["Wäschenetz","Stück","Putzmittel"],
  ["Putzlappen","Packung","Putzmittel"],
  ["Mikrofasertuch","Stück","Putzmittel"],
  ["Staubtuch","Packung","Putzmittel"],
  ["Schwamm","Stück","Putzmittel"],
  ["Topfkratzer","Stück","Putzmittel"],
  ["Stahlschwamm","Stück","Putzmittel"],
  ["Flaschenbürste","Stück","Putzmittel"],
  ["Staubsaugerbeutel","Packung","Putzmittel"],
  ["Staubsaugerfilter","Stück","Putzmittel"],
  ["Besen","Stück","Putzmittel"],
  ["Handfeger","Stück","Putzmittel"],
  ["Kehrblech","Stück","Putzmittel"],
  ["Wischmopp","Stück","Putzmittel"],
  ["Eimer","Stück","Putzmittel"],
  ["Staubwedel","Stück","Putzmittel"],
  ["Fensterabzieher","Stück","Putzmittel"],
  ["Bürste","Stück","Putzmittel"],
  ["Schrubber","Stück","Putzmittel"],
  ["Feuchttücher","Packung","Hygiene"],
  ["feuchtes Toilettenpapier","Packung","Hygiene"],
  ["Duschgel","Flasche","Hygiene"],
  ["Seife","Stück","Hygiene"],
  ["Flüssigseife","Flasche","Hygiene"],
  ["Handseife","Flasche","Hygiene"],
  ["Kernseife","Stück","Hygiene"],
  ["Shampoo","Flasche","Hygiene"],
  ["Haarspülung","Flasche","Hygiene"],
  ["Haarkur","Packung","Hygiene"],
  ["Trockenshampoo","Dose","Hygiene"],
  ["Haarspray","Dose","Hygiene"],
  ["Haargel","Tube","Hygiene"],
  ["Deodorant","Stück","Hygiene"],
  ["Deo-Roller","Stück","Hygiene"],
  ["Deo-Spray","Dose","Hygiene"],
  ["Rasierschaum","Dose","Hygiene"],
  ["Rasiergel","Tube","Hygiene"],
  ["Einwegrasierer","Packung","Hygiene"],
  ["Rasierklingen","Packung","Hygiene"],
  ["Aftershave","Flasche","Hygiene"],
  ["Zahnbürste","Stück","Hygiene"],
  ["elektrische Zahnbürste","Stück","Hygiene"],
  ["Aufsteckbürsten","Packung","Hygiene"],
  ["Zahnpasta","Tube","Hygiene"],
  ["Zahnseide","Packung","Hygiene"],
  ["Interdentalbürsten","Packung","Hygiene"],
  ["Mundspülung","Flasche","Hygiene"],
  ["Wattestäbchen","Packung","Hygiene"],
  ["Wattepads","Packung","Hygiene"],
  ["Papiertaschentücher","Packung","Hygiene"],
  ["Binden","Packung","Hygiene"],
  ["Slipeinlagen","Packung","Hygiene"],
  ["Tampons","Packung","Hygiene"],
  ["Menstruationstasse","Stück","Hygiene"],
  ["Kondome","Packung","Hygiene"],
  ["Gleitgel","Tube","Hygiene"],
  ["Bodylotion","Flasche","Kosmetik"],
  ["Körperöl","Flasche","Kosmetik"],
  ["Gesichtscreme","Tube","Kosmetik"],
  ["Handcreme","Tube","Kosmetik"],
  ["Fußcreme","Tube","Kosmetik"],
  ["Sonnencreme","Tube","Kosmetik"],
  ["Abschminktücher","Packung","Kosmetik"],
  ["Pinzette","Stück","Kosmetik"],
  ["Nagelschere","Stück","Kosmetik"],
  ["Nagelknipser","Stück","Kosmetik"],
  ["Nagelfeile","Stück","Kosmetik"],
  ["Bimsstein","Stück","Kosmetik"],
  ["Hornhautraspel","Stück","Kosmetik"],
  ["Haarbürste","Stück","Kosmetik"],
  ["Kamm","Stück","Kosmetik"],
  ["Haargummis","Packung","Kosmetik"],
  ["Haarspangen","Packung","Kosmetik"],
  ["Lippenpflege","Stück","Kosmetik"],
  ["Lippenbalsam","Stück","Kosmetik"],
  ["Pflaster","Packung","Gesundheit"],
  ["Blasenpflaster","Packung","Gesundheit"],
  ["Verbandszeug","Packung","Gesundheit"],
  ["Desinfektionsmittel","Flasche","Gesundheit"],
  ["Fieberthermometer","Stück","Gesundheit"],
  ["Schmerzmittel","Packung","Gesundheit"],
  ["Kopfschmerztabletten","Packung","Gesundheit"],
  ["Hustensaft","Flasche","Gesundheit"],
  ["Nasenspray","Flasche","Gesundheit"],
  ["Halstabletten","Packung","Gesundheit"],
  ["Ohropax","Packung","Gesundheit"],
  ["Kontaktlinsen","Packung","Gesundheit"],
  ["Kontaktlinsenflüssigkeit","Flasche","Gesundheit"],
  ["Kochsalzlösung","Flasche","Gesundheit"],
  ["Augentropfen","Flasche","Gesundheit"],
  ["Vitamintabletten","Packung","Gesundheit"],
  ["Erkältungstee","Packung","Gesundheit"],
  ["Wärmepflaster","Packung","Gesundheit"],
  ["Kirschkernkissen","Stück","Gesundheit"],
  ["Wärmflasche","Stück","Gesundheit"],
  ["Schwangerschaftstest","Stück","Gesundheit"],
  ["Hundefutter","kg","Tierbedarf"],
  ["Katzenfutter","kg","Tierbedarf"],
  ["Katzenstreu","Packung","Tierbedarf"],
  ["Vogelfutter","Packung","Tierbedarf"],
  ["Meisenknödel","Packung","Tierbedarf"],
  ["Fischfutter","Dose","Tierbedarf"],
  ["Klopapier","Packung",null],
  ["Küchenrolle","Rolle",null],
  ["Toilettenpapier","Packung",null],
  ["Eier","10er Pack",null],
  ["Müllbeutel","Rolle",null],
  ["Restmüllbeutel","Rolle",null],
  ["Biomüllbeutel","Rolle",null],
  ["Gelber Sack","Rolle",null],
  ["Abfalleimer","Stück",null],
  ["Komposteimer","Stück",null],
  ["Backpapier","Rolle",null],
  ["Alufolie","Rolle",null],
  ["Frischhaltefolie","Rolle",null],
  ["Butterbrotpapier","Packung",null],
  ["Vorratsdose","Stück",null],
  ["Tupperdose","Stück",null],
  ["Servietten","Packung",null],
  ["Streichhölzer","Packung",null],
  ["Feuerzeug","Stück",null],
  ["Teelichter","Packung",null],
  ["Kerzen","Stück",null],
  ["Batterien","Packung",null],
  ["Glühbirnen","Stück",null],
  ["Wäscheständer","Stück",null],
  ["Wäschekorb","Stück",null],
  ["Wäscheklammern","Packung",null],
  ["Bügelbrettbezug","Stück",null],
  ["Klebeband","Rolle",null],
  ["Paketband","Rolle",null],
  ["Isolierband","Rolle",null],
  ["Thermoskanne","Stück",null],
  ["Blumenerde","Packung",null],
  ["Pflanzendünger","Flasche",null],
  ["Tiefkühlpizza","Stück",null],
  ["Pommes frites","Packung",null],
  ["Speiseeis","Packung",null],
  ["Kaffeefilter","Packung",null],
].map(([name, unit, group]) => ({ name, unit, group }));

// Feste Anzeige-Reihenfolge der Themen-Gruppen im Vorrat.
const GROUP_ORDER = [
  "Obst", "Gemüse", "Milchprodukte", "Fleisch & Fisch", "Brot & Getreide",
  "Konserven & Vorrat", "Gewürze & Zutaten", "Asiatisch", "Süßes & Snacks", "Getränke",
  "Putzmittel", "Hygiene", "Kosmetik", "Gesundheit", "Tierbedarf",
];

// Fallback-Stichwörter für Artikel, die nicht exakt im Katalog stehen
// (z. B. eigene Schreibweisen oder Mehrzahlformen).
const FALLBACK_KEYWORDS = [
  { group: "Milchprodukte", words: ["milch", "käse", "joghurt", "quark", "sahne", "butter"] },
  { group: "Obst", words: ["apfel", "äpfel", "banane", "zitrone", "orange", "traube", "beere", "birne", "mandarine", "kiwi", "melone", "pfirsich", "mango", "ananas"] },
  { group: "Gemüse", words: ["kartoffel", "zwiebel", "knoblauch", "tomate", "gurke", "paprika", "karotte", "salat", "brokkoli", "spinat", "pilz", "zucchini", "möhre"] },
  { group: "Fleisch & Fisch", words: ["hackfleisch", "hähnchen", "fisch", "wurst", "schinken", "speck", "filet"] },
  { group: "Brot & Getreide", words: ["brot", "brötchen", "mehl", "reis", "müsli", "haferflocken", "toast", "couscous"] },
  { group: "Konserven & Vorrat", words: ["dose", "konserve", "linsen", "bohnen"] },
  { group: "Gewürze & Zutaten", words: ["gewürz", "pfeffer", "öl ", "essig"] },
  { group: "Asiatisch", words: ["soja", "curry", "wasabi", "miso", "mie-nudel", "reisnudel", "glasnudel"] },
  { group: "Süßes & Snacks", words: ["schokolade", "keks", "gummibär", "chips", "süßigkeit", "nuss", "nüsse"] },
  { group: "Getränke", words: ["wasser", "saft", "bier", "wein", "limonade", "cola", "kaffee", "tee"] },
  { group: "Putzmittel", words: ["reiniger", "spülmittel", "waschmittel", "weichspüler", "putz"] },
  { group: "Hygiene", words: ["zahnpasta", "zahnbürste", "duschgel", "shampoo", "deo", "rasier", "seife", "tampon", "binde"] },
  { group: "Kosmetik", words: ["creme", "sonnencreme", "lotion", "parfum", "makeup"] },
  { group: "Gesundheit", words: ["schmerz", "pflaster", "erkältung", "fieber", "desinfekt", "tablette"] },
  { group: "Tierbedarf", words: ["hundefutter", "katzenfutter", "katzenstreu", "vogelfutter", "tierfutter"] },
];

// Ordnet einen Artikelnamen automatisch einer Themen-Gruppe zu, oder null,
// wenn nichts passt (dann bleibt der Artikel lose unter "Sonstiges" stehen).
function classifyGroup(name) {
  const n = normalize(name);
  const catalogHit = CATALOG.find((c) => normalize(c.name) === n);
  if (catalogHit) return catalogHit.group || null;
  for (const rule of FALLBACK_KEYWORDS) {
    if (rule.words.some((w) => n.includes(w))) return rule.group;
  }
  return null;
}

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
let expandedGroups = null; // null = noch nicht initialisiert (siehe renderVorratGrouped)
let pendingBarcode = null;
let scannerStream = null;
let scannerActive = false;
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

// ───────────────────────── Zurück-Navigation (Android-Taste) ─────────────────────────
// Öffnet man einen Tab (außer Vorrat) oder ein Modal, legen wir einen
// Verlaufseintrag an. Drückt man danach "Zurück", schließen wir stattdessen
// nur das Modal bzw. springen zurück zum Vorrat, statt die ganze App zu
// verlassen. Ohne das würde Android die App beenden.
function pushAppHistory() {
  try { history.pushState({ stashNav: true }, ""); } catch { /* z. B. in manchen eingebetteten Webviews nicht erlaubt */ }
}

function handleBackNavigation() {
  if (!$("modal-scanner").classList.contains("hidden")) { closeScanner(true); return; }
  if (!$("modal-item").classList.contains("hidden")) { closeItemModal(true); return; }
  if (!$("modal-account").classList.contains("hidden")) { $("modal-account").classList.add("hidden"); return; }
  if ($("tab-vorrat").classList.contains("hidden")) { switchTab("vorrat", false); return; }
  // Bereits auf der Vorrat-Übersicht ohne offenes Modal: nichts weiter zu tun,
  // der Browser/das Betriebssystem übernimmt die eigentliche Zurück-Aktion.
}
window.addEventListener("popstate", handleBackNavigation);

function switchTab(tab, pushHistory = true) {
  document.querySelectorAll(".tabpanel").forEach((p) => p.classList.add("hidden"));
  $("tab-" + tab).classList.remove("hidden");
  document.querySelectorAll(".navbtn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  if (pushHistory && tab !== "vorrat") pushAppHistory();
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
  return `
  <div class="item-row" data-id="${item.id}">
    <div class="gauge"><div class="gauge-fill ${status}" style="height:${pct}%"></div></div>
    <div class="item-main">
      <div class="item-name">${item.staple ? '<span class="staple-pin">📌</span> ' : ""}${esc(item.name)}</div>
      <div class="item-meta">${item.unit ? esc(item.unit) : ""}${item.location ? " · " + esc(item.location) : ""}${item.autoDecrement ? ' <span class="auto-pin" title="Automatischer Verbrauch aktiv">⏱</span>' : ""}</div>
    </div>
    <button class="round-btn" data-action="minus" data-id="${item.id}" aria-label="Weniger">−</button>
    <button class="item-stock-tap" data-action="open" data-id="${item.id}">${formatQty(item.stock)}</button>
    <button class="round-btn" data-action="plus" data-id="${item.id}" aria-label="Mehr">+</button>
  </div>`;
}

function distinctLocations() {
  const locs = new Set();
  state.items.forEach((it) => { if (it.location) locs.add(it.location); });
  return [...locs].sort((a, b) => a.localeCompare(b, "de"));
}

function refreshLocationDatalist() {
  $("location-list").innerHTML = distinctLocations().map((l) => `<option value="${esc(l)}"></option>`).join("");
}

function renderFilterChips() {
  const all = [["alle", "Alle"], ["fehlt", "Fehlt"]];
  if (!all.some(([val]) => val === state.vorratFilter)) state.vorratFilter = "alle";
  $("vorrat-filters").innerHTML = all
    .map(([val, label]) => `<button class="chip${state.vorratFilter === val ? " active" : ""}" data-filter="${esc(val)}">${esc(label)}</button>`)
    .join("");
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    const staDiff = (b.staple ? 1 : 0) - (a.staple ? 1 : 0);
    if (staDiff !== 0) return staDiff;
    return a.name.localeCompare(b.name, "de");
  });
}

function accordionHeaderHtml(key, label, count, attentionCount, isOpen) {
  return `
  <button type="button" class="accordion-header" data-group="${esc(key)}" aria-expanded="${isOpen}">
    <span class="accordion-chevron">${isOpen ? "▾" : "▸"}</span>
    <span class="accordion-label">${esc(label)}</span>
    ${attentionCount > 0 ? `<span class="accordion-alert">${attentionCount}</span>` : ""}
    <span class="accordion-count">${count}</span>
  </button>`;
}

// Baut die gruppierte Ansicht mit aufklappbaren Themen-Bereichen.
// Wird nur genutzt, wenn weder gesucht noch nach "Fehlt" gefiltert wird -
// in diesen Fällen zeigen wir stattdessen eine einfache flache Trefferliste.
function renderVorratGrouped(items) {
  const staples = items.filter((it) => it.staple);
  const rest = items.filter((it) => !it.staple);

  const byGroup = {};
  const ungrouped = [];
  rest.forEach((it) => {
    const g = classifyGroup(it.name);
    if (g) { (byGroup[g] ||= []).push(it); } else { ungrouped.push(it); }
  });

  // Beim allerersten Rendern: Gruppen mit fehlenden Artikeln automatisch
  // aufklappen, alle anderen eingeklappt lassen. Danach bleibt es dem
  // manuellen Auf-/Zuklappen überlassen, damit es nicht bei jeder
  // Bestandsänderung wieder aufspringt.
  if (expandedGroups === null) {
    expandedGroups = new Set(
      GROUP_ORDER.filter((g) => (byGroup[g] || []).some((it) => computeStatus(it) !== "good"))
    );
  }

  let html = "";
  if (staples.length) {
    html += `<div class="group-heading">📌 Dauerartikel</div>` + sortItems(staples).map(itemRowHtml).join("");
  }

  GROUP_ORDER.forEach((key) => {
    const list = byGroup[key];
    if (!list || !list.length) return;
    const isOpen = expandedGroups.has(key);
    const attentionCount = list.filter((it) => computeStatus(it) !== "good").length;
    html += accordionHeaderHtml(key, key, list.length, attentionCount, isOpen);
    if (isOpen) html += `<div class="accordion-body">${sortItems(list).map(itemRowHtml).join("")}</div>`;
  });

  if (ungrouped.length) {
    html += `<div class="group-heading">Sonstiges</div>` + sortItems(ungrouped).map(itemRowHtml).join("");
  }

  $("vorrat-list").innerHTML = html;
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
  if (filter === "fehlt") items = items.filter((it) => computeStatus(it) !== "good");
  if (q) items = items.filter((it) => normalize(it.name).includes(q) || normalize(it.location || "").includes(q));

  if (items.length === 0) {
    $("vorrat-list").innerHTML = "";
    $("vorrat-empty").textContent = "Keine Treffer.";
    $("vorrat-empty").classList.remove("hidden");
    return;
  }
  $("vorrat-empty").classList.add("hidden");

  // Nur in der unveränderten "Alle"-Ansicht ohne Suche gruppieren.
  // Bei Suche oder "Fehlt"-Filter reicht eine einfache, flache Liste -
  // dort will man sofort alle Treffer sehen, nicht erst aufklappen.
  if (filter === "alle" && !q) {
    renderVorratGrouped(items);
  } else {
    $("vorrat-list").innerHTML = sortItems(items).map(itemRowHtml).join("");
  }
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

  const byGroup = {};
  const ungrouped = [];
  items.forEach((it) => {
    const g = classifyGroup(it.name);
    if (g) { (byGroup[g] ||= []).push(it); } else { ungrouped.push(it); }
  });

  let html = "";
  GROUP_ORDER.forEach((key) => {
    const list = byGroup[key];
    if (list && list.length) html += groupHtml(key, sortItems(list));
  });
  if (ungrouped.length) html += groupHtml("Sonstiges", sortItems(ungrouped));

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
  $("item-unit").value = item.unit || "";
  $("item-location").value = item.location || "";
  $("item-staple").checked = !!item.staple;
  $("item-autodecrement").checked = !!item.autoDecrement;
  $("item-autodecrement-status").textContent = formatAutoStatus(item);
  $("modal-item").classList.remove("hidden");
  pushAppHistory();
}

function closeItemModal(fromPopState = false) {
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
      results.push({ name: it.name, unit: it.unit, existingId: it.id, buyCount: it.buyCount || 0, active: it.active !== false, score: s });
      seen.add(normalize(it.name));
    }
  }
  for (const c of CATALOG) {
    if (seen.has(normalize(c.name))) continue;
    const s = matchScore(q, c.name);
    if (s > 0) results.push({ name: c.name, unit: c.unit, buyCount: 0, score: s - 5 });
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
      .map((r, i) => {
        const group = classifyGroup(r.name);
        const tag = r.existingId ? (r.active ? "im Vorrat" : "archiviert") : (group || "Sonstiges");
        return `<div class="suggestion-item" data-idx="${i}"><span>${esc(r.name)}</span><span class="suggestion-cat">${esc(tag)}</span></div>`;
      })
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
      console.error(err);
      $("auth-error").textContent = `${translateAuthError(err.code)} (${err.code || "unbekannt"})`;
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

// ───────────────────────── Barcode-Scanner ─────────────────────────
async function openScanner(onResult) {
  $("scanner-status").textContent = "Kamera wird gestartet…";
  $("modal-scanner").classList.remove("hidden");
  pushAppHistory();

  if (!("BarcodeDetector" in window)) {
    $("scanner-status").textContent = "Barcode-Scan wird auf diesem Gerät/Browser nicht unterstützt. Bitte Namen manuell eingeben.";
    return;
  }

  let detector;
  try {
    detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"] });
  } catch {
    $("scanner-status").textContent = "Barcode-Scan wird auf diesem Gerät/Browser nicht unterstützt. Bitte Namen manuell eingeben.";
    return;
  }

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch (err) {
    console.error(err);
    $("scanner-status").textContent = "Kein Kamera-Zugriff. Bitte in den Browser-Einstellungen erlauben, oder Namen manuell eingeben.";
    return;
  }

  const video = $("scanner-video");
  video.srcObject = scannerStream;
  await video.play().catch(() => {});
  $("scanner-status").textContent = "Barcode ins Feld halten…";
  scannerActive = true;

  const loop = async () => {
    if (!scannerActive) return;
    try {
      const codes = await detector.detect(video);
      if (codes.length > 0) {
        const value = codes[0].rawValue;
        closeScanner();
        onResult(value);
        return;
      }
    } catch (err) {
      // einzelne fehlgeschlagene Frames sind normal, weiter versuchen
    }
    if (scannerActive) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function closeScanner(fromPopState = false) {
  scannerActive = false;
  if (scannerStream) {
    scannerStream.getTracks().forEach((t) => t.stop());
    scannerStream = null;
  }
  $("scanner-video").srcObject = null;
  $("modal-scanner").classList.add("hidden");
}

async function handleScannedBarcode(code) {
  switchTab("neu");

  const existing = state.items.find((it) => it.barcode === code);
  if (existing) {
    if (existing.active === false) {
      await updateDoc(itemRef(existing.id), { active: true, updatedAt: serverTimestamp() });
    }
    openItemModal(existing.id);
    switchTab("vorrat");
    showToast(`„${existing.name}" gefunden`);
    return;
  }

  pendingBarcode = code;
  $("new-barcode-hint").textContent = `Barcode ${code} gespeichert. Suche Produktinfo…`;
  $("new-barcode-hint").classList.remove("hidden");

  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    const json = await res.json();
    if (json.status === 1 && json.product) {
      const name = json.product.product_name_de || json.product.product_name || "";
      if (name) {
        $("new-name").value = name;
      }
      $("new-barcode-hint").textContent = name
        ? `Barcode ${code} – Produkt gefunden: „${name}". Bitte prüfen und ergänzen.`
        : `Barcode ${code} gespeichert, aber kein Name gefunden. Bitte Namen eintragen.`;
    } else {
      $("new-barcode-hint").textContent = `Barcode ${code} gespeichert, Produkt nicht in der Datenbank gefunden. Bitte Namen eintragen.`;
    }
  } catch (err) {
    console.error(err);
    $("new-barcode-hint").textContent = `Barcode ${code} gespeichert (Produktsuche gerade nicht erreichbar). Bitte Namen eintragen.`;
  }
  $("new-name").focus();
}

function wireMainScreen() {
  document.querySelectorAll(".navbtn").forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

  $("btn-account").addEventListener("click", () => { $("modal-account").classList.remove("hidden"); pushAppHistory(); });
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
    const header = e.target.closest(".accordion-header");
    if (header) {
      const key = header.dataset.group;
      if (expandedGroups === null) expandedGroups = new Set();
      if (expandedGroups.has(key)) expandedGroups.delete(key); else expandedGroups.add(key);
      renderVorrat();
      return;
    }
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
        if (!picked.active) updateDoc(itemRef(picked.existingId), { active: true, updatedAt: serverTimestamp() });
        openItemModal(picked.existingId);
        switchTab("vorrat");
      } else {
        $("new-name").value = picked.name;
        $("new-unit").value = picked.unit;
        hideSuggestions($("new-name-suggestions"));
      }
    })
  );
  $("form-new-item").addEventListener("submit", submitNewItem);
  $("btn-scan-new").addEventListener("click", () => openScanner(handleScannedBarcode));
  $("btn-quicktrack-toggle").addEventListener("click", () => {
    const panel = $("quicktrack-panel");
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) $("quicktrack-input").focus();
  });
  $("quicktrack-submit").addEventListener("click", submitQuickTrack);
  $("scanner-close").addEventListener("click", closeScanner);

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
    if (!confirm('Artikel aus Vorrat und Einkaufsliste entfernen? Er bleibt im Hintergrund gespeichert, damit er dir beim erneuten Eintippen als Vorschlag angeboten wird - du kannst ihn also jederzeit wieder hinzufügen.')) return;
    await updateDoc(itemRef(currentEditId), { active: false, forced: false, snoozed: false, staple: false });
    closeItemModal();
  });

  $("item-delete").addEventListener("click", async () => {
    if (!currentEditId) return;
    const item = state.items.find((i) => i.id === currentEditId);
    if (!confirm(`„${item ? item.name : "Artikel"}" endgültig löschen? Das kann nicht rückgängig gemacht werden, und er wird auch nicht mehr als Vorschlag beim Eintippen erscheinen.`)) return;
    await deleteDoc(itemRef(currentEditId));
    closeItemModal();
  });
}

// ───────────────────────── Schnell erfassen (Massenerfassung) ─────────────────────────
// Erwartetes Format: Zahl direkt vor jedem Gegenstand, Rest ist beliebig -
// "2 Zahnpasta 3 Schwamm 4 Nudeln" oder mit Kommas/Zeilenumbrüchen, völlig egal.
// Auch für Diktierfunktionen der Tastatur gedacht, deshalb werden gängige
// Füllwörter beim Zusammendiktieren ("und", "sowie" ...) einfach ignoriert.
const QUICKTRACK_STOPWORDS = new Set(["und", "sowie", "ausserdem", "auch", "noch", "plus", "dazu", "x"]);

function parseQuickTrack(text) {
  const tokens = text
    .replace(/(\d),(\d)/g, "$1.$2") // Dezimalkomma schützen, bevor Kommas als Trenner gelten
    .replace(/[,;\n]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const numRe = /^\d+([.,]\d+)?x?$/i;
  const entries = [];
  let current = null;
  for (const tok of tokens) {
    if (numRe.test(tok)) {
      if (current && current.words.length) entries.push(current);
      const qty = parseFloat(tok.replace(",", ".").replace(/x$/i, ""));
      current = { qty, words: [] };
      continue;
    }
    if (!current) continue; // Text vor der ersten Zahl wird ignoriert
    if (QUICKTRACK_STOPWORDS.has(normalize(tok))) continue;
    current.words.push(tok);
  }
  if (current && current.words.length) entries.push(current);
  return entries
    .map((e) => ({ qty: e.qty, name: e.words.join(" ") }))
    .filter((e) => e.name && isFinite(e.qty) && e.qty >= 0);
}

async function submitQuickTrack() {
  const raw = $("quicktrack-input").value.trim();
  if (!raw) return;
  const entries = parseQuickTrack(raw);
  if (!entries.length) {
    $("quicktrack-result").textContent = 'Konnte nichts erkennen. Format: Zahl vor dem Namen, z. B. „2 Zahnpasta 3 Schwamm".';
    $("quicktrack-result").classList.remove("hidden");
    return;
  }

  $("quicktrack-submit").disabled = true;
  let created = 0, updated = 0;
  for (const { qty, name } of entries) {
    const existing = state.items.find((it) => normalize(it.name) === normalize(name));
    if (existing) {
      await updateDoc(itemRef(existing.id), {
        stock: Math.max(0, roundHalf(qty)),
        active: true, snoozed: false, forced: false,
        updatedAt: serverTimestamp(), updatedBy: state.uid, autoLastAppliedAt: Date.now(),
      });
      updated++;
    } else {
      const catalogMatch = CATALOG.find((c) => normalize(c.name) === normalize(name));
      await addDoc(collection(db, "households", state.householdId, "items"), {
        name, nameLower: normalize(name),
        unit: catalogMatch ? catalogMatch.unit : "Stück",
        location: "",
        barcode: null,
        stock: Math.max(0, roundHalf(qty)),
        minStock: 1, targetStock: Math.max(2, Math.ceil(qty)),
        staple: false, active: true, showInVorrat: true, oneOff: false, forced: false, snoozed: false,
        lastBought: null, buyCount: 0,
        autoDecrement: false, intervalSamples: [], lastDecrementAt: null, avgIntervalMs: null, autoLastAppliedAt: null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: state.uid,
      });
      created++;
    }
  }
  $("quicktrack-submit").disabled = false;

  $("quicktrack-input").value = "";
  $("quicktrack-result").textContent = `${entries.length} Artikel verarbeitet: ${created} neu angelegt, ${updated} aktualisiert.`;
  $("quicktrack-result").classList.remove("hidden");
  showToast(`${entries.length} Artikel erfasst`);
  switchTab("vorrat");
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

  const dup = state.items.find((it) => normalize(it.name) === normalize(name));
  if (dup) {
    const dupUpdate = { updatedAt: serverTimestamp() };
    if (dup.active === false) {
      dupUpdate.active = true;
      $("new-item-hint").textContent = `„${dup.name}" war entfernt und ist jetzt wieder im Vorrat.`;
    } else {
      $("new-item-hint").textContent = `„${dup.name}" gibt es schon – öffne den Artikel zum Bearbeiten.`;
    }
    if (pendingBarcode && !dup.barcode) dupUpdate.barcode = pendingBarcode;
    await updateDoc(itemRef(dup.id), dupUpdate);
    $("new-item-hint").classList.remove("hidden");
    pendingBarcode = null;
    $("new-barcode-hint").classList.add("hidden");
    openItemModal(dup.id);
    switchTab("vorrat");
    return;
  }

  const data = {
    name, nameLower: normalize(name),
    unit: $("new-unit").value.trim() || "Stück",
    location: $("new-location").value.trim(),
    barcode: pendingBarcode || null,
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
  pendingBarcode = null;
  $("new-barcode-hint").classList.add("hidden");

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

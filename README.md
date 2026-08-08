# Stash – Setup-Anleitung

Eure App ist fertig gebaut. Es fehlen noch zwei Dinge, die nur ihr selbst einrichten könnt:
ein kostenloses Firebase-Projekt (für den Sync) und das Hosting auf GitHub Pages.
Zusammen dauert das etwa 10–15 Minuten, einmalig.

---

## 1. Firebase-Projekt anlegen (für den Sync)

1. Geh auf **console.firebase.google.com** und melde dich mit einem Google-Konto an.
2. **Projekt hinzufügen** → einen Namen vergeben (z. B. „Vorrat") → Google Analytics könnt ihr abwählen → Projekt erstellen.
3. Im Menü links: **Build → Firestore Database** → **Datenbank erstellen** → Standort wählen (z. B. `eur3 (europe-west)`) → im **Produktionsmodus** starten.
4. Im Menü links: **Build → Authentication** → **Los geht's** → Reiter **Sign-in method** → **E-Mail/Passwort** aktivieren → Speichern.
5. Im Menü links: **Projektübersicht → App hinzufügen → Web (</>)** → einen Namen vergeben, **Firebase Hosting NICHT** anhaken → App registrieren.
6. Jetzt zeigt Firebase einen Code-Block mit `firebaseConfig = { apiKey: ..., authDomain: ..., ... }`. Diese Werte braucht ihr im nächsten Schritt.

### Konfiguration eintragen

Öffnet die Datei `firebase-config.js` aus dem Projekt und ersetzt die Platzhalter mit euren Werten aus Schritt 6:

```js
window.FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

### Sicherheitsregeln einspielen

1. Zurück in der Firebase Console: **Firestore Database → Regeln**.
2. Ersetzt den vorhandenen Inhalt komplett durch den Inhalt der Datei **`firestore.rules`** aus diesem Projekt.
3. **Veröffentlichen** klicken.

**Sicherheitshinweis:** Diese Regeln sind bewusst einfach gehalten für eine private 2-Personen-Nutzung. Jede angemeldete Person kann Haushalte lesen (nötig, damit der Beitrittscode funktioniert), aber nur Mitglieder können Artikel sehen oder ändern. Der 6-stellige Code wirkt wie ein gemeinsames Geheimnis – nicht öffentlich teilen (z. B. nicht in sozialen Netzwerken posten).

---

## 2. Auf GitHub Pages hosten (als Chrome-/PWA-App installierbar)

1. Erstellt auf **github.com** ein neues, öffentliches Repository (z. B. `vorrat-app`).
2. Ladet **alle Dateien** aus diesem Projektordner hoch (inklusive `firebase-config.js` mit euren eingetragenen Werten, `index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`, `icons/`).
   - Einfachster Weg ohne Kommandozeile: auf der Repo-Seite **Add file → Upload files**, alles reinziehen, committen.
3. Im Repo: **Settings → Pages** → unter „Build and deployment" als Quelle **Deploy from a branch** wählen, Branch `main`, Ordner `/ (root)` → **Save**.
4. Nach 1–2 Minuten ist die App erreichbar unter:
   `https://DEIN-GITHUB-NAME.github.io/vorrat-app/`

### Als App installieren (Chrome, Android/Desktop)

- **Android/Desktop-Chrome:** Seite öffnen → Chrome zeigt automatisch „App installieren" (Symbol in der Adressleiste oder Menü ⋮ → „App installieren"). Danach liegt „Vorrat" wie eine normale App auf dem Homescreen bzw. im Startmenü.
- **iPhone/Safari:** Seite öffnen → Teilen-Symbol → „Zum Home-Bildschirm".

---

## 3. Als installierbare APK (Android)

Da eure App eine PWA ist, braucht ihr dafür keinen eigenen App-Code – **PWABuilder** von Microsoft wandelt jede PWA-URL automatisch in eine APK um:

1. Geh auf **pwabuilder.com**.
2. Eure GitHub-Pages-URL eingeben (siehe oben) → **Start**.
3. PWABuilder prüft die App (Manifest, Service Worker sind bereits vorbereitet) → auf **Package for stores** bzw. **Android** klicken.
4. **Generate** → die fertige `.apk`-Datei wird heruntergeladen.
5. Auf dem Android-Handy: Datei öffnen → einmalig „Installation aus unbekannten Quellen" erlauben → installieren.

Diese APK ist nicht im Play Store, sondern wird direkt installiert („Sideloading") – für den privaten Gebrauch zu zweit völlig ausreichend und kostenlos.

---

## 4. Loslegen zu zweit

1. Beide öffnen die App (installiert oder im Browser) und **registrieren** je ein eigenes Konto (E-Mail + Passwort, frei wählbar, muss keine echte, erreichbare Adresse sein).
2. **Eine Person** tippt auf „Neuen Haushalt erstellen" → bekommt einen 6-stelligen Code angezeigt.
3. **Die andere Person** tippt auf „Haushalt beitreten" und gibt den Code ein.
4. Ab jetzt seht ihr beide denselben Vorrat und dieselbe Einkaufsliste, live synchronisiert.

Den Code findet ihr später jederzeit wieder über das ⚙-Symbol oben rechts in der App.

---

## Was die App kann

- **Vorrat**: Bestände mit +/− oder direkter Zahleneingabe pflegen. Dauerartikel stehen immer oben.
- **Einkaufsliste**: füllt sich automatisch, sobald ein Artikel den Mindestbestand erreicht. Abhaken bucht die Menge automatisch zurück in den Vorrat.
- **Autovervollständigung**: beim Anlegen und beim Schnell-Hinzufügen auf der Einkaufsliste, inkl. Tippfehler-Toleranz und Vorschlägen aus bereits erfassten Artikeln.
- **Sync**: läuft über Firestore, funktioniert auch offline (Änderungen werden nachgeholt, sobald wieder Netz da ist).

## Grenzen dieser Version

Bewusst nicht enthalten, um die App einfach zu halten: Barcode-Scanner, Haltbarkeitsdaten, Preise/Statistik, Rezepte, mehr als zwei Personen, Push-Benachrichtigungen (stattdessen: Badge-Zähler auf dem „Liste"-Tab). Wenn ihr etwas davon später wollt, sagt einfach Bescheid.

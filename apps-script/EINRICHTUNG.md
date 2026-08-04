# Abfallprotokoll einrichten (einmalig, ca. 10 Minuten)

Jede Müllzählung wird zusätzlich in ein Google Sheet eingetragen. Das Sheet ist
damit immer vollständig – egal, wer auf welchem Gerät zählt.

Der Ablauf beim Senden einer Müllzählung:

1. Die Zeile wird ins Jahresblatt der Tabelle eingetragen, die Summenzeile
   aktualisiert.
2. Google verschickt eine Mail mit der kompletten Tabelle als **Excel-Anhang**.
3. Die App verschickt wie bisher ihre **Textmail über EmailJS**.

Das sind zwei Mails pro Zählung. Willst du nur eine, setze im Skript
`MAIL_MIT_ANHANG = false` (dann bleibt nur die gewohnte Textmail, die Tabelle
steht weiterhin im Sheet und wird nicht mehr verschickt).

Die Gaszählung ist von alldem nicht betroffen und läuft unverändert über
EmailJS.

## 1. Tabelle anlegen

1. In deinem Google-Konto ein neues Google Sheet anlegen.
2. Es sinnvoll benennen, z.B. **Abfallprotokoll Uhlenköper-Camp**.
3. Die Tabellenblätter musst du **nicht** vorbereiten – das Blatt für das
   jeweilige Jahr (`2026`, `2027`, …) legt das Skript selbst an, samt
   Überschriften und Summenzeile.

## 2. Skript einfügen

1. In der Tabelle: **Erweiterungen → Apps Script**.
2. Den vorhandenen Inhalt von `Code.gs` löschen und den kompletten Inhalt von
   [`Code.gs`](Code.gs) aus diesem Ordner einfügen.
3. Oben in der Datei die Empfängeradresse prüfen:
   ```javascript
   const EMPFAENGER = 'info@uhlenkoeper-camp.de';
   ```
4. Speichern.

## 3. Einmal testen

1. Im Editor oben die Funktion **`testZaehlung`** auswählen und auf **Ausführen**
   klicken.
2. Google fragt nach Berechtigungen (Tabelle bearbeiten, Mail senden). Bestätigen
   – bei der Warnung „Diese App ist nicht verifiziert" auf **Erweitert → Weiter
   zu … (unsicher)** gehen. Das ist dein eigenes Skript in deinem eigenen Konto.
3. Danach sollte in der Tabelle ein Blatt für das aktuelle Jahr stehen, mit einer
   Testzeile und einer Summenzeile, und eine Testmail im Postfach liegen.
4. Die Testzeile in der Tabelle wieder löschen.

## 4. Veröffentlichen

1. Im Editor oben rechts: **Bereitstellen → Neue Bereitstellung**.
2. Typ (Zahnrad) → **Web-App**.
3. Einstellungen:
   - *Ausführen als*: **Ich** (dein Konto)
   - *Zugriff*: **Jeder**
4. **Bereitstellen** klicken und die angezeigte **Web-App-URL** kopieren.
   Sie endet auf `/exec`.

> Der Zugriff muss auf „Jeder" stehen, damit die App ohne Google-Login senden
> kann. Wer diese URL kennt, könnte damit Zeilen in die Tabelle schreiben und
> Mails auslösen. Für ein Müllprotokoll ist das vertretbar – die URL sollte aber
> nicht öffentlich herumgereicht werden.

## 5. URL in der App eintragen

In `app.js` ganz oben:

```javascript
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/…/exec';
```

Danach committen und pushen. Solange das Feld leer ist, meldet die App beim
Senden einer Müllzählung „Google-Tabelle noch nicht eingerichtet" – und
verschickt dann auch die Textmail nicht, damit keine Zählung halb durchgeht.
Die Zählung bleibt in dem Fall in der App erhalten und kann unverändert erneut
gesendet werden; dieselbe Zählung landet auch bei mehrfachem Senden nur einmal
in der Tabelle.

## Wenn du das Skript später änderst

Änderungen werden erst mit **Bereitstellen → Bereitstellungen verwalten →
Bearbeiten (Stift) → Version: Neu → Bereitstellen** wirksam. Die URL bleibt
dabei gleich.

---

## Was in der Tabelle landet

Die App zählt Behälter, die Tabelle führt Liter. Umgerechnet wird in `app.js`
(`EXCEL_COLUMNS`):

| Spalte | Herkunft aus der Zählung |
|---|---|
| Restmüll in Liter (AWB) | Restmüll AWB 240 L × 240 |
| Restmüll in Litern (Kewitz) | Kewitz 660 L × 660 + Kewitz 240 L × 240 |
| Papier blaue Tonne 240l | Papier blaue Tonne × 240 |
| Kartons in Liter (umrechnen) | Kartons in cbm × 1000 (0,25 cbm = 250 L) |
| Gelbe Säcke in Liter | Gelbe Tonne 1100 L × 1100 + 240 L × 240 |
| Bioabfall in Liter | Biomüll 120 L × 120 |
| Glas in Kisten | Anzahl Kisten, unverändert |

**Elektro-/Sonder-Müll** und **Fett** haben in der Tabelle keine Spalte und
stehen nur im Text der Mail.

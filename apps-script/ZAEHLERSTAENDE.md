# Zählerstände in der Gaslager-App

Der neue Bereich **Zählerstände erfassen** ergänzt Gas und Müll im vorhandenen App-Design. Er erfasst Strom-, Wasser- und Gaszähler mit Zählernummer oder Standort, Datum, manuell eingetragenem Stand, Pflichtfoto und optionaler Notiz. Komma und Punkt sind als Dezimaltrennzeichen erlaubt. Es ist kein Camp-Zugangscode erforderlich.

Über **Ablesung hinzufügen** werden mehrere Zählerstände gesammelt. **Zur Übersicht** zeigt alle Einträge mit Fotos; Entwürfe lassen sich dort entfernen. **Fertig, senden** speichert die komplette Erfassung zentral und löst erst danach eine gemeinsame E-Mail an `info@uhlenkoeper-camp.de` aus. Sie enthält alle Werte, eine CSV-Übersicht und die Fotos als Anhänge. Gaszählung über EmailJS und Müllzählung über das Abfallprotokoll bleiben getrennt.

## Einmalige Aktivierung im bestehenden Google-Script

Das Repository aktualisiert den Quellcode, nicht automatisch die veröffentlichte Google-Web-App. Der aktuell konfigurierte Endpunkt muss deshalb einmal auf die neue Version gebracht werden. Bis dahin funktionieren lokale Entwürfe; die App verhindert ausdrücklich, dass Zählerdaten an die alte Abfall-Schnittstelle geschickt werden.

1. Das Google Sheet des bestehenden Abfallprotokolls öffnen und **Erweiterungen → Apps Script** wählen.
2. Die vorhandene Datei **Code.gs** durch die neue Version von [Code.gs](Code.gs) ersetzen. Das ergänzt lediglich die getrennten Zählerrouten; der bisherige Abfallablauf bleibt enthalten.
3. Im selben Script-Projekt eine zusätzliche Script-Datei **Zaehlerstaende.gs** anlegen und den Inhalt von [Zaehlerstaende.gs](Zaehlerstaende.gs) einfügen. Beide Dateien müssen im selben Projekt liegen; kein zweites `doPost` anlegen.
4. Im Editor **zaehlerEinrichten** ausführen und die zusätzlichen Drive-Berechtigungen für das ausführende Camp-Konto bestätigen. Diese Funktion erstellt den Speicherordner und prüft das Mailkontingent, ohne eine E-Mail zu versenden.
5. **Bereitstellen → Bereitstellungen verwalten → bestehende Web-App bearbeiten → Version: Neu → Bereitstellen**. Die bestehenden Einstellungen **Ausführen als: Ich**, **Zugriff: Jeder** und die vorhandene `/exec`-URL beibehalten. Eine neue URL ist nicht nötig; `GOOGLE_SCRIPT_URL` in `app.js` bleibt unverändert.
6. Die `/exec`-URL mit dem Zusatz `?feature=meters` öffnen. Die Antwort muss `{"ok":true,"feature":"meter-readings","version":1}` enthalten. Die normale URL ohne Parameter liefert weiterhin die bisherige Abfallprotokoll-Meldung.
7. In der Gaslager-App eine echte Testablesung erfassen und abschließen. Im Camp-Postfach Werte, CSV und Foto prüfen; außerdem den Drive-Ordner kontrollieren. Erneutes Senden derselben Erfassung darf keine zweite E-Mail erzeugen. Gas- und Müllablauf anschließend wie gewohnt prüfen.

## Speicherung und Wiederholungen

- Entwürfe und der Verlauf **Letzte Ablesungen** liegen in einer eigenen IndexedDB (`gaslager-meter-readings`). Bestehende Gas- und Müllverläufe bleiben in ihren bisherigen localStorage-Einträgen. Die lokalen Verläufe werden nicht aus der Spielwiese importiert. Browserdaten zu löschen kann lokale Entwürfe und den lokalen Verlauf entfernen.
- Beim Abschluss legt Google im ausführenden Konto den Ordner **Uhlenköper-Camp · Zählerstände** an. Darin erhält jede Erfassung einen eigenen Unterordner mit `erfassung.json`, CSV und JPEG-Fotos. Diese Dateien bleiben über Browser- und Gerätewechsel hinweg erhalten. Die Zählerstände werden nicht in die Abfall-Jahrestabellen geschrieben.
- Die Drive-Ordner werden nicht öffentlich freigegeben. Berechtigte Camp-Mitarbeitende können über Google Drive Zugriff erhalten; den Speicherordner nicht für „Jeder mit dem Link“ freigeben. Der Link in der E-Mail erfordert weiterhin passende Google-Berechtigungen, die Fotoanhänge sind direkt in der Mail enthalten.
- Der Script-Eigenschaftswert `ZAEHLER_DRIVE_FOLDER_ID` verweist auf den Hauptordner. Aufbewahrung, Backups und gegebenenfalls Löschung im Camp-Konto organisieren. Löschen lokaler Entwürfe entfernt keine zentralen Dateien oder bereits verschickten E-Mails.
- Eine Erfassung enthält höchstens 50 Ablesungen und 8 MB verkleinerte Fotos insgesamt. Einzelne Eingabefotos dürfen bis 15 MB groß sein; der Browser verkleinert sie auf maximal 1600 Pixel Kantenlänge und JPEG. Die Anhänge bleiben damit unter dem Apps-Script-Mailgrößenlimit.
- Die App erzeugt eine Erfassungsnummer und eine zufällige Empfangsbestätigung automatisch. Bei Wiederholungen und nach dem Neuladen bleiben diese gleich. Das Script prüft die Bestätigung sowie den Inhalt und speichert nur einen Hash der Bestätigung. Statusabfragen geben keine Werte oder Fotos öffentlich zurück.
- Ein Script-Lock verhindert gleichzeitige Abschlüsse. Feste Dateinamen verhindern zusätzliche Fotokopien bei Wiederholungen nach unterbrochenem Speichern. Erst wenn alle Dateien gespeichert sind, wird der Versand begonnen.
- Ist Googles tägliches Mailkontingent ausgeschöpft, bleiben die Dateien gespeichert und **Erneut senden** ist später möglich. Bei einem unklaren Fehler während des Mailversands wird kein automatischer zweiter Versand ausgelöst. **Versandstatus prüfen** fragt nur den Status ab; das Camp prüft das Postfach anhand der Erfassungsnummer. „E-Mail übergeben“ bestätigt die Rückmeldung des Versanddienstes, nicht den endgültigen Eingang im Postfach.

## Prüfen

Ohne Paketinstallation mit Node.js:

```sh
node --check meters.js
node --test tests/meter-backend.test.cjs
```

Die automatischen Tests simulieren Google-Dienste und versenden keine echten E-Mails. Sie prüfen Speicherung vor dem Versand, Foto- und CSV-Anhänge, feste Empfängeradresse, Eingabevalidierung, Empfangsbestätigungen, wiederholte Abschlüsse, Quoten-/Mailfehler sowie die bisherige Abfallroute. Das produktive Google-Deployment und echte Kamera-/Mailfunktionen müssen nach der Aktivierung geprüft werden.

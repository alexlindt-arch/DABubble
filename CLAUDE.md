# CLAUDE.md — DABubble

Diese Datei definiert die verbindlichen Regeln und Anforderungen für das Projekt DABubble. Halte dich bei jeder Code-Änderung an die Regeln in diesem Dokument. Die Feature-Spec am Ende beschreibt, was die App leisten muss.

## Design-Referenzen
Alle Design-Screens liegen unter `docs/design/`.

## Backend
Die Firebase-Architektur und Regeln sind in `FIREBASE.md` definiert.

## Projektkontext

DABubble ist eine Slack-artige Chat-Anwendung mit Channels, Direktnachrichten und Threads. Das Design wird 1:1 nach Figma umgesetzt.

---

## Verbindliche Coding-Regeln

Diese Regeln gelten für jede Funktion und jede Datei, die du schreibst oder änderst. Weiche nicht ohne Rückfrage davon ab.

### TypeScript / Clean Code

- Strict Mode im Compiler ist aktiviert und bleibt aktiviert.
- Eine Funktion erfüllt genau eine Aufgabe.
- Eine Funktion ist maximal 14 Zeilen lang. Ist sie länger, teile sie auf.
- Funktionsnamen sind beschreibend, kurz und prägnant.
- Keine Namenskonflikte mit Variablen oder reservierten Wörtern.
- camelCase verwenden (richtig: `shoppingCart`, falsch: `Shopping_Cart`).
- Funktionen und Variablen beginnen mit einem Kleinbuchstaben.
- 1–2 Leerzeilen Abstand zwischen Funktionen.
- Maximal 400 LOC (Lines of Code) pro Datei.

### Projektstruktur

Halte eine saubere, konsistente Ordnerstruktur:

- Ordner für Komponenten
- Ordner für Bilder (`img`)
- Shared-Ordner
- ggf. Pipes-Ordner

Optional: Code mit https://compodoc.app dokumentieren.

---

## Design-Regeln

- Design 1:1 wie in Figma umsetzen: gleiche Farben, gleiche Schriftarten, gleiche Abstände.
- Abstände zwischen Elementen sind überall gleich groß.
- Abstände zum Rand sind auf jeder Unterseite gleich groß.
- Favicon ist vorhanden.
- Buttons haben `cursor: pointer;`.
- Inputs und Buttons haben keinen Standard-Border.

## Responsiveness

- Jede Seite ist responsive bis 320px.
- Kein Scrollbalken bei kleineren Auflösungen.

## Formulare

- Eigene Form-Validation implementieren, inklusive Verhalten bei leeren Inputs.
- Spezifische Fehlermeldungen anzeigen — keine HTML5-Validierung und keine Alerts.
- Buttons berücksichtigen enabled / disabled / hover State.

---

## GitHub-Workflow

- GitHub von Anfang an nutzen und pflegen.
- Das gemeinsame Repository ist public.
- Regelmäßige Commits von jedem Teilnehmer (mindestens ein Commit pro Arbeitssitzung).
- Aussagekräftige Commit-Messages.
- `.gitignore` verwenden, um unnötige Dateien auszuschließen.
- Nach Abschluss der Gruppenarbeit forkt jedes Gruppenmitglied das Projekt.

---

## Definition of Done

Vor jedem Pull Request und vor der Abgabe müssen alle folgenden Punkte erfüllt sein:

- Alle Links und Buttons funktionieren.
- Keine Fehlermeldungen in der Console.
- Die Seite funktioniert auch im Inkognito-Modus.
- Design stimmt mit Figma überein (Farben, Abstände, Schriftarten).
- Jede Seite ist responsive bis 320px, kein horizontaler Scrollbalken.
- Alle Coding-Regeln oben sind eingehalten.

---

## Feature-Spec

Die App muss die folgenden Anforderungen erfüllen. Jede User Story nennt das Ziel und die konkreten Akzeptanzkriterien.

### Benutzeraccount & Administration

**Registrierung** — Neue Benutzer registrieren sich, um Zugang zur App zu erhalten.
- Registrierungsformular für E-Mail-Adresse, Name und Passwort.
- Bei falscher Eingabe (ungültige E-Mail, schwaches Passwort) erscheint eine spezifische Fehlermeldung.
- Benutzer wählen bei Registrierung ihren Avatar aus.
- Optional: Registrierung mit Google-Account.
- Optional: Bestätigungs-E-Mail bei erfolgreicher Registrierung.

**Anmeldung** — Benutzer melden sich an, um auf ihr Konto zuzugreifen.
- Eingabe von E-Mail-Adresse und Passwort.
- Bei korrekten Daten erhält der Benutzer Zugriff auf sein Konto.
- Bei falscher Eingabe erscheint eine Fehlermeldung unter dem betroffenen Eingabefeld.

**Passwort vergessen** — Benutzer stellen ihr Konto wieder her.
- Option "Passwort vergessen" auf der Anmeldeseite.
- Benutzer gibt E-Mail-Adresse ein und erhält Anweisungen zum Zurücksetzen per E-Mail.
- Nach dem Zurücksetzen ist Anmeldung mit dem neuen Passwort möglich.

**Profil bearbeiten** — Benutzer halten ihre Daten aktuell.
- Option in den Benutzereinstellungen zum Bearbeiten des Profils.
- Name ist im Bearbeitungsmodus änderbar.
- Nach dem Speichern werden die aktualisierten Daten im Profil angezeigt.
- Avatar ist aus einer vorgegebenen Auswahl änderbar.

**Menü minimieren** — Benutzer schaffen mehr Platz für die Chat-Ansicht.
- Option (Icon oder Button), um das Menü mit Channels und Direktnachrichten zu minimieren.
- Beim Minimieren nimmt die Chat-Ansicht mehr Platz ein.
- Option zum Wiedermaximieren des Menüs.
- Auf mobilen Geräten separate Ansichten für Menü und Chat; Auswahl eines Channels/einer DM wechselt zur Chat-Ansicht.

**Online-Status (optional)** — Benutzer sehen, wer verfügbar ist.
- Jeder Benutzer hat einen sichtbaren Status (online / offline / abwesend).
- Der Status aktualisiert sich in Echtzeit basierend auf der Aktivität.
- Der Status ist neben Name oder Profilbild in Chats, Kanälen und im Menü sichtbar.

### Schreiben in Channels & Direktnachrichten

**Direktnachrichten schreiben** — Persönlicher Austausch zwischen Mitgliedern.
- DM-Konversation mit einem beliebigen Benutzer startbar.
- Direktnachrichten sind nur für die beteiligten Benutzer sichtbar.
- Beim Wechsel vom Channel wird der Fokus automatisch ins Inputfeld gesetzt.

**Auf Nachrichten reagieren (Emoticons)** — Schnelles Feedback per Reaktion.
- Jede Nachricht ist mit einem Emoticon reagierbar.
- Vorgegebene Emoticons zur Auswahl; die zwei zuletzt genutzten sind direkt über die Aktionsleiste auswählbar (ohne bisherige Nutzung: Standard-Emoticons wie in Figma).
- Reaktionen werden unter der Nachricht angezeigt und sind für alle sichtbar.
- Sichtbar, wer mit welchem Emoticon reagiert hat.
- Limit Desktop: maximal 20 Reaktionen sichtbar.
- Limit Mobil (+ Desktop-Thread): maximal 7 Reaktionen sichtbar + "+ x weitere"-Button.

**Nachrichten mit Emoticons schreiben** — Ausdrucksstärkere Nachrichten.
- Während der Eingabe ist ein Emoticon aus einer Liste einfügbar.
- Eingefügte Emoticons erscheinen in der gesendeten Nachricht.
- Andere Benutzer sehen die Emoticons in den Nachrichten.
- Mehrfach genutzte Emoticons werden mit Zählerstand dargestellt.

**Tagging mit "#" und "@"** — Schnelle Auswahl von Kanälen und Mitgliedern.
- Eingabe von "#" im Adressfeld zeigt alle existierenden Kanäle in einem Dropdown.
- Eingabe von "@" im Adressfeld zeigt alle Mitglieder im aktuellen Space in einem Dropdown.

**Threads starten** — Fokussierte Diskussionen ohne den Hauptchat zu überladen.
- Klick auf eine Nachricht bietet die Option "Thread starten" (per Icon), in Kanälen und privaten Chats.
- Andere Benutzer antworten im Thread und setzen die Diskussion fort.
- Threads sind klar gekennzeichnet und von normalen Nachrichten unterscheidbar.
- Eingabe von "#" oder "@" öffnet ein Dropdown zum Taggen.

**Nachrichten suchen** — Ältere Diskussionen leicht wiederfinden.
- Suche nach Stichworten in allen Chats und Kanälen.
- Suchergebnisse zeigen den Kontext der gefundenen Nachrichten.
- Eingabe von "#" oder "@" öffnet ein Dropdown; weitere Eingabe filtert und verfeinert die Ergebnisse.
- Die Liste aktualisiert sich in Echtzeit.

### Management von Channels

**Channels erstellen** — Spezifische Gruppendiskussionen führen.
- Neue Channels mit Namen und Beschreibung erstellbar.
- Der Ersteller kann andere Benutzer einladen.
- Alle Mitglieder können Nachrichten senden und empfangen.
- Duplikat-Prüfung bei der Namensgebung.

**Benutzer nachträglich hinzufügen** — Alle relevanten Personen einbeziehen.
- Jedes Mitglied kann weitere Benutzer hinzufügen.
- Die Option ist im Channel-Menü verfügbar.
- Ein oder mehrere Benutzer aus einer Liste auswählbar und hinzufügbar.

**Kanal verlassen** — Nicht mehr relevante Kanäle abbestellen.
- Jedes Mitglied kann den Kanal verlassen.
- Die Option ist in den Kanaleinstellungen verfügbar.

**Channel bearbeiten** — Genaue und relevante Kommunikationsstruktur.
- Zugriff auf die Channel-Einstellungen zum Bearbeiten von Name und Beschreibung.
- Änderungen sind sofort wirksam und für alle Mitglieder sichtbar.
- Duplikat-Prüfung bei der Namensgebung.
- Warnungen / Fehlermeldungen, wenn Änderungen nicht erfolgreich waren.

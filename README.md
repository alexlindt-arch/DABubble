<div align="center">

<img src="public/assets/img/Logo.svg" alt="DABubble Logo" width="260">

# DABubble

**Ein Slack-inspirierter Echtzeit-Teamchat, gebaut mit Angular 22 und Firebase.**

Channels, Direktnachrichten, Threads, Emoji-Reaktionen und Volltextsuche — als Single-Page-App, die ab 320 px funktioniert.

[![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com)
[![Vitest](https://img.shields.io/badge/getestet%20mit-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-blue.svg)](LICENSE.txt)

[Live-Demo](#live-demo) · [Funktionen](#funktionen) · [Tech-Stack](#tech-stack) · [Erste Schritte](#erste-schritte) · [Architektur](#architektur)

</div>

---

## Über das Projekt

DABubble ist ein Team-Messenger, der als Gruppenprojekt an der **Developer Akademie** entstanden ist. Die Oberfläche setzt ein Figma-Design 1:1 um; die Anwendungsschicht basiert vollständig auf Angular-Standalone-Components und Signals und spricht Firebase direkt über das offizielle JavaScript-SDK an.

Das Projekt folgt durchgängig einer verbindlichen Coding-Richtlinie: TypeScript im Strict Mode, eine Aufgabe pro Funktion, maximal 14 Zeilen pro Funktion und höchstens 400 Zeilen pro Datei.

## Live-Demo

https://dabubble-3258.developerakademie.net/angular-projects/dabubble/login

**Ausprobieren ohne Registrierung?** Die Anmeldeseite bietet eine **Gast-Sitzung**: ein temporäres Konto mit vollem Zugriff auf alle Funktionen. Die Sitzung und sämtliche dabei erzeugten Daten werden nach 15 Minuten automatisch gelöscht.

## Funktionen

### Benutzerkonto & Administration

| Funktion | Beschreibung |
| --- | --- |
| **Registrierung** | E-Mail, Name, Passwort und Avatar-Auswahl, mit spezifischen Fehlermeldungen direkt unter dem betroffenen Feld |
| **Anmeldung** | E-Mail/Passwort, **Google Sign-In** oder zeitlich begrenzte Gast-Sitzung |
| **Passwort zurücksetzen** | Reset-Mail plus eigener In-App-Handler, der den `oobCode` prüft, bevor ein neues Passwort akzeptiert wird |
| **Profil** | Anzeigename und Avatar bearbeiten, Profile anderer Mitglieder ansehen, eigenes Konto löschen |
| **Online-Status** | Live-Status `online` / `abwesend` / `offline` neben jedem Avatar |

### Nachrichten

| Funktion | Beschreibung |
| --- | --- |
| **Channels** | Channel-Unterhaltungen in Echtzeit über Firestore-Snapshot-Listener |
| **Direktnachrichten** | Private 1:1-Chats inklusive Notizen an sich selbst, mit Ungelesen-Markierung |
| **Threads** | Antworten an jeder Nachricht — in Channels wie in privaten Chats |
| **Reaktionen** | Emoji-Reaktionen mit Tooltip, wer reagiert hat; die zwei zuletzt genutzten Emojis bleiben in der Aktionsleiste |
| **Emoji-Picker** | Emojis beim Schreiben einer Nachricht einfügen |
| **Tagging** | `#` öffnet ein Channel-Dropdown, `@` ein Mitglieder-Dropdown — beide filtern während der Eingabe |
| **Bearbeiten** | Eigene Nachrichten lassen sich in Channels und Direktnachrichten nachträglich ändern |
| **Suche** | Entprellte globale Suche über Channels, Mitglieder und Nachrichteninhalte, per Tastatur navigierbar |

### Channel-Verwaltung

- Channels mit Name und Beschreibung anlegen, inklusive Duplikatprüfung
- Alle Mitglieder des Workspace auf einmal einladen oder gezielt per Suchfeld auswählen
- Weitere Personen später über den Channel-Header hinzufügen
- Name und Beschreibung bearbeiten — Änderungen sind für alle Mitglieder sofort sichtbar
- Channel über die Channel-Einstellungen verlassen

### Oberfläche

- Einklappbare Sidebar; auf Mobilgeräten getrennte Menü- und Chat-Ansicht
- Responsiv bis **320 px**, ohne horizontalen Scrollbalken
- Animierter Intro-Screen, einmal pro Browser-Sitzung
- Toast-Benachrichtigungen mit optionalem Signalton
- Impressum und Datenschutzerklärung

## Tech-Stack

| Ebene | Technologie |
| --- | --- |
| Framework | Angular 22 — Standalone Components, Signals (`signal`, `computed`, `input`, `effect`) |
| Sprache | TypeScript 6 (Strict Mode) |
| Styling | SCSS, Variable Font Nunito, eigene Design-Tokens |
| Backend | Firebase Authentication, Cloud Firestore (Echtzeit über `onSnapshot`) |
| SDK | Firebase JS SDK v12 direkt eingebunden — ohne `@angular/fire` |
| Tests | Vitest |
| Werkzeuge | Angular CLI, Prettier |
| Hosting | Firebase Hosting (SPA-Rewrites) oder jeder statische Host per mitgelieferter `.htaccess` |

## Erste Schritte

### Voraussetzungen

- **Node.js 22+** und npm 10+
- Ein Firebase-Projekt mit aktivierter **Authentication** (E-Mail/Passwort + Google) und **Cloud Firestore**
- Optional die [Firebase CLI](https://firebase.google.com/docs/cli) für das Deployment

### Installation

```bash
git clone https://github.com/alexlindt-arch/DABubble.git
cd DABubble
npm install
```

### Firebase konfigurieren

Die Zugangsdaten liegen **nicht** im Repository. Lege `src/environments/environment.ts` (steht in `.gitignore`) mit deinen eigenen Projektschlüsseln an:

```ts
export const environment = {
  production: false,
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
    measurementId: 'YOUR_MEASUREMENT_ID',
  },
};
```

Trage anschließend deine Projekt-ID in [.firebaserc](.firebaserc) ein und veröffentliche die Security Rules:

```bash
firebase deploy --only firestore:rules
```

### Entwicklung

```bash
npm start      # Entwicklungsserver auf http://localhost:4200
npm test       # Unit-Tests (Vitest)
npm run build  # Produktions-Build nach dist/dabubble/browser
```

## Deployment

**Firebase Hosting** (Konfiguration in [firebase.json](firebase.json)):

```bash
npm run build
firebase deploy
```

**Statisches Hosting in einem Unterordner** — `npm run build:deploy` setzt den passenden Base-Href, die mitgelieferte `.htaccess` sorgt für den SPA-Fallback, damit Deep Links wie `/imprint` einen Reload überstehen:

```bash
npm run build:deploy
```

## Architektur

```
src/
├─ app/
│  ├─ components/            # 18 eigenständige Feature-Komponenten
│  │  ├─ login/ register/ choose-avatar/ send-mail/ reset-password/
│  │  ├─ main-layout/ sidebar/ chat/ thread/ new-message/
│  │  ├─ create-channel-dialog/ add-people-dialog/ members-dialog/
│  │  └─ channel-info-dialog/ profile-dialog/ guest-login-dialog/
│  │     intro-animation/ notification/
│  ├─ services/              # auth, user, channel, message, notification,
│  │                         # guest-session, guest-cleanup, recent-reaction + authGuard
│  ├─ shared/                # Avatare, Emojis, Viewport-Helfer, message-time-Pipe,
│  │                         # Impressum, Datenschutz
│  ├─ models.ts              # UserProfile, Channel, Message, DirectConversation
│  ├─ firebase.ts            # zentrale Firebase-App-Instanz
│  └─ app.routes.ts          # Routing mit authGuard auf /main
├─ environments/             # Firebase-Zugangsdaten (nicht im Repo)
└─ styles.scss
public/                      # Favicon, Schriften, Icons, Avatare, Sounds
```

### Datenmodell

```
users/{uid}                                 name, email, avatar, status
channels/{id}                               name, description, createdBy, members[], createdAt
channels/{id}/messages/{id}                 text, senderId, timestamp, reactions{},
                                            threadCount, parentId?, editedAt?
directChats/{conversationId}                members[], createdAt, lastMessage, lastMessageAt,
                                            lastSenderId, messageCount, lastReadAt{}
directChats/{conversationId}/messages/{id}  text, senderId, timestamp, reactions{}, parentId?
```

Die ID einer Direktnachrichten-Konversation ergibt sich deterministisch aus beiden alphabetisch sortierten Teilnehmer-UIDs — so landen beide Seiten immer im selben Dokument. Die Zugriffsrechte stehen in [firestore.rules](firestore.rules).

### Architekturentscheidungen

- **Kein `@angular/fire`.** Die Services holen sich `getFirestore(firebaseApp)` bzw. `getAuth(firebaseApp)` selbst. Das hält die Abhängigkeiten schlank und den Datenfluss nachvollziehbar.
- **Signals statt RxJS in den Komponenten.** Snapshot-Listener schreiben in Signals; das zurückgegebene `Unsubscribe` wird in `ngOnDestroy` oder über das Cleanup eines `effect` aufgeräumt.
- **Eigener Passwort-Reset-Handler** anstelle der Firebase-Standardseite, damit der gesamte Ablauf im Design der App bleibt.

## Mitwirken

Das Projekt ist eine Kursarbeit, Pull Requests und Issues sind aber willkommen. Bitte halte dich an die etablierten Konventionen im Repository (striktes TypeScript, Funktionen mit genau einer Aufgabe und höchstens 14 Zeilen, camelCase und maximal 400 Zeilen pro Datei).

## Team

| Name | GitHub |
| --- | --- |
| Julia Schäffer | [@edda14](https://github.com/edda14) |
| Joannis Ballos | [@ball82](https://github.com/ball82) |
| Alexander Lindt | [@alexlindt-arch](https://github.com/alexlindt-arch) |

## Lizenz

Veröffentlicht unter der MIT-Lizenz — siehe [LICENSE.txt](LICENSE.txt).

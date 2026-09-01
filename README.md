# DABubble

Slack-ähnliche Team-Chat-App – Gruppenprojekt der Developer Akademie.
Gebaut mit Angular 22 (Standalone Components, TypeScript strict) und Firebase (Auth + Firestore).

## Live-Demo

_folgt nach dem Deployment_

## Features

**Benutzeraccount & Administration**
- Registrierung mit E-Mail, Name, Passwort und Avatar-Auswahl
- Login / Logout, Fehlermeldungen direkt unter dem betroffenen Eingabefeld
- Passwort vergessen & zurücksetzen per E-Mail
- Profil bearbeiten (Name und Avatar)
- Sidebar minimieren/maximieren, eigene Ansichten für Mobile
- Online-Status der Benutzer (optional)

**Schreiben in Channels & Direktnachrichten**
- Direktnachrichten zwischen zwei Benutzern
- Emoji-Reaktionen auf Nachrichten (zuletzt genutzte zuerst)
- Emojis in Nachrichten schreiben
- Tagging von Channels (`#`) und Mitgliedern (`@`)
- Threads zu einzelnen Nachrichten
- Suche über alle Channels und Chats

**Management von Channels**
- Channel erstellen mit Name und Beschreibung (Duplikat-Prüfung)
- Mitglieder nachträglich hinzufügen
- Channel verlassen
- Name und Beschreibung bearbeiten

## Tech-Stack

| Bereich | Technologie |
| --- | --- |
| Frontend | Angular 22, TypeScript (strict), SCSS |
| Backend | Firebase Authentication, Cloud Firestore |
| Hosting | Firebase Hosting |

## Setup

```bash
git clone https://github.com/<user>/dabubble.git
cd dabubble
npm install
```

Firebase-Zugangsdaten in `src/environments/environment.ts` eintragen
(Firebase Console → Projekteinstellungen → Web-App).

```bash
npm start        # Dev-Server auf http://localhost:4200
npm run build    # Production-Build nach dist/dabubble
```

## Deployment

```bash
npm run build
firebase deploy
```

## Projektstruktur

```
src/
├─ app/
│  ├─ components/       # Feature-Komponenten
│  │  ├─ auth/          # login, register, choose-avatar, forgot-password, reset-password
│  │  └─ main/          # main-layout, sidebar, chat, thread, new-message
│  ├─ shared/           # wiederverwendbare Komponenten (message-item, message-input, emoji-picker)
│  ├─ services/         # auth, user, channel, message
│  ├─ models/           # Interfaces für User, Channel, Message
│  ├─ guards/           # Routen-Schutz
│  ├─ pipes/            # eigene Pipes
│  └─ firebase.ts       # Firebase-Initialisierung
├─ environments/        # Firebase-Konfiguration
└─ index.html
public/
├─ img/                 # Bilder
└─ icons/               # Icons
```

## Team

| Name | GitHub |
| --- | --- |
| Alexander Lindt | [@alexlindt-arch](https://github.com/alexlindt-arch) |

## Lizenz

MIT – siehe [LICENSE.txt](LICENSE.txt)

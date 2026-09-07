# DABubble — Firestore Datenstruktur & Angular-Anbindung

## Uebersicht

Firestore ist eine NoSQL-Datenbank mit drei Ebenen:

- **Collection** = Ordner, enthaelt Dokumente
- **Document** = Datensatz mit Feldern (Key-Value-Paare)
- **Subcollection** = Collection innerhalb eines Dokuments

---

## Collections

### 1. users/{uid}

Jeder registrierte User bekommt ein Dokument. Die Document-ID ist die UID aus Firebase Auth.

| Feld     | Typ    | Beschreibung                        |
|----------|--------|-------------------------------------|
| name     | string | Anzeigename                         |
| email    | string | E-Mail-Adresse                      |
| avatar   | string | Dateiname, z.B. "avatar_1.png"      |
| status   | string | "online", "offline" oder "away"     |

### 2. channels/{autoId}

Jeder Channel ist ein Dokument mit automatisch generierter ID.

| Feld        | Typ       | Beschreibung                       |
|-------------|-----------|-------------------------------------|
| name        | string    | Channel-Name (unique)               |
| description | string    | Beschreibung                        |
| createdBy   | string    | UID des Erstellers                  |
| members     | array     | Liste von UIDs                      |
| createdAt   | timestamp | Erstellungszeitpunkt                |

#### 2.1 channels/{id}/messages/{autoId} (Subcollection)

Nachrichten innerhalb eines Channels.

| Feld        | Typ       | Beschreibung                                          |
|-------------|-----------|-------------------------------------------------------|
| text        | string    | Nachrichtentext                                       |
| senderId    | string    | UID des Absenders                                     |
| timestamp   | timestamp | Sendezeitpunkt                                        |
| reactions   | map       | z.B. `{ "👍": ["uid1", "uid2"], "🙂": ["uid3"] }`   |
| threadCount | number    | Anzahl Antworten im Thread                            |

#### 2.2 channels/{id}/messages/{id}/threads/{autoId} (Sub-Subcollection)

Thread-Antworten auf eine Nachricht.

| Feld      | Typ       | Beschreibung       |
|-----------|-----------|--------------------|
| text      | string    | Antworttext        |
| senderId  | string    | UID des Absenders  |
| timestamp | timestamp | Sendezeitpunkt     |

### 3. directMessages/{conversationId}/messages/{autoId}

Direktnachrichten zwischen zwei Usern.

**conversationId** = beide UIDs alphabetisch sortiert, mit Unterstrich verbunden.
Beispiel: User `abc123` schreibt an User `xyz789` → conversationId = `abc123_xyz789`

So findet man die Konversation immer eindeutig, egal wer sie oeffnet.

| Feld      | Typ       | Beschreibung       |
|-----------|-----------|--------------------|
| text      | string    | Nachrichtentext    |
| senderId  | string    | UID des Absenders  |
| timestamp | timestamp | Sendezeitpunkt     |

---

## Ablaeufe

### Registrierung

1. User fuellt Formular aus (Name, E-Mail, Passwort, Avatar)
2. `createUserWithEmailAndPassword(auth, email, password)` wird aufgerufen
3. **Firebase Auth** erstellt einen Account und speichert E-Mail + Passwort (gehasht, fuer dich unsichtbar)
4. Auth gibt eine **UID** zurueck (z.B. `abc123xyz`)
5. Mit dieser UID wird ein Dokument in **Firestore** `users/{uid}` erstellt: Name, Avatar, Status
6. Passwort geht **nie** an Firestore — nur an Auth

### Login

1. User gibt E-Mail und Passwort ein
2. `signInWithEmailAndPassword(auth, email, password)` wird aufgerufen
3. **Firebase Auth** prueft intern ob die Kombination stimmt
4. **Falsch:** Auth wirft einen Error → Fehlermeldung im Formular anzeigen
5. **Richtig:** Auth gibt die UID zurueck
6. Mit der UID wird das Profil aus **Firestore** `users/{uid}` geladen (Name, Avatar, Status)
7. App zeigt Dashboard

### Passwort-Reset

1. User klickt "Passwort vergessen" und gibt E-Mail ein
2. `sendPasswordResetEmail(auth, email)` → Firebase schickt automatisch eine E-Mail
3. User klickt Link in der E-Mail, setzt neues Passwort
4. Nur Firebase Auth ist beteiligt, Firestore wird nicht beruehrt

### Nachricht senden (Echtzeit)

1. User A tippt Nachricht und drueckt Senden
2. `addDoc()` schreibt ein neues Dokument in `channels/{id}/messages/` mit text, senderId, timestamp
3. Firestore erstellt das Dokument
4. **onSnapshot()** — alle Clients die diesen Channel offen haben, bekommen sofort ein Update (Observable feuert)
5. User B sieht die Nachricht ohne Reload, in Echtzeit

Dasselbe Prinzip gilt fuer Direktnachrichten (`directMessages/{convId}/messages/`) und Threads (`messages/{id}/threads/`).

---

## Angular-Anbindung

### Schritt 1: AngularFire installieren

```bash
ng add @angular/fire
```

Waehl Authentication und Firestore aus wenn gefragt.

### Schritt 2: Environment konfigurieren

In `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: 'DEIN_API_KEY',
    authDomain: 'DEIN_PROJEKT.firebaseapp.com',
    projectId: 'DEIN_PROJEKT',
    storageBucket: 'DEIN_PROJEKT.appspot.com',
    messagingSenderId: '...',
    appId: '...'
  }
};
```

**Wichtig:** `environment.ts` in `.gitignore` aufnehmen.

### Schritt 3: App konfigurieren

In `app.config.ts`:

```typescript
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { environment } from '../environments/environment';

export const appConfig = {
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
  ]
};
```

### Schritt 4: Auth-Service

```typescript
import { Injectable, inject } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         sendPasswordResetEmail, signOut } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  async register(email: string, password: string, name: string, avatar: string) {
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    await this.createUserDoc(cred.user.uid, name, email, avatar);
    return cred;
  }

  async login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  async resetPassword(email: string) {
    return sendPasswordResetEmail(this.auth, email);
  }

  async logout() {
    return signOut(this.auth);
  }

  private async createUserDoc(uid: string, name: string, email: string, avatar: string) {
    const userRef = doc(this.firestore, 'users', uid);
    await setDoc(userRef, { name, email, avatar, status: 'online' });
  }
}
```

### Schritt 5: Channel-Service (Beispiel)

```typescript
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, collectionData, doc, updateDoc,
         query, where, orderBy, Timestamp } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class ChannelService {
  private firestore = inject(Firestore);

  async createChannel(name: string, description: string, creatorUid: string) {
    const channelsRef = collection(this.firestore, 'channels');
    return addDoc(channelsRef, {
      name,
      description,
      createdBy: creatorUid,
      members: [creatorUid],
      createdAt: Timestamp.now()
    });
  }

  getChannels() {
    const channelsRef = collection(this.firestore, 'channels');
    return collectionData(channelsRef, { idField: 'id' });
  }

  async addMember(channelId: string, uid: string) {
    const channelRef = doc(this.firestore, 'channels', channelId);
    // arrayUnion() aus firestore importieren
    return updateDoc(channelRef, { members: arrayUnion(uid) });
  }
}
```

### Schritt 6: Nachrichten mit Echtzeit (onSnapshot)

```typescript
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, collectionData, query,
         orderBy, Timestamp } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class MessageService {
  private firestore = inject(Firestore);

  getMessages(channelId: string) {
    const messagesRef = collection(this.firestore, 'channels', channelId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    return collectionData(q, { idField: 'id' });
    // collectionData gibt ein Observable zurueck
    // das bei jeder Aenderung automatisch feuert (Echtzeit)
  }

  async sendMessage(channelId: string, text: string, senderId: string) {
    const messagesRef = collection(this.firestore, 'channels', channelId, 'messages');
    return addDoc(messagesRef, {
      text,
      senderId,
      timestamp: Timestamp.now(),
      reactions: {},
      threadCount: 0
    });
  }
}
```

### Schritt 7: DirectMessage-Service

```typescript
@Injectable({ providedIn: 'root' })
export class DirectMessageService {
  private firestore = inject(Firestore);

  getConversationId(uid1: string, uid2: string): string {
    return [uid1, uid2].sort().join('_');
  }

  getMessages(conversationId: string) {
    const ref = collection(this.firestore, 'directMessages', conversationId, 'messages');
    const q = query(ref, orderBy('timestamp', 'asc'));
    return collectionData(q, { idField: 'id' });
  }

  async sendMessage(conversationId: string, text: string, senderId: string) {
    const ref = collection(this.firestore, 'directMessages', conversationId, 'messages');
    return addDoc(ref, {
      text,
      senderId,
      timestamp: Timestamp.now()
    });
  }
}
```

---

## Security Rules (Startpunkt)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Spaeter verfeinern: z.B. nur Channel-Members duerfen Channel-Messages lesen, nur beteiligte User duerfen DMs lesen.

---

## Wichtige Konzepte

**collectionData()** gibt ein Observable zurueck. In der Komponente mit `| async` Pipe subscriben oder in `ngOnInit` manuell subscriben.

**Timestamp.now()** statt `new Date()` verwenden — Firestore speichert eigene Timestamps.

**idField: 'id'** — fuegt die automatisch generierte Document-ID als Feld `id` zum Objekt hinzu. Ohne das hast du keinen Zugriff auf die ID.

**arrayUnion / arrayRemove** — zum Hinzufuegen/Entfernen von Eintraegen in Arrays (z.B. members).

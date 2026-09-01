# DABubble

Slack-inspired team chat app – group project at Developer Akademie.
Built with Angular 22 (standalone components, TypeScript strict mode) and Firebase (Auth + Firestore).

## Live Demo

_coming soon after deployment_

## Features

**User Account & Administration**
- Sign up with email, name, password and avatar selection
- Login / logout with specific error messages below the affected input field
- Forgot password and password reset via email
- Edit profile (name and avatar)
- Collapsible sidebar, separate views on mobile
- Online status of users (optional)

**Messaging in Channels & Direct Messages**
- Direct messages between two users
- Emoji reactions on messages (most recently used first)
- Emojis inside messages
- Tagging of channels (`#`) and members (`@`)
- Threads on individual messages
- Search across all channels and chats

**Channel Management**
- Create channels with name and description (duplicate check)
- Add members afterwards
- Leave a channel
- Edit name and description

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | Angular 22, TypeScript (strict), SCSS |
| Backend | Firebase Authentication, Cloud Firestore |
| Hosting | Firebase Hosting |

## Setup

```bash
git clone https://github.com/alexlindt-arch/DABubble.git
cd DABubble
npm install
```

Add your Firebase credentials to `src/environments/environment.ts`
(Firebase Console → Project settings → Web app) and set your project ID in `.firebaserc`.

```bash
npm start        # dev server at http://localhost:4200
npm run build    # production build to dist/dabubble
```

## Deployment

```bash
npm run build
firebase deploy
```

## Project Structure

```
src/
├─ app/
│  ├─ components/       # login, register, choose-avatar, forgot-password, reset-password,
│  │                    # main-layout, sidebar, chat, thread, new-message
│  ├─ shared/           # reusable components and pipes
│  ├─ services/         # auth, user, channel, message + auth.guard
│  ├─ models.ts         # interfaces for user, channel, message
│  ├─ firebase.ts       # Firebase initialization
│  └─ app.ts / app.html / app.routes.ts
├─ environments/        # Firebase configuration
└─ index.html
public/
└─ img/                 # images and icons
```

## Team

| Name | GitHub |
| --- | --- |
| Julia Schäffer | [@edda14](https://github.com/edda14) |
| Joannis Ballos | [@ball82](https://github.com/ball82) |
| Alexander Lindt | [@alexlindt-arch](https://github.com/alexlindt-arch) |

## License

MIT – see [LICENSE.txt](LICENSE.txt)

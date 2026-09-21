/**
 * Vorlage für die lokale Firebase-Konfiguration.
 *
 * Diese Datei nach `environment.ts` kopieren und mit den Schlüsseln des
 * eigenen Firebase-Projekts füllen. `environment.ts` steht in `.gitignore`
 * und gehört nicht ins Repository.
 */
export const environment = {
  production: false,
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'YOUR_PROJECT.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT.firebasestorage.app',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
    measurementId: 'YOUR_MEASUREMENT_ID',
  },
};

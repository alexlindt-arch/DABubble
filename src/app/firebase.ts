import { initializeApp } from 'firebase/app';
import { environment } from '../environments/environment';

export const firebaseApp = initializeApp(environment.firebase);

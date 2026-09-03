import { initializeApp } from 'firebase/app';
import { environment } from '../enviroments/enviroment';

export const firebaseApp = initializeApp(environment.firebase);

import { Injectable } from '@angular/core';
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  UserCredential,
} from 'firebase/auth';
import { firebaseApp } from '../firebase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth: Auth = getAuth(firebaseApp);

  login(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  loginWithGoogle(): Promise<UserCredential> {
    return signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  loginAsGuest(): Promise<UserCredential> {
    return signInAnonymously(this.auth);
  }
}

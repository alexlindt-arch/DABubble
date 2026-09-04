import { Injectable } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  UserCredential,
} from 'firebase/auth';
import { doc, Firestore, getFirestore, setDoc } from 'firebase/firestore';
import { firebaseApp } from '../firebase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth: Auth = getAuth(firebaseApp);
  private readonly firestore: Firestore = getFirestore(firebaseApp);

  login(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  loginWithGoogle(): Promise<UserCredential> {
    return signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  loginAsGuest(): Promise<UserCredential> {
    return signInAnonymously(this.auth);
  }

  register(email: string, password: string): Promise<UserCredential> {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  get currentUserId(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  saveUserProfile(name: string, email: string, avatar: string): Promise<void> {
    const uid = this.currentUserId;
    if (!uid) return Promise.reject(new Error('Kein angemeldeter Benutzer.'));
    const userRef = doc(this.firestore, 'users', uid);
    return setDoc(userRef, { name, email, avatar, status: 'online' });
  }
}

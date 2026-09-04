import { Injectable } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  deleteUser,
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

  async register(email: string, password: string, name: string): Promise<UserCredential> {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    try {
      await this.createUserDocument(credential.user.uid, name, email);
      return credential;
    } catch (error) {
      await this.rollbackRegistration(credential);
      throw error;
    }
  }

  private createUserDocument(uid: string, name: string, email: string): Promise<void> {
    const userRef = doc(this.firestore, 'users', uid);
    return setDoc(userRef, { name, email, avatar: '', status: 'online' });
  }

  private async rollbackRegistration(credential: UserCredential): Promise<void> {
    await deleteUser(credential.user).catch(() => undefined);
  }
}

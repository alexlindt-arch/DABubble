import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  DocumentReference,
  Firestore,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import { firebaseApp } from '../firebase';
import { AppUser, UserProfile, UserStatus } from '../models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly firestore: Firestore = getFirestore(firebaseApp);

  async loadUser(uid: string): Promise<AppUser | null> {
    const snapshot = await getDoc(this.userRef(uid));
    if (!snapshot.exists()) return null;
    return { uid, ...(snapshot.data() as UserProfile) };
  }

  async saveUser(uid: string, profile: UserProfile): Promise<AppUser> {
    await setDoc(this.userRef(uid), profile);
    return { uid, ...profile };
  }

  async ensureUser(uid: string, fallback: UserProfile): Promise<AppUser> {
    const existing = await this.loadUser(uid);
    if (!existing) return this.saveUser(uid, fallback);
    return existing;
  }

  updateStatus(uid: string, status: UserStatus): Promise<void> {
    return updateDoc(this.userRef(uid), { status });
  }

  watchUser(uid: string, onChange: (user: AppUser | null) => void): Unsubscribe {
    return onSnapshot(this.userRef(uid), (snapshot) => {
      if (!snapshot.exists()) return onChange(null);
      onChange({ uid, ...(snapshot.data() as UserProfile) });
    });
  }

  watchUsers(onChange: (users: AppUser[]) => void): Unsubscribe {
    return onSnapshot(collection(this.firestore, 'users'), (snapshot) => {
      const users = snapshot.docs.map(user => ({ uid: user.id, ...(user.data() as UserProfile) }));
      onChange(users);
    });
  }

  private userRef(uid: string): DocumentReference {
    return doc(this.firestore, 'users', uid);
  }
}

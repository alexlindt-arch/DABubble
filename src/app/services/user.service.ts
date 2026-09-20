import { Injectable } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  DocumentReference,
  Firestore,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import { firebaseApp } from '../firebase';
import { AppUser, UserProfile, UserStatus } from '../models';

@Injectable({ providedIn: 'root' })
/** Provides user data and operations. */
export class UserService {
  private readonly firestore: Firestore = getFirestore(firebaseApp);

  /** Handles loadUser. */
  async loadUser(uid: string): Promise<AppUser | null> {
    const snapshot = await getDoc(this.userRef(uid));
    if (!snapshot.exists()) return null;
    return this.toAppUser(uid, snapshot.data());
  }

  /** Handles loadUsers. */
  async loadUsers(): Promise<AppUser[]> {
    const snapshot = await getDocs(collection(this.firestore, 'users'));
    return snapshot.docs.map(user => this.toAppUser(user.id, user.data()));
  }

  /** Handles saveUser. */
  async saveUser(uid: string, profile: UserProfile): Promise<AppUser> {
    await setDoc(this.userRef(uid), profile);
    return { uid, ...profile };
  }

  /** Handles ensureUser. */
  async ensureUser(uid: string, fallback: UserProfile): Promise<AppUser> {
    const existing = await this.loadUser(uid);
    if (!existing) return this.saveUser(uid, fallback);
    return existing;
  }

  /** Handles updateStatus. */
  updateStatus(uid: string, status: UserStatus): Promise<void> {
    return updateDoc(this.userRef(uid), { status });
  }

  /** Handles deleteUserProfile. */
  deleteUserProfile(uid: string): Promise<void> {
    return deleteDoc(this.userRef(uid));
  }

  /** Handles watchUser. */
  watchUser(uid: string, onChange: (user: AppUser | null) => void): Unsubscribe {
    return onSnapshot(this.userRef(uid), (snapshot) => {
      if (!snapshot.exists()) return onChange(null);
      onChange(this.toAppUser(uid, snapshot.data()));
    });
  }

  /** Handles watchUsers. */
  watchUsers(onChange: (users: AppUser[]) => void): Unsubscribe {
    return onSnapshot(collection(this.firestore, 'users'), (snapshot) => {
      const users = snapshot.docs.map(user => this.toAppUser(user.id, user.data()));
      onChange(users);
    });
  }

  /** Handles userRef. */
  private userRef(uid: string): DocumentReference {
    return doc(this.firestore, 'users', uid);
  }


  /** Fills missing fields in incomplete documents so the UI never receives undefined values. */
  /** Handles toAppUser. */
  private toAppUser(uid: string, data: DocumentData | undefined): AppUser {
    const profile = (data ?? {}) as Partial<UserProfile>;
    const user: AppUser = {
      uid,
      name: profile.name ?? '',
      email: profile.email ?? '',
      avatar: profile.avatar ?? '',
      status: profile.status ?? 'offline',
    };
    if (profile.guestUntil) user.guestUntil = profile.guestUntil;
    return user;
  }
}

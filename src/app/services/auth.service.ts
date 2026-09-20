import { inject, Injectable, signal } from '@angular/core';
import {
  Auth,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  signOut,
  User,
  UserCredential,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { Timestamp, Unsubscribe } from 'firebase/firestore';
import { firebaseApp } from '../firebase';
import { AppUser, UserProfile } from '../models';
import { GUEST_SESSION_MS } from '../shared/guest-session';
import { UserService } from './user.service';

const DEFAULT_AVATAR = 'Property 1=Frederik Beck.png';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth: Auth = getAuth(firebaseApp);
  private readonly userService = inject(UserService);
  private readonly profile = signal<AppUser | null>(null);
  private profileWatcher: Unsubscribe | null = null;
  /** Während einer laufenden Anmeldung darf kein alter Stand aus Firestore dazwischenfunken. */
  private activating = false;
  private markReady: () => void = () => {};
  private readonly ready = new Promise<void>((resolve) => (this.markReady = resolve));

  readonly currentUser = this.profile.asReadonly();

  constructor() {
    onAuthStateChanged(this.auth, (user) => void this.syncProfile(user));
  }

  get currentUserId(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  get isLoggedIn(): boolean {
    return this.auth.currentUser !== null;
  }

  get isGuest(): boolean {
    return this.auth.currentUser?.isAnonymous ?? false;
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  async login(email: string, password: string): Promise<AppUser | null> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    return this.activateProfile(credential.user, nameFromEmail(email));
  }

  async loginWithGoogle(): Promise<AppUser | null> {
    const credential = await signInWithPopup(this.auth, new GoogleAuthProvider());
    return this.activateProfile(credential.user, 'Google-Nutzer');
  }

  async loginAsGuest(): Promise<AppUser | null> {
    this.activating = true;
    try {
      const credential = await signInAnonymously(this.auth);
      return await this.activateGuest(credential.user.uid);
    } finally {
      this.activating = false;
    }
  }

  /** Jede Gast-Anmeldung startet mit einem frischen 15-Minuten-Fenster. */
  private async activateGuest(uid: string): Promise<AppUser | null> {
    try {
      const guest = await this.userService.saveUser(uid, buildGuestProfile());
      this.setProfile(guest);
      return guest;
    } catch (error) {
      console.error('Gast-Profil konnte nicht gespeichert werden:', error);
      return null;
    }
  }

  /**
   * Verschickt die Reset-Mail. Ohne ActionCodeSettings gilt die Aktions-URL aus der
   * Firebase-Konsole - eine Continue-URL im Code müsste zusätzlich freigegeben sein.
   * Firebase meldet keinen Fehler bei unbekannter Adresse.
   */
  sendResetMail(email: string): Promise<void> {
    return sendPasswordResetEmail(this.auth, email);
  }

  verifyResetCode(oobCode: string): Promise<string> {
    return verifyPasswordResetCode(this.auth, oobCode);
  }

  confirmReset(oobCode: string, newPassword: string): Promise<void> {
    return confirmPasswordReset(this.auth, oobCode, newPassword);
  }

  register(email: string, password: string): Promise<UserCredential> {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  async saveUserProfile(name: string, email: string, avatar: string): Promise<void> {
    const uid = this.currentUserId;
    if (!uid) return Promise.reject(new Error('Kein angemeldeter Benutzer.'));
    const saved = await this.userService.saveUser(uid, { name, email, avatar, status: 'online' });
    this.setProfile(saved);
  }

  async logout(): Promise<void> {
    const uid = this.currentUserId;
    if (uid) await this.userService.updateStatus(uid, 'offline').catch(() => undefined);
    this.setProfile(null);
    return signOut(this.auth);
  }

  async deleteCurrentAccount(): Promise<void> {
    await deleteUser(this.deletionUser());
    this.setProfile(null);
  }

  /** Profil laden ist optional: Die Anmeldung gilt auch, wenn Firestore nicht antwortet. */
  private async activateProfile(user: User, fallbackName: string): Promise<AppUser | null> {
    try {
      return await this.loadOrCreateProfile(user, fallbackName);
    } catch (error) {
      console.error('Profil konnte nicht aus Firestore geladen werden:', error);
      return null;
    }
  }

  private deletionUser(): User {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Kein angemeldeter Benutzer.');
    return user;
  }

  private async loadOrCreateProfile(user: User, fallbackName: string): Promise<AppUser> {
    const profile = await this.userService.ensureUser(user.uid, buildProfile(user, fallbackName));
    if (profile.status !== 'online') await this.userService.updateStatus(user.uid, 'online');
    const active: AppUser = { ...profile, status: 'online' };
    this.setProfile(active);
    return active;
  }

  private async syncProfile(user: User | null): Promise<void> {
    if (this.activating) return this.markReady();
    if (!user) {
      this.setProfile(null);
    } else if (this.profile()?.uid !== user.uid) {
      this.setProfile(await this.loadProfileSafely(user.uid));
    }
    this.markReady();
  }

  private async loadProfileSafely(uid: string): Promise<AppUser | null> {
    try {
      return await this.userService.loadUser(uid);
    } catch (error) {
      console.error('Profil konnte nicht aus Firestore geladen werden:', error);
      return null;
    }
  }

  private setProfile(user: AppUser | null): void {
    this.stopWatching();
    this.profile.set(user);
    if (!user) return;
    this.profileWatcher = this.userService.watchUser(user.uid, (u) => this.profile.set(u));
  }

  private stopWatching(): void {
    this.profileWatcher?.();
    this.profileWatcher = null;
  }
}

function buildProfile(user: User, fallbackName: string): UserProfile {
  return {
    name: user.displayName ?? fallbackName,
    email: user.email ?? '',
    avatar: DEFAULT_AVATAR,
    status: 'online',
  };
}

function buildGuestProfile(): UserProfile {
  return {
    name: 'Gast',
    email: '',
    avatar: DEFAULT_AVATAR,
    status: 'online',
    guestUntil: Timestamp.fromMillis(Date.now() + GUEST_SESSION_MS),
  };
}

function nameFromEmail(email: string): string {
  return email.split('@')[0] || 'Unbekannt';
}

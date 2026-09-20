import { effect, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AppUser } from '../models';
import { AuthService } from './auth.service';
import { GuestCleanupService } from './guest-cleanup.service';

/**
 * Wacht über die Gast-Sitzung: Läuft das 15-Minuten-Fenster ab, werden alle Daten des
 * Gastes gelöscht und der Gast landet wieder auf der Anmeldeseite.
 */
@Injectable({ providedIn: 'root' })
/** Provides guestsession data and operations. */
export class GuestSessionService {
  private readonly authService = inject(AuthService);
  private readonly cleanup = inject(GuestCleanupService);
  private readonly router = inject(Router);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ending = false;
  private swept = false;

  /** Handles constructor. */
  constructor() {
    effect(() => this.syncSession(this.authService.currentUser()));
  }

  /** Handles syncSession. */
  private syncSession(user: AppUser | null): void {
    this.stopTimer();
    if (!user) return void (this.swept = false);
    this.sweepOnce(user.uid);
    if (!user.guestUntil) return;
    const remaining = user.guestUntil.toMillis() - Date.now();
    if (remaining <= 0) return void this.endSession();
    this.timer = setTimeout(() => void this.endSession(), remaining);
  }

  /** Einmal pro Anmeldung: Cleans up guest remnants from sessions whose browser closed too early. */
  /** Handles sweepOnce. */
  private sweepOnce(ownUid: string): void {
    if (this.swept) return;
    this.swept = true;
    this.cleanup.sweepExpiredGuests(ownUid).catch(() => undefined);
  }

  /** Handles endSession. */
  private async endSession(): Promise<void> {
    const uid = this.authService.currentUserId;
    if (this.ending || !uid) return;
    this.ending = true;
    await this.cleanup.removeOwnGuestData(uid).catch(error => this.reportFailure(error));
    await this.closeAccount();
    await this.router.navigate(['/login'], { queryParams: { guest: 'expired' } });
    this.ending = false;
  }

  /**
   * Das anonyme Konto gehört mit weg. Nach 15 Minuten gilt die Anmeldung dafür oft als zu alt;
   * dann bleibt ein leeres Konto zurück, dessen Daten aber längst gelöscht sind.
   */
  /** Handles closeAccount. */
  private async closeAccount(): Promise<void> {
    await this.authService.deleteCurrentAccount().catch(() => undefined);
    await this.authService.logout().catch(() => undefined);
  }

  /** Handles reportFailure. */
  private reportFailure(error: unknown): void {
    console.error('Gast-Daten konnten nicht vollständig gelöscht werden:', error);
  }

  /** Handles stopTimer. */
  private stopTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

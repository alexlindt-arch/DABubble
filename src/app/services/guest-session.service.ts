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
export class GuestSessionService {
  private readonly authService = inject(AuthService);
  private readonly cleanup = inject(GuestCleanupService);
  private readonly router = inject(Router);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ending = false;

  constructor() {
    effect(() => this.syncSession(this.authService.currentUser()));
  }

  private syncSession(user: AppUser | null): void {
    this.stopTimer();
    if (!user?.guestUntil) return;
    const remaining = user.guestUntil.toMillis() - Date.now();
    if (remaining <= 0) return void this.endSession();
    this.timer = setTimeout(() => void this.endSession(), remaining);
  }

  private async endSession(): Promise<void> {
    const uid = this.authService.currentUserId;
    if (this.ending || !uid) return;
    this.ending = true;
    await this.cleanup.removeGuestData(uid).catch(error => this.reportFailure(error));
    await this.closeAccount();
    await this.router.navigate(['/login'], { queryParams: { guest: 'expired' } });
    this.ending = false;
  }

  /** Das anonyme Konto selbst gehört mit weg; klappt das nicht, bleibt zumindest die Abmeldung. */
  private async closeAccount(): Promise<void> {
    try {
      await this.authService.deleteCurrentAccount();
    } catch (error) {
      this.reportFailure(error);
    }
    await this.authService.logout().catch(error => this.reportFailure(error));
  }

  private reportFailure(error: unknown): void {
    console.error('Gast-Daten konnten nicht vollständig gelöscht werden:', error);
  }

  private stopTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

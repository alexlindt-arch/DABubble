import { Component, HostListener, output } from '@angular/core';
import { GUEST_SESSION_MINUTES } from '../../shared/guest-session';

/** Klärt vor der Gast-Anmeldung, was der Gast darf und wie lange seine Daten bleiben. */
@Component({
  selector: 'app-guest-login-dialog',
  imports: [],
  templateUrl: './guest-login-dialog.html',
  styleUrl: './guest-login-dialog.scss',
})
export class GuestLoginDialog {
  readonly sessionMinutes = GUEST_SESSION_MINUTES;
  closed = output<void>();
  confirmed = output<void>();

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  closeWithEscape(): void {
    this.closed.emit();
  }
}

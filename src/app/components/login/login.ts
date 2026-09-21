import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AppUser } from '../../shared/models';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { GuestLoginDialog } from '../guest-login-dialog/guest-login-dialog';

@Component({
  imports: [ReactiveFormsModule, RouterLink, GuestLoginDialog],
  selector: 'app-login',
  styleUrls: ['./login.scss', './login-responsive.scss'],
  templateUrl: './login.html',
})
/** Provides login, Google authentication, and guest access actions. */
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);

  readonly passwordReset = this.route.snapshot.queryParamMap.get('reset') === 'success';

  readonly guestExpired = this.route.snapshot.queryParamMap.get('guest') === 'expired';

  readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  isSubmitting = false;
  loginError = '';
  guestDialogOpen = false;

  /** Returns the validation message for the email field. */
  get emailErrorMessage(): string {
    const email = this.loginForm.controls.email;
    if (email.hasError('required')) return 'Bitte gib deine E-Mail-Adresse ein.';
    if (email.hasError('email')) return 'Bitte gib eine gültige E-Mail-Adresse ein.';
    return '';
  }

  /** Returns the validation message for the password field. */
  get passwordErrorMessage(): string {
    const password = this.loginForm.controls.password;
    if (password.hasError('required')) return 'Bitte gib dein Passwort ein.';
    return '';
  }

  /** Validates the form and starts the email/password login flow. */
  submitLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.performLogin();
  }

  /** Starts authentication with the configured Google provider. */
  loginWithGoogle(): void {
    this.isSubmitting = true;
    this.loginError = '';
    this.authService
      .loginWithGoogle()
      .then((user) => this.goToMain(user))
      .catch(() => (this.loginError = 'Die Google-Anmeldung ist fehlgeschlagen.'))
      .finally(() => (this.isSubmitting = false));
  }

  /** Opens the guest-login confirmation dialog. */
  openGuestDialog(): void {
    this.guestDialogOpen = true;
  }

  /** Closes the guest-login confirmation dialog. */
  closeGuestDialog(): void {
    this.guestDialogOpen = false;
  }

  /** Closes the dialog and starts anonymous authentication. */
  confirmGuestLogin(): void {
    this.guestDialogOpen = false;
    this.loginAsGuest();
  }

  /** Authenticates the current visitor as a guest user. */
  private loginAsGuest(): void {
    this.isSubmitting = true;
    this.loginError = '';
    this.authService
      .loginAsGuest()
      .then((user) => this.openGuestWorkspace(user))
      .catch((error: unknown) => (this.loginError = this.mapGuestError(error)))
      .finally(() => (this.isSubmitting = false));
  }

  /** Opens the main workspace after a successful guest login. */
  private openGuestWorkspace(guest: AppUser | null): void {
    if (!guest) {
      this.loginError = 'Das Gast-Profil konnte nicht angelegt werden. Bitte versuche es erneut.';
      return;
    }
    this.notifications.success('Du wurdest erfolgreich als Gast angemeldet.');
    this.router.navigateByUrl('/main');
  }

  /** Maps guest-login failures to user-facing messages. */
  private mapGuestError(error: unknown): string {
    const code = error instanceof FirebaseError ? error.code : '';
    console.error('Gäste-Login fehlgeschlagen:', error);
    if (code === 'auth/admin-restricted-operation' || code === 'auth/operation-not-allowed') {
      return 'Die anonyme Anmeldung ist im Firebase-Projekt nicht aktiviert.';
    }
    if (code === 'auth/network-request-failed') return 'Keine Verbindung zum Server.';
    return 'Die Gäste-Anmeldung ist fehlgeschlagen.';
  }

  /** Sends the submitted credentials to the authentication service. */
  private performLogin(): void {
    const { email, password } = this.loginForm.getRawValue();
    this.isSubmitting = true;
    this.loginError = '';
    this.authService
      .login(email ?? '', password ?? '')
      .then((user) => this.goToMain(user))
      .catch((error: unknown) => (this.loginError = this.mapLoginError(error)))
      .finally(() => (this.isSubmitting = false));
  }

  /** Routes authenticated users to avatar setup or the main workspace. */
  private goToMain(user: AppUser | null): void {
    if (user && !user.avatar) return void this.router.navigate(['/choose-avatar'], { state: user });
    this.notifications.success('Du wurdest erfolgreich angemeldet.');
    this.router.navigateByUrl('/main');
  }

  /** Maps credential-login failures to user-facing messages. */
  private mapLoginError(error: unknown): string {
    const code = error instanceof FirebaseError ? error.code : '';
    if (code === 'auth/invalid-email') return 'Bitte gib eine gültige E-Mail-Adresse ein.';
    if (code === 'auth/too-many-requests') return 'Zu viele Versuche. Bitte warte einen Moment.';
    if (code === 'auth/network-request-failed') return 'Keine Verbindung zum Server.';
    if (code.startsWith('auth/')) return 'E-Mail-Adresse oder Passwort ist falsch.';
    console.error('Login fehlgeschlagen:', error);
    return 'Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.';
  }
}

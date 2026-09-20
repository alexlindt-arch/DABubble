import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AppUser } from '../../models';
import { AuthService } from '../../services/auth.service';
import { GuestLoginDialog } from '../guest-login-dialog/guest-login-dialog';

@Component({
  imports: [ReactiveFormsModule, RouterLink, GuestLoginDialog],
  selector: 'app-login',
  styleUrl: './login.scss',
  templateUrl: './login.html',
})
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Kommt der Nutzer frisch vom Passwort-Reset, bestätigt der Login den Wechsel. */
  readonly passwordReset = this.route.snapshot.queryParamMap.get('reset') === 'success';

  /** Nach Ablauf der Gast-Sitzung landet der Gast mit diesem Hinweis wieder hier. */
  readonly guestExpired = this.route.snapshot.queryParamMap.get('guest') === 'expired';

  readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  isSubmitting = false;
  loginError = '';
  guestDialogOpen = false;

  get emailErrorMessage(): string {
    const email = this.loginForm.controls.email;
    if (email.hasError('required')) return 'Bitte gib deine E-Mail-Adresse ein.';
    if (email.hasError('email')) return 'Bitte gib eine gültige E-Mail-Adresse ein.';
    return '';
  }

  get passwordErrorMessage(): string {
    const password = this.loginForm.controls.password;
    if (password.hasError('required')) return 'Bitte gib dein Passwort ein.';
    return '';
  }

  submitLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.performLogin();
  }

  loginWithGoogle(): void {
    this.isSubmitting = true;
    this.loginError = '';
    this.authService
      .loginWithGoogle()
      .then((user) => this.goToMain(user))
      .catch(() => (this.loginError = 'Die Google-Anmeldung ist fehlgeschlagen.'))
      .finally(() => (this.isSubmitting = false));
  }

  openGuestDialog(): void {
    this.guestDialogOpen = true;
  }

  closeGuestDialog(): void {
    this.guestDialogOpen = false;
  }

  confirmGuestLogin(): void {
    this.guestDialogOpen = false;
    this.loginAsGuest();
  }

  private loginAsGuest(): void {
    this.isSubmitting = true;
    this.loginError = '';
    this.authService
      .loginAsGuest()
      .then((user) => this.openGuestWorkspace(user))
      .catch((error: unknown) => (this.loginError = this.mapGuestError(error)))
      .finally(() => (this.isSubmitting = false));
  }

  /** Ohne Gast-Profil fehlt das 15-Minuten-Fenster, darum führt kein Weg in die App. */
  private openGuestWorkspace(guest: AppUser | null): void {
    if (!guest) {
      this.loginError = 'Das Gast-Profil konnte nicht angelegt werden. Bitte versuche es erneut.';
      return;
    }
    this.router.navigateByUrl('/main');
  }

  private mapGuestError(error: unknown): string {
    const code = error instanceof FirebaseError ? error.code : '';
    console.error('Gäste-Login fehlgeschlagen:', error);
    if (code === 'auth/admin-restricted-operation' || code === 'auth/operation-not-allowed') {
      return 'Die anonyme Anmeldung ist im Firebase-Projekt nicht aktiviert.';
    }
    if (code === 'auth/network-request-failed') return 'Keine Verbindung zum Server.';
    return 'Die Gäste-Anmeldung ist fehlgeschlagen.';
  }

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

  private goToMain(user: AppUser | null): void {
    if (user && !user.avatar) return void this.router.navigate(['/choose-avatar'], { state: user });
    this.router.navigateByUrl('/main');
  }

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

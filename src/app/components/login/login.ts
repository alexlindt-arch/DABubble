import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AppUser } from '../../models';
import { AuthService } from '../../services/auth.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-login',
  styleUrl: './login.scss',
  templateUrl: './login.html',
})
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  isSubmitting = false;
  loginError = '';

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

  loginAsGuest(): void {
    this.isSubmitting = true;
    this.loginError = '';
    this.authService
      .loginAsGuest()
      .then((user) => this.goToMain(user))
      .catch(() => (this.loginError = 'Die Gäste-Anmeldung ist fehlgeschlagen.'))
      .finally(() => (this.isSubmitting = false));
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

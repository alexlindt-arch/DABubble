import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
      .then(() => this.router.navigateByUrl('/main'))
      .catch(() => (this.loginError = 'Die Google-Anmeldung ist fehlgeschlagen.'))
      .finally(() => (this.isSubmitting = false));
  }

  loginAsGuest(): void {
    this.isSubmitting = true;
    this.loginError = '';
    this.authService
      .loginAsGuest()
      .then(() => this.router.navigateByUrl('/main'))
      .catch(() => (this.loginError = 'Die Gäste-Anmeldung ist fehlgeschlagen.'))
      .finally(() => (this.isSubmitting = false));
  }

  private performLogin(): void {
    const { email, password } = this.loginForm.getRawValue();
    this.isSubmitting = true;
    this.loginError = '';
    this.authService
      .login(email ?? '', password ?? '')
      .then(() => this.router.navigateByUrl('/main'))
      .catch(() => (this.loginError = 'E-Mail-Adresse oder Passwort ist falsch.'))
      .finally(() => (this.isSubmitting = false));
  }
}

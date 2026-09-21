import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';


@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-register',
  styleUrl: './register.scss',
  templateUrl: './register.html',
})
/** Handles account registration and navigation to avatar selection. */
export class Register {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  readonly registerForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    acceptPrivacy: [false, [Validators.requiredTrue]],
  });

  isSubmitting = false;
  registerError = '';

  /** Returns the validation message for the name field. */
  get nameErrorMessage(): string {
    const name = this.registerForm.controls.name;
    if (name.hasError('required')) return 'Bitte gib deinen Benutzernamen ein.';
    if (name.hasError('minlength')) return 'Bitte gib einen längeren Benutzernamen ein.';
    return '';
  }

  /** Returns the validation message for the email field. */
  get emailErrorMessage(): string {
    const email = this.registerForm.controls.email;
    if (email.hasError('required')) return 'Bitte gib deine E-Mail-Adresse ein.';
    if (email.hasError('email')) return 'Bitte gib eine gültige E-Mail-Adresse ein.';
    return '';
  }

  /** Returns the validation message for the password field. */
  get passwordErrorMessage(): string {
    const password = this.registerForm.controls.password;
    if (password.hasError('required')) return 'Bitte gib ein Passwort ein.';
    if (password.hasError('minlength')) return 'Das Passwort muss mindestens 6 Zeichen haben.';
    return '';
  }

  /** Returns the validation message for the privacy-consent field. */
  get privacyErrorMessage(): string {
    const acceptPrivacy = this.registerForm.controls.acceptPrivacy;
    if (acceptPrivacy.hasError('required')) return 'Bitte stimme der Datenschutzerklärung zu.';
    return '';
  }

  /** Navigates back to the login page. */
  goBack(): void {
    this.router.navigateByUrl('/login');
  }

  /** Validates the form and starts the registration flow. */
  submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.performRegister();
  }

  /** Sends the submitted credentials to the authentication service. */
  private performRegister(): void {
    const { name, email, password } = this.registerForm.getRawValue();
    this.isSubmitting = true;
    this.registerError = '';
    this.authService
      .register(email ?? '', password ?? '')
      .then(() => this.goToAvatarSelection(name ?? '', email ?? ''))
      .catch((error: unknown) => (this.registerError = this.mapRegisterError(error)))
      .finally(() => (this.isSubmitting = false));
  }

  /** Opens avatar selection for the newly registered user. */
  private goToAvatarSelection(name: string, email: string): void {
    this.notifications.success('Dein Konto wurde erfolgreich erstellt.');
    this.router.navigate(['/choose-avatar'], { state: { name, email } });
  }

  /** Maps registration failures to user-facing messages. */
  private mapRegisterError(error: unknown): string {
    const code = error instanceof FirebaseError ? error.code : '';
    if (code === 'auth/email-already-in-use') return 'Diese E-Mail-Adresse wird bereits verwendet.';
    if (code === 'auth/invalid-email') return 'Bitte gib eine gültige E-Mail-Adresse ein.';
    if (code === 'auth/weak-password') return 'Das Passwort ist zu schwach.';
    return 'Die Registrierung ist fehlgeschlagen. Bitte versuche es erneut.';
  }
}

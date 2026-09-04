import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AuthService } from '../../services/auth.service';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-register',
  styleUrl: './register.scss',
  templateUrl: './register.html',
})
export class Register {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly registerForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    acceptPrivacy: [false, [Validators.requiredTrue]],
  });

  isSubmitting = false;
  registerError = '';

  get nameErrorMessage(): string {
    const name = this.registerForm.controls.name;
    if (name.hasError('required')) return 'Bitte gib deinen Namen ein.';
    if (name.hasError('minlength')) return 'Bitte gib deinen vollständigen Namen ein.';
    return '';
  }

  get emailErrorMessage(): string {
    const email = this.registerForm.controls.email;
    if (email.hasError('required')) return 'Bitte gib deine E-Mail-Adresse ein.';
    if (email.hasError('email')) return 'Bitte gib eine gültige E-Mail-Adresse ein.';
    return '';
  }

  get passwordErrorMessage(): string {
    const password = this.registerForm.controls.password;
    if (password.hasError('required')) return 'Bitte gib ein Passwort ein.';
    if (password.hasError('minlength')) return 'Das Passwort muss mindestens 6 Zeichen haben.';
    return '';
  }

  get privacyErrorMessage(): string {
    const acceptPrivacy = this.registerForm.controls.acceptPrivacy;
    if (acceptPrivacy.hasError('required')) return 'Bitte stimme der Datenschutzerklärung zu.';
    return '';
  }

  goBack(): void {
    this.router.navigateByUrl('/login');
  }

  submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.performRegister();
  }

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

  private goToAvatarSelection(name: string, email: string): void {
    this.router.navigate(['/choose-avatar'], { state: { name, email } });
  }

  private mapRegisterError(error: unknown): string {
    const code = error instanceof FirebaseError ? error.code : '';
    if (code === 'auth/email-already-in-use') return 'Diese E-Mail-Adresse wird bereits verwendet.';
    if (code === 'auth/invalid-email') return 'Bitte gib eine gültige E-Mail-Adresse ein.';
    if (code === 'auth/weak-password') return 'Das Passwort ist zu schwach.';
    return 'Die Registrierung ist fehlgeschlagen. Bitte versuche es erneut.';
  }
}

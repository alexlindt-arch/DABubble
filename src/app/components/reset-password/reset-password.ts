import { Component, inject, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AuthService } from '../../services/auth.service';

const MIN_PASSWORD_LENGTH = 8;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return password === confirm ? null : { passwordMismatch: true };
}

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-reset-password',
  styleUrl: './reset-password.scss',
  templateUrl: './reset-password.html',
})
export class ResetPassword implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private oobCode = '';

  readonly resetForm = this.formBuilder.group(
    {
      password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  isSubmitting = false;
  linkInvalid = false;
  resetError = '';

  /** Der Code wird geprüft, bevor der Nutzer tippt - sonst merkt er den toten Link zu spät. */
  ngOnInit(): void {
    this.oobCode = this.route.snapshot.queryParamMap.get('oobCode') ?? '';
    if (!this.oobCode) return this.markLinkInvalid();
    this.authService.verifyResetCode(this.oobCode).catch(() => this.markLinkInvalid());
  }

  get passwordErrorMessage(): string {
    const password = this.resetForm.controls.password;
    if (password.hasError('required')) return 'Bitte gib ein neues Passwort ein.';
    if (password.hasError('minlength')) return 'Das Passwort muss mindestens 8 Zeichen haben.';
    return '';
  }

  get confirmErrorMessage(): string {
    const confirm = this.resetForm.controls.confirm;
    if (confirm.hasError('required')) return 'Bitte bestätige dein neues Passwort.';
    if (this.resetForm.hasError('passwordMismatch')) return 'Ihre Kennwörter stimmen nicht überein';
    return '';
  }

  goBack(): void {
    this.router.navigateByUrl('/login');
  }

  submitNewPassword(): void {
    if (this.linkInvalid) return;
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    this.applyNewPassword();
  }

  private applyNewPassword(): void {
    const password = this.resetForm.controls.password.value ?? '';
    this.isSubmitting = true;
    this.resetError = '';
    this.authService
      .confirmReset(this.oobCode, password)
      .then(() => this.router.navigate(['/login'], { queryParams: { reset: 'success' } }))
      .catch((error: unknown) => (this.resetError = mapResetError(error)))
      .finally(() => (this.isSubmitting = false));
  }

  private markLinkInvalid(): void {
    this.linkInvalid = true;
    this.resetForm.disable();
    this.resetError = 'Der Link ist ungültig oder abgelaufen. Fordere eine neue E-Mail an.';
  }
}

function mapResetError(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'auth/expired-action-code') return 'Der Link ist abgelaufen.';
  if (code === 'auth/invalid-action-code') return 'Der Link wurde bereits verwendet.';
  if (code === 'auth/weak-password') return 'Das Passwort ist zu schwach.';
  if (code === 'auth/network-request-failed') return 'Keine Verbindung zum Server.';
  console.error('Passwort zurücksetzen fehlgeschlagen:', error);
  return 'Das Passwort konnte nicht geändert werden. Bitte versuche es erneut.';
}

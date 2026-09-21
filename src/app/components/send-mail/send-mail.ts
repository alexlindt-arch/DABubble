import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { AuthService } from '../../services/auth.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-send-mail',
  styleUrls: ['./send-mail.scss', './send-mail-responsive.scss'],
  templateUrl: './send-mail.html',
})
/** Handles password-reset email requests. */
export class SendMail {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly sendMailForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
  });

  isSubmitting = false;
  sendError = '';
  mailSent = false;

  /** Returns the validation message for the email field. */
  get emailErrorMessage(): string {
    const email = this.sendMailForm.controls.email;
    if (email.hasError('required')) return 'Bitte gib deine E-Mail-Adresse ein.';
    if (email.hasError('email')) return 'Diese E-Mail-Adresse ist leider ungültig.';
    return '';
  }

  /** Navigates back to the login page. */
  goBack(): void {
    this.router.navigateByUrl('/login');
  }

  /** Validates the form and starts the password-reset request. */
  submitSendMail(): void {
    if (this.sendMailForm.invalid) {
      this.sendMailForm.markAllAsTouched();
      return;
    }
    this.requestResetMail();
  }

  /** Requests a reset email without revealing whether an address exists. */
  private requestResetMail(): void {
    const email = this.sendMailForm.controls.email.value ?? '';
    this.isSubmitting = true;
    this.sendError = '';
    this.authService
      .sendResetMail(email.trim())
      .then(() => this.confirmAndLeave())
      .catch((error: unknown) => (this.sendError = mapSendError(error)))
      .finally(() => (this.isSubmitting = false));
  }

  /** Shows confirmation and returns to the login page after a short delay. */
  private confirmAndLeave(): void {
    this.mailSent = true;
    setTimeout(() => this.router.navigateByUrl('/login'), 2000);
  }
}

/** Maps password-reset failures to user-facing messages. */
function mapSendError(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'auth/invalid-email') return 'Diese E-Mail-Adresse ist leider ungültig.';
  if (code === 'auth/too-many-requests') return 'Zu viele Versuche. Bitte warte einen Moment.';
  if (code === 'auth/network-request-failed') return 'Keine Verbindung zum Server.';
  console.error('Reset-Mail fehlgeschlagen:', error);
  return 'Die E-Mail konnte nicht gesendet werden. Bitte versuche es erneut.';
}

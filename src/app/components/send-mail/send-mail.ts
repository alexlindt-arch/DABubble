import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-send-mail',
  styleUrl: './send-mail.scss',
  templateUrl: './send-mail.html',
})
export class SendMail {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly sendMailForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
  });

  mailSent = false;

  get emailErrorMessage(): string {
    const email = this.sendMailForm.controls.email;
    if (email.hasError('required')) return 'Bitte gib deine E-Mail-Adresse ein.';
    if (email.hasError('email')) return 'Diese E-Mail-Adresse ist leider ungültig.';
    return '';
  }

  goBack(): void {
    this.router.navigateByUrl('/login');
  }

  submitSendMail(): void {
    if (this.sendMailForm.invalid) {
      this.sendMailForm.markAllAsTouched();
      return;
    }
    this.mailSent = true;
  }
}

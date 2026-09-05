import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirm')?.value;
  return password === confirm ? null : { passwordMismatch: true };
}

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-reset-password',
  styleUrl: './reset-password.scss',
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly resetForm = this.formBuilder.group(
    {
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  get passwordErrorMessage(): string {
    const password = this.resetForm.controls.password;
    if (password.hasError('required')) return 'Bitte gib ein neues Passwort ein.';
    if (password.hasError('minlength')) return 'Das Passwort muss mindestens 6 Zeichen haben.';
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
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    this.router.navigateByUrl('/login');
  }
}

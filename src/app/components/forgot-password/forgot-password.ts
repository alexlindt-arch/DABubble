import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

/**
 * The password recovery flow lives in SendMail. This route is kept because
 * the login page still links to it, and forwards to the actual entry point.
 */
@Component({
  imports: [RouterLink],
  selector: 'app-forgot-password',
  styleUrl: './forgot-password.scss',
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly router = inject(Router);

  constructor() {
    this.router.navigateByUrl('/send-mail', { replaceUrl: true });
  }
}

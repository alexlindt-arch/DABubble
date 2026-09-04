import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

const PLACEHOLDER_AVATAR = '/assets/img/Profile.svg';

const AVATAR_FILES = [
  'Property 1=Elias Neumann.png',
  'Property 1=Elise Roth.png',
  'Property 1=Frederik Beck.png',
  'Property 1=Noah Braun.png',
  'Property 1=Sofia Müller.png',
  'Property 1=Steffen Hoffmann.png',
];

@Component({
  imports: [],
  selector: 'app-choose-avatar',
  styleUrl: './choose-avatar.scss',
  templateUrl: './choose-avatar.html',
})
export class ChooseAvatar {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  private readonly userEmail: string = history.state?.email ?? '';

  readonly avatars = AVATAR_FILES.map((file) => ({
    label: file.replace('Property 1=', '').replace('.png', ''),
    url: `/assets/img/avatar/${encodeURIComponent(file)}`,
  }));

  readonly userName: string = history.state?.name ?? 'Gast';

  selectedIndex: number | null = null;
  isSubmitting = false;
  avatarError = '';

  get previewUrl(): string {
    if (this.selectedIndex === null) return PLACEHOLDER_AVATAR;
    return this.avatars[this.selectedIndex].url;
  }

  get hasSelection(): boolean {
    return this.selectedIndex !== null;
  }

  selectAvatar(index: number): void {
    this.selectedIndex = index;
  }

  goBack(): void {
    this.router.navigateByUrl('/register');
  }

  continueToMain(): void {
    if (!this.hasSelection || this.isSubmitting) return;
    this.saveProfileAndContinue();
  }

  private saveProfileAndContinue(): void {
    if (this.selectedIndex === null) return;
    const avatar = AVATAR_FILES[this.selectedIndex];
    this.isSubmitting = true;
    this.avatarError = '';
    this.authService
      .saveUserProfile(this.userName, this.userEmail, avatar)
      .then(() => this.router.navigateByUrl('/main'))
      .catch(() => (this.avatarError = 'Profil konnte nicht gespeichert werden. Bitte versuche es erneut.'))
      .finally(() => (this.isSubmitting = false));
  }
}

import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AVATAR_FILES, avatarLabel } from '../../shared/avatars';
import { RouterLink } from '@angular/router';

const PLACEHOLDER_AVATAR = '/assets/img/Profile.svg';

@Component({
  imports: [ RouterLink ],
  selector: 'app-choose-avatar',
  styleUrl: './choose-avatar.scss',
  templateUrl: './choose-avatar.html',
})
export class ChooseAvatar {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  private readonly userEmail: string = history.state?.email ?? '';

  readonly avatars = AVATAR_FILES.map((file) => ({
    label: avatarLabel(file),
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

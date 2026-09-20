import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AVATAR_FILES, avatarLabel } from '../../shared/avatars';
import { avatarUrl, PLACEHOLDER_AVATAR } from '../../shared/avatar-url';
import { RouterLink } from '@angular/router';

@Component({
  imports: [ RouterLink ],
  selector: 'app-choose-avatar',
  styleUrls: ['./choose-avatar.scss', './choose-avatar-responsive.scss'],
  templateUrl: './choose-avatar.html',
})
export class ChooseAvatar {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly userEmail: string = history.state?.email ?? '';

  readonly avatars = AVATAR_FILES.map((file) => ({
    label: avatarLabel(file),
    url: avatarUrl(file),
  }));

  readonly userName: string = history.state?.name ?? 'Gast';

  selectedIndex: number | null = null;
  isSubmitting = false;
  avatarError = '';

  /** Returns the selected avatar URL or the placeholder when no avatar is selected. */
  get previewUrl(): string {
    if (this.selectedIndex === null) return PLACEHOLDER_AVATAR;
    return this.avatars[this.selectedIndex].url;
  }

  /** Indicates whether the user has selected an avatar. */
  get hasSelection(): boolean {
    return this.selectedIndex !== null;
  }

  /** Selects an avatar by its position in the available avatar list. */
  selectAvatar(index: number): void {
    this.selectedIndex = index;
  }

  /** Navigates back to the registration page. */
  goBack(): void {
    this.router.navigateByUrl('/register');
  }

  /** Saves the selected avatar and continues to the main application. */
  continueToMain(): void {
    if (!this.hasSelection || this.isSubmitting) return;
    this.saveProfileAndContinue();
  }

  /** Persists the completed user profile and handles navigation and save errors. */
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

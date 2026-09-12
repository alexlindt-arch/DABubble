import { afterNextRender, Component, ElementRef, HostListener, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { AppUser } from '../../models';
import { avatarUrl } from '../../shared/avatar-url';
import { AVATAR_FILES, avatarLabel } from '../../shared/avatars';

export interface ProfileEdit {
  name: string;
  avatar: string;
}

@Component({
  selector: 'app-profile-dialog',
  imports: [],
  templateUrl: './profile-dialog.html',
  styleUrl: './profile-dialog.scss',
})
export class ProfileDialog {
  profile = input.required<AppUser>();
  canMessage = input(true);
  editMode = input(false);
  saveError = input('');
  deleteError = input('');
  deleteBusy = input(false);
  closed = output<void>();
  messageRequested = output<AppUser>();
  saved = output<ProfileEdit>();
  deleteConfirmed = output<void>();

  readonly avatars = AVATAR_FILES;
  readonly name = linkedSignal(() => this.profile().name);
  readonly editedAvatar = linkedSignal(() => this.profile().avatar);
  readonly pickerOpen = signal(false);
  readonly deleteConfirmationOpen = signal(false);
  readonly submitted = signal(false);
  readonly touched = signal(false);

  private nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  constructor() { afterNextRender(() => this.nameInput()?.nativeElement.focus()); }

  avatar(): string { return avatarUrl(this.profile().avatar); }

  editedAvatarUrl(): string { return avatarUrl(this.editedAvatar()); }

  avatarOptionUrl(avatar: string): string { return avatarUrl(avatar); }

  avatarName(avatar: string): string { return avatarLabel(avatar); }

  isOnline(): boolean { return this.profile().status === 'online'; }

  get nameErrorMessage(): string {
    const name = this.name().trim();
    if (!name) return 'Bitte gib deinen Namen ein.';
    return name.length < 3 ? 'Bitte gib deinen vollständigen Namen ein.' : '';
  }

  get showNameError(): boolean { return (this.touched() || this.submitted()) && this.nameErrorMessage !== ''; }

  get formValid(): boolean { return this.nameErrorMessage === ''; }

  togglePicker(): void { this.pickerOpen.set(!this.pickerOpen()); }

  pickAvatar(avatar: string): void {
    this.editedAvatar.set(avatar);
    this.pickerOpen.set(false);
  }

  submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (this.formValid) this.saved.emit({ name: this.name().trim(), avatar: this.editedAvatar() });
  }

  startDirectMessage(): void {
    this.messageRequested.emit(this.profile());
    this.closed.emit();
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (this.deleteConfirmationOpen()) return void this.deleteConfirmationOpen.set(false);
    if (event.target === event.currentTarget) this.closed.emit();
  }

  closeEditOverlays(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.pickerOpen() && !target.closest('.profile-edit__avatar')) this.pickerOpen.set(false);
    if (this.deleteConfirmationOpen() && !target.closest('.delete-confirmation')) this.deleteConfirmationOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeWithEscape(): void {
    if (this.deleteConfirmationOpen()) return void this.deleteConfirmationOpen.set(false);
    if (this.pickerOpen()) return void this.pickerOpen.set(false);
    this.closed.emit();
  }
}

import { afterNextRender, Component, ElementRef, HostListener, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { AppUser } from '../../models';
import { avatarUrl } from '../../shared/avatar-url';
import { AVATAR_FILES, avatarLabel } from '../../shared/avatars';

/** Contains the editable profile values emitted by the dialog. */
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
/** Displays profile details and handles profile editing actions. */
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

  /** Focuses the name field after the dialog has rendered. */
  constructor() { afterNextRender(() => this.nameInput()?.nativeElement.focus()); }

  /** Returns the current profile avatar URL. */
  avatar(): string { return avatarUrl(this.profile().avatar); }

  /** Returns the edited avatar URL. */
  editedAvatarUrl(): string { return avatarUrl(this.editedAvatar()); }

  /** Returns the avatar URL for a picker option. */
  avatarOptionUrl(avatar: string): string { return avatarUrl(avatar); }

  /** Returns the accessible label for an avatar option. */
  avatarName(avatar: string): string { return avatarLabel(avatar); }

  /** Checks whether the profile user is online. */
  isOnline(): boolean { return this.profile().status === 'online'; }

  /** Returns the current profile-name validation message. */
  get nameErrorMessage(): string {
    const name = this.name().trim();
    if (!name) return 'Bitte gib deinen Namen ein.';
    if (name.length < 3) return 'Bitte gib deinen vollständigen Namen ein.';
    if (name.length > 50) return 'Der Name darf höchstens 50 Zeichen lang sein.';
    return /^[\p{L}]+(?:[ '\u2019-][\p{L}]+)*$/u.test(name)
      ? ''
      : 'Bitte verwende nur Buchstaben, Leerzeichen, Bindestriche oder Apostrophe.';
  }

  /** Indicates whether the profile-name validation message should be shown. */
  get showNameError(): boolean { return (this.touched() || this.submitted()) && this.nameErrorMessage !== ''; }

  /** Indicates whether the profile form is valid. */
  get formValid(): boolean { return this.nameErrorMessage === ''; }

  /** Toggles the avatar picker visibility. */
  togglePicker(): void { this.pickerOpen.set(!this.pickerOpen()); }

  /** Selects an avatar and closes the picker. */
  pickAvatar(avatar: string): void {
    this.editedAvatar.set(avatar);
    this.pickerOpen.set(false);
  }

  /** Validates the form and emits the edited profile values. */
  submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (this.formValid) {
      const name = this.name().trim().replace(/\s+/g, ' ');
      this.saved.emit({ name, avatar: this.editedAvatar() });
    }
  }

  /** Requests a direct conversation with the profile user. */
  startDirectMessage(): void {
    this.messageRequested.emit(this.profile());
    this.closed.emit();
  }

  /** Closes overlays or the dialog when the backdrop is clicked. */
  closeOnBackdrop(event: MouseEvent): void {
    if (this.deleteConfirmationOpen()) return void this.deleteConfirmationOpen.set(false);
    if (event.target === event.currentTarget) this.closed.emit();
  }

  /** Closes open edit overlays when clicking outside their content. */
  closeEditOverlays(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.pickerOpen() && !target.closest('.profile-edit__avatar')) this.pickerOpen.set(false);
    if (this.deleteConfirmationOpen() && !target.closest('.delete-confirmation')) this.deleteConfirmationOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  /** Closes overlays or the dialog when Escape is pressed. */
  closeWithEscape(): void {
    if (this.deleteConfirmationOpen()) return void this.deleteConfirmationOpen.set(false);
    if (this.pickerOpen()) return void this.pickerOpen.set(false);
    this.closed.emit();
  }
}

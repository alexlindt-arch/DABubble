import {
  afterNextRender,
  Component,
  ElementRef,
  HostListener,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { avatarUrl } from '../../shared/avatar-url';
import { AVATAR_FILES, avatarLabel } from '../../shared/avatars';

export interface ProfileEdit {
  name: string;
  avatar: string;
}

@Component({
  selector: 'app-profile-edit-dialog',
  imports: [],
  templateUrl: './profile-edit-dialog.html',
  styleUrl: './profile-edit-dialog.scss',
})
export class ProfileEditDialog {
  userName = input('');
  userAvatar = input('');
  saveError = input('');
  closed = output<void>();
  saved = output<ProfileEdit>();

  readonly avatars = AVATAR_FILES;
  readonly name = linkedSignal(() => this.userName());
  readonly avatar = linkedSignal(() => this.userAvatar());
  readonly pickerOpen = signal(false);
  readonly submitted = signal(false);
  readonly touched = signal(false);

  private nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  constructor() {
    afterNextRender(() => this.nameInput()?.nativeElement.focus());
  }

  get nameErrorMessage(): string {
    const name = this.name().trim();
    if (!name) return 'Bitte gib deinen Namen ein.';
    if (name.length < 3) return 'Bitte gib deinen vollständigen Namen ein.';
    return '';
  }

  get showNameError(): boolean {
    return (this.touched() || this.submitted()) && this.nameErrorMessage !== '';
  }

  get formValid(): boolean {
    return this.nameErrorMessage === '';
  }

  avatarSrc(avatar: string): string {
    return avatarUrl(avatar);
  }

  avatarName(avatar: string): string {
    return avatarLabel(avatar);
  }

  togglePicker(): void {
    this.pickerOpen.set(!this.pickerOpen());
  }

  pickAvatar(avatar: string): void {
    this.avatar.set(avatar);
    this.pickerOpen.set(false);
  }

  submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (!this.formValid) return;
    this.saved.emit({ name: this.name().trim(), avatar: this.avatar() });
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  closeWithEscape(): void {
    if (this.pickerOpen()) return void this.pickerOpen.set(false);
    this.closed.emit();
  }
}

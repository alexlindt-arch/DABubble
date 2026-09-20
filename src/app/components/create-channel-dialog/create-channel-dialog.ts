import { afterNextRender, Component, ElementRef, HostListener, input, output, signal, viewChild } from '@angular/core';

/** Contains the values submitted for a new channel. */
export interface NewChannel {
  name: string;
  description: string;
}

@Component({
  selector: 'app-create-channel-dialog',
  imports: [],
  templateUrl: './create-channel-dialog.html',
  styleUrl: './create-channel-dialog.scss',
})
export class CreateChannelDialog {
  existingChannels = input<string[]>([]);
  closed = output<void>();
  created = output<NewChannel>();
  name = signal('');
  description = signal('');
  submitted = signal(false);
  private nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  /** Focuses the channel name field after the dialog has been rendered. */
  constructor() {
    afterNextRender(() => this.nameInput()?.nativeElement.focus());
  }

  /** Indicates whether the entered name is already used by another channel. */
  get duplicateName(): boolean {
    const name = this.name().trim().toLocaleLowerCase('de');
    if (!name) return false;
    return this.existingChannels().some(channel =>
      typeof channel === 'string' && channel.trim().toLocaleLowerCase('de') === name,
    );
  }

  /** Indicates whether the channel form can be submitted. */
  get formValid(): boolean {
    return this.name().trim().length > 0 && !this.duplicateName;
  }

  /** Validates the form and emits the new channel data when it is valid. */
  submit(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const nameInput = form.elements.namedItem('channel-name') as HTMLInputElement | null;
    if (nameInput) this.name.set(nameInput.value);
    this.submitted.set(true);
    if (!this.formValid) return;
    this.created.emit({ name: this.name().trim(), description: this.description().trim() });
  }

  /** Closes the dialog when the backdrop itself is clicked. */
  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  /** Closes the dialog when the Escape key is pressed. */
  @HostListener('document:keydown.escape')
  closeWithEscape(): void {
    this.closed.emit();
  }
}

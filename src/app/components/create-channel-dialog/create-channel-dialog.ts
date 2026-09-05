import { afterNextRender, Component, ElementRef, HostListener, input, output, signal, viewChild } from '@angular/core';

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

  constructor() {
    afterNextRender(() => this.nameInput()?.nativeElement.focus());
  }

  get duplicateName(): boolean {
    const name = this.name().trim().toLocaleLowerCase();
    return this.existingChannels().some(channel => channel.toLocaleLowerCase() === name);
  }

  get formValid(): boolean {
    return this.name().trim().length > 0 && !this.duplicateName;
  }

  submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (!this.formValid) return;
    this.created.emit({ name: this.name().trim(), description: this.description().trim() });
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  closeWithEscape(): void {
    this.closed.emit();
  }
}

import { afterNextRender, Component, ElementRef, viewChild } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-new-message',
  styleUrl: './new-message.scss',
  templateUrl: './new-message.html',
})
export class NewMessage {
  private readonly recipientInput = viewChild<ElementRef<HTMLInputElement>>('recipientInput');

  constructor() {
    afterNextRender(() => this.recipientInput()?.nativeElement.focus());
  }
}

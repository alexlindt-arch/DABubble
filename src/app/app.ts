import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IntroAnimation } from './components/intro-animation/intro-animation';
import { GuestSessionService } from './services/guest-session.service';

@Component({
  imports: [RouterOutlet, IntroAnimation],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('dabubble');

  constructor() {
    // Startet den Wächter, der abgelaufene Gast-Sitzungen aufräumt.
    inject(GuestSessionService);
  }
}

import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IntroAnimation } from './components/intro-animation/intro-animation';

@Component({
  imports: [RouterOutlet, IntroAnimation],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('dabubble');
}

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationSoundService {
  private readonly soundPath = 'assets/sounds/all-eyes-on-me-465.mp3';

  private resolveSoundUrl(): string {
    return new URL(this.soundPath, document.baseURI).href;
  }

  play(): void {
    const audio = new Audio(this.resolveSoundUrl());
    audio.volume = 0.35;
    void audio.play().catch(() => {
      // Audio may be blocked until the user interacts with the app.
    });
  }
}

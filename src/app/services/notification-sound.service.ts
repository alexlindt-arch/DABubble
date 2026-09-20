import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationSoundService {
  private readonly soundUrl = '/assets/sounds/all-eyes-on-me-465.mp3';

  play(): void {
    const audio = new Audio(this.soundUrl);
    audio.volume = 0.35;
    void audio.play().catch(() => {
      // Audio may be blocked until the user interacts with the app.
    });
  }
}

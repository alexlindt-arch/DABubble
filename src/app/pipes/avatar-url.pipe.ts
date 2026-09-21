import { Pipe, PipeTransform } from '@angular/core';
import { avatarUrl } from '../shared/avatar-url';

/** Turns an avatar file name from Firestore into its asset path. */
@Pipe({ name: 'avatarUrl' })
export class AvatarUrlPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return avatarUrl(value);
  }
}

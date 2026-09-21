import { Pipe, PipeTransform } from '@angular/core';
import { Timestamp } from 'firebase/firestore';

/** Formats a message timestamp as the time label shown next to a message. */
@Pipe({ name: 'messageTime' })
export class MessageTimePipe implements PipeTransform {
  transform(value: Timestamp | null | undefined): string {
    const date = value?.toDate?.();
    if (!date) return '';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} Uhr`;
  }
}

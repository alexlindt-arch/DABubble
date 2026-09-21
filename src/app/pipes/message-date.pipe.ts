import { Pipe, PipeTransform } from '@angular/core';
import { Timestamp } from 'firebase/firestore';

/** Formats a message timestamp as the label of a date divider. */
@Pipe({ name: 'messageDate' })
export class MessageDatePipe implements PipeTransform {
  transform(value: Timestamp | null | undefined): string {
    const date = value?.toDate?.();
    if (!date) return '';
    if (date.toDateString() === new Date().toDateString()) return 'Heute';
    return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}

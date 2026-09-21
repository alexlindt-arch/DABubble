import { Pipe, PipeTransform } from '@angular/core';
import { replyLabel } from '../shared/message-format';

/** Turns a number of thread replies into its German label. */
@Pipe({ name: 'replyCount' })
export class ReplyCountPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return replyLabel(value ?? 0);
  }
}

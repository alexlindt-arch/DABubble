import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'messageTime' })
export class MessageTimePipe implements PipeTransform {
  transform(value: number): string {
    return '';
  }
}

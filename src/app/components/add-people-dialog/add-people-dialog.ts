import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AppUser } from '../../models';
import { avatarUrl } from '../../shared/avatar-url';

type AddMode = 'all' | 'specific';

@Component({
  selector: 'app-add-people-dialog',
  imports: [],
  templateUrl: './add-people-dialog.html',
  styleUrl: './add-people-dialog.scss',
})
export class AddPeopleDialog {
  users = input<AppUser[]>([]);
  workspaceName = input('Devspace');
  submitLabel = input('Erstellen');
  channelName = input('');
  compact = input(false);
  closed = output<void>();
  confirmed = output<string[]>();
  mode = signal<AddMode>('all');
  search = signal('');
  selected = signal<AppUser[]>([]);
  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly suggestions = computed(() => this.matchingUsers(this.search().trim()));

  constructor() {
    effect(() => {
      if (this.compact() || this.mode() === 'specific') this.searchInput()?.nativeElement.focus();
    });
  }

  get formValid(): boolean {
    return this.compact() || this.mode() === 'specific' ? this.selected().length > 0 : true;
  }

  avatar(user: AppUser): string {
    return avatarUrl(user.avatar);
  }

  addUser(user: AppUser): void {
    this.selected.update(users => [...users, user]);
    this.search.set('');
  }

  removeUser(user: AppUser): void {
    this.selected.update(users => users.filter(item => item.uid !== user.uid));
  }

  submit(event: Event): void {
    event.preventDefault();
    if (!this.formValid) return;
    this.confirmed.emit(this.memberUids());
  }

  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  closeWithEscape(): void {
    this.closed.emit();
  }

  private memberUids(): string[] {
    const chosen = this.compact() || this.mode() === 'specific' ? this.selected() : this.users();
    return chosen.map(user => user.uid);
  }

  private matchingUsers(term: string): AppUser[] {
    if (!term) return [];
    return this.users()
      .filter(user => !this.isSelected(user))
      .filter(user => this.startsWithTerm(user.name, term));
  }

  private isSelected(user: AppUser): boolean {
    return this.selected().some(item => item.uid === user.uid);
  }

  private startsWithTerm(name: string, term: string): boolean {
    const search = term.toLocaleLowerCase();
    return name.toLocaleLowerCase().split(' ').some(part => part.startsWith(search));
  }
}

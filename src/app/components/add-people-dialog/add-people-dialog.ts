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
import { AppUser } from '../../shared/models';
import { AvatarUrlPipe } from '../../pipes/avatar-url.pipe';

type AddMode = 'all' | 'specific';

@Component({
  selector: 'app-add-people-dialog',
  imports: [AvatarUrlPipe],
  templateUrl: './add-people-dialog.html',
  styleUrl: './add-people-dialog.scss',
})
export class AddPeopleDialog {
  users = input<AppUser[]>([]);
  workspaceName = input('Devspace');
  submitLabel = input('Erstellen');
  channelName = input('');
  compact = input(false);
  anchor = input<DOMRect | null>(null);
  closed = output<void>();
  confirmed = output<string[]>();
  mode = signal<AddMode>('all');
  search = signal('');
  selected = signal<AppUser[]>([]);
  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /** Contains users who match the current search and have not been selected yet. */
  readonly suggestions = computed(() => this.matchingUsers(this.search().trim()));

  /** Focuses the search field whenever specific member selection is available. */
  constructor() {
    effect(() => {
      if (this.compact() || this.mode() === 'specific') this.searchInput()?.nativeElement.focus();
    });
  }

  /** Indicates whether the current member selection can be submitted. */
  get formValid(): boolean {
    return this.compact() || this.mode() === 'specific' ? this.selected().length > 0 : true;
  }

  /** Calculates the dialog's vertical position below its trigger. */
  get offsetTop(): string { return `${Math.round((this.anchor()?.bottom ?? 0) + 8)}px`; }

  /** Calculates the dialog's right offset and keeps it within the viewport. */
  get offsetRight(): string { return `${Math.max(16, Math.round(window.innerWidth - (this.anchor()?.right ?? window.innerWidth - 24)))}px`; }


  /** Adds a user to the selection and clears the search input. */
  addUser(user: AppUser): void {
    this.selected.update(users => [...users, user]);
    this.search.set('');
  }

  /** Removes a user from the current selection. */
  removeUser(user: AppUser): void {
    this.selected.update(users => users.filter(item => item.uid !== user.uid));
  }

  /** Validates the selection and emits the selected user IDs. */
  submit(event: Event): void {
    event.preventDefault();
    if (!this.formValid) return;
    this.confirmed.emit(this.memberUids());
  }

  /** Closes the dialog when the backdrop itself is clicked. */
  closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  /** Closes the dialog when the Escape key is pressed. */
  @HostListener('document:keydown.escape')
  closeWithEscape(): void {
    this.closed.emit();
  }

  /** Resolves the user IDs to confirm based on the active selection mode. */
  private memberUids(): string[] {
    const chosen = this.compact() || this.mode() === 'specific' ? this.selected() : this.users();
    return chosen.map(user => user.uid);
  }

  /** Filters unselected users by the provided search term. */
  private matchingUsers(term: string): AppUser[] {
    if (!term) return [];
    return this.users()
      .filter(user => !this.isSelected(user))
      .filter(user => this.startsWithTerm(user.name, term));
  }

  /** Checks whether a user is already part of the current selection. */
  private isSelected(user: AppUser): boolean {
    return this.selected().some(item => item.uid === user.uid);
  }

  /** Checks whether any part of a name starts with the search term. */
  private startsWithTerm(name: string, term: string): boolean {
    const search = term.toLocaleLowerCase();
    return name.toLocaleLowerCase().split(' ').some(part => part.startsWith(search));
  }
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Imprint } from './imprint';

describe('Imprint', () => {
  let component: Imprint;
  let fixture: ComponentFixture<Imprint>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Imprint],
    }).compileComponents();

    fixture = TestBed.createComponent(Imprint);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

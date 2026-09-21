import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SendMail } from './send-mail';

describe('SendMail', () => {
  let fixture: ComponentFixture<SendMail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendMail],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SendMail);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});

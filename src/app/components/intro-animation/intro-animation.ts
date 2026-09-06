import { Component, ElementRef, OnDestroy, computed, inject, signal } from '@angular/core';

type IntroPhase = 'hidden' | 'ready' | 'running' | 'done' | 'removed';

interface LogoBox {
  left: number;
  top: number;
  height: number;
}

const logoAspect = 243 / 70;
const bodyIntroClass = 'intro-active';
let introPlayedInSession = false;
const visiblePhases: IntroPhase[] = ['ready', 'running', 'done'];
const safeGap = 16;
const minIconSize = 40;
const maxIconSize = 187;
const startFallbackDelay = 500;
const remeasureDelay = 1350;
const landDelay = 1400;
const runDuration = 2500;
const removeDelay = 60;

@Component({
  selector: 'app-intro-animation',
  styleUrl: './intro-animation.scss',
  templateUrl: './intro-animation.html',
})
export class IntroAnimation implements OnDestroy {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly timers: number[] = [];
  private startedAt = 0;

  readonly phase = signal<IntroPhase>('hidden');
  readonly isVisible = computed(() => visiblePhases.includes(this.phase()));
  readonly isDone = computed(() => this.phase() === 'done');
  readonly hasStarted = computed(() => this.phase() === 'running' || this.isDone());

  constructor() {
    if (!canPlayIntro()) return;
    markIntroPlayed();
    this.phase.set('ready');
    this.timers.push(window.setTimeout(() => this.start(), startFallbackDelay));
  }

  start(): void {
    if (this.phase() !== 'ready') return;
    this.applyMetrics();
    this.startedAt = performance.now();
    this.phase.set('running');
    document.body.classList.add(bodyIntroClass);
    window.addEventListener('resize', this.onResize);
    this.timers.push(window.setTimeout(() => this.applyMetrics(), remeasureDelay));
    this.timers.push(window.setTimeout(() => this.finish(), runDuration));
  }

  ngOnDestroy(): void {
    this.stopIntro();
  }

  private finish(): void {
    this.stopIntro();
    this.phase.set('done');
    this.timers.push(window.setTimeout(() => this.phase.set('removed'), removeDelay));
  }

  private stopIntro(): void {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.length = 0;
    window.removeEventListener('resize', this.onResize);
    document.body.classList.remove(bodyIntroClass);
  }

  private applyMetrics(): void {
    const box = measureStaticLogo();
    const iconSize = fullscreenIconSize();
    const style = this.host.nativeElement.style;
    style.setProperty('--intro-left', `${box.left}px`);
    style.setProperty('--intro-top', `${box.top}px`);
    style.setProperty('--intro-height', `${box.height}px`);
    style.setProperty('--intro-width', `${box.height * logoAspect}px`);
    style.setProperty('--intro-scale', `${iconSize / box.height}`);
    style.setProperty('--intro-shift', `${logoShiftFor(iconSize)}px`);
    style.setProperty('--intro-x', `${window.innerWidth / 2 - box.left - iconSize / 2}px`);
    style.setProperty('--intro-y', `${window.innerHeight / 2 - box.top - iconSize / 2}px`);
  }

  private readonly onResize = (): void => {
    if (performance.now() - this.startedAt >= landDelay) return;
    this.applyMetrics();
  };
}

function canPlayIntro(): boolean {
  if (!isLoginRoute()) return false;
  if (introAlreadyPlayed()) return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isLoginRoute(): boolean {
  const path = window.location.pathname;
  return path === '/' || path === '/login';
}

function introAlreadyPlayed(): boolean {
  return introPlayedInSession;
}

function markIntroPlayed(): void {
  introPlayedInSession = true;
}

function measureStaticLogo(): LogoBox {
  const logo = document.querySelector<HTMLElement>('.login-page__logo');
  const rect = logo?.getBoundingClientRect();
  if (!rect || !rect.height) return fallbackLogoBox();
  return { left: rect.left, top: rect.top, height: rect.height };
}

function fallbackLogoBox(): LogoBox {
  const isNarrow = window.innerWidth <= 600;
  return { left: isNarrow ? 20 : 60, top: isNarrow ? 24 : 40, height: 60 };
}

function fullscreenIconSize(): number {
  const byWidth = (window.innerWidth / 2 - safeGap) / (logoAspect - 0.5);
  const byHeight = window.innerHeight * 0.3;
  return Math.max(minIconSize, Math.min(maxIconSize, byWidth, byHeight));
}

function logoShiftFor(iconSize: number): number {
  return (iconSize * (logoAspect - 1)) / 2;
}

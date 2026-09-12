import { Component, Input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-step-indicator',
  standalone: true,
  imports: [FaIconComponent],
  templateUrl: './step-indicator.html',
  styleUrl: './step-indicator.scss',
})
export class StepIndicator {
  @Input() stepIndex = 0;
  @Input() stepReference = 1;

  readonly checkIcon = faCheck;

  get isDone(): boolean {
    return this.stepIndex > this.stepReference;
  }

  get isActive(): boolean {
    return this.stepIndex === this.stepReference;
  }
}

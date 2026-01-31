import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-trail-map-placeholder',
  standalone: true,
  template: `
    <div class="placeholder">
      <h2>Trail Map (Coming soon)</h2>
      <p>This report is not implemented yet. It will show asset trails in time.</p>
      <div style="margin-top:1rem">
        <button (click)="goBack()">Back to Dashboard</button>
      </div>
    </div>
  `,
  styles: [
    `
      .placeholder { padding: 1.5rem; }
      h2 { margin: 0 0 0.5rem 0; }
      button { padding: 0.5rem 0.9rem; border-radius:6px; }
    `,
  ],
})
export class TrailMapPlaceholder {
  constructor(private router: Router) {}

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}

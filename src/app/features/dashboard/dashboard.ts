import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <header class="dashboard-header">
        <h1>Dashboard</h1>
        <button (click)="logout()" class="logout-btn">Logout</button>
      </header>

      <div class="success-banner" *ngIf="successMessage">
        {{ successMessage }}
      </div>

      <main class="dashboard-content">
        <p>Welcome! You are successfully logged in.</p>
        <p>Token: {{ token }}</p>
      </main>
    </div>
  `,
  styles: [
    `
      .dashboard-container {
        min-height: 100vh;
        background-color: #f5f5f5;
      }

      .dashboard-header {
        background-color: #0095db;
        color: white;
        padding: 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;

        h1 {
          margin: 0;
        }
      }

      .logout-btn {
        background-color: white;
        color: #0095db;
        border: none;
        padding: 0.6rem 1.5rem;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        transition: 0.3s;

        &:hover {
          background-color: #f0f0f0;
        }
      }

      .dashboard-content {
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;

        p {
          font-size: 1.1rem;
          color: #333;
        }
      }

      .success-banner {
        position: fixed;
        top: 1.5rem;
        left: 50%;
        transform: translateX(-50%);
        background-color: #2e7d32;
        color: #ffffff;
        padding: 0.8rem 1.8rem;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-size: 1rem;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        pointer-events: none;
        opacity: 0;
        animation: fadeSlide 0.45s ease-out forwards;
      }

      @keyframes fadeSlide {
        from {
          opacity: 0;
          transform: translate(-50%, -20px);
        }
        to {
          opacity: 1;
          transform: translate(-50%, 0);
        }
      }
    `,
  ],
})

export class Dashboard {
  token: string | null = null;
  successMessage: string | null = null;

  private route = inject(ActivatedRoute);

  constructor(private authService: AuthService, private router: Router) {
    this.token = this.authService.getAccessToken();

    this.route.queryParamMap.subscribe((params) => {
      const login = params.get('login');

      if (login === 'success') {
        this.successMessage = 'Login successful. Welcome back!';

        setTimeout(() => {
          this.successMessage = null;
        }, 6000);

        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { login: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
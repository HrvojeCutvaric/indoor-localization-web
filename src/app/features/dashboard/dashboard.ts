import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
      <main class="dashboard-content">
        <p>Welcome! You are successfully logged in.</p>
        <p>Token: {{ token }}</p>
      </main>
    </div>
  `,
  styles: [`
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
  `],
})
export class Dashboard {
  token: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {
    this.token = this.authService.getToken();
  }

  logout(): void {
    this.authService.logout();
  }
}

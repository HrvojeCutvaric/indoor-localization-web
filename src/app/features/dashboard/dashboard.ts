import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MapCanvasComponent } from '../maps/components/map-canvas/map-canvas';
import { AssetManagement } from '../assets/assets-management';
import { ZonesManagementComponent } from '../zones/zones-management';

type DashboardSection = 'maps' | 'assets' | 'zones' | 'reports';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MapCanvasComponent, AssetManagement, ZonesManagementComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
})

export class Dashboard {
  token: string | null = null;
  successMessage: string | null = null;
  activeSection: DashboardSection = 'maps';

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

  setActiveSection(section: DashboardSection): void {
    this.activeSection = section;
  }

  logout(): void {
    this.authService.logout();
  }
}
import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Dashboard } from './features/dashboard/dashboard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'dashboard', component: Dashboard },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/registration/registration')
        .then(m => m.Registration),
  },

  {
    path: 'map-canvas-demo',
    loadComponent: () =>
      import('./features/maps/components/map-canvas/map-canvas')
        .then(m => m.MapCanvasComponent),
  },
  {
    path: 'maps',
    loadComponent: () =>
      import('./features/maps/map-management')
        .then(m => m.MapManagement),
  },
  // Report routes
  {
    path: 'reports/heatmap',
    loadComponent: () =>
      import('./features/reports/components/heatmap-canvas/heatmap-canvas')
        .then(m => m.HeatmapCanvasComponent),
  },
  {
    path: 'reports/trail-map',
    loadComponent: () =>
      import('./features/reports/components/tail-map-canvas/tail-map-canvas')
        .then(m => m.TailMapCanvasComponent),
  },
  {
    path: 'reports/zone-retention',
    loadComponent: () =>
      import('./features/reports/components/zone-retention-report/zone-retention-report')
        .then(m => m.ZoneRetentionReportComponent),
  },
];
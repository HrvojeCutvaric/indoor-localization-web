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
];

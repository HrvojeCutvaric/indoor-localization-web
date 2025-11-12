import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'register' },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/registration/registration')
        .then(m => m.Registration),
  },
];
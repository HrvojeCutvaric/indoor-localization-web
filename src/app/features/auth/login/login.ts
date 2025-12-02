import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule, NgClass } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService, AuthError } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, NgClass, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})

export class Login implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroy$ = new Subject<void>();

  isLoading = false;
  apiError: string | null = null;
  showPassword = false;
  submitted = false;
  successMessage: string | null = null;

  form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    // Ako je korisnik logiran, salje se na dashboard
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Poruka nakon uspješne registracije
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const registered = params.get('registered');

        if (registered === 'true') {
          this.successMessage = 'Registration successful. You can now log in.';

          // auto-hide poruke nakon par sekundi
          setTimeout(() => {
            this.successMessage = null;
          }, 6000);

          // makni query param iz URL-a da se poruka ne ponavlja na refresh
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { registered: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  submit(): void {
    this.submitted = true;
    this.apiError = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;

    const { username, password } = this.form.value;

    this.authService
      .login(username || '', password || '')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.router.navigate(['/dashboard'], {
            queryParams: { login: 'success' }
          });
        },
        error: (error: AuthError) => {
          this.isLoading = false;

          if (error.code === 401) {
            this.apiError = 'Invalid username or password.';
          } else if (error.code === 400) {
            this.apiError =
              'Invalid input. Please check your credentials.';
          } else if (error.code === 0) {
            this.apiError =
              'Cannot reach the server. Please try again later.';
          } else {
            this.apiError =
              error.message || 'Login failed. Please try again.';
          }
        },
      });
  }
}
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule, NgClass } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
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
  private destroy$ = new Subject<void>();

  isLoading = false;
  apiError: string | null = null;
  showPassword = false;
  submitted = false;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    // Redirect to dashboard if already authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
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

    const { email, password } = this.form.value;

    this.authService
      .login(email || '', password || '')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Redirect to dashboard on success
          this.router.navigate(['/dashboard']);
        },
        error: (error: AuthError) => {
          this.isLoading = false;
          
          // Map error codes to user-friendly messages
          if (error.code === '401') {
            this.apiError = 'Invalid email or password.';
          } else if (error.code === '400') {
            this.apiError = 'Invalid input. Please check your credentials.';
          } else if (error.code === '0') {
            this.apiError = 'Cannot reach the server. Please try again later.';
          } else {
            this.apiError = error.message || 'Login failed. Please try again.';
          }
        },
      });
  }
}


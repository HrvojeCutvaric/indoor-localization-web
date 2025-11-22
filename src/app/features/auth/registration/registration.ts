import { Component, inject } from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { NgClass } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';

function passwordMatch(group: AbstractControl): ValidationErrors | null {
  const a = group.get('password')?.value;
  const b = group.get('confirmPassword')?.value;
  return a && b && a !== b ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, RouterLink],
  templateUrl: './registration.html',
  styleUrls: ['./registration.scss'],
})
export class Registration {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);

  isLoading = false;
  apiError: string | null = null;

  showPassword = false;
  showConfirmPassword = false;
  submitted = false;

  form = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email]],
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(24)]],
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30)]],
      password: [
        '',
        [
          Validators.required,
          // ≥8 chars, at least one letter & one number (adjust as needed)
          Validators.pattern(
            /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-={}[\]|:;"'<>,.?/]{8,}$/
          ),
        ],
      ],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatch }
  );

  get f() {
    return this.form.controls;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }
  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  submit() {
    this.submitted = true;
    this.apiError = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;

    const { email, username, firstName, lastName, password } = this.form.value;

    const payload = {
      email,
      username,
      firstName,
      lastName,
      password,
    };

    this.http.post('/register', payload).subscribe({
      next: () => {
        this.isLoading = false;
        // Success → redirect to login page
        this.router.navigate(['/login'], {
          queryParams: { registered: 'true' },
        });
      },
      error: (error: HttpErrorResponse) => {
        this.isLoading = false;

        if (error.status === 409) {
          this.apiError = 'Email is already registered.';
        } else if (error.status === 400) {
          this.apiError = 'Invalid input. Please check your data.';
        } else if (error.status === 0) {
          this.apiError = 'Cannot reach the server. Please try again later.';
        } else {
          this.apiError = 'Something went wrong. Please try again.';
        }
      },
    });
  }
}
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { tap, catchError, delay, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export interface AuthError {
  message: string;
  code?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api/login`;
  private tokenKey = 'auth_token';
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());

  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  // Mock users for development
  private mockUsers = [
    { email: 'test@example.com', password: 'password123' },
    { email: 'demo@demo.com', password: 'demo1234' },
  ];

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    this.checkTokenValidity();
  }

  /**
   * Login user with email and password
   * @param email User email
   * @param password User password
   * @returns Observable with login response
   */
  login(email: string, password: string): Observable<LoginResponse> {
    const payload: LoginRequest = { email, password };

    // In development, use mock authentication
    if (!environment.production) {
      console.log('🔍 Development mode: Using mock authentication');
      return of(null).pipe(
        delay(1500), // Simulate network delay
        switchMap(() => {
          // Check credentials against mock users
          const user = this.mockUsers.find(
            (u) => u.email === email && u.password === password,
          );

          if (user) {
            console.log('✅ Mock credentials valid');
            return of({
              token: 'mock-jwt-token-' + Date.now(),
              user: {
                id: '1',
                email: user.email,
                firstName: 'Test',
                lastName: 'User',
              },
            });
          } else {
            console.log('❌ Mock credentials invalid');
            return throwError(
              () =>
                new Error('Invalid email or password'),
            );
          }
        }),
        tap((response) => {
          if (response.token) {
            this.storeToken(response.token);
            this.isAuthenticatedSubject.next(true);
          }
        }),
        catchError((error) => {
          const authError: AuthError = {
            message: error.message || 'Login failed. Please try again.',
            code: '401',
          };
          return throwError(() => authError);
        }),
      );
    }

    // Production: call real backend
    return this.http.post<LoginResponse>(this.apiUrl, payload).pipe(
      tap((response) => {
        if (response.token) {
          this.storeToken(response.token);
          this.isAuthenticatedSubject.next(true);
        }
      }),
      catchError((error) => {
        const authError: AuthError = {
          message: this.extractErrorMessage(error),
          code: error.status,
        };
        return throwError(() => authError);
      }),
    );
  }

  /**
   * Logout user and clear token
   */
  logout(): void {
    this.clearToken();
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  /**
   * Get stored JWT token
   */
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.hasToken();
  }

  /**
   * Store JWT token in localStorage
   */
  private storeToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  /**
   * Clear stored token
   */
  private clearToken(): void {
    localStorage.removeItem(this.tokenKey);
  }

  /**
   * Check if token exists
   */
  private hasToken(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }

  /**
   * Validate token on service initialization
   * Can be extended to check token expiry
   */
  private checkTokenValidity(): void {
    const token = this.getToken();
    if (token) {
      // Future: Add token validation/refresh logic here
      this.isAuthenticatedSubject.next(true);
    }
  }

  /**
   * Extract error message from HTTP error response
   */
  private extractErrorMessage(error: any): string {
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.error?.error) {
      return error.error.error;
    }
    switch (error?.status) {
      case 401:
        return 'Invalid email or password';
      case 400:
        return 'Missing required fields';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return 'Login failed. Please try again.';
    }
  }
}

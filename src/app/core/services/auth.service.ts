import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

interface RefreshResponse {
    accessToken: string;
    refreshToken: string;
}

// struktura login responsa kakvu vraca backend
export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    userId: number;
    username: string;
    email: string;
}

// tip za error koji koristi login komponenta
export interface AuthError {
    message: string;
    code?: string | number;
}

// payload za registraciju
export interface RegisterPayload {
    email: string | null;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    password: string | null;
}

@Injectable({
    providedIn: 'root',
})

export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);

    private readonly ACCESS_TOKEN_KEY = 'access_token';
    private readonly REFRESH_TOKEN_KEY = 'refresh_token';

    // ---- Token storage helpers ----
    getAccessToken(): string | null {
        return localStorage.getItem(this.ACCESS_TOKEN_KEY);
    }

    getRefreshToken(): string | null {
        return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    }

    setTokens(accessToken: string, refreshToken: string): void {
        localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
        localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    }

    clearTokens(): void {
        localStorage.removeItem(this.ACCESS_TOKEN_KEY);
        localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    }

    // jednostavna provjera je li user prijavljen
    isAuthenticated(): boolean {
        return !!this.getAccessToken() && !!this.getRefreshToken();
    }

    //login
    login(username: string, password: string): Observable<LoginResponse> {
        const url = `${environment.apiUrl}/Auth/login`;

        const body = {
            username,
            password,
        };

        return this.http.post<LoginResponse>(url, body).pipe(
            tap((response) => {
                this.setTokens(response.accessToken, response.refreshToken);
            }),
            catchError((error: HttpErrorResponse) => {
                const authError: AuthError = {
                    message: this.extractErrorMessage(error),
                    code: error.status,
                };
                return throwError(() => authError);
            }),
        );
    }

    // registracija
    register(payload: RegisterPayload): Observable<void> {
        const url = `${environment.apiUrl}/Auth/register`;

        return this.http.post(url, payload).pipe(
            map(() => void 0),
            catchError((error: HttpErrorResponse) => throwError(() => error)),
        );
    }

    /**
     * Calls backend refresh endpoint: POST /api/Auth/refresh
     * Body:   { accessToken, refreshToken }
     * Result: { accessToken, refreshToken }
     *
     * Returns:
     *  - Observable<true>  if refresh succeeded and tokens were updated
     *  - Observable<false> if refresh is not possible or failed
     */
    refreshTokens(): Observable<boolean> {
        const accessToken = this.getAccessToken();
        const refreshToken = this.getRefreshToken();

        if (!accessToken || !refreshToken) {
            return of(false);
        }

        const url = `${environment.apiUrl}/Auth/refresh`;

        const body = {
            accessToken,
            refreshToken,
        };

        return this.http.post<RefreshResponse>(url, body).pipe(
            tap((response) => {
                this.setTokens(response.accessToken, response.refreshToken);
            }),
            map(() => true),
            catchError(() => {
                // Any error during refresh -> treat as failure and clear tokens
                this.clearTokens();
                return of(false);
            }),
        );
    }

    // dodani dio za logout
    logout(): void {
        this.clearTokens();
        this.router.navigate(['/login']);
    }

    logoutAndRedirectToLogin(): void {
        this.logout();
    }

    // Helper za poruke grešaka kod login-a
    private extractErrorMessage(error: HttpErrorResponse): string {
        if (error?.error?.message) {
            return error.error.message;
        }
        if (error?.error?.error) {
            return error.error.error;
        }

        switch (error.status) {
            case 0:
                return 'Cannot reach the server. Please try again later.';
            case 400:
                return 'Invalid input. Please check your credentials.';
            case 401:
                return 'Invalid username or password.';
            case 500:
                return 'Server error. Please try again later.';
            default:
                return 'Login failed. Please try again.';
        }
    }
}
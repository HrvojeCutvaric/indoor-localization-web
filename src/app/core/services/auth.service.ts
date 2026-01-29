import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

interface RefreshResponse {
    accessToken: string;
    refreshToken: string;
}

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    userId: number;
    username: string;
    email: string;
}

export interface AuthError {
    message: string;
    code?: string | number;
}

export interface RegisterPayload {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    password: string;
}

@Injectable({
    providedIn: 'root',
})

export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);

    private readonly ACCESS_TOKEN_KEY = 'access_token';
    private readonly REFRESH_TOKEN_KEY = 'refresh_token';

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

    isAuthenticated(): boolean {
        // Consider authenticated if we have an access token.
        // Refresh token may be optional depending on backend implementation.
        return !!this.getAccessToken();
    }

    login(username: string, password: string): Observable<LoginResponse> {
        const url = `${environment.apiUrl}/Auth/login`;

        const body = {
            username,
            password,
        };

        return this.http.post<LoginResponse>(url, body).pipe(
            tap((response) => {
                // Support multiple possible response shapes from backend
                const anyResp = response as any;
                
                // Handle nested data structure: { data: { accessToken, refreshToken } }
                const dataObj = anyResp.data || anyResp;
                const accessToken: string | undefined = dataObj.accessToken || dataObj.token || dataObj.access_token;
                const refreshToken: string | undefined = dataObj.refreshToken || dataObj.refresh_token;

                if (accessToken) {
                    if (refreshToken) {
                        this.setTokens(accessToken, refreshToken);
                    } else {
                        // Store access token and clear any stale refresh token
                        localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
                        localStorage.removeItem(this.REFRESH_TOKEN_KEY);
                    }
                }
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

    register(payload: RegisterPayload): Observable<void> {
        const url = `${environment.apiUrl}/Auth/register`;

        return this.http.post(url, payload).pipe(
            map(() => void 0),
            catchError((error: HttpErrorResponse) => throwError(() => error)),
        );
    }

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
                this.clearTokens();
                return of(false);
            }),
        );
    }

    logout(): void {
        this.clearTokens();
        this.router.navigate(['/login']);
    }

    logoutAndRedirectToLogin(): void {
        this.logout();
    }

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
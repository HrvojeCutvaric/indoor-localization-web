import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';

interface RefreshResponse {
    accessToken: string;
    refreshToken: string;
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

        const url = '/api/Auth/refresh';

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
            })
        );
    }

    logoutAndRedirectToLogin(): void {
        this.clearTokens();
        this.router.navigate(['/login']);
    }
}
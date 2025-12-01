import { inject } from '@angular/core';
import {
    HttpErrorResponse,
    HttpInterceptorFn,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const accessToken = authService.getAccessToken();

    // Do not attach Authorization or run refresh logic on auth-specific endpoints
    const isAuthRequest =
        req.url.endsWith('/login') ||
        req.url.endsWith('/register') ||
        req.url.endsWith('/refresh');

    // Attach Authorization header to non-auth requests if there is token
    let authReq = req;
    if (accessToken && !isAuthRequest) {
        authReq = req.clone({
            setHeaders: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
    }

    return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
            // If it's not 401 or it's an auth endpoint, just propagate the error
            if (error.status !== 401 || isAuthRequest) {
                return throwError(() => error);
            }

            // 401 on a protected endpoint -> try to refresh tokens
            return authService.refreshTokens().pipe(
                switchMap((success) => {
                    if (!success) {
                        // Refresh failed -> force logout and redirect to login
                        authService.logoutAndRedirectToLogin();
                        return throwError(() => error);
                    }

                    const newAccessToken = authService.getAccessToken();
                    if (!newAccessToken) {
                        authService.logoutAndRedirectToLogin();
                        return throwError(() => error);
                    }

                    // Retry the original request with the new access token
                    const retryReq = req.clone({
                        setHeaders: {
                            Authorization: `Bearer ${newAccessToken}`,
                        },
                    });

                    return next(retryReq);
                }),
                catchError((refreshError) => {
                    // If refresh request itself errors, also log out and redirect
                    authService.logoutAndRedirectToLogin();
                    return throwError(() => refreshError);
                })
            );
        })
    );
};
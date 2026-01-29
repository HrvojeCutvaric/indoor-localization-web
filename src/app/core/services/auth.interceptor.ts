import { inject } from '@angular/core';
import {
    HttpErrorResponse,
    HttpInterceptorFn,
} from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);

    const accessToken = authService.getAccessToken();

    const isAuthRequest =
        req.url.includes('/Auth/login') ||
        req.url.includes('/Auth/register') ||
        req.url.includes('/Auth/refresh');

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
            if (error.status !== 401 || isAuthRequest) {
                return throwError(() => error);
            }

            const hasRefresh = !!authService.getRefreshToken();
            if (!hasRefresh) {
                // No refresh token available; propagate error and let UI decide.
                return throwError(() => error);
            }

            return authService.refreshTokens().pipe(
                switchMap((success) => {
                    if (!success) {
                        // Refresh failed; propagate error, do not force logout.
                        return throwError(() => error);
                    }

                    const newAccessToken = authService.getAccessToken();
                    if (!newAccessToken) {
                        return throwError(() => error);
                    }

                    const retryReq = req.clone({
                        setHeaders: {
                            Authorization: `Bearer ${newAccessToken}`,
                        },
                    });

                    return next(retryReq);
                }),
                catchError((refreshError) => {
                    // Refresh flow threw; propagate to caller.
                    return throwError(() => refreshError);
                }),
            );
        }),
    );
};
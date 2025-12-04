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
        req.url.endsWith('/login') ||
        req.url.endsWith('/register') ||
        req.url.endsWith('/refresh');

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

            return authService.refreshTokens().pipe(
                switchMap((success) => {
                    if (!success) {
                        authService.logoutAndRedirectToLogin();
                        return throwError(() => error);
                    }

                    const newAccessToken = authService.getAccessToken();
                    if (!newAccessToken) {
                        authService.logoutAndRedirectToLogin();
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
                    authService.logoutAndRedirectToLogin();
                    return throwError(() => refreshError);
                }),
            );
        }),
    );
};
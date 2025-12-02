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

    //Ne uzimaju se auth requestovi (login, register, refresh)
    const isAuthRequest =
        req.url.endsWith('/login') ||
        req.url.endsWith('/register') ||
        req.url.endsWith('/refresh');

    // Na sve ostale requestove dodajemo Authorization header ako postoji token
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
            // Ako nije 401 ili je auth endpoint → samo proslijedi error
            if (error.status !== 401 || isAuthRequest) {
                return throwError(() => error);
            }

            // 401 na zaštićenom endpointu → pokušaj refresh tokena
            return authService.refreshTokens().pipe(
                switchMap((success) => {
                    if (!success) {
                        // Refresh nije uspio → logout + redirect na login
                        authService.logoutAndRedirectToLogin();
                        return throwError(() => error);
                    }

                    const newAccessToken = authService.getAccessToken();
                    if (!newAccessToken) {
                        authService.logoutAndRedirectToLogin();
                        return throwError(() => error);
                    }

                    // Retry originalnog requesta s novim access tokenom
                    const retryReq = req.clone({
                        setHeaders: {
                            Authorization: `Bearer ${newAccessToken}`,
                        },
                    });

                    return next(retryReq);
                }),
                catchError((refreshError) => {
                    // Ako i refresh poziv pukne → logout + redirect
                    authService.logoutAndRedirectToLogin();
                    return throwError(() => refreshError);
                }),
            );
        }),
    );
};
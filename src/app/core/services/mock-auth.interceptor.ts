import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse,
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, switchMap } from 'rxjs/operators';


@Injectable()
export class MockAuthInterceptor implements HttpInterceptor {

  private mockUsers = [
    { email: 'test@example.com', password: 'password123' },
    { email: 'demo@demo.com', password: 'demo1234' },
  ];

  intercept(
    request: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    console.log('🔍 MockAuthInterceptor triggered - URL:', request.url);

   
    if (request.url === '/api/login' && request.method === 'POST') {
      console.log('✅ Intercepting POST /api/login');
      const { email, password } = request.body;
      console.log('📧 Checking credentials:', email);

    
      const user = this.mockUsers.find(
        (u) => u.email === email && u.password === password,
      );

      if (user) {
        console.log('✅ Credentials valid - returning token');
        // Success response with delay
        return of(null).pipe(
          delay(1500),
          switchMap(() => {
            return of(
              new HttpResponse<any>({
                status: 200,
                statusText: 'OK',
                body: {
                  token: 'mock-jwt-token-' + Date.now(),
                  user: {
                    id: '1',
                    email: user.email,
                    firstName: 'Test',
                    lastName: 'User',
                  },
                },
              }),
            );
          }),
        );
      } else {
        console.log('❌ Invalid credentials');

        return of(null).pipe(
          delay(1500),
          switchMap(() => {
            return throwError(
              () =>
                new HttpResponse<any>({
                  status: 401,
                  statusText: 'Unauthorized',
                  body: { message: 'Invalid email or password' },
                }),
            );
          }),
        );
      }
    }

  
    return next.handle(request);
  }
}

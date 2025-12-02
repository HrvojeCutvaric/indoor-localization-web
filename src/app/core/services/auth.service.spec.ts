import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService, LoginResponse } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService, { provide: Router, useValue: spy }],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should login successfully and store token', (done) => {
    const mockResponse: LoginResponse = {
      token: 'test-jwt-token',
      user: { id: '1', email: 'test@example.com' },
    };

    service.login('test@example.com', 'password123').subscribe({
      next: (response) => {
        expect(response.token).toBe('test-jwt-token');
        expect(localStorage.getItem('auth_token')).toBe('test-jwt-token');
        expect(service.isAuthenticated()).toBe(true);
        done();
      },
    });

    const req = httpMock.expectOne('/api/login');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should handle login error', (done) => {
    service.login('test@example.com', 'wrongpassword').subscribe({
      error: (error) => {
        expect(error.message).toBe('Invalid email or password');
        done();
      },
    });

    const req = httpMock.expectOne('/api/login');
    req.flush(
      { error: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );
  });

  it('should logout and clear token', () => {
    localStorage.setItem('auth_token', 'test-token');
    service.logout();

    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should get stored token', () => {
    localStorage.setItem('auth_token', 'test-token');
    expect(service.getToken()).toBe('test-token');
  });
});

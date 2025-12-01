import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Login } from './login';
import { AuthService, AuthError } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

describe('Login Component', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const authSpy = jasmine.createSpyObj('AuthService', [
      'login',
      'isAuthenticated',
    ]);
    const routerSpyObj = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [Login, ReactiveFormsModule, CommonModule],
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpyObj },
      ],
    }).compileComponents();

    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    routerSpy = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Form Initialization', () => {
    it('should initialize form with empty email and password', () => {
      expect(component.form.get('email')?.value).toBe('');
      expect(component.form.get('password')?.value).toBe('');
    });

    it('should have email as required and email format validator', () => {
      const emailControl = component.form.get('email');
      emailControl?.setValue('');
      expect(emailControl?.hasError('required')).toBe(true);

      emailControl?.setValue('invalid');
      expect(emailControl?.hasError('email')).toBe(true);

      emailControl?.setValue('user@example.com');
      expect(emailControl?.valid).toBe(true);
    });

    it('should have password as required and minLength validator', () => {
      const passwordControl = component.form.get('password');
      passwordControl?.setValue('');
      expect(passwordControl?.hasError('required')).toBe(true);

      passwordControl?.setValue('123');
      expect(passwordControl?.hasError('minlength')).toBe(true);

      passwordControl?.setValue('password123');
      expect(passwordControl?.valid).toBe(true);
    });
  });

  describe('Form Validation', () => {
    it('should be invalid when email or password is empty', () => {
      component.form.get('email')?.setValue('');
      component.form.get('password')?.setValue('password123');
      expect(component.form.invalid).toBe(true);

      component.form.get('email')?.setValue('user@example.com');
      component.form.get('password')?.setValue('');
      expect(component.form.invalid).toBe(true);
    });

    it('should be invalid with invalid email format', () => {
      component.form.get('email')?.setValue('invalid-email');
      component.form.get('password')?.setValue('password123');
      expect(component.form.invalid).toBe(true);
    });

    it('should be valid with correct email and password', () => {
      component.form.get('email')?.setValue('user@example.com');
      component.form.get('password')?.setValue('password123');
      expect(component.form.valid).toBe(true);
    });
  });

  describe('Login Submission', () => {
    beforeEach(() => {
      authServiceSpy.login.and.returnValue(of({ token: 'test-token' }));
      component.form.get('email')?.setValue('user@example.com');
      component.form.get('password')?.setValue('password123');
    });

    it('should not call auth service when form is invalid', () => {
      component.form.get('email')?.setValue('');
      component.submit();
      expect(authServiceSpy.login).not.toHaveBeenCalled();
    });

    it('should mark form as touched on invalid submit', () => {
      component.form.get('email')?.setValue('');
      component.submit();
      expect(component.form.touched).toBe(true);
    });

    it('should call auth service with valid credentials', fakeAsync(() => {
      component.submit();
      tick();
      expect(authServiceSpy.login).toHaveBeenCalledWith(
        'user@example.com',
        'password123',
      );
    }));

    it('should set isLoading to true during login', fakeAsync(() => {
      component.submit();
      expect(component.isLoading).toBe(true);
      tick();
    }));

    it('should redirect to dashboard on success', fakeAsync(() => {
      component.submit();
      tick();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
    }));

    it('should display 401 error message on invalid credentials', fakeAsync(() => {
      const error: AuthError = { message: 'Invalid credentials', code: '401' };
      authServiceSpy.login.and.returnValue(throwError(() => error));

      component.submit();
      tick();
      expect(component.apiError).toBe('Invalid email or password.');
      expect(component.isLoading).toBe(false);
    }));

    it('should display 400 error message on bad request', fakeAsync(() => {
      const error: AuthError = { message: 'Bad request', code: '400' };
      authServiceSpy.login.and.returnValue(throwError(() => error));

      component.submit();
      tick();
      expect(component.apiError).toBe(
        'Invalid input. Please check your credentials.',
      );
    }));

    it('should display network error message on code 0', fakeAsync(() => {
      const error: AuthError = { message: 'Network error', code: '0' };
      authServiceSpy.login.and.returnValue(throwError(() => error));

      component.submit();
      tick();
      expect(component.apiError).toBe(
        'Cannot reach the server. Please try again later.',
      );
    }));

    it('should clear error message before new login attempt', () => {
      component.apiError = 'Previous error';
      component.submit();
      expect(component.apiError).toBeNull();
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility', () => {
      expect(component.showPassword).toBe(false);
      component.togglePassword();
      expect(component.showPassword).toBe(true);
      component.togglePassword();
      expect(component.showPassword).toBe(false);
    });
  });

  describe('Redirect on Init', () => {
    it('should redirect to dashboard if already authenticated', () => {
      authServiceSpy.isAuthenticated.and.returnValue(true);
      component.ngOnInit();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('should not redirect if not authenticated', () => {
      authServiceSpy.isAuthenticated.and.returnValue(false);
      component.ngOnInit();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });
});

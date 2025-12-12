import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './core/services/auth.interceptor';
import { MqttModule, IMqttServiceOptions } from 'ngx-mqtt';

const mqttServiceOptions: IMqttServiceOptions = {
  hostname: 'broker.hivemq.com',
  port: 8884,
  path: '/mqtt',
  clientId: `angular-${Math.random().toString(36).substr(2, 9)}`,
  connectTimeout: 5000,
  reconnectPeriod: 5000,
  clean: true,
  protocol: 'wss',
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    MqttModule.forRoot(mqttServiceOptions).providers || [],
  ],
};
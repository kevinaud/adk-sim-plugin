import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { GrpcSessionGateway, SessionGateway } from './data-access/session';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Provide the SessionGateway abstract class with the gRPC implementation
    { provide: SessionGateway, useClass: GrpcSessionGateway },
  ],
};

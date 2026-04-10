import { Route } from '@angular/router';
import { LoginComponent } from './login.component';
import { RegisterComponent } from './register.component';
import { HomeComponent } from './home.component';
import { ProjectsListComponent } from './projects-list.component';
import { authGuard } from './auth.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    component: ProjectsListComponent,
    canActivate: [authGuard],
  },
  {
    path: 'p/:projectId',
    component: HomeComponent,
    canActivate: [authGuard],
  },
  {
    path: 'register',
    component: RegisterComponent,
  },
  {
    path: 'login',
    component: LoginComponent,
  },
];

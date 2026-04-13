import { Route } from '@angular/router';
import { LoginComponent } from './components/login.component';
import { RegisterComponent } from './components/register.component';
import { HomeComponent } from './components/home.component';
import { ProjectsListComponent } from './components/projects-list.component';
import { authGuard } from './guards/auth.guard';

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

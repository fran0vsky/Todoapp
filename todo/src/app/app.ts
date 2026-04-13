import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  template: '<router-outlet />',
  host: {
    class: 'flex min-h-0 flex-1 flex-col',
  },
})
export class App {}

import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  template: '<router-outlet />',
  host: {
    class: 'flex flex-col h-screen',
  },
})
export class App {}

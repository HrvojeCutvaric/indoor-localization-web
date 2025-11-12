import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  imports: [FormsModule],
})
export class App {
  email = '';
  password = '';
  showPassword = false;

  onLogin() {
    console.log('Login:', this.email, this.password);
  }
}

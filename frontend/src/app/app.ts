import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('frontend');
  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http
      .get('http://localhost:3000/api/health')
      .subscribe(res => {
        console.log('Backend response:', res);
      });
  }
}

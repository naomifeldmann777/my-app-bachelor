import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

@Injectable({ providedIn: 'root'})
export class PetriApiService {

    // Base URL of the backend Petri net API
    private baseUrl: string = 'http://localhost:3000/api/petri'; 

    constructor(private http: HttpClient) {}
    
    // Requests the current Petri net state from the backend
    // GET request to backend endpoint
    getState(): Observable<any> {
        return this.http.get(`${this.baseUrl}/state`);     
    }

    // Requests all currently fireable transitions
    // GET request to backend endpoint
    getFireableTransitions(): Observable<any> {
        return this.http.get(`${this.baseUrl}/fireableTransitions`); 
    }

    // Checks whether a specific transition is fireable
    // GET request to backend endpoint with transition ID in URL
    isFireable(id: string): Observable<any> {
        return this.http.get(`${this.baseUrl}/isFireable/${id}`); 
    }

     // Fires a transition on the backend
     // POST request that changes backend state
    fireTransition(id: string): Observable<any> {
        return this.http.post(`${this.baseUrl}/fireTransition/${id}`, {})
    }
}
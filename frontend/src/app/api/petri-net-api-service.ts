import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { PetriNetModel } from "../domain/petri-net-model";
import { TransitionModel } from "../domain/transition-model";

@Injectable({ providedIn: 'root'})
export class PetriApiService {

    // Base URL of the backend Petri net API
    private baseUrl: string = 'http://localhost:3000/api/petri'; 

    constructor(private http: HttpClient) {}
    
    // Requests the current Petri net state from the backend
    // GET request to backend endpoint
    getState(): Observable<PetriNetModel> {
        return this.http.get<PetriNetModel>(`${this.baseUrl}/state`);     
    }

    // Requests a reset of the Petri net to its initial state and gets the reset state
    // POST request to backend endpoint
    reset(): Observable<PetriNetModel> {
        return this.http.post<PetriNetModel>(`${this.baseUrl}/reset`, {})
    }


    // Requests all currently fireable transitions
    // GET request to backend endpoint
    getFireableTransitions(): Observable<TransitionModel[]> {
        return this.http.get<TransitionModel[]>(`${this.baseUrl}/fireableTransitions`); 
    }

    // Checks whether a specific transition is fireable
    // GET request to backend endpoint with transition ID in URL
    isFireable(id: string): Observable<boolean> {
        return this.http.get<boolean>(`${this.baseUrl}/isFireable/${id}`); 
    }

     // Fires a transition on the backend
     // POST request that changes backend state
    fireTransition(id: string): Observable<{fired: boolean, state: PetriNetModel;}> {
        return this.http.post <{fired: boolean, state: PetriNetModel;}>(`${this.baseUrl}/fireTransition/${id}`, {})
    }
}
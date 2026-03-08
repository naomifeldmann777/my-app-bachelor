import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { PetriNetModel } from "../domain/petri-net-model";
import { TransitionModel } from "../domain/transition-model";

@Injectable({ providedIn: 'root'})
export class PetriApiService {

    // Base URL of the backend Petri net API
    private baseUrl: string = '/api/petri'; 

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

    // Updates the position of a place
    // PATCH request to backend endpoint with place ID in URL and new position in body
    updatePlacePosition(id: string, x: number, y: number, z: number): Observable<{success: boolean, state: PetriNetModel}> {
        return this.http.patch<{success: boolean, state: PetriNetModel}>(`${this.baseUrl}/place/${id}/position`, {x, y, z});
    }

    // Updates the position of a transition
    // PATCH request to backend endpoint with transition ID in URL and new position in body
    updateTransitionPosition(id: string, x: number, y: number, z: number): Observable<{success: boolean, state: PetriNetModel}> {
        return this.http.patch<{success: boolean, state: PetriNetModel}>(`${this.baseUrl}/transition/${id}/position`, {x, y, z});
    }

    // Creates a new place at specified position
    // POST request to backend endpoint with position in body
    createPlace(x: number, y: number, z: number): Observable<{success: boolean, state: PetriNetModel}> {
        return this.http.post<{success: boolean, state: PetriNetModel}>(`${this.baseUrl}/place`, {x, y, z});
    }

    // Creates a new transition at specified position
    // POST request to backend endpoint with position in body
    createTransition(x: number, y: number, z: number): Observable<{success: boolean, state: PetriNetModel}> {
        return this.http.post<{success: boolean, state: PetriNetModel}>(`${this.baseUrl}/transition`, {x, y, z});
    }

    // Creates a new arc between two elements
    // POST request to backend endpoint with from/to IDs in body
    createArc(from: string, to: string): Observable<{success: boolean, state: PetriNetModel}> {
        return this.http.post<{success: boolean, state: PetriNetModel}>(`${this.baseUrl}/arc`, {from, to});
    }
}
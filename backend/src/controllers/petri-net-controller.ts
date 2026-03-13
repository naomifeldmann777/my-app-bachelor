import { Request, Response} from 'express'; 
// Import PetriNetEngine which contains the business logic
import { PetriNetEngine } from '../services/petri-net-engine';

// The PetriNetController acts as the Controller in the MVC pattern
// It receives HTTP requests, calls the PetriNetEngine, and sends responses back to the client (frontend)
export class PetriNetController {
    // Reference to the PetriNetEngine instance so that controller can access the petri net state and logic
    private engine: PetriNetEngine; 

    constructor (engine: PetriNetEngine) {
        this.engine = engine; 
    }

    // GET /api/petri/state
    // Returns the full current Petri net state
    // Endpoint used by the frontend to render or update the visualization of the petri net
    public getState = (req: Request, res: Response) => {
        // Retrieve current petri net state from the engine
        const state = this.engine.getState(); 
        // Send the petri net state as JSON to the client
        res.json(state); 
    }

    // POST /api/petri/reset
    // Resets the Petri net to its initial state
    // Endpoint used by the frontend to reset the petri net to the initial configuration defined in the JSON file
    public reset = (req: Request, res: Response) => {
        // Reset the petri net in the engine
        const state = this.engine.resetPetriNet(); 
        // Send the reset petri net state as JSON to the client
        res.json(state); 
    }
    
    // GET /api/petri/fireableTransitions
    // Returns all transitions that are currently fireable
    // Used by the frontend to display enabled transitions in the UI
    public getFireableTransitions = (req: Request, res: Response) => {
        // Retrieve all fireable transitions from the engine
        const fireableTransitions = this.engine.getFireableTransitions(); 
        // Send the list of fireable transitions as JSON
        res.json(fireableTransitions); 
    }

    // GET /api/petri/isFireable/:id
    // Checks whether a specific transition (by id) is fireable
    public isFireableById = (req: Request<{id: string}>, res: Response) => {
        // Get the transition ID from the URL parameters
        const id = req.params.id; 
        // Ask engine whether this transition is fireable
        const isFireable = this.engine.isFireableById(id); 
        // Return the result as a JSON object
        res.json({isFireable}); 
    }

    // POST /api/petri/fireTransition/:id
    // Fires a transition with the given ID
    // This modifies the Petri net state (tokens move)
    public fireTransitionById = (req: Request<{id: string}>, res: Response) => {
        // Get the transition ID from the URL parameters
        const id = req.params.id;
        // Try to fire the transition in the engine, the result indicates whether firing was successful 
        const fired = this.engine.fireTransitionById(id); 
        // Return whether transition was fired successfully
        // Also return the updated Petri net state to allow frontend to immediately update its visualization
        res.json({
            fired, 
            state: this.engine.getState()
        }); 
    }

    // PATCH /api/petri/place/:id/position
    // Updates the position of a place
    public updatePlacePosition = (req: Request<{id: string}, any, {x: number, y: number, z: number}>, res: Response) => {
        // Get the place ID from the URL parameters
        const { id } = req.params;
        // Get the new position from the request body
        const { x, y, z } = req.body;
        // Update the place position in the engine and get whether it was successful
        const success = this.engine.updatePlacePosition(id, x, y, z);
        // Return whether the update was successful and the updated Petri net state
        res.json({ success, state: this.engine.getState() });
    }

    // PATCH /api/petri/transition/:id/position
    // Updates the position of a transition
    public updateTransitionPosition = (req: Request<{id: string}, any, {x: number, y: number, z: number}>, res: Response) => {
        // Get the transition ID from the URL parameters
        const { id } = req.params;
        // Get the new position from the request body
        const { x, y, z } = req.body;
        // Update the transition position in the engine and get whether it was successful
        const success = this.engine.updateTransitionPosition(id, x, y, z);
        // Return whether the update was successful and the updated Petri net state
        res.json({ success, state: this.engine.getState() });
    }

    // POST /api/petri/place
    // Creates a new place at the specified position
    public createPlace = (req: Request<{}, any, {x: number, y: number, z: number}>, res: Response) => {
        // Get the new place position from the request body
        const { x, y, z } = req.body;
        // Create the new place in the engine and get whether it was successful
        const success = this.engine.createPlace(x, y, z);
        // Return whether the creation was successful and the updated Petri net state
        res.json({ success, state: this.engine.getState() });
    }

    // POST /api/petri/transition
    // Creates a new transition at the specified position
    public createTransition = (req: Request<{}, any, {x: number, y: number, z: number}>, res: Response) => {
        // Get the new transition position from the request body
        const { x, y, z } = req.body;
        // Create the new transition in the engine and get whether it was successful
        const success = this.engine.createTransition(x, y, z);
        // Return whether the creation was successful and the updated Petri net state
        res.json({ success, state: this.engine.getState() });
    }

    // POST /api/petri/arc
    // Creates a new arc between two elements
    public createArc = (req: Request<{}, any, {from: string, to: string}>, res: Response) => {
        // Get the IDs of the from/to elements from the request body
        const { from, to } = req.body;
        // Create the new arc in the engine and get whether it was successful
        const success = this.engine.createArc(from, to);
        // Return whether the creation was successful and the updated Petri net state
        res.json({ success, state: this.engine.getState() });
    }

    // DELETE /api/petri/place/:id
    // Deletes a place and all its connected arcs
    public deletePlace = (req: Request<{id: string}>, res: Response) => {
        // Get the place ID from the URL parameters
        const { id } = req.params;
        // Delete the place (and connected arcs) in the engine
        const success = this.engine.deletePlace(id);
        // Return whether the deletion was successful and the updated Petri net state
        res.json({ success, state: this.engine.getState() });
    }

    // DELETE /api/petri/transition/:id
    // Deletes a transition and all its connected arcs
    public deleteTransition = (req: Request<{id: string}>, res: Response) => {
        // Get the transition ID from the URL parameters
        const { id } = req.params;
        // Delete the transition (and connected arcs) in the engine
        const success = this.engine.deleteTransition(id);
        // Return whether the deletion was successful and the updated Petri net state
        res.json({ success, state: this.engine.getState() });
    }

    // DELETE /api/petri/arc/:id
    // Deletes a single arc by ID
    public deleteArc = (req: Request<{id: string}>, res: Response) => {
        // Get the arc ID from the URL parameters
        const { id } = req.params;
        // Delete the arc in the engine
        const success = this.engine.deleteArc(id);
        // Return whether the deletion was successful and the updated Petri net state
        res.json({ success, state: this.engine.getState() });
    }

    // PATCH /api/petri/place/:id/properties
    // Updates editable properties of a place (label, tokens, role)
    public updatePlaceProperties = (req: Request<{id: string}, any, {label?: string; tokens?: number; role?: string}>, res: Response) => {
        // Get the place ID from the URL parameters
        const { id } = req.params;
        // Update the place properties in the engine and get whether it was successful
        const success = this.engine.updatePlaceProperties(id, req.body);
        // Return whether the update was successful and the updated Petri net state
        res.json({ success, state: this.engine.getState() });
    }

    // PATCH /api/petri/transition/:id/properties
    // Updates editable properties of a transition (label, capability)
    public updateTransitionProperties = (req: Request<{id: string}, any, {label?: string; capability?: string}>, res: Response) => {
        // Get the transition ID from the URL parameters
        const { id } = req.params;
        // Update the transition properties in the engine and get whether it was successful
        const success = this.engine.updateTransitionProperties(id, req.body);
        // Return whether the update was successful and the updated Petri net state
        res.json({ success, state: this.engine.getState() });
    }

    // PATCH /api/petri/arc/:id/weight
    // Updates the weight of an arc
    public updateArcWeight = (req: Request<{id: string}, any, {weight: number}>, res: Response) => {
        // Get the arc ID from the URL parameters
        const { id } = req.params;
        // Update the arc weight in the engine and get whether it was successful
        const success = this.engine.updateArcWeight(id, req.body.weight);
        // Return whether the update was successful and the updated Petri net state
        res.json({ success, state: this.engine.getState() });
    }
}
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

    // GET /api/petri/fireableTransitions
    // Returns all transitions that are currently fireable
    // Used by the frontend to display enabled transitions in the UI
    public getFireableTransitions = (req: Request, res: Response) => {
        // Retrieve all fireable transitions from the engine
        const fireableTransitions = this.engine.getFireableTransitions(); 
        // Send the list of fireable transitions as JSON
        res.json(fireableTransitions); 
    }

    // POST /api/petri/isFireable/:id
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
}
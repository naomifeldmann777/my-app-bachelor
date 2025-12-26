import { PetriNet } from "../domain/petri-net";
import { Transition } from "../domain/transition";
import { Arc } from "../domain/arc"; 
import { Place } from "../domain/place"; 
import { PetriNetLoader } from "./petri-net-loader";


// The PetriNetEngine contains all execution logic for a Petri net.
// It holds the Petri net state and provides methods to query and modify it.
export class PetriNetEngine {
    // The current Petri net instance from the selected json file
    public petriNet: PetriNet; 

    constructor () {
        // Create a loader instance
        const loader = new PetriNetLoader(); 
        // Load the Petri net model from a JSON file 
        this.petriNet = loader.loadFromFile("../data/example-petrinet.json"); 
    }

    // Returns the full current Petri net state
    // Used by the controller to send petri net state to the frontend
    public getState(): PetriNet {
        return this.petriNet;
    }

    // Returns all currently fireable transitions
    public getFireableTransitions(): Transition[] {
        // Get all transitions of the Petri net
        let transitions: Transition[] = this.petriNet.transitions; 
        // Filter transitions based on the fireability condition
        let fireableTransitions: Transition[] = transitions.filter((t) => this.isFireable(t));
        // Return only transitions that can currently fire
        return fireableTransitions; 
    }

    // Checks the fireability of a transition by its ID
    public isFireableById(id: string): boolean {
        // Find the transition with the given ID
        const transition = this.petriNet.transitions.find(t => t.id === id);
        // If the transition does not exist, it is not fireable
        if (!transition) {
            return false; 
        }
        // Delegate to private isFireable method
        return this.isFireable(transition); 
    }

    // Fires a transition with the given ID
    // This is the method that will be called by the controller
    public fireTransitionById(id: string): boolean {
        // Find the transition with the given ID
        const transition = this.petriNet.transitions.find(t => t.id === id);
        // If no such transition exists, firing fails
        if (!transition) {
            return false;
        }
        // Delegate to private fireTransition method
        return this.fireTransition(transition);
    }

    // Determines whether a given transition is fireable
    private isFireable(transition: Transition): boolean {

        // Find all incoming arcs (Place -> this Transition)
        const incomingArcs: Arc[] = this.petriNet.arcs.filter(a => a.to === transition.id); 
        // Find all outgoing arcs (this Transition -> Place)
        const outgoingArcs: Arc[] = this.petriNet.arcs.filter(a => a.from === transition.id); 
        // Transition must have at least one incoming and one outgoing arc
        if (incomingArcs.length === 0 || outgoingArcs.length === 0) {
            return false; 
        }
        // Check if there are enough tokens for every input place
        for (let arc of incomingArcs) {
            // Find the input place connected to this arc
            let inputPlace: Place | undefined = this.petriNet.places.find(p => p.id === arc.from); 
            // If input place lacks tokens, transition is not fireable
            if (!inputPlace || inputPlace.tokens < arc.weight){
                return false; 
            }
        }
        return true; 
    }

    // Internal method that performs the actual firing logic
    private fireTransition(transition: Transition): boolean{
        // Abort firing if the transition is not fireable
        if (!this.isFireable(transition)) {
            return false; 
        }
        // Retrieve all incoming arcs (Place -> Transition)
        const incomingArcs: Arc[] = this.petriNet.arcs.filter(a => a.to === transition.id);
        // Retrieve all outgoing arcs (Transition -> Place)
        const outgoingArcs: Arc[] = this.petriNet.arcs.filter(a => a.from === transition.id);

        // Consume tokens from all input places
        for (let arc of incomingArcs) {
            // Find the input place connected to this arc
            let inputPlace: Place | undefined = this.petriNet.places.find(p => p.id === arc.from); 
            // Subtract tokens according to arc weight
            if (inputPlace) {
                inputPlace.tokens -= arc.weight; 
            }
        }

        // Produce tokens to all output places
        for (let arc of outgoingArcs) {
            // Find the output place connected to this arc
            let outputPlace: Place | undefined = this.petriNet.places.find(p => p.id === arc.to); 
            // Add tokens according to arc weight
            if (outputPlace) {
                outputPlace.tokens += arc.weight; 
            }
        }
        // Indicate that the transition was fired successfully
        return true;
    }
}

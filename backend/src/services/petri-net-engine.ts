import { PetriNet } from "../domain/petri-net";
import { Transition } from "../domain/transition";
import { Arc } from "../domain/arc"; 
import { Place } from "../domain/place"; 
import { PetriNetLoader } from "./petri-net-loader";


// The PetriNetEngine contains all execution logic for a Petri net.
// It holds the Petri net state and provides methods to query and modify it.
export class PetriNetEngine {
    // The current Petri net instance from the selected json file
    public currentPetriNet: PetriNet;
    // Create a loader instance
    public loader = new PetriNetLoader(); 

    constructor () {
        // Load the Petri net model from a JSON file 
        this.currentPetriNet = this.loader.loadFromFile("../data/example3-petrinet.json"); 
    }

    // Returns the full current Petri net state
    // Used by the controller to send petri net state to the frontend
    public getState(): PetriNet {
        return this.currentPetriNet; 
    }

    // Resets the Petri net to its initial state loaded from the JSON file and returns it
    // Used by the controller to reset the petri net when requested by the frontend
    public resetPetriNet() {
        this.currentPetriNet = this.loader.loadFromFile("../data/example3-petrinet.json"); 
        return this.currentPetriNet; 
    }

    // Returns all currently fireable transitions
    public getFireableTransitions(): Transition[] {
        // Get all transitions of the Petri net
        let transitions: Transition[] = this.currentPetriNet.transitions; 
        // Filter transitions based on the fireability condition
        let fireableTransitions: Transition[] = transitions.filter((t) => this.isFireable(t));
        // Return only transitions that can currently fire
        return fireableTransitions; 
    }

    // Checks the fireability of a transition by its ID
    public isFireableById(id: string): boolean {
        // Find the transition with the given ID
        const transition = this.currentPetriNet.transitions.find(t => t.id === id);
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
        const transition = this.currentPetriNet.transitions.find(t => t.id === id);
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
        const incomingArcs: Arc[] = this.currentPetriNet.arcs.filter(a => a.to === transition.id); 
        // Find all outgoing arcs (this Transition -> Place)
        const outgoingArcs: Arc[] = this.currentPetriNet.arcs.filter(a => a.from === transition.id); 
        // Transition must have at least one incoming and one outgoing arc
        if (incomingArcs.length === 0 || outgoingArcs.length === 0) {
            return false; 
        }
        // Check if there are enough tokens for every input place
        for (let arc of incomingArcs) {
            // Find the input place connected to this arc
            let inputPlace: Place | undefined = this.currentPetriNet.places.find(p => p.id === arc.from); 
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
        const incomingArcs: Arc[] = this.currentPetriNet.arcs.filter(a => a.to === transition.id);
        // Retrieve all outgoing arcs (Transition -> Place)
        const outgoingArcs: Arc[] = this.currentPetriNet.arcs.filter(a => a.from === transition.id);

        // Consume tokens from all input places
        for (let arc of incomingArcs) {
            // Find the input place connected to this arc
            let inputPlace: Place | undefined = this.currentPetriNet.places.find(p => p.id === arc.from); 
            // Subtract tokens according to arc weight
            if (inputPlace) {
                inputPlace.tokens -= arc.weight; 
            }
        }

        // Produce tokens to all output places
        for (let arc of outgoingArcs) {
            // Find the output place connected to this arc
            let outputPlace: Place | undefined = this.currentPetriNet.places.find(p => p.id === arc.to); 
            // Add tokens according to arc weight
            if (outputPlace) {
                outputPlace.tokens += arc.weight; 
            }
        }
        // Indicate that the transition was fired successfully
        return true;
    }

    // Updates the position of a place and returns success status
    public updatePlacePosition(id: string, x: number, y: number, z: number): boolean {
        // Find the place with the given ID
        const place = this.currentPetriNet.places.find(p => p.id === id);
        // If no such place exists, return false
        if (!place) return false;
        // Update the place's position with the new coordinates
        place.position = { x, y, z };
        // Indicate that the update was successful
        return true;
    }

    // Updates the position of a transition and returns success status
    public updateTransitionPosition(id: string, x: number, y: number, z: number): boolean {
        // Find the transition with the given ID
        const transition = this.currentPetriNet.transitions.find(t => t.id === id);
        // If no such transition exists, return false
        if (!transition) return false;
        // Update the transition's position with the new coordinates
        transition.position = { x, y, z };
        // Indicate that the update was successful
        return true;
    }

    // Creates a new place at the specified position and returns success status
    public createPlace(x: number, y: number, z: number): boolean {
        // Generate a new unique ID for the place (e.g., "p" followed by the number of existing places + 1)
        const newId = `p${this.currentPetriNet.places.length + 1}`;
        // Create a new Place object with default values and the specified position
        const newPlace: Place = {
            id: newId,
            label: newId,
            tokens: 0,
            position: { x, y, z },
            role: ''
        };
        // Add the new place to the Petri net's places array
        this.currentPetriNet.places.push(newPlace);
        // Indicate that the creation was successful
        return true;
    }

    // Creates a new transition at the specified position and returns success status
    public createTransition(x: number, y: number, z: number): boolean {
        // Generate a new unique ID for the transition (e.g., "t" followed by the number of existing transitions + 1)
        const newId = `t${this.currentPetriNet.transitions.length + 1}`;
        // Create a new Transition object with default values and the specified position
        const newTransition: Transition = {
            id: newId,
            label: newId,
            position: { x, y, z },
            capability: ''
        };
        // Add the new transition to the Petri net's transitions array
        this.currentPetriNet.transitions.push(newTransition);
        // Indicate that the creation was successful
        return true;
    }

    // Deletes a place by ID and removes all arcs connected to it
    public deletePlace(id: string): boolean {
        // Check if place exists
        const index = this.currentPetriNet.places.findIndex(p => p.id === id);
        if (index === -1) return false;
        // Remove the place (remove 1 element at the found index)
        this.currentPetriNet.places.splice(index, 1);
        // Remove all arcs connected to this place (either as source or target)
        this.currentPetriNet.arcs = this.currentPetriNet.arcs.filter(a => a.from !== id && a.to !== id);
        return true;
    }

    // Deletes a transition by ID and removes all arcs connected to it
    public deleteTransition(id: string): boolean {
        // Check if transition exists
        const index = this.currentPetriNet.transitions.findIndex(t => t.id === id);
        if (index === -1) return false;
        // Remove the transition (remove 1 element at the found index)
        this.currentPetriNet.transitions.splice(index, 1);
        // Remove all arcs connected to this transition (either as source or target)
        this.currentPetriNet.arcs = this.currentPetriNet.arcs.filter(a => a.from !== id && a.to !== id);
        return true;
    }

    // Deletes a single arc by ID
    public deleteArc(id: string): boolean {
        // Check if arc exists
        const index = this.currentPetriNet.arcs.findIndex(a => a.id === id);
        if (index === -1) return false;
        // Remove the arc (remove 1 element at the found index)
        this.currentPetriNet.arcs.splice(index, 1);
        return true;
    }

    // Updates editable properties of a place (label, tokens, role)
    public updatePlaceProperties(id: string, props: { label?: string; tokens?: number; role?: string }): boolean {
        // Find the place with the given ID
        const place = this.currentPetriNet.places.find(p => p.id === id);
        // If no such place exists, return false
        if (!place) return false;
        // Update the place's properties with the new values if they are provided in the props object
        if (props.label !== undefined) place.label = props.label;
        if (props.tokens !== undefined) place.tokens = props.tokens;
        if (props.role !== undefined) place.role = props.role;
        // Indicate that the update was successful
        return true;
    }

    // Updates editable properties of a transition (label, capability)
    public updateTransitionProperties(id: string, props: { label?: string; capability?: string }): boolean {
        // Find the transition with the given ID
        const transition = this.currentPetriNet.transitions.find(t => t.id === id);
        // If no such transition exists, return false
        if (!transition) return false;
        // Update the transition's properties with the new values if they are provided in the props object
        if (props.label !== undefined) transition.label = props.label;
        if (props.capability !== undefined) transition.capability = props.capability;
        // Indicate that the update was successful
        return true;
    }

    // Updates the weight of an arc
    public updateArcWeight(id: string, weight: number): boolean {
        // Find the arc with the given ID
        const arc = this.currentPetriNet.arcs.find(a => a.id === id);
        // If no such arc exists, return false
        if (!arc) return false;
        // Update the arc's weight with the new value
        arc.weight = weight;
        // Indicate that the update was successful
        return true;
    }

    // Creates a new arc between two elements and returns success status
    public createArc(from: string, to: string): boolean {
        // Validate that from element exists (either a place or transition)
        const fromExists = this.currentPetriNet.places.some(p => p.id === from) || 
                          this.currentPetriNet.transitions.some(t => t.id === from);
        // Validate that to element exists (either a place or transition)
        const toExists = this.currentPetriNet.places.some(p => p.id === to) || 
                        this.currentPetriNet.transitions.some(t => t.id === to);
        // If either the from or to element does not exist, arc creation fails
        if (!fromExists || !toExists) return false;

        // Check if arc already exists
        if (this.currentPetriNet.arcs.some(a => a.from === from && a.to === to)) {
            return false; // Arc already exists
        }
        // Create a new Arc object with a unique ID, the specified from/to elements and default weight of 1
        const newId = `a${this.currentPetriNet.arcs.length + 1}`;
        const newArc: Arc = {
            id: newId,
            from,
            to,
            weight: 1
        };
        // Add the new arc to the Petri net's arcs array
        this.currentPetriNet.arcs.push(newArc);
        // Indicate that the creation was successful
        return true;
    }

    // Saves the current Petri net model to a JSON file
    public savePetriNetToFile(petriNet: PetriNet): string {
        // Use the loader's saveToFile method to save the model and return the filename 
        return this.loader.saveToFile(petriNet);
    }}
import { Place } from '../domain/place'
import { Transition } from '../domain/transition'
import { Arc } from '../domain/arc'

export class PetriNet {
    public places: Place[]; 
    public transitions: Transition[];
    public arcs: Arc[]; 

    constructor (places: Place[], transitions: Transition[], arcs: Arc[]) {
        this.places = places; 
        this.transitions = transitions; 
        this.arcs = arcs; 
    }
}
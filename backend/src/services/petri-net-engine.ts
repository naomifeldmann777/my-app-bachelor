import { PetriNetLoader } from "./petri-net-loader";

export class PetriNetEngine {
    public petriNet; 

constructor () {
    const loader = new PetriNetLoader(); 
    this.petriNet = loader.loadFromFile("../data/example-petrinet.json"); 
    console.log(this.petriNet); 
}
}

// Represents an arc in the Petri net, connecting a place to a transition or vice versa
export class Arc {
    public id: string; 
    public weight: number; 
    public from: string; 
    public to: string; 

    constructor (id: string, weight: number, from: string, to: string) {
        this.id = id; 
        this.weight = weight;  
        this.from = from; 
        this.to = to; 
    }
}
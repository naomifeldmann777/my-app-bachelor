// Represents a transition in the Petri net, which can be connected to places via arcs
export class Transition {
    public id: string; 
    public label: string; 
    public capability: string; 
    public position: { x: number, y: number, z: number}; 
    
    constructor (id: string, label: string, capability: string, position: {x: number, y: number, z: number}) {
        this.id = id; 
        this.label = label;
        this.capability = capability; 
        this.position = position; 
    }
}
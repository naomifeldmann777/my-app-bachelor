// Represents a place in the Petri net, which can hold tokens and be connected to transitions via arcs
export class Place {
    public id: string; 
    public label: string; 
    public tokens: number; 
    public position: { x: number, y: number, z: number}; 
    public role: string; 

    constructor (id: string, label: string, tokens: number, position: {x: number, y: number, z: number}, role: string) {
        this.id = id; 
        this.label = label;
        this.tokens = tokens; 
        this.position = position; 
        this.role = role;
    }
}
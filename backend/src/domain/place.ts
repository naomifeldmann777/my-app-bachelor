export class Place {
    public id: string; 
    public label: string; 
    public tokens: number; 
    public position: { x: number, y: number, z: number}; 

    constructor (id: string, label: string, tokens: number, position: {x: number, y: number, z: number}) {
        this.id = id; 
        this.label = label;
        this.tokens = tokens; 
        this.position = position; 
    }
}
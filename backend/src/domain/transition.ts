export class Transition {
    public id: string; 
    public label: string; 
    public robotAction: string; 
    public position: { x: number, y: number, z: number}; 
    
    constructor (id: string, label: string, robotAction: string, position: {x: number, y: number, z: number}) {
        this.id = id; 
        this.label = label;
        this.robotAction = robotAction; 
        this.position = position; 
    }
}
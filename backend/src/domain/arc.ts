export class Arc {
    public id: string; 
    public label: string; 
    public weight: number; 
    public from: string; 
    public to: string; 

    constructor (id: string, label: string, weight: number, from: string, to: string) {
        this.id = id; 
        this.label = label; 
        this.weight = weight;  
        this.from = from; 
        this.to = to; 
    }
}
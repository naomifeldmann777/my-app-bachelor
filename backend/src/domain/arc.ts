export class Arc {
    public id: string; 
    public label: string; 
    public from: string; 
    public to: string; 

    constructor (id: string, label: string, from: string, to: string) {
        this.id = id; 
        this.label = label; 
        this.from = from; 
        this.to = to; 
    }
}
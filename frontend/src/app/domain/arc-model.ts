// Defines the data shape of a Petri net arc as received from the backend
export interface ArcModel {
    id: string; 
    weight: number; 
    from: string; 
    to: string; 
}
// Defines the data shape of a Petri net transition as received from the backend
export interface PlaceModel {
    id: string; 
    label: string; 
    tokens: number; 
    position: { x: number, y: number, z: number}; 
    role: string; 
}
// Defines the data shape of a Petri net transition as received from the backend
export interface TransitionModel {
    id: string; 
    label: string; 
    robotAction: string; 
    position: { x: number, y: number, z: number};
}
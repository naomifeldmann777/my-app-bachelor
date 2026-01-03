// Defines the data shape of a Petri net as received from the backend
import { ArcModel } from "./arc-model";
import { PlaceModel } from "./place-model";
import { TransitionModel } from "./transition-model";

export interface PetriNetModel {
    places: PlaceModel[]; 
    transitions: TransitionModel[];
    arcs: ArcModel[]; 
}
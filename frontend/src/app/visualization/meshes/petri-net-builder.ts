import * as THREE from 'three';
import { PetriNetModel } from '../../domain/petri-net-model';
import { PlaceMesh } from './place-mesh';
import { TransitionMesh } from './transition-mesh';
import { ArcMesh } from './arc-mesh';

// Helper class that constructs a Petri net in a Three.js Scene
export class PetriNetBuilder {

    // Define a static method that builds the full Petri net into a given scene
    static buildNet(scene: THREE.Scene, petriNet: PetriNetModel) {
        // Create a map to store place meshes by their place ID
        const placeMap = new Map<string, THREE.Mesh>();
        // Create a map to store transition meshes by their transition ID 
        const transitionMap = new Map<string, THREE.Mesh>();


        // Iterate over all places defined in the Petri net model
        petriNet.places.forEach(place => {
            // Create a 3D mesh representation for the current place
            const placeMesh = new PlaceMesh(place); 
            // Add the place mesh to the Three.js scene
            scene.add(placeMesh.mesh);
            // Store the mesh in the place map using the place ID as the key
            placeMap.set(place.id, placeMesh.mesh);
        }); 

        // Iterate over all transitions defined in the Petri net model
        petriNet.transitions.forEach(transition => {
            // Create a 3D mesh representation for the current transition
            const transitionMesh = new TransitionMesh(transition); 
            // Add the transition mesh to the Three.js scene
            scene.add(transitionMesh.mesh);
            // Store the mesh in the transition map using the transition ID as the key
            transitionMap.set(transition.id, transitionMesh.mesh);
        });

        // Iterate over all arcs defined in the Petri net model
        petriNet.arcs.forEach (arc => {
            // Try to find a place mesh whose ID matches the arc's "from" field
            const fromPlace = placeMap.get(arc.from);

            // Determine whether the arc starts from a place or a transition
            const startType: 'place' | 'transition' = fromPlace ? 'place' : 'transition';
            // Get the actual mesh where the arc starts (either place or transition)
            const fromMesh = placeMap.get(arc.from) || transitionMap.get(arc.from); 
            // Get the actual mesh where the arc ends (either place or transition)
            const toMesh = placeMap.get(arc.to) || transitionMap.get(arc.to);
            // Create a 3D arc mesh using the arc data, start position, end position, and start type 
            const arcMesh = new ArcMesh(arc, fromMesh!.position, toMesh!.position, startType); 
            // Add the arc mesh to the Three.js scene
            scene.add(arcMesh.mesh);
        }); 
    }
    
}
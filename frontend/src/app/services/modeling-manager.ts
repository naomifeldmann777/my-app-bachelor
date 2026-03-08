import * as THREE from 'three';
import { PetriApiService } from '../api/petri-net-api-service';

// Modes for modeling interactions
export enum ModelingMode {
    IDLE = 'IDLE', // Default mode - no modeling action active
    CREATE_PLACE = 'CREATE_PLACE', // User clicked "Create Place" button - waiting for position click
    CREATE_TRANSITION = 'CREATE_TRANSITION', // User clicked "Create Transition" button - waiting for position click
    CONNECT_ELEMENTS = 'CONNECT_ELEMENTS' // User clicked "Connect Elements" button - waiting for 2 element selections
}

// Manages interactive modeling of Petri net elements
export class ModelingManager {
    private mode: ModelingMode = ModelingMode.IDLE; // Current modeling mode - starts idle
    private selectedElements: THREE.Mesh[] = []; // For connect mode: stores the 2 elements to connect
    private scene: THREE.Scene; // Reference to Three.js scene for adding/removing preview mesh
    private api: PetriApiService; // API service for backend communication
    private onModelChanged: () => void; // Callback function to reload net after creating elements
    private previewMesh?: THREE.Mesh; // Preview indicator (wireframe) showing where element will be created

    constructor(
        scene: THREE.Scene, // Scene where preview mesh will be added
        api: PetriApiService, // API service for creating places/transitions/arcs
        onModelChanged: () => void // Callback to trigger net reload after creation
    ) {
        this.scene = scene; // Store scene reference
        this.api = api; // Store API service reference
        this.onModelChanged = onModelChanged; // Store callback reference
    }

    // Set the current modeling mode and handle preview mesh accordingly
    setMode(mode: ModelingMode) {
        this.mode = mode; // Update current mode
        this.selectedElements = []; // Clear any previously selected elements when changing mode
        
        // Remove old preview
        if (this.previewMesh) { // Check if preview mesh exists
            this.scene.remove(this.previewMesh); // Remove mesh from scene
            this.previewMesh.geometry.dispose(); // Free GPU memory for geometry
            (this.previewMesh.material as THREE.Material).dispose(); // Free GPU memory for material
            this.previewMesh = undefined; // Clear reference
        }
        
        // Create preview indicator for create modes
        if (mode === ModelingMode.CREATE_PLACE) { // If user clicked "Create Place"
            const geometry = new THREE.SphereGeometry(0.5, 16, 16); // Create sphere with radius 0.5, 16x16 segments
            const material = new THREE.MeshBasicMaterial({ // Create material with following properties:
                color: 0x00ff00, // Green color to match place color
                transparent: true, // Enable transparency
                opacity: 0.3, // 30% opaque (70% transparent)
                wireframe: true // Show only edges, not faces
            });
            this.previewMesh = new THREE.Mesh(geometry, material); // Combine geometry and material into mesh
            this.scene.add(this.previewMesh); // Add preview to scene so it's visible
        } else if (mode === ModelingMode.CREATE_TRANSITION) { // If user clicked "Create Transition"
            const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5); // Create box with 0.5x0.5x0.5 dimensions
            const material = new THREE.MeshBasicMaterial({ // Create material with following properties:
                color: 0xff0000, // Red color to match transition color
                transparent: true, // Enable transparency
                opacity: 0.3, // 30% opaque (70% transparent)
                wireframe: true // Show only edges, not faces
            });
            this.previewMesh = new THREE.Mesh(geometry, material); // Combine geometry and material into mesh
            this.scene.add(this.previewMesh); // Add preview to scene so it's visible
        }
    }
    
    // Return current modeling mode
    getMode(): ModelingMode {
        return this.mode; 
    }

    // Handle click/trigger in space (VR ray or desktop mouse)
    handleSpaceClick(raycaster: THREE.Raycaster, draggables: THREE.Mesh[]) {
        if (this.mode === ModelingMode.IDLE) return; // If no mode active, do nothing
        if (this.mode === ModelingMode.CREATE_PLACE) { // If in place creation mode
            this.createPlaceAtRay(); // Create place at ray position
        } else if (this.mode === ModelingMode.CREATE_TRANSITION) { // If in transition creation mode
            this.createTransitionAtRay(); // Create transition at ray position
        } else if (this.mode === ModelingMode.CONNECT_ELEMENTS) { // If in connect mode
            this.selectElementForConnection(raycaster, draggables); // Select elements to connect
        }
    }

    // Update preview position based on raycast
    updatePreview(raycaster: THREE.Raycaster) {
        if (!this.previewMesh) return; // If no preview exists, do nothing
        // Place preview 2m along ray direction
        const pos = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(2)); // Calculate position: ray origin + (ray direction * 2 meters)
        this.previewMesh.position.copy(pos); // Move preview mesh to calculated position
    }

    // Create place at current preview position
    private createPlaceAtRay() {
        // Use the position of the preview mesh 
        const pos = this.previewMesh!.position.clone(); 
        // Call backend API to create place with x,y,z coordinates
        this.api.createPlace(pos.x, pos.y, pos.z).subscribe(() => { 
            this.onModelChanged(); // Rebuild net to show newly created place
            this.setMode(ModelingMode.IDLE); // Return to idle mode (removes preview and allows creating another)
        });
    }

    // Create transition at current preview position
    private createTransitionAtRay() {
        // Use the position of the preview mesh 
        const pos = this.previewMesh!.position.clone(); // Get position from preview mesh
        // Call backend API to create transition with x,y,z coordinates
        this.api.createTransition(pos.x, pos.y, pos.z).subscribe(() => { 
            this.onModelChanged(); // Rebuild net to show newly created transition
            this.setMode(ModelingMode.IDLE); // Return to idle mode (removes preview and allows creating another)
        });
    }

    // Select element for arc connection (need 2 elements)
    private selectElementForConnection(raycaster: THREE.Raycaster, draggables: THREE.Mesh[]) {
        const intersects = raycaster.intersectObjects(draggables, false); // Check if ray hits any draggable elements (places/transitions)
        if (intersects.length === 0) return; // If nothing hit, do nothing
        const hitMesh = intersects[0].object as THREE.Mesh; // Get the first (closest) mesh that was hit
        if (this.selectedElements.includes(hitMesh)) return; // If already selected, ignore this click
        // Highlight selected element
        (hitMesh.material as THREE.MeshStandardMaterial).color.set(0xffaa00); // Set color to orange to show it's selected
        this.selectedElements.push(hitMesh); // Add this element to selection array

        // If 2 elements selected, create arc
        if (this.selectedElements.length === 2) { // If we now have 2 elements selected
            this.createArc(this.selectedElements[0], this.selectedElements[1]); // Create arc between them
        }
    }

    // Create arc between two elements
    private createArc(from: THREE.Mesh, to: THREE.Mesh) {
        const fromId = from.userData['id']; // Get ID of first element from mesh userData
        const toId = to.userData['id']; // Get ID of second element from mesh userData

        // Call backend to create arc
        this.api.createArc(fromId, toId).subscribe(() => { // Call backend API to create arc from first to second element
            this.onModelChanged(); // Rebuild net to show newly created arc
            this.setMode(ModelingMode.IDLE); // Return to idle mode (clears selection and allows connecting again)
        });
    }
}

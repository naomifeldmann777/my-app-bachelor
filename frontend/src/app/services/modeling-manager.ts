import * as THREE from 'three';
import { PetriApiService } from '../api/petri-net-api-service';

// Modes for modeling interactions
export enum ModelingMode {
    IDLE = 'IDLE', // Default mode - no modeling action active
    CREATE_PLACE = 'CREATE_PLACE', // User clicked "Create Place" button - waiting for position click
    CREATE_TRANSITION = 'CREATE_TRANSITION', // User clicked "Create Transition" button - waiting for position click
    CONNECT_ELEMENTS = 'CONNECT_ELEMENTS', // User clicked "Connect Elements" button - waiting for 2 element selections
    DELETE = 'DELETE', // User clicked "Delete Element" button - next click removes the hit element (and connected arcs)
    EDIT = 'EDIT' // User clicked "Edit Element" button - next click opens property edit panel for the hit element
}

// Manages interactive modeling of Petri net elements
export class ModelingManager {
    private mode: ModelingMode = ModelingMode.IDLE; // Current modeling mode - starts idle
    private selectedElements: THREE.Mesh[] = []; // For connect mode: stores the 2 elements to connect
    private scene: THREE.Scene; // Reference to Three.js scene for adding/removing preview mesh
    private api: PetriApiService; // API service for backend communication
    private onModelChanged: () => void; // Callback function to reload net after creating elements
    private previewMesh?: THREE.Mesh; // Preview indicator (wireframe) showing where element will be created
    private hoverMesh: THREE.Mesh | null = null; // Mesh currently highlighted by hover (any mode that targets elements)
    private hoverOriginalColor = new THREE.Color(); // Original color saved before the hover highlight was applied
    private onModeChange?: (mode: ModelingMode) => void; // Optional callback fired whenever the mode changes

    constructor(
        scene: THREE.Scene, // Scene where preview mesh will be added
        api: PetriApiService, // API service for creating places/transitions/arcs
        onModelChanged: () => void, // Callback to trigger net reload after creation
        onModeChange?: (mode: ModelingMode) => void // Optional callback to notify when mode changes (used to enable/disable drag manager during modeling)
    ) {
        this.scene = scene; // Store scene reference
        this.api = api; // Store API service reference
        this.onModelChanged = onModelChanged; // Store callback reference
        this.onModeChange = onModeChange; // Store mode-change callback reference
    }

    // Set the current modeling mode and handle preview mesh accordingly
    setMode(mode: ModelingMode) {
        this.mode = mode; // Update current mode
        this.selectedElements = []; // Clear any previously selected elements when changing mode
        this.onModeChange?.(mode); // Notify listener to enable/disable drag
        
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
    // draggables: place and transition meshes (used for connect + delete)
    // arcMeshes: arc shaft/head child meshes (used only for edit + delete)
    handleSpaceClick(raycaster: THREE.Raycaster, draggables: THREE.Mesh[], arcMeshes: THREE.Mesh[] = []) {
        if (this.mode === ModelingMode.IDLE) return; // If no mode active, do nothing
        if (this.mode === ModelingMode.CREATE_PLACE) { // If in place creation mode
            this.createPlaceAtRay(); // Create place at ray position
        } else if (this.mode === ModelingMode.CREATE_TRANSITION) { // If in transition creation mode
            this.createTransitionAtRay(); // Create transition at ray position
        } else if (this.mode === ModelingMode.CONNECT_ELEMENTS) { // If in connect mode
            this.selectElementForConnection(raycaster, draggables); // Select elements to connect (arcs excluded intentionally)
        } else if (this.mode === ModelingMode.DELETE) { // If in delete mode
            this.deleteElementAtRay(raycaster, [...draggables, ...arcMeshes]); // Delete the element under the ray (places, transitions, and arcs)
        } else if (this.mode === ModelingMode.EDIT) { // If in edit mode
            this.handleEdit(raycaster, [...draggables, ...arcMeshes]); // Open edit panel for the hit element
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
        this.selectedElements.push(hitMesh); // Add this element to selection array

        // If 2 elements selected, create arc
        if (this.selectedElements.length === 2) { // If we now have 2 elements selected
            this.createArc(this.selectedElements[0], this.selectedElements[1]); // Create arc between them
        }
    }

    // Callback to show the edit panel; set externally by VrSceneService
    onShowEditPanel?: (type: string, id: string, data: any) => void;

    // Raycast in EDIT mode and fire the onShowEditPanel callback with the hit element's data
    private handleEdit(raycaster: THREE.Raycaster, targets: THREE.Mesh[]) {
        const intersects = raycaster.intersectObjects(targets, false); // Check if ray hits any target elements (places, transitions, arcs)
        if (intersects.length === 0) return; // If nothing hit, do nothing
        const hitMesh = intersects[0].object as THREE.Mesh; // Get the first (closest) mesh that was hit
        const { id, type } = hitMesh.userData as { id: string; type: string }; // Read element ID and type from mesh userData (set when creating the meshes) to know which element was hit
        // Collect relevant data depending on element type
        const data = type === 'place' ? hitMesh.userData['placeData'] // placeData contains the full place info needed for editing (label, position, tokens, role)
                   : type === 'transition' ? hitMesh.userData['transitionData'] // transitionData contains the full transition info needed for editing (label, position, capability)
                   : hitMesh.userData['arcData']; // arcData contains the full arc info needed for editing (weight)
        this.onShowEditPanel?.(type, id, data); // Fire callback to show edit panel with element type, id, and data (used to populate the fields in the edit form)
    }

    // Highlight the element under the ray with the given color (called every frame in certain modes to show hover effect)
    updateHover(raycaster: THREE.Raycaster, targets: THREE.Mesh[], highlightColor: THREE.ColorRepresentation) {
        const hit = raycaster.intersectObjects(targets, false)[0]?.object as THREE.Mesh | undefined; // Get the first hit mesh from raycast against target meshes (places, transitions, arcs)
        
        // Restore color of previously highlighted mesh if the ray moved off it
        if (this.hoverMesh && this.hoverMesh !== hit) {
            (this.hoverMesh.material as THREE.MeshStandardMaterial).color.copy(this.hoverOriginalColor);
            this.hoverMesh = null;
        }
        // Apply highlight color to the newly hovered mesh
        if (hit && hit !== this.hoverMesh) {
            this.hoverOriginalColor.copy((hit.material as THREE.MeshStandardMaterial).color); // Save original color
            (hit.material as THREE.MeshStandardMaterial).color.set(highlightColor); // Apply highlight color
            this.hoverMesh = hit; // Store reference to currently highlighted mesh
        }
    }

    // Delete the element hit by the ray (place, transition, or arc)
    // If a place or transition is deleted, the backend automatically removes connected arcs
    private deleteElementAtRay(raycaster: THREE.Raycaster, draggables: THREE.Mesh[]) {
        const intersects = raycaster.intersectObjects(draggables, false); // Check if ray hits any element
        if (intersects.length === 0) return; // Nothing hit, do nothing
        const hitMesh = intersects[0].object as THREE.Mesh; // Get the closest hit mesh
        const id: string = hitMesh.userData['id']; // Read element ID from mesh metadata
        const type: string = hitMesh.userData['type']; // Read element type ('place', 'transition', 'arc')

        if (type === 'place') { // Delete place (backend also removes connected arcs)
            this.api.deletePlace(id).subscribe(() => {
                this.onModelChanged(); // Rebuild scene to reflect deletion
                this.setMode(ModelingMode.IDLE); // Return to idle after deletion
            });
        } else if (type === 'transition') { // Delete transition (backend also removes connected arcs)
            this.api.deleteTransition(id).subscribe(() => {
                this.onModelChanged(); // Rebuild scene to reflect deletion
                this.setMode(ModelingMode.IDLE); // Return to idle after deletion
            });
        } else if (type === 'arc') { // Delete just the arc
            this.api.deleteArc(id).subscribe(() => {
                this.onModelChanged(); // Rebuild scene to reflect deletion
                this.setMode(ModelingMode.IDLE); // Return to idle after deletion
            });
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

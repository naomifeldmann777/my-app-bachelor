import * as THREE from 'three';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';
import { PetriApiService } from '../api/petri-net-api-service';

// Manages drag-and-drop interactions for Petri net elements in both desktop and VR
export class DragManager {
    private raycaster = new THREE.Raycaster(); // Used for VR raycasting
    private camera: THREE.Camera; // Reference to the camera for raycasting
    private api: PetriApiService; // Reference to API service for updating positions on the backend
    private renderer: THREE.WebGLRenderer; // Reference to the renderer for event handling
    
    // Desktop drag controls
    private dragControls?: DragControls;
    
    // VR drag state
    private vrDragging = false; // Whether we are currently dragging in VR
    private draggedObject: THREE.Mesh | null = null; // The object currently being dragged in VR
    private dragPlane = new THREE.Plane(); // Plane used for VR drag movement (to keep the dragged object moving along a consistent surface)
    private dragOffset = new THREE.Vector3(); // Offset for VR dragging (to maintain the relative position between the controller ray intersection point and the object's origin)
    private hoverObject: THREE.Mesh | null = null; // The object currently hovered in VR
    
    // Maps element IDs to their corresponding meshes for easy access during dragging
    private elementMap = new Map<string, THREE.Mesh>();
    // Maps element IDs to arcs connected to them
    private arcMap = new Map<string, THREE.Group[]>();
    // Stores original colors for hover effect
    private originalColors = new Map<THREE.Mesh, THREE.Color>();
    
    // Draggable elements (places and transitions)
    private draggables: THREE.Mesh[] = [];

    constructor(
        // References needed for raycasting, event handling, and API calls
        camera: THREE.Camera,
        renderer: THREE.WebGLRenderer,
        api: PetriApiService
    ) {
        // Store references
        this.camera = camera;
        this.renderer = renderer;
        this.api = api;
        
        // Configure raycaster for VR detection
        this.raycaster.near = 0; // Start raycasting from the controller position
        this.raycaster.far = Infinity; // No maximum distance for raycasting
        this.raycaster.params.Mesh = { threshold: 0.1 }; // Allow some tolerance for hovering over meshes
        this.raycaster.params.Line = { threshold: 0.1 }; // Allow some tolerance for hovering over lines (arcs)
    }

    // Register draggable elements and arcs after petri net is built
    registerElements(
        // Maps of place and transition meshes, and arcs with their metadata
        places: Map<string, THREE.Mesh>,
        transitions: Map<string, THREE.Mesh>,
        arcs: Map<string, {mesh: THREE.Group, fromId: string, toId: string}>
    ) {
        // Dispose old drag controls if they exist
        this.dragControls?.dispose();
        
        this.draggables = []; // Reset draggables array
        this.elementMap.clear(); // Clear element map
        this.arcMap.clear(); // Clear arc map
        this.originalColors.clear(); // Clear original colors map
        
        // Combine places and transitions into a single array for registration
        [...places, ...transitions].forEach(([id, mesh]) => {
            this.draggables.push(mesh); // Add mesh to draggables for interaction
            this.elementMap.set(id, mesh); // Map element ID to its mesh for easy access during dragging
            this.arcMap.set(id, []); // Initialize empty array for connected arcs
            
            const material = mesh.material as THREE.MeshStandardMaterial; // Assume standard material for color manipulation
            material.side = THREE.DoubleSide; // Ensure material is double-sided for better visibility during dragging
            this.originalColors.set(mesh, material.color.clone()); // Store original color for hover effect restoration
        });
        
        // Register arcs
        arcs.forEach(({mesh, fromId, toId}) => {
            // Register this arc under both the "from" and "to" elements so we can update it when either is dragged
            this.arcMap.get(fromId)?.push(mesh); 
            this.arcMap.get(toId)?.push(mesh);
        });
        
        // Setup desktop drag controls so that the registered meshes can be dragged with the mouse
        this.setupDesktopDrag();
    }
    
    // Setup drag controls for desktop interactions using three.js DragControls
    private setupDesktopDrag() {
        // Create new DragControls instance with the registered draggables, camera, and renderer's DOM element for event listening
        this.dragControls = new DragControls(this.draggables, this.camera, this.renderer.domElement);
        
        // Hover on - brighten object
        this.dragControls.addEventListener('hoveron', (event: any) => {
            // Get the mesh being hovered over
            const mesh = event.object as THREE.Mesh;
            // Brighten the mesh color by lerping towards white
            (mesh.material as THREE.MeshStandardMaterial).color.lerp(new THREE.Color(0xffffff), 0.3);
        });
        
        // Hover off - restore original color
        this.dragControls.addEventListener('hoveroff', (event: any) => {
            // Get the mesh that is no longer hovered
            const mesh = event.object as THREE.Mesh;
            // Restore the original color from the map
            const original = this.originalColors.get(mesh);
            // If we have an original color stored, copy it back to the material
            original && (mesh.material as THREE.MeshStandardMaterial).color.copy(original);
        });
        
        // Drag - update connected arcs in real-time
        this.dragControls.addEventListener('drag', (event: any) => {
            // Update the position of any arcs connected to this element as it is being dragged
            this.updateConnectedArcs(event.object as THREE.Mesh);
        });
        
        // Drag end - sync position to backend
        this.dragControls.addEventListener('dragend', (event: any) => {
            // Get the mesh that was dragged
            const mesh = event.object as THREE.Mesh;
            // Get the type, ID and position from userData for API calls
            const type = mesh.userData['type'];
            const id = mesh.userData['id'];
            const { x, y, z } = mesh.position;
            // Call the appropriate API method to update the position of the place or transition on the backend
            // Subscribe to the observable to ensure the API call is made (even if we don't do anything with the response here)
            (type === 'place' ? this.api.updatePlacePosition(id, x, y, z) : 
             this.api.updateTransitionPosition(id, x, y, z)).subscribe();
        });
    }

    // VR hover management
    private applyVRHover(object?: THREE.Mesh) {
        // Reset previous hover state if we are hovering over a new object or no object at all
        if (this.hoverObject && this.hoverObject !== object) {
            // Restore original color of previously hovered object
            const material = this.hoverObject.material as THREE.MeshStandardMaterial;
            this.originalColors.get(this.hoverObject) && material.color.copy(this.originalColors.get(this.hoverObject)!);
            // Set hoverObject to null if we are no longer hovering over any object, or if we switched to a different object
            this.hoverObject = null;
        }
        
        // Apply new hover state if we are hovering over a valid place or transition mesh
        if (object?.userData['type'] === 'place' || object?.userData['type'] === 'transition') {
            // If we are hovering over a new object, apply hover effect
            if (this.hoverObject !== object) {
                this.hoverObject = object;
                // Brighten the hovered object by lerping its color towards white
                (object.material as THREE.MeshStandardMaterial).color.lerp(new THREE.Color(0xffffff), 0.3);
            }
        }
    }

    // Update positions of arcs connected to a dragged element in real-time during dragging
    private updateConnectedArcs(element: THREE.Mesh) {
        // Get the ID of the dragged element to find connected arcs
        const id = element.userData['id'];
        // Get all arcs connected to this element from the arc map
        const arcs = this.arcMap.get(id);
        // If there are no arcs connected, we can skip updating
        if (!arcs) return;
        // For each connected arc, we need to rebuild its geometry based on the new position of the dragged element and the position of the other element it is connected to
        arcs.forEach(arcGroup => {
            // Get metadata about the arc to determine how to update it (which elements it connects and whether it starts from a place or transition)
            const arcData = arcGroup.userData;
            // If we don't have the necessary metadata, we can't update this arc, so we skip it
            if (!arcData) return;
            // Get the meshes of the "from" and "to" elements connected by this arc using the element map
            const fromMesh = this.elementMap.get(arcData['fromId']);
            const toMesh = this.elementMap.get(arcData['toId']);
            // If we can't find the meshes for both ends of the arc, we can't update it, so we skip it
            if (!fromMesh || !toMesh) return;
            // Update arc position and orientation
            this.rebuildArc(arcGroup, fromMesh.position, toMesh.position, arcData['startType']);
        });
    }

    // Rebuilds the geometry of an arc based on new start and end positions, and whether it starts from a place or transition (to calculate offsets)
    private rebuildArc(
        arcGroup: THREE.Group,
        start: THREE.Vector3,
        end: THREE.Vector3,
        startType: 'place' | 'transition'
    ) {
        // Define the radius of a place sphere (used to offset the arrow start away from the sphere)
        const placeRadius = 0.5;
        // Define half the width of a transition box (used to offset the arrow start away from the box)
        const transitionHalfWidth = 0.25;
        // Define an extra spacing gap so the arrow does not touch the start/end objects
        const gap = 0.1;
        
        // Compute the vector pointing from start to end
        const direction = new THREE.Vector3().subVectors(end, start);
        // Compute the distance between start and end
        const distance = direction.length();
        // Normalize the direction vector so it has length 1
        direction.normalize();
        
        // Compute usable arrow length after subtracting object sizes and gaps on both sides
        const length = distance - placeRadius - transitionHalfWidth - gap * 2;
        // Define the arrowhead length in world units
        const headLength = 0.2;
        // Compute the shaft length so that shaft + head = total usable arrow length
        const shaftLength = length - headLength;
        
        // Declare a variable holding how far to offset from the start object 
        // If the arc starts at a place sphere, offset by the sphere radius; if it starts at a transition box, offset by half the box width
        const startOffsetDistance = startType === 'place' ? placeRadius : transitionHalfWidth;
         // Compute the actual arrow origin by moving from start toward end by (surface offset + gap)
        const startOffset = start.clone().add(direction.clone().multiplyScalar(startOffsetDistance + gap));
        
        // Update shaft
        // Find the shaft mesh within the arc group (assuming it is a cylinder geometry) and update its geometry to match the new shaft length
        const shaft = arcGroup.children.find(c => c instanceof THREE.Mesh && (c.geometry as any).type === 'CylinderGeometry');
        if (shaft) {
            // Create a mew cyclinder geometry with the new shaft length
            const newShaftGeometry = new THREE.CylinderGeometry(0.02, 0.02, shaftLength, 32);
            // Dispose the old geometry 
            (shaft as THREE.Mesh).geometry.dispose();
            // Assign the new geometry to the shaft mesh
            (shaft as THREE.Mesh).geometry = newShaftGeometry;
            // Move the shaft forward along local z by half its length so its back end sits at z=0 (the group origin) and its front end reaches z=shaftLength
            shaft.position.z = shaftLength / 2;
        }
        
        // Update head
        // Find the head mesh within the arc group (assuming it is a cone geometry) 
        const head = arcGroup.children.find(c => c instanceof THREE.Mesh && (c.geometry as any).type === 'ConeGeometry');
        if (head) {
            // Move the arrowhead forward along local z so its base starts where the shaft ends and its center sits at shaftLength + half the cone height
            head.position.z = shaftLength + headLength / 2;
        }
        
        // Place the whole arrow group at the computed start offset in world space
        arcGroup.position.copy(startOffset);
        // Rotate the group so its local “forward” direction points toward the end object (Three.js lookAt aligns the group’s local -Z axis toward the target)
        arcGroup.lookAt(end);
    }

    // VR update loop to be called on each frame when in VR mode
    // Raycaster is passed in from VrSceneService (already set once per frame in render loop)
    updateVR(raycaster: THREE.Raycaster) {
        this.raycaster = raycaster; // Store so startVRDrag() can use it too
        
        // If we are currently dragging an object in VR, update its position based on where the ray intersects the drag plane
        if (this.vrDragging && this.draggedObject) {
            // Create a vector to store the intersection point between the ray and the drag plane
            const intersection = new THREE.Vector3();
            // Check if the ray intersects the plane used for dragging
            // The plane represents the surface along which the object should move
            if (this.raycaster.ray.intersectPlane(this.dragPlane, intersection)) {
                // Move the dragged object to the intersection point of the ray and the plane
                // We also add dragOffset so the object does not snap to the controller center but maintains the original relative position where the user grabbed it 
                // This allows for more natural dragging where the object follows the controller movement without jumping
                this.draggedObject.position.copy(intersection).add(this.dragOffset);
                // Update the arcs connected to this object so they follow the object while dragging
                this.updateConnectedArcs(this.draggedObject);
            }
        } else {
            // If we are notdragging an object, we instead perform hover detection
            // Perform raycasting against all draggable objects (places and transitions)
            // intersectObjects returns an array sorted by distance from the ray origin
            // The first element [0] is the closest object the controller is pointing at
            // Safely access the first intersected object (if it exists)
            // Optional chaining (?.) prevents errors if there are no intersections
            this.applyVRHover(this.raycaster.intersectObjects(this.draggables, false)[0]?.object as THREE.Mesh);
        }
    }

    // Start VR dragging when the user presses the trigger while pointing at a draggable object
    startVRDrag() {
        // We can only start dragging if we are currently hovering over an object and not already dragging
        if (!this.hoverObject || this.vrDragging) return;
        // Set the dragging state and store the object being dragged
        this.vrDragging = true;
        this.draggedObject = this.hoverObject;
        
        // Setup drag plane (camera-facing)
        // We want the drag plane to be oriented so that it faces the camera, which allows for intuitive dragging in 3D space as the object will move parallel to the screen
        const cameraDirection = new THREE.Vector3();
        // Get the direction the camera is facing in world space
        this.camera.getWorldDirection(cameraDirection);
        // Set the drag plane to be perpendicular to the camera direction and passing through the current position of the dragged object
        this.dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, this.draggedObject.position);
        
        // Calculate the initial offset between the intersection point of the controller ray and the dragged object's position
        const intersection = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.dragPlane, intersection);
        // Computes the offset from the intersection point to the center of the dragged object
        intersection && this.dragOffset.copy(this.draggedObject.position).sub(intersection);
        
        // Color the dragged object brighter to indicate it is being dragged
        (this.draggedObject.material as THREE.MeshStandardMaterial).color.lerp(new THREE.Color(0xffffff), 0.5);
    }

    endVRDrag() {
        // We can only end dragging if we are currently dragging an object in VR
        if (!this.vrDragging || !this.draggedObject) return;
        
        // Restore the original color of the dragged object now that we are done dragging
        const material = this.draggedObject.material as THREE.MeshStandardMaterial;
        this.originalColors.get(this.draggedObject) && material.color.copy(this.originalColors.get(this.draggedObject)!);
        
        // Get the type, ID and final position of the dragged object to update the backend
        const type = this.draggedObject.userData['type'];
        const id = this.draggedObject.userData['id'];
        const { x, y, z } = this.draggedObject.position;
        
        // Call the appropriate API method to update the position of the place or transition on the backend with the new coordinates after dragging
        (type === 'place' ? this.api.updatePlacePosition(id, x, y, z) : 
         this.api.updateTransitionPosition(id, x, y, z)).subscribe();
        
        // Reset dragging state
        this.vrDragging = false;
        this.draggedObject = null;
    }
}

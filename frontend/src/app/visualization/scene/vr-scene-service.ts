import { Injectable } from '@angular/core';
import * as THREE from 'three'; 
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'; 
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import ThreeMeshUI from 'three-mesh-ui'; // Mesh-based UI/text for Three.js
import { PetriNetBuilder } from '../meshes/petri-net-builder'; 
import { PetriNetModel } from '../../domain/petri-net-model'; 
import { PetriApiService } from '../../api/petri-net-api-service'; 
import { VrControlPanel } from '../ui/vr-control-panel'; 
import { RobotAvatar } from '../robot/robot-avatar';
import { DragManager } from '../../services/drag-manager';
import { ModelingManager, ModelingMode } from '../../services/modeling-manager';

@Injectable({ providedIn: 'root' }) // So that the service is available in the whole app
export class VrSceneService {
  private scene!: THREE.Scene; // Root scene 
  private camera!: THREE.PerspectiveCamera; // Main perspective camera
  private renderer!: THREE.WebGLRenderer; // WebGL renderer outputting to canvas
  private controls!: OrbitControls; // Desktop orbit controls

  private raycaster = new THREE.Raycaster(); // Raycaster for UI hit testing
  private mouse = new THREE.Vector2(Number.NaN, Number.NaN); // Mouse in normalized device coordinates
  private selectState = false; // True while pointer/VR trigger is pressed
  private objsToTest: THREE.Object3D[] = []; // UI objects to raycast against
  private wasSelecting = false; // True if trigger was pressed in the previous frame -> to detect a new press (edge-trigger)

  private netGroup?: THREE.Group; // Group holding current Petri net meshes
  private panelGroup?: THREE.Object3D; // Root of the control panel UI
  private robotAvatar?: RobotAvatar; // Robot avatar instance for robot visualization
  private dragManager?: DragManager; // Drag manager for interactive element dragging
  private modelingManager?: ModelingManager; // Modeling manager for creating/connecting elements
  private draggables: THREE.Mesh[] = []; // Current draggable elements (places + transitions)
  private arcMeshes: THREE.Mesh[] = []; // Raycasting targets for arc shaft+head meshes (used in DELETE and EDIT mode)
  private editables: THREE.Mesh[] = []; // Combined list of all editable meshes (places + transitions + arc parts)

  constructor(private petriNetApi: PetriApiService) {} // Inject API client

  init(containerId: string): void { // Initialize scene, renderer, events, and UI
    const container = document.getElementById(containerId); // Host element for canvas

    this.scene = new THREE.Scene(); // Create scene
    this.scene.background = new THREE.Color(0x445c6e); // Set background color

    this.camera = new THREE.PerspectiveCamera( // Create perspective camera
      70, // Field of view in degrees
      window.innerWidth / window.innerHeight, // Aspect ratio
      0.1, // Near clip
      100 // Far clip
    );
    this.camera.position.set(0, 1.6, 0); // Place at typical eye height (local to rig)
    
    // Create camera rig (parent group) to position the VR user in the scene
    // The VR headset controls the camera position relative to this rig
    const cameraRig = new THREE.Group(); 
    cameraRig.position.set(0, 0, 5); // Position the rig 5 units away from origin
    cameraRig.add(this.camera); // Camera is child of rig
    this.scene.add(cameraRig); // Add rig to scene

    this.renderer = new THREE.WebGLRenderer({ antialias: true }); // Create WebGL renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight); // Match window size
    this.renderer.xr.enabled = true; // Enable WebXR for VR
    
    // Configure raycaster for better hit detection
    this.raycaster.near = 0; // Start raycasting from the controller position
    this.raycaster.far = Infinity; // No maximum distance for raycasting
    this.raycaster.params.Mesh = { threshold: 0.1 }; // Allow some tolerance for hovering over meshes
    this.raycaster.params.Line = { threshold: 0.1 }; // Allow some tolerance for hovering over lines (arcs)

    container?.appendChild(this.renderer.domElement); // Add canvas to DOM
    document.body.appendChild(VRButton.createButton(this.renderer)); // Add VR entry button

    this.controls = new OrbitControls(this.camera, this.renderer.domElement); // Init orbit controls
    this.controls.target.set(0, 0, 0); // Look at origin
    this.controls.update(); 

    const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.8); // Ambient light for basic illumination
    hemi.position.set(0, 1, 0); // Position hemisphere light
    this.scene.add(hemi); // Add to scene
    const dir = new THREE.DirectionalLight(0xffffff, 1.5); // Directional light for stronger shadows and highlights
    dir.position.set(2, 3, 2); // Position directional light
    this.scene.add(dir); // Add to scene

    // Initialize drag manager service for interactive element dragging
    this.dragManager = new DragManager(this.camera, this.renderer, this.petriNetApi);

    // Initialize modeling manager for creating elements
    this.modelingManager = new ModelingManager(
      this.scene,
      this.petriNetApi,
      () => this.loadCurrentState(), // Reload net after changes
      (mode) => this.dragManager?.setEnabled(mode === ModelingMode.IDLE) // Disable drag in non-IDLE modes to avoid hover color conflicts
    );

    // Load initial petri net state 
    this.loadCurrentState(); // Fetch backend state and build meshes

    // Build initial control panel
    this.refreshControlPanel(); // Build control panel with fireable transitions

    // Create robot avatar instance 
    this.robotAvatar = new RobotAvatar(this.scene);
    // Load robot with initial pose with end-effector pointing down
    this.robotAvatar.load().then(() => {this.robotAvatar!.setJoints([0,0,-1.57,0,1.57,0])});

    // Desktop-Events for UI panel (drag manager handles its own events)
    window.addEventListener('pointermove', (event) => { // Update NDC mouse coords
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1; // Map X to [-1,1]
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1; // Map Y to [-1,1], invert Y
      
      // Update modeling preview in desktop mode
      // Only update if we're in a modeling mode (not idle) and mouse coords are valid (ignore if pointer is outside window)
      if (this.modelingManager?.getMode() !== ModelingMode.IDLE && !Number.isNaN(this.mouse.x)) {
        // Set raycaster from camera through mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);
        // Update modeling preview based on raycaster 
        this.modelingManager?.updatePreview(this.raycaster);
        // Update hover highlight for modes that target existing elements
        if (this.modelingManager?.getMode() === ModelingMode.DELETE) {
          this.modelingManager?.updateHover(this.raycaster, this.editables, 0xff3333); // Red tint signals deletion
        }
      }
    });
    window.addEventListener('pointerdown', () => (this.selectState = true)); // Press/hold
    window.addEventListener('pointerup', () => {
      // Check if we're hitting a UI button
      // Only if mouse coords are valid (ignore if pointer is outside window)
      if (!Number.isNaN(this.mouse.x)) {
        // Set raycaster from camera through mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);
        // Check if we're hitting a UI button
        const buttonHit = this.raycast(this.objsToTest);
        const isHittingButton = buttonHit && (buttonHit.object as any).isUI;
        // Only handle space clicks if not hitting a button to avoid conflicts between UI interaction and modeling interactions
        if (!isHittingButton && this.modelingManager?.getMode() !== ModelingMode.IDLE) {
          // Handle space click in modeling manager (create element or select for connection)
          this.modelingManager?.handleSpaceClick(this.raycaster, this.draggables, this.arcMeshes);
        }
      }
      // Reset select state
      this.selectState = false;
    });

    // XR-Controller
    const controller = this.renderer.xr.getController(0); // First VR controller
    this.scene.add(controller); // Add to scene for matrix updates
    // Event listener for trigger press
    controller.addEventListener('selectstart', () => {
      this.selectState = true; // Trigger pressed
      
      // Check if we're hitting a UI button with the VR controller ray
      const buttonHit = this.raycast(this.objsToTest);
      // Determine if the hit object is a UI button
      const isHittingButton = buttonHit && (buttonHit.object as any).isUI;
      // Only handle space clicks if not hitting a button
      if (!isHittingButton) {
        // Check if in modeling mode - handle space clicks
        if (this.modelingManager?.getMode() !== ModelingMode.IDLE) {
          // handle space click in modeling manager (create element or select for connection)
          this.modelingManager?.handleSpaceClick(this.raycaster, this.draggables, this.arcMeshes);
        } else {
          // If not in modeling mode, start VR drag (if pointing at a draggable element) - the drag manager will check internally whether the hit element is draggable and handle accordingly
          this.dragManager?.startVRDrag();
        }
      }
    });
    // Event listener for trigger release
    controller.addEventListener('selectend', () => {
      this.selectState = false; // Trigger released
      this.dragManager?.endVRDrag(); // End VR drag
    });

    // Create a THREE.Clock instance to measure the time between frames --> to calculate 'delta' (time elapsed since the last frame) --> ensures smooth animation
    const clock = new THREE.Clock();
    // Set up the main render loop using setAnimationLoop ( called automatically by Three.js at the correct frame rate)
    this.renderer.setAnimationLoop(() => { 
      const delta = clock.getDelta(); // Get the time (in seconds) since the last frame
      ThreeMeshUI.update(); // Update the 3D UI layout and state
      this.controls.update(); // Update orbit controls
      this.robotAvatar?.update(delta); // Advance robot animation by 'delta' seconds (smooth, time-based)
      
      // Set VR raycaster once per frame (used by updateButtons, modeling preview, and drag manager)
      if (this.renderer.xr.isPresenting) {
        // Reset a matrix to the identity matrix (no rotation, no translation) and then extract only the rotation part from the controller's world transformation matrix
        const tempMatrix = new THREE.Matrix4().identity().extractRotation(controller.matrixWorld);
        // Set the ray origin (starting point) to the world position of the controller
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        // Set the ray direction to point forward from the controller (negative z in local space) and apply the controller's rotation to it so it points in the direction the controller is facing
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
      }
      
      this.updateButtons(); // Update UI button states (e.g., hover, disabled)
      
      // Update modeling preview in VR mode
      // Only update if we're in a modeling mode (not idle) and in VR (ignore mouse movement in VR)
      if (this.renderer.xr.isPresenting && this.modelingManager?.getMode() !== ModelingMode.IDLE) {
        this.modelingManager?.updatePreview(this.raycaster);
        // Update hover highlight for modes that target existing elements
        if (this.modelingManager?.getMode() === ModelingMode.DELETE) {
          this.modelingManager?.updateHover(this.raycaster, this.editables, 0xff3333); // Red tint signals deletion
        }
      }
      
      // Update VR drag interactions
      // Only update if in VR mode to avoid conflicts with desktop pointer events
      if (this.renderer.xr.isPresenting) {
        this.dragManager?.updateVR(this.raycaster); // Raycaster already set above for this frame
      }
      
      this.renderer.render(this.scene, this.camera); // Render the scene from the camera's perspective
    });

    // Resize
    window.addEventListener('resize', () => { // Keep camera/renderer in sync
      const width = window.innerWidth; // New width
      const height = window.innerHeight; // New height
      this.camera.aspect = width / height; // Update aspect
      this.camera.updateProjectionMatrix(); // Recompute projection
      this.renderer.setSize(width, height); // Resize renderer
    });
  }

  // Fetch current net from backend and build scene
  private loadCurrentState(): void { 
    this.petriNetApi.getState().subscribe((petriNet: PetriNetModel) => { // Subscribe to HTTP result
      this.rebuildNet(petriNet); // Build net meshes from state
    });
  }

  // Replace current net with given state
  private rebuildNet(petriNet: PetriNetModel): void { 
    // Remove old net if exists
    if (this.netGroup) { // Remove previous net group if exists
      this.scene.remove(this.netGroup); // Detach from scene
      this.disposeGroup(this.netGroup); // Dispose geometries/materials
      this.netGroup = undefined; // Clear reference
    }
    // Create new group and build net inside
    this.netGroup = new THREE.Group(); // Create fresh group
    this.scene.add(this.netGroup); // Attach to scene
    const { places, transitions, arcs, arcMeshes } = PetriNetBuilder.buildNet(this.netGroup, petriNet); // Build places/transitions/arcs inside group and get arc child meshes for interaction
    
    // Collect draggables for modeling manager, store references to place and transition meshes
    this.draggables = [...places.values(), ...transitions.values()];
    // Store arc child meshes separately for DELETE/EDIT mode raycasting
    this.arcMeshes = arcMeshes;
    // Combined target list for delete hover and delete click (places + transitions + arc parts)
    this.editables = [...this.draggables, ...arcMeshes];
    
    // Register interactive elements with the drag manager so it can handle dragging them in VR
    this.dragManager?.registerElements(places, transitions, arcs);
  }

  // Free GPU resources in a group
  private disposeGroup(group: THREE.Group): void { 
    group.traverse((obj) => { // Traverse all descendants
      const mesh = obj as THREE.Mesh & { geometry?: THREE.BufferGeometry; material?: any }; // Treat as mesh
      if ((mesh as any).geometry) { // If geometry exists
        (mesh as any).geometry.dispose?.(); // Dispose geometry
      }
      if ((mesh as any).material) { // If material exists
        const mat = (mesh as any).material; // Material may be array
        if (Array.isArray(mat)) { // Dispose array entries
          mat.forEach((m) => {
            if (m.map) m.map.dispose?.(); // Dispose texture map if present
            m.dispose?.(); // Dispose material
          });
        } else {
          if (mat.map) mat.map.dispose?.(); // Dispose single material map
          mat.dispose?.(); // Dispose single material
        }
      }
    });
  }

  // Build VR control panel and attach to camera
  private refreshControlPanel(): void { 
    // Remove previous panel if present
    if (this.panelGroup) { 
      this.panelGroup.parent?.remove(this.panelGroup); // Detach from camera
      this.panelGroup = undefined; // Clear reference
    }
    this.objsToTest = []; // Reset clickable buttons list

    this.petriNetApi.getFireableTransitions().subscribe((transitions) => { // Fetch fireable transitions
      const items = transitions.map((t: any) => ({ // Map to id/label used by UI
        id: t.id,
        label: t.label ?? t.id
      }));

      const { group, buttons } = VrControlPanel.createControlPanel( // Create panel + buttons
        items,
        (id: string) => this.fireTransition(id), // Fire callback
        () => this.resetSimulation(), // Reset callback
        () => this.modelingManager?.setMode(ModelingMode.CREATE_PLACE), // Create place callback
        () => this.modelingManager?.setMode(ModelingMode.CREATE_TRANSITION), // Create transition callback
        () => this.modelingManager?.setMode(ModelingMode.CONNECT_ELEMENTS), // Connect elements callback
        () => this.modelingManager?.setMode(ModelingMode.DELETE) // Delete element callback
      );

      // Attach panel to camera (HUD)
      this.scene.add(group); 
      this.panelGroup = group; // Keep reference
      group.position.set(0, 0, -1.5); // Position in view space
      (group as any).rotation.x = -0.15; // Slight tilt for readability
      group.scale.set(2.5, 2.5, 1); // Scale down
      // Register clickable buttons for raycasting
      this.objsToTest.push(...buttons); 
    });
  }

  // Update UI button states based on raycasting
  private updateButtons(): void { 
    // If robot is animating, show buttons as disabled and do not accept input
    if (this.robotAvatar?.isAnimating()) {
      this.objsToTest.forEach((obj: any) => {obj.setState('disabled'); });
      // Track select state to prevent detection of new presses while disabled
      this.wasSelecting = this.selectState;
      return;
    }
    let intersect: THREE.Intersection | null = null; // Closest hit

    if (this.renderer.xr.isPresenting) { // If in VR mode, use controller for raycasting
      const controller = this.renderer.xr.getController(0); // Get the first VR controller
      this.scene.add(controller); // Add controller to scene 

      // Create a visible line to show the ray direction from the controller
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), // Line starts at the controller's origin
        new THREE.Vector3(0, 0, -1) // Line points forward from the controller
      ]);
      const material = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red line material
      const line = new THREE.Line(geometry, material); // Creates the line mesh
      line.name = 'ray'; // Names the line for reference/removal
      line.scale.z = 5; // Makes the line 5 units long (longer for better reach)
      controller.add(line); // Attach the line to the controller so it moves with it

      // Raycaster is already set in render loop - just perform intersection test
      intersect = this.raycast(this.objsToTest);

    } else if (!Number.isNaN(this.mouse.x) && !Number.isNaN(this.mouse.y)) { // Desktop mode: cast from camera
      this.raycaster.setFromCamera(this.mouse, this.camera); // Build ray from mouse NDC
      intersect = this.raycast(this.objsToTest); // Find closest hit
    }

    if (intersect && (intersect.object as any).isUI) { // If a UI element was hit
      const ui = intersect.object as any; // ThreeMeshUI component
      const isSelecting = this.selectState; // Current pressed state
      if (isSelecting && !this.wasSelecting) { // Edge-trigger: pressed this frame
        ui.setState('selected'); // Trigger selected state (fires callbacks)
      } else if (!isSelecting) { // Not pressed: hover feedback
        ui.setState('hovered'); // Hover state
      }
      this.wasSelecting = isSelecting; // Track pressed state for next frame
    } else {
      // No UI hit: reset previous selection if any
      this.wasSelecting = this.selectState; // Update tracking even if no hit
    }

    this.objsToTest.forEach((obj: any) => { // Reset others to idle
      if ((!intersect || obj !== intersect.object) && obj.isUI) obj.setState('idle');
    });
  }

  // Helper method to raycast against a list of objects and find the closest intersection
  private raycast(list: THREE.Object3D[]): THREE.Intersection | null { // Find nearest intersection
    return list.reduce<THREE.Intersection | null>((closest, obj) => { // Accumulate closest hit
      const hits = this.raycaster.intersectObject(obj, true); // Test object and children
      if (!hits[0]) return closest; // No hit on this object
      const hit = hits[0]; // Nearest hit for this object
      if (!closest || hit.distance < closest.distance) { // Closer than previous
        hit.object = obj; // Normalize to top-level object
        return hit; // New closest
      }
      return closest; // Keep previous closest
    }, null);
  }

  // Fires a transition by ID, then updates the net and control panel based on the backend response
  // Also triggers robot animations based on transition capabilities
  private fireTransition(id: string): void { 
    this.petriNetApi.fireTransition(id).subscribe((resp: { fired: boolean; state: PetriNetModel }) => { 
      this.rebuildNet(resp.state); // Use returned state
      this.refreshControlPanel(); // Refresh fireable transitions UI

      // For the Robot synchronization -> we trigger the corresponding robot animation based on the capability of the fired transition
      const transition = resp.state.transitions?.find(t => t.id === id);
      // If transition has capability 'move', move robot to the output place position
        if (transition?.capability === 'move' && this.robotAvatar) {
          // Find first arc that goes from this transition to a place
          const outArc = resp.state.arcs?.find(a => a.from === id);
          if (outArc) {
            // Find the output place of the transition
            const place = resp.state.places?.find(p => p.id === outArc.to);
            if (place && place.position) {
              // Get the XYZ coordinates of the output place
              const target = new THREE.Vector3(place.position.x, place.position.y, place.position.z);
              // Call animateToXYZ asynchronously; don't block the UI
              this.robotAvatar.animateToXYZ(target, {lockIndices: [3,4,5]}) // Lock wrist joints for natural movement;
            }
          }
        }
      // If transition has capability 'pick', trigger the robot's pick animation (for simplicity, we just color the end-effector in yellow for a moment)
      if (transition?.capability === 'pick' && this.robotAvatar) {
        this.robotAvatar?.flashEndEffectorColor(new THREE.Color(0xffea00));
      }
      // If transition has capability 'place', trigger the robot's place animation (for simplicity, we just color the end-effector in orange for a moment)
      if (transition?.capability === 'place' && this.robotAvatar) {
        this.robotAvatar?.flashEndEffectorColor(new THREE.Color(0xff6a00));
      }
    });
  }

  // Reset to original state via backend
  private resetSimulation(): void { 
    this.petriNetApi.reset().subscribe((petriNet: PetriNetModel) => { 
      this.rebuildNet(petriNet); // Rebuild net from reset state
      this.refreshControlPanel(); // Refresh panel accordingly
      // Move robot back to initial pose after reset (if loaded)
      this.robotAvatar?.setJoints([0, 0, -1.57, 0, 1.57, 0]);
    });
  }
}
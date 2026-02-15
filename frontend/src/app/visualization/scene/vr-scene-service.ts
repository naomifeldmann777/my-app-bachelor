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
    this.camera.position.set(0, 1.6, 3); // Place at typical eye height
    this.scene.add(this.camera); // Attach camera to scene

    this.renderer = new THREE.WebGLRenderer({ antialias: true }); // Create WebGL renderer
    this.renderer.setSize(window.innerWidth, window.innerHeight); // Match window size
    this.renderer.xr.enabled = true; // Enable WebXR for VR

    container?.appendChild(this.renderer.domElement); // Add canvas to DOM
    document.body.appendChild(VRButton.createButton(this.renderer)); // Add VR entry button

    this.controls = new OrbitControls(this.camera, this.renderer.domElement); // Init orbit controls
    this.controls.target.set(0, 0, 0); // Look at origin
    this.controls.update(); 

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8); // Ambient sky/ground light
    hemi.position.set(0, 1, 0); // Position hemisphere light
    this.scene.add(hemi); // Add to scene
    const dir = new THREE.DirectionalLight(0xffffff, 0.6); // Directional light for shading
    dir.position.set(2, 3, 2); // Position directional light
    this.scene.add(dir); // Add to scene

    // Load initial petri net state 
    this.loadCurrentState(); // Fetch backend state and build meshes

    // Build initial control panel
    this.refreshControlPanel(); // Build control panel with fireable transitions

    // Create robot avatar instance 
    this.robotAvatar = new RobotAvatar(this.scene);
    // Load robot with initial pose with end-effector pointing down
    this.robotAvatar.load().then(() => {this.robotAvatar!.setJoints([0,0,-1.57,0,1.57,0])});

    // Desktop-Events
    window.addEventListener('pointermove', (event) => { // Update NDC mouse coords
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1; // Map X to [-1,1]
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1; // Map Y to [-1,1], invert Y
    });
    window.addEventListener('pointerdown', () => (this.selectState = true)); // Press/hold
    window.addEventListener('pointerup', () => (this.selectState = false)); // Release

    // XR-Controller
    const controller = this.renderer.xr.getController(0); // First VR controller
    this.scene.add(controller); // Add to scene for matrix updates
    controller.addEventListener('selectstart', () => (this.selectState = true)); // Trigger pressed
    controller.addEventListener('selectend', () => (this.selectState = false)); // Trigger released

    // Render-Loop
    this.renderer.setAnimationLoop(() => { // VR-aware animation loop
      ThreeMeshUI.update(); // Update UI layout/state
      this.controls.update(); // Update orbit controls
      this.updateButtons(); // Handle hover/selected UI states
      this.renderer.render(this.scene, this.camera); // Draw frame
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
    PetriNetBuilder.buildNet(this.netGroup, petriNet); // Build places/transitions/arcs inside group
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
        () => this.resetSimulation() // Reset callback
      );

      // Attach panel to camera (HUD)
      this.camera.add(group); 
      this.panelGroup = group; // Keep reference
      group.position.set(0.95, -0.45, -1.4); // Position in view space
      (group as any).rotation.x = -0.15; // Slight tilt for readability
      group.scale.set(0.5, 0.5, 1); // Scale down
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

    if (this.renderer.xr.isPresenting) { // VR mode: cast from controller forward
      const controller = this.renderer.xr.getController(0);
      if (controller) {
        const tempMatrix = new THREE.Matrix4().identity().extractRotation(controller.matrixWorld); // Orientation only
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld); // Ray origin = controller
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix); // Forward direction
        intersect = this.raycast(this.objsToTest); // Find closest hit
      }
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

  // Fire transition via backend and rebuild scene
  private fireTransition(id: string): void { 
    this.petriNetApi.fireTransition(id).subscribe((resp: { fired: boolean; state: PetriNetModel }) => { 
      this.rebuildNet(resp.state); // Use returned state
      this.refreshControlPanel(); // Refresh fireable transitions UI

      // If transition has capability 'move', move robot to the output place position
      const transition = resp.state.transitions?.find(t => t.id === id);
        if (transition?.capability === 'move' && this.robotAvatar) {
          // find first arc that goes from this transition to a place
          const outArc = resp.state.arcs?.find(a => a.from === id);
          if (outArc) {
            const place = resp.state.places?.find(p => p.id === outArc.to);
            if (place && place.position) {
              const target = new THREE.Vector3(place.position.x, place.position.y, place.position.z);
              // call animateToXYZ asynchronously; don't block the UI
              this.robotAvatar.animateToXYZ(target, {lockIndices: [3,4,5]}) //Lock wrist joints for natural movement;
            }
          }
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
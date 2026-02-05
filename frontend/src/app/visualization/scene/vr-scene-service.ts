import { Injectable } from '@angular/core';
import * as THREE from 'three'; 
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'; 
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import ThreeMeshUI from 'three-mesh-ui'; // Mesh-based UI/text for Three.js
import { PetriNetBuilder } from '../meshes/petri-net-builder'; 
import { PetriNetModel } from '../../domain/petri-net-model'; 
import { PetriApiService } from '../../api/petri-net-api-service'; 
import { VrControlPanel } from '../ui/vr-control-panel'; 

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
    });
  }

  // Reset to original state via backend
  private resetSimulation(): void { 
    this.petriNetApi.reset().subscribe((petriNet: PetriNetModel) => { 
      this.rebuildNet(petriNet); // Rebuild net from reset state
      this.refreshControlPanel(); // Refresh panel accordingly
    });
  }
}


















/*

import { Component, signal, AfterViewInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import * as THREE from 'three'; 
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'; 
import URDFLoader from 'urdf-loader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Injectable } from '@angular/core';

@Injectable({providedIn: 'root'})
export class VrSceneService {



  createArrow(
  start: THREE.Vector3,
  end: THREE.Vector3
): THREE.Group {

  const group = new THREE.Group();

  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();

  const material = new THREE.MeshStandardMaterial({ color: 0x000000 });

  // Shaft
  const shaftLength = length - 0.1;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, shaftLength, 8),
    material
  );

  // Head
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.1, 16),
    material
  );

  // Position both at start
  shaft.position.copy(start);
  head.position.copy(start);

  // Rotate to face end
  shaft.lookAt(end);
  head.lookAt(end);

  // Fix orientation (because cylinders point up)
  shaft.rotateX(Math.PI / 2);
  head.rotateX(Math.PI / 2);

  // Move them forward along the arrow direction
  shaft.translateY(shaftLength / 2);
  head.translateY(length - 0.05);

  group.add(shaft);
  group.add(head);

  return group
}

createLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  canvas.width = 256;
  canvas.height = 128;

  // text
  ctx.fillStyle = 'black';
  ctx.font = '64px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);

  sprite.scale.set(0.6, 0.3, 1); // size in world units

  return sprite;
}




  init(containerId: string): void {
    
    const container = document.getElementById(containerId)!; 

    const scene = new THREE.Scene(); 
    scene.background = new THREE.Color(0x445C6E) //0x4A5A66 //0x4A5057

    const camera = new THREE.PerspectiveCamera(
      70, 
      container.clientWidth / container.clientHeight, 
      0.1, 
      100
    ); 
    camera.position.set(0,1.6,3); 

    const renderer = new THREE.WebGLRenderer({antialias: true}); 
    renderer.setSize(container.clientWidth, container.clientHeight); 
    renderer.xr.enabled = true; 
    container.appendChild(renderer.domElement); 

    document.body.appendChild(VRButton.createButton(renderer));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();



    const light = new THREE.HemisphereLight(0Xffffff, 0x444444); 
    light.position.set(0,1,0); 
    scene.add(light); 
    const dir = new THREE.DirectionalLight(0xffffff, 1); 
    dir.position.set(2,3,2); 
    scene.add(dir); 


    // ----
 const floorSize = 5;

const floor = new THREE.Mesh(
  new THREE.BoxGeometry(floorSize, floorSize, 0.3),
  new THREE.MeshStandardMaterial({
    color: 0x4B3621, // 0x6A4A4A
    roughness: 0.85,
    metalness: 0.0
  })
);


floor.rotation.x = -Math.PI / 2;
//floor.position.y = 0;
floor.position.x = 2;
scene.add(floor);

const g = new THREE.BoxGeometry(0.4, 0.3, 5); 
const m = new THREE.MeshStandardMaterial({color: 0x4B3621, roughness: 0.85, metalness: 0.0}); 
const b1 = new THREE.Mesh(g, m); 
const b2 = new THREE.Mesh(g, m); 
const b3 = new THREE.Mesh(g, m); 
const b4 = new THREE.Mesh(g, m); 
b1.position.set(-2.5,2.5,-2.5);
b2.position.set(2.5,2.5,-2.5);
b3.position.set(-2.5,-2.5,-2.5);
b4.position.set(2.5,-2.5,-2.5);
floor.add(b1); 
floor.add(b2); 
floor.add(b3); 
floor.add(b4); 


const wallHeight = 3;
const wallDistance = 8;
const wallWidth = 16;

const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x4A5057,
  roughness: 0.9,
  metalness: 0.0
});

// Rückwand
const backWall = new THREE.Mesh(
  new THREE.PlaneGeometry(wallWidth, wallHeight),
  wallMaterial
);
backWall.position.set(0, wallHeight / 2, -wallDistance);
scene.add(backWall);

// Linke Wand
const leftWall = new THREE.Mesh(
  new THREE.PlaneGeometry(wallWidth, wallHeight),
  wallMaterial
);
leftWall.rotation.y = Math.PI / 2;
leftWall.position.set(-wallDistance, wallHeight / 2, 0);
scene.add(leftWall);

// Rechte Wand
const rightWall = new THREE.Mesh(
  new THREE.PlaneGeometry(wallWidth, wallHeight),
  wallMaterial
);
rightWall.rotation.y = -Math.PI / 2;
rightWall.position.set(wallDistance, wallHeight / 2, 0);
scene.add(rightWall);











    // --------
    const geometry1 = new THREE.BoxGeometry(0.5, 1, 0.2); 
    const material1 = new THREE.MeshBasicMaterial({ color: 0xff0000}); //0xff2a1c   0x5e2028   0xff5348
    const cube = new THREE.Mesh(geometry1, material1); 
    cube.position.set(0, 1.6, -1.5); 
    scene.add(cube)
    const geometry2 = new THREE.SphereGeometry(0.5, 32, 16)
    const material2 = new THREE.MeshBasicMaterial({color: 0x00fe00 }); //0x7fff00   0x006344   0x87e57e
    const sphere = new THREE.Mesh(geometry2, material2); 
    sphere.position.set(1.5, 1.6, -1.5); 
    scene.add(sphere)

    const label = this.createLabel('Place 1');
    label.position.set(0, -0.7, 0); // below object
    sphere.add(label);



    // attach token to the place
    const label2 = this.createLabel('2'); 
    label2.position.set(0, 0.2, 0); 
    const label3 = this.createLabel('⬤')
    label3.position.set(0,0,0);
    sphere.add(label2); 
    sphere.add(label3); 





    const start = new THREE.Vector3(0.25, 1.6, -1.5); // cube position
    const end = new THREE.Vector3(1, 1.6, -1.5);   // sphere position

    const arrow = this.createArrow(start, end);
    scene.add(arrow);


    const urdfLoader = new URDFLoader();
   
    urdfLoader.loadMeshCb = (path, manager, onComplete) => {
      const stlLoader = new STLLoader(manager); 
      stlLoader.load(
        path, 
        (geometry) => {
          geometry.computeVertexNormals(); 
          const material = new THREE.MeshStandardMaterial({color: 0xcccccc, metalness: 0.1, roughness: 0.7});  //0xcccccc 0xcc9aa2
          const mesh = new THREE.Mesh(geometry, material); 
          
          const group = new THREE.Group(); 
          group.add(mesh); 
          onComplete(group); 
        },
        undefined, 
        (err) => {
          console.error("Failed to load STL:", path, err); 
          onComplete(new THREE.Group()); 
        }
      ); 
    };

    let robot: any = null; 
    const jointMeshes = new Map<string, THREE.Mesh[]>();

    urdfLoader.load("robot/me6_robot.urdf", (r) => {
      robot = r
      robot.position.set(2.5, 0, 0); 
      robot.rotation.x = -Math.PI / 2;
      robot.scale.set(8, 8, 8);

      scene.add(robot);

      console.log("URDF robot loaded:", robot); 
    })

/*

    function setLinkColor(link: any, color: number) {
  link.traverse((child: any) => {
    if (child.isMesh) {
      child.material = child.material.clone();
      child.material.color.setHex(color);
    }
  });
}


    const jointNames = [
      'joint1',
      'joint2',
      'joint3',
      'joint4',
      'joint5',
      'joint6'
    ];

    let activeJointIndex = 0;
    let phaseTime = 0;
    const phaseDuration = 2.0; // Sekunden pro Joint

    renderer.setAnimationLoop(() => {
  controls.update();

  if (!robot) {
    renderer.render(scene, camera);
    return;
  }

  const delta = 0.016;
  phaseTime += delta;

  // 1️⃣ Aktuellen Joint bestimmen
  const jointName = jointNames[activeJointIndex];
  const joint = robot.joints[jointName];

  // 2️⃣ Joint bewegen
  const value = Math.sin((phaseTime / phaseDuration) * Math.PI * 2);
  joint.setJointValue(value);

  // 3️⃣ ALLE Links grau setzen
  Object.values(robot.links).forEach((link: any) => {
    setLinkColor(link, 0xcccccc);
  });

  // 4️⃣ Aktiven Link rot färben
  const activeLinkName = `Link${activeJointIndex + 1}`;
  const activeLink = robot.links[activeLinkName];

  if (activeLink) {
    setLinkColor(activeLink, 0xff0000);
  }

  // 5️⃣ Nächster Joint
  if (phaseTime >= phaseDuration) {
    phaseTime = 0;
    activeJointIndex = (activeJointIndex + 1) % jointNames.length;
  }

  renderer.render(scene, camera);
});




*/
    /*
    let t = 0; 
    renderer.setAnimationLoop(() => {
      controls.update();
      t += 0.01;
      if (robot) {
        robot.joints.joint1.setJointValue(Math.sin(t));
        robot.joints.joint2.setJointValue(Math.sin(t));
        robot.joints.joint3.setJointValue(Math.sin(t));
      }
      renderer.render(scene, camera); 
    }); 

    
  }
}
*/
// Allows this class to be injected
import { Injectable } from '@angular/core';
// Imports the Three.js library for 3D rendering
import * as THREE from 'three'; 
// Imports the VR button to enter/exit WebXR mode
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PetriNetBuilder } from '../meshes/petri-net-builder';
import { PetriNetModel } from '../../domain/petri-net-model';
import { PetriApiService } from '../../api/petri-net-api-service';
import { VrControlPanel } from '../ui/vr-control-panel';
// Makes this service a singleton available throughout the app
@Injectable({providedIn: 'root'})
export class VrSceneService {


  //

private raycaster = new THREE.Raycaster();
private tempMatrix = new THREE.Matrix4();
private controlPanel?: VrControlPanel;
private netGroup?: THREE.Group;
private onPointerDown = (event: PointerEvent) => {
  // Desktop-Klick: mit Maus auf Panel raycasten
  if (!this.camera || !this.renderer || !this.controlPanel) return;

  const rect = this.renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  const ndc = new THREE.Vector2(x, y);

  this.raycaster.setFromCamera(ndc, this.camera);

  const intersects = this.raycaster.intersectObjects(
    this.controlPanel.group.children,
    true
  );

  if (intersects.length === 0) return;

  let obj: any = intersects[0].object;
  while (obj && !obj.userData?.onClick) obj = obj.parent;
  obj?.userData?.onClick?.();
};




  //

    // Holds the Three.js scene
    private scene!: THREE.Scene;
    // Holds the camera that defines the viewer’s perspective
    private camera!: THREE.PerspectiveCamera;
    // Handles rendering the scene to a WebGL canvas
    private renderer!: THREE.WebGLRenderer;

    constructor(private petriNetApi: PetriApiService) {}

    init(containerId: string) {

        // Finds the DOM element where the renderer will be attached
        const container = document.getElementById(containerId); 

        // Creates a new Three.js scene
        this.scene = new THREE.Scene(); 
         // Sets the background color of the scene
        this.scene.background = new THREE.Color(0x445C6E); 
        
        // Creates a perspective camera
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100); 
        // Positions the camera at eye height for VR
        this.camera.position.set(0 ,1.6, 3); 
        this.scene.add(this.camera);

        // Creates the WebGL renderer
        this.renderer = new THREE.WebGLRenderer({antialias: true}); 
        // Sets the renderer size to fill the window
        this.renderer.setSize(window.innerWidth, window.innerHeight); 
        // Wichtig für Pointer-Events auf Touch/Mouse
        this.renderer.domElement.style.touchAction = 'none';
        this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
     

        // Enables WebXR support for VR rendering
        this.renderer.xr.enabled = true; 
        // Adds the renderer’s canvas to the container element
        container?.appendChild(this.renderer.domElement);
        // Adds a VR button to the page to enter/exit VR mode 
        document.body.appendChild(VRButton.createButton(this.renderer));


        const controller = this.renderer.xr.getController(0);
this.scene.add(controller);

controller.addEventListener('select', () => {

  // Ray aus Controller-Richtung
  this.tempMatrix.identity().extractRotation(controller.matrixWorld);
  this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

  // 🔴 WICHTIG: NUR Panel raycasten
  if (!this.controlPanel) return;

  const intersects = this.raycaster.intersectObjects(
    this.controlPanel.group.children,
    true
  );

  if (intersects.length > 0) {
    let obj: any = intersects[0].object;

    // nach oben laufen, bis Button gefunden
    while (obj && !obj.userData.onClick) {
      obj = obj.parent;
    }

    obj?.userData.onClick?.();
  }
});



        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        controls.target.set(0, 0, 0);
        controls.update(); 

        // Load the petri net to be visualized in the scene
        this.loadPetriNet(); 

        
        // Starts the render loop
        this.renderer.setAnimationLoop(() => {
            controls.update();
            // Renders the scene from the camera’s point of view
            this.renderer.render(this.scene, this.camera);
        });

        // Listens for browser window resize events
        window.addEventListener('resize', () => {
            // Gets the new window width
            const width = window.innerWidth;
            // Gets the new window height
            const height = window.innerHeight;
            // Updates the camera’s aspect ratio
            this.camera.aspect = width / height;
            // Recalculates the camera projection matrix
            this.camera.updateProjectionMatrix();
             // Updates the renderer size to match the window
            this.renderer.setSize(width, height);
        });
        
    }

    // Method to trigger a refresh of the VR Scene
    refreshScene(): void {
        this.loadPetriNet(); 
    }

    // Method to load the latest Petri net state from the backend
    loadPetriNet(): void {
        // Subscribe  to the observable returned by the API and wait for the Petri net data
        this.petriNetApi.getState().subscribe(petriNet => {
            // Once the data arrives, update the VR scene with the new Petri net
            this.updateScene(petriNet);
            this.showControlPanel();
        });
    }
    // Update the Three.js scene using the provided Petri net model
    updateScene(petriNet: PetriNetModel) {
      // Remove old net group if present to avoid overlaying
      if (this.netGroup) {
        this.scene.remove(this.netGroup);
        // dispose meshes to free GPU memory
        this.netGroup.traverse((obj) => {
          const mesh = obj as THREE.Mesh & { geometry?: THREE.BufferGeometry; material?: any };
          if ((mesh as any).geometry) {
            (mesh as any).geometry.dispose?.();
          }
          if ((mesh as any).material) {
            const mat = (mesh as any).material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
            else mat.dispose?.();
          }
        });
      }

      this.netGroup = new THREE.Group();
      this.scene.add(this.netGroup);

      // Delegate the actual construction of meshes (places, transitions, arcs) to the PetriNetBuilder
      PetriNetBuilder.buildNet(this.netGroup, petriNet);
    }




  



showControlPanel(): void {
  // altes Panel entfernen
  if (this.controlPanel) {
    // vom tatsächlichen Parent (Kamera) lösen und Ressourcen freigeben
    const grp = this.controlPanel.group;
    grp.parent?.remove(grp);
    grp.traverse((obj) => {
      const mesh = obj as THREE.Mesh & { geometry?: THREE.BufferGeometry; material?: any };
      if ((mesh as any).geometry) {
        (mesh as any).geometry.dispose?.();
      }
      if ((mesh as any).material) {
        const mat = (mesh as any).material;
        if (Array.isArray(mat)) mat.forEach((m) => {
          // dispose texture maps if any
          if (m.map) m.map.dispose?.();
          m.dispose?.();
        });
        else {
          if (mat.map) mat.map.dispose?.();
          mat.dispose?.();
        }
      }
    });
  }

  this.petriNetApi.getFireableTransitions().subscribe(transitions => {
    this.controlPanel = new VrControlPanel(transitions, (id: string) => {
      this.fireTransition(id);
    });
    this.controlPanel.group.position.set(0.9, 0.45, -1);
    this.camera.add(this.controlPanel.group);
    


  });
}


fireTransition(id: string) {
  this.petriNetApi.fireTransition(id).subscribe(state => {
    this.updateScene(state.state); // Token animation
    this.showControlPanel();    // refresh buttons
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
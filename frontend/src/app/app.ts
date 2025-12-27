import { Component, signal, AfterViewInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import * as THREE from 'three'; 
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'; 
import URDFLoader from 'urdf-loader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';




@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements AfterViewInit{

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




  ngAfterViewInit(): void {
    
    const container = document.getElementById('three-container')!; 

    const scene = new THREE.Scene(); 
    scene.background = new THREE.Color(0x445C6E) //0x4A5A66 //0x4A5057

    const camera = new THREE.PerspectiveCamera(
      70, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      100
    ); 
    camera.position.set(0,1.6,3); 

    const renderer = new THREE.WebGLRenderer({antialias: true}); 
    renderer.setSize(window.innerWidth, window.innerHeight); 
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
    color: 0x4B3621,
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
/*
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


*/









    // --------
    const geometry1 = new THREE.BoxGeometry(0.5, 1, 0.2); 
    const material1 = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
    const cube = new THREE.Mesh(geometry1, material1); 
    cube.position.set(0, 1.6, -1.5); 
    scene.add(cube)
    const geometry2 = new THREE.SphereGeometry(0.5, 32, 16)
    const material2 = new THREE.MeshBasicMaterial({color: 0x00fe00 }); 
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
          const material = new THREE.MeshStandardMaterial({color: 0xcccccc, metalness: 0.1, roughness: 0.7}); 
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
    urdfLoader.load("robot/me6_robot.urdf", (r) => {
      robot = r
      robot.position.set(2.5, 0, 0); 
      robot.rotation.x = -Math.PI / 2;
      robot.scale.set(8, 8, 8); 
      scene.add(robot); 
      console.log("URDF robot loaded:", robot); 
    })


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

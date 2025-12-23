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
  ngAfterViewInit(): void {
    const container = document.getElementById('three-container')!; 

    const scene = new THREE.Scene(); 
    scene.background = new THREE.Color(0x234820)

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

    const geometry1 = new THREE.BoxGeometry(0.5, 1, 0.2); 
    const material1 = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
    const cube = new THREE.Mesh(geometry1, material1); 
    cube.position.set(0, 1.6, -1.5); 
    scene.add(cube)
    const geometry2 = new THREE.SphereGeometry(0.5, 32, 16)
    const material2 = new THREE.MeshBasicMaterial({color: 0x00fe00}); 
    const sphere = new THREE.Mesh(geometry2, material2); 
    sphere.position.set(1, 1.6, -1.5); 
    scene.add(sphere)

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
      robot.position.set(3, 0, -1.5); 
      robot.rotation.x = -Math.PI / 2;
      robot.scale.set(5, 5, 5); 
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

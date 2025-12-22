import { Component, signal, AfterViewInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import * as THREE from 'three'; 
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'; 
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

    const light = new THREE.HemisphereLight(0Xffffff, 0x444444); 
    light.position.set(0,1,0); 
    scene.add(light); 

    const gemometry = new THREE.BoxGeometry(0.5, 0.5, 0.5); 
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
    const cube = new THREE.Mesh(gemometry, material); 
    cube.position.set(0, 1.6, -1.5); 
    scene.add(cube)

    renderer.setAnimationLoop(() => {
      cube.rotation.y += 0.01; 
      renderer.render(scene, camera); 
    }); 
  }

  
}

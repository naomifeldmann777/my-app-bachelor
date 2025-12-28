import { Component, AfterViewInit } from '@angular/core';
// Imports the service that sets up and manages the Three.js VR scene
import { VrSceneService } from './visualization/scene/vr-scene-service';

@Component({
  selector: 'app-root',
  template: '<div id="threejs-container"></div>'
})

export class App implements AfterViewInit {

   // Stores a reference to the VR scene service
  private vrScene: VrSceneService; 

  constructor (vrScene: VrSceneService) {
    this.vrScene = vrScene; 
  }

  // Runs after the component’s HTML is fully rendered
  ngAfterViewInit(): void {
    // Initializes the VR scene inside the div with this ID
    this.vrScene.init('threejs-container');
  }
}
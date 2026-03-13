import * as THREE from 'three'; 
import { TransitionModel } from '../../domain/transition-model';

export class TransitionMesh {
    // The Three.js mesh representing the transition in the scene
    mesh: THREE.Mesh; 
    // The data model associated with this transition
    transition: TransitionModel; 

    constructor (transition: TransitionModel) {
    // Create a new TransitionMesh from a TransitionModel

        this.transition = transition; 
        // Create a box geometry with width, height, and depth in world units
        const geometry = new THREE.BoxGeometry(0.5, 1, 0.2); 
        // Create standard material that is affected by lights
        const material = new THREE.MeshStandardMaterial({color: 0xff0000, side: THREE.DoubleSide}); // Render both sides so the mesh stays visible and raycastable from all angles during VR dragging

        // Combine geometry and material into a renderable mesh
        this.mesh = new THREE.Mesh(geometry, material); 
        // Set the mesh position in world space
        this.mesh.position.set(
            this.transition.position.x, 
            this.transition.position.y, 
            this.transition.position.z
        ); 

        // Store metadata for drag interactions and raycasting in DELETE/EDIT mode
        this.mesh.userData = {
            type: 'transition',
            id: this.transition.id,
            transitionData: this.transition
        };

        // Create a text label sprite using the transition label
        const label = this.createText(this.transition.label);
        // Position the label slightly below the mesh
        label.position.set(0, -0.7, 0); 
        // Attach the label as a child of the mesh
        this.mesh.add(label);
    }

    createText(text: string): THREE.Sprite {
    // Create a camera-facing text sprite from a string

        // Create an offscreen HTML canvas for drawing text
        const canvas = document.createElement('canvas');
        // Get the 2D drawing context from the canvas
        const context = canvas.getContext('2d')!;

         // Define the font size in pixels
        const fontSize = 64; 
        // Define the font family
        const fontFamily = 'Arial'; 
        // Set the font for text measurement
        context.font = `${fontSize}px ${fontFamily}`;
        // Measure the pixel width of the text
        const metrics = context.measureText(text);
        // Define horizontal padding around the text
        const padding = 20;

        // Set the canvas width based on text width plus padding
        canvas.width = metrics.width + padding * 2; 
        // Set the canvas height based on font size
        canvas.height = fontSize * 1.6; 

        // Reapply the font because resizing the canvas resets the context
        context.font = `${fontSize}px ${fontFamily}`;
        // Set the text color
        context.fillStyle = 'black'; 
        // Center the text horizontally
        context.textAlign = 'center'; 
        // Center the text vertically
        context.textBaseline = 'middle'; 
        // Draw the text in the center of the canvas
        context.fillText(text, canvas.width / 2, canvas.height / 2); 

        // Convert the canvas into a Three.js texture
        const texture = new THREE.CanvasTexture(canvas); 
        // Create a sprite material using the canvas texture
        const material = new THREE.SpriteMaterial({map: texture, depthTest: false, depthWrite: false}); 
        // Create a sprite that always faces the camera
        const sprite = new THREE.Sprite(material); 

        // Define the sprite height in world units
        const worldHeight = 0.3; 
        // Calculate the sprite width based on the canvas aspect ratio
        const worldWidth = (canvas.width / canvas.height) * worldHeight;
        // Scale the sprite to the correct size in world space
        sprite.scale.set(worldWidth, worldHeight, 1);  

        // Return the created text sprite
        return sprite; 
    }  
}
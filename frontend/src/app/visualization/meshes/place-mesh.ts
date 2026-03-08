import * as THREE from 'three'; 
import { PlaceModel } from '../../domain/place-model';

export class PlaceMesh {
    // The Three.js mesh that visually represents the place in the scene
    mesh: THREE.Mesh; 
    // The data model associated with this place
    place: PlaceModel; 

    constructor (place: PlaceModel) {
    // Create a new PlaceMesh instance from a PlaceModel

        this.place = place; 
        // Create a spherical geometry
        const geometry = new THREE.SphereGeometry(0.5, 64, 64); 
        // Create standard material that is affected by lights
        let material; 
        if (this.place.role === 'ee_position') { // If the place has role "ee_position", use green material 
            material = new THREE.MeshStandardMaterial({color: 0x00ff00, side: THREE.DoubleSide}); // Render both sides so the mesh stays visible and raycastable from all angles during VR dragging
        } else if (this.place.role === 'object_state') { // If the place has role "object_state", use blue material 
            material = new THREE.MeshStandardMaterial({color:0x0000ff, side: THREE.DoubleSide}); 
        } else if (this.place.role === 'ee_state') { // If the place has role "ee_state", use yellow material 
            material = new THREE.MeshStandardMaterial({color:0xffff00, side: THREE.DoubleSide}); 
        } else {
            material = new THREE.MeshStandardMaterial({color: 0x808080, side: THREE.DoubleSide}); // Default material is grey
        }
        // Combine geometry and material into a renderable mesh
        this.mesh = new THREE.Mesh(geometry, material); 
        // Set mesh position in world space
        this.mesh.position.set(
            this.place.position.x, 
            this.place.position.y, 
            this.place.position.z
        ); 
    
        // Store metadata for drag interactions
        this.mesh.userData = {
            type: 'place',
            id: this.place.id,
            placeData: this.place
        };

        // Create a text label sprite using the place label
        const label = this.createText(this.place.label);
        // Position the label slightly below the mesh
        label.position.set(0, -0.7, 0); 
        // Attach the label as a child of the mesh
        this.mesh.add(label);

        // Check whether the place has any tokens
        if (this.place.tokens > 0) {
            // Create a text sprite representing a token icon
            const token = this.createText('⬤'); 
            // Position the token icon at the center of the place
            token.position.set(0, 0, 0); 
            // Attach the token icon to the place mesh
            this.mesh.add(token); 
            // Create a text sprite showing the number of tokens
            const tokenNumber = this.createText(this.place.tokens.toString()); 
            // Position the token count slightly above the token icon
            tokenNumber.position.set(0, 0.2, 0); 
            // Attach the token count to the place mesh
            this.mesh.add(tokenNumber); 
        }
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
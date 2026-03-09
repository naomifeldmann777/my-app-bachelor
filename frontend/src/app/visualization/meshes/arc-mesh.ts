import * as THREE from 'three'; 
import { ArcModel } from '../../domain/arc-model';

export class ArcMesh {
    // The Three.js group mesh representing the arc in the scene
    mesh: THREE.Group; 
    // The data model associated with this arc
    arc: ArcModel; 

    constructor (arc: ArcModel, start: THREE.Vector3, end: THREE.Vector3, startType: 'place' | 'transition') {
        this.arc = arc; 

        // Define the radius of a place sphere (used to offset the arrow start away from the sphere)
        const placeRadius = 0.5; 
        // Define half the width of a transition box (used to offset the arrow start away from the box)
        const transitionHalfWidth = 0.25; 
        // Define an extra spacing gap so the arrow does not touch the start/end objects
        const gap = 0.1; 

        // Create standard material that is affected by lights
        const material = new THREE.MeshStandardMaterial({ color: 0x000000}); 

        // Compute the vector pointing from start to end
        const direction = new THREE.Vector3().subVectors(end, start); 
        // Compute the distance between start and end
        const distance = direction.length(); 
        // Normalize the direction vector so it has length 1
        direction.normalize();
        
        // Compute usable arrow length after subtracting object sizes and gaps on both sides
        const length = distance - placeRadius - transitionHalfWidth - gap * 2; 
        // Define the arrowhead length in world units
        const headLength = 0.2;
        // Compute the shaft length so that shaft + head = total usable arrow length
        const shaftLength = length - headLength; 
        // Create a cylinder geometry for the shaft with fixed radius and the computed length
        const shaftGeometry = new THREE.CylinderGeometry(0.02, 0.02, shaftLength, 32);
        // Create the shaft mesh from the geometry and material
        const shaft = new THREE.Mesh(shaftGeometry, material);
        // Tag shaft so raycasting in DELETE/EDIT mode can identify it as an arc
        shaft.userData = { id: arc.id, type: 'arc' };
        // Create a cone geometry for the arrowhead with radius 0.1 and height = headLength
        const headGeometry = new THREE.ConeGeometry(0.1, headLength, 32); 
        // Create the head mesh from the geometry and material
        const head = new THREE.Mesh(headGeometry, material);
        // Tag head so raycasting in DELETE/EDIT mode can identify it as an arc
        head.userData = { id: arc.id, type: 'arc' };

        // Declare a variable holding how far to offset from the start object 
        let startOffsetDistance: number;
        // If the arc starts at a place sphere
        if (startType === 'place') {
            // Offset by the sphere radius 
            startOffsetDistance = placeRadius;
        } else {
            // Offset by half the box width
            startOffsetDistance = transitionHalfWidth;
        }

        // Compute the actual arrow origin by moving from start toward end by (surface offset + gap)
        const startOffset = start.clone().add(direction.clone().multiplyScalar(startOffsetDistance + gap)); 

        // Rotate the shaft so its length axis aligns with the z axis
        shaft.rotation.x = Math.PI / 2; 
        // Rotate the head so its length axis aligns with the z axis
        head.rotation.x  = Math.PI / 2;

        // Move the shaft forward along local z by half its length so its back end sits at z=0 (the group origin) and its front end reaches z=shaftLength
        shaft.position.z = shaftLength / 2;
        // Move the arrowhead forward along local z so its base starts where the shaft ends and its center sits at shaftLength + half the cone height 
        head.position.z  = shaftLength + headLength / 2;

        // Create a parent group to orient the entire arrow (shaft + head + text) with one transform instead of transforming each part in world space
        this.mesh = new THREE.Group ();
        // Attach the shaft to the group
        this.mesh.add(shaft); 
        // Attach the head to the group
        this.mesh.add(head); 
        // Place the whole arrow group at the computed start offset in world space
        this.mesh.position.copy(startOffset);
        // Rotate the group so its local “forward” direction points toward the end object (Three.js lookAt aligns the group’s local -Z axis toward the target)
        this.mesh.lookAt(end); 

        // Read the arc’s weight value from the data model
        const weight = this.arc.weight; 
        // Only add a weight label if weight > 1
        if (weight > 1) {
            // Create a sprite label that displays the weight number 
            const weightText = this.createText(weight.toString());
            // Place the weight label in the middle of the shaft 
            weightText.position.set(0, 0.2, shaftLength / 2); 
            // Add the weight label to the group
            this.mesh.add(weightText);
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


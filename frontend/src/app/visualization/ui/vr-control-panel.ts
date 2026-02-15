import * as THREE from 'three'; 
// Import ThreeMeshUI for MSDF-based UI blocks/text
import ThreeMeshUI from 'three-mesh-ui';

export class VrControlPanel { 

  // Static factory method to build a control panel and return clickable buttons
  static createControlPanel( 
    // List of transitions to render as buttons
    transitions: Array<{ id: string; label: string }>, 
    // Callback executed when a transition button is clicked
    onFire: (id: string) => void, 
    // Callback executed when the reset button is clicked
    onReset: () => void 
  ): { group: THREE.Object3D; buttons: THREE.Object3D[] } { // Returns panel root and buttons
    
    
    const container = new (ThreeMeshUI as any).Block({
      width: 0.75, // Panel width
      justifyContent: 'center', // Center children vertically
      contentDirection: 'column', // Stack children top-to-bottom
      textAlign: 'center', // Center text within its block
      fontFamily: '/fonts/Roboto-msdf.json', // MSDF font metrics JSON path
      fontTexture: '/fonts/Roboto-msdf.png', // MSDF font atlas PNG path
      fontSize: 0.065, // Default font size for text elements
      padding: 0.035, // Inner padding around the panel content
      margin: 0.02, // External margin 
      borderRadius: 0.1, // Rounded corner radius for panel background
      backgroundOpacity: 0.4, // Semi-transparent panel background
      backgroundColor: new THREE.Color(0x222222), // Dark background color
      interLine: 0.02 // Vertical spacing between text lines
    });

    // Collect clickable buttons for raycasting
    const buttons: THREE.Object3D[] = []; 

    // Title block
    const titleBlock = new (ThreeMeshUI as any).Block({
      width: 0.72, // Slightly narrower than container for padding
      height: 0.14, // Fixed height to reserve space for the title
      justifyContent: 'center', // Vertically center the title text
      textAlign: 'center', // Center the title text horizontally
      padding: 0.005, // Small inner padding
      margin: 0.01, // Small outer margin below/above
      backgroundOpacity: 0 // Transparent background for the title block
    });
    titleBlock.add(
      new (ThreeMeshUI as any).Text({
        content: 'Control Panel', // Title text string
        fontSize: 0.085, // Slightly larger font for the title
        fontColor: new THREE.Color(0xffffff) // White title text
      })
    );
    container.add(titleBlock); // Add title block to the panel

    // Reset button block
    const resetBtn = new (ThreeMeshUI as any).Block({
      width: 0.6, // Button width
      height: 0.17, // Button height
      justifyContent: 'center', // Center text inside button
      offset: 0.035, // Depth offset for pressed/hover animation
      margin: 0.02, // Space around the button
      borderRadius: 0.08 // Rounded corners for button background
    });
    resetBtn.add(new (ThreeMeshUI as any).Text({ content: 'Reset Simulation' })); // Button label

    // Options for component.setupState() -> ThreeMeshUI applies these attributes when e.g.`setState('hovered')` is called
    // Hovered state attributes
    const hovered = {
      state: 'hovered', // Activated on hover (via raycasting input calling setState)
      attributes: {
        offset: 0.025, 
        backgroundColor: new THREE.Color(0x999999), // Lighter background on hover
        backgroundOpacity: 0.9, // More opaque to highlight
        fontColor: new THREE.Color(0xffffff) // Keep text white on hover
      }
    };
    // Idle state attributes
    const idle = {
      state: 'idle', // Default resting UI state
      attributes: {
        offset: 0.025, // Neutral offset
        backgroundColor: new THREE.Color(0x666666),
        backgroundOpacity: 0.35, // Semi-transparent in idle
        fontColor: new THREE.Color(0xffffff) // White text
      }
    };
    // Disabled state attributes
    const disabled = {
      state: 'disabled', // Activated when button should not accept input (e.g. during animation)
      attributes: {
        offset: 0.025,
        backgroundColor: new THREE.Color(0x333333), // Darker background to indicate disabled state
        backgroundOpacity: 0.2,
        fontColor: new THREE.Color(0x888888) // Gray text to indicate disabled state
      }
    };
    // Define and register the "selected" state:
    resetBtn.setupState({
      state: 'selected', // Activated on click (via raycasting input calling setState)
      attributes: idle.attributes, // Use idle look; only action matters here
      onSet: () => onReset() // Call reset once when entering selected state
    });
    // Register the "hovered" state:
    resetBtn.setupState(hovered);
    // Register the "idle" state:
    resetBtn.setupState(idle);
    // Register disabled state so external code can show disabled look
    resetBtn.setupState(disabled);

    // Add reset button to the panel 
    container.add(resetBtn); 
    // Track button for raycasting so input code can set states
    buttons.push(resetBtn); 

    // Subtitle block indicating fireabletransitions section
    const subtitleBlock = new (ThreeMeshUI as any).Block({
      width: 0.72, // Align with title width
      height: 0.12, // Reserve space for subtitle
      justifyContent: 'center', // Center the subtitle
      textAlign: 'center', // Center text horizontally
      padding: 0.005, // Small inner padding
      margin: 0.01, // Small spacing below subtitle
      backgroundOpacity: 0 // Transparent block
    });
    subtitleBlock.add(
      new (ThreeMeshUI as any).Text({
        content: 'Fire Transitions', // Subtitle text
        fontSize: 0.07, // Subtitle font size
        fontColor: new THREE.Color(0xffffff) // White subtitle text
      })
    );
    container.add(subtitleBlock); // Add subtitle to panel

    // Base style object for transition buttons
    const buttonOptions = {
      width: 0.68, // Width to fit within the container
      height: 0.16, // Button height
      justifyContent: 'center', // Center the label
      offset: 0.035,
      margin: 0.015, // Vertical spacing between buttons
      borderRadius: 0.075 // Rounded corners
    };

    // Create a button for each fireable transition
    for (const t of transitions) {
      const btn = new (ThreeMeshUI as any).Block(buttonOptions); // Button block
      btn.add(new (ThreeMeshUI as any).Text({ content: t.label })); // Button text with transition label

      // Define and register the "selected" state for the transition button
      btn.setupState({
        state: 'selected', 
        attributes: idle.attributes, 
        onSet: () => onFire(t.id) // Invoke fire callback with transition id
      });
      // Register hovered, idle and disabled states
      btn.setupState(hovered); 
      btn.setupState(idle); 
      btn.setupState(disabled);

      // Add button to the panel
      container.add(btn); 
      // Track button for raycasting
      buttons.push(btn); 
    }

    // Return panel root and clickable buttons
    return { group: container as THREE.Object3D, buttons }; 
  }
}
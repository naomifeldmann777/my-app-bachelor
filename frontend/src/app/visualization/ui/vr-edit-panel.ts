import * as THREE from 'three';
import ThreeMeshUI from 'three-mesh-ui';
import { PetriApiService } from '../../api/petri-net-api-service';

// Button state definitions for consistent styling across the panel
const BTN_IDLE = {
  state: 'idle', // Default state for buttons
  attributes: {
    offset: 0.025, // Small Z-offset so the button renders slightly in front of its parent panel
    backgroundColor: new THREE.Color(0x666666), // Default grey background color
    backgroundOpacity: 0.35, // Default opacity
    fontColor: new THREE.Color(0xffffff) // Default white font color
  }
};

const BTN_HOVERED = {
  state: 'hovered', // When the user points at the button but hasn't clicked yet
  attributes: {
    offset: 0.025, 
    backgroundColor: new THREE.Color(0x999999), // Lighter grey to indicate hover
    backgroundOpacity: 0.9, // Higher opacity when hovered
    fontColor: new THREE.Color(0xffffff) // Font color remains white on hover
  }
};

// VrEditPanel: a "popup" ThreeMeshUI panel to edit properties of a Petri net element (place, transition, or arc)
export class VrEditPanel {
  private scene: THREE.Scene; // Reference to the Three.js scene to which the panel will be added
  private api: PetriApiService; // Reference to the API service for making update requests when properties are edited
  private onClose: () => void; // Called after a successful save OR explicit close
  private onModelChanged: () => void; // Called after a successful save to trigger a refresh of the Petri net state in vr scene service 

  // Currently active panel group in the scene (if any) between edit/property panel and keyboard panel 
  private group: THREE.Object3D | null = null;
  // Buttons registered for raycasting
  public buttons: THREE.Object3D[] = [];
  // Fired after every panel rebuild (property list or keyboard) so the raycasting list can be updated in vr scene service with the new buttons
  public onRebuild?: () => void;

  // Which property is currently being edited (null = showing property list)
  private activeProperty: string | null = null;
  // Current typed value while keyboard is open (used to update the display text block in real time)
  private typedValue = '';
  // Reference to the display text block so we can update it while typing
  private typedTextBlock: any = null;

  // Element currently being edited
  private currentType = '';
  private currentId = '';
  private currentData: any = null;

  // Constructor takes references to the Three.js scene, API service, and callbacks for when the model changes or panel closes
  constructor(
    scene: THREE.Scene,
    api: PetriApiService,
    onModelChanged: () => void,
    onClose: () => void
  ) {
    this.scene = scene;
    this.api = api;
    this.onModelChanged = onModelChanged;
    this.onClose = onClose;
  }


  // Method to show the edit panel for a specific element type (place, transition, arc) and current data (used to populate the property list)
  show(type: string, id: string, data: any) {
    this.hide(); // Ensure any existing panel is removed before showing a new one
    this.currentType = type; // Store the current element type, ID, and data for use in building the panel and submitting changes
    this.currentId = id;
    this.currentData = data;
    this.activeProperty = null; // Start by showing the property list, no active property being edited yet
    this._buildPropertyList(); // Build and display the property list panel for the current element
  }

  // Remove panel (edit panel or keyboard panel) from scene
  hide() {
    // If there's an active panel group in the scene, remove it and clear the reference
    if (this.group) {
      this.scene.remove(this.group); // Remove the panel group from the scene
      this.group = null;
    }
    // Clear buttons list so raycasting doesn't interact with invisible buttons after panel is removed
    this.buttons = [];
    this.typedValue = ''; // Clear any previously typed value when opening a new panel
    this.typedTextBlock = null; // Clear reference to the text block that shows the typed value
  }

  // Helper method to build the property list panel (edit panel) based on the current element type and data
  private _buildPropertyList() {
    // Create a container block for the panel
    const container = this._makeContainer();

    // Call to helper method to add a title block to the panel, using the current element type (capitalized) in the title text, Title: "Edit <Type>"
    this._addTitle(container, `Edit ${this._capitalize(this.currentType)}`);

    // Get the list of editable properties for the current element type and create a button for each property that opens the keyboard when selected
    const props = this._propsForType(this.currentType);
    // For each property, create a button
    for (const prop of props) {
      // Get the current value of the property from the element data to display on the button
      const currentVal = this._currentValueFor(prop);
      // Create a button with the property name and current value, e.g. "Label: MyPlace"
      const btn = this._makeButton(`${prop}: ${currentVal}`);
      // Set up button states: when selected, it should open the keyboard for that property
      btn.setupState({ state: 'selected', attributes: BTN_IDLE.attributes, onSet: () => this._openKeyboard(prop) });
      btn.setupState(BTN_HOVERED);
      btn.setupState(BTN_IDLE);
      container.add(btn); // Add the button to the panel container
      this.buttons.push(btn); // Register the button for raycasting interactions
    }

    // Add a close button at the bottom of the panel to allow users to exit without making changes
    const closeBtn = this._makeButton('Close');
    // Set up button states: when selected, it should hide the panel and call the onClose callback
    closeBtn.setupState({ state: 'selected', attributes: BTN_IDLE.attributes, onSet: () => { this.hide(); this.onClose(); } });
    closeBtn.setupState(BTN_HOVERED);
    closeBtn.setupState(BTN_IDLE);
    container.add(closeBtn); // Add the close button to the panel container
    this.buttons.push(closeBtn); // Register the close button for raycasting interactions

    this._addToScene(container); // Add the fully built panel container to the Three.js scene 
  }

  // ─── Build keyboard panel for one property ───────────────────────────────────

  // Helper method to open the keyboard panel for a specific property, allowing the user to type in a new value for that property
  private _openKeyboard(prop: string) {
    this.hide(); // Remove the property list panel before showing the keyboard panel
    this.activeProperty = prop; // Set the active property to know which property we're editing, used in the submit function to determine which API call to make and which field to update
    this.typedValue = String(this._currentValueFor(prop)); // Pre-fill the typed value with the current property value so the user can see it and edit it if needed when the keyboard opens

    const isNumeric = prop === 'tokens' || prop === 'weight'; // Determine if the property is numeric to decide which keyboard layout to show (numeric keyboard for tokens and weight, alphanumeric keyboard for other properties)
    const containerWidth = isNumeric ? 0.75 : 1.15; // Adjust container width for numeric keyboard since it has fewer keys than the full alphanumeric keyboard
    const container = this._makeContainer(containerWidth); // Create a container block for the keyboard panel with appropriate width based on the keyboard type

    this._addTitle(container, `Edit "${prop}"`); // Add a title to the keyboard panel that indicates which property is being edited, e.g. "Edit 'Label'"

    // Current value display block
    const displayBlock = new (ThreeMeshUI as any).Block({
      width: containerWidth - 0.1, // Make the display block slightly narrower than the container to fit within the padding
      height: 0.12, // Fixed height for the display block
      justifyContent: 'center', // Center the text vertically within the block
      textAlign: 'center',
      margin: 0.01,
      backgroundOpacity: 0.15, 
      backgroundColor: new THREE.Color(0x000000),
      borderRadius: 0.04
    });
    const displayText = new (ThreeMeshUI as any).Text({ content: this.typedValue, fontSize: 0.07 }); // Display the current typed value in the keyboard panel, updated in real time as the user types
    displayBlock.add(displayText); // Add the text block to the display block
    container.add(displayBlock); // Add the display block to the keyboard panel container
    this.typedTextBlock = displayText; // Store a reference to the text block so we can update it as the user types

    // Add either the numeric keyboard or the alphanumeric keyboard based on the property type
    if (isNumeric) {
      this._addNumericKeys(container);
    } else {
      this._addAlphaKeys(container);
    }

    // Backspace + OK + Cancel row
    const isAlpha = !['tokens', 'weight'].includes(this.activeProperty ?? ''); // Determine if the current property is alphanumeric to adjust button sizes and spacing for the action row
    const actionRow = this._makeRow(isAlpha ? 1.1 : 0.72); // Make the action row wider for the alphanumeric keyboard 

    const backspaceBtn = this._makeSmallButton('Del', isAlpha ? 0.22 : 0.18); // Create a backspace button, slightly larger for the alphanumeric keyboard since it has more space in the layout
    // Set up button states: when selected, it should remove the last character from the typed value and refresh the display text block to show the updated value
    backspaceBtn.setupState({
      state: 'selected', attributes: BTN_IDLE.attributes,
      onSet: () => { this.typedValue = this.typedValue.slice(0, -1); this._refreshDisplay(); }
    });
    // Set up hover and idle states for the backspace button
    backspaceBtn.setupState(BTN_HOVERED);
    backspaceBtn.setupState(BTN_IDLE);
    actionRow.add(backspaceBtn); // Add the backspace button to the action row
    this.buttons.push(backspaceBtn); // Register the backspace button for raycasting interactions

    // OK button to submit the changes, slightly larger for the alphanumeric keyboard to fill the wider layout
    const okBtn = this._makeSmallButton('OK', isAlpha ? 0.25 : 0.2);
    // Set up button states: when selected, it should submit the changes by calling the API and then hide the panel
    okBtn.setupState({
      state: 'selected', attributes: BTN_IDLE.attributes,
      onSet: () => this._submit()
    });
    // Set up hover and idle states for the OK button
    okBtn.setupState(BTN_HOVERED);
    okBtn.setupState(BTN_IDLE);
    actionRow.add(okBtn); // Add the OK button to the action row
    this.buttons.push(okBtn); // Register the OK button for raycasting interactions

    // Cancel button to go back to the property list without saving changes, slightly larger for the alphanumeric keyboard to fill the wider layout
    const cancelBtn = this._makeSmallButton('Cancel', isAlpha ? 0.3 : 0.22);
    // Set up button states: when selected, it should hide the keyboard panel and show the property list panel again without saving changes
    cancelBtn.setupState({
      state: 'selected', attributes: BTN_IDLE.attributes,
      onSet: () => this.show(this.currentType, this.currentId, this.currentData) // back to list
    });
    // Set up hover and idle states for the Cancel button
    cancelBtn.setupState(BTN_HOVERED);
    cancelBtn.setupState(BTN_IDLE);
    actionRow.add(cancelBtn); // Add the Cancel button to the action row
    this.buttons.push(cancelBtn); // Register the Cancel button for raycasting interactions

    container.add(actionRow); // Add the action row with the Backspace, OK, and Cancel buttons to the keyboard panel container
    this._addToScene(container); // Add the fully built keyboard panel container to the Three.js scene
  }

  // ─── Keyboard helpers ─────────────────────────────────────────────────────────

  // Helper method to add alphanumeric keys to the keyboard panel container
  private _addAlphaKeys(container: any) {
    const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm -'];
    for (const row of rows) {
      const rowBlock = this._makeRow(1.1); // Create a row block for each row of keys, wider for the alphanumeric keyboard to fit all the keys
      for (const ch of row) {
        const label = ch === ' ' ? 'SP' : ch; // Display "SP" for the space character to make it clear on the button
        const btn = this._makeSmallButton(label, 0.095); // Create a small button for each character
        // Set up button states: when selected, it should append the character to the typed value and refresh the display text block to show the updated value
        btn.setupState({
          state: 'selected', attributes: BTN_IDLE.attributes,
          onSet: () => { this.typedValue += ch; this._refreshDisplay(); }
        });
        // Set up hover and idle states for the button
        btn.setupState(BTN_HOVERED);
        btn.setupState(BTN_IDLE);
        rowBlock.add(btn); // Add the button to the current row block
        this.buttons.push(btn); // Register the button for raycasting interactions
      }
      container.add(rowBlock); // Add the completed row block to the keyboard panel container
    }
  }

  // Helper method to add numeric keys (0-9) to the keyboard panel container, arranged in a standard numeric keypad layout
  private _addNumericKeys(container: any) {
    const rows = ['789', '456', '123', '0'];
    for (const row of rows) {
      const rowBlock = this._makeRow(); // Create a row block for each row of keys
      for (const ch of row) {
        const btn = this._makeSmallButton(ch, 0.12); // Create a larger button for numeric keys since there are fewer of them 
        // Set up button states: when selected, it should append the number to the typed value and refresh the display text block to show the updated value
        btn.setupState({
          state: 'selected', attributes: BTN_IDLE.attributes,
          onSet: () => { this.typedValue += ch; this._refreshDisplay(); }
        });
        // Set up hover and idle states for the button
        btn.setupState(BTN_HOVERED);
        btn.setupState(BTN_IDLE);
        rowBlock.add(btn);
        this.buttons.push(btn); // Register the button for raycasting interactions
      }
      container.add(rowBlock); // Add the completed row block to the keyboard panel container
    }
  }

  // Helper method to update the display text block with the current typed value, called after every key press in the keyboard panel to reflect the changes in real time
  private _refreshDisplay() {
    if (this.typedTextBlock) {
      this.typedTextBlock.set({ content: this.typedValue || ' ' });
    }
  }

  // Helper method to submit the changes when the user clicks the OK button in the keyboard panel
  private _submit() {
    // Get the currently active property being edited and the typed value from the keyboard
    const prop = this.activeProperty!;
    const val = this.typedValue;

    // Define a callback function to call after a successful API update that triggers the onModelChanged callback to refresh the Petri net state in the VR scene and then hides the panel and calls the onClose callback
    const done = () => { this.onModelChanged(); this.hide(); this.onClose(); };

    // Update the appropriate property based on the current element type
    if (this.currentType === 'place') {
      const props: any = {};
      if (prop === 'tokens') props.tokens = parseInt(val, 10); // Parse tokens as an integer since it's a numeric property
      else props[prop] = val;
      this.api.updatePlaceProperties(this.currentId, props).subscribe(() => done()); // Call the API to update the place property and then call the done callback after a successful update
    } else if (this.currentType === 'transition') {
      const props: any = {};
      props[prop] = val; 
      this.api.updateTransitionProperties(this.currentId, props).subscribe(() => done()); // Call the API to update the transition property and then call the done callback after a successful update
    } else if (this.currentType === 'arc') {
      this.api.updateArcWeight(this.currentId, parseInt(val, 10)).subscribe(() => done()); // Call the API to update the arc weight and then call the done callback after a successful update
    }
  }

  // ─── ThreeMeshUI builder helpers ──────────────────────────────────────────────

  // Helper method to create a styled container block for the panels
  private _makeContainer(width = 0.75): any {
    return new (ThreeMeshUI as any).Block({
      width, // Default width, can be overridden for wider keyboard layout
      justifyContent: 'center', // Center content vertically
      contentDirection: 'column', // Stack children vertically
      textAlign: 'center', // Center text horizontally
      fontFamily: '/fonts/Roboto-msdf.json', // MSDF font metrics JSON path
      fontTexture: '/fonts/Roboto-msdf.png', // MSDF font atlas PNG path
      fontSize: 0.055, // Default font size for text elements
      padding: 0.03, // Inner padding around the panel content
      margin: 0.02, // External margin 
      borderRadius: 0.1, // Rounded corner radius for panel background
      backgroundOpacity: 0.4, // Semi-transparent background to distinguish the panel from the scene
      backgroundColor: new THREE.Color(0x222222) // Dark background color for the panel
    });
  }

  // Helper method to add a title block to the panel, using the current element type (capitalized) in the title text, Title: "Edit <Type>"
  private _addTitle(container: any, text: string) {
    const block = new (ThreeMeshUI as any).Block({
      width: 0.72, height: 0.12, // Fixed width for title block to ensure consistent layout
      justifyContent: 'center', textAlign: 'center', // Center the title text
      padding: 0.005, margin: 0.01, backgroundOpacity: 0 // No background for the title block, just text
    });
    block.add(new (ThreeMeshUI as any).Text({
      content: text, fontSize: 0.075, fontColor: new THREE.Color(0xffffff) // White color for the title text to make it stand out
    }));
    container.add(block); // Add the title block to the main container
  }

  // Helper method to create a styled button with a given label
  private _makeButton(label: string): any {
    const btn = new (ThreeMeshUI as any).Block({ 
      width: 0.62, height: 0.13, // Button dimensions
      justifyContent: 'center',
      offset: 0.035, margin: 0.012, borderRadius: 0.065 // Rounded corners for the button
    });
    btn.add(new (ThreeMeshUI as any).Text({ content: label })); 
    return btn;
  }

  // Helper method to create a small button, used for the keyboard keys and action buttons (OK, Cancel) with customizable width
  private _makeSmallButton(label: string, width = 0.1): any {
    const btn = new (ThreeMeshUI as any).Block({
      width,
      height: 0.1,
      justifyContent: 'center',
      offset: 0.02,
      margin: 0.005,
      borderRadius: 0.04,
      fontSize: 0.045
    });
    btn.add(new (ThreeMeshUI as any).Text({ content: label }));
    return btn;
  }

  // Helper method to create a row block for arranging buttons in a horizontal row, used for the keyboard layout
  private _makeRow(width = 0.72): any {
    return new (ThreeMeshUI as any).Block({
      width,
      height: 0.115,
      contentDirection: 'row', // Arrange children in a horizontal row
      justifyContent: 'center',
      backgroundOpacity: 0,
      margin: 0.004
    });
  }

  // Helper method to add the edit or keyboard panel container to the Three.js scene with appropriate positioning and scaling
  private _addToScene(container: any) {
    // Position panel to the left of the control panel, same scale
    container.position.set(5, -1, 2);
    container.scale.set(2.5, 2.5, 1);
    container.rotation.y = -1.57; // Rotate the panel to be 90 degrees to the model
    (container as any).rotation.z = 0; // Keep panel straight for readability
    this.scene.add(container); // Add the panel container to the scene
    this.group = container; // Store reference to the active panel group for later removal when hiding the panel
    // Notify vr scene service so it can register the new buttons for raycasting 
    this.onRebuild?.();
  }

  // ─── Utilities ────────────────────────────────────────────────────────────────

  // Helper method to return the list of editable properties for a given element type (place, transition, arc)
  private _propsForType(type: string): string[] {
    if (type === 'place') return ['label', 'tokens', 'role'];
    if (type === 'transition') return ['label', 'capability'];
    return ['weight']; // arc
  }

  // Helper method to get the current value of a property from the element data, used to display the current value on the property buttons and pre-fill the keyboard input
  private _currentValueFor(prop: string): string | number {
    if (!this.currentData) return '';
    return this.currentData[prop] ?? '';
  }

  // Utility to capitalize the first letter of a string (used for the panel title)
  private _capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

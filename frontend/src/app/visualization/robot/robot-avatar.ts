import * as THREE from 'three';
// Import URDF loader to load robot description files
import URDFLoader from 'urdf-loader';
// Import STL loader to load 3D mesh files
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

// Class that represents and controls a robot in the VR scene
export class RobotAvatar {
  // URDF loader instance to load the robot file
  private urdfLoader: URDFLoader;
  // The actual robot object (loaded from URDF file)
  private robot?: any;
  // Array storing current angles for all 6 joints of the robot (in radians)
  private currentJoints = [0, 0, 0, 0, 0, 0];
  // Indicates whether an animation is currently running
  private animRunning = false;
  // Current animation state for joint interpolation; null if no animation is running
  private animState: null | {
    start: number[]; // Starting joint angles at the beginning of the animation
    target: number[]; // Target joint angles to reach at the end of the animation
    duration: number; // Total duration of the animation in milliseconds
    elapsed: number; // Time elapsed since the animation started (in milliseconds)
    resolve: () => void; // Callback to resolve the animation Promise
    easing: (t:number)=>number // Easing function for interpolation
  } = null;
  // Names of the 6 robot joints in order
  private readonly jointOrder = ['joint1', 'joint2', 'joint3', 'joint4', 'joint5', 'joint6'];

  constructor(private scene: THREE.Scene) {
    // Create a new URDF loader instance
    this.urdfLoader = new URDFLoader();

    // Configure how URDF loader should load STL mesh files
    this.urdfLoader.loadMeshCb = (path, manager, onComplete) => {
      // Create STL loader for loading 3D geometry
      const stlLoader = new STLLoader(manager);
      // Load the STL file from the given path
      stlLoader.load(
        path,
        (geometry) => {
          // Create a gray material for the robot parts
          const material = new THREE.MeshStandardMaterial({
            color: 0x737270,      // Light gray color
            metalness: 0.1,       // Slightly metallic appearance
            roughness: 0.7,       // Somewhat rough surface
          });
          // Create a 3D mesh combining geometry and material
          const mesh = new THREE.Mesh(geometry, material);
          // Create a group to hold the mesh
          const group = new THREE.Group();
          // Add mesh to the group
          group.add(mesh);
          // Return the loaded group
          onComplete(group);
        },
        undefined,
        // If loading fails, return empty group
        () => onComplete(new THREE.Group())
      );
    };
  }

  // Load the robot URDF file and add it to the scene
  load(): Promise<void> {
    // Load robot file asynchronously
    return this.urdfLoader.loadAsync('robot/me6_robot.urdf').then((robot) => {
      // Store the loaded robot
      this.robot = robot as any;
      // Set robot position in 3D space (x, y, z)
      robot.position.set(1.72, -3.78, -6.72);
      // Rotate robot 90 degrees around X axis
      robot.rotation.x = -Math.PI / 2;
      // Scale robot to be 20 times larger
      robot.scale.set(20, 20, 20);

      // Add robot to the 3D scene
      this.scene.add(robot);
    });
  }

  // Public method: Set joint angles for the robot
  public setJoints(values: number[]): void {
    // If robot not loaded yet, do nothing
    if (!this.robot) return;
    // Loop through all joints (up to 6 joints)
    for (let i = 0; i < Math.min(this.jointOrder.length, values.length); i++) {
      // Get the joint object by name from the robot
      const joint = this.robot.joints?.[this.jointOrder[i]];
      // If joint exists
      if (joint) {
        // Set the joint to the given angle value (in radians)
        joint.setJointValue(values[i]);
        // Remember the current joint angle
        this.currentJoints[i] = values[i];
      }
    }
  }

  // Animate joints from current angles to target angles over time
  private animateTo(
    target: number[], // Target joint angles to animate to
    duration = 1000, // Duration of the animation in milliseconds
    easing: 'linear' | 'easeInOut' = 'easeInOut' // Easing type for smoothness
  ): Promise<void> {
    if (!this.robot) return Promise.resolve(); // If robot isn't loaded, do nothing
    this.animRunning = true; // Mark that an animation is running
    // Choose the easing function for interpolation (smooth or linear)
    const ease = easing === 'easeInOut'
      ? (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t // Smooth ease-in-out
      : (t: number) => t; // Linear easing (no smoothing)
    // Return a Promise that resolves when the animation is finished
    return new Promise<void>(resolve => {
      // Store the animation state so the update() method can advance it each frame
      this.animState = {
        start: [...this.currentJoints], // The joint angles at the start of the animation
        target,                         // The target joint angles to reach at the end of the animation     
        duration,                       // Total duration of the animation in milliseconds    
        elapsed: 0,                     // Time elapsed since the animation started (in milliseconds)    
        resolve,                        // Callback to resolve the Promise when animation is complete 
        easing: ease                    // Easing function for interpolation (smooth or linear)    
      };
    });
  }

  // Method to be called every frame to update the animation state and apply joint angle changes
  public update(delta: number) {
    // If there is no active animation state, nothing to do
    if (!this.animState) return;
    // Advance the stored animation's elapsed time by the frame delta (delta is seconds, convert to ms)
    this.animState.elapsed += delta * 1000;
    // Compute normalized progress t in [0,1] (elapsed / duration) and clamp to 1
    const t = Math.min(1, this.animState.elapsed / this.animState.duration);
    // Apply easing function to the normalized progress for smooth interpolation
    const eased = this.animState.easing(t);
    // Interpolate each joint from its start angle toward the target using the eased progress
    const next = this.animState.start.map((s, i) => s + (this.animState!.target[i] - s) * eased);
    // Apply the interpolated joint angles to the robot and remember them as current joints
    this.setJoints(next);

    // If we've reached the end of the animation (t === 1), finalize
    if (t === 1) {
      // Mark that no animation is running
      this.animRunning = false;
      // Call the stored resolve function to fulfill the Promise returned by animateTo()
      this.animState.resolve();
      // Clear the animation state so future frames skip the animation block
      this.animState = null;
    }
  }

  // Returns whether an animation is currently running
  public isAnimating(): boolean {
    return this.animRunning;
  }

  // Public method: Move robot's end-effector (tip) to a specific XYZ position in 3D space
  // Uses Inverse Kinematics (IK) to calculate which joint angles are needed
  public async animateToXYZ(
    target: THREE.Vector3,  // Target position in 3D space (x, y, z)
    opts?: { easing?: 'linear' | 'easeInOut'; lockIndices?: number[] }
  ): Promise<void> {
    // If robot not loaded, do nothing
    if (!this.robot) return;
    
    // PHASE 1: Calculate joint angles needed to reach target position (Inverse Kinematics)
    // Number of IK iterations to try 
    const iterations = 800;
    // Animation style for final movement (default: smooth easeInOut)
    const easing = opts?.easing ?? 'easeInOut';
    // Set of joint indices that should not move during robot movement (locked joints)
    const lock = new Set(opts?.lockIndices ?? []);

    // Find the robot's end-effector (the tip that should reach the target)
    // Use joint 6 as end-effector
    const ee = (this.robot as any).getObjectByName?.('joint6');
    // Get 3D objects for all 6 joints
    const jointObjs = this.jointOrder.map(n => (this.robot as any)?.getObjectByName?.(n));
    // Remember starting joint angles to reset to this after calculations
    const startAngles = [...this.currentJoints];
    // Working copy of joint angles that we'll modify during IK
    const angles = [...startAngles];

    // IK Loop: Try to move joints to get end-effector closer to target --> Cyclic Coordinate Descent method (CCD)
    for (let iter = 0; iter < iterations; iter++) {
      // Get current position of end-effector in 3D space
      let eePos = ee.getWorldPosition(new THREE.Vector3());

      // Loop through joints backwards (from joint6 to joint1) --> how much should this joint rotate so the end-effector moves closer to the target
      for (let i = 5; i >= 0; i--) {
        // Skip this joint if it's locked
        if (lock.has(i)) continue;
        // Get the 3D object for this joint
        const jObj = jointObjs[i];
        // Get joint data (limits, axis, etc.) from robot (URDF joint definition)
        const jData = this.robot.joints?.[this.jointOrder[i]];
        // Skip if joint object or data is missing
        if (!jObj || !jData) continue;

        // Get current position of this joint in 3D space
        const jointPos = jObj.getWorldPosition(new THREE.Vector3());
        // Vector from joint to end-effector
        const toEE = eePos.clone().sub(jointPos);
        // Vector from joint to target position
        const toTarget = target.clone().sub(jointPos);
        // Skip if either vector is too small
        if (toEE.lengthSq() < 1e-10 || toTarget.lengthSq() < 1e-10) continue;

        // Get rotation axis for this joint in world coordinates
        // Create quaternion to represent joint's world rotation
        const q = new THREE.Quaternion();
        jObj.getWorldQuaternion(q);
        // Get joint's local axis from URDF, convert to world space using quaternion
        const axis = (jData.axis instanceof THREE.Vector3 ? jData.axis.clone() : new THREE.Vector3(jData?.axis?.x ?? 0, jData?.axis?.y ?? 0, jData?.axis?.z ?? 1)).applyQuaternion(q).normalize();

        // Compute the "flattened" version of toEE, lying completely in the joint's rotation plane.
        const uProj = toEE.clone().sub(axis.clone().multiplyScalar(toEE.dot(axis))); // toEE.dot(axis) = how much of toEE lies along the axis --> rotating the joint cannot change that component
        // Compute the "flattened" version of toTarget, lying completely in the joint's rotation plane.
        const vProj = toTarget.clone().sub(axis.clone().multiplyScalar(toTarget.dot(axis))); 
        // Calculate signed angle using atan2 (gives direction: + or -) --> angle that rotates uProj toward vProjaround the joint's axis --> dot(uProj, vProj) gives cos(theta), cross(uProj, vProj) gives a vector perpendicular to both, axis.dot(cross) gives the sign (direction) of the rotation, atan2(sin, cos) gives the signed angle in radians
        const delta = Math.atan2(axis.dot(new THREE.Vector3().crossVectors(uProj, vProj)), uProj.dot(vProj));

        // Calculate new angle for this joint
        let newAngle = angles[i] + delta;
        // If joint has rotation limits defined, clamp angle to stay within limits
        if (typeof jData.limits?.lower === 'number' && typeof jData.limits?.upper === 'number') {
          newAngle = Math.max(jData.limits.lower, Math.min(jData.limits.upper, newAngle));
        }
        // Store the new angle
        angles[i] = newAngle;

        // Apply new angles to robot to see new position (Forward Kinematics)
        this.setJoints(angles);
        // Update end-effector's world matrix to get its new position
        ee.updateWorldMatrix?.(true, true);
        // Get updated end-effector position for next joint calculation
        eePos = ee.getWorldPosition(new THREE.Vector3());
      }
    }

    // Reset robot back to starting position (before IK calculations) to sensure smooth animation from current pose to target pose
    this.setJoints(startAngles);

    // PHASE 2: Smoothly animate joints from current position to calculated target angles
    // Use the standard animation function with calculated angles
    await this.animateTo(angles, 5000, easing);
  }

  public flashEndEffectorColor(color: THREE.Color, duration = 5000): void {
    // If robot not loaded, do nothing
    if (!this.robot) return;
    // Find the robot's end-effector (the tip that should reach the target)
    const ee = (this.robot as any).getObjectByName?.('joint6');
    // If end-effector not found, do nothing
    if (!ee) return;
    // Find the first mesh under the end-effector (URDF provides a single mesh for Link6)
    const mesh = ee.getObjectByProperty?.('isMesh', true) as THREE.Mesh | null;
    // If no mesh found, do nothing
    if (!mesh) return;
    // Mark that an animation is running to prevent other animations
    this.animRunning = true;
    // Store material 
    const material: any = mesh.material;
    // Store original color to restore later
    const originalColor = material?.color?.clone(); 
    // Set the material color to the given color to create a flash effect
    material?.color?.copy(color);
    // After the specified duration, restore the original color and mark animation as finished
    setTimeout(() => {
      if (originalColor && material?.color) material.color.copy(originalColor);
      this.animRunning = false;
    }, duration);
  }
}


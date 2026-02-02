import * as THREE from 'three';
import { TransitionModel } from '../../domain/transition-model';

export class VrControlPanel {
  group: THREE.Group;

  constructor(
    fireableTransitions: TransitionModel[],
    onFire: (id: string) => void
  ) {
    this.group = new THREE.Group();

    // Layout constants
    const panelWidth = 0.6;
    const buttonWidth = 0.5;
    const buttonHeight = 0.08;
    const gap = 0.04; // space between buttons
    const padding = 0.04; // space top/bottom around buttons

    const count = fireableTransitions.length;
    const buttonsHeight = count > 0 ? count * buttonHeight + (count - 1) * gap : 0;
    const panelHeight = Math.max(0.2, buttonsHeight + 2 * padding); // ensure minimum height

    // Panel background with dynamic height
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(panelWidth, panelHeight),
      new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: 0.7
      })
    );
    this.group.add(bg);

    // Buttons, vertically centered
    const topY = (panelHeight / 2) - padding - buttonHeight / 2;
    fireableTransitions.forEach((transition, i) => {
      const button = this.createButton(
        transition.label,
        () => onFire(transition.id)
      );
      const y = topY - i * (buttonHeight + gap);
      button.position.set(0, y, 0.01);
      this.group.add(button);
    });


    
    

  }

  private createButton(label: string, onClick: () => void): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xdd6c97 })
    );

    mesh.userData['onClick'] = onClick;

    const text = this.createText(label);
    text.position.z = 0.01;
    mesh.add(text);

    return mesh;
  }

  private createText(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    ctx.fillStyle = 'black';
    ctx.font = '32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex })
    );
    sprite.scale.set(0.45, 0.1, 1);

    return sprite;
  }
}

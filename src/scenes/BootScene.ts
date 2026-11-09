import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, 'Magic Art Online', {
      fontSize: '48px',
      color: '#ffffff',
    }).setOrigin(0.5);
  }
}

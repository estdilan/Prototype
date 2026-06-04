import { Quaternion, Mesh } from '@babylonjs/core';
import { CONFIG, DEG2RAD, type ColorName } from '../config';

export class PlatformController {
  private collider: Mesh;

  private targetQ = Quaternion.Identity();
  private isReturning = false;
  private retSpeed = CONFIG.tilt.returnSpeed;

  private activeColor: ColorName | null = null;
  private activeAngle = 0;
  private holdTimer = 0;
  private holdRunning = false;

  private nextColor: ColorName | null = null;
  private nextAngle = 0;
  private nextHold = 0;
  private nextPending = false;
  private pendingSilence = false;

  onTiltStart?: (color: ColorName) => void;
  onTiltEnd?: () => void;

  constructor(collider: Mesh) {
    this.collider = collider;
  }

  trigger(color: ColorName): void {
    this.pendingSilence = false;
    this.isReturning    = false;

    const { baseDeg, incrementDeg, maxDeg, baseHoldSec, holdIncrementSec } = CONFIG.tilt;

    if (color === this.activeColor && this.holdRunning) {
      this.holdTimer = baseHoldSec;  // refrescar duración, ángulo fijo
      return;
    }

    if (color === this.nextColor && this.nextPending) {
      this.nextHold = baseHoldSec;
      return;
    }

    if (!this.holdRunning) {
      this.activeColor = color;
      this.activeAngle = baseDeg;
      this.holdTimer   = baseHoldSec;
      this.holdRunning = true;
      this.#applyTilt(color, this.activeAngle);
    } else {
      this.nextColor   = color;
      this.nextAngle   = baseDeg;
      this.nextHold    = baseHoldSec;
      this.nextPending = true;
    }

    this.onTiltStart?.(color);
  }

  silence(): void {
    if (!this.holdRunning && !this.nextPending) {
      this.#reset(CONFIG.tilt.silenceSpeed);
    } else {
      this.pendingSilence = true;
      this.nextPending    = false;
    }
    this.onTiltEnd?.();
  }

  update(dt: number): void {
    if (this.holdRunning) {
      this.holdTimer -= dt;
      if (this.holdTimer <= 0) {
        this.holdRunning = false;
        this.#onHoldEnd();
      }
    }

    const speed = this.isReturning ? this.retSpeed : CONFIG.tilt.snapSpeed;
    this.collider.rotationQuaternion = Quaternion.Slerp(
      this.collider.rotationQuaternion!,
      this.targetQ,
      Math.min(dt * speed, 1),
    );
    // disablePreStep:false causes Babylon.js to push this rotation to Cannon.js automatically.
  }

  #onHoldEnd(): void {
    this.activeColor = null;

    if (this.pendingSilence) {
      this.pendingSilence = false;
      this.nextPending    = false;
      this.#reset(CONFIG.tilt.silenceSpeed);
    } else if (this.nextPending) {
      this.nextPending   = false;
      this.activeColor   = this.nextColor!;
      this.activeAngle   = this.nextAngle;
      this.holdTimer     = this.nextHold;
      this.holdRunning   = true;
      this.#applyTilt(this.activeColor, this.activeAngle);
    } else {
      this.#reset(CONFIG.tilt.returnSpeed);
      this.onTiltEnd?.();
    }
  }

  #applyTilt(color: ColorName, deg: number): void {
    const dir = CONFIG.colorToTilt[color];
    const rad = deg * DEG2RAD;
    this.isReturning = false;
    this.targetQ = Quaternion.RotationYawPitchRoll(0, dir.x * rad, dir.z * rad);
  }

  #reset(speed: number): void {
    this.isReturning = true;
    this.retSpeed    = speed;
    this.targetQ     = Quaternion.Identity();
    this.holdRunning = false;
    this.activeColor = null;
    this.nextPending = false;
  }
}

import * as THREE from 'three';

export class CameraManager {
    constructor(camera) {
        this.camera = camera;

        // Ideal configuration offset relative to the car position
        this.baseOffset = new THREE.Vector3(0, 3.2, -8.5);
        this.lookAtOffset = new THREE.Vector3(0, 0.8, 3.0);

        // Chase responsiveness (lower = smoother/more lag)
        this.lerpSpeed = 5.5;

        // Post-effects
        this.baseFov = 60;
        this.currentFov = 60;
        this.targetFov = 60;
        
        // Vibration variables
        this.shakeStrength = 0;
        this.shakeTimer = 0;
    }

    update(vehicle, deltaTime) {
        if (!deltaTime) return;

        // 1. Calculate relative static chase target
        const carMatrix = new THREE.Matrix4().makeRotationFromQuaternion(vehicle.visualGroup.quaternion);
        
        const idealOffset = this.baseOffset.clone().applyMatrix4(carMatrix);
        const targetPosition = vehicle.visualGroup.position.clone().add(idealOffset);

        // 2. Blend actual camera position towards target (inertia/lag)
        this.camera.position.lerp(targetPosition, this.lerpSpeed * deltaTime);

        // 3. Keep target vector locked dynamically
        const idealLookAt = this.lookAtOffset.clone().applyMatrix4(carMatrix);
        const targetLookAt = vehicle.visualGroup.position.clone().add(idealLookAt);
        this.camera.lookAt(targetLookAt);

        // 4. Calculate adaptive Field of View (FOV) stretch
        const speedRatio = Math.min(vehicle.speedKmh / 150, 1.0);
        let desiredFov = this.baseFov + speedRatio * 18; // Speed stretch
        if (vehicle.isBoosting) {
            desiredFov += 12; // Extra nitro stretch
        }

        this.currentFov += (desiredFov - this.currentFov) * 6 * deltaTime;
        this.camera.fov = this.currentFov;
        this.camera.updateProjectionMatrix();

        // 5. High-Speed and Nitro Camera Shake
        this.shakeStrength = 0;
        if (vehicle.speedKmh > 70) {
            this.shakeStrength = (vehicle.speedKmh - 70) * 0.0003;
        }
        if (vehicle.isBoosting) {
            this.shakeStrength += 0.08;
        }
        if (vehicle.isDrifting) {
            this.shakeStrength += 0.03;
        }

        if (this.shakeStrength > 0) {
            this.shakeTimer += deltaTime * 45;
            this.camera.position.x += Math.sin(this.shakeTimer) * this.shakeStrength;
            this.camera.position.y += Math.cos(this.shakeTimer * 1.5) * this.shakeStrength;
        }
    }
}

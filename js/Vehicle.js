import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Vehicle {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;

        // Visual and Physical Dimensions
        this.width = 1.8;
        this.height = 0.8;
        this.length = 4.2;

        // Drive Physics Properties
        this.accelerationForce = 2200;
        this.maxSpeed = 55; // meters per second
        this.steeringSpeed = 2.5;
        this.driftTractionRatio = 0.15; // side friction while drifting
        this.normalTractionRatio = 0.95; // normal side friction
        
        // Nitro Configuration
        this.nitroCapacity = 100;
        this.nitroFuel = 100;
        this.nitroAccelerationMultiplier = 2.2;
        this.nitroMaxSpeedMultiplier = 1.4;
        this.isBoosting = false;

        // Internal State
        this.speedKmh = 0;
        this.driftScore = 0;
        this.isDrifting = false;
        
        this._buildPhysicsBody();
        this._buildVisualMesh();
    }

    _buildPhysicsBody() {
        // Create box shape for collision approximation
        const chassisShape = new CANNON.Box(new CANNON.Vec3(this.width / 2, this.height / 2, this.length / 2));
        
        this.chassisBody = new CANNON.Body({
            mass: 1400, // kg
            shape: chassisShape,
            material: new CANNON.Material({ friction: 0.1 })
        });
        
        // Offset center of mass lower to prevent excessive rollover
        this.chassisBody.shapeOffsets[0].set(0, -0.2, 0); 
        this.chassisBody.position.set(0, 3, 0);
        this.chassisBody.angularDamping = 0.85; // minimize natural aerodynamic roll oscillations
        
        this.world.addBody(this.chassisBody);
    }

    _buildVisualMesh() {
        this.visualGroup = new THREE.Group();

        // High Gloss PBR Material for Car Body (Clearcoat simulation)
        const bodyMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xff1e1e,
            metalness: 0.9,
            roughness: 0.15,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            reflectivity: 1.0
        });

        // Chassis Trim Material
        const trimMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.5,
            roughness: 0.6
        });

        // Windows Material
        const glassMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x111111,
            metalness: 0.9,
            roughness: 0.05,
            transmission: 0.6,
            transparent: true
        });

        // 1. Core Cabin / Body Block
        const bodyGeo = new THREE.BoxGeometry(this.width, this.height * 0.7, this.length);
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMaterial);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        this.visualGroup.add(bodyMesh);

        // 2. Cabin Top
        const cabinGeo = new THREE.BoxGeometry(this.width * 0.85, this.height * 0.5, this.length * 0.45);
        const cabinMesh = new THREE.Mesh(cabinGeo, glassMaterial);
        cabinMesh.position.set(0, this.height * 0.55, -0.2);
        cabinMesh.castShadow = true;
        this.visualGroup.add(cabinMesh);

        // 3. Headlights and Accent Lines
        const lightGeo = new THREE.BoxGeometry(0.3, 0.1, 0.1);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xfffca1 });
        const leftLight = new THREE.Mesh(lightGeo, lightMat);
        leftLight.position.set(this.width * 0.35, -0.1, this.length / 2);
        const rightLight = leftLight.clone();
        rightLight.position.x = -this.width * 0.35;
        this.visualGroup.add(leftLight, rightLight);

        // Add visual representation to the scene
        this.scene.add(this.visualGroup);

        // Create functional wheel pivots to capture body roll and steering visually
        this.wheels = [];
        const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.35, 24);
        wheelGeo.rotateZ(Math.PI / 2); // align cylinders with lateral axis
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });

        const wheelPositions = [
            { x: -0.95, y: -0.3, z: 1.3, steer: true },   // Front Left
            { x: 0.95, y: -0.3, z: 1.3, steer: true },    // Front Right
            { x: -0.95, y: -0.3, z: -1.3, steer: false },  // Rear Left
            { x: 0.95, y: -0.3, z: -1.3, steer: false }   // Rear Right
        ];

        wheelPositions.forEach(pos => {
            const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
            wheelMesh.castShadow = true;
            const pivot = new THREE.Group();
            pivot.position.set(pos.x, pos.y, pos.z);
            pivot.add(wheelMesh);
            this.visualGroup.add(pivot);
            this.wheels.push({ mesh: pivot, config: pos });
        });
    }

    update(input, deltaTime) {
        if (!deltaTime) return;

        // Match rotation and position from cannon physics to Three.js representation
        this.visualGroup.position.copy(this.chassisBody.position);
        this.visualGroup.quaternion.copy(this.chassisBody.quaternion);

        // Calculate dynamic coordinate direction vectors
        const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.visualGroup.quaternion);
        const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.visualGroup.quaternion);

        // Deconstruct Velocity into local components
        const currentVelocityVec = new THREE.Vector3(
            this.chassisBody.velocity.x,
            this.chassisBody.velocity.y,
            this.chassisBody.velocity.z
        );

        const speedForward = currentVelocityVec.dot(localForward);
        const speedSideways = currentVelocityVec.dot(localRight);
        
        this.speedKmh = Math.round(Math.abs(speedForward) * 3.6);

        // Steering logic (dependent on forward motion to prevent pivot pivoting static)
        let steeringFactor = Math.min(Math.abs(speedForward) / 5, 1.0); 
        if (speedForward < 0) steeringFactor *= -1; // reverse steering correction

        let steeringAngle = 0;
        if (input.keys.left) steeringAngle += this.steeringSpeed * steeringFactor;
        if (input.keys.right) steeringAngle -= this.steeringSpeed * steeringFactor;

        // Drift state computation
        this.isDrifting = input.keys.drift && Math.abs(speedForward) > 8;

        // Apply angular velocity around standard axis Y for yaw/steering rotation
        if (input.keys.left || input.keys.right) {
            this.chassisBody.angularVelocity.y = steeringAngle;
        }

        // Apply forces & boost physics
        this.isBoosting = input.keys.nitro && this.nitroFuel > 0 && input.keys.forward;
        let activeForce = this.accelerationForce;
        let activeMaxSpeed = this.maxSpeed;

        if (this.isBoosting) {
            activeForce *= this.nitroAccelerationMultiplier;
            activeMaxSpeed *= this.nitroMaxSpeedMultiplier;
            this.nitroFuel = Math.max(0, this.nitroFuel - deltaTime * 30);
        } else {
            // Re-charge nitro when drifting or normally driving
            if (this.isDrifting) {
                this.nitroFuel = Math.min(this.nitroCapacity, this.nitroFuel + deltaTime * 15);
            } else {
                this.nitroFuel = Math.min(this.nitroCapacity, this.nitroFuel + deltaTime * 2);
            }
        }

        // Forward/Reverse force application
        if (input.keys.forward && speedForward < activeMaxSpeed) {
            const f = new CANNON.Vec3(
                localForward.x * activeForce,
                localForward.y * activeForce,
                localForward.z * activeForce
            );
            this.chassisBody.applyForce(f, this.chassisBody.position);
        } else if (input.keys.backward && speedForward > -15) {
            const b = new CANNON.Vec3(
                -localForward.x * (activeForce * 0.5),
                -localForward.y * (activeForce * 0.5),
                -localForward.z * (activeForce * 0.5)
            );
            this.chassisBody.applyForce(b, this.chassisBody.position);
        }

        // --- Lateral Damping Mechanics (Simulates Grip vs Sliding) ---
        const lateralTraction = this.isDrifting ? this.driftTractionRatio : this.normalTractionRatio;
        
        // Cancel sideways component to clamp drift trajectory line
        const lateralDampingForce = -speedSideways * (1.0 - lateralTraction) * 12.0;
        const correctionVec = new CANNON.Vec3(
            localRight.x * lateralDampingForce,
            localRight.y * lateralDampingForce,
            localRight.z * lateralDampingForce
        );
        this.chassisBody.velocity.x += correctionVec.x * deltaTime;
        this.chassisBody.velocity.z += correctionVec.z * deltaTime;

        // --- Visual body roll & dynamic wheel updates ---
        this._updateWheelsAndBodyRoll(input, speedForward, speedSideways, deltaTime);
    }

    _updateWheelsAndBodyRoll(input, speedForward, speedSideways, deltaTime) {
        // Roll visual model slightly based on centrifugal lateral movement
        const maxRollAngle = 0.08; // limits extreme physics tumbling visually
        const rollTarget = -speedSideways * 0.015;
        this.visualGroup.rotation.z += (rollTarget - this.visualGroup.rotation.z) * 8 * deltaTime;
        this.visualGroup.rotation.z = Math.max(-maxRollAngle, Math.min(maxRollAngle, this.visualGroup.rotation.z));

        // Animate Wheels (steering orientation + spin rate)
        const rotationSpeed = speedForward * 0.3;
        this.wheels.forEach(wheel => {
            // Apply spin
            wheel.mesh.children[0].rotation.x += rotationSpeed;

            // Apply steering yaw pivot angle
            if (wheel.config.steer) {
                let steeringYaw = 0;
                if (input.keys.left) steeringYaw = 0.5;
                if (input.keys.right) steeringYaw = -0.5;
                wheel.mesh.rotation.y += (steeringYaw - wheel.mesh.rotation.y) * 10 * deltaTime;
            }
        });
    }
}

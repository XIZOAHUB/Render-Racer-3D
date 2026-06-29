import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Input } from './Input.js';
import { Vehicle } from './Vehicle.js';
import { Environment } from './Environment.js';
import { CameraManager } from './CameraManager.js';

export class Game {
    constructor() {
        this.clock = new THREE.Clock();
        this.physicsFrameRate = 1 / 60;
    }

    init() {
        this.container = document.getElementById('canvas-container');

        // 1. Setup Three.js Scene & Renderer
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.container.appendChild(this.renderer.domElement);

        // 2. Setup Base Projection Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 10, -20);

        // 3. Setup Cannon Physics Engine
        this.physicsWorld = new CANNON.World();
        this.physicsWorld.gravity.set(0, -18, 0); // slightly high gravity for tight arcade control

        // Ground Physics Surface
        const groundMaterial = new CANNON.Material({ friction: 0.1 });
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0, shape: groundShape, material: groundMaterial });
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.physicsWorld.addBody(groundBody);

        // 4. Initialize Core Modules
        this.input = new Input();
        this.environment = new Environment(this.scene);
        this.vehicle = new Vehicle(this.scene, this.physicsWorld);
        this.cameraManager = new CameraManager(this.camera);

        // 5. Connect HUD Elements
        this.hudSpeed = document.getElementById('speed-val');
        this.hudNitro = document.getElementById('nitro-fill');

        // Handle dynamic viewport sizing
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Kickoff Render Frame Loop
        this.animate();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const deltaTime = Math.min(this.clock.getDelta(), 0.1); // clamp delta to prevent giant steps

        // Step Physics Engine
        this.physicsWorld.step(this.physicsFrameRate, deltaTime, 3);

        // Update Car Entity
        this.vehicle.update(this.input, deltaTime);

        // Update Dynamic Camera Track
        this.cameraManager.update(this.vehicle, deltaTime);

        // Synchronize and Update HUD indicators
        this.updateHUD();

        // Render Scene Viewport
        this.renderer.render(this.scene, this.camera);
    }

    updateHUD() {
        this.hudSpeed.textContent = this.vehicle.speedKmh;
        
        const nitroPercent = (this.vehicle.nitroFuel / this.vehicle.nitroCapacity) * 100;
        this.hudNitro.style.width = `${nitroPercent}%`;
    }
}

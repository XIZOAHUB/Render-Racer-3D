import * as THREE from 'three';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this._initLighting();
        this._initRoadAndCity();
    }

    _initLighting() {
        // High Quality Directional Daylight
        this.sun = new THREE.DirectionalLight(0xffffff, 1.8);
        this.sun.position.set(100, 150, 50);
        this.sun.castShadow = true;
        
        // Optimizing Shadow Resolution
        this.sun.shadow.mapSize.width = 2048;
        this.sun.shadow.mapSize.height = 2048;
        this.sun.shadow.camera.near = 0.5;
        this.sun.shadow.camera.far = 400;
        
        const d = 150;
        this.sun.shadow.camera.left = -d;
        this.sun.shadow.camera.right = d;
        this.sun.shadow.camera.top = d;
        this.sun.shadow.camera.bottom = -d;
        this.sun.shadow.bias = -0.0005;

        this.scene.add(this.sun);

        // Ambient Light
        const ambient = new THREE.AmbientLight(0xdff0ff, 0.45);
        this.scene.add(ambient);

        // Fog for cinematic horizon depth
        this.scene.fog = new THREE.FogExp2(0x101216, 0.0035);
    }

    _initRoadAndCity() {
        // Generate a high-detail procedural noise pattern on canvas for PBR asphalt simulation
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Base dark grey
        ctx.fillStyle = '#242426';
        ctx.fillRect(0, 0, 512, 512);

        // Procedural micro-grain noise (representing gravel composition)
        for (let i = 0; i < 60000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const size = Math.random() * 1.5;
            const luminance = Math.floor(Math.random() * 40) + 10;
            ctx.fillStyle = `rgb(${luminance}, ${luminance}, ${luminance})`;
            ctx.fillRect(x, y, size, size);
        }

        const asphaltTexture = new THREE.CanvasTexture(canvas);
        asphaltTexture.wrapS = THREE.RepeatWrapping;
        asphaltTexture.wrapT = THREE.RepeatWrapping;
        asphaltTexture.repeat.set(50, 500);

        // Create secondary micro-bump texture canvas for normal mapping
        const normalCanvas = document.createElement('canvas');
        normalCanvas.width = 512;
        normalCanvas.height = 512;
        const nCtx = normalCanvas.getContext('2d');
        nCtx.fillStyle = '#8080ff'; // flat purple normal base
        nCtx.fillRect(0, 0, 512, 512);

        // Micro-bumps representation
        for (let i = 0; i < 40000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const r = Math.floor(Math.random() * 60) + 98; // directional variation maps
            const g = Math.floor(Math.random() * 60) + 98;
            nCtx.fillStyle = `rgb(${r}, ${g}, 255)`;
            nCtx.fillRect(x, y, 1, 1);
        }

        const asphaltNormal = new THREE.CanvasTexture(normalCanvas);
        asphaltNormal.wrapS = THREE.RepeatWrapping;
        asphaltNormal.wrapT = THREE.RepeatWrapping;
        asphaltNormal.repeat.set(50, 500);

        // PBR Road Material Setup
        const roadMat = new THREE.MeshStandardMaterial({
            map: asphaltTexture,
            normalMap: asphaltNormal,
            normalScale: new THREE.Vector2(0.35, 0.35),
            roughness: 0.85,
            metalness: 0.05
        });

        // Track Plane Configuration (Straight Drag/Drift Highway Strip)
        const trackGeo = new THREE.PlaneGeometry(80, 2000);
        const road = new THREE.Mesh(trackGeo, roadMat);
        road.rotation.x = -Math.PI / 2;
        road.position.set(0, 0, -850);
        road.receiveShadow = true;
        this.scene.add(road);

        // Sidewalk curbs (Left and Right)
        const curbMat = new THREE.MeshStandardMaterial({ color: 0x55555a, roughness: 0.9 });
        const curbGeo = new THREE.BoxGeometry(4, 0.4, 2000);
        
        const leftCurb = new THREE.Mesh(curbGeo, curbMat);
        leftCurb.position.set(-42, 0.1, -850);
        leftCurb.receiveShadow = true;
        leftCurb.castShadow = true;
        this.scene.add(leftCurb);

        const rightCurb = leftCurb.clone();
        rightCurb.position.x = 42;
        this.scene.add(rightCurb);

        this._generateProceduralBuildings();
    }

    _generateProceduralBuildings() {
        // Distribute concrete-style block buildings along the highway sides
        const buildingMat = new THREE.MeshStandardMaterial({
            color: 0x1f2124,
            roughness: 0.7,
            metalness: 0.2
        });

        const windowMat = new THREE.MeshBasicMaterial({ color: 0xfffba8 });

        // Instantiate structural boundaries
        for (let z = -1800; z < 200; z += 120) {
            // Alternating layouts along left/right margins
            const leftHeight = 40 + Math.random() * 90;
            const rightHeight = 40 + Math.random() * 90;
            const leftWidth = 25 + Math.random() * 20;
            const rightWidth = 25 + Math.random() * 20;

            // Left Skyscraper block
            const leftGeo = new THREE.BoxGeometry(leftWidth, leftHeight, 60);
            const bLeft = new THREE.Mesh(leftGeo, buildingMat);
            bLeft.position.set(-80 - leftWidth/2, leftHeight/2, z);
            bLeft.castShadow = true;
            bLeft.receiveShadow = true;
            this.scene.add(bLeft);

            // Right Skyscraper block
            const rightGeo = new THREE.BoxGeometry(rightWidth, rightHeight, 60);
            const bRight = new THREE.Mesh(rightGeo, buildingMat);
            bRight.position.set(80 + rightWidth/2, rightHeight/2, z);
            bRight.castShadow = true;
            bRight.receiveShadow = true;
            this.scene.add(bRight);
            
            // Generate illuminated window elements for realism
            this._addWindowPanels(bLeft, leftWidth, leftHeight, 60);
            this._addWindowPanels(bRight, rightWidth, rightHeight, 60);
        }
    }

    _addWindowPanels(buildingMesh, w, h, d) {
        // Approximate lit panels on buildings using sparse placement
        if (h < 50) return;
        const group = new THREE.Group();
        const winGeo = new THREE.PlaneGeometry(1.2, 2.0);
        const winMat = new THREE.MeshBasicMaterial({ color: 0xfffbbf });

        for (let xOff = -w/3; xOff <= w/3; xOff += 8) {
            for (let yOff = -h/3; yOff <= h/3; yOff += 12) {
                if (Math.random() > 0.4) { // keep windows organic
                    const plane = new THREE.Mesh(winGeo, winMat);
                    plane.position.set(xOff, yOff, d/2 + 0.1);
                    group.add(plane);
                }
            }
        }
        group.position.copy(buildingMesh.position);
        this.scene.add(group);
    }
}

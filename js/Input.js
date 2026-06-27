export class Input {
    constructor() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            drift: false,
            nitro: false
        };

        this._initListeners();
    }

    _initListeners() {
        window.addEventListener('keydown', (e) => this._onKeyDown(e), false);
        window.addEventListener('keyup', (e) => this._onKeyUp(e), false);
    }

    _onKeyDown(e) {
        switch (e.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = true;
                break;
            case 'Space':
                this.keys.drift = true;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.nitro = true;
                break;
        }
    }

    _onKeyUp(e) {
        switch (e.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.backward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.keys.left = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.keys.right = false;
                break;
            case 'Space':
                this.keys.drift = false;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.nitro = false;
                break;
        }
    }
}

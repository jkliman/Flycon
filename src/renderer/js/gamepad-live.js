/**
 * Live Gamepad Input Handler
 * Uses the Web Gamepad API to read live controller input
 */

class GamepadLiveInput {
  constructor() {
    this.gamepads = {};
    this.activeGamepad = null;
    this.listeners = [];
    this.animationFrameId = null;
    this.isPolling = false;

    this.init();
  }

  init() {
    window.addEventListener('gamepadconnected', (e) => this.onGamepadConnected(e));
    window.addEventListener('gamepaddisconnected', (e) => this.onGamepadDisconnected(e));

    // Check for already connected gamepads
    this.scanGamepads();
  }

  onGamepadConnected(event) {
    console.log('Gamepad connected:', event.gamepad.id);
    this.gamepads[event.gamepad.index] = event.gamepad;

    if (!this.activeGamepad) {
      this.activeGamepad = event.gamepad.index;
    }

    this.notifyListeners('connected', {
      index: event.gamepad.index,
      id: event.gamepad.id,
      mapping: event.gamepad.mapping
    });

    if (!this.isPolling) {
      this.startPolling();
    }
  }

  onGamepadDisconnected(event) {
    console.log('Gamepad disconnected:', event.gamepad.id);
    delete this.gamepads[event.gamepad.index];

    if (this.activeGamepad === event.gamepad.index) {
      const remaining = Object.keys(this.gamepads);
      this.activeGamepad = remaining.length > 0 ? parseInt(remaining[0]) : null;
    }

    this.notifyListeners('disconnected', {
      index: event.gamepad.index
    });

    if (Object.keys(this.gamepads).length === 0) {
      this.stopPolling();
    }
  }

  scanGamepads() {
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        this.gamepads[gamepads[i].index] = gamepads[i];
        if (this.activeGamepad === null) {
          this.activeGamepad = gamepads[i].index;
        }
      }
    }

    if (Object.keys(this.gamepads).length > 0 && !this.isPolling) {
      this.startPolling();
    }
  }

  startPolling() {
    this.isPolling = true;
    this.poll();
  }

  stopPolling() {
    this.isPolling = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  poll() {
    if (!this.isPolling) return;

    // Refresh gamepad state (required in Chrome)
    const gamepads = navigator.getGamepads();

    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        this.gamepads[gamepads[i].index] = gamepads[i];
      }
    }

    // Get active gamepad state
    if (this.activeGamepad !== null && this.gamepads[this.activeGamepad]) {
      const gp = this.gamepads[this.activeGamepad];

      this.notifyListeners('input', {
        index: gp.index,
        id: gp.id,
        buttons: gp.buttons.map((b, i) => ({
          index: i,
          pressed: b.pressed,
          touched: b.touched,
          value: b.value
        })),
        axes: gp.axes.map((value, i) => ({
          index: i,
          value: value
        }))
      });
    }

    this.animationFrameId = requestAnimationFrame(() => this.poll());
  }

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners(event, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (e) {
        console.error('Listener error:', e);
      }
    });
  }

  getActiveGamepad() {
    if (this.activeGamepad !== null) {
      return this.gamepads[this.activeGamepad];
    }
    return null;
  }

  getConnectedGamepads() {
    return Object.values(this.gamepads).map(gp => ({
      index: gp.index,
      id: gp.id,
      mapping: gp.mapping
    }));
  }

  setActiveGamepad(index) {
    if (this.gamepads[index]) {
      this.activeGamepad = index;
      return true;
    }
    return false;
  }

  destroy() {
    this.stopPolling();
    this.listeners = [];
  }
}

// Export singleton instance
window.GamepadLiveInput = GamepadLiveInput;

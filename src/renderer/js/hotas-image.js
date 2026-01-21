/**
 * Image-Based HOTAS Visualizer
 * Uses actual controller images with interactive hotspot overlays
 */

class HOTASImageVisualizer {
  constructor(container, parser) {
    this.container = container;
    this.parser = parser;
    this.activeDevice = 'x56-throttle'; // 'x56-throttle', 'x56-stick', 'vkb-left', 'vkb-right', 'ab9'
    this.selectedButton = null;
    this.buttonElements = {};
    this.highlightImages = {}; // For image-based highlights
    this.liveInput = null;
    this.bindingContextMenu = null; // Context menu for binding actions
    this.customBindings = {}; // Store custom bindings

    // Mode switching for X56 HOTAS
    this.currentMode = 'm1'; // 'm1', 'm2', 's1' (no default mode)
    this.modeModifiers = {
      'm1': 'lctrl',  // Ctrl
      'm2': 'lalt',   // Alt
      's1': 'lshift'  // Shift
    };
    // Controls that are excluded from mode switching (always use default binding)
    this.modeExcludedControls = [
      'x56_js_trigger',      // Trigger (2-stage)
      'x56_js_missile_btn',  // Missile button
      'x56_js_thumbstick',   // Thumbstick (axis)
      'x56_th_throttle_left',  // Left throttle axis
      'x56_th_throttle_right', // Right throttle axis
      'x56_th_rty3',         // Rotary 3 axis
      'x56_th_rty4',         // Rotary 4 axis
      'x56_th_top_knob',     // Top rotary knob
      'x56_th_bottom_knob',  // Bottom rotary knob
      // X52 excluded controls
      'x52_js_trigger',      // Trigger
      'x52_js_fire',         // Fire/Missile button
      'x52_th_rt1',          // RT1 Rotary axis
      'x52_th_rt2'           // RT2 Rotary axis
    ];

    // X52 Mode switching (Mode 1, Mode 2, Mode 3)
    this.x52CurrentMode = 'mode1'; // 'mode1', 'mode2', 'mode3'
    this.x52ModeModifiers = {
      'mode1': 'lctrl',   // Ctrl
      'mode2': 'lalt',    // Alt
      'mode3': 'lshift'   // Shift
    };

    // Debug mode for editing hotspot positions
    this.debugMode = false;
    this.debugSelectedHotspot = null;
    this.debugDragging = false;
    this.debugResizing = false;
    this.debugDragOffset = { x: 0, y: 0 };

    // Debug panel dragging
    this.debugPanelDragging = false;
    this.debugPanelOffset = { x: 0, y: 0 };

    // Button mapping configuration wizard
    this.buttonMappingWizard = {
      active: false,
      currentStep: 0,
      steps: [],
      detectedButton: null,
      lastPressedButtons: new Set()
    };

    // Loaded button mappings (physical button index -> hotspot ID)
    this.buttonMappings = {};
    this.loadButtonMappings();

    this.loadCustomBindings();
    this.init();
    this.setupDebugKeyboardShortcut();
  }

  // Setup keyboard shortcut for debug mode (Ctrl+Shift+D)
  setupDebugKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.toggleDebugMode();
      }
    });
  }

  // Toggle debug mode for hotspot editing
  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    console.log('Debug mode:', this.debugMode ? 'ENABLED' : 'DISABLED');

    if (this.debugMode) {
      this.enableDebugMode();
    } else {
      this.disableDebugMode();
    }

    return this.debugMode;
  }

  enableDebugMode() {
    // Add debug class to container
    this.container.classList.add('debug-mode');

    // Create debug panel if it doesn't exist
    this.createDebugPanel();

    // Make all hotspots draggable and resizable
    Object.values(this.buttonElements).forEach(hotspot => {
      this.makeHotspotEditable(hotspot);
    });

    // Add global mouse event listeners for dragging
    this.debugMouseMove = (e) => this.handleDebugMouseMove(e);
    this.debugMouseUp = (e) => this.handleDebugMouseUp(e);
    document.addEventListener('mousemove', this.debugMouseMove);
    document.addEventListener('mouseup', this.debugMouseUp);
  }

  disableDebugMode() {
    // Remove debug class
    this.container.classList.remove('debug-mode');

    // Remove debug panel
    const panel = document.getElementById('hotspot-debug-panel');
    if (panel) panel.remove();

    // Remove resize handles from hotspots and clean up event handlers
    Object.values(this.buttonElements).forEach(hotspot => {
      const handle = hotspot.querySelector('.resize-handle');
      if (handle) handle.remove();
      hotspot.classList.remove('debug-editable', 'debug-selected');

      // Remove the debug mousedown handler
      if (hotspot._debugMouseDownHandler) {
        hotspot.removeEventListener('mousedown', hotspot._debugMouseDownHandler, true);
        delete hotspot._debugMouseDownHandler;
      }
    });

    // Remove event listeners
    if (this.debugMouseMove) {
      document.removeEventListener('mousemove', this.debugMouseMove);
      document.removeEventListener('mouseup', this.debugMouseUp);
    }

    // Remove panel drag event listeners
    if (this.debugPanelMouseMove) {
      document.removeEventListener('mousemove', this.debugPanelMouseMove);
      document.removeEventListener('mouseup', this.debugPanelMouseUp);
    }

    this.debugSelectedHotspot = null;
    this.debugPanelDragging = false;
  }

  createDebugPanel() {
    // Remove existing panel if any
    const existing = document.getElementById('hotspot-debug-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'hotspot-debug-panel';
    panel.className = 'hotspot-debug-panel';
    panel.innerHTML = `
      <div class="debug-panel-header">
        <h3>Hotspot Debug Mode</h3>
        <button class="debug-close-btn" id="debug-close-btn">&times;</button>
      </div>
      <div class="debug-panel-content">
        <div class="debug-info">
          <p>Click a hotspot to select it, then drag to move or use the corner handle to resize.</p>
        </div>
        <div class="debug-selected-info" id="debug-selected-info">
          <p class="no-selection">No hotspot selected</p>
        </div>
        <div class="debug-controls" id="debug-controls" style="display: none;">
          <div class="debug-input-group">
            <label>X (%)</label>
            <input type="number" id="debug-x" step="0.5" min="0" max="100">
          </div>
          <div class="debug-input-group">
            <label>Y (%)</label>
            <input type="number" id="debug-y" step="0.5" min="0" max="100">
          </div>
          <div class="debug-input-group">
            <label>Width (%)</label>
            <input type="number" id="debug-w" step="0.5" min="1" max="100">
          </div>
          <div class="debug-input-group">
            <label>Height (%)</label>
            <input type="number" id="debug-h" step="0.5" min="1" max="100">
          </div>
          <button class="debug-apply-btn" id="debug-apply-btn">Apply</button>
        </div>
        <div class="debug-output">
          <h4>All Hotspots Config:</h4>
          <button class="debug-copy-btn" id="debug-copy-all">Copy All</button>
          <pre id="debug-output-code"></pre>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Setup panel dragging on header
    const header = panel.querySelector('.debug-panel-header');
    header.style.cursor = 'move';

    header.addEventListener('mousedown', (e) => {
      // Don't drag if clicking the close button
      if (e.target.id === 'debug-close-btn') return;

      this.debugPanelDragging = true;
      const panelRect = panel.getBoundingClientRect();
      this.debugPanelOffset = {
        x: e.clientX - panelRect.left,
        y: e.clientY - panelRect.top
      };
      e.preventDefault();
    });

    // Panel drag move handler
    this.debugPanelMouseMove = (e) => {
      if (!this.debugPanelDragging) return;

      const newX = e.clientX - this.debugPanelOffset.x;
      const newY = e.clientY - this.debugPanelOffset.y;

      // Keep panel within viewport bounds
      const panelRect = panel.getBoundingClientRect();
      const maxX = window.innerWidth - panelRect.width;
      const maxY = window.innerHeight - panelRect.height;

      panel.style.left = `${Math.max(0, Math.min(maxX, newX))}px`;
      panel.style.top = `${Math.max(0, Math.min(maxY, newY))}px`;
      panel.style.right = 'auto';
    };

    // Panel drag end handler
    this.debugPanelMouseUp = () => {
      this.debugPanelDragging = false;
    };

    document.addEventListener('mousemove', this.debugPanelMouseMove);
    document.addEventListener('mouseup', this.debugPanelMouseUp);

    // Setup panel event listeners
    document.getElementById('debug-close-btn').addEventListener('click', () => {
      this.toggleDebugMode();
    });

    document.getElementById('debug-apply-btn').addEventListener('click', () => {
      this.applyDebugValues();
    });

    document.getElementById('debug-copy-all').addEventListener('click', () => {
      this.copyAllHotspotsConfig();
    });

    // Input change listeners
    ['debug-x', 'debug-y', 'debug-w', 'debug-h'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        this.applyDebugValues();
      });
    });

    // Generate initial config output
    this.updateDebugOutput();
  }

  makeHotspotEditable(hotspot) {
    hotspot.classList.add('debug-editable');

    // Add resize handle if not already present
    if (!hotspot.querySelector('.resize-handle')) {
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      hotspot.appendChild(handle);
    }

    // Store the debug mousedown handler reference so we can prioritize it
    const debugMouseDownHandler = (e) => {
      if (!this.debugMode) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // Stop other handlers from firing

      // Check if clicking resize handle
      if (e.target.classList.contains('resize-handle')) {
        this.debugResizing = true;
        this.debugSelectedHotspot = hotspot;
      } else {
        this.debugDragging = true;
        this.debugSelectedHotspot = hotspot;

        // Calculate drag offset
        const rect = hotspot.getBoundingClientRect();
        this.debugDragOffset = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
      }

      // Update selection visual
      Object.values(this.buttonElements).forEach(h => h.classList.remove('debug-selected'));
      hotspot.classList.add('debug-selected');

      // Update debug panel
      this.updateDebugPanel(hotspot);
    };

    // Add the debug handler with capture to run before other handlers
    hotspot.addEventListener('mousedown', debugMouseDownHandler, true);

    // Store reference for cleanup
    hotspot._debugMouseDownHandler = debugMouseDownHandler;
  }

  handleDebugMouseMove(e) {
    if (!this.debugSelectedHotspot) return;

    const container = this.debugSelectedHotspot.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    if (this.debugDragging) {
      // Calculate new position as percentage
      const newX = ((e.clientX - containerRect.left - this.debugDragOffset.x) / containerRect.width) * 100;
      const newY = ((e.clientY - containerRect.top - this.debugDragOffset.y) / containerRect.height) * 100;

      // Clamp values
      const clampedX = Math.max(0, Math.min(100 - parseFloat(this.debugSelectedHotspot.style.width), newX));
      const clampedY = Math.max(0, Math.min(100 - parseFloat(this.debugSelectedHotspot.style.height), newY));

      this.debugSelectedHotspot.style.left = `${clampedX}%`;
      this.debugSelectedHotspot.style.top = `${clampedY}%`;

      this.updateDebugPanel(this.debugSelectedHotspot);
    } else if (this.debugResizing) {
      // Calculate new size
      const hotspotRect = this.debugSelectedHotspot.getBoundingClientRect();
      const newW = ((e.clientX - hotspotRect.left) / containerRect.width) * 100;
      const newH = ((e.clientY - hotspotRect.top) / containerRect.height) * 100;

      // Clamp values (minimum 2%, maximum to edge)
      const clampedW = Math.max(2, Math.min(100 - parseFloat(this.debugSelectedHotspot.style.left), newW));
      const clampedH = Math.max(2, Math.min(100 - parseFloat(this.debugSelectedHotspot.style.top), newH));

      this.debugSelectedHotspot.style.width = `${clampedW}%`;
      this.debugSelectedHotspot.style.height = `${clampedH}%`;

      this.updateDebugPanel(this.debugSelectedHotspot);
    }
  }

  handleDebugMouseUp(e) {
    if (this.debugDragging || this.debugResizing) {
      this.updateDebugOutput();
    }
    this.debugDragging = false;
    this.debugResizing = false;
  }

  updateDebugPanel(hotspot) {
    const infoDiv = document.getElementById('debug-selected-info');
    const controlsDiv = document.getElementById('debug-controls');

    if (!hotspot) {
      infoDiv.innerHTML = '<p class="no-selection">No hotspot selected</p>';
      controlsDiv.style.display = 'none';
      return;
    }

    const buttonId = hotspot.dataset.button;
    const label = hotspot.dataset.label || buttonId;
    const x = parseFloat(hotspot.style.left) || 0;
    const y = parseFloat(hotspot.style.top) || 0;
    const w = parseFloat(hotspot.style.width) || 10;
    const h = parseFloat(hotspot.style.height) || 10;

    infoDiv.innerHTML = `
      <p><strong>ID:</strong> ${buttonId}</p>
      <p><strong>Label:</strong> ${label}</p>
    `;

    controlsDiv.style.display = 'block';
    document.getElementById('debug-x').value = x.toFixed(1);
    document.getElementById('debug-y').value = y.toFixed(1);
    document.getElementById('debug-w').value = w.toFixed(1);
    document.getElementById('debug-h').value = h.toFixed(1);
  }

  applyDebugValues() {
    if (!this.debugSelectedHotspot) return;

    const x = parseFloat(document.getElementById('debug-x').value) || 0;
    const y = parseFloat(document.getElementById('debug-y').value) || 0;
    const w = parseFloat(document.getElementById('debug-w').value) || 10;
    const h = parseFloat(document.getElementById('debug-h').value) || 10;

    this.debugSelectedHotspot.style.left = `${x}%`;
    this.debugSelectedHotspot.style.top = `${y}%`;
    this.debugSelectedHotspot.style.width = `${w}%`;
    this.debugSelectedHotspot.style.height = `${h}%`;

    this.updateDebugOutput();
  }

  updateDebugOutput() {
    const outputEl = document.getElementById('debug-output-code');
    if (!outputEl) return;

    // Generate hotspots config for current device
    const hotspots = [];
    Object.entries(this.buttonElements).forEach(([id, el]) => {
      const x = parseFloat(el.style.left) || 0;
      const y = parseFloat(el.style.top) || 0;
      const w = parseFloat(el.style.width) || 10;
      const h = parseFloat(el.style.height) || 10;

      // Extract the ID without device prefix
      const shortId = id.replace(/^(yoke_|throttle_|ab9_|x56_th_|x56_st_|vkb_left_|vkb_right_)/, '');

      hotspots.push({
        id: shortId,
        label: el.dataset.label || shortId,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        w: Math.round(w * 10) / 10,
        h: Math.round(h * 10) / 10,
        type: el.dataset.type || 'button',
        highlightId: el.dataset.highlightId || null
      });
    });

    // Format as JavaScript array
    let code = 'const hotspots = [\n';
    hotspots.forEach((hs, i) => {
      const highlightStr = hs.highlightId ? `'${hs.highlightId}'` : 'null';
      code += `  { id: '${hs.id}', label: '${hs.label}', x: ${hs.x}, y: ${hs.y}, w: ${hs.w}, h: ${hs.h}, type: '${hs.type}', highlightId: ${highlightStr} }`;
      code += i < hotspots.length - 1 ? ',\n' : '\n';
    });
    code += '];';

    outputEl.textContent = code;
  }

  copyAllHotspotsConfig() {
    const outputEl = document.getElementById('debug-output-code');
    if (!outputEl) return;

    navigator.clipboard.writeText(outputEl.textContent).then(() => {
      const btn = document.getElementById('debug-copy-all');
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('copied');
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  setActiveDevice(deviceId) {
    if (this.activeDevice !== deviceId) {
      this.activeDevice = deviceId;
      this.render();
    }
  }

  loadCustomBindings() {
    try {
      // Try to load from the primary key (used by binding context menu)
      let saved = localStorage.getItem('sccm_hotas_bindings');
      // Fallback to legacy key if primary doesn't exist
      if (!saved) {
        saved = localStorage.getItem('sccm_custom_bindings');
      }
      if (saved) {
        this.customBindings = JSON.parse(saved);
        console.log('Loaded custom bindings:', this.customBindings);
      }
    } catch (e) {
      console.error('Failed to load custom bindings:', e);
      this.customBindings = {};
    }
  }

  saveCustomBindings() {
    try {
      // Save to both keys for compatibility
      localStorage.setItem('sccm_hotas_bindings', JSON.stringify(this.customBindings));
      localStorage.setItem('sccm_custom_bindings', JSON.stringify(this.customBindings));
      console.log('Saved custom bindings:', this.customBindings);
    } catch (e) {
      console.error('Failed to save custom bindings:', e);
    }
  }

  // Mode switching methods
  isModeSensitiveControl(buttonId) {
    // Check if this control supports mode switching
    // Returns false for excluded controls (axes, trigger, missile)
    return !this.modeExcludedControls.some(excluded => buttonId.startsWith(excluded));
  }

  setMode(mode) {
    if (mode === this.currentMode) return;

    const validModes = ['m1', 'm2', 's1'];
    if (!validModes.includes(mode)) {
      console.warn('Invalid mode:', mode);
      return;
    }

    console.log('Switching mode from', this.currentMode, 'to', mode);
    this.currentMode = mode;

    // Update binding context menu with current mode
    if (this.bindingContextMenu) {
      this.bindingContextMenu.currentMode = mode;
    }

    // Update mode selector UI
    this.updateModeSelectorUI();

    // Update binding highlights to show current mode's bindings
    this.updateBindingHighlights();
    this.updateSidebarBindingsList();
  }

  updateModeSelectorUI() {
    // Update mode buttons to show active state across ALL mode panels (linked)
    const modeButtons = document.querySelectorAll('.x56-mode-panel .mode-btn');
    modeButtons.forEach(btn => {
      const btnMode = btn.dataset.mode;
      btn.classList.toggle('active', btnMode === this.currentMode);
    });

    // Update ALL mode indicator texts (for linked panels)
    const modeIndicators = document.querySelectorAll('.x56-mode-panel .mode-current-label');
    modeIndicators.forEach(modeIndicator => {
      const modifier = this.modeModifiers[this.currentMode];
      const modifierName = modifier === 'lctrl' ? 'Ctrl' : modifier === 'lalt' ? 'Alt' : 'Shift';
      modeIndicator.textContent = `${this.currentMode.toUpperCase()} (${modifierName})`;
    });
  }

  getBindingKeyForCurrentMode(baseKey) {
    // Get the binding key based on current mode
    // For mode-excluded controls, always return the base key (no mode prefix)
    const buttonId = baseKey.split('_').slice(0, -1).join('_'); // Remove direction suffix

    if (!this.isModeSensitiveControl(buttonId)) {
      return baseKey; // Use default binding for excluded controls
    }

    // Always use mode prefix for mode-sensitive controls
    return `${this.currentMode}_${baseKey}`;
  }

  getBindingsForCurrentMode() {
    // Get all bindings that apply to the current mode
    const bindings = {};

    for (const [key, value] of Object.entries(this.customBindings)) {
      // Check if this is a mode-prefixed binding
      const modeMatch = key.match(/^(m1|m2|s1)_(.+)$/);

      if (modeMatch) {
        const [, bindingMode, baseKey] = modeMatch;
        // Only include if it matches current mode
        if (bindingMode === this.currentMode) {
          bindings[baseKey] = value;
        }
      } else {
        // Non-mode binding - only for excluded controls (trigger, missile, axes)
        const buttonId = key.split('_').slice(0, -1).join('_');
        if (!this.isModeSensitiveControl(buttonId)) {
          bindings[key] = value;
        }
      }
    }

    return bindings;
  }

  renderModeSelector() {
    const panel = document.createElement('div');
    panel.className = 'x56-mode-panel';
    panel.innerHTML = `
      <div class="mode-header">
        <span class="mode-title">MODE SWITCH</span>
        <span class="mode-current-label">${this.currentMode === 'm1' ? 'M1 (Ctrl)' : this.currentMode === 'm2' ? 'M2 (Alt)' : 'S1 (Shift)'}</span>
      </div>
      <div class="mode-dial">
        <button class="mode-btn mode-m1 ${this.currentMode === 'm1' ? 'active' : ''}" data-mode="m1" title="M1 Mode (Ctrl Modifier)">
          <span class="mode-label">M1</span>
        </button>
        <button class="mode-btn mode-m2 ${this.currentMode === 'm2' ? 'active' : ''}" data-mode="m2" title="M2 Mode (Alt Modifier)">
          <span class="mode-label">M2</span>
        </button>
        <button class="mode-btn mode-s1 ${this.currentMode === 's1' ? 'active' : ''}" data-mode="s1" title="S1 Mode (Shift Modifier)">
          <span class="mode-label">S1</span>
        </button>
      </div>
      <div class="mode-info">
        <div class="mode-legend">
          <span class="legend-item legend-m1"><span class="legend-dot"></span>M1 = Ctrl</span>
          <span class="legend-item legend-m2"><span class="legend-dot"></span>M2 = Alt</span>
          <span class="legend-item legend-s1"><span class="legend-dot"></span>S1 = Shift</span>
        </div>
        <p class="mode-note">Modes allow different bindings per button. Trigger, Missile, and Axes are not affected by modes.</p>
      </div>
    `;

    // Add click handlers for mode buttons
    panel.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setMode(btn.dataset.mode);
      });
    });

    return panel;
  }

  // ==================== X52 MODE SWITCHING ====================

  setX52Mode(mode) {
    if (mode === this.x52CurrentMode) return;

    const validModes = ['mode1', 'mode2', 'mode3'];
    if (!validModes.includes(mode)) {
      console.warn('Invalid X52 mode:', mode);
      return;
    }

    console.log('Switching X52 mode from', this.x52CurrentMode, 'to', mode);
    this.x52CurrentMode = mode;

    // Update binding context menu with current X52 mode
    if (this.bindingContextMenu) {
      this.bindingContextMenu.x52CurrentMode = mode;
    }

    // Update mode selector UI
    this.updateX52ModeSelectorUI();

    // Update binding highlights to show current mode's bindings
    this.updateBindingHighlights();
    this.updateSidebarBindingsList();
  }

  updateX52ModeSelectorUI() {
    // Update mode buttons to show active state
    const modeButtons = document.querySelectorAll('.x52-mode-panel .mode-btn');
    modeButtons.forEach(btn => {
      const btnMode = btn.dataset.mode;
      btn.classList.toggle('active', btnMode === this.x52CurrentMode);
    });

    // Update mode indicator text
    const modeIndicator = document.querySelector('.x52-mode-panel .mode-current-label');
    if (modeIndicator) {
      const modifier = this.x52ModeModifiers[this.x52CurrentMode];
      const modifierName = modifier === 'lctrl' ? 'Ctrl' : modifier === 'lalt' ? 'Alt' : 'Shift';
      const modeNum = this.x52CurrentMode.replace('mode', '');
      modeIndicator.textContent = `Mode ${modeNum} (${modifierName})`;
    }
  }

  getX52BindingKeyForCurrentMode(baseKey) {
    // Get the binding key based on current X52 mode
    // For mode-excluded controls, always return the base key (no mode prefix)
    const buttonId = baseKey.split('_').slice(0, -1).join('_'); // Remove direction suffix

    if (!this.isModeSensitiveControl(buttonId)) {
      return baseKey; // Use default binding for excluded controls
    }

    // Always use mode prefix for mode-sensitive controls
    return `${this.x52CurrentMode}_${baseKey}`;
  }

  renderX52ModeSelector() {
    const panel = document.createElement('div');
    panel.className = 'x52-mode-panel';
    const modeNum = this.x52CurrentMode.replace('mode', '');
    const modifier = this.x52ModeModifiers[this.x52CurrentMode];
    const modifierName = modifier === 'lctrl' ? 'Ctrl' : modifier === 'lalt' ? 'Alt' : 'Shift';

    panel.innerHTML = `
      <div class="mode-header">
        <span class="mode-title">MODE SWITCH</span>
        <span class="mode-current-label">Mode ${modeNum} (${modifierName})</span>
      </div>
      <div class="mode-dial">
        <button class="mode-btn x52-mode1 ${this.x52CurrentMode === 'mode1' ? 'active' : ''}" data-mode="mode1" title="Mode 1 (Ctrl Modifier)">
          <span class="mode-label">1</span>
        </button>
        <button class="mode-btn x52-mode2 ${this.x52CurrentMode === 'mode2' ? 'active' : ''}" data-mode="mode2" title="Mode 2 (Alt Modifier)">
          <span class="mode-label">2</span>
        </button>
        <button class="mode-btn x52-mode3 ${this.x52CurrentMode === 'mode3' ? 'active' : ''}" data-mode="mode3" title="Mode 3 (Shift Modifier)">
          <span class="mode-label">3</span>
        </button>
      </div>
      <div class="mode-info">
        <div class="mode-legend">
          <span class="legend-item legend-x52-mode1"><span class="legend-dot"></span>Mode 1 = Ctrl</span>
          <span class="legend-item legend-x52-mode2"><span class="legend-dot"></span>Mode 2 = Alt</span>
          <span class="legend-item legend-x52-mode3"><span class="legend-dot"></span>Mode 3 = Shift</span>
        </div>
        <p class="mode-note">Modes allow different bindings per button. Trigger, Fire, and Rotaries are not affected by modes.</p>
      </div>
    `;

    // Add click handlers for mode buttons
    panel.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setX52Mode(btn.dataset.mode);
      });
    });

    return panel;
  }

  init() {
    // Try to use existing gamepad live input or create new
    if (window.gamepadLiveInput) {
      this.liveInput = window.gamepadLiveInput;
    } else {
      this.liveInput = new GamepadLiveInput();
      window.gamepadLiveInput = this.liveInput;
    }

    this.liveInput.addListener((event, data) => this.handleInput(event, data));

    // Initialize binding context menu for AB9
    if (window.BindingContextMenu) {
      this.bindingContextMenu = new BindingContextMenu();
      this.bindingContextMenu.onBindingChanged = (buttonId, bindings) => {
        this.handleBindingChanged(buttonId, bindings);
      };
      this.bindingContextMenu.onClearBindings = (buttonId, keysToClear) => {
        this.handleClearBindings(buttonId, keysToClear);
      };
      this.bindingContextMenu.onMenuClosed = (buttonId) => {
        this.handleMenuClosed(buttonId);
      };
    }

    this.render();
  }

  handleBindingChanged(buttonId, bindings) {
    console.log('Binding changed for', buttonId, ':', bindings);

    // Merge new bindings into customBindings (bindings already contains all bindings from context menu)
    this.customBindings = { ...bindings };

    // Save to localStorage
    this.saveCustomBindings();

    // Update UI
    this.updateBindingHighlights();

    // Update sidebar bindings list
    this.updateSidebarBindingsList();
  }

  handleClearBindings(buttonId, keysToClear) {
    console.log('Clearing bindings for', buttonId, ':', keysToClear);

    // Remove each key from customBindings
    keysToClear.forEach(key => {
      delete this.customBindings[key];
    });

    // Save to localStorage
    this.saveCustomBindings();

    // Sync with binding context menu
    if (this.bindingContextMenu) {
      this.bindingContextMenu.customBindings = { ...this.customBindings };
    }

    // Update UI
    this.updateBindingHighlights();

    // Update sidebar bindings list
    this.updateSidebarBindingsList();
  }

  handleMenuClosed(buttonId) {
    // Clear selection and hide highlight when menu is closed
    const hotspot = this.buttonElements[buttonId];
    if (hotspot) {
      hotspot.classList.remove('selected');
      // Hide the AB9 highlight image
      if (hotspot.dataset.highlightId) {
        this.showAB9Highlight(hotspot.dataset.highlightId, false);
      }
    }
    this.selectedButton = null;
    this.clearBindingInfo();
  }

  render() {
    this.container.innerHTML = '';
    this.buttonElements = {};
    this.highlightImages = {}; // Clear highlight images on re-render

    const wrapper = document.createElement('div');
    wrapper.className = 'hotas-image-container';

    // Device selector removed - now using hardware selection screen instead

    // Connection status
    const status = document.createElement('div');
    status.className = 'gamepad-status-bar';
    status.id = 'hotas-status';
    status.innerHTML = `
      <div class="status-indicator disconnected"></div>
      <span class="status-text">No HOTAS connected</span>
      <span class="status-hint">Connect your HOTAS to see live input</span>
    `;
    wrapper.appendChild(status);

    // Device visualization
    const visual = document.createElement('div');
    visual.className = 'hotas-visual-wrapper';

    if (this.activeDevice === 'x56-hotas') {
      visual.appendChild(this.renderX56Combined());
    } else if (this.activeDevice === 'x56-throttle') {
      visual.appendChild(this.renderX56Throttle());
    } else if (this.activeDevice === 'x56-stick') {
      visual.appendChild(this.renderX56Stick());
    } else if (this.activeDevice === 'x52-hotas') {
      visual.appendChild(this.renderX52());
    } else if (this.activeDevice === 'vkb-left') {
      visual.appendChild(this.renderVKBLeft());
    } else if (this.activeDevice === 'vkb-right') {
      visual.appendChild(this.renderVKBRight());
    } else if (this.activeDevice === 'ab9') {
      visual.appendChild(this.renderAB9());
    } else if (this.activeDevice === 'flight-yoke') {
      visual.appendChild(this.renderFlightYoke());
    } else if (this.activeDevice === 'flight-throttle') {
      visual.appendChild(this.renderFlightThrottle());
    }

    wrapper.appendChild(visual);

    // Axis display panel (only for devices without inline axis panels)
    const devicesWithInlineAxisPanels = ['x56-hotas', 'x52-hotas', 'vkb-left', 'vkb-right', 'flight-yoke', 'flight-throttle', 'ab9'];
    if (!devicesWithInlineAxisPanels.includes(this.activeDevice)) {
      wrapper.appendChild(this.renderAxisPanel());
    }

    // Binding info panel (only shown for devices with clickable hotspots: X56, X52)
    const devicesWithInfoPanel = ['x56-hotas', 'x56-throttle', 'x56-stick', 'x52-hotas'];
    if (devicesWithInfoPanel.includes(this.activeDevice)) {
      const infoPanel = document.createElement('div');
      infoPanel.className = 'hotas-info-panel';
      infoPanel.innerHTML = `
        <div class="info-header">Control Bindings</div>
        <div class="info-content" id="hotas-binding-info">
          <p class="hint-text">Click on a button, hat, or axis to see its Star Citizen bindings</p>
        </div>
      `;
      wrapper.appendChild(infoPanel);
    }

    this.container.appendChild(wrapper);
    this.setupEventListeners();
    this.updateBindingHighlights();
    this.updateSidebarBindingsList();
  }

  renderX56Throttle() {
    const wrapper = document.createElement('div');
    wrapper.className = 'x56-throttle-wrapper';

    // Create the main content area with mode panel and device
    const contentArea = document.createElement('div');
    contentArea.className = 'x56-content-area';

    // Add mode selector panel (linked to shared mode state)
    const modePanel = this.renderModeSelector();
    contentArea.appendChild(modePanel);

    const container = document.createElement('div');
    container.className = 'hotas-device-pair x56-throttle-single';

    const throttleUnit = document.createElement('div');
    throttleUnit.className = 'hotas-device-unit x56-throttle-unit';
    throttleUnit.innerHTML = `
      <div class="device-title">X56 Throttle</div>
      <div class="device-image-container x56-throttle-container" id="x56-throttle-container">
        <img src="../../assets/controllers/X56 Throttle/x56-Throttle_0012_Layer-0.png" alt="X56 Throttle" class="device-image x56-throttle-base-image" id="x56-throttle-base-img">
        <div class="x56-throttle-highlight-layer" id="x56-throttle-highlight-layer"></div>
        <div class="hotspot-overlay" id="x56-throttle-overlay"></div>
      </div>
    `;
    container.appendChild(throttleUnit);
    contentArea.appendChild(container);

    wrapper.appendChild(contentArea);

    // Add live input panel for X56 Throttle
    const liveInputPanel = document.createElement('div');
    liveInputPanel.className = 'live-input-panel x56-live-input-panel compact';
    liveInputPanel.innerHTML = `
      <div class="live-input-header">Live Input</div>
      <div class="live-input-content">
        <div class="axis-displays x56-axis-displays">
          <div class="axis-display-group">
            <button class="axis-display-label axis-bind-btn" data-axis="x56_th_throttle_left" title="Click to bind Throttle 1">Throttle 1</button>
            <div class="trigger-bar throttle-lever-bar">
              <div class="trigger-fill" id="x56-throttle1-fill"></div>
            </div>
            <span class="trigger-value" id="x56-throttle1-val">0%</span>
          </div>
          <div class="axis-display-group">
            <button class="axis-display-label axis-bind-btn" data-axis="x56_th_throttle_right" title="Click to bind Throttle 2">Throttle 2</button>
            <div class="trigger-bar throttle-lever-bar">
              <div class="trigger-fill" id="x56-throttle2-fill"></div>
            </div>
            <span class="trigger-value" id="x56-throttle2-val">0%</span>
          </div>
        </div>
        <div class="button-input-display">
          <div class="button-input-label">Buttons:</div>
          <div class="button-input-list" id="x56-throttle-button-list">None</div>
        </div>
      </div>
    `;
    wrapper.appendChild(liveInputPanel);

    // Add hotspots and preload highlight images after base image loads
    setTimeout(() => {
      this.addX56ThrottleHotspots();
      this.preloadX56ThrottleHighlights();
      this.setupAxisBindButtons();
    }, 100);

    return wrapper;
  }

  renderX56Stick() {
    const wrapper = document.createElement('div');
    wrapper.className = 'x56-stick-wrapper';

    // Create the main content area with mode panel and device
    const contentArea = document.createElement('div');
    contentArea.className = 'x56-content-area';

    // Add mode selector panel (linked to shared mode state)
    const modePanel = this.renderModeSelector();
    contentArea.appendChild(modePanel);

    const container = document.createElement('div');
    container.className = 'hotas-device-pair x56-stick-single';

    const stickUnit = document.createElement('div');
    stickUnit.className = 'hotas-device-unit x56-stick-unit';
    stickUnit.innerHTML = `
      <div class="device-title">X56 Flight Stick</div>
      <div class="device-image-container x56-stick-container" id="x56-stick-container">
        <img src="../../assets/controllers/X56 Stick/x56-stick_0007_Layer-1.png" alt="X56 Stick" class="device-image x56-stick-base-image" id="x56-stick-img">
        <div class="x56-stick-highlight-layer" id="x56-stick-highlight-layer"></div>
        <div class="hotspot-overlay" id="x56-stick-overlay"></div>
      </div>
    `;
    container.appendChild(stickUnit);
    contentArea.appendChild(container);

    wrapper.appendChild(contentArea);

    // Add live input panel for X56 Stick
    const liveInputPanel = document.createElement('div');
    liveInputPanel.className = 'live-input-panel x56-live-input-panel compact';
    liveInputPanel.innerHTML = `
      <div class="live-input-header">Live Input</div>
      <div class="live-input-content">
        <div class="axis-displays x56-axis-displays">
          <div class="axis-display-group">
            <div class="axis-label-row">
              <button class="axis-display-label axis-bind-btn" data-axis="x56_js_pitch" title="Click to bind Pitch">Pitch</button>
              <span class="axis-label-separator">/</span>
              <button class="axis-display-label axis-bind-btn" data-axis="x56_js_roll" title="Click to bind Roll">Roll</button>
            </div>
            <div class="axis-visual compact">
              <div class="axis-crosshair"></div>
              <div class="axis-dot" id="x56-stick-dot"></div>
            </div>
            <div class="axis-values">
              <span>P: <span id="x56-pitch-val">0.00</span></span>
              <span>R: <span id="x56-roll-val">0.00</span></span>
            </div>
          </div>
          <div class="axis-display-group">
            <button class="axis-display-label axis-bind-btn" data-axis="x56_js_yaw" title="Click to bind Yaw">Yaw (Twist)</button>
            <div class="axis-bar horizontal-axis-bar">
              <div class="axis-bar-fill" id="x56-yaw-fill"></div>
              <div class="axis-bar-center"></div>
            </div>
            <span class="axis-value" id="x56-yaw-val">0.00</span>
          </div>
        </div>
        <div class="button-input-display">
          <div class="button-input-label">Buttons:</div>
          <div class="button-input-list" id="x56-stick-button-list">None</div>
        </div>
      </div>
    `;
    wrapper.appendChild(liveInputPanel);

    // Add hotspots and preload highlight images after base image loads
    setTimeout(() => {
      this.addX56StickHotspots();
      this.preloadX56StickHighlights();
      this.setupAxisBindButtons();
    }, 100);

    return wrapper;
  }

  renderX56Combined() {
    const wrapper = document.createElement('div');
    wrapper.className = 'x56-combined-wrapper';

    // Create the main content area with mode panel and devices
    const contentArea = document.createElement('div');
    contentArea.className = 'x56-content-area';

    // Add mode selector panel for X56 (positioned top-left)
    const modePanel = this.renderModeSelector();
    contentArea.appendChild(modePanel);

    const container = document.createElement('div');
    container.className = 'hotas-device-pair x56-combined';

    // Throttle unit (left side)
    const throttleUnit = document.createElement('div');
    throttleUnit.className = 'hotas-device-unit x56-throttle-unit';
    throttleUnit.innerHTML = `
      <div class="device-title">X56 Throttle</div>
      <div class="device-image-container x56-throttle-container" id="x56-throttle-container">
        <img src="../../assets/controllers/X56 Throttle/x56-Throttle_0012_Layer-0.png" alt="X56 Throttle" class="device-image x56-throttle-base-image" id="x56-throttle-base-img">
        <div class="x56-throttle-highlight-layer" id="x56-throttle-highlight-layer"></div>
        <div class="hotspot-overlay" id="x56-throttle-overlay"></div>
      </div>
    `;
    container.appendChild(throttleUnit);

    // Stick unit (right side)
    const stickUnit = document.createElement('div');
    stickUnit.className = 'hotas-device-unit x56-stick-unit';
    stickUnit.innerHTML = `
      <div class="device-title">X56 Flight Stick</div>
      <div class="device-image-container x56-stick-container" id="x56-stick-container">
        <img src="../../assets/controllers/X56 Stick/x56-stick_0007_Layer-1.png" alt="X56 Stick" class="device-image x56-stick-base-image" id="x56-stick-img">
        <div class="x56-stick-highlight-layer" id="x56-stick-highlight-layer"></div>
        <div class="hotspot-overlay" id="x56-stick-overlay"></div>
      </div>
    `;
    container.appendChild(stickUnit);

    contentArea.appendChild(container);

    // Add live input panel for X56 (under the entire controller area)
    const liveInputPanel = document.createElement('div');
    liveInputPanel.className = 'live-input-panel x56-live-input-panel';
    liveInputPanel.innerHTML = `
      <div class="live-input-header">Live Input</div>
      <div class="live-input-content">
        <div class="axis-displays x56-axis-displays">
          <div class="axis-display-group">
            <button class="axis-display-label axis-bind-btn" data-axis="x56_th_throttle_left" title="Click to bind Throttle 1">Throttle 1</button>
            <div class="trigger-bar throttle-lever-bar">
              <div class="trigger-fill" id="x56-throttle1-fill"></div>
            </div>
            <span class="trigger-value" id="x56-throttle1-val">0%</span>
          </div>
          <div class="axis-display-group">
            <button class="axis-display-label axis-bind-btn" data-axis="x56_th_throttle_right" title="Click to bind Throttle 2">Throttle 2</button>
            <div class="trigger-bar throttle-lever-bar">
              <div class="trigger-fill" id="x56-throttle2-fill"></div>
            </div>
            <span class="trigger-value" id="x56-throttle2-val">0%</span>
          </div>
          <div class="axis-display-group">
            <div class="axis-label-row">
              <button class="axis-display-label axis-bind-btn" data-axis="x56_js_pitch" title="Click to bind Pitch">Pitch</button>
              <span class="axis-label-separator">/</span>
              <button class="axis-display-label axis-bind-btn" data-axis="x56_js_roll" title="Click to bind Roll">Roll</button>
            </div>
            <div class="axis-visual">
              <div class="axis-crosshair"></div>
              <div class="axis-dot" id="x56-stick-dot"></div>
            </div>
            <div class="axis-values">
              <span>P: <span id="x56-pitch-val">0.00</span></span>
              <span>R: <span id="x56-roll-val">0.00</span></span>
            </div>
          </div>
          <div class="axis-display-group">
            <button class="axis-display-label axis-bind-btn" data-axis="x56_js_yaw" title="Click to bind Yaw">Yaw (Twist)</button>
            <div class="axis-bar horizontal-axis-bar">
              <div class="axis-bar-fill" id="x56-yaw-fill"></div>
              <div class="axis-bar-center"></div>
            </div>
            <span class="axis-value" id="x56-yaw-val">0.00</span>
          </div>
          <div class="axis-display-group thumbstick-group">
            <button class="axis-display-label axis-bind-btn" data-axis="x56_js_thumbstick_press" title="Click to bind Thumbstick Press">Thumb</button>
            <div class="thumbstick-axes">
              <div class="thumbstick-axis-item">
                <button class="axis-display-label axis-bind-btn small" data-axis="x56_js_thumbstick_x" title="Click to bind Thumbstick X">X</button>
                <div class="axis-bar horizontal-axis-bar compact">
                  <div class="axis-bar-fill" id="x56-thumbstick-x-fill"></div>
                  <div class="axis-bar-center"></div>
                </div>
                <span class="axis-value" id="x56-thumbstick-x-val">0.00</span>
              </div>
              <div class="thumbstick-axis-item">
                <button class="axis-display-label axis-bind-btn small" data-axis="x56_js_thumbstick_y" title="Click to bind Thumbstick Y">Y</button>
                <div class="axis-bar horizontal-axis-bar compact">
                  <div class="axis-bar-fill" id="x56-thumbstick-y-fill"></div>
                  <div class="axis-bar-center"></div>
                </div>
                <span class="axis-value" id="x56-thumbstick-y-val">0.00</span>
              </div>
            </div>
          </div>
        </div>
        <div class="button-input-display">
          <div class="button-input-row">
            <div class="button-input-label">Buttons Pressed:</div>
            <button class="button-config-btn" id="x56-config-btn" title="Configure button mappings">Configure</button>
          </div>
          <div class="button-input-list" id="x56-button-list">None</div>
        </div>
      </div>
    `;

    wrapper.appendChild(contentArea);
    wrapper.appendChild(liveInputPanel);

    // Add hotspots and preload highlight images for both devices
    setTimeout(() => {
      this.addX56ThrottleHotspots();
      this.preloadX56ThrottleHighlights();
      this.addX56StickHotspots();
      this.preloadX56StickHighlights();
      this.setupAxisBindButtons();
      this.setupButtonConfigButton();
      // Check if button mapping needs to be configured
      this.checkButtonMappingNeeded();
    }, 100);

    return wrapper;
  }

  // ==================== LOGITECH X52 PRO FLIGHT SYSTEM ====================

  renderX52() {
    // Create wrapper to hold mode panel and device
    const wrapper = document.createElement('div');
    wrapper.className = 'x52-combined-wrapper';

    // Create the main content area with mode panel and device
    const contentArea = document.createElement('div');
    contentArea.className = 'x52-content-area';

    // Add mode selector panel for X52
    const modePanel = this.renderX52ModeSelector();
    contentArea.appendChild(modePanel);

    const container = document.createElement('div');
    container.className = 'hotas-device-pair x52-single';

    const x52Unit = document.createElement('div');
    x52Unit.className = 'hotas-device-unit x52-unit';
    x52Unit.innerHTML = `
      <div class="device-title">X52 Pro Flight System</div>
      <div class="device-image-container x52-container" id="x52-container">
        <img src="../../assets/controllers/X52/x52pro-gallery-1.webp" alt="X52 Pro" class="device-image x52-base-image" id="x52-base-img">
        <div class="x52-highlight-layer" id="x52-highlight-layer"></div>
        <div class="hotspot-overlay" id="x52-overlay"></div>
      </div>
    `;
    container.appendChild(x52Unit);

    contentArea.appendChild(container);

    wrapper.appendChild(contentArea);

    // Add live input panel for X52 (under the entire controller area)
    const liveInputPanel = document.createElement('div');
    liveInputPanel.className = 'live-input-panel x52-live-input-panel';
    liveInputPanel.innerHTML = `
      <div class="live-input-header">Live Input</div>
      <div class="live-input-content">
        <div class="axis-displays x52-axis-displays">
          <div class="axis-display-group">
            <button class="axis-display-label axis-bind-btn" data-axis="x52_th_throttle" title="Click to bind Throttle">Throttle</button>
            <div class="trigger-bar throttle-lever-bar">
              <div class="trigger-fill" id="x52-throttle-fill"></div>
            </div>
            <span class="trigger-value" id="x52-throttle-val">0%</span>
          </div>
          <div class="axis-display-group">
            <div class="axis-label-row">
              <button class="axis-display-label axis-bind-btn" data-axis="x52_js_pitch" title="Click to bind Pitch">Pitch</button>
              <span class="axis-label-separator">/</span>
              <button class="axis-display-label axis-bind-btn" data-axis="x52_js_roll" title="Click to bind Roll">Roll</button>
            </div>
            <div class="axis-visual">
              <div class="axis-crosshair"></div>
              <div class="axis-dot" id="x52-stick-dot"></div>
            </div>
            <div class="axis-values">
              <span>P: <span id="x52-pitch-val">0.00</span></span>
              <span>R: <span id="x52-roll-val">0.00</span></span>
            </div>
          </div>
          <div class="axis-display-group">
            <button class="axis-display-label axis-bind-btn" data-axis="x52_js_yaw" title="Click to bind Yaw">Yaw (Twist)</button>
            <div class="axis-bar horizontal-axis-bar">
              <div class="axis-bar-fill" id="x52-yaw-fill"></div>
              <div class="axis-bar-center"></div>
            </div>
            <span class="axis-value" id="x52-yaw-val">0.00</span>
          </div>
        </div>
        <div class="button-input-display">
          <div class="button-input-label">Buttons Pressed:</div>
          <div class="button-input-list" id="x52-button-list">None</div>
        </div>
      </div>
    `;
    wrapper.appendChild(liveInputPanel);

    // Add hotspots and preload highlight images after base image loads
    setTimeout(() => {
      this.addX52Hotspots();
      this.preloadX52Highlights();
      this.setupAxisBindButtons();
    }, 100);

    return wrapper;
  }

  preloadX52Highlights() {
    // Map of button IDs to their highlight image filenames
    const highlightMap = {
      // Throttle controls
      'x52_th_select': 'x52pro-gallery-1_0000_Throttle-Select.png',
      'x52_th_dpad': 'x52pro-gallery-1_0001_Throttle-dpad.png',
      'x52_th_thumb': 'x52pro-gallery-1_0002_Throttle-Thumb.png',
      'x52_th_front_dpad': 'x52pro-gallery-1_0003_Throttle-front-dpad.png',
      'x52_th_rt2': 'x52pro-gallery-1_0004_Throttle-RT-2.png',
      'x52_th_rt1': 'x52pro-gallery-1_0005_Throttle--RT-1.png',
      'x52_th_t5_t6': 'x52pro-gallery-1_0006_T5_T6.png',
      'x52_th_t3_t4': 'x52pro-gallery-1_0007_T3_T4.png',
      'x52_th_t1_t2': 'x52pro-gallery-1_0008_T1_T2.png',
      // Stick controls
      'x52_js_pinky_switch': 'x52pro-gallery-1_0009_Pinky-Switch.png',
      'x52_js_trigger': 'x52pro-gallery-1_0010_Trigger.png',
      'x52_js_fire': 'x52pro-gallery-1_0011_Thumb-Missle.png',
      'x52_js_scroll': 'x52pro-gallery-1_0012_Layer-7.png',
      'x52_js_thumb_dpad': 'x52pro-gallery-1_0013_Thumb-Dpad.png',
      'x52_js_c_btn': 'x52pro-gallery-1_0014_Thumb-C.png',
      'x52_js_a_btn': 'x52pro-gallery-1_0015_Thumb-A.png',
      'x52_js_b_btn': 'x52pro-gallery-1_0016_Thumb-B.png',
      'x52_js_thumb_hat': 'x52pro-gallery-1_0017_Thumb-Hat.png'
    };

    const highlightLayer = document.getElementById('x52-highlight-layer');
    if (!highlightLayer) return;

    const cacheBuster = Date.now();
    Object.entries(highlightMap).forEach(([buttonId, filename]) => {
      const img = document.createElement('img');
      img.src = `../../assets/controllers/X52/${filename}?v=${cacheBuster}`;
      img.className = 'x52-highlight-img';
      img.dataset.button = buttonId;
      img.style.display = 'none';
      img.onerror = () => console.error('Failed to load X52 highlight:', filename);
      highlightLayer.appendChild(img);
      this.highlightImages[buttonId] = img;
    });
  }

  addX52Hotspots() {
    const overlay = document.getElementById('x52-overlay');
    if (!overlay) return;

    // Hotspot positions - calibrated using debug mode
    // Positions are percentages relative to the image
    const hotspots = [
      // Throttle controls (left side of image)
      { id: 'x52_th_select', label: 'Select/Scroll Wheel', x: 34.2, y: 47, w: 2, h: 3.6, type: 'button', highlightId: 'x52_th_select' },
      { id: 'x52_th_dpad', label: 'Throttle D-Pad', x: 36.5, y: 42.8, w: 3, h: 4.5, type: 'hat', highlightId: 'x52_th_dpad' },
      { id: 'x52_th_thumb', label: 'Thumb Button', x: 41, y: 31.3, w: 3.3, h: 4.8, type: 'button', highlightId: 'x52_th_thumb' },
      { id: 'x52_th_front_dpad', label: 'Front D-Pad', x: 37.1, y: 25.6, w: 2.5, h: 4.8, type: 'hat', highlightId: 'x52_th_front_dpad' },
      { id: 'x52_th_rt1', label: 'RT1 Rotary', x: 40.7, y: 24.9, w: 3.8, h: 4.6, type: 'axis', highlightId: 'x52_th_rt1' },
      { id: 'x52_th_rt2', label: 'RT2 Rotary', x: 40.5, y: 42.2, w: 2.8, h: 3.9, type: 'axis', highlightId: 'x52_th_rt2' },
      { id: 'x52_th_t1_t2', label: 'T1/T2 Toggles', x: 49.4, y: 77.3, w: 2.3, h: 8.4, type: 'button', highlightId: 'x52_th_t1_t2' },
      { id: 'x52_th_t3_t4', label: 'T3/T4 Toggles', x: 54, y: 78, w: 2, h: 8.2, type: 'button', highlightId: 'x52_th_t3_t4' },
      { id: 'x52_th_t5_t6', label: 'T5/T6 Toggles', x: 57.6, y: 80.9, w: 3.3, h: 7, type: 'button', highlightId: 'x52_th_t5_t6' },
      // Stick controls (right side of image)
      { id: 'x52_js_thumb_hat', label: 'Thumb Hat (POV)', x: 63.2, y: 19.1, w: 3.6, h: 6.2, type: 'hat', highlightId: 'x52_js_thumb_hat' },
      { id: 'x52_js_a_btn', label: 'A Button', x: 68.3, y: 12.2, w: 2, h: 3.5, type: 'button', highlightId: 'x52_js_a_btn' },
      { id: 'x52_js_b_btn', label: 'B Button', x: 67.8, y: 19.1, w: 2, h: 3.7, type: 'button', highlightId: 'x52_js_b_btn' },
      { id: 'x52_js_c_btn', label: 'C Button', x: 59.8, y: 17.1, w: 3.1, h: 5, type: 'button', highlightId: 'x52_js_c_btn' },
      { id: 'x52_js_fire', label: 'Fire Button', x: 65.2, y: 9.3, w: 2.9, h: 5, type: 'button', highlightId: 'x52_js_fire' },
      { id: 'x52_js_thumb_dpad', label: 'Thumb D-Pad', x: 60, y: 9.8, w: 4.4, h: 6.8, type: 'hat', highlightId: 'x52_js_thumb_dpad' },
      { id: 'x52_js_scroll', label: 'Scroll Wheel', x: 71.1, y: 9.1, w: 2.4, h: 9.3, type: 'button', highlightId: 'x52_js_scroll' },
      { id: 'x52_js_trigger', label: 'Trigger', x: 63.6, y: 29.8, w: 2.9, h: 8.8, type: 'button', highlightId: 'x52_js_trigger' },
      { id: 'x52_js_pinky_switch', label: 'Pinky Switch', x: 67.3, y: 33.6, w: 2, h: 11.9, type: 'button', highlightId: 'x52_js_pinky_switch' }
    ];

    hotspots.forEach(hs => {
      const hotspot = document.createElement('div');
      hotspot.className = `hotspot hotspot-${hs.type} x52-hotspot`;
      hotspot.dataset.button = hs.id;
      hotspot.dataset.label = hs.label;
      hotspot.dataset.type = hs.type;
      hotspot.dataset.highlightId = hs.id;

      hotspot.style.cssText = `
        position: absolute;
        left: ${hs.x}%;
        top: ${hs.y}%;
        width: ${hs.w}%;
        height: ${hs.h}%;
      `;

      // Add label tooltip
      const label = document.createElement('span');
      label.className = 'hotspot-label';
      label.textContent = hs.label;
      hotspot.appendChild(label);

      // Add event listeners
      hotspot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectButton(hotspot);
        if (this.bindingContextMenu) {
          this.bindingContextMenu.show(hotspot.dataset.button, hotspot);
          this.bindingContextMenu.setCurrentBindings(this.customBindings);
        }
      });
      hotspot.addEventListener('mouseenter', () => this.highlightButton(hotspot, true));
      hotspot.addEventListener('mouseleave', () => this.highlightButton(hotspot, false));

      overlay.appendChild(hotspot);
      this.buttonElements[hs.id] = hotspot;
    });
  }

  // ==================== VKB GLADIATOR ====================

  renderVKBLeft() {
    const wrapper = document.createElement('div');
    wrapper.className = 'vkb-wrapper';

    const container = document.createElement('div');
    container.className = 'hotas-device-pair vkb-left-single';

    const leftUnit = document.createElement('div');
    leftUnit.className = 'hotas-device-unit vkb-left-unit';
    leftUnit.innerHTML = `
      <div class="device-title">VKB Gladiator - Left</div>
      <div class="device-image-container vkb-left-container" id="vkb-left-container">
        <img src="../../assets/controllers/VKB Left/vkb-left_0012_Layer-1.png" alt="VKB Left" class="device-image vkb-left-base-image" id="vkb-left-img">
        <div class="vkb-left-highlight-layer" id="vkb-left-highlight-layer"></div>
        <div class="hotspot-overlay" id="vkb-left-overlay"></div>
      </div>
    `;
    container.appendChild(leftUnit);
    wrapper.appendChild(container);

    // Add axis display panel for VKB Left
    const axisPanel = document.createElement('div');
    axisPanel.className = 'axis-display-panel vkb-axis-panel';
    axisPanel.innerHTML = `
      <div class="axis-display-header">Live Axis Input</div>
      <div class="axis-displays vkb-axis-displays">
        <div class="axis-display-group">
          <div class="axis-label-row">
            <button class="axis-display-label axis-bind-btn" data-axis="vkb_l_pitch" title="Click to bind Pitch">Pitch</button>
            <span class="axis-label-separator">/</span>
            <button class="axis-display-label axis-bind-btn" data-axis="vkb_l_roll" title="Click to bind Roll">Roll</button>
          </div>
          <div class="axis-visual">
            <div class="axis-crosshair"></div>
            <div class="axis-dot" id="vkb-left-stick-dot"></div>
          </div>
          <div class="axis-values">
            <span>P: <span id="vkb-left-pitch-val">0.00</span></span>
            <span>R: <span id="vkb-left-roll-val">0.00</span></span>
          </div>
        </div>
        <div class="axis-display-group">
          <button class="axis-display-label axis-bind-btn" data-axis="vkb_l_yaw" title="Click to bind Yaw">Yaw (Twist)</button>
          <div class="axis-bar horizontal-axis-bar">
            <div class="axis-bar-fill" id="vkb-left-yaw-fill"></div>
            <div class="axis-bar-center"></div>
          </div>
          <span class="axis-value" id="vkb-left-yaw-val">0.00</span>
        </div>
      </div>
      <div class="button-input-display">
        <div class="button-input-row">
          <div class="button-input-label">Buttons Pressed:</div>
          <button class="button-config-btn" id="vkb-left-calibrate-btn">Calibrate</button>
        </div>
        <div class="button-input-list" id="vkb-left-button-list">None</div>
      </div>
    `;
    wrapper.appendChild(axisPanel);

    // Add hotspots and preload highlight images after base image loads
    setTimeout(() => {
      this.addVKBLeftHotspots();
      this.preloadVKBLeftHighlights();
      this.setupAxisBindButtons();
      // Setup calibrate button listener
      const calibrateBtn = document.getElementById('vkb-left-calibrate-btn');
      if (calibrateBtn) {
        calibrateBtn.addEventListener('click', () => this.startButtonMappingWizard());
      }
    }, 100);

    return wrapper;
  }

  renderVKBRight() {
    const wrapper = document.createElement('div');
    wrapper.className = 'vkb-wrapper';

    const container = document.createElement('div');
    container.className = 'hotas-device-pair vkb-right-single';

    const rightUnit = document.createElement('div');
    rightUnit.className = 'hotas-device-unit vkb-right-unit';
    rightUnit.innerHTML = `
      <div class="device-title">VKB Gladiator - Right</div>
      <div class="device-image-container vkb-right-container" id="vkb-right-container">
        <img src="../../assets/controllers/vkb Right/vkb-left_0012_Layer-1.png" alt="VKB Right" class="device-image vkb-right-base-image" id="vkb-right-img">
        <div class="vkb-right-highlight-layer" id="vkb-right-highlight-layer"></div>
        <div class="hotspot-overlay" id="vkb-right-overlay"></div>
      </div>
    `;
    container.appendChild(rightUnit);
    wrapper.appendChild(container);

    // Add axis display panel for VKB Right
    const axisPanel = document.createElement('div');
    axisPanel.className = 'axis-display-panel vkb-axis-panel';
    axisPanel.innerHTML = `
      <div class="axis-display-header">Live Axis Input</div>
      <div class="axis-displays vkb-axis-displays">
        <div class="axis-display-group">
          <div class="axis-label-row">
            <button class="axis-display-label axis-bind-btn" data-axis="vkb_r_pitch" title="Click to bind Pitch">Pitch</button>
            <span class="axis-label-separator">/</span>
            <button class="axis-display-label axis-bind-btn" data-axis="vkb_r_roll" title="Click to bind Roll">Roll</button>
          </div>
          <div class="axis-visual">
            <div class="axis-crosshair"></div>
            <div class="axis-dot" id="vkb-right-stick-dot"></div>
          </div>
          <div class="axis-values">
            <span>P: <span id="vkb-right-pitch-val">0.00</span></span>
            <span>R: <span id="vkb-right-roll-val">0.00</span></span>
          </div>
        </div>
        <div class="axis-display-group">
          <button class="axis-display-label axis-bind-btn" data-axis="vkb_r_yaw" title="Click to bind Yaw">Yaw (Twist)</button>
          <div class="axis-bar horizontal-axis-bar">
            <div class="axis-bar-fill" id="vkb-right-yaw-fill"></div>
            <div class="axis-bar-center"></div>
          </div>
          <span class="axis-value" id="vkb-right-yaw-val">0.00</span>
        </div>
      </div>
      <div class="button-input-display">
        <div class="button-input-row">
          <div class="button-input-label">Buttons Pressed:</div>
          <button class="button-config-btn" id="vkb-right-calibrate-btn">Calibrate</button>
        </div>
        <div class="button-input-list" id="vkb-right-button-list">None</div>
      </div>
    `;
    wrapper.appendChild(axisPanel);

    // Add hotspots and preload highlight images after base image loads
    setTimeout(() => {
      this.addVKBRightHotspots();
      this.preloadVKBRightHighlights();
      this.setupAxisBindButtons();
      // Setup calibrate button listener
      const calibrateBtn = document.getElementById('vkb-right-calibrate-btn');
      if (calibrateBtn) {
        calibrateBtn.addEventListener('click', () => this.startButtonMappingWizard());
      }
    }, 100);

    return wrapper;
  }

  renderAB9() {
    // Create wrapper for AB9 content area (image + side panel)
    const wrapper = document.createElement('div');
    wrapper.className = 'ab9-wrapper';

    // Content area holds the image and side panel horizontally
    const contentArea = document.createElement('div');
    contentArea.className = 'ab9-content-area';

    const container = document.createElement('div');
    container.className = 'hotas-device-pair ab9-single';

    const stickUnit = document.createElement('div');
    stickUnit.className = 'hotas-device-unit ab9-unit';
    stickUnit.innerHTML = `
      <div class="device-title">MOZA AB9 Flight Stick</div>
      <div class="device-image-container ab9-container" id="ab9-container">
        <img src="../../assets/controllers/AB9 Buttons/AB9-flight-stick_0011_Layer-0.png" alt="MOZA AB9" class="device-image ab9-base-image" id="ab9-base-img">
        <div class="ab9-highlight-layer" id="ab9-highlight-layer"></div>
        <div class="hotspot-overlay" id="ab9-overlay"></div>
      </div>
    `;
    container.appendChild(stickUnit);

    contentArea.appendChild(container);

    // Add live input panel for AB9 (to the right of the controller image)
    const liveInputPanel = document.createElement('div');
    liveInputPanel.className = 'live-input-panel ab9-live-input-panel';
    liveInputPanel.innerHTML = `
      <div class="live-input-header">Live Input</div>
      <div class="live-input-content">
        <div class="axis-displays ab9-axis-displays">
          <div class="axis-display-group">
            <div class="axis-label-row">
              <button class="axis-display-label axis-bind-btn" data-axis="ab9_pitch" title="Click to bind Pitch">Pitch</button>
              <span class="axis-label-separator">/</span>
              <button class="axis-display-label axis-bind-btn" data-axis="ab9_roll" title="Click to bind Roll">Roll</button>
            </div>
            <div class="axis-visual">
              <div class="axis-crosshair"></div>
              <div class="axis-dot" id="ab9-stick-dot"></div>
            </div>
            <div class="axis-values">
              <span>P: <span id="ab9-pitch-val">0.00</span></span>
              <span>R: <span id="ab9-roll-val">0.00</span></span>
            </div>
          </div>
        </div>
        <div class="button-input-display">
          <div class="button-input-row">
            <div class="button-input-label">Buttons Pressed:</div>
            <button class="button-config-btn" id="ab9-calibrate-btn">Calibrate</button>
          </div>
          <div class="button-input-list" id="ab9-button-list">None</div>
        </div>
      </div>
    `;
    contentArea.appendChild(liveInputPanel);

    wrapper.appendChild(contentArea);

    // Add hotspots and preload highlight images after base image loads
    setTimeout(() => {
      this.addAB9Hotspots();
      this.preloadAB9Highlights();
      this.setupAxisBindButtons();
      // Setup calibrate button listener
      const calibrateBtn = document.getElementById('ab9-calibrate-btn');
      if (calibrateBtn) {
        calibrateBtn.addEventListener('click', () => this.startButtonMappingWizard());
      }
    }, 100);

    return wrapper;
  }

  preloadAB9Highlights() {
    // Map of button IDs to their highlight image filenames
    // Note: X and Y axes are now in the axis panel as buttons, no longer using overlays
    const highlightMap = {
      'ab9_index_btn': 'AB9-flight-stick_0000_index-button.png',
      'ab9_thumb_hat': 'AB9-flight-stick_0001_Thumb-Hat.png',
      'ab9_thumb_missile': 'AB9-flight-stick_0002_Thumb-Missle.png',
      'ab9_funky_knob': 'AB9-flight-stick_0003_Thumb-Funkly-Knob.png',
      'ab9_bottom_dpad': 'AB9-flight-stick_0004_Bottom-Thumb-D-pad.png',
      'ab9_top_dpad': 'AB9-flight-stick_0005_Thumb-Top-D-pad.png',
      'ab9_top_rocker': 'AB9-flight-stick_0006_Top-Thumb-Rocker.png',
      'ab9_trigger': 'AB9-flight-stick_0007_Trigger.png',
      'ab9_bottom_rocker': 'AB9-flight-stick_0008_Bottom-Thumb-Rocker.png',
      'ab9_pinky_btn': 'AB9-flight-stick_0009_Pinky-Button.png',
      'ab9_pinky_switch': 'AB9-flight-stick_0010_pinky-switch.png'
    };

    const highlightLayer = document.getElementById('ab9-highlight-layer');
    console.log('preloadAB9Highlights - highlightLayer:', highlightLayer);
    if (!highlightLayer) return;

    // Create highlight images (hidden by default) with cache-busting
    const cacheBuster = Date.now();
    Object.entries(highlightMap).forEach(([buttonId, filename]) => {
      const img = document.createElement('img');
      img.src = `../../assets/controllers/AB9 Buttons/${filename}?v=${cacheBuster}`;
      img.className = 'ab9-highlight-img';
      img.dataset.button = buttonId;
      img.style.display = 'none';
      img.onerror = () => console.error('Failed to load highlight image:', filename);
      img.onload = () => console.log('Loaded highlight image:', filename);
      highlightLayer.appendChild(img);
      this.highlightImages[buttonId] = img;
      console.log('Added highlight image for:', buttonId);
    });
  }

  addAB9Hotspots() {
    const overlay = document.getElementById('ab9-overlay');
    console.log('addAB9Hotspots - overlay found:', overlay);
    if (!overlay) return;

    // Hotspots for AB9 - coordinates measured from actual highlight PNG positions
    // These percentages match where the yellow highlights appear in each overlay image
    // Button mappings: 1=Trigger Short, 2=Missile, 3=Pinky Btn, 4=Pinky Switch, 5=Index Btn, 6=Trigger Long
    // 7-10=Funky Knob, 11-14=Bottom D-Pad, 15-19=Thumb Fakey, 20-24=Top D-Pad, 25-26=Thumb Switch
    const hotspots = [
      // Top D-pad (0007) - 5 inputs: up/down/left/right + press (btn 20-24)
      { id: 'top_dpad', label: 'Top D-Pad (5-way)', x: 16, y: 3, w: 12, h: 6, type: 'hat', highlightId: 'ab9_top_dpad' },
      // Thumb Hat (0003) - 8-way analog hat
      { id: 'thumb_hat', label: 'Thumb Hat (8-way)', x: 33, y: 2, w: 12, h: 5, type: 'hat', highlightId: 'ab9_thumb_hat' },
      // Thumb Missile (0004) - btn 2
      { id: 'thumb_missile', label: 'Missile Button', x: 26, y: 2, w: 8, h: 5, type: 'button', highlightId: 'ab9_thumb_missile' },
      // Funky Knob (0005) - 4-way (btn 7-10)
      { id: 'funky_knob', label: 'Funky Knob (4-way)', x: 28, y: 6, w: 12, h: 6, type: 'hat', highlightId: 'ab9_funky_knob' },
      // Bottom D-Pad (0006) - 4-way (btn 11-14)
      { id: 'bottom_dpad', label: 'Bottom D-Pad (4-way)', x: 40, y: 6, w: 10, h: 5, type: 'hat', highlightId: 'ab9_bottom_dpad' },
      // Thumb Switch (0008) - 2-way up/down (btn 25-26) - renamed from "Top Rocker"
      { id: 'thumb_switch', label: 'Thumb Switch', x: 21, y: 7, w: 10, h: 6, type: 'button', highlightId: 'ab9_top_rocker' },
      // Index Button (0002) - btn 5
      { id: 'index_btn', label: 'Index Button', x: 40, y: 12, w: 6, h: 4, type: 'button', highlightId: 'ab9_index_btn' },
      // Trigger (0009) - short pull (btn 1) + long pull (btn 6)
      { id: 'trigger', label: 'Trigger (2-stage)', x: 27, y: 14, w: 7, h: 7, type: 'button', highlightId: 'ab9_trigger' },
      // Thumb Funky Knob (0010) - 5-way mini-stick: fwd/up/back/down/press (btn 15-19)
      { id: 'thumb_fakey', label: 'Thumb Funky Knob (5-way)', x: 30, y: 18, w: 8, h: 6, type: 'hat', highlightId: 'ab9_bottom_rocker' },
      // Pinky Switch (0012) - btn 4
      { id: 'pinky_switch', label: 'Pinky Switch', x: 26, y: 29, w: 8, h: 12, type: 'button', highlightId: 'ab9_pinky_switch' },
      // Pinky Button (0011) - btn 3
      { id: 'pinky_btn', label: 'Pinky Button', x: 37, y: 32, w: 5, h: 4, type: 'button', highlightId: 'ab9_pinky_btn' },
      // X and Y axes are now in the axis panel as buttons, not hotspots
    ];

    this.createAB9Hotspots(overlay, hotspots);
    console.log('Created', hotspots.length, 'AB9 hotspots');
  }

  createAB9Hotspots(overlay, hotspots) {
    hotspots.forEach(hs => {
      const hotspot = document.createElement('div');
      hotspot.className = `hotspot hotspot-${hs.type} ab9-hotspot`;
      hotspot.dataset.button = `ab9_${hs.id}`;
      hotspot.dataset.label = hs.label;
      hotspot.dataset.type = hs.type;
      hotspot.dataset.highlightId = hs.highlightId;

      hotspot.style.cssText = `
        position: absolute;
        left: ${hs.x}%;
        top: ${hs.y}%;
        width: ${hs.w}%;
        height: ${hs.h}%;
      `;

      // Add label tooltip
      const label = document.createElement('span');
      label.className = 'hotspot-label';
      label.textContent = hs.label;
      hotspot.appendChild(label);

      // Add event listeners directly (since these are created after setupEventListeners runs)
      hotspot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectButton(hotspot);
        // Show context menu for AB9 buttons
        if (this.bindingContextMenu) {
          this.bindingContextMenu.show(hotspot.dataset.button, hotspot);
          // Set current bindings so they appear in dropdowns
          this.bindingContextMenu.setCurrentBindings(this.customBindings);
        }
      });
      hotspot.addEventListener('mouseenter', () => this.highlightButton(hotspot, true));
      hotspot.addEventListener('mouseleave', () => this.highlightButton(hotspot, false));

      overlay.appendChild(hotspot);
      this.buttonElements[`ab9_${hs.id}`] = hotspot;
    });
  }

  showAB9Highlight(buttonId, show) {
    const highlightImg = this.highlightImages[buttonId];
    console.log('showAB9Highlight:', buttonId, show, highlightImg ? 'found' : 'not found');
    if (highlightImg) {
      highlightImg.style.display = show ? 'block' : 'none';
      console.log('Highlight image display set to:', highlightImg.style.display);
    }
  }

  // ==================== LOGITECH FLIGHT YOKE ====================

  renderFlightYoke() {
    const container = document.createElement('div');
    container.className = 'hotas-device-pair flight-yoke-single';

    const yokeUnit = document.createElement('div');
    yokeUnit.className = 'hotas-device-unit flight-yoke-unit';
    yokeUnit.innerHTML = `
      <div class="device-title">Logitech Flight Yoke</div>
      <div class="flight-yoke-layout">
        <div class="device-image-container flight-yoke-container" id="flight-yoke-container">
          <img src="../../assets/controllers/Flight Yoke/yoke-gallery-2_0008_Layer-1.png" alt="Flight Yoke" class="device-image flight-yoke-base-image" id="flight-yoke-base-img">
          <div class="flight-yoke-highlight-layer" id="flight-yoke-highlight-layer"></div>
          <div class="hotspot-overlay" id="flight-yoke-overlay"></div>
        </div>
        <div class="axis-display-panel flight-yoke-axis-panel">
          <div class="axis-display-header">Live Axis Input</div>
          <div class="axis-displays">
            <div class="axis-display-group">
              <div class="axis-label-row">
                <button class="axis-display-label axis-bind-btn" data-axis="yoke_x_axis" title="Click to bind Pitch">Pitch</button>
                <span class="axis-label-separator">/</span>
                <button class="axis-display-label axis-bind-btn" data-axis="yoke_y_axis" title="Click to bind Roll">Roll</button>
              </div>
              <div class="axis-visual axis-visual-yoke">
                <div class="axis-crosshair"></div>
                <div class="axis-dot" id="yoke-axis-dot"></div>
              </div>
              <div class="axis-values">
                <span>P: <span id="yoke-x-val">0.00</span></span>
                <span>R: <span id="yoke-y-val">0.00</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(yokeUnit);

    // Add hotspots and preload highlight images after base image loads
    setTimeout(() => {
      this.addFlightYokeHotspots();
      this.preloadFlightYokeHighlights();
      this.setupAxisBindButtons();
    }, 100);

    return container;
  }

  preloadFlightYokeHighlights() {
    // Map of button IDs to their highlight image filenames
    // Based on files: yoke-gallery-2_0000_Right-Funky.png through yoke-gallery-2_0007_T1_T2.png
    const highlightMap = {
      'yoke_right_funky': 'yoke-gallery-2_0000_Right-Funky.png',
      'yoke_t3_t4': 'yoke-gallery-2_0001_T3_T4.png',
      'yoke_t5_t6': 'yoke-gallery-2_0002_T5T6.png',
      'yoke_b3': 'yoke-gallery-2_0003_B3.png',
      'yoke_b2': 'yoke-gallery-2_0004_B2.png',
      'yoke_b1': 'yoke-gallery-2_0005_B1.png',
      'yoke_left_hat': 'yoke-gallery-2_0006_Left-Hat.png',
      'yoke_t1_t2': 'yoke-gallery-2_0007_T1_T2.png'
    };

    const highlightLayer = document.getElementById('flight-yoke-highlight-layer');
    if (!highlightLayer) return;

    // Create highlight images (hidden by default)
    const cacheBuster = Date.now();
    Object.entries(highlightMap).forEach(([buttonId, filename]) => {
      const img = document.createElement('img');
      img.src = `../../assets/controllers/Flight Yoke/${filename}?v=${cacheBuster}`;
      img.className = 'flight-yoke-highlight-img';
      img.dataset.button = buttonId;
      img.style.display = 'none';
      img.onerror = () => console.error('Failed to load highlight image:', filename);
      highlightLayer.appendChild(img);
      this.highlightImages[buttonId] = img;
    });
  }

  addFlightYokeHotspots() {
    const overlay = document.getElementById('flight-yoke-overlay');
    if (!overlay) return;

    // Hotspots for Flight Yoke - positions calibrated using debug mode
    const hotspots = [
      { id: 'x_axis', label: 'X-Axis (Pitch)', x: 18.9, y: 36.5, w: 7.8, h: 23.1, type: 'axis', highlightId: null },
      { id: 'y_axis', label: 'Y-Axis (Roll)', x: 73.4, y: 34, w: 6.7, h: 23.1, type: 'axis', highlightId: null },
      { id: 'left_hat', label: 'Left Hat (4-way POV)', x: 24.1, y: 16.5, w: 3.5, h: 6, type: 'hat', highlightId: 'yoke_left_hat' },
      { id: 'right_funky', label: 'Right Funky (5-way)', x: 74.6, y: 17.6, w: 2.9, h: 5.3, type: 'hat', highlightId: 'yoke_right_funky' },
      { id: 'b1', label: 'B1 Button', x: 41.9, y: 55.9, w: 3.6, h: 5.9, type: 'button', highlightId: 'yoke_b1' },
      { id: 'b2', label: 'B2 Button', x: 48.1, y: 56.1, w: 3.4, h: 6.3, type: 'button', highlightId: 'yoke_b2' },
      { id: 'b3', label: 'B3 Button', x: 54.1, y: 56.6, w: 3.7, h: 6.1, type: 'button', highlightId: 'yoke_b3' },
      { id: 't1_t2', label: 'T1/T2 Triggers', x: 22.1, y: 21.4, w: 2.3, h: 7.6, type: 'button', highlightId: 'yoke_t1_t2' },
      { id: 't3_t4', label: 'T3/T4 Triggers', x: 71.2, y: 18.4, w: 2.7, h: 6.3, type: 'button', highlightId: 'yoke_t3_t4' },
      { id: 't5_t6', label: 'T5/T6 Triggers', x: 73.1, y: 23.9, w: 4.9, h: 4.8, type: 'button', highlightId: 'yoke_t5_t6' }
    ];

    hotspots.forEach(hs => {
      const hotspot = document.createElement('div');
      hotspot.className = `hotspot hotspot-${hs.type} flight-yoke-hotspot`;
      hotspot.style.left = `${hs.x}%`;
      hotspot.style.top = `${hs.y}%`;
      hotspot.style.width = `${hs.w}%`;
      hotspot.style.height = `${hs.h}%`;
      hotspot.dataset.button = `yoke_${hs.id}`;
      hotspot.dataset.label = hs.label;
      hotspot.dataset.type = hs.type;
      hotspot.dataset.highlightId = hs.highlightId;
      hotspot.title = hs.label;

      // Add event listeners directly (since these are created after setupEventListeners runs)
      hotspot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectButton(hotspot);
        // Show context menu
        if (this.bindingContextMenu) {
          this.bindingContextMenu.show(hotspot.dataset.button, hotspot);
          this.bindingContextMenu.setCurrentBindings(this.customBindings);
        }
      });
      hotspot.addEventListener('mouseenter', () => this.highlightButton(hotspot, true));
      hotspot.addEventListener('mouseleave', () => this.highlightButton(hotspot, false));

      overlay.appendChild(hotspot);
      this.buttonElements[`yoke_${hs.id}`] = hotspot;
    });
  }

  showFlightYokeHighlight(buttonId, show) {
    const highlightImg = this.highlightImages[buttonId];
    if (highlightImg) {
      highlightImg.style.display = show ? 'block' : 'none';
    }
  }

  // ==================== LOGITECH FLIGHT THROTTLE ====================

  renderFlightThrottle() {
    const container = document.createElement('div');
    container.className = 'hotas-device-pair flight-throttle-single';

    const throttleUnit = document.createElement('div');
    throttleUnit.className = 'hotas-device-unit flight-throttle-unit';
    throttleUnit.innerHTML = `
      <div class="device-title">Logitech Flight Throttle Quadrant</div>
      <div class="flight-throttle-layout">
        <div class="device-image-container flight-throttle-container" id="flight-throttle-container">
          <img src="../../assets/controllers/Flight System Throttle/throttle-gallery-1_0003_Layer-1.png" alt="Flight Throttle" class="device-image flight-throttle-base-image" id="flight-throttle-base-img">
          <div class="flight-throttle-highlight-layer" id="flight-throttle-highlight-layer"></div>
          <div class="hotspot-overlay" id="flight-throttle-overlay"></div>
        </div>
        <div class="axis-display-panel flight-throttle-axis-panel">
          <div class="axis-display-header">Live Throttle Input</div>
          <div class="axis-displays throttle-axis-displays">
            <div class="axis-display-group">
              <button class="axis-display-label axis-bind-btn" data-axis="throttle_axis1" title="Click to bind Lever 1">Lever 1</button>
              <div class="trigger-bar throttle-lever-bar">
                <div class="trigger-fill" id="throttle-flaps-fill"></div>
              </div>
              <span class="trigger-value" id="throttle-flaps-val">0%</span>
            </div>
            <div class="axis-display-group">
              <button class="axis-display-label axis-bind-btn" data-axis="throttle_axis2" title="Click to bind Lever 2">Lever 2</button>
              <div class="trigger-bar throttle-lever-bar">
                <div class="trigger-fill" id="throttle-1-fill"></div>
              </div>
              <span class="trigger-value" id="throttle-1-val">0%</span>
            </div>
            <div class="axis-display-group">
              <button class="axis-display-label axis-bind-btn" data-axis="throttle_axis3" title="Click to bind Lever 3">Lever 3</button>
              <div class="trigger-bar throttle-lever-bar">
                <div class="trigger-fill" id="throttle-2-fill"></div>
              </div>
              <span class="trigger-value" id="throttle-2-val">0%</span>
            </div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(throttleUnit);

    // Add hotspots and preload highlight images after base image loads
    setTimeout(() => {
      this.addFlightThrottleHotspots();
      this.preloadFlightThrottleHighlights();
      this.setupAxisBindButtons();
    }, 100);

    return container;
  }

  preloadFlightThrottleHighlights() {
    // Map of button IDs to their highlight image filenames
    // Based on files: throttle-gallery-1_0000_T5_T6.png through throttle-gallery-1_0002_T1_T2.png
    const highlightMap = {
      'throttle_t5_t6': 'throttle-gallery-1_0000_T5_T6.png',
      'throttle_t3_t4': 'throttle-gallery-1_0001_T3_T4.png',
      'throttle_t1_t2': 'throttle-gallery-1_0002_T1_T2.png'
    };

    const highlightLayer = document.getElementById('flight-throttle-highlight-layer');
    if (!highlightLayer) return;

    // Create highlight images (hidden by default)
    const cacheBuster = Date.now();
    Object.entries(highlightMap).forEach(([buttonId, filename]) => {
      const img = document.createElement('img');
      img.src = `../../assets/controllers/Flight System Throttle/${filename}?v=${cacheBuster}`;
      img.className = 'flight-throttle-highlight-img';
      img.dataset.button = buttonId;
      img.style.display = 'none';
      img.onerror = () => console.error('Failed to load highlight image:', filename);
      highlightLayer.appendChild(img);
      this.highlightImages[buttonId] = img;
    });
  }

  addFlightThrottleHotspots() {
    const overlay = document.getElementById('flight-throttle-overlay');
    if (!overlay) return;

    // Hotspots for Flight Throttle Quadrant - positions calibrated using debug mode
    // The throttle has 6 toggle switches (T1-T6 in pairs) and 3 axis levers
    const hotspots = [
      // Toggle switches
      { id: 't1_t2', label: 'T1/T2 Toggle Switches', x: 59.8, y: 76.2, w: 4.7, h: 16.3, type: 'button', highlightId: 'throttle_t1_t2' },
      { id: 't3_t4', label: 'T3/T4 Toggle Switches', x: 65.3, y: 72.5, w: 4.4, h: 17.8, type: 'button', highlightId: 'throttle_t3_t4' },
      { id: 't5_t6', label: 'T5/T6 Toggle Switches', x: 70.6, y: 68.8, w: 4.9, h: 18.5, type: 'button', highlightId: 'throttle_t5_t6' },
      // Axis levers (3 levers from left to right)
      { id: 'axis1', label: 'Lever 1 (Throttle)', x: 26, y: 30, w: 8, h: 50, type: 'axis', highlightId: null },
      { id: 'axis2', label: 'Lever 2 (Mixture)', x: 36, y: 30, w: 8, h: 50, type: 'axis', highlightId: null },
      { id: 'axis3', label: 'Lever 3 (Prop Pitch)', x: 46, y: 30, w: 8, h: 50, type: 'axis', highlightId: null }
    ];

    hotspots.forEach(hs => {
      const hotspot = document.createElement('div');
      hotspot.className = `hotspot hotspot-${hs.type} flight-throttle-hotspot`;
      hotspot.style.left = `${hs.x}%`;
      hotspot.style.top = `${hs.y}%`;
      hotspot.style.width = `${hs.w}%`;
      hotspot.style.height = `${hs.h}%`;
      hotspot.dataset.button = `throttle_${hs.id}`;
      hotspot.dataset.label = hs.label;
      hotspot.dataset.type = hs.type;
      if (hs.highlightId) {
        hotspot.dataset.highlightId = hs.highlightId;
      }
      hotspot.title = hs.label;

      // Add event listeners directly (since these are created after setupEventListeners runs)
      hotspot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectButton(hotspot);
        // Show context menu
        if (this.bindingContextMenu) {
          this.bindingContextMenu.show(hotspot.dataset.button, hotspot);
          this.bindingContextMenu.setCurrentBindings(this.customBindings);
        }
      });
      hotspot.addEventListener('mouseenter', () => this.highlightButton(hotspot, true));
      hotspot.addEventListener('mouseleave', () => this.highlightButton(hotspot, false));

      overlay.appendChild(hotspot);
      this.buttonElements[`throttle_${hs.id}`] = hotspot;
    });
  }

  showFlightThrottleHighlight(buttonId, show) {
    const highlightImg = this.highlightImages[buttonId];
    if (highlightImg) {
      highlightImg.style.display = show ? 'block' : 'none';
    }
  }

  preloadX56ThrottleHighlights() {
    // Map of button IDs to their highlight image filenames
    // Using new images from X56 Throttle folder (x56-Throttle_0000 through x56-Throttle_0011)
    const highlightMap = {
      // Switch pairs - one toggle with dual actions (SW1+SW2, SW3+SW4, SW5+SW6)
      'x56_th_sw1_sw2': 'x56-Throttle_0000_SW1_2.png',
      'x56_th_sw3_sw4': 'x56-Throttle_0001_SW4-SW4.png',
      'x56_th_sw5_sw6': 'x56-Throttle_0002_SW5-SW6.png',
      // RTY3 rotary knob
      'x56_th_rty3': 'x56-Throttle_0003_RTY-3.png',
      // Toggles
      'x56_th_tgl2': 'x56-Throttle_0004_TGL-2.png',
      'x56_th_tgl1': 'x56-Throttle_0005_TGL-1.png',
      'x56_th_tgl3': 'x56-Throttle_0006_TGL-3.png',
      'x56_th_tgl4': 'x56-Throttle_0007_TGL-4.png',
      // Thumb controls
      'x56_th_thumb_btn': 'x56-Throttle_0008_Thumb-button.png',
      'x56_th_thumb_dpad': 'x56-Throttle_0009_thumb-dpad-switch.png',
      'x56_th_rear_ministick': 'x56-Throttle_0010_Rear-Thumb-Funky.png',
      'x56_th_thumb_ministick': 'x56-Throttle_0011_Thumb-funky.png'
    };

    const highlightLayer = document.getElementById('x56-throttle-highlight-layer');
    console.log('preloadX56ThrottleHighlights - highlightLayer:', highlightLayer);
    if (!highlightLayer) return;

    // Create highlight images (hidden by default)
    // Add cache-busting parameter to force reload of updated images
    const cacheBuster = Date.now();
    Object.entries(highlightMap).forEach(([buttonId, filename]) => {
      const img = document.createElement('img');
      img.src = `../../assets/controllers/X56 Throttle/${filename}?v=${cacheBuster}`;
      img.className = 'x56-throttle-highlight-img';
      img.dataset.button = buttonId;
      img.style.display = 'none';
      img.onerror = () => console.error('Failed to load X56 throttle highlight image:', filename);
      img.onload = () => console.log('Loaded X56 throttle highlight image:', filename);
      highlightLayer.appendChild(img);
      this.highlightImages[buttonId] = img;
      console.log('Added X56 throttle highlight image for:', buttonId);
    });
  }

  showX56ThrottleHighlight(buttonId, show) {
    const highlightImg = this.highlightImages[buttonId];
    if (highlightImg) {
      highlightImg.style.display = show ? 'block' : 'none';
    }
  }

  addX56ThrottleHotspots() {
    const overlay = document.getElementById('x56-throttle-overlay');
    if (!overlay) return;

    // Hotspots for X56 Throttle - switches, toggles, buttons, and ministicks
    // Coordinates based on highlight overlay positions measured from images
    // Rotary knobs are NOT included here - they go in the axis panel
    const hotspots = [
      // Switch pairs - each toggle has up/down positions (SW1 up, SW2 down, etc.)
      { id: 'sw1_sw2', label: 'SW1 Up / SW2 Down', x: 18, y: 48, w: 10, h: 7, type: 'dual-switch', highlightId: 'x56_th_sw1_sw2', actions: ['sw1_up', 'sw2_down'] },
      { id: 'sw3_sw4', label: 'SW3 Up / SW4 Down', x: 28, y: 52, w: 10, h: 7, type: 'dual-switch', highlightId: 'x56_th_sw3_sw4', actions: ['sw3_up', 'sw4_down'] },
      { id: 'sw5_sw6', label: 'SW5 Up / SW6 Down', x: 38, y: 56, w: 10, h: 6, type: 'dual-switch', highlightId: 'x56_th_sw5_sw6', actions: ['sw5_up', 'sw6_down'] },

      // Toggles (TGL1-4) - on the right side
      { id: 'tgl1', label: 'Toggle 1 (TGL1)', x: 65.5, y: 48, w: 7, h: 10, type: 'button', highlightId: 'x56_th_tgl1' },
      { id: 'tgl2', label: 'Toggle 2 (TGL2)', x: 75, y: 47.5, w: 8, h: 8, type: 'button', highlightId: 'x56_th_tgl2' },
      { id: 'tgl3', label: 'Toggle 3 (TGL3)', x: 76, y: 38, w: 7, h: 10, type: 'button', highlightId: 'x56_th_tgl3' },
      { id: 'tgl4', label: 'Toggle 4 (TGL4)', x: 85, y: 43, w: 7, h: 10, type: 'button', highlightId: 'x56_th_tgl4' },

      // Thumb Button - center top area
      { id: 'thumb_btn', label: 'Thumb Button', x: 57, y: 28, w: 9, h: 8, type: 'button', highlightId: 'x56_th_thumb_btn' },

      // Thumb D-Pad Switch - separate entity
      { id: 'thumb_dpad', label: 'Thumb D-Pad Switch', x: 62, y: 38.5, w: 8, h: 8, type: 'hat', highlightId: 'x56_th_thumb_dpad' },

      // Ministicks
      { id: 'rear_ministick', label: 'Rear Stick', x: 52, y: 38, w: 8, h: 10, type: 'hat', highlightId: 'x56_th_rear_ministick' },
      { id: 'thumb_ministick', label: 'Thumb Ministick', x: 67, y: 31, w: 8, h: 7, type: 'hat', highlightId: 'x56_th_thumb_ministick' },
    ];

    this.createX56ThrottleHotspots(overlay, hotspots);
  }

  createX56ThrottleHotspots(overlay, hotspots) {
    hotspots.forEach(hs => {
      const hotspot = document.createElement('div');
      hotspot.className = `hotspot hotspot-${hs.type} x56-throttle-hotspot`;
      hotspot.dataset.button = `x56_th_${hs.id}`;
      hotspot.dataset.label = hs.label;
      hotspot.dataset.type = hs.type;
      hotspot.dataset.highlightId = hs.highlightId;

      // Store dual actions for switch pairs
      if (hs.actions) {
        hotspot.dataset.actions = JSON.stringify(hs.actions);
      }

      hotspot.style.cssText = `
        position: absolute;
        left: ${hs.x}%;
        top: ${hs.y}%;
        width: ${hs.w}%;
        height: ${hs.h}%;
      `;

      // Add label tooltip
      const label = document.createElement('span');
      label.className = 'hotspot-label';
      label.textContent = hs.label;
      hotspot.appendChild(label);

      // Add event listeners
      hotspot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectButton(hotspot);
        // Show context menu
        if (this.bindingContextMenu) {
          this.bindingContextMenu.show(hotspot.dataset.button, hotspot);
          this.bindingContextMenu.setCurrentBindings(this.customBindings);
        }
      });
      hotspot.addEventListener('mouseenter', () => this.highlightButton(hotspot, true));
      hotspot.addEventListener('mouseleave', () => this.highlightButton(hotspot, false));

      overlay.appendChild(hotspot);
      this.buttonElements[`x56_th_${hs.id}`] = hotspot;
    });
  }

  preloadX56StickHighlights() {
    // Map of button IDs to their highlight image filenames
    // Images from X56 Stick folder
    const highlightMap = {
      'x56_js_pinky_switch': 'x56-stick_0000_Pinky-Switch.png',
      'x56_js_trigger': 'x56-stick_0002_Trigger.png',
      'x56_js_thumb_hat': 'x56-stick_0003_Thumb-Hat.png',
      'x56_js_thumb_dpad': 'x56-stick_0004_Thumb-Dpad.png',
      'x56_js_missile_btn': 'x56-stick_0005_Missle-Button.png',
      'x56_js_thumbstick': 'x56-stick_0006_Thumbstick.png'
    };

    const highlightLayer = document.getElementById('x56-stick-highlight-layer');
    console.log('preloadX56StickHighlights - highlightLayer:', highlightLayer);
    if (!highlightLayer) return;

    // Create highlight images (hidden by default)
    const cacheBuster = Date.now();
    Object.entries(highlightMap).forEach(([buttonId, filename]) => {
      const img = document.createElement('img');
      img.src = `../../assets/controllers/X56 Stick/${filename}?v=${cacheBuster}`;
      img.className = 'x56-stick-highlight-img';
      img.dataset.button = buttonId;
      img.style.display = 'none';
      img.onerror = () => console.error('Failed to load X56 Stick highlight image:', filename);
      img.onload = () => console.log('Loaded X56 Stick highlight image:', filename);
      highlightLayer.appendChild(img);
      this.highlightImages[buttonId] = img;
      console.log('Added X56 Stick highlight image for:', buttonId);
    });
  }

  addX56StickHotspots() {
    const overlay = document.getElementById('x56-stick-overlay');
    if (!overlay) return;

    // Hotspots for X56 Stick - coordinates based on highlight overlay positions
    const hotspots = [
      // Trigger (2-stage)
      { id: 'trigger', label: 'Trigger (2-stage)', x: 36.4, y: 18.2, w: 8, h: 6, type: 'button', highlightId: 'x56_js_trigger' },
      // Thumb Hat (8-way POV)
      { id: 'thumb_hat', label: 'Thumb Hat (8-way)', x: 45.5, y: 0, w: 6, h: 6, type: 'hat', highlightId: 'x56_js_thumb_hat' },
      // Thumb D-Pad (4-way)
      { id: 'thumb_dpad', label: 'Thumb D-Pad (4-way)', x: 47.5, y: 7.5, w: 5, h: 5, type: 'hat', highlightId: 'x56_js_thumb_dpad' },
      // Missile Button
      { id: 'missile_btn', label: 'Missile Button', x: 41.4, y: 2.5, w: 3, h: 3, type: 'button', highlightId: 'x56_js_missile_btn' },
      // Thumbstick (ministick)
      { id: 'thumbstick', label: 'Thumbstick', x: 37.9, y: 6.6, w: 5, h: 5, type: 'axis', highlightId: 'x56_js_thumbstick' },
      // Pinky Switch
      { id: 'pinky_switch', label: 'Pinky Switch', x: 32.6, y: 34.3, w: 8, h: 12, type: 'button', highlightId: 'x56_js_pinky_switch' },
    ];

    this.createX56StickHotspots(overlay, hotspots);
  }

  createX56StickHotspots(overlay, hotspots) {
    // Store original hotspot data for drag operations
    this.x56StickHotspotData = {};

    hotspots.forEach(hs => {
      const hotspot = document.createElement('div');
      hotspot.className = `hotspot hotspot-${hs.type} x56-stick-hotspot`;
      hotspot.dataset.button = `x56_js_${hs.id}`;
      hotspot.dataset.label = hs.label;
      hotspot.dataset.type = hs.type;
      hotspot.dataset.highlightId = hs.highlightId;
      hotspot.dataset.hotspotId = hs.id;

      // Store hotspot data
      this.x56StickHotspotData[hs.id] = { x: hs.x, y: hs.y, w: hs.w, h: hs.h };

      hotspot.style.cssText = `
        position: absolute;
        left: ${hs.x}%;
        top: ${hs.y}%;
        width: ${hs.w}%;
        height: ${hs.h}%;
      `;

      // Add label tooltip
      const label = document.createElement('span');
      label.className = 'hotspot-label';
      label.textContent = hs.label;
      hotspot.appendChild(label);

      // Add event listeners for click
      hotspot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectButton(hotspot);
        // Show context menu
        if (this.bindingContextMenu) {
          this.bindingContextMenu.show(hotspot.dataset.button, hotspot);
          this.bindingContextMenu.setCurrentBindings(this.customBindings);
        }
      });
      hotspot.addEventListener('mouseenter', () => {
        this.highlightButton(hotspot, true);
      });
      hotspot.addEventListener('mouseleave', () => {
        this.highlightButton(hotspot, false);
      });

      overlay.appendChild(hotspot);
      this.buttonElements[`x56_js_${hs.id}`] = hotspot;
    });
  }

  preloadVKBLeftHighlights() {
    // Map of button IDs to their highlight image filenames
    // Using new images from VKB Left folder - updated naming convention
    const highlightMap = {
      'vkb_l_trigger': 'vkb-left_0000_Trigger.png',           // Button 1 & 2 (Stage 1 & 2)
      'vkb_l_b1_side': 'vkb-left_0001_B1-(Side-Button).png',  // Side button
      'vkb_l_d1_pinky': 'vkb-left_0002_D1-(pinky-button).png', // Pinky button (Button 7)
      'vkb_l_base_switch': 'vkb-left_0003_Base-Switch.png',   // Base switch
      'vkb_l_f2': 'vkb-left_0004_F2.png',                     // F2 (Encoder - Button 12 press)
      'vkb_l_f1': 'vkb-left_0005_F1.png',                     // F1
      'vkb_l_f3': 'vkb-left_0006_F3.png',                     // F3
      'vkb_l_c1_thumb_hat': 'vkb-left_0007_C1-(Thumb-hat).png', // Thumb hat
      'vkb_l_a2_red': 'vkb-left_0008_A2-(Red-Button).png',    // Top red button (Button 3)
      'vkb_l_a3_center_hat': 'vkb-left_0009_A3-(center-hat).png', // Center hat (Button 4 for black btn)
      'vkb_l_a4_top_hat': 'vkb-left_0010_A4-(Top-Left-Hat).png', // Top left hat (A5/A6 buttons)
      'vkb_l_a1_ministick': 'vkb-left_0011_A1-(-mini-stick).png' // Mini-stick (Button 13 press)
    };

    const highlightLayer = document.getElementById('vkb-left-highlight-layer');
    console.log('preloadVKBLeftHighlights - highlightLayer:', highlightLayer);
    if (!highlightLayer) return;

    // Create highlight images (hidden by default)
    const cacheBuster = Date.now();
    Object.entries(highlightMap).forEach(([buttonId, filename]) => {
      const img = document.createElement('img');
      img.src = `../../assets/controllers/VKB Left/${filename}?v=${cacheBuster}`;
      img.className = 'vkb-left-highlight-img';
      img.dataset.button = buttonId;
      img.style.display = 'none';
      img.onerror = () => console.error('Failed to load VKB Left highlight image:', filename);
      img.onload = () => console.log('Loaded VKB Left highlight image:', filename);
      highlightLayer.appendChild(img);
      this.highlightImages[buttonId] = img;
      console.log('Added VKB Left highlight image for:', buttonId);
    });
  }

  preloadVKBRightHighlights() {
    // Map of button IDs to their highlight image filenames
    // Using images from VKB Right folder - updated naming convention
    const highlightMap = {
      'vkb_r_trigger': 'vkb-right_0000_Trigger.png',           // Button 1 & 2 (Stage 1 & 2)
      'vkb_r_b1_side': 'vkb-right_0001_B1-(Side-Button).png',  // Side button
      'vkb_r_d1_pinky': 'vkb-right_0002_D1-(pinky-button).png', // Pinky button (Button 7)
      'vkb_r_base_switch': 'vkb-right_0003_Base-Switch.png',   // Base switch
      'vkb_r_f2': 'vkb-right_0004_F2.png',                     // F2 (Encoder - Button 12 press)
      'vkb_r_f1': 'vkb-right_0005_F1.png',                     // F1
      'vkb_r_f3': 'vkb-right_0006_F3.png',                     // F3
      'vkb_r_c1_thumb_hat': 'vkb-right_0007_C1-(Thumb-hat).png', // Thumb hat
      'vkb_r_a2_red': 'vkb-right_0008_A2-(Red-Button).png',    // Top red button (Button 3)
      'vkb_r_a3_center_hat': 'vkb-right_0009_A3-(center-hat).png', // Center hat (Button 4 for black btn)
      'vkb_r_a4_top_hat': 'vkb-right_0010_A4-(Top-Right-Hat).png', // Top right hat
      'vkb_r_a1_ministick': 'vkb-right_0011_A1-(-mini-stick).png' // Mini-stick (Button 13 press)
    };

    const highlightLayer = document.getElementById('vkb-right-highlight-layer');
    console.log('preloadVKBRightHighlights - highlightLayer:', highlightLayer);
    if (!highlightLayer) return;

    // Create highlight images (hidden by default)
    const cacheBuster = Date.now();
    Object.entries(highlightMap).forEach(([buttonId, filename]) => {
      const img = document.createElement('img');
      img.src = `../../assets/controllers/vkb Right/${filename}?v=${cacheBuster}`;
      img.className = 'vkb-right-highlight-img';
      img.dataset.button = buttonId;
      img.style.display = 'none';
      img.onerror = () => console.error('Failed to load VKB Right highlight image:', filename);
      img.onload = () => console.log('Loaded VKB Right highlight image:', filename);
      highlightLayer.appendChild(img);
      this.highlightImages[buttonId] = img;
      console.log('Added VKB Right highlight image for:', buttonId);
    });
  }

  addVKBLeftHotspots() {
    const overlay = document.getElementById('vkb-left-overlay');
    if (!overlay) return;

    // Hotspots for VKB Left - calibrated coordinates
    // Windows Button mapping: 1=Trigger S1, 2=Trigger S2, 3=A2 Red, 4=A3 Black, 5=A5, 6=A6, 7=D1 Pinky, 12=F2 Encoder, 13=A1 Ministick
    const hotspots = [
      { id: 'trigger', label: 'Trigger (2-stage)', x: 68.2, y: 21.4, w: 16.4, h: 3.1, type: 'button', highlightId: 'vkb_l_trigger' },
      { id: 'b1_side', label: 'B1 Side Button', x: 71.8, y: 10.7, w: 7.5, h: 7, type: 'button', highlightId: 'vkb_l_b1_side' },
      { id: 'd1_pinky', label: 'D1 Pinky Button', x: 48.9, y: 38.6, w: 6.4, h: 9.9, type: 'button', highlightId: 'vkb_l_d1_pinky' },
      { id: 'base_switch', label: 'Base Switch', x: 26.1, y: 70.7, w: 5, h: 10, type: 'button', highlightId: 'vkb_l_base_switch' },
      { id: 'f2', label: 'F2 Encoder', x: 27.9, y: 60.4, w: 5, h: 6, type: 'button', highlightId: 'vkb_l_f2' },
      { id: 'f1', label: 'F1 Button', x: 33.6, y: 60.5, w: 5, h: 6, type: 'button', highlightId: 'vkb_l_f1' },
      { id: 'f3', label: 'F3 Button', x: 35, y: 67, w: 7.2, h: 5.8, type: 'button', highlightId: 'vkb_l_f3' },
      { id: 'c1_thumb_hat', label: 'C1 Thumb Hat (4-way)', x: 47.2, y: 30.6, w: 8, h: 8, type: 'hat', highlightId: 'vkb_l_c1_thumb_hat' },
      { id: 'a2_red', label: 'A2 Top Red Button', x: 61.4, y: 29.3, w: 6, h: 6, type: 'button', highlightId: 'vkb_l_a2_red' },
      { id: 'a3_center_hat', label: 'A3 Center Hat (5-way)', x: 59.8, y: 21.2, w: 6.6, h: 7.2, type: 'hat', highlightId: 'vkb_l_a3_center_hat' },
      { id: 'a4_top_hat', label: 'A4 Top Left Hat (4-way)', x: 64.6, y: 13, w: 7.9, h: 7.6, type: 'hat', highlightId: 'vkb_l_a4_top_hat' },
      { id: 'a1_ministick', label: 'A1 Mini-stick (5-way)', x: 65.6, y: 24.3, w: 7.9, h: 6.7, type: 'hat', highlightId: 'vkb_l_a1_ministick' },
    ];

    this.createVKBLeftHotspots(overlay, hotspots);
  }

  createVKBLeftHotspots(overlay, hotspots) {
    // Store original hotspot data for drag operations
    this.vkbLeftHotspotData = {};

    hotspots.forEach(hs => {
      const hotspot = document.createElement('div');
      hotspot.className = `hotspot hotspot-${hs.type} vkb-left-hotspot`;
      hotspot.dataset.button = `vkb_l_${hs.id}`;
      hotspot.dataset.label = hs.label;
      hotspot.dataset.type = hs.type;
      hotspot.dataset.highlightId = hs.highlightId;
      hotspot.dataset.hotspotId = hs.id;

      // Store hotspot data
      this.vkbLeftHotspotData[hs.id] = { x: hs.x, y: hs.y, w: hs.w, h: hs.h };

      hotspot.style.cssText = `
        position: absolute;
        left: ${hs.x}%;
        top: ${hs.y}%;
        width: ${hs.w}%;
        height: ${hs.h}%;
      `;

      // Add label tooltip
      const label = document.createElement('span');
      label.className = 'hotspot-label';
      label.textContent = hs.label;
      hotspot.appendChild(label);

      // Add position indicator for debug mode
      const posIndicator = document.createElement('span');
      posIndicator.className = 'hotspot-position-indicator';
      posIndicator.style.cssText = `
        position: absolute;
        bottom: -20px;
        left: 0;
        font-size: 10px;
        color: #0f0;
        background: rgba(0,0,0,0.8);
        padding: 2px 4px;
        border-radius: 3px;
        white-space: nowrap;
        pointer-events: none;
        display: none;
      `;
      posIndicator.textContent = `x:${hs.x} y:${hs.y} w:${hs.w} h:${hs.h}`;
      hotspot.appendChild(posIndicator);

      // Add drag-and-drop functionality
      this.setupHotspotDrag(hotspot, overlay, hs.id, posIndicator);

      // Add event listeners for click (only if not dragging)
      hotspot.addEventListener('click', (e) => {
        if (hotspot.dataset.wasDragged === 'true') {
          hotspot.dataset.wasDragged = 'false';
          return;
        }
        e.stopPropagation();
        this.selectButton(hotspot);
        // Show context menu
        if (this.bindingContextMenu) {
          this.bindingContextMenu.show(hotspot.dataset.button, hotspot);
          this.bindingContextMenu.setCurrentBindings(this.customBindings);
        }
      });
      hotspot.addEventListener('mouseenter', () => {
        this.highlightButton(hotspot, true);
      });
      hotspot.addEventListener('mouseleave', () => {
        this.highlightButton(hotspot, false);
      });

      overlay.appendChild(hotspot);
      this.buttonElements[`vkb_l_${hs.id}`] = hotspot;
    });
  }

  setupHotspotDrag(hotspot, overlay, hotspotId, posIndicator) {
    const DRAG_ENABLED = false; // Set to true to enable hotspot dragging for debug

    let isDragging = false;
    let startX, startY;
    let startLeft, startTop;

    const onMouseDown = (e) => {
      if (!DRAG_ENABLED) return;
      if (e.button !== 0) return; // Only left mouse button

      isDragging = true;
      hotspot.classList.add('dragging');
      hotspot.dataset.wasDragged = 'false';

      const overlayRect = overlay.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;

      const data = this.vkbLeftHotspotData[hotspotId];
      startLeft = data.x;
      startTop = data.y;

      posIndicator.style.display = 'block';

      e.preventDefault();
      e.stopPropagation();

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;

      hotspot.dataset.wasDragged = 'true';

      const overlayRect = overlay.getBoundingClientRect();
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Convert pixel delta to percentage
      const deltaXPercent = (deltaX / overlayRect.width) * 100;
      const deltaYPercent = (deltaY / overlayRect.height) * 100;

      let newX = startLeft + deltaXPercent;
      let newY = startTop + deltaYPercent;

      // Clamp to overlay bounds
      const data = this.vkbLeftHotspotData[hotspotId];
      newX = Math.max(0, Math.min(100 - data.w, newX));
      newY = Math.max(0, Math.min(100 - data.h, newY));

      // Round to 1 decimal place
      newX = Math.round(newX * 10) / 10;
      newY = Math.round(newY * 10) / 10;

      // Update position
      hotspot.style.left = `${newX}%`;
      hotspot.style.top = `${newY}%`;

      // Update stored data
      this.vkbLeftHotspotData[hotspotId].x = newX;
      this.vkbLeftHotspotData[hotspotId].y = newY;

      // Update position indicator
      posIndicator.textContent = `x:${newX} y:${newY} w:${data.w} h:${data.h}`;
    };

    const onMouseUp = (e) => {
      if (!isDragging) return;

      isDragging = false;
      hotspot.classList.remove('dragging');

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // Log final position to console for easy copying
      const data = this.vkbLeftHotspotData[hotspotId];
      console.log(`VKB Left Hotspot "${hotspotId}" position: { x: ${data.x}, y: ${data.y}, w: ${data.w}, h: ${data.h} }`);

      // Keep position indicator visible briefly after drag
      setTimeout(() => {
        if (!hotspot.matches(':hover')) {
          posIndicator.style.display = 'none';
        }
      }, 2000);
    };

    hotspot.addEventListener('mousedown', onMouseDown);
  }

  addVKBRightHotspots() {
    const overlay = document.getElementById('vkb-right-overlay');
    if (!overlay) return;

    // Hotspots for VKB Right - mirrored from calibrated VKB Left coordinates
    // Mirror formula: mirrored_x = 100 - original_x - original_width
    // Windows Button mapping: 1=Trigger S1, 2=Trigger S2, 3=A2 Red, 4=A3 Black, 5=A5, 6=A6, 7=D1 Pinky, 12=F2 Encoder, 13=A1 Ministick
    const hotspots = [
      // Trigger (2-stage) - Button 1 & 2
      { id: 'trigger', label: 'Trigger (2-stage)', x: 15.4, y: 21.4, w: 16.4, h: 3.1, type: 'button', highlightId: 'vkb_r_trigger' },
      // B1 Side button
      { id: 'b1_side', label: 'B1 Side Button', x: 20.7, y: 10.7, w: 7.5, h: 7, type: 'button', highlightId: 'vkb_r_b1_side' },
      // D1 Pinky button - Button 7
      { id: 'd1_pinky', label: 'D1 Pinky Button', x: 44.7, y: 38.6, w: 6.4, h: 9.9, type: 'button', highlightId: 'vkb_r_d1_pinky' },
      // Base switch
      { id: 'base_switch', label: 'Base Switch', x: 68.9, y: 70.7, w: 5, h: 10, type: 'button', highlightId: 'vkb_r_base_switch' },
      // F2 Encoder - Button 12 (press)
      { id: 'f2', label: 'F2 Encoder', x: 67.1, y: 60.4, w: 5, h: 6, type: 'button', highlightId: 'vkb_r_f2' },
      // F1 button
      { id: 'f1', label: 'F1 Button', x: 61.4, y: 60.5, w: 5, h: 6, type: 'button', highlightId: 'vkb_r_f1' },
      // F3 button
      { id: 'f3', label: 'F3 Button', x: 57.8, y: 67, w: 7.2, h: 5.8, type: 'button', highlightId: 'vkb_r_f3' },
      // C1 Thumb hat
      { id: 'c1_thumb_hat', label: 'C1 Thumb Hat (4-way)', x: 44.8, y: 30.6, w: 8, h: 8, type: 'hat', highlightId: 'vkb_r_c1_thumb_hat' },
      // A2 Top Red button - Button 3
      { id: 'a2_red', label: 'A2 Top Red Button', x: 32.6, y: 29.3, w: 6, h: 6, type: 'button', highlightId: 'vkb_r_a2_red' },
      // A3 Center hat (includes black button) - Button 4 for black
      { id: 'a3_center_hat', label: 'A3 Center Hat (5-way)', x: 33.6, y: 21.2, w: 6.6, h: 7.2, type: 'hat', highlightId: 'vkb_r_a3_center_hat' },
      // A4 Top Right hat
      { id: 'a4_top_hat', label: 'A4 Top Right Hat (4-way)', x: 27.5, y: 13, w: 7.9, h: 7.6, type: 'hat', highlightId: 'vkb_r_a4_top_hat' },
      // A1 Mini-stick - Button 13 (press)
      { id: 'a1_ministick', label: 'A1 Mini-stick (5-way)', x: 26.5, y: 24.3, w: 7.9, h: 6.7, type: 'hat', highlightId: 'vkb_r_a1_ministick' },
    ];

    this.createVKBRightHotspots(overlay, hotspots);
  }

  createVKBRightHotspots(overlay, hotspots) {
    hotspots.forEach(hs => {
      const hotspot = document.createElement('div');
      hotspot.className = `hotspot hotspot-${hs.type} vkb-right-hotspot`;
      hotspot.dataset.button = `vkb_r_${hs.id}`;
      hotspot.dataset.label = hs.label;
      hotspot.dataset.type = hs.type;
      hotspot.dataset.highlightId = hs.highlightId;

      hotspot.style.cssText = `
        position: absolute;
        left: ${hs.x}%;
        top: ${hs.y}%;
        width: ${hs.w}%;
        height: ${hs.h}%;
      `;

      // Add label tooltip
      const label = document.createElement('span');
      label.className = 'hotspot-label';
      label.textContent = hs.label;
      hotspot.appendChild(label);

      // Add event listeners
      hotspot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectButton(hotspot);
        // Show context menu
        if (this.bindingContextMenu) {
          this.bindingContextMenu.show(hotspot.dataset.button, hotspot);
          this.bindingContextMenu.setCurrentBindings(this.customBindings);
        }
      });
      hotspot.addEventListener('mouseenter', () => {
        this.highlightButton(hotspot, true);
      });
      hotspot.addEventListener('mouseleave', () => {
        this.highlightButton(hotspot, false);
      });

      overlay.appendChild(hotspot);
      this.buttonElements[`vkb_r_${hs.id}`] = hotspot;
    });
  }

  createHotspots(overlay, hotspots, prefix) {
    hotspots.forEach(hs => {
      const hotspot = document.createElement('div');
      hotspot.className = `hotspot hotspot-${hs.type}`;
      hotspot.dataset.button = `${prefix}_${hs.id}`;
      hotspot.dataset.label = hs.label;
      hotspot.dataset.type = hs.type;

      hotspot.style.cssText = `
        position: absolute;
        left: ${hs.x}%;
        top: ${hs.y}%;
        width: ${hs.w}%;
        height: ${hs.h}%;
      `;

      // Add label tooltip
      const label = document.createElement('span');
      label.className = 'hotspot-label';
      label.textContent = hs.label;
      hotspot.appendChild(label);

      overlay.appendChild(hotspot);
      this.buttonElements[`${prefix}_${hs.id}`] = hotspot;
    });
  }

  renderAxisPanel() {
    const panel = document.createElement('div');
    panel.className = 'hotas-axis-panel';

    // Devices that already have inline axis panels - return empty panel
    const devicesWithInlineAxisPanels = ['x56-hotas', 'x52-hotas', 'vkb-left', 'vkb-right', 'flight-yoke', 'flight-throttle'];
    if (devicesWithInlineAxisPanels.includes(this.activeDevice)) {
      // These devices have axis panels built into their render methods
      return panel;
    }

    if (this.activeDevice === 'x56-throttle') {
      // X56 Throttle - show throttle axes and rotary knobs with clickable labels
      panel.innerHTML = `
        <div class="hotas-axis-group">
          <button class="hotas-axis-btn" data-axis-id="x56_th_throttle_left">Left Throttle</button>
          <div class="axis-bar-vertical">
            <div class="axis-fill" id="x56-throttle-left-fill"></div>
          </div>
          <span class="axis-value" id="x56-throttle-left-val">0%</span>
        </div>
        <div class="hotas-axis-group">
          <button class="hotas-axis-btn" data-axis-id="x56_th_throttle_right">Right Throttle</button>
          <div class="axis-bar-vertical">
            <div class="axis-fill" id="x56-throttle-right-fill"></div>
          </div>
          <span class="axis-value" id="x56-throttle-right-val">0%</span>
        </div>
        <div class="hotas-axis-group">
          <button class="hotas-axis-btn" data-axis-id="x56_th_rty3">Rotary 3 (RTY3)</button>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="x56-rty3-fill"></div>
          </div>
          <span class="axis-value" id="x56-rty3-val">0.00</span>
        </div>
        <div class="hotas-axis-group">
          <button class="hotas-axis-btn" data-axis-id="x56_th_rty4">Rotary 4 (RTY4)</button>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="x56-rty4-fill"></div>
          </div>
          <span class="axis-value" id="x56-rty4-val">0.00</span>
        </div>
        <div class="hotas-axis-group">
          <button class="hotas-axis-btn" data-axis-id="x56_th_top_knob">Top Rotary Knob</button>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="x56-top-knob-fill"></div>
          </div>
          <span class="axis-value" id="x56-top-knob-val">0.00</span>
        </div>
        <div class="hotas-axis-group">
          <button class="hotas-axis-btn" data-axis-id="x56_th_bottom_knob">Bottom Rotary Knob</button>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="x56-bottom-knob-fill"></div>
          </div>
          <span class="axis-value" id="x56-bottom-knob-val">0.00</span>
        </div>
      `;

      // Add click handlers for axis buttons
      this.setupAxisButtonHandlers(panel);
    } else if (this.activeDevice === 'x56-stick') {
      // X56 Stick - show stick axes
      panel.innerHTML = `
        <div class="hotas-axis-group">
          <div class="hotas-axis-label">Stick X (Roll)</div>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="x56-stick-x-fill"></div>
          </div>
          <span class="axis-value" id="x56-stick-x-val">0.00</span>
        </div>
        <div class="hotas-axis-group">
          <div class="hotas-axis-label">Stick Y (Pitch)</div>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="x56-stick-y-fill"></div>
          </div>
          <span class="axis-value" id="x56-stick-y-val">0.00</span>
        </div>
        <div class="hotas-axis-group">
          <div class="hotas-axis-label">Twist (Yaw)</div>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="x56-twist-fill"></div>
          </div>
          <span class="axis-value" id="x56-twist-val">0.00</span>
        </div>
      `;
    } else if (this.activeDevice === 'vkb-left') {
      // VKB Left stick only
      panel.innerHTML = `
        <div class="hotas-axis-group">
          <div class="hotas-axis-label">X Axis (Strafe)</div>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="vkb-left-x-fill"></div>
          </div>
          <span class="axis-value" id="vkb-left-x-val">0.00</span>
        </div>
        <div class="hotas-axis-group">
          <div class="hotas-axis-label">Y Axis (Thrust)</div>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="vkb-left-y-fill"></div>
          </div>
          <span class="axis-value" id="vkb-left-y-val">0.00</span>
        </div>
        <div class="hotas-axis-group">
          <div class="hotas-axis-label">Twist (Roll)</div>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="vkb-left-twist-fill"></div>
          </div>
          <span class="axis-value" id="vkb-left-twist-val">0.00</span>
        </div>
      `;
    } else if (this.activeDevice === 'vkb-right') {
      // VKB Right stick only
      panel.innerHTML = `
        <div class="hotas-axis-group">
          <div class="hotas-axis-label">X Axis (Roll)</div>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="vkb-right-x-fill"></div>
          </div>
          <span class="axis-value" id="vkb-right-x-val">0.00</span>
        </div>
        <div class="hotas-axis-group">
          <div class="hotas-axis-label">Y Axis (Pitch)</div>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="vkb-right-y-fill"></div>
          </div>
          <span class="axis-value" id="vkb-right-y-val">0.00</span>
        </div>
        <div class="hotas-axis-group">
          <div class="hotas-axis-label">Twist (Yaw)</div>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="vkb-right-twist-fill"></div>
          </div>
          <span class="axis-value" id="vkb-right-twist-val">0.00</span>
        </div>
      `;
    } else if (this.activeDevice === 'ab9') {
      // AB9 stick axes with clickable buttons
      panel.innerHTML = `
        <div class="hotas-axis-group">
          <button class="hotas-axis-btn" data-axis-id="ab9_x_axis">X Axis (Roll)</button>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="ab9-x-fill"></div>
          </div>
          <span class="axis-value" id="ab9-x-val">0.00</span>
        </div>
        <div class="hotas-axis-group">
          <button class="hotas-axis-btn" data-axis-id="ab9_y_axis">Y Axis (Pitch)</button>
          <div class="axis-bar-horizontal">
            <div class="axis-center-line"></div>
            <div class="axis-fill" id="ab9-y-fill"></div>
          </div>
          <span class="axis-value" id="ab9-y-val">0.00</span>
        </div>
      `;

      // Add click handlers for axis buttons
      this.setupAxisButtonHandlers(panel);
    } else {
      // Default fallback
      panel.innerHTML = `<div class="hotas-axis-group"><div class="hotas-axis-label">No axes available</div></div>`;
    }

    return panel;
  }

  setupAxisButtonHandlers(panel) {
    const axisButtons = panel.querySelectorAll('.hotas-axis-btn');
    console.log('Setting up axis button handlers, found buttons:', axisButtons.length);
    axisButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const axisId = btn.dataset.axisId;
        console.log('Axis button clicked:', axisId, 'bindingContextMenu exists:', !!this.bindingContextMenu);
        if (axisId && this.bindingContextMenu) {
          // Deselect any other buttons
          axisButtons.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');

          // Show the binding context menu - pass the button element as anchor
          console.log('Calling bindingContextMenu.show with:', axisId);
          await this.bindingContextMenu.show(axisId, btn);
          this.bindingContextMenu.setCurrentBindings(this.customBindings);
        }
      });
    });
  }

  setupEventListeners() {
    // Device tabs
    this.container.querySelectorAll('.hotas-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeDevice = tab.dataset.device;
        this.render();
      });
    });

    // Hotspot interactions
    this.container.querySelectorAll('.hotspot').forEach(hs => {
      hs.addEventListener('click', () => this.selectButton(hs));
      hs.addEventListener('mouseenter', () => this.highlightButton(hs, true));
      hs.addEventListener('mouseleave', () => this.highlightButton(hs, false));
    });
  }

  selectButton(hs) {
    // Clear previous selection and hide previous highlight
    this.container.querySelectorAll('.hotspot.selected').forEach(el => {
      el.classList.remove('selected');
      // Hide previous highlight
      if (el.dataset.highlightId) {
        this.showHighlight(el.dataset.highlightId, false);
      }
    });

    hs.classList.add('selected');
    this.selectedButton = hs.dataset.button;
    this.showButtonBindings(hs.dataset.button, hs.dataset.label, hs.dataset.type);

    // Show highlight for selected button
    if (hs.dataset.highlightId) {
      this.showHighlight(hs.dataset.highlightId, true);
    }
  }

  highlightButton(hs, highlight) {
    if (highlight) {
      hs.classList.add('hover');
      this.showButtonBindings(hs.dataset.button, hs.dataset.label, hs.dataset.type);
      // Show image highlight
      if (hs.dataset.highlightId) {
        this.showHighlight(hs.dataset.highlightId, true);
      }
    } else {
      hs.classList.remove('hover');
      // Hide image highlight (unless selected)
      if (hs.dataset.highlightId && this.selectedButton !== hs.dataset.button) {
        this.showHighlight(hs.dataset.highlightId, false);
      }
      if (!this.selectedButton) {
        this.clearBindingInfo();
      }
    }
  }

  // Generic highlight show/hide for any device (AB9, X56 throttle, etc.)
  showHighlight(buttonId, show) {
    console.log('showHighlight called:', buttonId, show, 'available keys:', Object.keys(this.highlightImages));
    const highlightImg = this.highlightImages[buttonId];
    console.log('showHighlight:', buttonId, show, highlightImg ? 'found' : 'NOT FOUND');
    if (highlightImg) {
      highlightImg.style.display = show ? 'block' : 'none';
    }
  }

  showButtonBindings(buttonId, label, type) {
    const infoContent = document.getElementById('hotas-binding-info');
    if (!infoContent) return;

    // Map to Star Citizen binding keys
    const scKey = this.mapToSCKey(buttonId);
    const bindings = this.parser.getBindingsForKey(scKey);

    const typeLabel = type === 'axis' ? 'Axis' : type === 'hat' ? 'Hat Switch' : 'Button';

    // Get custom bindings for this button
    const customBindingsHtml = this.getCustomBindingsHtml(buttonId);

    if (bindings.length === 0 && !customBindingsHtml) {
      infoContent.innerHTML = `
        <div class="button-info">
          <div class="button-name">${label}</div>
          <div class="button-type">${typeLabel}</div>
          <div class="no-binding">No bindings assigned</div>
          <div class="sc-key-hint">SC Key: ${scKey}</div>
        </div>
      `;
      return;
    }

    const scBindingsHtml = bindings.map(b => `
      <div class="binding-row">
        <span class="binding-action">${b.label}</span>
        <span class="binding-category">${b.category || ''}</span>
      </div>
    `).join('');

    infoContent.innerHTML = `
      <div class="button-info">
        <div class="button-name">${label}</div>
        <div class="button-type">${typeLabel}</div>
        ${customBindingsHtml ? `<div class="custom-bindings-section"><div class="section-label">Custom Bindings:</div><div class="binding-list">${customBindingsHtml}</div></div>` : ''}
        ${scBindingsHtml ? `<div class="sc-bindings-section"><div class="section-label">SC File Bindings:</div><div class="binding-list">${scBindingsHtml}</div></div>` : ''}
        <div class="sc-key-hint">SC Key: ${scKey}</div>
      </div>
    `;
  }

  getCustomBindingsHtml(buttonId) {
    // Find all custom bindings for this button
    const relevantBindings = [];

    console.log('getCustomBindingsHtml for:', buttonId);
    console.log('All custom bindings:', this.customBindings);

    for (const [key, action] of Object.entries(this.customBindings)) {
      console.log('Checking key:', key, 'against buttonId:', buttonId);
      if (key.startsWith(buttonId + '_')) {
        const direction = key.replace(buttonId + '_', '');
        const displayDirection = this.formatDirection(direction);
        const displayAction = this.formatActionName(action);
        relevantBindings.push({ direction: displayDirection, action: displayAction, rawAction: action });
        console.log('Found matching binding:', key, '->', action);
      }
    }

    console.log('Relevant bindings found:', relevantBindings.length);

    if (relevantBindings.length === 0) return '';

    return relevantBindings.map(b => `
      <div class="binding-row custom-binding">
        <span class="binding-direction">${b.direction}:</span>
        <span class="binding-action">${b.action}</span>
      </div>
    `).join('');
  }

  formatDirection(direction) {
    const dirMap = {
      'action': 'Press',
      'short': 'Short Pull',
      'long': 'Long Pull',
      'press': 'Press',
      'up': 'Up',
      'down': 'Down',
      'left': 'Left',
      'right': 'Right',
      'forward': 'Forward',
      'back': 'Back',
      'diag_up_left': '↖ Up-Left',
      'diag_up_right': '↗ Up-Right',
      'diag_down_left': '↙ Down-Left',
      'diag_down_right': '↘ Down-Right'
    };
    return dirMap[direction] || direction;
  }

  formatActionName(action) {
    return action
      .replace(/^v_/, '')
      .replace(/^turret_/, 'Turret ')
      .replace(/^eva_/, 'EVA ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  clearBindingInfo() {
    const infoContent = document.getElementById('hotas-binding-info');
    if (infoContent) {
      infoContent.innerHTML = '<p class="hint-text">Click on a button, hat, or axis to see its Star Citizen bindings</p>';
    }
  }

  updateSidebarBindingsList() {
    // Get all category sections from the DOM (dynamically rendered based on game)
    const categorySections = document.querySelectorAll('.category-section[data-category-id]');

    // Clear all category binding containers and build category ID list
    const categoryIds = [];
    categorySections.forEach(section => {
      const categoryId = section.dataset.categoryId;
      if (categoryId) {
        categoryIds.push(categoryId);
        const container = document.getElementById(`bindings-${categoryId}`);
        if (container) container.innerHTML = '';
      }
    });

    // If no categories found, exit early
    if (categoryIds.length === 0) {
      console.log('No category sections found in sidebar');
      return;
    }

    // Update category counts
    const categoryCounts = {};
    categoryIds.forEach(cat => categoryCounts[cat] = 0);

    // Group bindings by category based on action
    for (const [key, action] of Object.entries(this.customBindings)) {
      const categoryId = this.getCategoryIdForAction(action);
      const container = document.getElementById(`bindings-${categoryId}`);
      if (!container) {
        // Try to find a fallback category (first one available)
        const fallbackContainer = document.getElementById(`bindings-${categoryIds[0]}`);
        if (fallbackContainer) {
          this.addBindingToContainer(fallbackContainer, key, action);
          categoryCounts[categoryIds[0]]++;
        }
        continue;
      }

      this.addBindingToContainer(container, key, action);
      categoryCounts[categoryId]++;
    }

    // Update category counts in UI
    categorySections.forEach(section => {
      const categoryId = section.dataset.categoryId;
      const countEl = section.querySelector('.category-count');
      if (countEl && categoryCounts[categoryId] !== undefined) {
        countEl.textContent = categoryCounts[categoryId];
      }
    });
  }

  addBindingToContainer(container, key, action) {
    // Parse key like "ab9_trigger_action" -> buttonId: "ab9_trigger", direction: "action"
    const lastUnderscore = key.lastIndexOf('_');
    const buttonId = key.substring(0, lastUnderscore);
    const direction = key.substring(lastUnderscore + 1);

    const buttonLabel = this.getButtonLabel(buttonId);
    const directionLabel = this.formatDirection(direction);
    const actionLabel = this.formatActionName(action);

    const item = document.createElement('div');
    item.className = 'sidebar-binding-item';
    item.dataset.buttonId = buttonId;
    item.dataset.key = key;
    item.innerHTML = `
      <span class="sidebar-binding-button">${buttonLabel}</span>
      <span class="sidebar-binding-direction">${directionLabel}</span>
      <span class="sidebar-binding-action">${actionLabel}</span>
      <button class="sidebar-binding-clear" title="Clear binding">&times;</button>
    `;

    // Click on the item navigates to the button
    item.addEventListener('click', (e) => {
      // Don't navigate if clicking the clear button
      if (!e.target.classList.contains('sidebar-binding-clear')) {
        this.navigateToButton(buttonId);
      }
    });

    // Clear button removes the binding
    const clearBtn = item.querySelector('.sidebar-binding-clear');
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearSingleBinding(key);
    });

    container.appendChild(item);
  }

  clearSingleBinding(key) {
    console.log('clearSingleBinding called with key:', key);

    // Remove from this.customBindings (used by sidebar)
    if (key in this.customBindings) {
      delete this.customBindings[key];
      console.log('Deleted from this.customBindings');
    }

    // Also remove from bindingContextMenu.customBindings (used by context menu)
    if (this.bindingContextMenu && key in this.bindingContextMenu.customBindings) {
      delete this.bindingContextMenu.customBindings[key];
      this.bindingContextMenu.saveCustomBindings();
      console.log('Deleted from bindingContextMenu.customBindings');
    }

    // Save our own copy too
    this.saveCustomBindings();

    // Update the UI
    this.updateBindingHighlights();
    this.updateSidebarBindingsList();

    console.log('Cleared binding:', key);
  }

  getCategoryIdForAction(action) {
    // Map actions to category IDs (sanitized names matching the sidebar)
    // These match the sanitized category names from game-config.json

    // Star Citizen patterns
    if (/^v_(strafe|roll|pitch|yaw|afterburner|space_brake|speed|accel|ifcs|toggle_landing|autoland|toggle_vtol|flightready|self_destruct)/.test(action)) {
      return 'flight-basic';
    }
    if (/^v_view_/.test(action)) {
      return 'flight-view';
    }
    if (/^v_power_|^v_capacitor_/.test(action)) {
      return 'flight-power';
    }
    if (/^v_(toggle_qdrive|toggle_quantum|dock|invoke_docking|toggle_docking)/.test(action)) {
      return 'flight-quantum-docking';
    }
    if (/^v_(attack|weapon_change|weapon_gimbal|weapon_manual|weapon_pip|weapon_bombing)/.test(action)) {
      return 'weapons';
    }
    if (/^v_weapon_(cycle_missile|launch_missile|decrease_max|increase_max|reset_max|toggle_launch)|^v_(weapon_countermeasure|shield_)/.test(action)) {
      return 'missiles-countermeasures';
    }
    if (/^v_target_|^v_(look_ahead|target_lock|target_pin|target_tracking)/.test(action)) {
      return 'targeting';
    }
    if (/^v_(invoke_ping|inc_ping|dec_ping|scanning_|inc_scan|dec_scan)|^tag_/.test(action)) {
      return 'radar-scanning';
    }
    if (/^v_(mining|toggle_mining|decrease_mining|increase_mining|jettison|salvage|toggle_salvage)/.test(action)) {
      return 'mining-salvage';
    }
    if (/^turret_/.test(action)) {
      return 'turret';
    }
    if (/^v_(boost|brake|move_|mgv_)/.test(action)) {
      return 'ground-vehicle';
    }
    if (/^(attack1|crouch|jump|sprint|walk|reload|holster|melee|throw|toggle_flashlight|weapon_|zoom|select|consume|drop|inspect|customize|ledgegrab|lean|prone)/.test(action)) {
      return 'on-foot';
    }
    if (/^eva_|^zgt_/.test(action)) {
      return 'eva';
    }
    if (/^(mobiglas|visor|foip|voip|comms|ui_|hud_|menu_)/.test(action)) {
      return 'social-ui';
    }
    if (/^view_/.test(action)) {
      return 'camera';
    }

    // MSFS patterns
    if (/^AP_|^AUTOPILOT/.test(action)) {
      return 'autopilot';
    }
    if (/^ENGINE|^THROTTLE|^MIXTURE|^PROPELLER/.test(action)) {
      return 'engine-controls';
    }
    if (/^AILERON|^ELEVATOR|^RUDDER|^FLAPS|^SPOILERS|^TRIM/.test(action)) {
      return 'flight-controls';
    }

    // Default fallback - return first available category
    return 'flight-basic';
  }

  getCategoryForAction(action) {
    // Map actions to categories based on prefix patterns
    if (/^v_(strafe|roll|pitch|yaw|afterburner|space_brake|speed|accel|ifcs|toggle_landing|autoland|toggle_vtol|flightready|self_destruct)/.test(action)) {
      return 'flight';
    }
    if (/^v_(attack|weapon_change|weapon_gimbal|weapon_manual|weapon_pip|weapon_bombing)/.test(action)) {
      return 'weapons';
    }
    if (/^v_target_|^v_(look_ahead|target_lock|target_pin|target_tracking)/.test(action)) {
      return 'targeting';
    }
    if (/^v_shield_/.test(action)) {
      return 'shields';
    }
    if (/^v_power_|^v_capacitor_/.test(action)) {
      return 'power';
    }
    if (/^v_(mining|toggle_mining|decrease_mining|increase_mining|jettison|salvage|toggle_salvage)/.test(action)) {
      return 'mining';
    }
    if (/^(attack1|crouch|jump|sprint|walk|reload|holster|melee|throw|toggle_flashlight|weapon_|zoom|select|consume|drop|inspect|customize|ledgegrab|lean|prone)/.test(action)) {
      return 'fps';
    }
    if (/^v_(boost|brake|move_|mgv_)/.test(action)) {
      return 'vehicles';
    }
    if (/^(mobiglas|visor|foip|voip|comms)/.test(action)) {
      return 'social';
    }
    if (/^(ui_|view_|hud_|menu_)/.test(action)) {
      return 'ui';
    }
    // Default to flight for spaceship actions
    if (/^v_/.test(action)) {
      return 'flight';
    }
    return 'ui'; // Default fallback
  }

  getButtonLabel(buttonId) {
    // Map button IDs to human-readable labels
    const labelMap = {
      // AB9 controls
      'ab9_trigger': 'Trigger (2-stage)',
      'ab9_thumb_missile': 'Missile Button',
      'ab9_pinky_btn': 'Pinky Button',
      'ab9_pinky_switch': 'Pinky Switch',
      'ab9_index_btn': 'Index Button',
      'ab9_funky_knob': 'Funky Knob (4-way)',
      'ab9_bottom_dpad': 'Bottom D-Pad (4-way)',
      'ab9_thumb_fakey': 'Thumb Fakey (5-way)',
      'ab9_top_dpad': 'Top D-Pad (5-way)',
      'ab9_thumb_switch': 'Thumb Switch',
      'ab9_thumb_hat': 'Thumb Hat (8-way)',
      'ab9_y_axis': 'Y Axis (Pitch)',
      'ab9_x_axis': 'X Axis (Roll)',
      'ab9_pitch': 'Pitch Axis',
      'ab9_roll': 'Roll Axis',
      // X56 Throttle controls
      'x56_th_sw1_sw2': 'SW1 Up / SW2 Down',
      'x56_th_sw3_sw4': 'SW3 Up / SW4 Down',
      'x56_th_sw5_sw6': 'SW5 Up / SW6 Down',
      'x56_th_tgl1': 'Toggle 1',
      'x56_th_tgl2': 'Toggle 2',
      'x56_th_tgl3': 'Toggle 3',
      'x56_th_tgl4': 'Toggle 4',
      'x56_th_thumb_btn': 'Thumb Button',
      'x56_th_thumb_dpad': 'Thumb D-Pad',
      'x56_th_rear_ministick': 'Rear Stick',
      'x56_th_thumb_ministick': 'Thumb Ministick'
    };
    return labelMap[buttonId] || buttonId;
  }

  navigateToButton(buttonId) {
    // First, switch to HOTAS view if we're on a different view
    const hotasView = document.getElementById('hotas-view');
    const isHotasViewActive = hotasView && hotasView.classList.contains('active');

    if (!isHotasViewActive) {
      // Switch to HOTAS view using the app's switchView method
      if (window.app && window.app.switchView) {
        window.app.switchView('hotas');
      }
      // Wait for view switch, then continue with device/button selection
      setTimeout(() => this.navigateToButtonInternal(buttonId), 100);
    } else {
      this.navigateToButtonInternal(buttonId);
    }
  }

  navigateToButtonInternal(buttonId) {
    // Switch to the correct device (AB9, X56, VKB) if needed
    if (buttonId.startsWith('ab9_') && this.activeDevice !== 'ab9') {
      this.activeDevice = 'ab9';
      this.render();
      // Wait for render to complete, then highlight
      setTimeout(() => this.highlightAndSelectButton(buttonId), 150);
    } else if (buttonId.startsWith('x56_th_') && this.activeDevice !== 'x56-throttle') {
      this.activeDevice = 'x56-throttle';
      this.render();
      setTimeout(() => this.highlightAndSelectButton(buttonId), 150);
    } else if (buttonId.startsWith('x56-js_') && this.activeDevice !== 'x56-stick') {
      this.activeDevice = 'x56-stick';
      this.render();
      setTimeout(() => this.highlightAndSelectButton(buttonId), 150);
    } else if (buttonId.startsWith('vkb-l_') && this.activeDevice !== 'vkb-left') {
      this.activeDevice = 'vkb-left';
      this.render();
      setTimeout(() => this.highlightAndSelectButton(buttonId), 150);
    } else if (buttonId.startsWith('vkb-r_') && this.activeDevice !== 'vkb-right') {
      this.activeDevice = 'vkb-right';
      this.render();
      setTimeout(() => this.highlightAndSelectButton(buttonId), 150);
    } else {
      this.highlightAndSelectButton(buttonId);
    }
  }

  highlightAndSelectButton(buttonId) {
    const hotspot = this.buttonElements[buttonId];
    if (hotspot) {
      // Clear previous selection
      this.container.querySelectorAll('.hotspot.selected').forEach(el => {
        el.classList.remove('selected');
        if (el.dataset.highlightId) {
          this.showHighlight(el.dataset.highlightId, false);
        }
      });

      // Select and highlight the button
      this.selectButton(hotspot);

      // Scroll the hotspot into view
      hotspot.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  mapToSCKey(buttonId) {
    // Map internal button IDs to Star Citizen binding format
    // This would need to match your actual SC binding file format

    // X56 Throttle mappings (typically js2_ in SC)
    const x56ThrottleMap = {
      'x56-th_th_left_axis': 'js2_throttlez',
      'x56-th_th_right_axis': 'js2_throttlez',
      'x56-th_th_hat1': 'js2_hat1',
      'x56-th_th_hat2': 'js2_hat2',
      'x56-th_th_btn_e': 'js2_button5',
      'x56-th_th_btn_f': 'js2_button6',
      'x56-th_th_rotary1': 'js2_rotz',
      'x56-th_th_toggle1': 'js2_button7',
      'x56-th_th_mode': 'js2_button15',
    };

    // X56 Stick mappings (typically js1_ in SC)
    const x56StickMap = {
      'x56-js_js_trigger': 'js1_button1',
      'x56-js_js_trigger2': 'js1_button2',
      'x56-js_js_pov': 'js1_hat1',
      'x56-js_js_hat1': 'js1_hat2',
      'x56-js_js_hat2': 'js1_hat3',
      'x56-js_js_btn_a': 'js1_button3',
      'x56-js_js_btn_b': 'js1_button4',
      'x56-js_js_btn_c': 'js1_button5',
      'x56-js_js_x_axis': 'js1_x',
      'x56-js_js_y_axis': 'js1_y',
      'x56-js_js_twist': 'js1_rotz',
    };

    // VKB Left mappings
    const vkbLeftMap = {
      'vkb-l_trigger': 'js2_button1',
      'vkb-l_trigger2': 'js2_button2',
      'vkb-l_pov': 'js2_hat1',
      'vkb-l_hat2': 'js2_hat2',
      'vkb-l_btn1': 'js2_button3',
      'vkb-l_btn2': 'js2_button4',
      'vkb-l_pinky': 'js2_button5',
      'vkb-l_x_axis': 'js2_x',
      'vkb-l_y_axis': 'js2_y',
      'vkb-l_twist': 'js2_rotz',
    };

    // VKB Right mappings
    const vkbRightMap = {
      'vkb-r_trigger': 'js1_button1',
      'vkb-r_trigger2': 'js1_button2',
      'vkb-r_pov': 'js1_hat1',
      'vkb-r_hat2': 'js1_hat2',
      'vkb-r_btn1': 'js1_button3',
      'vkb-r_btn2': 'js1_button4',
      'vkb-r_pinky': 'js1_button5',
      'vkb-r_x_axis': 'js1_x',
      'vkb-r_y_axis': 'js1_y',
      'vkb-r_twist': 'js1_rotz',
    };

    return x56ThrottleMap[buttonId] ||
           x56StickMap[buttonId] ||
           vkbLeftMap[buttonId] ||
           vkbRightMap[buttonId] ||
           buttonId;
  }

  handleInput(event, data) {
    if (event === 'connected') {
      this.updateConnectionStatus(true, data.id);
    } else if (event === 'disconnected') {
      this.updateConnectionStatus(false);
    } else if (event === 'input') {
      this.updateLiveInput(data);
    }
  }

  updateConnectionStatus(connected, deviceName = '') {
    const statusBar = document.getElementById('hotas-status');
    if (!statusBar) return;

    const indicator = statusBar.querySelector('.status-indicator');
    const text = statusBar.querySelector('.status-text');
    const hint = statusBar.querySelector('.status-hint');

    if (connected) {
      indicator.className = 'status-indicator connected';
      text.textContent = deviceName;
      hint.textContent = 'Live input active';
    } else {
      indicator.className = 'status-indicator disconnected';
      text.textContent = 'No HOTAS connected';
      hint.textContent = 'Connect your HOTAS to see live input';
    }
  }

  updateLiveInput(data) {
    // Update axis displays based on current device
    if (this.activeDevice === 'x56' || this.activeDevice === 'x56-hotas') {
      // Combined view - uses combined axis mapping
      this.updateX56CombinedAxes(data.axes, data.buttons);
    } else if (this.activeDevice === 'x56-stick') {
      // Stick-only view - stick has its own gamepad with different axis mapping
      this.updateX56StickAxes(data.axes, data.buttons);
    } else if (this.activeDevice === 'x56-throttle') {
      // Throttle-only view - throttle has its own gamepad with different axis mapping
      this.updateX56ThrottleAxes(data.axes, data.buttons);
    } else if (this.activeDevice === 'x52' || this.activeDevice === 'x52-hotas') {
      this.updateX52Axes(data.axes, data.buttons);
    } else if (this.activeDevice === 'flight-yoke') {
      this.updateFlightYokeAxes(data.axes, data.buttons);
    } else if (this.activeDevice === 'flight-throttle') {
      this.updateFlightThrottleAxes(data.axes, data.buttons);
    } else if (this.activeDevice === 'vkb-left' || this.activeDevice === 'vkb-right') {
      this.updateVKBAxes(data.axes, data.buttons);
    } else if (this.activeDevice === 'ab9') {
      this.updateAB9Axes(data.axes, data.buttons);
    }

    // Highlight pressed buttons
    this.updateButtonStates(data.buttons);
  }

  // X56 Stick standalone - when stick is its own gamepad
  // Typical axis mapping: 0=Roll, 1=Pitch, 2=Twist/Yaw
  updateX56StickAxes(axes, buttons) {
    const stickDot = document.getElementById('x56-stick-dot');
    const pitchVal = document.getElementById('x56-pitch-val');
    const rollVal = document.getElementById('x56-roll-val');

    if (stickDot) {
      // axes[0] = Roll (X), axes[1] = Pitch (Y)
      const rollPos = axes[0] ? ((axes[0].value + 1) / 2) * 100 : 50;
      const pitchPos = axes[1] ? ((axes[1].value + 1) / 2) * 100 : 50;
      stickDot.style.left = `${rollPos}%`;
      stickDot.style.top = `${pitchPos}%`;
    }

    if (pitchVal && axes[1]) pitchVal.textContent = axes[1].value.toFixed(2);
    if (rollVal && axes[0]) rollVal.textContent = axes[0].value.toFixed(2);

    // Yaw/Twist axis - axis 2 on standalone stick
    if (axes[2]) {
      this.updateCenteredAxisBar('x56-yaw', axes[2].value);
    }
  }

  // X56 Throttle standalone - when throttle is its own gamepad
  // Typical axis mapping: 0=Left Throttle, 1=Right Throttle, 2+=Rotaries
  updateX56ThrottleAxes(axes, buttons) {
    // Throttle 1 (left) - axis 0 on standalone throttle
    if (axes[0]) {
      const throttle1Val = ((axes[0].value + 1) / 2) * 100; // Convert -1...1 to 0...100
      const throttle1Fill = document.getElementById('x56-throttle1-fill');
      const throttle1Display = document.getElementById('x56-throttle1-val');
      if (throttle1Fill) throttle1Fill.style.height = `${throttle1Val}%`;
      if (throttle1Display) throttle1Display.textContent = `${Math.round(throttle1Val)}%`;
    }

    // Throttle 2 (right) - axis 1 on standalone throttle
    if (axes[1]) {
      const throttle2Val = ((axes[1].value + 1) / 2) * 100;
      const throttle2Fill = document.getElementById('x56-throttle2-fill');
      const throttle2Display = document.getElementById('x56-throttle2-val');
      if (throttle2Fill) throttle2Fill.style.height = `${throttle2Val}%`;
      if (throttle2Display) throttle2Display.textContent = `${Math.round(throttle2Val)}%`;
    }
  }

  // X56 Combined view - when viewing both stick and throttle together
  // This assumes the data is aggregated or from first gamepad found
  updateX56CombinedAxes(axes, buttons) {
    // For combined view, we try to handle both stick and throttle
    // Stick pitch/roll (X=roll, Y=pitch) - axes 0,1
    const stickDot = document.getElementById('x56-stick-dot');
    const pitchVal = document.getElementById('x56-pitch-val');
    const rollVal = document.getElementById('x56-roll-val');

    if (stickDot) {
      const rollPos = axes[0] ? ((axes[0].value + 1) / 2) * 100 : 50;
      const pitchPos = axes[1] ? ((axes[1].value + 1) / 2) * 100 : 50;
      stickDot.style.left = `${rollPos}%`;
      stickDot.style.top = `${pitchPos}%`;
    }

    if (pitchVal && axes[1]) pitchVal.textContent = axes[1].value.toFixed(2);
    if (rollVal && axes[0]) rollVal.textContent = axes[0].value.toFixed(2);

    // Yaw/Twist axis - axis 2 (Z rotation)
    if (axes[2]) {
      this.updateCenteredAxisBar('x56-yaw', axes[2].value);
    }

    // Thumbstick on the X56 stick - uses X Rotation (axis 3) and Y Rotation (axis 4)
    const thumbstickXVal = document.getElementById('x56-thumbstick-x-val');
    const thumbstickYVal = document.getElementById('x56-thumbstick-y-val');

    // Update thumbstick X axis bar
    if (axes[3]) {
      this.updateCenteredAxisBar('x56-thumbstick-x', axes[3].value);
      if (thumbstickXVal) thumbstickXVal.textContent = axes[3].value.toFixed(2);
    }

    // Update thumbstick Y axis bar
    if (axes[4]) {
      this.updateCenteredAxisBar('x56-thumbstick-y', axes[4].value);
      if (thumbstickYVal) thumbstickYVal.textContent = axes[4].value.toFixed(2);
    }

    // Throttle 1 (left) - axis 6 (Slider 0)
    if (axes[6]) {
      const throttle1Val = ((axes[6].value + 1) / 2) * 100;
      const throttle1Fill = document.getElementById('x56-throttle1-fill');
      const throttle1Display = document.getElementById('x56-throttle1-val');
      if (throttle1Fill) throttle1Fill.style.height = `${throttle1Val}%`;
      if (throttle1Display) throttle1Display.textContent = `${Math.round(throttle1Val)}%`;
    }

    // Throttle 2 (right) - axis 7 (Slider 1)
    if (axes[7]) {
      const throttle2Val = ((axes[7].value + 1) / 2) * 100;
      const throttle2Fill = document.getElementById('x56-throttle2-fill');
      const throttle2Display = document.getElementById('x56-throttle2-val');
      if (throttle2Fill) throttle2Fill.style.height = `${throttle2Val}%`;
      if (throttle2Display) throttle2Display.textContent = `${Math.round(throttle2Val)}%`;
    }
  }

  updateX52Axes(axes, buttons) {
    // X52 has single throttle on the throttle unit
    // Throttle - typically axis 2
    if (axes[2]) {
      const throttleVal = ((axes[2].value + 1) / 2) * 100; // Convert -1...1 to 0...100
      const throttleFill = document.getElementById('x52-throttle-fill');
      const throttleDisplay = document.getElementById('x52-throttle-val');
      if (throttleFill) throttleFill.style.height = `${throttleVal}%`;
      if (throttleDisplay) throttleDisplay.textContent = `${Math.round(throttleVal)}%`;
    }

    // Stick pitch/roll (X=roll, Y=pitch)
    const stickDot = document.getElementById('x52-stick-dot');
    const pitchVal = document.getElementById('x52-pitch-val');
    const rollVal = document.getElementById('x52-roll-val');

    if (stickDot) {
      // axes[0] = Roll (X), axes[1] = Pitch (Y)
      const rollPos = axes[0] ? ((axes[0].value + 1) / 2) * 100 : 50;
      const pitchPos = axes[1] ? ((axes[1].value + 1) / 2) * 100 : 50;
      stickDot.style.left = `${rollPos}%`;
      stickDot.style.top = `${pitchPos}%`;
    }

    if (pitchVal && axes[1]) pitchVal.textContent = axes[1].value.toFixed(2);
    if (rollVal && axes[0]) rollVal.textContent = axes[0].value.toFixed(2);

    // Yaw/Twist axis - typically axis 5
    if (axes[5]) {
      this.updateCenteredAxisBar('x52-yaw', axes[5].value);
    }
  }

  updateVKBAxes(axes, buttons) {
    // VKB Left stick pitch/roll
    const leftDot = document.getElementById('vkb-left-stick-dot');
    const leftPitchVal = document.getElementById('vkb-left-pitch-val');
    const leftRollVal = document.getElementById('vkb-left-roll-val');

    if (leftDot) {
      const rollPos = axes[0] ? ((axes[0].value + 1) / 2) * 100 : 50;
      const pitchPos = axes[1] ? ((axes[1].value + 1) / 2) * 100 : 50;
      leftDot.style.left = `${rollPos}%`;
      leftDot.style.top = `${pitchPos}%`;
    }

    if (leftPitchVal && axes[1]) leftPitchVal.textContent = axes[1].value.toFixed(2);
    if (leftRollVal && axes[0]) leftRollVal.textContent = axes[0].value.toFixed(2);

    // VKB Left twist (yaw) - typically axis 2 or 5
    if (axes[2]) {
      this.updateCenteredAxisBar('vkb-left-yaw', axes[2].value);
    }

    // VKB Right stick pitch/roll (would need multi-device support for separate devices)
    const rightDot = document.getElementById('vkb-right-stick-dot');
    const rightPitchVal = document.getElementById('vkb-right-pitch-val');
    const rightRollVal = document.getElementById('vkb-right-roll-val');

    if (rightDot) {
      // If multi-device, these would be different axes or from a different gamepad
      const rollPos = axes[3] ? ((axes[3].value + 1) / 2) * 100 : 50;
      const pitchPos = axes[4] ? ((axes[4].value + 1) / 2) * 100 : 50;
      rightDot.style.left = `${rollPos}%`;
      rightDot.style.top = `${pitchPos}%`;
    }

    if (rightPitchVal && axes[4]) rightPitchVal.textContent = axes[4].value.toFixed(2);
    if (rightRollVal && axes[3]) rightRollVal.textContent = axes[3].value.toFixed(2);

    // VKB Right twist (yaw)
    if (axes[5]) {
      this.updateCenteredAxisBar('vkb-right-yaw', axes[5].value);
    }

    // Update button lists for VKB Left and Right
    this.updateVKBButtonList(buttons);
  }

  updateVKBButtonList(buttons) {
    // Determine which button list to update based on active device
    const listId = this.activeDevice === 'vkb-left' ? 'vkb-left-button-list' : 'vkb-right-button-list';
    const buttonList = document.getElementById(listId);
    if (!buttonList) return;

    // Find pressed buttons
    const pressedButtons = [];
    buttons.forEach((btn, index) => {
      if (btn.pressed || btn.value > 0.5) {
        pressedButtons.push(`B${index + 1}`);
      }
    });

    if (pressedButtons.length > 0) {
      buttonList.innerHTML = pressedButtons.map(btn =>
        `<span class="button-input-item">${btn}</span>`
      ).join('');
    } else {
      buttonList.textContent = 'None';
    }
  }

  // Update a centered axis bar (for yaw/twist display, centered at 0)
  updateCenteredAxisBar(prefix, value) {
    const fill = document.getElementById(`${prefix}-fill`);
    const val = document.getElementById(`${prefix}-val`);

    if (fill) {
      // Value is -1 to 1, centered at 0
      const width = Math.abs(value) * 50; // 50% max on each side
      if (value < 0) {
        fill.style.width = `${width}%`;
        fill.style.left = `${50 - width}%`;
      } else {
        fill.style.width = `${width}%`;
        fill.style.left = '50%';
      }
    }

    if (val) val.textContent = value.toFixed(2);
  }

  updateFlightYokeAxes(axes, buttons) {
    // Flight Yoke has X-axis (pitch) and Y-axis (roll)
    // Typically mapped to axes 0 and 1
    const axisDot = document.getElementById('yoke-axis-dot');
    const xVal = document.getElementById('yoke-x-val');
    const yVal = document.getElementById('yoke-y-val');

    if (axisDot) {
      // Convert -1...1 to percentage position (0-100%)
      const xPos = axes[0] ? ((axes[0].value + 1) / 2) * 100 : 50;
      const yPos = axes[1] ? ((axes[1].value + 1) / 2) * 100 : 50;

      // Position the dot (50% is center)
      axisDot.style.left = `${xPos}%`;
      axisDot.style.top = `${yPos}%`;
    }

    if (xVal && axes[0]) {
      xVal.textContent = axes[0].value.toFixed(2);
    }
    if (yVal && axes[1]) {
      yVal.textContent = axes[1].value.toFixed(2);
    }
  }

  updateFlightThrottleAxes(axes, buttons) {
    // Flight Throttle Quadrant has 3 lever axes
    // Typically: Axis 0 = Flaps, Axis 1 = Throttle 1, Axis 2 = Throttle 2
    // Note: The actual axis mapping may vary - adjust if needed

    // Update Flaps lever (axis 0)
    if (axes[0]) {
      const flapsFill = document.getElementById('throttle-flaps-fill');
      const flapsVal = document.getElementById('throttle-flaps-val');
      const flapsPercent = ((axes[0].value + 1) / 2) * 100; // Convert -1...1 to 0...100

      if (flapsFill) flapsFill.style.height = `${flapsPercent}%`;
      if (flapsVal) flapsVal.textContent = `${Math.round(flapsPercent)}%`;
    }

    // Update Throttle 1 lever (axis 1)
    if (axes[1]) {
      const throttle1Fill = document.getElementById('throttle-1-fill');
      const throttle1Val = document.getElementById('throttle-1-val');
      const throttle1Percent = ((axes[1].value + 1) / 2) * 100;

      if (throttle1Fill) throttle1Fill.style.height = `${throttle1Percent}%`;
      if (throttle1Val) throttle1Val.textContent = `${Math.round(throttle1Percent)}%`;
    }

    // Update Throttle 2 lever (axis 2)
    if (axes[2]) {
      const throttle2Fill = document.getElementById('throttle-2-fill');
      const throttle2Val = document.getElementById('throttle-2-val');
      const throttle2Percent = ((axes[2].value + 1) / 2) * 100;

      if (throttle2Fill) throttle2Fill.style.height = `${throttle2Percent}%`;
      if (throttle2Val) throttle2Val.textContent = `${Math.round(throttle2Percent)}%`;
    }
  }

  updateAB9Axes(axes, buttons) {
    // AB9 Flight Stick has pitch and roll axes
    // Typical axis mapping: 0=Roll (X), 1=Pitch (Y)
    const stickDot = document.getElementById('ab9-stick-dot');
    const pitchVal = document.getElementById('ab9-pitch-val');
    const rollVal = document.getElementById('ab9-roll-val');

    if (stickDot) {
      // axes[0] = Roll (X), axes[1] = Pitch (Y)
      const rollPos = axes[0] ? ((axes[0].value + 1) / 2) * 100 : 50;
      const pitchPos = axes[1] ? ((axes[1].value + 1) / 2) * 100 : 50;
      stickDot.style.left = `${rollPos}%`;
      stickDot.style.top = `${pitchPos}%`;
    }

    if (pitchVal && axes[1]) pitchVal.textContent = axes[1].value.toFixed(2);
    if (rollVal && axes[0]) rollVal.textContent = axes[0].value.toFixed(2);
  }

  updateHorizontalAxis(prefix, value) {
    const fill = document.getElementById(`${prefix}-fill`);
    const val = document.getElementById(`${prefix}-val`);

    if (fill) {
      const width = Math.abs(value) * 50;
      fill.style.width = `${width}%`;
      fill.style.left = value < 0 ? `${50 - width}%` : '50%';
    }

    if (val) val.textContent = value.toFixed(2);
  }

  updateButtonStates(buttons) {
    // This would map gamepad buttons to hotspots and highlight them
    // Implementation depends on your specific device mapping

    // Update the button input display panel
    this.updateButtonInputDisplay(buttons);
  }

  /**
   * Update the live button input display showing which buttons are currently pressed
   */
  updateButtonInputDisplay(buttons) {
    // Determine which button list element(s) to use based on active device
    let buttonListIds = [];
    if (this.activeDevice === 'x56' || this.activeDevice === 'x56-hotas') {
      buttonListIds = ['x56-button-list'];
    } else if (this.activeDevice === 'x56-throttle') {
      buttonListIds = ['x56-throttle-button-list'];
    } else if (this.activeDevice === 'x56-stick') {
      buttonListIds = ['x56-stick-button-list'];
    } else if (this.activeDevice === 'x52' || this.activeDevice === 'x52-hotas') {
      buttonListIds = ['x52-button-list'];
    } else if (this.activeDevice === 'vkb-left') {
      buttonListIds = ['vkb-left-button-list'];
    } else if (this.activeDevice === 'vkb-right') {
      buttonListIds = ['vkb-right-button-list'];
    } else if (this.activeDevice === 'ab9') {
      buttonListIds = ['ab9-button-list'];
    }

    // Find all pressed buttons and track newly pressed ones
    const pressedButtons = [];
    const currentPressedIndices = new Set();

    if (buttons && Array.isArray(buttons)) {
      buttons.forEach((btn, index) => {
        if (btn && btn.pressed) {
          pressedButtons.push(`Btn ${index + 1}`);
          currentPressedIndices.add(index);

          // Check for newly pressed button during wizard (wasn't pressed in last frame)
          if (this.buttonMappingWizard.active && !this.buttonMappingWizard.lastPressedButtons.has(index)) {
            this.handleWizardButtonDetection(index);
          }
        }
      });
    }

    // Update last pressed buttons for wizard frame comparison
    if (this.buttonMappingWizard.active) {
      this.buttonMappingWizard.lastPressedButtons = currentPressedIndices;
    }

    // Highlight hotspots for pressed buttons (using saved mappings)
    if (!this.buttonMappingWizard.active) {
      this.updateButtonHighlightsFromMappings(currentPressedIndices);
    }

    // Update the display for all relevant button lists
    buttonListIds.forEach(buttonListId => {
      const buttonListEl = document.getElementById(buttonListId);
      if (!buttonListEl) return;

      if (pressedButtons.length === 0) {
        buttonListEl.innerHTML = 'None';
        buttonListEl.classList.remove('active');
      } else {
        buttonListEl.innerHTML = pressedButtons.map(btn =>
          `<span class="button-input-item">${btn}</span>`
        ).join('');
        buttonListEl.classList.add('active');
      }
    });
  }

  /**
   * Update hotspot highlights based on pressed buttons and saved mappings
   */
  updateButtonHighlightsFromMappings(pressedButtonIndices) {
    const deviceKey = this.getDeviceMappingKey();
    const deviceMappings = this.buttonMappings[deviceKey] || {};

    // Track which hotspots should be highlighted
    const hotspotIdsToHighlight = new Set();

    // Find hotspot IDs for all pressed buttons
    pressedButtonIndices.forEach(buttonIndex => {
      const hotspotId = deviceMappings[buttonIndex];
      if (hotspotId) {
        // Get the base hotspot ID (remove directional suffixes for highlight lookup)
        const baseHotspotId = hotspotId.replace(/_up|_down|_left|_right|_press|_stage2/, '');
        hotspotIdsToHighlight.add(baseHotspotId);
      }
    });

    // Update all hotspots - highlight if pressed, unhighlight if not
    Object.entries(this.buttonElements).forEach(([hotspotId, hotspot]) => {
      if (hotspotIdsToHighlight.has(hotspotId)) {
        // Highlight this hotspot (same as hover)
        this.highlightButton(hotspot, true);
        hotspot.classList.add('button-physically-pressed');
      } else {
        // Only remove highlight if it was from a physical press (not mouse hover)
        if (hotspot.classList.contains('button-physically-pressed')) {
          this.highlightButton(hotspot, false);
          hotspot.classList.remove('button-physically-pressed');
        }
      }
    });
  }

  // ==================== BUTTON MAPPING WIZARD ====================

  /**
   * Load saved button mappings from localStorage
   */
  loadButtonMappings() {
    try {
      const saved = localStorage.getItem('flycon_button_mappings');
      if (saved) {
        this.buttonMappings = JSON.parse(saved);
        console.log('Loaded button mappings:', this.buttonMappings);
      }
    } catch (e) {
      console.error('Failed to load button mappings:', e);
      this.buttonMappings = {};
    }
  }

  /**
   * Save button mappings to localStorage
   */
  saveButtonMappings() {
    try {
      localStorage.setItem('flycon_button_mappings', JSON.stringify(this.buttonMappings));
      console.log('Saved button mappings:', this.buttonMappings);
    } catch (e) {
      console.error('Failed to save button mappings:', e);
    }
  }

  /**
   * Check if button mapping configuration is needed
   */
  checkButtonMappingNeeded() {
    const deviceKey = this.getDeviceMappingKey();
    const hasMappings = this.buttonMappings[deviceKey] && Object.keys(this.buttonMappings[deviceKey]).length > 0;

    if (!hasMappings) {
      // Show prompt to configure buttons
      this.showButtonMappingPrompt();
    }
  }

  /**
   * Get the storage key for current device
   */
  getDeviceMappingKey() {
    if (this.activeDevice === 'x56' || this.activeDevice === 'x56-hotas') {
      return 'x56_hotas';
    }
    return this.activeDevice;
  }

  /**
   * Show prompt asking user to configure buttons
   */
  showButtonMappingPrompt() {
    // Create a prompt overlay
    const existingPrompt = document.querySelector('.button-mapping-prompt');
    if (existingPrompt) return;

    const prompt = document.createElement('div');
    prompt.className = 'button-mapping-prompt';
    prompt.innerHTML = `
      <div class="mapping-prompt-content">
        <h3><strong>Configure Your Controller</strong></h3>
        <p>Map your physical buttons to the on-screen controls for a better experience.</p>
        <div class="mapping-prompt-actions">
          <button class="btn-secondary mapping-prompt-skip">Skip for Now</button>
          <button class="btn-primary mapping-prompt-start">Start Configuration</button>
        </div>
      </div>
    `;

    this.container.appendChild(prompt);

    // Setup event handlers
    prompt.querySelector('.mapping-prompt-skip').addEventListener('click', () => {
      prompt.remove();
    });

    prompt.querySelector('.mapping-prompt-start').addEventListener('click', () => {
      prompt.remove();
      this.startButtonMappingWizard();
    });
  }

  /**
   * Setup click handler for the configure button
   */
  setupButtonConfigButton() {
    const configBtns = this.container.querySelectorAll('.button-config-btn');

    configBtns.forEach(btn => {
      if (btn.dataset.setupDone) return;
      btn.dataset.setupDone = 'true';

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startButtonMappingWizard();
      });
    });
  }

  /**
   * Get the list of buttons/directions to map for current device
   */
  getButtonMappingSteps() {
    const steps = [];

    if (this.activeDevice === 'x56' || this.activeDevice === 'x56-hotas') {
      const stick = 'X56 Flight Stick';
      const throttle = 'X56 Throttle';

      // X56 Stick controls
      steps.push({ hotspotId: 'x56_js_trigger', label: 'Trigger - Stage 1', description: 'Pull the trigger halfway', device: stick });
      steps.push({ hotspotId: 'x56_js_trigger_stage2', label: 'Trigger - Stage 2', description: 'Pull the trigger fully', device: stick });
      steps.push({ hotspotId: 'x56_js_missile_btn', label: 'Missile Button', description: 'Press the red missile button', device: stick });
      steps.push({ hotspotId: 'x56_js_pinky_switch', label: 'Pinky Switch', description: 'Press the pinky switch', device: stick });

      // Thumb Hat (8-way POV)
      steps.push({ hotspotId: 'x56_js_thumb_hat_up', label: 'Thumb Hat - Up', description: 'Push the thumb hat UP', device: stick });
      steps.push({ hotspotId: 'x56_js_thumb_hat_down', label: 'Thumb Hat - Down', description: 'Push the thumb hat DOWN', device: stick });
      steps.push({ hotspotId: 'x56_js_thumb_hat_left', label: 'Thumb Hat - Left', description: 'Push the thumb hat LEFT', device: stick });
      steps.push({ hotspotId: 'x56_js_thumb_hat_right', label: 'Thumb Hat - Right', description: 'Push the thumb hat RIGHT', device: stick });

      // Thumb D-Pad (4-way)
      steps.push({ hotspotId: 'x56_js_thumb_dpad_up', label: 'Thumb D-Pad - Up', description: 'Push the D-pad UP', device: stick });
      steps.push({ hotspotId: 'x56_js_thumb_dpad_down', label: 'Thumb D-Pad - Down', description: 'Push the D-pad DOWN', device: stick });
      steps.push({ hotspotId: 'x56_js_thumb_dpad_left', label: 'Thumb D-Pad - Left', description: 'Push the D-pad LEFT', device: stick });
      steps.push({ hotspotId: 'x56_js_thumb_dpad_right', label: 'Thumb D-Pad - Right', description: 'Push the D-pad RIGHT', device: stick });

      // X56 Throttle controls
      steps.push({ hotspotId: 'x56_th_thumb_btn', label: 'Thumb Button (E)', description: 'Press the thumb button (E)', device: throttle });

      // Toggles
      steps.push({ hotspotId: 'x56_th_tgl1', label: 'Toggle 1 (TGL1)', description: 'Press Toggle 1', device: throttle });
      steps.push({ hotspotId: 'x56_th_tgl2', label: 'Toggle 2 (TGL2)', description: 'Press Toggle 2', device: throttle });
      steps.push({ hotspotId: 'x56_th_tgl3', label: 'Toggle 3 (TGL3)', description: 'Press Toggle 3', device: throttle });
      steps.push({ hotspotId: 'x56_th_tgl4', label: 'Toggle 4 (TGL4)', description: 'Press Toggle 4', device: throttle });

      // Switches
      steps.push({ hotspotId: 'x56_th_sw1', label: 'Switch 1 (SW1 Up)', description: 'Flip switch pair 1-2 UP', device: throttle });
      steps.push({ hotspotId: 'x56_th_sw2', label: 'Switch 2 (SW2 Down)', description: 'Flip switch pair 1-2 DOWN', device: throttle });
      steps.push({ hotspotId: 'x56_th_sw3', label: 'Switch 3 (SW3 Up)', description: 'Flip switch pair 3-4 UP', device: throttle });
      steps.push({ hotspotId: 'x56_th_sw4', label: 'Switch 4 (SW4 Down)', description: 'Flip switch pair 3-4 DOWN', device: throttle });
      steps.push({ hotspotId: 'x56_th_sw5', label: 'Switch 5 (SW5 Up)', description: 'Flip switch pair 5-6 UP', device: throttle });
      steps.push({ hotspotId: 'x56_th_sw6', label: 'Switch 6 (SW6 Down)', description: 'Flip switch pair 5-6 DOWN', device: throttle });

      // Thumb D-Pad on throttle
      steps.push({ hotspotId: 'x56_th_thumb_dpad_up', label: 'D-Pad - Up', description: 'Push the D-pad UP', device: throttle });
      steps.push({ hotspotId: 'x56_th_thumb_dpad_down', label: 'D-Pad - Down', description: 'Push the D-pad DOWN', device: throttle });
      steps.push({ hotspotId: 'x56_th_thumb_dpad_left', label: 'D-Pad - Left', description: 'Push the D-pad LEFT', device: throttle });
      steps.push({ hotspotId: 'x56_th_thumb_dpad_right', label: 'D-Pad - Right', description: 'Push the D-pad RIGHT', device: throttle });

      // Ministicks
      steps.push({ hotspotId: 'x56_th_thumb_ministick_up', label: 'Thumb Ministick - Up', description: 'Push thumb ministick UP', device: throttle });
      steps.push({ hotspotId: 'x56_th_thumb_ministick_down', label: 'Thumb Ministick - Down', description: 'Push thumb ministick DOWN', device: throttle });
      steps.push({ hotspotId: 'x56_th_thumb_ministick_left', label: 'Thumb Ministick - Left', description: 'Push thumb ministick LEFT', device: throttle });
      steps.push({ hotspotId: 'x56_th_thumb_ministick_right', label: 'Thumb Ministick - Right', description: 'Push thumb ministick RIGHT', device: throttle });
      steps.push({ hotspotId: 'x56_th_thumb_ministick_press', label: 'Thumb Ministick - Press', description: 'Press thumb ministick IN', device: throttle });

      steps.push({ hotspotId: 'x56_th_rear_ministick_up', label: 'Rear Ministick - Up', description: 'Push rear ministick UP', device: throttle });
      steps.push({ hotspotId: 'x56_th_rear_ministick_down', label: 'Rear Ministick - Down', description: 'Push rear ministick DOWN', device: throttle });
      steps.push({ hotspotId: 'x56_th_rear_ministick_left', label: 'Rear Ministick - Left', description: 'Push rear ministick LEFT', device: throttle });
      steps.push({ hotspotId: 'x56_th_rear_ministick_right', label: 'Rear Ministick - Right', description: 'Push rear ministick RIGHT', device: throttle });
      steps.push({ hotspotId: 'x56_th_rear_ministick_press', label: 'Rear Ministick - Press', description: 'Press rear ministick IN', device: throttle });
    } else if (this.activeDevice === 'x52' || this.activeDevice === 'x52-hotas') {
      const stick = 'X52 Flight Stick';
      const throttle = 'X52 Throttle';

      // X52 Stick controls
      steps.push({ hotspotId: 'x52_js_trigger', label: 'Trigger', description: 'Pull the trigger', device: stick });
      steps.push({ hotspotId: 'x52_js_fire', label: 'Fire Button', description: 'Press the fire/missile button', device: stick });
      steps.push({ hotspotId: 'x52_js_pinky_switch', label: 'Pinky Switch', description: 'Press the pinky switch', device: stick });
      steps.push({ hotspotId: 'x52_js_a_btn', label: 'A Button', description: 'Press the A button', device: stick });
      steps.push({ hotspotId: 'x52_js_b_btn', label: 'B Button', description: 'Press the B button', device: stick });
      steps.push({ hotspotId: 'x52_js_c_btn', label: 'C Button', description: 'Press the C button', device: stick });

      // Scroll wheel
      steps.push({ hotspotId: 'x52_js_scroll_up', label: 'Scroll Wheel - Up', description: 'Scroll the wheel UP', device: stick });
      steps.push({ hotspotId: 'x52_js_scroll_down', label: 'Scroll Wheel - Down', description: 'Scroll the wheel DOWN', device: stick });
      steps.push({ hotspotId: 'x52_js_scroll_press', label: 'Scroll Wheel - Press', description: 'Press the scroll wheel', device: stick });

      // Thumb Hat (POV)
      steps.push({ hotspotId: 'x52_js_thumb_hat_up', label: 'Thumb Hat - Up', description: 'Push the POV hat UP', device: stick });
      steps.push({ hotspotId: 'x52_js_thumb_hat_down', label: 'Thumb Hat - Down', description: 'Push the POV hat DOWN', device: stick });
      steps.push({ hotspotId: 'x52_js_thumb_hat_left', label: 'Thumb Hat - Left', description: 'Push the POV hat LEFT', device: stick });
      steps.push({ hotspotId: 'x52_js_thumb_hat_right', label: 'Thumb Hat - Right', description: 'Push the POV hat RIGHT', device: stick });

      // Thumb D-Pad
      steps.push({ hotspotId: 'x52_js_thumb_dpad_up', label: 'Thumb D-Pad - Up', description: 'Push the thumb D-pad UP', device: stick });
      steps.push({ hotspotId: 'x52_js_thumb_dpad_down', label: 'Thumb D-Pad - Down', description: 'Push the thumb D-pad DOWN', device: stick });
      steps.push({ hotspotId: 'x52_js_thumb_dpad_left', label: 'Thumb D-Pad - Left', description: 'Push the thumb D-pad LEFT', device: stick });
      steps.push({ hotspotId: 'x52_js_thumb_dpad_right', label: 'Thumb D-Pad - Right', description: 'Push the thumb D-pad RIGHT', device: stick });

      // X52 Throttle controls
      steps.push({ hotspotId: 'x52_th_thumb', label: 'Thumb Button', description: 'Press the thumb button', device: throttle });
      steps.push({ hotspotId: 'x52_th_select', label: 'Select/Scroll Wheel', description: 'Press the select wheel', device: throttle });

      // Throttle D-Pad
      steps.push({ hotspotId: 'x52_th_dpad_up', label: 'D-Pad - Up', description: 'Push the D-pad UP', device: throttle });
      steps.push({ hotspotId: 'x52_th_dpad_down', label: 'D-Pad - Down', description: 'Push the D-pad DOWN', device: throttle });
      steps.push({ hotspotId: 'x52_th_dpad_left', label: 'D-Pad - Left', description: 'Push the D-pad LEFT', device: throttle });
      steps.push({ hotspotId: 'x52_th_dpad_right', label: 'D-Pad - Right', description: 'Push the D-pad RIGHT', device: throttle });

      // Front D-Pad
      steps.push({ hotspotId: 'x52_th_front_dpad_up', label: 'Front D-Pad - Up', description: 'Push the front D-pad UP', device: throttle });
      steps.push({ hotspotId: 'x52_th_front_dpad_down', label: 'Front D-Pad - Down', description: 'Push the front D-pad DOWN', device: throttle });
      steps.push({ hotspotId: 'x52_th_front_dpad_left', label: 'Front D-Pad - Left', description: 'Push the front D-pad LEFT', device: throttle });
      steps.push({ hotspotId: 'x52_th_front_dpad_right', label: 'Front D-Pad - Right', description: 'Push the front D-pad RIGHT', device: throttle });

      // Toggle switches
      steps.push({ hotspotId: 'x52_th_t1', label: 'Toggle T1', description: 'Flip toggle T1 UP', device: throttle });
      steps.push({ hotspotId: 'x52_th_t2', label: 'Toggle T2', description: 'Flip toggle T2 DOWN', device: throttle });
      steps.push({ hotspotId: 'x52_th_t3', label: 'Toggle T3', description: 'Flip toggle T3 UP', device: throttle });
      steps.push({ hotspotId: 'x52_th_t4', label: 'Toggle T4', description: 'Flip toggle T4 DOWN', device: throttle });
      steps.push({ hotspotId: 'x52_th_t5', label: 'Toggle T5', description: 'Flip toggle T5 UP', device: throttle });
      steps.push({ hotspotId: 'x52_th_t6', label: 'Toggle T6', description: 'Flip toggle T6 DOWN', device: throttle });
    } else if (this.activeDevice === 'ab9') {
      const device = 'MOZA AB9 Flight Stick';

      // Trigger
      steps.push({ hotspotId: 'ab9_trigger_stage1', label: 'Trigger - Stage 1', description: 'Pull the trigger halfway', device });
      steps.push({ hotspotId: 'ab9_trigger_stage2', label: 'Trigger - Stage 2', description: 'Pull the trigger fully', device });

      // Thumb buttons
      steps.push({ hotspotId: 'ab9_thumb_missile', label: 'Missile Button', description: 'Press the missile button', device });
      steps.push({ hotspotId: 'ab9_index_btn', label: 'Index Button', description: 'Press the index finger button', device });

      // Thumb Hat (8-way)
      steps.push({ hotspotId: 'ab9_thumb_hat_up', label: 'Thumb Hat - Up', description: 'Push the thumb hat UP', device });
      steps.push({ hotspotId: 'ab9_thumb_hat_down', label: 'Thumb Hat - Down', description: 'Push the thumb hat DOWN', device });
      steps.push({ hotspotId: 'ab9_thumb_hat_left', label: 'Thumb Hat - Left', description: 'Push the thumb hat LEFT', device });
      steps.push({ hotspotId: 'ab9_thumb_hat_right', label: 'Thumb Hat - Right', description: 'Push the thumb hat RIGHT', device });

      // Top D-Pad (5-way)
      steps.push({ hotspotId: 'ab9_top_dpad_up', label: 'Top D-Pad - Up', description: 'Push the top D-pad UP', device });
      steps.push({ hotspotId: 'ab9_top_dpad_down', label: 'Top D-Pad - Down', description: 'Push the top D-pad DOWN', device });
      steps.push({ hotspotId: 'ab9_top_dpad_left', label: 'Top D-Pad - Left', description: 'Push the top D-pad LEFT', device });
      steps.push({ hotspotId: 'ab9_top_dpad_right', label: 'Top D-Pad - Right', description: 'Push the top D-pad RIGHT', device });
      steps.push({ hotspotId: 'ab9_top_dpad_press', label: 'Top D-Pad - Press', description: 'Press the top D-pad IN', device });

      // Bottom D-Pad (4-way)
      steps.push({ hotspotId: 'ab9_bottom_dpad_up', label: 'Bottom D-Pad - Up', description: 'Push the bottom D-pad UP', device });
      steps.push({ hotspotId: 'ab9_bottom_dpad_down', label: 'Bottom D-Pad - Down', description: 'Push the bottom D-pad DOWN', device });
      steps.push({ hotspotId: 'ab9_bottom_dpad_left', label: 'Bottom D-Pad - Left', description: 'Push the bottom D-pad LEFT', device });
      steps.push({ hotspotId: 'ab9_bottom_dpad_right', label: 'Bottom D-Pad - Right', description: 'Push the bottom D-pad RIGHT', device });

      // Funky Knob (4-way)
      steps.push({ hotspotId: 'ab9_funky_knob_up', label: 'Funky Knob - Up', description: 'Push the funky knob UP', device });
      steps.push({ hotspotId: 'ab9_funky_knob_down', label: 'Funky Knob - Down', description: 'Push the funky knob DOWN', device });
      steps.push({ hotspotId: 'ab9_funky_knob_left', label: 'Funky Knob - Left', description: 'Push the funky knob LEFT', device });
      steps.push({ hotspotId: 'ab9_funky_knob_right', label: 'Funky Knob - Right', description: 'Push the funky knob RIGHT', device });

      // Rockers
      steps.push({ hotspotId: 'ab9_top_rocker_up', label: 'Thumb Switch - Up', description: 'Push the thumb switch UP', device });
      steps.push({ hotspotId: 'ab9_top_rocker_down', label: 'Thumb Switch - Down', description: 'Push the thumb switch DOWN', device });
      steps.push({ hotspotId: 'ab9_bottom_rocker_up', label: 'Thumb Funky - Up', description: 'Push the bottom funky UP', device });
      steps.push({ hotspotId: 'ab9_bottom_rocker_down', label: 'Thumb Funky - Down', description: 'Push the bottom funky DOWN', device });
      steps.push({ hotspotId: 'ab9_bottom_rocker_left', label: 'Thumb Funky - Left', description: 'Push the bottom funky LEFT', device });
      steps.push({ hotspotId: 'ab9_bottom_rocker_right', label: 'Thumb Funky - Right', description: 'Push the bottom funky RIGHT', device });
      steps.push({ hotspotId: 'ab9_bottom_rocker_press', label: 'Thumb Funky - Press', description: 'Press the bottom funky IN', device });

      // Pinky controls
      steps.push({ hotspotId: 'ab9_pinky_switch_up', label: 'Pinky Switch - Up', description: 'Push the pinky switch UP', device });
      steps.push({ hotspotId: 'ab9_pinky_switch_down', label: 'Pinky Switch - Down', description: 'Push the pinky switch DOWN', device });
      steps.push({ hotspotId: 'ab9_pinky_btn', label: 'Pinky Button', description: 'Press the pinky button', device });
    } else if (this.activeDevice === 'vkb-left') {
      const device = 'VKB Gladiator EVO (Left)';

      // Trigger
      steps.push({ hotspotId: 'vkb_l_trigger_stage1', label: 'Trigger - Stage 1', description: 'Pull the trigger halfway', device });
      steps.push({ hotspotId: 'vkb_l_trigger_stage2', label: 'Trigger - Stage 2', description: 'Pull the trigger fully', device });

      // Buttons
      steps.push({ hotspotId: 'vkb_l_b1_side', label: 'B1 Side Button', description: 'Press the side button', device });
      steps.push({ hotspotId: 'vkb_l_a2_red', label: 'A2 Red Button', description: 'Press the red button', device });
      steps.push({ hotspotId: 'vkb_l_d1_pinky', label: 'D1 Pinky Button', description: 'Press the pinky button', device });

      // Base buttons
      steps.push({ hotspotId: 'vkb_l_base_switch_up', label: 'Base Switch - Up', description: 'Push the base switch UP', device });
      steps.push({ hotspotId: 'vkb_l_base_switch_down', label: 'Base Switch - Down', description: 'Push the base switch DOWN', device });
      steps.push({ hotspotId: 'vkb_l_f1', label: 'F1 Button', description: 'Press the F1 button', device });
      steps.push({ hotspotId: 'vkb_l_f2', label: 'F2 Encoder Press', description: 'Press the F2 encoder', device });
      steps.push({ hotspotId: 'vkb_l_f3', label: 'F3 Button', description: 'Press the F3 button', device });

      // C1 Thumb Hat (4-way)
      steps.push({ hotspotId: 'vkb_l_c1_thumb_hat_up', label: 'C1 Thumb Hat - Up', description: 'Push the thumb hat UP', device });
      steps.push({ hotspotId: 'vkb_l_c1_thumb_hat_down', label: 'C1 Thumb Hat - Down', description: 'Push the thumb hat DOWN', device });
      steps.push({ hotspotId: 'vkb_l_c1_thumb_hat_left', label: 'C1 Thumb Hat - Left', description: 'Push the thumb hat LEFT', device });
      steps.push({ hotspotId: 'vkb_l_c1_thumb_hat_right', label: 'C1 Thumb Hat - Right', description: 'Push the thumb hat RIGHT', device });

      // A3 Center Hat (5-way)
      steps.push({ hotspotId: 'vkb_l_a3_center_hat_up', label: 'A3 Center Hat - Up', description: 'Push the center hat UP', device });
      steps.push({ hotspotId: 'vkb_l_a3_center_hat_down', label: 'A3 Center Hat - Down', description: 'Push the center hat DOWN', device });
      steps.push({ hotspotId: 'vkb_l_a3_center_hat_left', label: 'A3 Center Hat - Left', description: 'Push the center hat LEFT', device });
      steps.push({ hotspotId: 'vkb_l_a3_center_hat_right', label: 'A3 Center Hat - Right', description: 'Push the center hat RIGHT', device });
      steps.push({ hotspotId: 'vkb_l_a3_center_hat_press', label: 'A3 Center Hat - Press', description: 'Press the center hat IN', device });

      // A4 Top Hat (4-way)
      steps.push({ hotspotId: 'vkb_l_a4_top_hat_up', label: 'A4 Top Hat - Up', description: 'Push the top hat UP', device });
      steps.push({ hotspotId: 'vkb_l_a4_top_hat_down', label: 'A4 Top Hat - Down', description: 'Push the top hat DOWN', device });
      steps.push({ hotspotId: 'vkb_l_a4_top_hat_left', label: 'A4 Top Hat - Left', description: 'Push the top hat LEFT', device });
      steps.push({ hotspotId: 'vkb_l_a4_top_hat_right', label: 'A4 Top Hat - Right', description: 'Push the top hat RIGHT', device });

      // A1 Mini-stick (5-way)
      steps.push({ hotspotId: 'vkb_l_a1_ministick_up', label: 'A1 Mini-stick - Up', description: 'Push the mini-stick UP', device });
      steps.push({ hotspotId: 'vkb_l_a1_ministick_down', label: 'A1 Mini-stick - Down', description: 'Push the mini-stick DOWN', device });
      steps.push({ hotspotId: 'vkb_l_a1_ministick_left', label: 'A1 Mini-stick - Left', description: 'Push the mini-stick LEFT', device });
      steps.push({ hotspotId: 'vkb_l_a1_ministick_right', label: 'A1 Mini-stick - Right', description: 'Push the mini-stick RIGHT', device });
      steps.push({ hotspotId: 'vkb_l_a1_ministick_press', label: 'A1 Mini-stick - Press', description: 'Press the mini-stick IN', device });
    } else if (this.activeDevice === 'vkb-right') {
      const device = 'VKB Gladiator EVO (Right)';

      // Trigger
      steps.push({ hotspotId: 'vkb_r_trigger_stage1', label: 'Trigger - Stage 1', description: 'Pull the trigger halfway', device });
      steps.push({ hotspotId: 'vkb_r_trigger_stage2', label: 'Trigger - Stage 2', description: 'Pull the trigger fully', device });

      // Buttons
      steps.push({ hotspotId: 'vkb_r_b1_side', label: 'B1 Side Button', description: 'Press the side button', device });
      steps.push({ hotspotId: 'vkb_r_a2_red', label: 'A2 Red Button', description: 'Press the red button', device });
      steps.push({ hotspotId: 'vkb_r_d1_pinky', label: 'D1 Pinky Button', description: 'Press the pinky button', device });

      // Base buttons
      steps.push({ hotspotId: 'vkb_r_base_switch_up', label: 'Base Switch - Up', description: 'Push the base switch UP', device });
      steps.push({ hotspotId: 'vkb_r_base_switch_down', label: 'Base Switch - Down', description: 'Push the base switch DOWN', device });
      steps.push({ hotspotId: 'vkb_r_f1', label: 'F1 Button', description: 'Press the F1 button', device });
      steps.push({ hotspotId: 'vkb_r_f2', label: 'F2 Encoder Press', description: 'Press the F2 encoder', device });
      steps.push({ hotspotId: 'vkb_r_f3', label: 'F3 Button', description: 'Press the F3 button', device });

      // C1 Thumb Hat (4-way)
      steps.push({ hotspotId: 'vkb_r_c1_thumb_hat_up', label: 'C1 Thumb Hat - Up', description: 'Push the thumb hat UP', device });
      steps.push({ hotspotId: 'vkb_r_c1_thumb_hat_down', label: 'C1 Thumb Hat - Down', description: 'Push the thumb hat DOWN', device });
      steps.push({ hotspotId: 'vkb_r_c1_thumb_hat_left', label: 'C1 Thumb Hat - Left', description: 'Push the thumb hat LEFT', device });
      steps.push({ hotspotId: 'vkb_r_c1_thumb_hat_right', label: 'C1 Thumb Hat - Right', description: 'Push the thumb hat RIGHT', device });

      // A3 Center Hat (5-way)
      steps.push({ hotspotId: 'vkb_r_a3_center_hat_up', label: 'A3 Center Hat - Up', description: 'Push the center hat UP', device });
      steps.push({ hotspotId: 'vkb_r_a3_center_hat_down', label: 'A3 Center Hat - Down', description: 'Push the center hat DOWN', device });
      steps.push({ hotspotId: 'vkb_r_a3_center_hat_left', label: 'A3 Center Hat - Left', description: 'Push the center hat LEFT', device });
      steps.push({ hotspotId: 'vkb_r_a3_center_hat_right', label: 'A3 Center Hat - Right', description: 'Push the center hat RIGHT', device });
      steps.push({ hotspotId: 'vkb_r_a3_center_hat_press', label: 'A3 Center Hat - Press', description: 'Press the center hat IN', device });

      // A4 Top Hat (4-way)
      steps.push({ hotspotId: 'vkb_r_a4_top_hat_up', label: 'A4 Top Hat - Up', description: 'Push the top hat UP', device });
      steps.push({ hotspotId: 'vkb_r_a4_top_hat_down', label: 'A4 Top Hat - Down', description: 'Push the top hat DOWN', device });
      steps.push({ hotspotId: 'vkb_r_a4_top_hat_left', label: 'A4 Top Hat - Left', description: 'Push the top hat LEFT', device });
      steps.push({ hotspotId: 'vkb_r_a4_top_hat_right', label: 'A4 Top Hat - Right', description: 'Push the top hat RIGHT', device });

      // A1 Mini-stick (5-way)
      steps.push({ hotspotId: 'vkb_r_a1_ministick_up', label: 'A1 Mini-stick - Up', description: 'Push the mini-stick UP', device });
      steps.push({ hotspotId: 'vkb_r_a1_ministick_down', label: 'A1 Mini-stick - Down', description: 'Push the mini-stick DOWN', device });
      steps.push({ hotspotId: 'vkb_r_a1_ministick_left', label: 'A1 Mini-stick - Left', description: 'Push the mini-stick LEFT', device });
      steps.push({ hotspotId: 'vkb_r_a1_ministick_right', label: 'A1 Mini-stick - Right', description: 'Push the mini-stick RIGHT', device });
      steps.push({ hotspotId: 'vkb_r_a1_ministick_press', label: 'A1 Mini-stick - Press', description: 'Press the mini-stick IN', device });
    } else if (this.activeDevice === 'flight-yoke') {
      const device = 'Logitech Flight Yoke';

      // Left Hat (4-way POV)
      steps.push({ hotspotId: 'yoke_left_hat_up', label: 'Left Hat - Up', description: 'Push the left hat UP', device });
      steps.push({ hotspotId: 'yoke_left_hat_down', label: 'Left Hat - Down', description: 'Push the left hat DOWN', device });
      steps.push({ hotspotId: 'yoke_left_hat_left', label: 'Left Hat - Left', description: 'Push the left hat LEFT', device });
      steps.push({ hotspotId: 'yoke_left_hat_right', label: 'Left Hat - Right', description: 'Push the left hat RIGHT', device });

      // Right Funky (5-way)
      steps.push({ hotspotId: 'yoke_right_funky_up', label: 'Right Funky - Up', description: 'Push the right funky UP', device });
      steps.push({ hotspotId: 'yoke_right_funky_down', label: 'Right Funky - Down', description: 'Push the right funky DOWN', device });
      steps.push({ hotspotId: 'yoke_right_funky_left', label: 'Right Funky - Left', description: 'Push the right funky LEFT', device });
      steps.push({ hotspotId: 'yoke_right_funky_right', label: 'Right Funky - Right', description: 'Push the right funky RIGHT', device });
      steps.push({ hotspotId: 'yoke_right_funky_press', label: 'Right Funky - Press', description: 'Press the right funky IN', device });

      // Buttons
      steps.push({ hotspotId: 'yoke_b1', label: 'B1 Button', description: 'Press the B1 button', device });
      steps.push({ hotspotId: 'yoke_b2', label: 'B2 Button', description: 'Press the B2 button', device });
      steps.push({ hotspotId: 'yoke_b3', label: 'B3 Button', description: 'Press the B3 button', device });

      // Triggers
      steps.push({ hotspotId: 'yoke_t1_t2_up', label: 'T1 Trigger', description: 'Pull the T1 trigger (up)', device });
      steps.push({ hotspotId: 'yoke_t1_t2_down', label: 'T2 Trigger', description: 'Pull the T2 trigger (down)', device });
      steps.push({ hotspotId: 'yoke_t3_t4_up', label: 'T3 Trigger', description: 'Pull the T3 trigger (up)', device });
      steps.push({ hotspotId: 'yoke_t3_t4_down', label: 'T4 Trigger', description: 'Pull the T4 trigger (down)', device });
      steps.push({ hotspotId: 'yoke_t5_t6_up', label: 'T5 Trigger', description: 'Pull the T5 trigger (up)', device });
      steps.push({ hotspotId: 'yoke_t5_t6_down', label: 'T6 Trigger', description: 'Pull the T6 trigger (down)', device });
    } else if (this.activeDevice === 'flight-throttle') {
      const device = 'Logitech Flight Throttle Quadrant';

      // Toggle switches
      steps.push({ hotspotId: 'throttle_t1_t2_up', label: 'T1 Toggle - Up', description: 'Flip the T1 toggle UP', device });
      steps.push({ hotspotId: 'throttle_t1_t2_down', label: 'T2 Toggle - Down', description: 'Flip the T2 toggle DOWN', device });
      steps.push({ hotspotId: 'throttle_t3_t4_up', label: 'T3 Toggle - Up', description: 'Flip the T3 toggle UP', device });
      steps.push({ hotspotId: 'throttle_t3_t4_down', label: 'T4 Toggle - Down', description: 'Flip the T4 toggle DOWN', device });
      steps.push({ hotspotId: 'throttle_t5_t6_up', label: 'T5 Toggle - Up', description: 'Flip the T5 toggle UP', device });
      steps.push({ hotspotId: 'throttle_t5_t6_down', label: 'T6 Toggle - Down', description: 'Flip the T6 toggle DOWN', device });
    }

    return steps;
  }

  /**
   * Start the button mapping wizard
   */
  startButtonMappingWizard() {
    const steps = this.getButtonMappingSteps();
    if (steps.length === 0) {
      console.log('No mapping steps for this device');
      return;
    }

    this.buttonMappingWizard = {
      active: true,
      currentStep: 0,
      steps: steps,
      detectedButton: null,
      lastPressedButtons: new Set()
    };

    this.showButtonMappingWizardUI();
  }

  /**
   * Show the wizard UI overlay
   */
  showButtonMappingWizardUI() {
    // Remove any existing wizard
    const existing = document.querySelector('.button-mapping-wizard');
    if (existing) existing.remove();

    const wizard = document.createElement('div');
    wizard.className = 'button-mapping-wizard';
    wizard.innerHTML = this.getWizardStepHTML();

    document.body.appendChild(wizard);

    // Setup event handlers
    this.setupWizardEventHandlers(wizard);

    // Highlight the current control on the image
    this.highlightWizardControl();
  }

  /**
   * Get the HTML for current wizard step
   */
  getWizardStepHTML() {
    const { currentStep, steps, detectedButton } = this.buttonMappingWizard;
    const step = steps[currentStep];
    const progress = Math.round(((currentStep + 1) / steps.length) * 100);

    // Determine device badge class
    const isStick = step.device && step.device.includes('Stick');
    const isThrottle = step.device && step.device.includes('Throttle');
    const deviceBadgeClass = isStick ? 'device-badge-stick' : (isThrottle ? 'device-badge-throttle' : '');

    // Check if there are more steps remaining for the current device (to show skip device button)
    const currentDevice = step.device || '';
    const remainingStepsInDevice = this.countRemainingStepsInDevice(currentStep, steps);
    const canSkipDevice = remainingStepsInDevice > 1; // More than just the current step

    return `
      <div class="wizard-overlay"></div>
      <div class="wizard-panel">
        <div class="wizard-header">
          <h2>Button Configuration</h2>
          <span class="wizard-progress-text">Step ${currentStep + 1} of ${steps.length}</span>
        </div>
        <div class="wizard-progress-bar">
          <div class="wizard-progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="wizard-body">
          ${step.device ? `<div class="wizard-device-badge ${deviceBadgeClass}">${step.device}</div>` : ''}
          <div class="wizard-instruction">
            <div class="wizard-control-name">${step.label}</div>
            <div class="wizard-control-desc">${step.description}</div>
          </div>
          <div class="wizard-detection">
            ${detectedButton !== null
              ? `<div class="wizard-detected">
                   <span class="detected-icon">✓</span>
                   <span class="detected-text">Detected: Button ${detectedButton + 1}</span>
                 </div>`
              : `<div class="wizard-waiting">
                   <div class="waiting-pulse"></div>
                   <span>Waiting for button press...</span>
                 </div>`
            }
          </div>
        </div>
        <div class="wizard-footer">
          <button class="btn-secondary wizard-btn-back" ${currentStep === 0 ? 'disabled' : ''}>← Back</button>
          <button class="btn-secondary wizard-btn-skip">Skip</button>
          ${canSkipDevice ? `<button class="btn-secondary wizard-btn-skip-device" title="Skip all ${currentDevice} buttons">Skip ${isStick ? 'Stick' : 'Throttle'}</button>` : ''}
          <button class="btn-primary wizard-btn-next" ${detectedButton === null ? 'disabled' : ''}>
            ${currentStep === steps.length - 1 ? 'Finish' : 'Next →'}
          </button>
        </div>
        <button class="wizard-close-btn" title="Cancel configuration">×</button>
      </div>
    `;
  }

  /**
   * Get the index of the next step with a different device
   */
  getNextDeviceStepIndex(currentStep, steps) {
    const currentDevice = steps[currentStep]?.device;
    if (!currentDevice) return -1;

    for (let i = currentStep + 1; i < steps.length; i++) {
      if (steps[i].device !== currentDevice) {
        return i;
      }
    }
    return -1; // No next device found
  }

  /**
   * Count remaining steps in the current device (including current step)
   */
  countRemainingStepsInDevice(currentStep, steps) {
    const currentDevice = steps[currentStep]?.device;
    if (!currentDevice) return 0;

    let count = 0;
    for (let i = currentStep; i < steps.length; i++) {
      if (steps[i].device === currentDevice) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Setup event handlers for the wizard
   */
  setupWizardEventHandlers(wizard) {
    wizard.querySelector('.wizard-btn-back')?.addEventListener('click', () => this.wizardGoBack());
    wizard.querySelector('.wizard-btn-skip')?.addEventListener('click', () => this.wizardSkip());
    wizard.querySelector('.wizard-btn-skip-device')?.addEventListener('click', () => this.wizardSkipDevice());
    wizard.querySelector('.wizard-btn-next')?.addEventListener('click', () => this.wizardGoNext());
    wizard.querySelector('.wizard-close-btn')?.addEventListener('click', () => this.closeButtonMappingWizard());
    wizard.querySelector('.wizard-overlay')?.addEventListener('click', () => this.closeButtonMappingWizard());
  }

  /**
   * Skip all remaining steps for the current device
   */
  wizardSkipDevice() {
    const { currentStep, steps } = this.buttonMappingWizard;
    const nextDeviceIndex = this.getNextDeviceStepIndex(currentStep, steps);

    if (nextDeviceIndex !== -1) {
      // Jump to the next device
      this.buttonMappingWizard.currentStep = nextDeviceIndex;
      this.buttonMappingWizard.detectedButton = null;
      this.showButtonMappingWizardUI();
    } else {
      // No more devices, finish the wizard
      this.closeButtonMappingWizard();
      this.saveButtonMappings();
    }
  }

  /**
   * Highlight the current control in the wizard
   */
  highlightWizardControl() {
    const { currentStep, steps } = this.buttonMappingWizard;
    const step = steps[currentStep];

    // Clear all wizard highlights
    document.querySelectorAll('.hotspot.wizard-highlight').forEach(el => {
      el.classList.remove('wizard-highlight');
    });

    // Find and highlight the hotspot (may need to find parent hotspot for directional controls)
    const baseHotspotId = step.hotspotId.replace(/_up|_down|_left|_right|_press|_stage2/, '');
    const hotspot = this.buttonElements[baseHotspotId];
    if (hotspot) {
      hotspot.classList.add('wizard-highlight');
      // Scroll into view if needed
      hotspot.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Go back to previous step
   */
  wizardGoBack() {
    if (this.buttonMappingWizard.currentStep > 0) {
      this.buttonMappingWizard.currentStep--;
      this.buttonMappingWizard.detectedButton = null;
      this.updateWizardUI();
      this.highlightWizardControl();
    }
  }

  /**
   * Skip current step (leave unmapped)
   */
  wizardSkip() {
    this.wizardGoNext(true);
  }

  /**
   * Go to next step or finish
   */
  wizardGoNext(skipped = false) {
    const { currentStep, steps, detectedButton } = this.buttonMappingWizard;
    const step = steps[currentStep];

    // Save the mapping if not skipped and button was detected
    if (!skipped && detectedButton !== null) {
      const deviceKey = this.getDeviceMappingKey();
      if (!this.buttonMappings[deviceKey]) {
        this.buttonMappings[deviceKey] = {};
      }
      this.buttonMappings[deviceKey][detectedButton] = step.hotspotId;
    }

    // Move to next step or finish
    if (currentStep < steps.length - 1) {
      this.buttonMappingWizard.currentStep++;
      this.buttonMappingWizard.detectedButton = null;
      this.updateWizardUI();
      this.highlightWizardControl();
    } else {
      // Finished - save and close
      this.saveButtonMappings();
      this.closeButtonMappingWizard();
    }
  }

  /**
   * Update the wizard UI without recreating it
   */
  updateWizardUI() {
    const wizard = document.querySelector('.button-mapping-wizard');
    if (wizard) {
      wizard.innerHTML = this.getWizardStepHTML();
      this.setupWizardEventHandlers(wizard);
    }
  }

  /**
   * Close the button mapping wizard
   */
  closeButtonMappingWizard() {
    this.buttonMappingWizard.active = false;

    // Remove wizard UI
    const wizard = document.querySelector('.button-mapping-wizard');
    if (wizard) wizard.remove();

    // Clear highlights
    document.querySelectorAll('.hotspot.wizard-highlight').forEach(el => {
      el.classList.remove('wizard-highlight');
    });

    // Remove prompt if present
    const prompt = document.querySelector('.button-mapping-prompt');
    if (prompt) prompt.remove();
  }

  /**
   * Handle button detection during wizard
   */
  handleWizardButtonDetection(buttonIndex) {
    if (!this.buttonMappingWizard.active) return;

    // Ignore if this button was already pressed (debounce)
    if (this.buttonMappingWizard.lastPressedButtons.has(buttonIndex)) return;

    this.buttonMappingWizard.detectedButton = buttonIndex;
    this.updateWizardUI();
  }

  // Setup click handlers for axis bind buttons in the axis display panels
  setupAxisBindButtons() {
    const axisButtons = this.container.querySelectorAll('.axis-bind-btn');

    axisButtons.forEach(btn => {
      // Skip if already setup
      if (btn.dataset.setupDone) return;
      btn.dataset.setupDone = 'true';

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const axisId = btn.dataset.axis;

        if (axisId && this.bindingContextMenu) {
          // Create a fake hotspot element for positioning
          const fakeHotspot = {
            dataset: {
              button: axisId,
              label: btn.textContent,
              type: 'axis'
            },
            getBoundingClientRect: () => btn.getBoundingClientRect(),
            classList: {
              add: () => {},
              remove: () => {},
              contains: () => false
            }
          };

          // Show the binding context menu
          this.bindingContextMenu.show(axisId, fakeHotspot);
          this.bindingContextMenu.setCurrentBindings(this.customBindings);

          // Add selected state to the button
          document.querySelectorAll('.axis-bind-btn.selected').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        }
      });
    });
  }

  updateBindingHighlights() {
    const bindings = this.parser.getBindingsForDevice('joystick');

    Object.keys(this.buttonElements).forEach(buttonId => {
      const scKey = this.mapToSCKey(buttonId);
      const hasParserBinding = bindings.some(b => b.key === scKey);

      // Also check if this button has any custom bindings
      const hasCustomBinding = Object.keys(this.customBindings).some(key =>
        key === buttonId || key.startsWith(buttonId + '_')
      );

      if (hasParserBinding || hasCustomBinding) {
        this.buttonElements[buttonId].classList.add('bound');
      }
    });
  }

  refresh() {
    // Clear any stale selection state
    this.selectedButton = null;

    // Remove 'selected' and 'bound' classes from all hotspots
    this.container.querySelectorAll('.hotspot').forEach(el => {
      el.classList.remove('selected', 'bound');
    });

    // Clear binding info panel
    this.clearBindingInfo();

    // Reload custom bindings from localStorage (in case they were cleared externally)
    this.loadCustomBindings();

    // Sync binding context menu with current bindings
    if (this.bindingContextMenu) {
      this.bindingContextMenu.customBindings = { ...this.customBindings };
    }

    // Update UI
    this.updateBindingHighlights();
    this.updateSidebarBindingsList();
  }

  setCategory(category) {
    // Filter by category if needed
  }
}

window.HOTASImageVisualizer = HOTASImageVisualizer;

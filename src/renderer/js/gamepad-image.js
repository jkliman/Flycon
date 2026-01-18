/**
 * Image-Based Gamepad Visualizer
 * Uses Xbox controller image with interactive overlays and live input display
 */

class GamepadImageVisualizer {
  constructor(container, parser) {
    this.container = container;
    this.parser = parser;
    this.liveInput = null;
    this.selectedButton = null;
    this.buttonElements = {};
    this.axisElements = {};
    this.contextMenu = null;
    this.highlightImages = {};

    this.init();
  }

  init() {
    // Initialize live input handler
    this.liveInput = new GamepadLiveInput();
    this.liveInput.addListener((event, data) => this.handleGamepadInput(event, data));

    // Initialize context menu
    this.initContextMenu();

    this.render();
  }

  initContextMenu() {
    if (typeof GamepadBindingContextMenu !== 'undefined') {
      this.contextMenu = new GamepadBindingContextMenu();
      this.contextMenu.onBindingChanged = (bindings) => {
        this.updateBindingHighlights();
      };
    }
  }

  render() {
    this.container.innerHTML = '';
    this.buttonElements = {};
    this.axisElements = {};
    this.highlightImages = {};

    const wrapper = document.createElement('div');
    wrapper.className = 'gamepad-image-container';

    // Header
    const header = document.createElement('div');
    header.className = 'gamepad-header';
    header.innerHTML = `<h3>Xbox Controller</h3>`;
    wrapper.appendChild(header);

    // Live input status
    const statusBar = document.createElement('div');
    statusBar.className = 'gamepad-status-bar';
    statusBar.id = 'gamepad-status';
    statusBar.innerHTML = `
      <div class="status-indicator disconnected"></div>
      <span class="status-text">No controller connected</span>
      <span class="status-hint">Connect a controller to see live input</span>
    `;
    wrapper.appendChild(statusBar);

    // Controller visualization - image-based like AB9
    const visual = document.createElement('div');
    visual.className = 'controller-visual-wrapper';
    visual.appendChild(this.renderXboxController());
    wrapper.appendChild(visual);

    // Axis visualization panel with clickable buttons (no header)
    const axisPanel = document.createElement('div');
    axisPanel.className = 'axis-display-panel';
    axisPanel.innerHTML = `
      <div class="axis-displays">
        <div class="axis-display-group">
          <button class="hotas-axis-btn" data-axis-id="xbox_left_stick">Left Stick</button>
          <div class="axis-visual" id="axis-left-stick">
            <div class="axis-crosshair"></div>
            <div class="axis-dot" id="axis-dot-left"></div>
          </div>
          <div class="axis-values">
            <span id="axis-left-x">X: 0.00</span>
            <span id="axis-left-y">Y: 0.00</span>
          </div>
        </div>
        <div class="axis-display-group">
          <button class="hotas-axis-btn" data-axis-id="xbox_right_stick">Right Stick</button>
          <div class="axis-visual" id="axis-right-stick">
            <div class="axis-crosshair"></div>
            <div class="axis-dot" id="axis-dot-right"></div>
          </div>
          <div class="axis-values">
            <span id="axis-right-x">X: 0.00</span>
            <span id="axis-right-y">Y: 0.00</span>
          </div>
        </div>
        <div class="axis-display-group triggers">
          <div class="axis-display-label">Triggers</div>
          <div class="trigger-bars">
            <div class="trigger-bar-container">
              <button class="hotas-axis-btn trigger-btn" data-axis-id="xbox_left_trigger">LT</button>
              <div class="trigger-bar">
                <div class="trigger-fill" id="trigger-left"></div>
              </div>
              <span class="trigger-value" id="trigger-left-value">0%</span>
            </div>
            <div class="trigger-bar-container">
              <button class="hotas-axis-btn trigger-btn" data-axis-id="xbox_right_trigger">RT</button>
              <div class="trigger-bar">
                <div class="trigger-fill" id="trigger-right"></div>
              </div>
              <span class="trigger-value" id="trigger-right-value">0%</span>
            </div>
          </div>
        </div>
      </div>
    `;
    wrapper.appendChild(axisPanel);

    // Binding info panel - matches HOTAS styling
    const infoPanel = document.createElement('div');
    infoPanel.className = 'hotas-info-panel';
    infoPanel.id = 'gamepad-info-panel';
    infoPanel.innerHTML = `
      <div class="info-header">Bindings</div>
      <div class="info-content" id="gamepad-binding-info">
        <span class="hint-text">Click a button to see its bindings</span>
      </div>
    `;
    wrapper.appendChild(infoPanel);

    // Setup axis button click handlers
    this.setupAxisButtonHandlers(axisPanel);

    this.container.appendChild(wrapper);
    this.setupEventListeners();

    // Add hotspots after DOM is ready
    setTimeout(() => {
      this.addXboxHotspots();
      this.updateBindingHighlights();
    }, 50);
  }

  renderXboxController() {
    const container = document.createElement('div');
    container.className = 'xbox-controller-container';
    container.innerHTML = `
      <div class="xbox-controller-image-wrapper">
        <img src="../../assets/controllers/xbox controller/Tip1_KeyboardRemapping-accd04740c1cd21ca784_0009_Layer-1.png"
             alt="Xbox Controller"
             class="xbox-controller-base-img"
             id="xbox-controller-base">
        <div class="xbox-hotspot-overlay" id="xbox-hotspot-overlay"></div>
      </div>
    `;
    return container;
  }

  addXboxHotspots() {
    const overlay = document.getElementById('xbox-hotspot-overlay');
    if (!overlay) return;

    // Hotspots with CSS-based highlights (no overlay images)
    // Coordinates fine-tuned based on user feedback
    // Thumbsticks removed - they are now in the axis panel as buttons
    const hotspots = [
      // Bumpers (top) - rounded rectangles
      { id: 'lb', label: 'Left Bumper (LB)', x: 24, y: 9, w: 16, h: 8, shape: 'bumper', type: 'button' },
      { id: 'rb', label: 'Right Bumper (RB)', x: 58, y: 9, w: 16, h: 8, shape: 'bumper', type: 'button' },

      // Face buttons (A, B, X, Y) - circular
      { id: 'y', label: 'Y Button', x: 65, y: 19, w: 6, h: 10, shape: 'face-button', type: 'button' },
      { id: 'b', label: 'B Button', x: 70, y: 28, w: 6, h: 10, shape: 'face-button', type: 'button' },
      { id: 'a', label: 'A Button', x: 65, y: 37, w: 6, h: 10, shape: 'face-button', type: 'button' },
      { id: 'x', label: 'X Button', x: 60, y: 28.5, w: 6, h: 10, shape: 'face-button', type: 'button' },

      // D-Pad - circular (round)
      { id: 'dpad', label: 'D-Pad', x: 34, y: 43, w: 12, h: 20, shape: 'dpad', type: 'hat' }
    ];

    hotspots.forEach(hs => {
      const hotspot = document.createElement('div');
      hotspot.className = `xbox-hotspot hotspot ${hs.shape}`;
      hotspot.dataset.button = `xbox_${hs.id}`;
      hotspot.dataset.label = hs.label;
      hotspot.style.left = `${hs.x}%`;
      hotspot.style.top = `${hs.y}%`;
      hotspot.style.width = `${hs.w}%`;
      hotspot.style.height = `${hs.h}%`;
      hotspot.title = hs.label;

      overlay.appendChild(hotspot);
      this.buttonElements[`xbox_${hs.id}`] = hotspot;
    });
  }

  setupEventListeners() {
    // Button click/hover on hotspots
    this.container.addEventListener('click', (e) => {
      const hotspot = e.target.closest('.xbox-hotspot');
      if (hotspot) {
        this.selectButton(hotspot);
      }
    });

    this.container.addEventListener('mouseenter', (e) => {
      const hotspot = e.target.closest('.xbox-hotspot');
      if (hotspot) {
        this.highlightButton(hotspot, true);
      }
    }, true);

    this.container.addEventListener('mouseleave', (e) => {
      const hotspot = e.target.closest('.xbox-hotspot');
      if (hotspot) {
        this.highlightButton(hotspot, false);
      }
    }, true);
  }

  selectButton(btn) {
    // Clear previous selection
    this.container.querySelectorAll('.xbox-hotspot.selected').forEach(el => {
      el.classList.remove('selected');
    });

    btn.classList.add('selected');
    this.selectedButton = btn.dataset.button;

    this.showButtonBindings(btn.dataset.button, btn.dataset.label);

    // Open context menu for binding
    if (this.contextMenu) {
      this.contextMenu.show(btn.dataset.button, btn.dataset.label, btn);
    }
  }

  highlightButton(btn, highlight) {
    if (highlight) {
      this.showButtonBindings(btn.dataset.button, btn.dataset.label);
    } else {
      if (!this.selectedButton) {
        this.clearBindingInfo();
      } else {
        // Show selected button info
        const selectedBtn = this.buttonElements[this.selectedButton];
        if (selectedBtn) {
          this.showButtonBindings(this.selectedButton, selectedBtn.dataset.label);
        }
      }
    }
  }

  showButtonBindings(buttonId, label) {
    const infoContent = document.getElementById('gamepad-binding-info');
    if (!infoContent) return;

    // Map button to Star Citizen binding key
    const buttonMap = this.getButtonMapping();
    const scKey = buttonMap[buttonId] || buttonId;

    // Get bindings from XML parser
    const xmlBindings = this.parser.getBindingsForKey(scKey);

    // Get custom bindings from context menu
    const customBindings = this.getCustomBindingsForButton(buttonId);

    // Combine both sources
    const allBindings = [...xmlBindings, ...customBindings];

    if (allBindings.length === 0) {
      infoContent.innerHTML = `
        <div class="button-info">
          <span class="button-name">${label || buttonId.toUpperCase()}</span>
          <span class="no-binding">No bindings</span>
        </div>
      `;
      return;
    }

    // HOTAS-style single line format with binding list
    const bindingTags = allBindings.map(b =>
      `<span class="binding-row${b.isCustom ? ' custom-binding' : ''}"><span class="binding-action">${b.label}</span></span>`
    ).join('');

    infoContent.innerHTML = `
      <div class="button-info">
        <span class="button-name">${label || buttonId.toUpperCase()}</span>
        <div class="binding-list">${bindingTags}</div>
      </div>
    `;
  }

  getCustomBindingsForButton(buttonId) {
    const bindings = [];
    if (!this.contextMenu) return bindings;

    const customBindings = this.contextMenu.getBindings();
    for (const [key, action] of Object.entries(customBindings)) {
      // Match buttonId or buttonId_* pattern
      if (key === buttonId || key.startsWith(buttonId + '_')) {
        const dropdownId = key.replace(buttonId + '_', '');
        bindings.push({
          label: this.formatActionName(action) + (dropdownId !== key ? ` (${dropdownId})` : ''),
          action: action,
          isCustom: true
        });
      }
    }
    return bindings;
  }

  formatActionName(action) {
    return action
      .replace(/^v_/, '')
      .replace(/^turret_/, 'Turret ')
      .replace(/^eva_/, 'EVA ')
      .replace(/^pc_/, '')
      .replace(/^ui_/, 'UI ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  clearBindingInfo() {
    const infoContent = document.getElementById('gamepad-binding-info');
    if (infoContent) {
      infoContent.innerHTML = '<span class="hint-text">Click a button to see its bindings</span>';
    }
  }

  getButtonMapping() {
    return {
      'xbox_a': 'js1_button1',
      'xbox_b': 'js1_button2',
      'xbox_x': 'js1_button3',
      'xbox_y': 'js1_button4',
      'xbox_lb': 'js1_button5',
      'xbox_rb': 'js1_button6',
      'xbox_lt': 'js1_z+',
      'xbox_rt': 'js1_z-',
      'xbox_ls': 'js1_button9',
      'xbox_rs': 'js1_button10',
      'xbox_view': 'js1_button7',
      'xbox_menu': 'js1_button8',
      'xbox_dpad': 'js1_hat1',
      'xbox_dpad_up': 'js1_hat1_up',
      'xbox_dpad_down': 'js1_hat1_down',
      'xbox_dpad_left': 'js1_hat1_left',
      'xbox_dpad_right': 'js1_hat1_right'
    };
  }

  handleGamepadInput(event, data) {
    if (event === 'connected') {
      this.updateConnectionStatus(true, data.id);
    } else if (event === 'disconnected') {
      this.updateConnectionStatus(false);
    } else if (event === 'input') {
      this.updateLiveInput(data);
    }
  }

  updateConnectionStatus(connected, deviceName = '') {
    const statusBar = document.getElementById('gamepad-status');
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
      text.textContent = 'No controller connected';
      hint.textContent = 'Connect a controller to see live input';
    }
  }

  updateLiveInput(data) {
    // Update button states
    this.updateButtonStates(data.buttons);

    // Update axis displays
    this.updateAxisDisplays(data.axes);

    // Update trigger displays
    this.updateTriggerDisplays(data.buttons);
  }

  updateButtonStates(buttons) {
    // Standard gamepad button mapping
    const buttonIndexMap = {
      0: 'xbox_a', 1: 'xbox_b', 2: 'xbox_x', 3: 'xbox_y',
      4: 'xbox_lb', 5: 'xbox_rb', 6: 'xbox_lt', 7: 'xbox_rt',
      8: 'xbox_view', 9: 'xbox_menu', 10: 'xbox_ls', 11: 'xbox_rs'
    };

    // D-pad buttons (indices 12-15)
    const dpadIndices = [12, 13, 14, 15];

    buttons.forEach(btn => {
      const buttonName = buttonIndexMap[btn.index];
      if (buttonName && this.buttonElements[buttonName]) {
        const el = this.buttonElements[buttonName];
        if (btn.pressed) {
          el.classList.add('pressed');
        } else {
          el.classList.remove('pressed');
        }
      }
    });

    // Handle D-pad as a single element - highlight if any direction is pressed
    const dpadElement = this.buttonElements['xbox_dpad'];
    if (dpadElement) {
      const anyDpadPressed = dpadIndices.some(idx => buttons[idx]?.pressed);
      if (anyDpadPressed) {
        dpadElement.classList.add('pressed');
      } else {
        dpadElement.classList.remove('pressed');
      }
    }
  }

  updateAxisDisplays(axes) {
    // Left stick (axes 0 and 1)
    const leftDot = document.getElementById('axis-dot-left');
    const leftX = document.getElementById('axis-left-x');
    const leftY = document.getElementById('axis-left-y');

    if (leftDot && axes[0] && axes[1]) {
      const x = (axes[0].value * 40) + 50; // Convert -1...1 to 10...90 (percentage)
      const y = (axes[1].value * 40) + 50;
      leftDot.style.left = `${x}%`;
      leftDot.style.top = `${y}%`;

      if (leftX) leftX.textContent = `X: ${axes[0].value.toFixed(2)}`;
      if (leftY) leftY.textContent = `Y: ${axes[1].value.toFixed(2)}`;
    }

    // Right stick (axes 2 and 3)
    const rightDot = document.getElementById('axis-dot-right');
    const rightX = document.getElementById('axis-right-x');
    const rightY = document.getElementById('axis-right-y');

    if (rightDot && axes[2] && axes[3]) {
      const x = (axes[2].value * 40) + 50;
      const y = (axes[3].value * 40) + 50;
      rightDot.style.left = `${x}%`;
      rightDot.style.top = `${y}%`;

      if (rightX) rightX.textContent = `X: ${axes[2].value.toFixed(2)}`;
      if (rightY) rightY.textContent = `Y: ${axes[3].value.toFixed(2)}`;
    }
  }

  updateTriggerDisplays(buttons) {
    // LT is usually button 6
    const leftTriggerFill = document.getElementById('trigger-left');
    const leftTriggerValue = document.getElementById('trigger-left-value');
    if (leftTriggerFill && buttons[6]) {
      const value = buttons[6].value * 100;
      leftTriggerFill.style.height = `${value}%`;
      if (leftTriggerValue) leftTriggerValue.textContent = `${Math.round(value)}%`;
    }

    // RT is usually button 7
    const rightTriggerFill = document.getElementById('trigger-right');
    const rightTriggerValue = document.getElementById('trigger-right-value');
    if (rightTriggerFill && buttons[7]) {
      const value = buttons[7].value * 100;
      rightTriggerFill.style.height = `${value}%`;
      if (rightTriggerValue) rightTriggerValue.textContent = `${Math.round(value)}%`;
    }
  }

  updateBindingHighlights() {
    // Update sidebar bindings list with custom gamepad bindings
    this.updateSidebarBindingsList();
  }

  updateSidebarBindingsList() {
    if (!this.contextMenu) return;

    const customBindings = this.contextMenu.getBindings();
    if (!customBindings || Object.keys(customBindings).length === 0) return;

    // Update category counts and add items to sidebar
    const categoryIds = ['flight', 'weapons', 'targeting', 'shields', 'power', 'mining', 'fps', 'vehicles', 'social', 'ui'];
    const categoryCounts = {};
    categoryIds.forEach(cat => categoryCounts[cat] = 0);

    for (const [key, action] of Object.entries(customBindings)) {
      const category = this.getCategoryForAction(action);
      const container = document.getElementById(`bindings-${category}`);
      if (!container) continue;

      const displayKey = this.formatBindingKey(key);
      const actionLabel = this.formatActionName(action);

      // Check if item already exists
      const existingItem = container.querySelector(`[data-binding-key="${key}"]`);
      if (existingItem) {
        categoryCounts[category]++;
        continue;
      }

      const item = document.createElement('div');
      item.className = 'sidebar-binding-item gamepad-binding';
      item.dataset.bindingKey = key;
      item.innerHTML = `
        <span class="sidebar-binding-button">${displayKey}</span>
        <span class="sidebar-binding-action">${actionLabel}</span>
      `;

      container.appendChild(item);
      categoryCounts[category]++;
    }

    // Update category counts
    categoryIds.forEach(cat => {
      const section = document.querySelector(`.category-section[data-category="${cat}"]`);
      if (section) {
        const countEl = section.querySelector('.category-count');
        if (countEl) {
          const currentCount = parseInt(countEl.textContent) || 0;
          countEl.textContent = currentCount + categoryCounts[cat];
        }
      }
    });
  }

  formatBindingKey(key) {
    // Format gamepad binding key for display (e.g., xbox_dpad_up -> D-Pad Up)
    return key
      .replace('xbox_', '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getCategoryForAction(action) {
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
    if (/^v_/.test(action)) {
      return 'flight';
    }
    return 'ui';
  }

  setupAxisButtonHandlers(panel) {
    const axisButtons = panel.querySelectorAll('.hotas-axis-btn');
    axisButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const axisId = btn.dataset.axisId;
        if (axisId && this.contextMenu) {
          // Clear previous selection
          axisButtons.forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');

          // Show context menu for this axis
          await this.contextMenu.show(axisId, btn.textContent.trim(), btn);
        }
      });
    });
  }

  refresh() {
    this.updateBindingHighlights();
  }

  setCategory(category) {
    // Could filter bindings by category if needed
  }

  destroy() {
    if (this.liveInput) {
      this.liveInput.destroy();
    }
  }
}

window.GamepadImageVisualizer = GamepadImageVisualizer;

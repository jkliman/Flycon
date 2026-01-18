/**
 * Gamepad Visualization Component
 * Renders Xbox Elite Controller and PlayStation 5 DualSense with binding highlighting
 */

class GamepadVisualizer {
  constructor(container, parser) {
    this.container = container;
    this.parser = parser;
    this.activeController = 'xbox-elite'; // 'xbox-elite' or 'ps5'
    this.hoveredButton = null;

    this.init();
  }

  init() {
    this.render();
    this.setupEventListeners();
  }

  render() {
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'gamepad-container';

    // Controller selection tabs
    const tabs = document.createElement('div');
    tabs.className = 'gamepad-tabs';
    tabs.innerHTML = `
      <button class="gamepad-tab ${this.activeController === 'xbox-elite' ? 'active' : ''}" data-controller="xbox-elite">Xbox Elite Controller</button>
      <button class="gamepad-tab ${this.activeController === 'ps5' ? 'active' : ''}" data-controller="ps5">PlayStation 5 DualSense</button>
    `;
    wrapper.appendChild(tabs);

    // Controller visualization
    if (this.activeController === 'xbox-elite') {
      wrapper.appendChild(this.renderXboxElite());
    } else {
      wrapper.appendChild(this.renderPS5());
    }

    // Binding legend
    wrapper.appendChild(this.renderLegend());

    this.container.appendChild(wrapper);
    this.updateBindings();
  }

  renderXboxElite() {
    const visual = document.createElement('div');
    visual.className = 'gamepad-visual xbox-elite';
    visual.innerHTML = `
      <div class="gamepad-body">
        <!-- Triggers -->
        <div class="trigger trigger-left" data-button="lt">LT</div>
        <div class="trigger trigger-right" data-button="rt">RT</div>

        <!-- Bumpers -->
        <div class="bumper bumper-left" data-button="lb">LB</div>
        <div class="bumper bumper-right" data-button="rb">RB</div>

        <!-- Left Thumbstick -->
        <div class="thumbstick thumbstick-left" data-button="ls">
          <div class="thumbstick-label">LS</div>
        </div>

        <!-- Right Thumbstick -->
        <div class="thumbstick thumbstick-right" data-button="rs">
          <div class="thumbstick-label">RS</div>
        </div>

        <!-- D-Pad -->
        <div class="dpad">
          <div class="dpad-btn dpad-up" data-button="dpad_up">↑</div>
          <div class="dpad-btn dpad-down" data-button="dpad_down">↓</div>
          <div class="dpad-btn dpad-left" data-button="dpad_left">←</div>
          <div class="dpad-btn dpad-right" data-button="dpad_right">→</div>
          <div class="dpad-btn dpad-center"></div>
        </div>

        <!-- Face Buttons -->
        <div class="face-buttons">
          <div class="face-btn face-btn-y" data-button="y">Y</div>
          <div class="face-btn face-btn-b" data-button="b">B</div>
          <div class="face-btn face-btn-a" data-button="a">A</div>
          <div class="face-btn face-btn-x" data-button="x">X</div>
        </div>

        <!-- Center Buttons -->
        <div class="center-buttons">
          <div class="center-btn" data-button="view">☰</div>
          <div class="center-btn xbox-btn" data-button="xbox">X</div>
          <div class="center-btn" data-button="menu">≡</div>
        </div>

        <!-- Xbox Elite Back Paddles -->
        <div class="elite-paddles">
          <div class="paddle paddle-p1" data-button="p1">P1</div>
          <div class="paddle paddle-p2" data-button="p2">P2</div>
          <div class="paddle paddle-p3" data-button="p3">P3</div>
          <div class="paddle paddle-p4" data-button="p4">P4</div>
        </div>

        <!-- Grips -->
        <div class="gamepad-grip left"></div>
        <div class="gamepad-grip right"></div>
      </div>

      <!-- Labels -->
      <div class="gamepad-label label-ls">Left Stick</div>
      <div class="gamepad-label label-rs">Right Stick</div>
      <div class="gamepad-label label-dpad">D-Pad</div>
      <div class="gamepad-label label-elite">Elite Paddles</div>
    `;

    return visual;
  }

  renderPS5() {
    const visual = document.createElement('div');
    visual.className = 'gamepad-visual ps5';
    visual.innerHTML = `
      <div class="gamepad-body ps5-body">
        <!-- Triggers -->
        <div class="trigger trigger-left ps5-trigger" data-button="l2">L2</div>
        <div class="trigger trigger-right ps5-trigger" data-button="r2">R2</div>

        <!-- Bumpers -->
        <div class="bumper bumper-left ps5-bumper" data-button="l1">L1</div>
        <div class="bumper bumper-right ps5-bumper" data-button="r1">R1</div>

        <!-- Left Thumbstick -->
        <div class="thumbstick thumbstick-left ps5-stick" data-button="l3">
          <div class="thumbstick-label">L3</div>
        </div>

        <!-- Right Thumbstick -->
        <div class="thumbstick thumbstick-right ps5-stick" data-button="r3">
          <div class="thumbstick-label">R3</div>
        </div>

        <!-- D-Pad -->
        <div class="dpad ps5-dpad">
          <div class="dpad-btn dpad-up" data-button="dpad_up">↑</div>
          <div class="dpad-btn dpad-down" data-button="dpad_down">↓</div>
          <div class="dpad-btn dpad-left" data-button="dpad_left">←</div>
          <div class="dpad-btn dpad-right" data-button="dpad_right">→</div>
          <div class="dpad-btn dpad-center"></div>
        </div>

        <!-- Face Buttons (PlayStation symbols) -->
        <div class="face-buttons ps5-face">
          <div class="face-btn face-btn-triangle" data-button="triangle">△</div>
          <div class="face-btn face-btn-circle" data-button="circle">○</div>
          <div class="face-btn face-btn-cross" data-button="cross">✕</div>
          <div class="face-btn face-btn-square" data-button="square">□</div>
        </div>

        <!-- Center Buttons -->
        <div class="center-buttons ps5-center">
          <div class="center-btn ps5-create" data-button="create">Create</div>
          <div class="center-btn ps5-ps" data-button="ps">PS</div>
          <div class="center-btn ps5-options" data-button="options">Options</div>
        </div>

        <!-- Touchpad -->
        <div class="ps5-touchpad" data-button="touchpad">
          <span>Touchpad</span>
        </div>

        <!-- Mute Button -->
        <div class="ps5-mute" data-button="mute">🔇</div>

        <!-- Grips -->
        <div class="gamepad-grip left ps5-grip"></div>
        <div class="gamepad-grip right ps5-grip"></div>
      </div>

      <!-- Labels -->
      <div class="gamepad-label label-ls">Left Stick</div>
      <div class="gamepad-label label-rs">Right Stick</div>
      <div class="gamepad-label label-dpad">D-Pad</div>
    `;

    return visual;
  }

  renderLegend() {
    const legend = document.createElement('div');
    legend.className = 'gamepad-legend';
    legend.id = 'gamepad-legend';
    legend.innerHTML = `<p style="color: var(--text-muted);">Hover over buttons to see bindings</p>`;
    return legend;
  }

  setupEventListeners() {
    // Tab switching
    this.container.addEventListener('click', (e) => {
      const tab = e.target.closest('.gamepad-tab');
      if (tab) {
        this.activeController = tab.dataset.controller;
        this.render();
      }
    });

    // Button hover
    this.container.addEventListener('mouseover', (e) => {
      const button = e.target.closest('[data-button]');
      if (button) {
        this.hoveredButton = button.dataset.button;
        this.showButtonBindings(button.dataset.button);
        button.classList.add('active');
      }
    });

    this.container.addEventListener('mouseout', (e) => {
      const button = e.target.closest('[data-button]');
      if (button) {
        button.classList.remove('active');
        if (this.hoveredButton === button.dataset.button) {
          this.hoveredButton = null;
        }
      }
    });
  }

  showButtonBindings(button) {
    const detailsContent = document.getElementById('details-content');
    if (!detailsContent) return;

    // Map button names to parser keys
    const buttonMap = this.getButtonMapping();
    const key = buttonMap[button] || button;

    const bindings = this.parser.getBindingsForKey(key);

    if (bindings.length === 0) {
      detailsContent.innerHTML = `
        <p class="placeholder-text">No bindings for "${button.toUpperCase()}"</p>
      `;
      return;
    }

    const bindingHTML = bindings.map(b => `
      <div class="binding-entry">
        <span class="binding-action">${b.label}</span>
        <span class="binding-description">${b.action}</span>
      </div>
    `).join('');

    detailsContent.innerHTML = `
      <div class="binding-info">
        ${bindingHTML}
      </div>
    `;
  }

  getButtonMapping() {
    // Map display button names to Star Citizen binding keys
    if (this.activeController === 'xbox-elite') {
      return {
        'a': 'button1',
        'b': 'button2',
        'x': 'button3',
        'y': 'button4',
        'lb': 'button5',
        'rb': 'button6',
        'lt': 'axis_z+',
        'rt': 'axis_z-',
        'ls': 'button9',
        'rs': 'button10',
        'view': 'button7',
        'menu': 'button8',
        'dpad_up': 'hat1_up',
        'dpad_down': 'hat1_down',
        'dpad_left': 'hat1_left',
        'dpad_right': 'hat1_right',
        'p1': 'button11',
        'p2': 'button12',
        'p3': 'button13',
        'p4': 'button14'
      };
    } else {
      return {
        'cross': 'button1',
        'circle': 'button2',
        'square': 'button3',
        'triangle': 'button4',
        'l1': 'button5',
        'r1': 'button6',
        'l2': 'axis_z+',
        'r2': 'axis_z-',
        'l3': 'button11',
        'r3': 'button12',
        'create': 'button9',
        'options': 'button10',
        'ps': 'button13',
        'touchpad': 'button14',
        'mute': 'button15',
        'dpad_up': 'hat1_up',
        'dpad_down': 'hat1_down',
        'dpad_left': 'hat1_left',
        'dpad_right': 'hat1_right'
      };
    }
  }

  updateBindings() {
    // Clear all bound states
    this.container.querySelectorAll('[data-button]').forEach(el => {
      el.classList.remove('bound');
    });

    // Get gamepad bindings
    const gamepadBindings = this.parser.getBindingsForDevice('gamepad');
    const buttonMap = this.getButtonMapping();
    const reverseMap = {};

    // Create reverse mapping
    Object.entries(buttonMap).forEach(([display, internal]) => {
      reverseMap[internal] = display;
    });

    // Apply bindings
    gamepadBindings.forEach(binding => {
      const displayButton = reverseMap[binding.key] || binding.key;
      const buttonElement = this.container.querySelector(`[data-button="${displayButton}"]`);
      if (buttonElement) {
        buttonElement.classList.add('bound');
      }
    });

    // Update legend with bound buttons
    this.updateLegend(gamepadBindings);
  }

  updateLegend(bindings) {
    const legend = document.getElementById('gamepad-legend');
    if (!legend) return;

    if (bindings.length === 0) {
      legend.innerHTML = '<p style="color: var(--text-muted);">No gamepad bindings loaded</p>';
      return;
    }

    const html = bindings.slice(0, 10).map(b => `
      <div class="legend-item">
        <div class="legend-button bound">${b.key}</div>
        <span class="legend-action">${b.label}</span>
      </div>
    `).join('');

    legend.innerHTML = html;
    if (bindings.length > 10) {
      legend.innerHTML += `<p style="color: var(--text-muted); margin-left: 10px;">+${bindings.length - 10} more...</p>`;
    }
  }

  setController(controller) {
    this.activeController = controller;
    this.render();
  }

  refresh() {
    this.updateBindings();
  }
}

window.GamepadVisualizer = GamepadVisualizer;

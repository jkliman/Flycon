/**
 * HOTAS / Flight Stick Visualization Component
 * Renders Logitech X56, MOZA AB9, and VKB Gladiator controllers
 */

class HOTASVisualizer {
  constructor(container, parser) {
    this.container = container;
    this.parser = parser;
    this.activeDevice = 'x56-stick'; // 'x56-stick', 'x56-throttle', 'vkb-left', 'vkb-right', 'moza-ab9'
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
    wrapper.className = 'hotas-container';

    // Device selection tabs
    const tabs = document.createElement('div');
    tabs.className = 'hotas-tabs';
    tabs.innerHTML = `
      <button class="hotas-tab ${this.activeDevice === 'x56-stick' ? 'active' : ''}" data-device="x56-stick">X56 Stick</button>
      <button class="hotas-tab ${this.activeDevice === 'x56-throttle' ? 'active' : ''}" data-device="x56-throttle">X56 Throttle</button>
      <button class="hotas-tab ${this.activeDevice === 'vkb-left' ? 'active' : ''}" data-device="vkb-left">VKB Left</button>
      <button class="hotas-tab ${this.activeDevice === 'vkb-right' ? 'active' : ''}" data-device="vkb-right">VKB Right</button>
      <button class="hotas-tab ${this.activeDevice === 'moza-ab9' ? 'active' : ''}" data-device="moza-ab9">AB9</button>
    `;
    wrapper.appendChild(tabs);

    // Device visualization
    const deviceWrapper = document.createElement('div');
    deviceWrapper.className = 'hotas-device-wrapper';

    switch (this.activeDevice) {
      case 'x56-stick':
        deviceWrapper.appendChild(this.renderX56Stick());
        break;
      case 'x56-throttle':
        deviceWrapper.appendChild(this.renderX56Throttle());
        break;
      case 'vkb-left':
        deviceWrapper.appendChild(this.renderVKBGladiator('left'));
        break;
      case 'vkb-right':
        deviceWrapper.appendChild(this.renderVKBGladiator('right'));
        break;
      case 'moza-ab9':
        deviceWrapper.appendChild(this.renderMozaAB9());
        break;
    }

    wrapper.appendChild(deviceWrapper);

    // Bindings list
    wrapper.appendChild(this.renderBindingsList());

    this.container.appendChild(wrapper);
    this.updateBindings();
  }

  renderX56Throttle() {
    const section = document.createElement('div');
    section.className = 'throttle-section x56-throttle';
    section.innerHTML = `
      <div class="device-label">X56 Throttle</div>
      <div class="throttle-visual">
        <div class="throttle-base">
          <!-- Rotary Encoders on base -->
          <div class="th-rotary th-rotary-1" data-button="rotary1" title="Rotary 1"></div>
          <div class="th-rotary th-rotary-2" data-button="rotary2" title="Rotary 2"></div>
          <div class="th-rotary th-rotary-3" data-button="rotary3" title="Rotary 3"></div>
          <div class="th-rotary th-rotary-4" data-button="rotary4" title="Rotary 4"></div>

          <!-- Toggle Switches -->
          <div class="th-toggle-row">
            <div class="th-toggle" data-button="sw1" title="Switch 1">SW1</div>
            <div class="th-toggle" data-button="sw2" title="Switch 2">SW2</div>
            <div class="th-toggle" data-button="sw3" title="Switch 3">SW3</div>
            <div class="th-toggle" data-button="sw4" title="Switch 4">SW4</div>
          </div>

          <!-- Mode Dial -->
          <div class="th-mode-dial" data-button="mode" title="Mode Selector">M</div>

          <!-- Scroll Wheel -->
          <div class="th-scroll" data-button="scroll" title="Scroll Wheel"></div>
        </div>

        <div class="throttle-handle">
          <!-- Throttle Ministick -->
          <div class="th-ministick" data-button="ministick" title="Ministick"></div>

          <!-- Hat Switches on Throttle -->
          <div class="th-hat th-hat1">
            <div class="hat-btn hat-up" data-button="th_hat1_up">↑</div>
            <div class="hat-btn hat-down" data-button="th_hat1_down">↓</div>
            <div class="hat-btn hat-left" data-button="th_hat1_left">←</div>
            <div class="hat-btn hat-right" data-button="th_hat1_right">→</div>
            <div class="hat-btn hat-center" data-button="th_hat1_push"></div>
          </div>

          <div class="th-hat th-hat2">
            <div class="hat-btn hat-up" data-button="th_hat2_up">↑</div>
            <div class="hat-btn hat-down" data-button="th_hat2_down">↓</div>
            <div class="hat-btn hat-left" data-button="th_hat2_left">←</div>
            <div class="hat-btn hat-right" data-button="th_hat2_right">→</div>
            <div class="hat-btn hat-center" data-button="th_hat2_push"></div>
          </div>

          <!-- Throttle Buttons -->
          <div class="th-btn th-btn-e" data-button="th_e">E</div>
          <div class="th-btn th-btn-f" data-button="th_f">F</div>
          <div class="th-btn th-btn-g" data-button="th_g">G</div>
          <div class="th-btn th-btn-h" data-button="th_h">H</div>
          <div class="th-btn th-btn-i" data-button="th_i">I</div>
          <div class="th-btn th-btn-j" data-button="th_j">J</div>
          <div class="th-btn th-btn-k" data-button="th_k">K</div>
        </div>

        <!-- Throttle Axis -->
        <div class="th-axis-rail">
          <div class="th-axis-indicator"></div>
        </div>
        <div class="th-axis-label">Throttle Axis</div>

        <!-- RTY Axis (Side Slider) -->
        <div class="th-rty-slider" data-button="rty" title="RTY Axis">
          <div class="slider-knob"></div>
        </div>
      </div>
    `;
    return section;
  }

  renderX56Stick() {
    const section = document.createElement('div');
    section.className = 'joystick-section x56-stick';
    section.innerHTML = `
      <div class="device-label">X56 Stick</div>
      <div class="joystick-visual">
        <div class="joystick-base">
          <!-- Base buttons -->
          <div class="js-base-btn js-base-1" data-button="base1">1</div>
          <div class="js-base-btn js-base-2" data-button="base2">2</div>
        </div>

        <div class="joystick-grip">
          <!-- Primary Trigger -->
          <div class="js-trigger" data-button="trigger" title="Primary Trigger">TRG</div>

          <!-- Pinky Button/Trigger -->
          <div class="js-pinky" data-button="pinky" title="Pinky">PKY</div>

          <!-- Hat Switches -->
          <div class="js-hat js-hat1">
            <div class="hat-btn hat-up" data-button="hat1_up">↑</div>
            <div class="hat-btn hat-down" data-button="hat1_down">↓</div>
            <div class="hat-btn hat-left" data-button="hat1_left">←</div>
            <div class="hat-btn hat-right" data-button="hat1_right">→</div>
            <div class="hat-btn hat-center" data-button="hat1_push"></div>
          </div>

          <div class="js-hat js-hat2">
            <div class="hat-btn hat-up" data-button="hat2_up">↑</div>
            <div class="hat-btn hat-down" data-button="hat2_down">↓</div>
            <div class="hat-btn hat-left" data-button="hat2_left">←</div>
            <div class="hat-btn hat-right" data-button="hat2_right">→</div>
            <div class="hat-btn hat-center" data-button="hat2_push"></div>
          </div>

          <!-- POV Hat (Top) -->
          <div class="js-pov">
            <div class="hat-btn hat-up" data-button="pov_up">↑</div>
            <div class="hat-btn hat-down" data-button="pov_down">↓</div>
            <div class="hat-btn hat-left" data-button="pov_left">←</div>
            <div class="hat-btn hat-right" data-button="pov_right">→</div>
          </div>

          <!-- Stick Buttons -->
          <div class="js-btn js-btn-a" data-button="btn_a">A</div>
          <div class="js-btn js-btn-b" data-button="btn_b">B</div>
          <div class="js-btn js-btn-c" data-button="btn_c">C</div>
          <div class="js-btn js-btn-d" data-button="btn_d">D</div>

          <!-- Thumb Stick (Ministick) -->
          <div class="js-ministick" data-button="js_ministick" title="Ministick"></div>

          <!-- Thumb Rotary -->
          <div class="js-thumb-rotary" data-button="thumb_rotary" title="Thumb Rotary"></div>
        </div>

        <!-- Stick Axis Labels -->
        <div class="axis-indicator x-axis">X Axis</div>
        <div class="axis-indicator y-axis">Y Axis</div>
        <div class="axis-indicator twist-axis">Twist (Z)</div>
      </div>
    `;
    return section;
  }

  renderMozaAB9() {
    const section = document.createElement('div');
    section.className = 'joystick-section moza-ab9';
    section.innerHTML = `
      <div class="device-label">MOZA AB9 Flight Stick</div>
      <div class="joystick-visual moza-visual">
        <div class="joystick-base moza-base">
          <!-- Twist lock indicator -->
          <div class="moza-twist-lock">Twist Lock</div>
        </div>

        <div class="joystick-grip moza-grip">
          <!-- Primary Trigger (2-stage) -->
          <div class="js-trigger moza-trigger" data-button="trigger1" title="Trigger Stage 1">T1</div>
          <div class="js-trigger-2 moza-trigger-2" data-button="trigger2" title="Trigger Stage 2">T2</div>

          <!-- Top POV Hat -->
          <div class="moza-pov">
            <div class="hat-btn hat-up" data-button="pov_up">↑</div>
            <div class="hat-btn hat-down" data-button="pov_down">↓</div>
            <div class="hat-btn hat-left" data-button="pov_left">←</div>
            <div class="hat-btn hat-right" data-button="pov_right">→</div>
            <div class="hat-btn hat-center" data-button="pov_push"></div>
          </div>

          <!-- HAT 2 (Below POV) -->
          <div class="moza-hat2">
            <div class="hat-btn hat-up" data-button="hat2_up">↑</div>
            <div class="hat-btn hat-down" data-button="hat2_down">↓</div>
            <div class="hat-btn hat-left" data-button="hat2_left">←</div>
            <div class="hat-btn hat-right" data-button="hat2_right">→</div>
            <div class="hat-btn hat-center" data-button="hat2_push"></div>
          </div>

          <!-- Analog Stick (Thumb) -->
          <div class="moza-analog" data-button="analog_stick" title="Analog Stick"></div>

          <!-- Face Buttons -->
          <div class="moza-btn moza-btn-1" data-button="btn1">1</div>
          <div class="moza-btn moza-btn-2" data-button="btn2">2</div>
          <div class="moza-btn moza-btn-3" data-button="btn3">3</div>
          <div class="moza-btn moza-btn-4" data-button="btn4">4</div>
          <div class="moza-btn moza-btn-5" data-button="btn5">5</div>
          <div class="moza-btn moza-btn-6" data-button="btn6">6</div>

          <!-- Pinky Lever -->
          <div class="moza-pinky" data-button="pinky" title="Pinky Lever">PKY</div>

          <!-- Paddle (Back of grip) -->
          <div class="moza-paddle" data-button="paddle" title="Paddle">PDL</div>

          <!-- Scroll Wheel -->
          <div class="moza-scroll" data-button="scroll" title="Scroll Wheel">
            <div class="scroll-indicator"></div>
          </div>
        </div>

        <!-- Axis Labels -->
        <div class="axis-indicator x-axis">Pitch</div>
        <div class="axis-indicator y-axis">Roll</div>
        <div class="axis-indicator twist-axis">Twist (Yaw)</div>
      </div>
    `;
    return section;
  }

  renderVKBGladiator(side) {
    const sideLabel = side === 'left' ? 'Left (SCG)' : 'Right (SCG)';
    const section = document.createElement('div');
    section.className = `joystick-section vkb-gladiator vkb-${side}`;
    section.innerHTML = `
      <div class="device-label">VKB Gladiator NXT EVO ${sideLabel}</div>
      <div class="joystick-visual vkb-visual">
        <div class="joystick-base vkb-base">
          <!-- Base Buttons/Encoders -->
          <div class="vkb-base-btn vkb-base-a1" data-button="base_a1">A1</div>
          <div class="vkb-base-btn vkb-base-a2" data-button="base_a2">A2</div>
          <div class="vkb-base-btn vkb-base-a3" data-button="base_a3">A3</div>
          <div class="vkb-base-btn vkb-base-a4" data-button="base_a4">A4</div>
          <div class="vkb-base-encoder vkb-enc-1" data-button="encoder1" title="Encoder 1"></div>
          <div class="vkb-base-encoder vkb-enc-2" data-button="encoder2" title="Encoder 2"></div>
          <div class="vkb-rapid-fire" data-button="rapid_fire">RF</div>
        </div>

        <div class="joystick-grip vkb-grip">
          <!-- Primary Trigger -->
          <div class="js-trigger vkb-trigger" data-button="trigger" title="Primary Trigger">TRG</div>

          <!-- Secondary Trigger (Flip) -->
          <div class="vkb-flip-trigger" data-button="flip_trigger" title="Flip Trigger">FLP</div>

          <!-- POV Hat (Top) -->
          <div class="vkb-pov">
            <div class="hat-btn hat-up" data-button="pov_up">↑</div>
            <div class="hat-btn hat-down" data-button="pov_down">↓</div>
            <div class="hat-btn hat-left" data-button="pov_left">←</div>
            <div class="hat-btn hat-right" data-button="pov_right">→</div>
            <div class="hat-btn hat-center" data-button="pov_push"></div>
          </div>

          <!-- HAT 2 -->
          <div class="vkb-hat2">
            <div class="hat-btn hat-up" data-button="hat2_up">↑</div>
            <div class="hat-btn hat-down" data-button="hat2_down">↓</div>
            <div class="hat-btn hat-left" data-button="hat2_left">←</div>
            <div class="hat-btn hat-right" data-button="hat2_right">→</div>
            <div class="hat-btn hat-center" data-button="hat2_push"></div>
          </div>

          <!-- HAT 3 (Castle Hat) -->
          <div class="vkb-hat3 castle-hat">
            <div class="hat-btn hat-up" data-button="hat3_up">↑</div>
            <div class="hat-btn hat-down" data-button="hat3_down">↓</div>
            <div class="hat-btn hat-left" data-button="hat3_left">←</div>
            <div class="hat-btn hat-right" data-button="hat3_right">→</div>
            <div class="hat-btn hat-center" data-button="hat3_push"></div>
          </div>

          <!-- Analog Ministick -->
          <div class="vkb-analog" data-button="analog_stick" title="Analog Ministick"></div>

          <!-- Button Cluster -->
          <div class="vkb-btn vkb-btn-1" data-button="btn1">B1</div>
          <div class="vkb-btn vkb-btn-2" data-button="btn2">B2</div>
          <div class="vkb-btn vkb-btn-3" data-button="btn3">B3</div>
          <div class="vkb-btn vkb-btn-4" data-button="btn4">B4</div>

          <!-- Pinky Button -->
          <div class="vkb-pinky" data-button="pinky" title="Pinky Button">PKY</div>

          <!-- Pinky Lever (3-way) -->
          <div class="vkb-pinky-lever" data-button="pinky_lever" title="Pinky Lever 3-Way">
            <div class="lever-pos up" data-button="pinky_up">↑</div>
            <div class="lever-pos down" data-button="pinky_down">↓</div>
          </div>
        </div>

        <!-- Axis Labels -->
        <div class="axis-indicator x-axis">${side === 'left' ? 'Strafe X' : 'Pitch'}</div>
        <div class="axis-indicator y-axis">${side === 'left' ? 'Strafe Y' : 'Roll'}</div>
        <div class="axis-indicator twist-axis">${side === 'left' ? 'Strafe Z' : 'Yaw'}</div>
      </div>
    `;
    return section;
  }

  renderBindingsList() {
    const list = document.createElement('div');
    list.className = 'hotas-bindings';
    list.id = 'hotas-bindings';
    list.innerHTML = '<p style="color: var(--text-muted);">Hover over buttons to see bindings</p>';
    return list;
  }

  setupEventListeners() {
    // Tab switching
    this.container.addEventListener('click', (e) => {
      const tab = e.target.closest('.hotas-tab');
      if (tab) {
        this.activeDevice = tab.dataset.device;
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

    // Map button names based on device
    const key = this.mapButtonToBinding(button);
    const bindings = this.parser.getBindingsForKey(key);

    if (bindings.length === 0) {
      detailsContent.innerHTML = `
        <p class="placeholder-text">No bindings for "${button}"</p>
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

  mapButtonToBinding(button) {
    // Map UI button names to Star Citizen binding keys
    // This varies based on how the device is configured in Star Citizen
    const devicePrefix = this.getDevicePrefix();

    // Basic mapping - real implementation would need device-specific mappings
    const buttonMappings = {
      // Common mappings
      'trigger': 'button1',
      'trigger1': 'button1',
      'trigger2': 'button2',
      'btn_a': 'button3',
      'btn_b': 'button4',
      'btn_c': 'button5',
      'btn_d': 'button6',
      'pinky': 'button7',
      'paddle': 'button8',
      'pov_up': 'hat1_up',
      'pov_down': 'hat1_down',
      'pov_left': 'hat1_left',
      'pov_right': 'hat1_right',
      'pov_push': 'hat1_push',
      'hat2_up': 'hat2_up',
      'hat2_down': 'hat2_down',
      'hat2_left': 'hat2_left',
      'hat2_right': 'hat2_right',
      'hat2_push': 'hat2_push'
    };

    return buttonMappings[button] || button;
  }

  getDevicePrefix() {
    // Return joystick prefix based on active device
    switch (this.activeDevice) {
      case 'x56-stick': return 'js1_';
      case 'x56-throttle': return 'js1_';
      case 'vkb-left': return 'js1_';
      case 'vkb-right': return 'js2_';
      case 'moza-ab9': return 'js2_';
      default: return 'js_';
    }
  }

  updateBindings() {
    // Clear all bound states
    this.container.querySelectorAll('[data-button]').forEach(el => {
      el.classList.remove('bound');
    });

    // Get joystick bindings
    const joystickBindings = this.parser.getBindingsForDevice('joystick');

    // Apply bindings (simplified - real implementation would need device mapping)
    joystickBindings.forEach(binding => {
      // Try to find matching button
      const button = this.container.querySelector(`[data-button="${binding.key}"]`);
      if (button) {
        button.classList.add('bound');
      }
    });

    // Update bindings list
    this.updateBindingsList(joystickBindings);
  }

  updateBindingsList(bindings) {
    const list = document.getElementById('hotas-bindings');
    if (!list) return;

    if (bindings.length === 0) {
      list.innerHTML = '<p style="color: var(--text-muted);">No joystick bindings loaded</p>';
      return;
    }

    const html = bindings.slice(0, 15).map(b => `
      <div class="hotas-binding-row">
        <span class="hotas-binding-input">${b.key}</span>
        <span class="hotas-binding-action">${b.label}</span>
        <span class="hotas-binding-category">${b.category}</span>
      </div>
    `).join('');

    list.innerHTML = `
      <div class="hotas-bindings-section">
        <h4>Joystick Bindings</h4>
        ${html}
        ${bindings.length > 15 ? `<p style="color: var(--text-muted); margin-top: 10px;">+${bindings.length - 15} more...</p>` : ''}
      </div>
    `;
  }

  setDevice(device) {
    this.activeDevice = device;
    this.render();
  }

  refresh() {
    this.updateBindings();
  }
}

window.HOTASVisualizer = HOTASVisualizer;

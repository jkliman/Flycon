/**
 * Keyboard Visualization Component
 * Renders a realistic keyboard with binding highlighting
 */

class KeyboardVisualizer {
  constructor(container, parser) {
    this.container = container;
    this.parser = parser;
    this.activeCategory = 'all';
    this.hoveredKey = null;
    this.contextMenu = null;

    this.keyboardLayout = this.getKeyboardLayout();
    this.init();
  }

  getKeyboardLayout() {
    return {
      // Function row
      functionRow: [
        { key: 'escape', label: 'Esc', class: 'key-esc' },
        { key: 'f1', label: 'F1', class: 'key-fn-key' },
        { key: 'f2', label: 'F2', class: 'key-fn-key' },
        { key: 'f3', label: 'F3', class: 'key-fn-key' },
        { key: 'f4', label: 'F4', class: 'key-fn-key' },
        { key: 'f5', label: 'F5', class: 'key-fn-key' },
        { key: 'f6', label: 'F6', class: 'key-fn-key' },
        { key: 'f7', label: 'F7', class: 'key-fn-key' },
        { key: 'f8', label: 'F8', class: 'key-fn-key' },
        { key: 'f9', label: 'F9', class: 'key-fn-key' },
        { key: 'f10', label: 'F10', class: 'key-fn-key' },
        { key: 'f11', label: 'F11', class: 'key-fn-key' },
        { key: 'f12', label: 'F12', class: 'key-fn-key' }
      ],
      // Number row
      numberRow: [
        { key: 'grave', label: '`', secondary: '~', class: 'key-tilde' },
        { key: '1', label: '1', secondary: '!' },
        { key: '2', label: '2', secondary: '@' },
        { key: '3', label: '3', secondary: '#' },
        { key: '4', label: '4', secondary: '$' },
        { key: '5', label: '5', secondary: '%' },
        { key: '6', label: '6', secondary: '^' },
        { key: '7', label: '7', secondary: '&' },
        { key: '8', label: '8', secondary: '*' },
        { key: '9', label: '9', secondary: '(' },
        { key: '0', label: '0', secondary: ')' },
        { key: 'minus', label: '-', secondary: '_' },
        { key: 'equals', label: '=', secondary: '+' },
        { key: 'backspace', label: 'Backspace', class: 'key-backspace' }
      ],
      // QWERTY row
      qwertyRow: [
        { key: 'tab', label: 'Tab', class: 'key-tab' },
        { key: 'q', label: 'Q' },
        { key: 'w', label: 'W' },
        { key: 'e', label: 'E' },
        { key: 'r', label: 'R' },
        { key: 't', label: 'T' },
        { key: 'y', label: 'Y' },
        { key: 'u', label: 'U' },
        { key: 'i', label: 'I' },
        { key: 'o', label: 'O' },
        { key: 'p', label: 'P' },
        { key: 'lbracket', label: '[', secondary: '{' },
        { key: 'rbracket', label: ']', secondary: '}' },
        { key: 'backslash', label: '\\', secondary: '|' }
      ],
      // Home row
      homeRow: [
        { key: 'capslock', label: 'Caps', class: 'key-caps' },
        { key: 'a', label: 'A' },
        { key: 's', label: 'S' },
        { key: 'd', label: 'D' },
        { key: 'f', label: 'F' },
        { key: 'g', label: 'G' },
        { key: 'h', label: 'H' },
        { key: 'j', label: 'J' },
        { key: 'k', label: 'K' },
        { key: 'l', label: 'L' },
        { key: 'semicolon', label: ';', secondary: ':' },
        { key: 'apostrophe', label: "'", secondary: '"' },
        { key: 'enter', label: 'Enter', class: 'key-enter' }
      ],
      // Bottom letter row
      bottomRow: [
        { key: 'lshift', label: 'Shift', class: 'key-shift-left' },
        { key: 'z', label: 'Z' },
        { key: 'x', label: 'X' },
        { key: 'c', label: 'C' },
        { key: 'v', label: 'V' },
        { key: 'b', label: 'B' },
        { key: 'n', label: 'N' },
        { key: 'm', label: 'M' },
        { key: 'comma', label: ',', secondary: '<' },
        { key: 'period', label: '.', secondary: '>' },
        { key: 'slash', label: '/', secondary: '?' },
        { key: 'rshift', label: 'Shift', class: 'key-shift-right' }
      ],
      // Space row
      spaceRow: [
        { key: 'lctrl', label: 'Ctrl', class: 'key-ctrl' },
        { key: 'lwin', label: 'Win', class: 'key-fn' },
        { key: 'lalt', label: 'Alt', class: 'key-alt' },
        { key: 'space', label: '', class: 'key-space' },
        { key: 'ralt', label: 'Alt', class: 'key-alt' },
        { key: 'rwin', label: 'Win', class: 'key-fn' },
        { key: 'menu', label: 'Menu', class: 'key-menu' },
        { key: 'rctrl', label: 'Ctrl', class: 'key-ctrl' }
      ],
      // Navigation cluster
      navCluster: {
        top: [
          { key: 'printscreen', label: 'PrtSc', class: 'key-nav' },
          { key: 'scrolllock', label: 'ScrLk', class: 'key-nav' },
          { key: 'pause', label: 'Pause', class: 'key-nav' }
        ],
        middle: [
          { key: 'insert', label: 'Ins', class: 'key-nav' },
          { key: 'home', label: 'Home', class: 'key-nav' },
          { key: 'pageup', label: 'PgUp', class: 'key-nav' }
        ],
        bottom: [
          { key: 'delete', label: 'Del', class: 'key-nav' },
          { key: 'end', label: 'End', class: 'key-nav' },
          { key: 'pagedown', label: 'PgDn', class: 'key-nav' }
        ]
      },
      // Arrow cluster
      arrowCluster: [
        { key: 'up', label: '↑', class: 'key-arrow' },
        { key: 'left', label: '←', class: 'key-arrow' },
        { key: 'down', label: '↓', class: 'key-arrow' },
        { key: 'right', label: '→', class: 'key-arrow' }
      ],
      // Numpad
      numpad: {
        row1: [
          { key: 'numlock', label: 'Num', class: 'key-numpad' },
          { key: 'np_divide', label: '/', class: 'key-numpad' },
          { key: 'np_multiply', label: '*', class: 'key-numpad' },
          { key: 'np_minus', label: '-', class: 'key-numpad' }
        ],
        row2: [
          { key: 'np_7', label: '7', class: 'key-numpad' },
          { key: 'np_8', label: '8', class: 'key-numpad' },
          { key: 'np_9', label: '9', class: 'key-numpad' }
        ],
        row3: [
          { key: 'np_4', label: '4', class: 'key-numpad' },
          { key: 'np_5', label: '5', class: 'key-numpad' },
          { key: 'np_6', label: '6', class: 'key-numpad' }
        ],
        row4: [
          { key: 'np_1', label: '1', class: 'key-numpad' },
          { key: 'np_2', label: '2', class: 'key-numpad' },
          { key: 'np_3', label: '3', class: 'key-numpad' }
        ],
        row5: [
          { key: 'np_0', label: '0', class: 'key-numpad key-num0' },
          { key: 'np_period', label: '.', class: 'key-numpad' }
        ],
        plus: { key: 'np_plus', label: '+', class: 'key-numpad key-numplus' },
        enter: { key: 'np_enter', label: 'Ent', class: 'key-numpad key-numenter' }
      }
    };
  }

  init() {
    this.render();
    this.setupEventListeners();
    this.initContextMenu();
  }

  initContextMenu() {
    // Initialize the keyboard binding context menu
    if (typeof KeyboardBindingContextMenu !== 'undefined') {
      this.contextMenu = new KeyboardBindingContextMenu();
      this.contextMenu.onBindingChanged = (bindings) => {
        this.updateBindings();
        this.updateSidebarBindingsList();
      };
    }
  }

  render() {
    this.container.innerHTML = '';

    const keyboard = document.createElement('div');
    keyboard.className = 'keyboard-container';

    // Main keyboard section
    const mainSection = document.createElement('div');
    mainSection.className = 'keyboard-main';

    // Left section (main keys)
    const leftSection = document.createElement('div');
    leftSection.className = 'keyboard-section';

    // Function row
    leftSection.appendChild(this.renderRow(this.keyboardLayout.functionRow, 'function-row'));

    // Add spacing
    const spacer = document.createElement('div');
    spacer.style.height = '20px';
    leftSection.appendChild(spacer);

    // Number row
    leftSection.appendChild(this.renderRow(this.keyboardLayout.numberRow, 'number-row'));

    // QWERTY row
    leftSection.appendChild(this.renderRow(this.keyboardLayout.qwertyRow, 'qwerty-row'));

    // Home row
    leftSection.appendChild(this.renderRow(this.keyboardLayout.homeRow, 'home-row'));

    // Bottom row
    leftSection.appendChild(this.renderRow(this.keyboardLayout.bottomRow, 'bottom-row'));

    // Space row
    leftSection.appendChild(this.renderRow(this.keyboardLayout.spaceRow, 'space-row'));

    mainSection.appendChild(leftSection);

    // Navigation and arrow section
    const navSection = document.createElement('div');
    navSection.className = 'nav-cluster';

    // Nav top row
    navSection.appendChild(this.renderRow(this.keyboardLayout.navCluster.top, 'nav-top-row'));
    navSection.appendChild(this.renderRow(this.keyboardLayout.navCluster.middle, 'nav-middle-row'));
    navSection.appendChild(this.renderRow(this.keyboardLayout.navCluster.bottom, 'nav-bottom-row'));

    // Arrow keys
    const arrowCluster = document.createElement('div');
    arrowCluster.className = 'arrow-cluster';

    const arrowTopRow = document.createElement('div');
    arrowTopRow.className = 'arrow-row';
    arrowTopRow.appendChild(this.renderKey(this.keyboardLayout.arrowCluster[0]));
    arrowCluster.appendChild(arrowTopRow);

    const arrowBottomRow = document.createElement('div');
    arrowBottomRow.className = 'arrow-row';
    arrowBottomRow.appendChild(this.renderKey(this.keyboardLayout.arrowCluster[1]));
    arrowBottomRow.appendChild(this.renderKey(this.keyboardLayout.arrowCluster[2]));
    arrowBottomRow.appendChild(this.renderKey(this.keyboardLayout.arrowCluster[3]));
    arrowCluster.appendChild(arrowBottomRow);

    navSection.appendChild(arrowCluster);
    mainSection.appendChild(navSection);

    // Numpad section
    const numpadSection = document.createElement('div');
    numpadSection.className = 'numpad';

    // Numpad rows with plus key
    const numpadRow1 = this.renderRow(this.keyboardLayout.numpad.row1, 'numpad-row');
    numpadSection.appendChild(numpadRow1);

    // Rows 2-4 with plus key on the side
    const numpadMiddle = document.createElement('div');
    numpadMiddle.style.display = 'flex';
    numpadMiddle.style.gap = '6px';

    const numpadLeft = document.createElement('div');
    numpadLeft.style.display = 'flex';
    numpadLeft.style.flexDirection = 'column';
    numpadLeft.style.gap = '6px';
    numpadLeft.appendChild(this.renderRow(this.keyboardLayout.numpad.row2, 'numpad-row'));
    numpadLeft.appendChild(this.renderRow(this.keyboardLayout.numpad.row3, 'numpad-row'));

    numpadMiddle.appendChild(numpadLeft);
    numpadMiddle.appendChild(this.renderKey(this.keyboardLayout.numpad.plus));
    numpadSection.appendChild(numpadMiddle);

    // Rows 4-5 with enter key
    const numpadBottom = document.createElement('div');
    numpadBottom.style.display = 'flex';
    numpadBottom.style.gap = '6px';

    const numpadBottomLeft = document.createElement('div');
    numpadBottomLeft.style.display = 'flex';
    numpadBottomLeft.style.flexDirection = 'column';
    numpadBottomLeft.style.gap = '6px';
    numpadBottomLeft.appendChild(this.renderRow(this.keyboardLayout.numpad.row4, 'numpad-row'));
    numpadBottomLeft.appendChild(this.renderRow(this.keyboardLayout.numpad.row5, 'numpad-row'));

    numpadBottom.appendChild(numpadBottomLeft);
    numpadBottom.appendChild(this.renderKey(this.keyboardLayout.numpad.enter));
    numpadSection.appendChild(numpadBottom);

    mainSection.appendChild(numpadSection);
    keyboard.appendChild(mainSection);

    // Mouse visualization
    keyboard.appendChild(this.renderMouse());

    this.container.appendChild(keyboard);
    this.updateBindings();
  }

  renderRow(keys, className) {
    const row = document.createElement('div');
    row.className = `keyboard-row ${className}`;

    keys.forEach(keyData => {
      row.appendChild(this.renderKey(keyData));
    });

    return row;
  }

  renderKey(keyData) {
    const key = document.createElement('div');
    key.className = `key ${keyData.class || ''}`;
    key.dataset.key = keyData.key;

    const label = document.createElement('span');
    label.className = 'key-label';
    label.textContent = keyData.label;
    key.appendChild(label);

    if (keyData.secondary) {
      const secondary = document.createElement('span');
      secondary.className = 'key-secondary';
      secondary.textContent = keyData.secondary;
      key.appendChild(secondary);
    }

    return key;
  }

  renderMouse() {
    const mouseContainer = document.createElement('div');
    mouseContainer.className = 'mouse-display';

    const mouseVisual = document.createElement('div');
    mouseVisual.className = 'mouse-visual';

    const mouseBody = document.createElement('div');
    mouseBody.className = 'mouse-body';

    const leftBtn = document.createElement('div');
    leftBtn.className = 'mouse-btn mouse-left';
    leftBtn.dataset.key = 'mouse1';
    mouseBody.appendChild(leftBtn);

    const rightBtn = document.createElement('div');
    rightBtn.className = 'mouse-btn mouse-right';
    rightBtn.dataset.key = 'mouse2';
    mouseBody.appendChild(rightBtn);

    const wheel = document.createElement('div');
    wheel.className = 'mouse-wheel';
    wheel.dataset.key = 'mwheel';
    mouseBody.appendChild(wheel);

    mouseVisual.appendChild(mouseBody);
    mouseContainer.appendChild(mouseVisual);

    const mouseBindings = document.createElement('div');
    mouseBindings.className = 'mouse-bindings';
    mouseBindings.id = 'mouse-bindings';
    mouseContainer.appendChild(mouseBindings);

    return mouseContainer;
  }

  setupEventListeners() {
    this.container.addEventListener('mouseover', (e) => {
      const keyElement = e.target.closest('.key, .mouse-btn, .mouse-wheel');
      if (keyElement) {
        this.hoveredKey = keyElement.dataset.key;
        this.showKeyBindings(keyElement.dataset.key);
        keyElement.classList.add('active');
      }
    });

    this.container.addEventListener('mouseout', (e) => {
      const keyElement = e.target.closest('.key, .mouse-btn, .mouse-wheel');
      if (keyElement) {
        keyElement.classList.remove('active');
        if (this.hoveredKey === keyElement.dataset.key) {
          this.hoveredKey = null;
        }
      }
    });

    // Click to open context menu for binding
    this.container.addEventListener('click', (e) => {
      const keyElement = e.target.closest('.key, .mouse-btn, .mouse-wheel');
      if (keyElement && this.contextMenu) {
        e.stopPropagation();
        const keyId = keyElement.dataset.key;
        const keyLabel = this.getKeyLabel(keyElement);
        const isMouseButton = keyElement.classList.contains('mouse-btn') ||
                              keyElement.classList.contains('mouse-wheel');
        this.contextMenu.show(keyId, keyLabel, keyElement, isMouseButton);
      }
    });
  }

  getKeyLabel(keyElement) {
    // Get the label for display in the context menu
    const labelEl = keyElement.querySelector('.key-label');
    if (labelEl) {
      return labelEl.textContent || keyElement.dataset.key.toUpperCase();
    }
    // For mouse buttons
    if (keyElement.classList.contains('mouse-left')) return 'Left Click';
    if (keyElement.classList.contains('mouse-right')) return 'Right Click';
    if (keyElement.classList.contains('mouse-wheel')) return 'Mouse Wheel';
    return keyElement.dataset.key.toUpperCase();
  }

  showKeyBindings(key) {
    const detailsContent = document.getElementById('details-content');
    if (!detailsContent) return;

    const bindings = this.parser.getBindingsForKey(key);

    if (bindings.length === 0) {
      detailsContent.innerHTML = `
        <p class="placeholder-text">No bindings for "${key.toUpperCase()}"</p>
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

  updateBindings() {
    // Clear all bound states
    this.container.querySelectorAll('.key, .mouse-btn, .mouse-wheel').forEach(el => {
      el.classList.remove('bound');
      el.className = el.className.replace(/category-\w+/g, '');
    });

    // Get keyboard and mouse bindings
    const keyboardBindings = this.parser.getBindingsForDevice('keyboard');
    const mouseBindings = this.parser.getBindingsForDevice('mouse');

    // Apply keyboard bindings
    keyboardBindings.forEach(binding => {
      const keyElement = this.container.querySelector(`[data-key="${binding.key}"]`);
      if (keyElement) {
        keyElement.classList.add('bound');
        if (binding.category) {
          keyElement.classList.add(`category-${binding.category}`);
        }
      }
    });

    // Apply mouse bindings
    mouseBindings.forEach(binding => {
      const keyElement = this.container.querySelector(`[data-key="${binding.key}"]`);
      if (keyElement) {
        keyElement.classList.add('bound');
      }
    });

    // Update mouse bindings display
    this.updateMouseBindingsDisplay(mouseBindings);
  }

  updateMouseBindingsDisplay(bindings) {
    const mouseBindingsDiv = document.getElementById('mouse-bindings');
    if (!mouseBindingsDiv) return;

    if (bindings.length === 0) {
      mouseBindingsDiv.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No mouse bindings</p>';
      return;
    }

    const html = bindings.map(b => `
      <div class="mouse-binding-item">
        <span class="mouse-binding-key">${b.key}</span>
        <span class="mouse-binding-action">${b.label}</span>
      </div>
    `).join('');

    mouseBindingsDiv.innerHTML = html;
  }

  setCategory(category) {
    this.activeCategory = category;
    // Could implement category highlighting here
  }

  refresh() {
    this.updateBindings();
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
      item.className = 'sidebar-binding-item';
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
    const parts = key.split('+');
    return parts.map(p => {
      if (p === 'ctrl') return 'Ctrl';
      if (p === 'shift') return 'Shift';
      if (p === 'alt') return 'Alt';
      return p.toUpperCase();
    }).join('+');
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
}

window.KeyboardVisualizer = KeyboardVisualizer;

/**
 * Keyboard Binding Context Menu
 * Shows dropdown menus for assigning Star Citizen actions to keyboard keys and mouse buttons
 * Supports modifier key combinations (Ctrl, Shift, Alt)
 */

class KeyboardBindingContextMenu {
  constructor() {
    this.actionData = null;
    this.currentKey = null;
    this.currentKeyLabel = null;
    this.menuElement = null;
    this.onBindingChanged = null;
    this.customBindings = {};

    // Modifier state
    this.modifiers = {
      ctrl: false,
      shift: false,
      alt: false
    };

    // Action categories (same as HOTAS menu)
    this.actionCategories = {
      'Flight - Basic': [
        'spaceship_movement',
        'spaceship_general',
        'seat_general'
      ],
      'Flight - View': [
        'spaceship_view'
      ],
      'Flight - Power': [
        'spaceship_power',
        'vehicle_capacitor_assignment'
      ],
      'Flight - Quantum & Docking': [
        'spaceship_quantum',
        'spaceship_docking'
      ],
      'Weapons': [
        'spaceship_weapons'
      ],
      'Missiles & Countermeasures': [
        'spaceship_missiles',
        'spaceship_defensive'
      ],
      'Targeting': [
        'spaceship_targeting',
        'spaceship_targeting_advanced'
      ],
      'Radar & Scanning': [
        'spaceship_radar',
        'spaceship_scanning',
        'radar_tagging'
      ],
      'Mining & Salvage': [
        'spaceship_mining',
        'spaceship_salvage'
      ],
      'Turret': [
        'turret_movement',
        'turret_advanced'
      ],
      'Ground Vehicle': [
        'vehicle_general',
        'vehicle_driver'
      ],
      'On Foot': [
        'player',
        'prone'
      ],
      'EVA': [
        'zero_gravity_eva',
        'zero_gravity_traversal'
      ],
      'Social & UI': [
        'default',
        'ui_notification',
        'player_choice'
      ],
      'Camera': [
        'view_director_mode'
      ]
    };

    this.init();
  }

  async init() {
    await this.loadActionData();
    this.createMenuElement();
    this.loadCustomBindings();
  }

  async loadActionData() {
    try {
      const action2IconResponse = await fetch('../data/action2IconFileName.json');
      this.actionData = await action2IconResponse.json();
      console.log('Keyboard menu: Loaded action data:', Object.keys(this.actionData).length, 'actions');
    } catch (error) {
      console.error('Failed to load action data:', error);
      this.actionData = {};
    }
  }

  loadCustomBindings() {
    try {
      const saved = localStorage.getItem('sccm_keyboard_bindings');
      if (saved) {
        this.customBindings = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load keyboard bindings:', e);
    }
  }

  saveCustomBindings() {
    try {
      localStorage.setItem('sccm_keyboard_bindings', JSON.stringify(this.customBindings));
    } catch (e) {
      console.error('Failed to save keyboard bindings:', e);
    }
  }

  createMenuElement() {
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'keyboard-binding-menu';
    this.menuElement.style.display = 'none';

    document.body.appendChild(this.menuElement);

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.menuElement.contains(e.target) &&
          !e.target.closest('.key') &&
          !e.target.closest('.mouse-btn') &&
          !e.target.closest('.mouse-wheel')) {
        this.hide();
      }
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    });
  }

  async show(keyId, keyLabel, anchorElement, isMouseButton = false) {
    if (!this.actionData || Object.keys(this.actionData).length === 0) {
      await this.loadActionData();
    }

    this.currentKey = keyId;
    this.currentKeyLabel = keyLabel;
    this.renderMenu(keyId, keyLabel, isMouseButton);
    this.positionMenu(anchorElement);
    this.menuElement.style.display = 'block';

    // Load existing bindings for this key
    this.loadExistingBindings(keyId);
  }

  hide() {
    this.menuElement.style.display = 'none';
    this.currentKey = null;
    this.currentKeyLabel = null;
    this.modifiers = { ctrl: false, shift: false, alt: false };
  }

  renderMenu(keyId, keyLabel, isMouseButton) {
    const deviceType = isMouseButton ? 'Mouse' : 'Keyboard';

    this.menuElement.innerHTML = `
      <div class="binding-menu-header">
        <span class="binding-menu-title">${deviceType}: ${keyLabel}</span>
        <button class="binding-menu-close">&times;</button>
      </div>
      <div class="binding-menu-body">
        <div class="modifier-section">
          <label class="modifier-label">Modifiers (optional):</label>
          <div class="modifier-checkboxes">
            <label class="modifier-checkbox">
              <input type="checkbox" id="mod-ctrl" name="mod-ctrl">
              <span>Ctrl</span>
            </label>
            <label class="modifier-checkbox">
              <input type="checkbox" id="mod-shift" name="mod-shift">
              <span>Shift</span>
            </label>
            <label class="modifier-checkbox">
              <input type="checkbox" id="mod-alt" name="mod-alt">
              <span>Alt</span>
            </label>
          </div>
          <div class="combo-preview" id="combo-preview">
            <span class="combo-text">${keyLabel}</span>
          </div>
        </div>
        <div class="binding-dropdown-group">
          <label class="binding-dropdown-label">Action</label>
          <div class="binding-dropdown-wrapper">
            <select class="binding-dropdown" id="action-dropdown">
              <option value="">-- Select Action --</option>
              ${this.renderCategorizedOptions()}
            </select>
          </div>
        </div>
        <div class="current-bindings-section">
          <label class="binding-dropdown-label">Current Bindings for ${keyLabel}</label>
          <div class="current-bindings-list" id="current-bindings-list">
            <p class="no-bindings">No bindings assigned</p>
          </div>
        </div>
      </div>
      <div class="binding-menu-footer">
        <button class="binding-apply-btn">Add Binding</button>
        <button class="binding-clear-btn">Clear All</button>
      </div>
    `;

    // Add event listeners
    this.menuElement.querySelector('.binding-menu-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });

    this.menuElement.querySelector('.binding-apply-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.applyBinding();
    });

    this.menuElement.querySelector('.binding-clear-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearAllBindings();
    });

    // Modifier checkbox listeners
    ['ctrl', 'shift', 'alt'].forEach(mod => {
      const checkbox = this.menuElement.querySelector(`#mod-${mod}`);
      checkbox.addEventListener('change', (e) => {
        this.modifiers[mod] = e.target.checked;
        this.updateComboPreview();
      });
    });
  }

  updateComboPreview() {
    const previewEl = this.menuElement.querySelector('#combo-preview .combo-text');
    if (previewEl) {
      previewEl.textContent = this.getComboString(this.currentKeyLabel);
    }
  }

  getComboString(keyLabel) {
    const parts = [];
    if (this.modifiers.ctrl) parts.push('Ctrl');
    if (this.modifiers.shift) parts.push('Shift');
    if (this.modifiers.alt) parts.push('Alt');
    parts.push(keyLabel);
    return parts.join(' + ');
  }

  getBindingKey() {
    const parts = [];
    if (this.modifiers.ctrl) parts.push('ctrl');
    if (this.modifiers.shift) parts.push('shift');
    if (this.modifiers.alt) parts.push('alt');
    parts.push(this.currentKey);
    return parts.join('+');
  }

  loadExistingBindings(keyId) {
    const listEl = this.menuElement.querySelector('#current-bindings-list');
    if (!listEl) return;

    // Find all bindings for this key (with or without modifiers)
    const keyBindings = [];
    for (const [bindKey, action] of Object.entries(this.customBindings)) {
      if (bindKey === keyId || bindKey.endsWith('+' + keyId)) {
        keyBindings.push({ key: bindKey, action });
      }
    }

    if (keyBindings.length === 0) {
      listEl.innerHTML = '<p class="no-bindings">No bindings assigned</p>';
      return;
    }

    const html = keyBindings.map(b => {
      const displayKey = this.formatBindingKey(b.key);
      const displayAction = this.formatActionName(b.action);
      return `
        <div class="current-binding-item" data-binding-key="${b.key}">
          <span class="binding-combo">${displayKey}</span>
          <span class="binding-action">${displayAction}</span>
          <button class="binding-remove-btn" data-key="${b.key}">&times;</button>
        </div>
      `;
    }).join('');

    listEl.innerHTML = html;

    // Add remove button listeners
    listEl.querySelectorAll('.binding-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeBinding(btn.dataset.key);
      });
    });
  }

  formatBindingKey(key) {
    const parts = key.split('+');
    return parts.map(p => {
      if (p === 'ctrl') return 'Ctrl';
      if (p === 'shift') return 'Shift';
      if (p === 'alt') return 'Alt';
      return p.toUpperCase();
    }).join(' + ');
  }

  renderCategorizedOptions() {
    let optionsHTML = '';

    for (const [categoryName, actionGroups] of Object.entries(this.actionCategories)) {
      const actionsInCategory = this.getActionsForCategory(actionGroups);

      if (actionsInCategory.length > 0) {
        optionsHTML += `<optgroup label="${categoryName}">`;
        actionsInCategory.forEach(action => {
          const displayName = this.formatActionName(action);
          optionsHTML += `<option value="${action}">${displayName}</option>`;
        });
        optionsHTML += `</optgroup>`;
      }
    }

    return optionsHTML;
  }

  getActionsForCategory(actionGroups) {
    const actions = [];
    if (!this.actionData) return actions;

    const allActions = Object.keys(this.actionData);

    actionGroups.forEach(group => {
      allActions.forEach(action => {
        if (this.actionBelongsToGroup(action, group) && !actions.includes(action)) {
          actions.push(action);
        }
      });
    });

    return actions.sort();
  }

  actionBelongsToGroup(action, group) {
    const groupPatterns = {
      'spaceship_movement': /^v_(strafe|roll|pitch|yaw|afterburner|space_brake|speed|accel|ifcs|lock_rotation|toggle_landing|autoland|toggle_vtol|transform)/,
      'spaceship_general': /^v_(flightready|self_destruct|toggle_all_doors|lock_all|unlock_all|close_all|open_all|eject|emergency_exit|horn)/,
      'spaceship_view': /^v_view_/,
      'spaceship_power': /^v_power_/,
      'vehicle_capacitor_assignment': /^v_capacitor_/,
      'spaceship_quantum': /^v_(toggle_qdrive|toggle_quantum)/,
      'spaceship_docking': /^v_(dock|invoke_docking|toggle_docking)/,
      'spaceship_weapons': /^v_(attack|weapon_change|weapon_gimbal|weapon_manual|weapon_pip|weapon_bombing)/,
      'spaceship_missiles': /^v_weapon_(cycle_missile|launch_missile|decrease_max|increase_max|reset_max|toggle_launch)/,
      'spaceship_defensive': /^v_(weapon_countermeasure|shield_)/,
      'spaceship_targeting': /^v_target_/,
      'spaceship_targeting_advanced': /^v_(look_ahead|target_lock|target_pin|target_tracking)/,
      'spaceship_radar': /^v_(invoke_ping|inc_ping|dec_ping)/,
      'spaceship_scanning': /^v_scanning_|^v_(inc_scan|dec_scan)/,
      'radar_tagging': /^tag_/,
      'spaceship_mining': /^v_(mining|toggle_mining|decrease_mining|increase_mining|jettison)/,
      'spaceship_salvage': /^v_salvage_|^v_toggle_salvage/,
      'turret_movement': /^turret_(pitch|yaw|toggle_mouse)/,
      'turret_advanced': /^turret_(change|esp|gyro|instant|limiter|recenter|remote)/,
      'vehicle_general': /^v_(boost|brake|move_)/,
      'vehicle_driver': /^v_mgv_/,
      'player': /^(attack1|crouch|jump|sprint|walk|reload|holster|melee|throw|toggle_flashlight|weapon_|zoom|selectprimary|selectsecondary|selectpistol|selectgadget|selectMelee|selectUnarmed|selectUtility|consume|drop|inspect|customize|ledgegrab|lean)/,
      'prone': /^prone_/,
      'zero_gravity_eva': /^eva_/,
      'zero_gravity_traversal': /^zgt_/,
      'default': /^(mobiglas|visor_wipe|stopwatch|thirdperson|free_thirdperson|pl_hud|port_modification)/,
      'ui_notification': /^ui_notification_/,
      'player_choice': /^pc_/,
      'view_director_mode': /^view_/,
      'seat_general': /^v_toggle_(mining_mode|salvage_mode|scan_mode|quantum_mode|missile_mode)/
    };

    const pattern = groupPatterns[group];
    return pattern ? pattern.test(action) : false;
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

  positionMenu(anchorElement) {
    const rect = anchorElement.getBoundingClientRect();

    let left = rect.right + 10;
    let top = rect.top;

    // Keep menu on screen
    if (left + 350 > window.innerWidth) {
      left = rect.left - 360;
    }
    if (left < 10) left = 10;

    if (top + 400 > window.innerHeight) {
      top = window.innerHeight - 420;
    }
    if (top < 10) top = 10;

    this.menuElement.style.left = `${left}px`;
    this.menuElement.style.top = `${top}px`;
  }

  applyBinding() {
    const dropdown = this.menuElement.querySelector('#action-dropdown');
    const action = dropdown.value;

    if (!action) {
      alert('Please select an action');
      return;
    }

    const bindingKey = this.getBindingKey();
    this.customBindings[bindingKey] = action;
    this.saveCustomBindings();

    // Refresh the current bindings list
    this.loadExistingBindings(this.currentKey);

    // Clear the dropdown
    dropdown.value = '';

    // Notify callback
    if (this.onBindingChanged) {
      this.onBindingChanged(this.customBindings);
    }

    console.log(`Keyboard binding added: ${bindingKey} = ${action}`);
  }

  removeBinding(key) {
    delete this.customBindings[key];
    this.saveCustomBindings();
    this.loadExistingBindings(this.currentKey);

    if (this.onBindingChanged) {
      this.onBindingChanged(this.customBindings);
    }
  }

  clearAllBindings() {
    // Clear bindings for current key only
    const keysToRemove = [];
    for (const bindKey of Object.keys(this.customBindings)) {
      if (bindKey === this.currentKey || bindKey.endsWith('+' + this.currentKey)) {
        keysToRemove.push(bindKey);
      }
    }

    keysToRemove.forEach(k => delete this.customBindings[k]);
    this.saveCustomBindings();
    this.loadExistingBindings(this.currentKey);

    if (this.onBindingChanged) {
      this.onBindingChanged(this.customBindings);
    }
  }

  getBindings() {
    return this.customBindings;
  }
}

window.KeyboardBindingContextMenu = KeyboardBindingContextMenu;

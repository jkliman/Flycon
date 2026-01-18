/**
 * Gamepad Binding Context Menu
 * Shows dropdown menus for assigning Star Citizen actions to gamepad buttons
 */

class GamepadBindingContextMenu {
  constructor() {
    this.actionData = null;
    this.currentButton = null;
    this.currentButtonLabel = null;
    this.menuElement = null;
    this.onBindingChanged = null;
    this.customBindings = {};

    // Control configurations for buttons with multiple dropdowns
    this.controlConfig = {
      // Face buttons - single action each
      'xbox_a': {
        label: 'A Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'xbox_b': {
        label: 'B Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'xbox_x': {
        label: 'X Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'xbox_y': {
        label: 'Y Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      // Bumpers
      'xbox_lb': {
        label: 'Left Bumper (LB)',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'xbox_rb': {
        label: 'Right Bumper (RB)',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      // D-Pad - directional inputs
      'xbox_dpad': {
        label: 'D-Pad',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' }
        ]
      },
      // Axis controls
      'xbox_left_stick': {
        label: 'Left Stick',
        dropdowns: [
          { id: 'x_axis', label: 'X Axis' },
          { id: 'y_axis', label: 'Y Axis' },
          { id: 'press', label: 'Press (LS)' }
        ]
      },
      'xbox_right_stick': {
        label: 'Right Stick',
        dropdowns: [
          { id: 'x_axis', label: 'X Axis' },
          { id: 'y_axis', label: 'Y Axis' },
          { id: 'press', label: 'Press (RS)' }
        ]
      },
      'xbox_left_trigger': {
        label: 'Left Trigger (LT)',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'xbox_right_trigger': {
        label: 'Right Trigger (RT)',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      }
    };

    // Action categories (same as HOTAS/keyboard menu)
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
      console.log('Gamepad menu: Loaded action data:', Object.keys(this.actionData).length, 'actions');
    } catch (error) {
      console.error('Failed to load action data:', error);
      this.actionData = {};
    }
  }

  loadCustomBindings() {
    try {
      const saved = localStorage.getItem('sccm_gamepad_bindings');
      if (saved) {
        this.customBindings = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load gamepad bindings:', e);
    }
  }

  saveCustomBindings() {
    try {
      localStorage.setItem('sccm_gamepad_bindings', JSON.stringify(this.customBindings));
    } catch (e) {
      console.error('Failed to save gamepad bindings:', e);
    }
  }

  createMenuElement() {
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'gamepad-binding-menu';
    this.menuElement.style.display = 'none';

    document.body.appendChild(this.menuElement);

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.menuElement.contains(e.target) &&
          !e.target.closest('.controller-button') &&
          !e.target.closest('.xbox-hotspot') &&
          !e.target.closest('.hotas-axis-btn')) {
        this.hide();
        // Deselect axis buttons
        document.querySelectorAll('.hotas-axis-btn.selected').forEach(btn => {
          btn.classList.remove('selected');
        });
        // Deselect xbox hotspots
        document.querySelectorAll('.xbox-hotspot.selected').forEach(btn => {
          btn.classList.remove('selected');
        });
      }
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
        // Deselect all
        document.querySelectorAll('.hotas-axis-btn.selected').forEach(btn => {
          btn.classList.remove('selected');
        });
        document.querySelectorAll('.xbox-hotspot.selected').forEach(btn => {
          btn.classList.remove('selected');
        });
      }
    });
  }

  async show(buttonId, buttonLabel, anchorElement) {
    if (!this.actionData || Object.keys(this.actionData).length === 0) {
      await this.loadActionData();
    }

    this.currentButton = buttonId;
    this.currentButtonLabel = buttonLabel;
    this.renderMenu(buttonId, buttonLabel);
    this.positionMenu(anchorElement);
    this.menuElement.style.display = 'block';

    // Load existing bindings for this button
    this.loadExistingBindings(buttonId);
  }

  hide() {
    this.menuElement.style.display = 'none';
    this.currentButton = null;
    this.currentButtonLabel = null;
  }

  renderMenu(buttonId, buttonLabel) {
    const config = this.controlConfig[buttonId];
    const displayLabel = config ? config.label : buttonLabel;

    // Generate dropdown groups HTML
    let dropdownsHTML = '';
    if (config && config.dropdowns) {
      dropdownsHTML = config.dropdowns.map(dd => `
        <div class="binding-dropdown-group">
          <label class="binding-dropdown-label">${dd.label}</label>
          <div class="binding-dropdown-wrapper">
            <select class="binding-dropdown" data-dropdown-id="${dd.id}">
              <option value="">-- Select Action --</option>
              ${this.renderCategorizedOptions()}
            </select>
          </div>
        </div>
      `).join('');
    } else {
      // Fallback single dropdown for unknown buttons
      dropdownsHTML = `
        <div class="binding-dropdown-group">
          <label class="binding-dropdown-label">Action</label>
          <div class="binding-dropdown-wrapper">
            <select class="binding-dropdown" data-dropdown-id="action">
              <option value="">-- Select Action --</option>
              ${this.renderCategorizedOptions()}
            </select>
          </div>
        </div>
      `;
    }

    this.menuElement.innerHTML = `
      <div class="binding-menu-header">
        <span class="binding-menu-title">Gamepad: ${displayLabel}</span>
        <button class="binding-menu-close">&times;</button>
      </div>
      <div class="binding-menu-body">
        ${dropdownsHTML}
        <div class="current-bindings-section">
          <label class="binding-dropdown-label">Current Bindings for ${displayLabel}</label>
          <div class="current-bindings-list" id="gamepad-current-bindings-list">
            <p class="no-bindings">No bindings assigned</p>
          </div>
        </div>
      </div>
      <div class="binding-menu-footer">
        <button class="binding-apply-btn">Save Bindings</button>
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
  }

  loadExistingBindings(buttonId) {
    const listEl = this.menuElement.querySelector('#gamepad-current-bindings-list');
    if (!listEl) return;

    // Find all bindings for this button (including sub-bindings like buttonId_up, buttonId_down)
    const buttonBindings = [];
    const config = this.controlConfig[buttonId];

    for (const [bindKey, action] of Object.entries(this.customBindings)) {
      // Match exact buttonId or buttonId_* pattern
      if (bindKey === buttonId || bindKey.startsWith(buttonId + '_')) {
        const dropdownId = bindKey.replace(buttonId + '_', '');
        const dropdownLabel = config?.dropdowns?.find(d => d.id === dropdownId)?.label || dropdownId;
        buttonBindings.push({ key: bindKey, action, dropdownLabel });
      }
    }

    if (buttonBindings.length === 0) {
      listEl.innerHTML = '<p class="no-bindings">No bindings assigned</p>';
      return;
    }

    const html = buttonBindings.map(b => {
      const displayAction = this.formatActionName(b.action);
      const labelPart = b.dropdownLabel !== b.key.replace(buttonId + '_', '') ? `<span class="binding-label">${b.dropdownLabel}:</span> ` : '';
      return `
        <div class="current-binding-item" data-binding-key="${b.key}">
          ${labelPart}<span class="binding-action">${displayAction}</span>
          <button class="binding-remove-btn" data-key="${b.key}">&times;</button>
        </div>
      `;
    }).join('');

    listEl.innerHTML = html;

    // Populate dropdowns with existing values
    buttonBindings.forEach(b => {
      const dropdownId = b.key.replace(buttonId + '_', '');
      const dropdown = this.menuElement.querySelector(`select[data-dropdown-id="${dropdownId}"]`);
      if (dropdown) {
        dropdown.value = b.action;
      }
    });

    // Add remove button listeners
    listEl.querySelectorAll('.binding-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeBinding(btn.dataset.key);
      });
    });
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
    if (left + 320 > window.innerWidth) {
      left = rect.left - 330;
    }
    if (left < 10) left = 10;

    if (top + 350 > window.innerHeight) {
      top = window.innerHeight - 370;
    }
    if (top < 10) top = 10;

    this.menuElement.style.left = `${left}px`;
    this.menuElement.style.top = `${top}px`;
  }

  applyBinding() {
    // Get all dropdowns and save their values
    const dropdowns = this.menuElement.querySelectorAll('.binding-dropdown');
    let hasAnyBinding = false;

    dropdowns.forEach(dropdown => {
      const dropdownId = dropdown.dataset.dropdownId;
      const action = dropdown.value;

      if (action) {
        // Create binding key: buttonId_dropdownId (e.g., xbox_dpad_up)
        const bindKey = `${this.currentButton}_${dropdownId}`;
        this.customBindings[bindKey] = action;
        hasAnyBinding = true;
        console.log(`Gamepad binding added: ${bindKey} = ${action}`);
      }
    });

    if (!hasAnyBinding) {
      alert('Please select at least one action');
      return;
    }

    this.saveCustomBindings();

    // Refresh the current bindings list
    this.loadExistingBindings(this.currentButton);

    // Notify callback
    if (this.onBindingChanged) {
      this.onBindingChanged(this.customBindings);
    }
  }

  removeBinding(key) {
    delete this.customBindings[key];
    this.saveCustomBindings();
    this.loadExistingBindings(this.currentButton);

    if (this.onBindingChanged) {
      this.onBindingChanged(this.customBindings);
    }
  }

  clearAllBindings() {
    // Clear all bindings for this button (including sub-bindings like buttonId_up, buttonId_down)
    const keysToDelete = Object.keys(this.customBindings).filter(
      key => key === this.currentButton || key.startsWith(this.currentButton + '_')
    );

    keysToDelete.forEach(key => {
      delete this.customBindings[key];
    });

    this.saveCustomBindings();

    // Clear all dropdowns
    this.menuElement.querySelectorAll('.binding-dropdown').forEach(dd => {
      dd.value = '';
    });

    this.loadExistingBindings(this.currentButton);

    if (this.onBindingChanged) {
      this.onBindingChanged(this.customBindings);
    }
  }

  getBindings() {
    return this.customBindings;
  }
}

window.GamepadBindingContextMenu = GamepadBindingContextMenu;

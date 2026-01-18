/**
 * Star Citizen Keybinding Parser
 * Parses Star Citizen actionmaps.xml and exported keybinding files
 */

class SCKeybindingParser {
  constructor() {
    this.bindings = new Map();
    this.categories = {
      flight: [],
      weapons: [],
      targeting: [],
      shields: [],
      power: [],
      mining: [],
      fps: [],
      vehicles: [],
      social: [],
      ui: []
    };

    // Action name to category mapping
    this.categoryMap = {
      // Flight Movement
      'v_pitch': 'flight',
      'v_yaw': 'flight',
      'v_roll': 'flight',
      'v_strafe': 'flight',
      'v_ifcs_toggle_vector_decoupling': 'flight',
      'v_strafe_up': 'flight',
      'v_strafe_down': 'flight',
      'v_strafe_left': 'flight',
      'v_strafe_right': 'flight',
      'v_strafe_forward': 'flight',
      'v_strafe_back': 'flight',
      'v_afterburner': 'flight',
      'v_boost': 'flight',
      'v_brake': 'flight',
      'v_speed_range_up': 'flight',
      'v_speed_range_down': 'flight',
      'v_toggle_landing_system': 'flight',
      'v_autoland': 'flight',
      'v_toggle_vtol': 'flight',
      'v_ifcs_toggle_cruise_control': 'flight',
      'v_ifcs_toggle_esp': 'flight',
      'v_ifcs_toggle_gforce_safety': 'flight',
      'v_decoupled_strafe': 'flight',
      'v_match_target_velocity': 'flight',
      'v_toggle_relative_mouse_mode': 'flight',

      // Flight Weapons
      'v_attack1': 'weapons',
      'v_attack1_group1': 'weapons',
      'v_attack1_group2': 'weapons',
      'v_attack2': 'weapons',
      'v_weapon_cycle_missile': 'weapons',
      'v_weapon_cycle_countermeasure': 'weapons',
      'v_weapon_launch_countermeasure': 'weapons',
      'v_weapon_arm_missile': 'weapons',
      'v_weapon_launch_missile': 'weapons',
      'v_turret_gyromode': 'weapons',

      // Targeting
      'v_target_cycle_hostile_fwd': 'targeting',
      'v_target_cycle_hostile_back': 'targeting',
      'v_target_cycle_friendly_fwd': 'targeting',
      'v_target_cycle_all_fwd': 'targeting',
      'v_target_cycle_all_back': 'targeting',
      'v_target_nearest_hostile': 'targeting',
      'v_target_reticle_focus': 'targeting',
      'v_target_toggle_pinned_focused': 'targeting',
      'v_target_unlock_selected': 'targeting',
      'v_look_ahead_enable': 'targeting',
      'v_target_cycle_subsystem_fwd': 'targeting',
      'v_target_cycle_subsystem_back': 'targeting',

      // Shields
      'v_shield_raise_level_front': 'shields',
      'v_shield_raise_level_back': 'shields',
      'v_shield_raise_level_left': 'shields',
      'v_shield_raise_level_right': 'shields',
      'v_shield_raise_level_up': 'shields',
      'v_shield_raise_level_down': 'shields',
      'v_shield_reset_level': 'shields',

      // Power Management
      'v_power_toggle_thrusters': 'power',
      'v_power_toggle_shields': 'power',
      'v_power_toggle_weapons': 'power',
      'v_power_focus_thrusters': 'power',
      'v_power_focus_shields': 'power',
      'v_power_focus_weapons': 'power',
      'v_power_reset_focus': 'power',
      'v_flightready': 'power',
      'v_toggle_all_doors': 'power',
      'v_lock_all_doors': 'power',
      'v_unlock_all_doors': 'power',
      'v_open_all_doors': 'power',
      'v_close_all_doors': 'power',
      'v_self_destruct': 'power',
      'v_eject': 'power',

      // Mining
      'v_mining_throttle': 'mining',
      'v_mining_laser_fire': 'mining',
      'v_mining_laser_focus': 'mining',
      'v_mining_toggle_laser': 'mining',
      'v_mining_toggle_extraction_laser': 'mining',
      'v_tractor_beam_toggle': 'mining',
      'v_tractor_beam_push': 'mining',
      'v_tractor_beam_pull': 'mining',

      // On Foot / FPS
      'fps_moveforward': 'fps',
      'fps_moveback': 'fps',
      'fps_moveleft': 'fps',
      'fps_moveright': 'fps',
      'fps_jump': 'fps',
      'fps_crouch': 'fps',
      'fps_prone': 'fps',
      'fps_sprint': 'fps',
      'fps_walk': 'fps',
      'fps_attack1': 'fps',
      'fps_attack2': 'fps',
      'fps_reload': 'fps',
      'fps_weapon_holster': 'fps',
      'fps_melee': 'fps',
      'fps_grenade': 'fps',
      'fps_use': 'fps',
      'fps_interact': 'fps',
      'fps_flashlight': 'fps',
      'fps_zoom': 'fps',
      'fps_zoom_in': 'fps',
      'fps_zoom_out': 'fps',
      'fps_weapon_cycle': 'fps',
      'fps_ledgegrab': 'fps',
      'fps_toggle_helmet': 'fps',
      'fps_underbarrel_attach': 'fps',
      'fps_weapon_change_firemode': 'fps',

      // Ground Vehicles
      'vehicle_driver': 'vehicles',
      'vehicle_move': 'vehicles',
      'vehicle_brake': 'vehicles',
      'vehicle_horn': 'vehicles',
      'vehicle_lights': 'vehicles',

      // Social / VOIP
      'foip_pushtotalk': 'social',
      'foip_pushtotalk_proximity': 'social',
      'voip_pushtotalk': 'social',
      'foip_viewownplayer': 'social',
      'foip_recalibrate': 'social',

      // User Interface
      'mobiglas': 'ui',
      'toggle_contact': 'ui',
      'toggle_chat': 'ui',
      'toggle_cursor_input': 'ui',
      'toggle_scan': 'ui',
      'starmap': 'ui',
      'focus': 'ui',
      'force_respawn': 'ui',
      'spectator_camera': 'ui',
      'screenshot': 'ui',
      'respawn': 'ui',
      'third_person': 'ui',
      'view_look_behind': 'ui',
      'zoom_in': 'ui',
      'zoom_out': 'ui',
      'visor_wipe': 'ui',
      'headlook_toggle': 'ui',
      'freelook_toggle': 'ui',
    };

    // Human-readable action names
    this.actionLabels = {
      // Flight
      'v_pitch': 'Pitch',
      'v_yaw': 'Yaw',
      'v_roll': 'Roll',
      'v_strafe_up': 'Strafe Up',
      'v_strafe_down': 'Strafe Down',
      'v_strafe_left': 'Strafe Left',
      'v_strafe_right': 'Strafe Right',
      'v_strafe_forward': 'Strafe Forward',
      'v_strafe_back': 'Strafe Back',
      'v_afterburner': 'Afterburner',
      'v_boost': 'Boost',
      'v_brake': 'Space Brake',
      'v_speed_range_up': 'Increase Speed Limiter',
      'v_speed_range_down': 'Decrease Speed Limiter',
      'v_toggle_landing_system': 'Toggle Landing Gear',
      'v_autoland': 'Auto Land',
      'v_toggle_vtol': 'Toggle VTOL',
      'v_ifcs_toggle_cruise_control': 'Toggle Cruise Control',
      'v_ifcs_toggle_esp': 'Toggle ESP',
      'v_ifcs_toggle_vector_decoupling': 'Toggle Decoupled Mode',
      'v_match_target_velocity': 'Match Target Velocity',

      // Weapons
      'v_attack1': 'Fire Weapon Group 1',
      'v_attack1_group1': 'Fire Group 1',
      'v_attack1_group2': 'Fire Group 2',
      'v_attack2': 'Fire Weapon Group 2',
      'v_weapon_cycle_missile': 'Cycle Missiles',
      'v_weapon_cycle_countermeasure': 'Cycle Countermeasures',
      'v_weapon_launch_countermeasure': 'Launch Countermeasure',
      'v_weapon_arm_missile': 'Lock Missile',
      'v_weapon_launch_missile': 'Fire Missile',

      // Targeting
      'v_target_cycle_hostile_fwd': 'Cycle Hostile Targets',
      'v_target_cycle_hostile_back': 'Cycle Hostile (Reverse)',
      'v_target_cycle_friendly_fwd': 'Cycle Friendly Targets',
      'v_target_cycle_all_fwd': 'Cycle All Targets',
      'v_target_nearest_hostile': 'Target Nearest Hostile',
      'v_target_reticle_focus': 'Target Under Reticle',
      'v_look_ahead_enable': 'Look Ahead',

      // Shields
      'v_shield_raise_level_front': 'Shields Front',
      'v_shield_raise_level_back': 'Shields Rear',
      'v_shield_raise_level_left': 'Shields Left',
      'v_shield_raise_level_right': 'Shields Right',
      'v_shield_reset_level': 'Reset Shields',

      // Power
      'v_power_toggle_thrusters': 'Toggle Thrusters',
      'v_power_toggle_shields': 'Toggle Shields',
      'v_power_toggle_weapons': 'Toggle Weapons',
      'v_flightready': 'Flight Ready',
      'v_self_destruct': 'Self Destruct',
      'v_eject': 'Eject',

      // Mining
      'v_mining_laser_fire': 'Mining Laser',
      'v_tractor_beam_toggle': 'Toggle Tractor Beam',

      // FPS
      'fps_jump': 'Jump',
      'fps_crouch': 'Crouch',
      'fps_prone': 'Prone',
      'fps_sprint': 'Sprint',
      'fps_attack1': 'Fire Weapon',
      'fps_attack2': 'ADS / Zoom',
      'fps_reload': 'Reload',
      'fps_melee': 'Melee',
      'fps_grenade': 'Throw Grenade',
      'fps_interact': 'Interact',
      'fps_flashlight': 'Flashlight',

      // UI
      'mobiglas': 'MobiGlas',
      'toggle_scan': 'Scanning Mode',
      'starmap': 'Star Map',
      'screenshot': 'Screenshot',
      'third_person': 'Third Person View',
    };
  }

  /**
   * Parse raw XML data from Star Citizen keybinding file
   */
  parseXMLData(xmlData) {
    this.bindings.clear();
    Object.keys(this.categories).forEach(cat => this.categories[cat] = []);

    try {
      // Handle different XML structures
      const actionProfiles = xmlData.ActionMaps || xmlData.actionmaps || xmlData.profile;

      if (!actionProfiles) {
        console.warn('Unknown XML structure:', Object.keys(xmlData));
        return { success: false, error: 'Unknown keybinding file format' };
      }

      // Parse action maps
      const actionMaps = actionProfiles.actionmap || actionProfiles.ActionMap || [];
      const maps = Array.isArray(actionMaps) ? actionMaps : [actionMaps];

      maps.forEach(actionMap => {
        if (!actionMap) return;

        const mapName = actionMap.name || actionMap.$ && actionMap.$.name;
        const actions = actionMap.action || actionMap.Action || [];
        const actionList = Array.isArray(actions) ? actions : [actions];

        actionList.forEach(action => {
          if (!action) return;

          const actionName = action.name || (action.$ && action.$.name);
          if (!actionName) return;

          // Get rebind information
          const rebind = action.rebind || action.Rebind;
          if (!rebind) return;

          const rebindList = Array.isArray(rebind) ? rebind : [rebind];

          rebindList.forEach(rb => {
            const input = rb.input || (rb.$ && rb.$.input);
            if (!input || input === '') return;

            const binding = {
              action: actionName,
              input: input,
              device: this.parseDevice(input),
              key: this.parseKey(input),
              category: this.getCategory(actionName),
              label: this.getActionLabel(actionName)
            };

            // Store in bindings map (key -> bindings)
            const bindingKey = binding.key.toLowerCase();
            if (!this.bindings.has(bindingKey)) {
              this.bindings.set(bindingKey, []);
            }
            this.bindings.get(bindingKey).push(binding);

            // Store in category
            if (this.categories[binding.category]) {
              this.categories[binding.category].push(binding);
            }
          });
        });
      });

      return { success: true, bindingCount: this.getTotalBindingCount() };

    } catch (error) {
      console.error('Parse error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse device type from input string
   */
  parseDevice(input) {
    if (input.startsWith('kb')) return 'keyboard';
    if (input.startsWith('mo')) return 'mouse';
    if (input.startsWith('js')) return 'joystick';
    if (input.startsWith('gp')) return 'gamepad';
    return 'unknown';
  }

  /**
   * Parse key/button from input string
   */
  parseKey(input) {
    // Remove device prefix
    let key = input;

    // Keyboard: kb1_a -> a
    if (input.startsWith('kb')) {
      key = input.replace(/^kb\d*_/, '');
    }
    // Mouse: mo1_mouse1 -> mouse1
    else if (input.startsWith('mo')) {
      key = input.replace(/^mo\d*_/, '');
    }
    // Joystick: js1_button1 -> js1_button1 (keep js identifier)
    else if (input.startsWith('js')) {
      key = input;
    }
    // Gamepad: gp1_a -> a
    else if (input.startsWith('gp')) {
      key = input.replace(/^gp\d*_/, '');
    }

    return key;
  }

  /**
   * Get category for an action
   */
  getCategory(actionName) {
    // Check direct mapping
    if (this.categoryMap[actionName]) {
      return this.categoryMap[actionName];
    }

    // Check prefix patterns
    if (actionName.startsWith('v_') || actionName.startsWith('spaceship_')) {
      if (actionName.includes('weapon') || actionName.includes('attack') || actionName.includes('missile')) {
        return 'weapons';
      }
      if (actionName.includes('target')) {
        return 'targeting';
      }
      if (actionName.includes('shield')) {
        return 'shields';
      }
      if (actionName.includes('power')) {
        return 'power';
      }
      if (actionName.includes('mining') || actionName.includes('tractor')) {
        return 'mining';
      }
      return 'flight';
    }

    if (actionName.startsWith('fps_') || actionName.startsWith('player_')) {
      return 'fps';
    }

    if (actionName.startsWith('vehicle_')) {
      return 'vehicles';
    }

    if (actionName.includes('voip') || actionName.includes('foip') || actionName.includes('chat')) {
      return 'social';
    }

    return 'ui';
  }

  /**
   * Get human-readable label for an action
   */
  getActionLabel(actionName) {
    if (this.actionLabels[actionName]) {
      return this.actionLabels[actionName];
    }

    // Generate label from action name
    return actionName
      .replace(/^(v_|fps_|vehicle_)/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Get bindings for a specific key
   */
  getBindingsForKey(key) {
    return this.bindings.get(key.toLowerCase()) || [];
  }

  /**
   * Get all bindings for a device type
   */
  getBindingsForDevice(device) {
    const result = [];
    this.bindings.forEach((bindings) => {
      bindings.forEach(b => {
        if (b.device === device) {
          result.push(b);
        }
      });
    });
    return result;
  }

  /**
   * Get bindings for a category
   */
  getBindingsForCategory(category) {
    if (category === 'all') {
      const all = [];
      Object.values(this.categories).forEach(cat => all.push(...cat));
      return all;
    }
    return this.categories[category] || [];
  }

  /**
   * Get total binding count
   */
  getTotalBindingCount() {
    let count = 0;
    this.bindings.forEach(b => count += b.length);
    return count;
  }

  /**
   * Get category counts
   */
  getCategoryCounts() {
    const counts = {};
    Object.keys(this.categories).forEach(cat => {
      counts[cat] = this.categories[cat].length;
    });
    counts.all = this.getTotalBindingCount();
    return counts;
  }

  /**
   * Add a manual binding
   */
  addManualBinding(device, key, action, category) {
    const binding = {
      action: action,
      input: `${device}_${key}`,
      device: device,
      key: key,
      category: category,
      label: this.getActionLabel(action),
      manual: true
    };

    const bindingKey = key.toLowerCase();
    if (!this.bindings.has(bindingKey)) {
      this.bindings.set(bindingKey, []);
    }
    this.bindings.get(bindingKey).push(binding);

    if (this.categories[category]) {
      this.categories[category].push(binding);
    }

    return binding;
  }

  /**
   * Remove a manual binding
   */
  removeManualBinding(key, action) {
    const bindingKey = key.toLowerCase();
    const bindings = this.bindings.get(bindingKey);

    if (bindings) {
      const index = bindings.findIndex(b => b.action === action && b.manual);
      if (index !== -1) {
        const removed = bindings.splice(index, 1)[0];

        // Remove from category
        const catBindings = this.categories[removed.category];
        if (catBindings) {
          const catIndex = catBindings.findIndex(b => b.action === action && b.key === key);
          if (catIndex !== -1) {
            catBindings.splice(catIndex, 1);
          }
        }

        return true;
      }
    }
    return false;
  }

  /**
   * Clear all bindings
   */
  clear() {
    this.bindings.clear();
    Object.keys(this.categories).forEach(cat => this.categories[cat] = []);
  }
}

// Export for use
window.SCKeybindingParser = SCKeybindingParser;

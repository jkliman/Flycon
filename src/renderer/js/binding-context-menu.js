/**
 * Binding Context Menu
 * Shows categorized dropdown menus for assigning game actions to controller buttons
 * Supports multiple games: Star Citizen, MSFS 2024, DCS World, X-Plane, Elite Dangerous
 */

class BindingContextMenu {
  constructor() {
    this.actionData = null;
    this.categoryData = null;
    this.msfsEventData = null; // MSFS-specific event data
    this.dcsEventData = null; // DCS World event data
    this.xplaneEventData = null; // X-Plane event data
    this.eliteEventData = null; // Elite Dangerous event data
    this.currentGame = 'star-citizen'; // Default game
    this.currentButton = null;
    this.currentButtonLabel = null;
    this.menuElement = null;
    this.onBindingChanged = null; // Callback when a binding is changed
    this.onClearBindings = null; // Callback when bindings are cleared
    this.customBindings = {}; // Store bindings locally
    this.currentMode = 'm1'; // Mode for X56 HOTAS: 'm1', 'm2', 's1'
    this.x52CurrentMode = 'mode1'; // Mode for X52: 'mode1', 'mode2', 'mode3'

    // Controls excluded from mode switching (always use default binding)
    this.modeExcludedControls = [
      // X56 excluded controls
      'x56_js_trigger',
      'x56_js_missile_btn',
      'x56_js_thumbstick',
      'x56_th_throttle_left',
      'x56_th_throttle_right',
      'x56_th_rty3',
      'x56_th_rty4',
      'x56_th_top_knob',
      'x56_th_bottom_knob',
      // X52 excluded controls
      'x52_js_trigger',
      'x52_js_fire',
      'x52_th_rt1',
      'x52_th_rt2'
    ];

    // Define the dropdown configuration for each controller control
    // This includes AB9, X56 throttle, etc.
    //
    // AB9 Button mappings:
    // 1=Trigger Short, 2=Missile, 3=Pinky Btn, 4=Pinky Switch, 5=Index Btn, 6=Trigger Long
    // 7-10=Funky Knob (Up/Right/Down/Left), 11-14=Bottom D-Pad
    // 15-19=Thumb Fakey (Fwd/Up/Back/Down/Press), 20-24=Top D-Pad (with Press)
    // 25-26=Thumb Switch (Up/Down)
    this.controlConfig = {
      'ab9_trigger': {
        label: 'Trigger',
        dropdowns: [
          { id: 'short', label: 'Short Pull (btn 1)' },
          { id: 'long', label: 'Long Pull (btn 6)' }
        ]
      },
      'ab9_thumb_missile': {
        label: 'Missile Button',
        dropdowns: [{ id: 'action', label: 'Press (btn 2)' }]
      },
      'ab9_pinky_btn': {
        label: 'Pinky Button',
        dropdowns: [{ id: 'action', label: 'Press (btn 3)' }]
      },
      'ab9_pinky_switch': {
        label: 'Pinky Switch',
        dropdowns: [{ id: 'action', label: 'Toggle (btn 4)' }]
      },
      'ab9_index_btn': {
        label: 'Index Button',
        dropdowns: [{ id: 'action', label: 'Press (btn 5)' }]
      },
      'ab9_funky_knob': {
        label: 'Funky Knob',
        dropdowns: [
          { id: 'up', label: 'Up (btn 7)' },
          { id: 'right', label: 'Right (btn 8)' },
          { id: 'down', label: 'Down (btn 9)' },
          { id: 'left', label: 'Left (btn 10)' }
        ]
      },
      'ab9_bottom_dpad': {
        label: 'Bottom D-Pad',
        dropdowns: [
          { id: 'up', label: 'Up (btn 11+12)' },
          { id: 'right', label: 'Right (btn 12+13)' },
          { id: 'down', label: 'Down (btn 13+14)' },
          { id: 'left', label: 'Left (btn 11+14)' }
        ]
      },
      'ab9_thumb_fakey': {
        label: 'Thumb Funky Knob',
        dropdowns: [
          { id: 'forward', label: 'Forward (btn 15)' },
          { id: 'up', label: 'Up (btn 16)' },
          { id: 'back', label: 'Back (btn 17)' },
          { id: 'down', label: 'Down (btn 18)' },
          { id: 'press', label: 'Press (btn 19)' }
        ]
      },
      'ab9_top_dpad': {
        label: 'Top D-Pad',
        dropdowns: [
          { id: 'up', label: 'Up (btn 20+21)' },
          { id: 'right', label: 'Right (btn 20+23)' },
          { id: 'down', label: 'Down (btn 22+23)' },
          { id: 'left', label: 'Left (btn 21+22)' },
          { id: 'press', label: 'Press (btn 24)' }
        ]
      },
      'ab9_thumb_switch': {
        label: 'Thumb Switch',
        dropdowns: [
          { id: 'up', label: 'Up (btn 25)' },
          { id: 'down', label: 'Down (btn 26)' }
        ]
      },
      'ab9_thumb_hat': {
        label: 'Thumb Hat',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' },
          { id: 'diag_up_left', label: 'Diagonal Up-Left' },
          { id: 'diag_up_right', label: 'Diagonal Up-Right' },
          { id: 'diag_down_left', label: 'Diagonal Down-Left' },
          { id: 'diag_down_right', label: 'Diagonal Down-Right' }
        ]
      },
      'ab9_y_axis': {
        label: 'Y Axis (Pitch)',
        dropdowns: [{ id: 'action', label: 'Axis Action' }]
      },
      'ab9_x_axis': {
        label: 'X Axis (Roll)',
        dropdowns: [{ id: 'action', label: 'Axis Action' }]
      },
      // X56 Throttle controls - switches, toggles, buttons, and ministicks
      'x56_th_sw1_sw2': {
        label: 'SW1 Up / SW2 Down',
        dropdowns: [
          { id: 'sw1_up', label: 'SW1 Up' },
          { id: 'sw2_down', label: 'SW2 Down' }
        ]
      },
      'x56_th_sw3_sw4': {
        label: 'SW3 Up / SW4 Down',
        dropdowns: [
          { id: 'sw3_up', label: 'SW3 Up' },
          { id: 'sw4_down', label: 'SW4 Down' }
        ]
      },
      'x56_th_sw5_sw6': {
        label: 'SW5 Up / SW6 Down',
        dropdowns: [
          { id: 'sw5_up', label: 'SW5 Up' },
          { id: 'sw6_down', label: 'SW6 Down' }
        ]
      },
      'x56_th_tgl1': {
        label: 'Toggle 1 (TGL1)',
        dropdowns: [{ id: 'action', label: 'Action' }]
      },
      'x56_th_tgl2': {
        label: 'Toggle 2 (TGL2)',
        dropdowns: [{ id: 'action', label: 'Action' }]
      },
      'x56_th_tgl3': {
        label: 'Toggle 3 (TGL3)',
        dropdowns: [{ id: 'action', label: 'Action' }]
      },
      'x56_th_tgl4': {
        label: 'Toggle 4 (TGL4)',
        dropdowns: [{ id: 'action', label: 'Action' }]
      },
      'x56_th_thumb_btn': {
        label: 'Thumb Button',
        dropdowns: [{ id: 'press', label: 'Press' }]
      },
      'x56_th_rear_ministick': {
        label: 'Rear Stick',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' },
          { id: 'press', label: 'Press' }
        ]
      },
      'x56_th_thumb_ministick': {
        label: 'Thumb Ministick',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' },
          { id: 'press', label: 'Press' }
        ]
      },
      'x56_th_thumb_dpad': {
        label: 'Thumb D-Pad Switch',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' },
          { id: 'press', label: 'Press' }
        ]
      },
      // X56 Throttle Axis controls
      'x56_th_throttle_left': {
        label: 'Left Throttle',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'x56_th_throttle_right': {
        label: 'Right Throttle',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'x56_th_rty3': {
        label: 'Rotary 3 (RTY3)',
        dropdowns: [
          { id: 'axis', label: 'Axis Action' },
          { id: 'press', label: 'Press' }
        ]
      },
      'x56_th_rty4': {
        label: 'Rotary 4 (RTY4)',
        dropdowns: [
          { id: 'axis', label: 'Axis Action' },
          { id: 'press', label: 'Press' }
        ]
      },
      'x56_th_top_knob': {
        label: 'Top Rotary Knob',
        dropdowns: [
          { id: 'axis', label: 'Axis Action' },
          { id: 'press', label: 'Press' }
        ]
      },
      'x56_th_bottom_knob': {
        label: 'Bottom Rotary Knob',
        dropdowns: [
          { id: 'axis', label: 'Axis Action' },
          { id: 'press', label: 'Press' }
        ]
      },
      // X56 Stick controls
      'x56_js_trigger': {
        label: 'Trigger (2-stage)',
        dropdowns: [
          { id: 'stage1', label: 'Stage 1 (Half)' },
          { id: 'stage2', label: 'Stage 2 (Full)' }
        ]
      },
      'x56_js_thumb_hat': {
        label: 'Thumb Hat (8-way)',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' },
          { id: 'up_left', label: 'Up-Left' },
          { id: 'up_right', label: 'Up-Right' },
          { id: 'down_left', label: 'Down-Left' },
          { id: 'down_right', label: 'Down-Right' }
        ]
      },
      'x56_js_thumb_dpad': {
        label: 'Thumb D-Pad (4-way)',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' }
        ]
      },
      'x56_js_missile_btn': {
        label: 'Missile Button',
        dropdowns: [{ id: 'press', label: 'Press' }]
      },
      'x56_js_thumbstick': {
        label: 'Thumbstick',
        dropdowns: [
          { id: 'x_axis', label: 'X Axis' },
          { id: 'y_axis', label: 'Y Axis' },
          { id: 'press', label: 'Press' }
        ]
      },
      'x56_js_pinky_switch': {
        label: 'Pinky Switch',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' }
        ]
      },
      // Logitech Flight Yoke controls
      'yoke_x_axis': {
        label: 'X-Axis (Pitch)',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'yoke_y_axis': {
        label: 'Y-Axis (Roll)',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'yoke_left_hat': {
        label: 'Left Hat (4-way POV)',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' }
        ]
      },
      'yoke_right_funky': {
        label: 'Right Funky (5-way)',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' },
          { id: 'press', label: 'Press' }
        ]
      },
      'yoke_b1': {
        label: 'B1 Button',
        dropdowns: [{ id: 'press', label: 'Press' }]
      },
      'yoke_b2': {
        label: 'B2 Button',
        dropdowns: [{ id: 'press', label: 'Press' }]
      },
      'yoke_b3': {
        label: 'B3 Button',
        dropdowns: [{ id: 'press', label: 'Press' }]
      },
      'yoke_t1_t2': {
        label: 'T1/T2 Triggers',
        dropdowns: [
          { id: 't1', label: 'T1' },
          { id: 't2', label: 'T2' }
        ]
      },
      'yoke_t3_t4': {
        label: 'T3/T4 Triggers',
        dropdowns: [
          { id: 't3', label: 'T3' },
          { id: 't4', label: 'T4' }
        ]
      },
      'yoke_t5_t6': {
        label: 'T5/T6 Triggers',
        dropdowns: [
          { id: 't5', label: 'T5' },
          { id: 't6', label: 'T6' }
        ]
      },
      // Logitech Flight Throttle Quadrant controls
      'throttle_t1_t2': {
        label: 'T1/T2 Toggle Switches',
        dropdowns: [
          { id: 't1', label: 'T1' },
          { id: 't2', label: 'T2' }
        ]
      },
      'throttle_t3_t4': {
        label: 'T3/T4 Toggle Switches',
        dropdowns: [
          { id: 't3', label: 'T3' },
          { id: 't4', label: 'T4' }
        ]
      },
      'throttle_t5_t6': {
        label: 'T5/T6 Toggle Switches',
        dropdowns: [
          { id: 't5', label: 'T5' },
          { id: 't6', label: 'T6' }
        ]
      },
      // VKB Gladiator Left controls - Updated naming convention
      // Windows Button mapping: 1=Trigger S1, 2=Trigger S2, 3=A2 Red, 4=A3 Black, 5=A5, 6=A6, 7=D1 Pinky, 12=F2 Encoder, 13=A1 Ministick
      'vkb_l_trigger': {
        label: 'Trigger (2-stage)',
        dropdowns: [
          { id: 'stage1', label: 'Stage 1' },
          { id: 'stage2', label: 'Stage 2' }
        ]
      },
      'vkb_l_b1_side': {
        label: 'B1 Side Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'vkb_l_d1_pinky': {
        label: 'D1 Pinky Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'vkb_l_base_switch': {
        label: 'Base Switch',
        dropdowns: [{ id: 'action', label: 'Toggle' }]
      },
      'vkb_l_f1': {
        label: 'F1 Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'vkb_l_f2': {
        label: 'F2 Encoder',
        dropdowns: [
          { id: 'press', label: 'Press' },
          { id: 'cw', label: 'Rotate CW' },
          { id: 'ccw', label: 'Rotate CCW' }
        ]
      },
      'vkb_l_f3': {
        label: 'F3 Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'vkb_l_c1_thumb_hat': {
        label: 'C1 Thumb Hat (4-way)',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' }
        ]
      },
      'vkb_l_a2_red': {
        label: 'A2 Top Red Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'vkb_l_a3_center_hat': {
        label: 'A3 Center Hat (5-way)',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' },
          { id: 'press', label: 'Press (Black Button)' }
        ]
      },
      'vkb_l_a4_top_hat': {
        label: 'A4 Top Left Hat (4-way)',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' }
        ]
      },
      'vkb_l_a1_ministick': {
        label: 'A1 Mini-stick (5-way)',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' },
          { id: 'press', label: 'Press' }
        ]
      },
      // VKB Gladiator Right controls - Updated naming convention
      'vkb_r_trigger': {
        label: 'Trigger (2-stage)',
        dropdowns: [
          { id: 'stage1', label: 'Stage 1' },
          { id: 'stage2', label: 'Stage 2' }
        ]
      },
      'vkb_r_b1_side': {
        label: 'B1 Side Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'vkb_r_d1_pinky': {
        label: 'D1 Pinky Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'vkb_r_base_switch': {
        label: 'Base Switch',
        dropdowns: [{ id: 'action', label: 'Toggle' }]
      },
      'vkb_r_f1': {
        label: 'F1 Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'vkb_r_f2': {
        label: 'F2 Encoder',
        dropdowns: [
          { id: 'press', label: 'Press' },
          { id: 'cw', label: 'Rotate CW' },
          { id: 'ccw', label: 'Rotate CCW' }
        ]
      },
      'vkb_r_f3': {
        label: 'F3 Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'vkb_r_c1_thumb_hat': {
        label: 'C1 Thumb Hat (4-way)',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' }
        ]
      },
      'vkb_r_a2_red': {
        label: 'A2 Top Red Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'vkb_r_a3_center_hat': {
        label: 'A3 Center Hat (5-way)',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' },
          { id: 'press', label: 'Press (Black Button)' }
        ]
      },
      'vkb_r_a4_top_hat': {
        label: 'A4 Top Right Hat (4-way)',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' }
        ]
      },
      'vkb_r_a1_ministick': {
        label: 'A1 Mini-stick (5-way)',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' },
          { id: 'press', label: 'Press' }
        ]
      },
      // X52 Pro Throttle controls
      'x52_th_select': {
        label: 'Select/Scroll Wheel',
        dropdowns: [
          { id: 'press', label: 'Press' },
          { id: 'scroll_up', label: 'Scroll Up' },
          { id: 'scroll_down', label: 'Scroll Down' }
        ]
      },
      'x52_th_dpad': {
        label: 'Throttle D-Pad',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' }
        ]
      },
      'x52_th_thumb': {
        label: 'Thumb Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'x52_th_front_dpad': {
        label: 'Front D-Pad',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' }
        ]
      },
      'x52_th_rt1': {
        label: 'RT1 Rotary',
        dropdowns: [{ id: 'axis', label: 'Axis' }]
      },
      'x52_th_rt2': {
        label: 'RT2 Rotary',
        dropdowns: [{ id: 'axis', label: 'Axis' }]
      },
      'x52_th_t1_t2': {
        label: 'T1/T2 Toggle Switches',
        dropdowns: [
          { id: 't1', label: 'T1' },
          { id: 't2', label: 'T2' }
        ]
      },
      'x52_th_t3_t4': {
        label: 'T3/T4 Toggle Switches',
        dropdowns: [
          { id: 't3', label: 'T3' },
          { id: 't4', label: 'T4' }
        ]
      },
      'x52_th_t5_t6': {
        label: 'T5/T6 Toggle Switches',
        dropdowns: [
          { id: 't5', label: 'T5' },
          { id: 't6', label: 'T6' }
        ]
      },
      // X52 Pro Stick controls
      'x52_js_thumb_hat': {
        label: 'Thumb Hat (8-way POV)',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' },
          { id: 'up_left', label: 'Up-Left' },
          { id: 'up_right', label: 'Up-Right' },
          { id: 'down_left', label: 'Down-Left' },
          { id: 'down_right', label: 'Down-Right' }
        ]
      },
      'x52_js_a_btn': {
        label: 'A Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'x52_js_b_btn': {
        label: 'B Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'x52_js_c_btn': {
        label: 'C Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'x52_js_fire': {
        label: 'Fire Button',
        dropdowns: [{ id: 'action', label: 'Press' }]
      },
      'x52_js_thumb_dpad': {
        label: 'Thumb D-Pad',
        dropdowns: [
          { id: 'up', label: 'Up' },
          { id: 'down', label: 'Down' },
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' }
        ]
      },
      'x52_js_scroll': {
        label: 'Scroll Wheel',
        dropdowns: [
          { id: 'scroll_up', label: 'Scroll Up' },
          { id: 'scroll_down', label: 'Scroll Down' }
        ]
      },
      'x52_js_trigger': {
        label: 'Trigger',
        dropdowns: [
          { id: 'stage1', label: 'Stage 1' },
          { id: 'stage2', label: 'Stage 2' }
        ]
      },
      'x52_js_pinky_switch': {
        label: 'Pinky Switch',
        dropdowns: [{ id: 'action', label: 'Toggle' }]
      },
      // X56 Stick Axis controls
      'x56_js_pitch': {
        label: 'Pitch Axis',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'x56_js_roll': {
        label: 'Roll Axis',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'x56_js_yaw': {
        label: 'Yaw Axis (Twist)',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'x56_js_thumbstick_x': {
        label: 'Thumbstick X Axis',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'x56_js_thumbstick_y': {
        label: 'Thumbstick Y Axis',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'x56_js_thumbstick_press': {
        label: 'Thumbstick Press',
        dropdowns: [{ id: 'press', label: 'Press' }]
      },
      // X52 Axis controls
      'x52_js_pitch': {
        label: 'Pitch Axis',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'x52_js_roll': {
        label: 'Roll Axis',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'x52_js_yaw': {
        label: 'Yaw Axis (Twist)',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'x52_th_throttle': {
        label: 'Throttle Axis',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      // VKB Gladiator Left Axis controls
      'vkb_l_pitch': {
        label: 'Pitch Axis',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'vkb_l_roll': {
        label: 'Roll Axis',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'vkb_l_yaw': {
        label: 'Yaw Axis (Twist)',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      // VKB Gladiator Right Axis controls
      'vkb_r_pitch': {
        label: 'Pitch Axis',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'vkb_r_roll': {
        label: 'Roll Axis',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'vkb_r_yaw': {
        label: 'Yaw Axis (Twist)',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      // Flight Throttle Quadrant Axis controls
      'throttle_axis1': {
        label: 'Lever 1 (Throttle)',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'throttle_axis2': {
        label: 'Lever 2 (Mixture)',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'throttle_axis3': {
        label: 'Lever 3 (Prop Pitch)',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      // AB9 Flight Stick Axis controls
      'ab9_pitch': {
        label: 'Pitch Axis',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      },
      'ab9_roll': {
        label: 'Roll Axis',
        dropdowns: [{ id: 'axis', label: 'Axis Action' }]
      }
    };

    // Organized action categories for Star Citizen
    this.scActionCategories = {
      'Axis - Flight Control': [
        'axis_flight_control'
      ],
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

    // MSFS action categories - these map to category keys in msfs-events.json
    this.msfsActionCategories = [
      'autopilot',
      'engine',
      'flightControls',
      'electrical',
      'fuel',
      'landingGear',
      'radioNavigation',
      'gps',
      'vor',
      'instrumentation',
      'helicopter',
      'viewCamera',
      'miscAircraft',
      'simulation',
      'slew',
      'multiplayer',
      'atc',
      'g1000'
    ];

    // DCS World action categories - these map to category keys in dcs-events.json
    this.dcsActionCategories = [
      'flightControls',
      'engine',
      'landingGear',
      'autopilot',
      'weapons',
      'targeting',
      'countermeasures',
      'communications',
      'navigation',
      'displays',
      'electrical',
      'lighting',
      'cockpitSystems',
      'views',
      'generalControls',
      'helicopterControls'
    ];

    // X-Plane action categories - these map to category keys in xplane-events.json
    this.xplaneActionCategories = [
      'flightControls',
      'landingGear',
      'engine',
      'autopilot',
      'radios',
      'transponder',
      'electrical',
      'fuel',
      'lights',
      'ice',
      'instruments',
      'gps',
      'views',
      'helicopter',
      'simulation',
      'weapons',
      'general',
      'magnetos'
    ];

    // Elite Dangerous action categories - these map to category keys in elite-events.json
    this.eliteActionCategories = [
      'flightRotation',
      'flightThrust',
      'flightThrottle',
      'flightMisc',
      'targeting',
      'weapons',
      'cooling',
      'shipSystems',
      'powerDistribution',
      'radar',
      'uiFocus',
      'uiNavigation',
      'headlook',
      'camera',
      'fss',
      'dss',
      'srv',
      'fighter',
      'multiCrew',
      'onFoot',
      'misc'
    ];

    // Current action categories (switches based on game)
    this.actionCategories = this.scActionCategories;

    this.init();
  }

  async init() {
    await this.loadActionData();
    this.createMenuElement();
    this.loadCustomBindings();
  }

  loadCustomBindings() {
    try {
      const saved = localStorage.getItem('sccm_hotas_bindings');
      if (saved) {
        this.customBindings = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load HOTAS bindings:', e);
    }
  }

  saveCustomBindings() {
    try {
      localStorage.setItem('sccm_hotas_bindings', JSON.stringify(this.customBindings));
    } catch (e) {
      console.error('Failed to save HOTAS bindings:', e);
    }
  }

  async loadActionData() {
    try {
      // Load Star Citizen action to icon mapping (contains all action names)
      // Path is relative to the HTML file location (src/renderer/)
      const action2IconResponse = await fetch('../data/action2IconFileName.json');
      this.actionData = await action2IconResponse.json();

      // Load Star Citizen category groupings
      const categoriesResponse = await fetch('../data/actionCategories.json');
      this.categoryData = await categoriesResponse.json();

      console.log('Loaded SC action data:', Object.keys(this.actionData).length, 'actions');

      // Load MSFS events data
      const msfsResponse = await fetch('../data/msfs-events.json');
      this.msfsEventData = await msfsResponse.json();
      console.log('Loaded MSFS event data:', this.msfsEventData.totalEvents, 'events');

      // Load DCS World events data
      const dcsResponse = await fetch('../data/dcs-events.json');
      this.dcsEventData = await dcsResponse.json();
      console.log('Loaded DCS event data:', Object.keys(this.dcsEventData.categories).length, 'categories');

      // Load X-Plane events data
      const xplaneResponse = await fetch('../data/xplane-events.json');
      this.xplaneEventData = await xplaneResponse.json();
      console.log('Loaded X-Plane event data:', Object.keys(this.xplaneEventData.categories).length, 'categories');

      // Load Elite Dangerous events data
      const eliteResponse = await fetch('../data/elite-events.json');
      this.eliteEventData = await eliteResponse.json();
      console.log('Loaded Elite Dangerous event data:', Object.keys(this.eliteEventData.categories).length, 'categories');
    } catch (error) {
      console.error('Failed to load action data:', error);
      this.actionData = {};
      this.categoryData = {};
      this.msfsEventData = { categories: {} };
      this.dcsEventData = { categories: {} };
      this.xplaneEventData = { categories: {} };
      this.eliteEventData = { categories: {} };
    }
  }

  // Switch to a different game's action set
  setGame(gameId) {
    this.currentGame = gameId;
    console.log('Binding context menu switched to game:', gameId);
  }

  // Check if a control is mode-sensitive (supports mode switching)
  isModeSensitiveControl(buttonId) {
    // Check X56 controls
    if (buttonId.startsWith('x56_')) {
      return !this.modeExcludedControls.some(excluded => buttonId.startsWith(excluded));
    }
    // Check X52 controls
    if (buttonId.startsWith('x52_')) {
      return !this.modeExcludedControls.some(excluded => buttonId.startsWith(excluded));
    }
    return false;
  }

  // Get the binding key with mode prefix if applicable
  getBindingKey(buttonId, dropdownId) {
    const baseKey = `${buttonId}_${dropdownId}`;

    // Apply mode prefix for X56 controls that are mode-sensitive
    if (buttonId.startsWith('x56_') && this.isModeSensitiveControl(buttonId)) {
      return `${this.currentMode}_${baseKey}`;
    }

    // Apply mode prefix for X52 controls that are mode-sensitive
    if (buttonId.startsWith('x52_') && this.isModeSensitiveControl(buttonId)) {
      return `${this.x52CurrentMode}_${baseKey}`;
    }

    return baseKey;
  }

  // Get the mode label for display (X56)
  getModeLabel() {
    const modeLabels = {
      'm1': ' [M1/Ctrl]',
      'm2': ' [M2/Alt]',
      's1': ' [S1/Shift]'
    };
    return modeLabels[this.currentMode] || '';
  }

  // Get the mode label for display (X52)
  getX52ModeLabel() {
    const modeLabels = {
      'mode1': ' [Mode 1/Ctrl]',
      'mode2': ' [Mode 2/Alt]',
      'mode3': ' [Mode 3/Shift]'
    };
    return modeLabels[this.x52CurrentMode] || '';
  }

  createMenuElement() {
    // Create the context menu container
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'binding-context-menu';
    this.menuElement.style.display = 'none';

    document.body.appendChild(this.menuElement);

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      // Check if click is on any hotspot type
      const isHotspotClick = e.target.closest('.ab9-hotspot') ||
                             e.target.closest('.x56-throttle-hotspot') ||
                             e.target.closest('.x56-stick-hotspot') ||
                             e.target.closest('.x52-hotspot') ||
                             e.target.closest('.vkb-left-hotspot') ||
                             e.target.closest('.vkb-right-hotspot') ||
                             e.target.closest('.hotas-axis-btn');

      if (!this.menuElement.contains(e.target) && !isHotspotClick) {
        this.hide();
        // Deselect all hotspots and axis buttons
        document.querySelectorAll('.hotas-axis-btn.selected, .ab9-hotspot.selected, .x56-throttle-hotspot.selected, .x56-stick-hotspot.selected, .x52-hotspot.selected, .vkb-left-hotspot.selected, .vkb-right-hotspot.selected').forEach(btn => {
          btn.classList.remove('selected');
        });
      }
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
        // Deselect all hotspots and axis buttons
        document.querySelectorAll('.hotas-axis-btn.selected, .ab9-hotspot.selected, .x56-throttle-hotspot.selected, .x56-stick-hotspot.selected, .vkb-left-hotspot.selected, .vkb-right-hotspot.selected').forEach(btn => {
          btn.classList.remove('selected');
        });
      }
    });
  }

  async show(buttonId, anchorElement) {
    const config = this.controlConfig[buttonId];
    if (!config) {
      console.warn('No config found for button:', buttonId);
      return;
    }

    // Ensure action data is loaded before rendering
    if (!this.actionData || Object.keys(this.actionData).length === 0) {
      console.log('Action data not loaded yet, loading now...');
      await this.loadActionData();
    }

    this.currentButton = buttonId;
    this.currentButtonLabel = config.label;
    this.renderMenu(config, buttonId);
    this.positionMenu(anchorElement);
    this.menuElement.style.display = 'block';
  }

  hide() {
    this.menuElement.style.display = 'none';
    const previousButton = this.currentButton;
    this.currentButton = null;
    this.currentButtonLabel = null;

    // Notify that menu was closed so highlight can be cleared
    if (this.onMenuClosed && previousButton) {
      this.onMenuClosed(previousButton);
    }
  }

  renderMenu(config, buttonId) {
    // Get the current binding for each dropdown to pre-select it
    const getCurrentBinding = (dropdownId) => {
      const bindKey = this.getBindingKey(buttonId, dropdownId);
      return this.customBindings[bindKey] || '';
    };

    const dropdownsHTML = config.dropdowns.map(dropdown => {
      const currentBinding = getCurrentBinding(dropdown.id);
      return `
        <div class="binding-dropdown-group">
          <label class="binding-dropdown-label">${dropdown.label}</label>
          <div class="binding-dropdown-wrapper">
            <select class="binding-dropdown" data-button="${buttonId}" data-dropdown-id="${dropdown.id}">
              <option value="">-- Select Action --</option>
              ${this.renderCategorizedOptions(currentBinding)}
            </select>
          </div>
        </div>
      `;
    }).join('');

    // Show mode indicator for X56 and X52 controls that support modes
    const isX56Control = buttonId.startsWith('x56_');
    const isX52Control = buttonId.startsWith('x52_');
    const isModeSensitive = (isX56Control || isX52Control) && this.isModeSensitiveControl(buttonId);

    let modeIndicator = '';
    if (isX56Control && isModeSensitive) {
      modeIndicator = `<span class="mode-indicator mode-${this.currentMode}">${this.getModeLabel()}</span>`;
    } else if (isX52Control && isModeSensitive) {
      modeIndicator = `<span class="mode-indicator x52-${this.x52CurrentMode}">${this.getX52ModeLabel()}</span>`;
    }

    let modeWarning = '';
    if ((isX56Control || isX52Control) && !isModeSensitive) {
      modeWarning = '<div class="mode-warning">This control is not affected by modes</div>';
    }

    this.menuElement.innerHTML = `
      <div class="binding-menu-header">
        <span class="binding-menu-title">HOTAS: ${config.label}${modeIndicator}</span>
        <button class="binding-menu-close">&times;</button>
      </div>
      ${modeWarning}
      <div class="binding-menu-body">
        ${dropdownsHTML}
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
      this.applyBindings();
    });
    this.menuElement.querySelector('.binding-clear-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearBindings();
    });

    // Add search/filter functionality to dropdowns
    this.menuElement.querySelectorAll('.binding-dropdown').forEach(select => {
      select.addEventListener('change', (e) => {
        this.onDropdownChange(e.target);
      });
    });
  }

  // Get all actions that are already mapped (across all bindings)
  getUsedActions() {
    const usedActions = new Set();
    for (const action of Object.values(this.customBindings)) {
      usedActions.add(action);
    }
    return usedActions;
  }

  renderCategorizedOptions(currentBinding = '') {
    // Get already used actions to filter them out (but keep the current binding available)
    const usedActions = this.getUsedActions();
    // Remove current binding from used actions so it still appears in dropdown
    if (currentBinding) {
      usedActions.delete(currentBinding);
    }

    // Render options based on current game
    if (this.currentGame === 'msfs2024') {
      return this.renderMSFSOptions(usedActions, currentBinding);
    } else if (this.currentGame === 'dcs-world') {
      return this.renderDCSOptions(usedActions, currentBinding);
    } else if (this.currentGame === 'xplane') {
      return this.renderXPlaneOptions(usedActions, currentBinding);
    } else if (this.currentGame === 'elite-dangerous') {
      return this.renderEliteOptions(usedActions, currentBinding);
    } else {
      return this.renderStarCitizenOptions(usedActions, currentBinding);
    }
  }

  renderStarCitizenOptions(usedActions = new Set(), currentBinding = '') {
    let optionsHTML = '';

    // Group actions by our intuitive categories
    for (const [categoryName, actionGroups] of Object.entries(this.scActionCategories)) {
      const actionsInCategory = this.getActionsForCategory(actionGroups)
        .filter(action => !usedActions.has(action)); // Filter out already used actions

      if (actionsInCategory.length > 0) {
        optionsHTML += `<optgroup label="${categoryName}">`;

        actionsInCategory.forEach(action => {
          const displayName = this.formatActionName(action);
          const selected = action === currentBinding ? ' selected' : '';
          optionsHTML += `<option value="${action}"${selected}>${displayName}</option>`;
        });

        optionsHTML += `</optgroup>`;
      }
    }

    // Add "Other" category for uncategorized actions
    const otherActions = this.getUncategorizedActions()
      .filter(action => !usedActions.has(action)); // Filter out already used actions
    if (otherActions.length > 0) {
      optionsHTML += `<optgroup label="Other">`;
      otherActions.slice(0, 50).forEach(action => { // Limit to prevent huge dropdown
        const displayName = this.formatActionName(action);
        const selected = action === currentBinding ? ' selected' : '';
        optionsHTML += `<option value="${action}"${selected}>${displayName}</option>`;
      });
      optionsHTML += `</optgroup>`;
    }

    return optionsHTML;
  }

  renderMSFSOptions(usedActions = new Set(), currentBinding = '') {
    let optionsHTML = '';

    if (!this.msfsEventData || !this.msfsEventData.categories) {
      console.warn('MSFS event data not loaded');
      return '<option value="">No MSFS events loaded</option>';
    }

    // Iterate through MSFS categories
    for (const categoryKey of this.msfsActionCategories) {
      const category = this.msfsEventData.categories[categoryKey];
      if (!category || !category.events || category.events.length === 0) continue;

      // Filter out already used events
      const availableEvents = category.events.filter(event => !usedActions.has(event.id));
      if (availableEvents.length === 0) continue;

      optionsHTML += `<optgroup label="${category.name}">`;

      availableEvents.forEach(event => {
        // Use event ID as value, description for display
        const displayName = this.formatMSFSEventName(event.id, event.description);
        const selected = event.id === currentBinding ? ' selected' : '';
        optionsHTML += `<option value="${event.id}" title="${event.description}"${selected}>${displayName}</option>`;
      });

      optionsHTML += `</optgroup>`;
    }

    return optionsHTML;
  }

  formatMSFSEventName(eventId, description) {
    // Format MSFS event name for display
    // e.g., "AP_MASTER" -> "AP Master" or use description if short enough
    if (description && description.length < 40) {
      return description;
    }
    // Fallback to formatted event ID
    return eventId
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  renderDCSOptions(usedActions = new Set(), currentBinding = '') {
    let optionsHTML = '';

    if (!this.dcsEventData || !this.dcsEventData.categories) {
      console.warn('DCS event data not loaded');
      return '<option value="">No DCS events loaded</option>';
    }

    // Iterate through DCS categories
    for (const categoryKey of this.dcsActionCategories) {
      const category = this.dcsEventData.categories[categoryKey];
      if (!category || !category.events || category.events.length === 0) continue;

      // Filter out already used events
      const availableEvents = category.events.filter(event => !usedActions.has(event.id));
      if (availableEvents.length === 0) continue;

      optionsHTML += `<optgroup label="${category.name}">`;

      availableEvents.forEach(event => {
        // Use event ID as value, description for display
        const displayName = this.formatDCSEventName(event.id, event.description);
        const typeLabel = event.type === 'axis' ? ' [Axis]' : '';
        const selected = event.id === currentBinding ? ' selected' : '';
        optionsHTML += `<option value="${event.id}" title="${event.description}"${selected}>${displayName}${typeLabel}</option>`;
      });

      optionsHTML += `</optgroup>`;
    }

    return optionsHTML;
  }

  formatDCSEventName(eventId, description) {
    // Format DCS event name for display
    // Use description if available and short enough
    if (description && description.length < 45) {
      return description;
    }
    // Fallback to formatted event ID
    return eventId
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  renderXPlaneOptions(usedActions = new Set(), currentBinding = '') {
    let optionsHTML = '';

    if (!this.xplaneEventData || !this.xplaneEventData.categories) {
      console.warn('X-Plane event data not loaded');
      return '<option value="">No X-Plane events loaded</option>';
    }

    // Iterate through X-Plane categories
    for (const categoryKey of this.xplaneActionCategories) {
      const category = this.xplaneEventData.categories[categoryKey];
      if (!category || !category.events || category.events.length === 0) continue;

      // Filter out already used events
      const availableEvents = category.events.filter(event => !usedActions.has(event.id));
      if (availableEvents.length === 0) continue;

      optionsHTML += `<optgroup label="${category.name}">`;

      availableEvents.forEach(event => {
        // Use event ID as value, description for display
        const displayName = this.formatXPlaneEventName(event.id, event.description);
        const typeLabel = event.type === 'axis' ? ' [Axis]' : '';
        const selected = event.id === currentBinding ? ' selected' : '';
        optionsHTML += `<option value="${event.id}" title="${event.description}"${selected}>${displayName}${typeLabel}</option>`;
      });

      optionsHTML += `</optgroup>`;
    }

    return optionsHTML;
  }

  formatXPlaneEventName(eventId, description) {
    // Format X-Plane event name for display
    // Use description if available and short enough
    if (description && description.length < 45) {
      return description;
    }
    // Fallback: extract the last part of the command path and format it
    // e.g., "sim/flight_controls/pitch_trim_up" -> "Pitch Trim Up"
    const parts = eventId.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  renderEliteOptions(usedActions = new Set(), currentBinding = '') {
    let optionsHTML = '';

    if (!this.eliteEventData || !this.eliteEventData.categories) {
      console.warn('Elite Dangerous event data not loaded');
      return '<option value="">No Elite Dangerous events loaded</option>';
    }

    // Iterate through Elite Dangerous categories
    for (const categoryKey of this.eliteActionCategories) {
      const category = this.eliteEventData.categories[categoryKey];
      if (!category || !category.events || category.events.length === 0) continue;

      // Filter out already used events
      const availableEvents = category.events.filter(event => !usedActions.has(event.id));
      if (availableEvents.length === 0) continue;

      optionsHTML += `<optgroup label="${category.name}">`;

      availableEvents.forEach(event => {
        // Use event ID as value, description for display
        const displayName = this.formatEliteEventName(event.id, event.description);
        const typeLabel = event.type === 'axis' ? ' [Axis]' : '';
        const selected = event.id === currentBinding ? ' selected' : '';
        optionsHTML += `<option value="${event.id}" title="${event.description}"${selected}>${displayName}${typeLabel}</option>`;
      });

      optionsHTML += `</optgroup>`;
    }

    return optionsHTML;
  }

  formatEliteEventName(eventId, description) {
    // Format Elite Dangerous event name for display
    // Use description if available and short enough
    if (description && description.length < 45) {
      return description;
    }
    // Fallback: convert PascalCase to readable format
    // e.g., "YawLeftButton" -> "Yaw Left Button"
    return eventId
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getActionsForCategory(actionGroups) {
    const actions = [];

    if (!this.actionData) return actions;

    // Get all action names from our data
    const allActions = Object.keys(this.actionData);

    // Filter actions that belong to the specified groups
    actionGroups.forEach(group => {
      allActions.forEach(action => {
        // Match actions by prefix patterns
        if (this.actionBelongsToGroup(action, group) && !actions.includes(action)) {
          actions.push(action);
        }
      });
    });

    return actions.sort();
  }

  actionBelongsToGroup(action, group) {
    // Map group names to action prefixes/patterns
    const groupPatterns = {
      'axis_flight_control': /^(v_(pitch|roll|yaw|strafe_lateral|strafe_longitudinal|strafe_vertical|throttle_abs|throttle_rel|view_pitch|view_yaw)|turret_(pitch|yaw))$/,
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

  getUncategorizedActions() {
    if (!this.actionData) return [];

    const allActions = Object.keys(this.actionData);
    const categorizedActions = new Set();

    // Collect all categorized actions
    for (const actionGroups of Object.values(this.actionCategories)) {
      const actions = this.getActionsForCategory(actionGroups);
      actions.forEach(a => categorizedActions.add(a));
    }

    // Return actions not in any category
    return allActions.filter(a => !categorizedActions.has(a));
  }

  formatActionName(action) {
    // Convert action ID to human-readable name
    // e.g., "v_strafe_forward" -> "Strafe Forward"
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
    const menuRect = this.menuElement.getBoundingClientRect();

    let left = rect.right + 10;
    let top = rect.top;

    // Keep menu on screen
    if (left + 350 > window.innerWidth) {
      left = rect.left - 360;
    }
    if (top + menuRect.height > window.innerHeight) {
      top = window.innerHeight - menuRect.height - 20;
    }
    if (top < 10) top = 10;

    this.menuElement.style.left = `${left}px`;
    this.menuElement.style.top = `${top}px`;
  }

  onDropdownChange(selectElement) {
    const value = selectElement.value;
    const button = selectElement.dataset.button;
    const dropdownId = selectElement.dataset.dropdownId;

    console.log(`Binding changed: ${button} [${dropdownId}] = ${value}`);
  }

  applyBindings() {
    // Get all dropdowns and save their values
    const dropdowns = this.menuElement.querySelectorAll('.binding-dropdown');

    dropdowns.forEach(dropdown => {
      const dropdownId = dropdown.dataset.dropdownId;
      const action = dropdown.value;
      const bindKey = this.getBindingKey(this.currentButton, dropdownId);

      if (action) {
        // Create binding key using getBindingKey for mode-aware storage
        this.customBindings[bindKey] = action;
        console.log(`HOTAS binding added: ${bindKey} = ${action}`);
      } else {
        // Remove the binding if no action selected
        if (this.customBindings[bindKey]) {
          delete this.customBindings[bindKey];
          console.log(`HOTAS binding removed: ${bindKey}`);
        }
      }
    });

    this.saveCustomBindings();

    // Notify callback
    if (this.onBindingChanged) {
      this.onBindingChanged(this.currentButton, this.customBindings);
    }

    // Close the menu after saving
    this.hide();
  }

  clearBindings() {
    // Clear bindings for this button based on current mode
    const isX56Control = this.currentButton.startsWith('x56_');
    const isX52Control = this.currentButton.startsWith('x52_');
    const isModeSensitive = (isX56Control || isX52Control) && this.isModeSensitiveControl(this.currentButton);

    let keysToDelete;
    if (isModeSensitive) {
      // Determine the mode prefix based on controller type
      let modePrefix;
      if (isX56Control) {
        modePrefix = `${this.currentMode}_`;
      } else if (isX52Control) {
        modePrefix = `${this.x52CurrentMode}_`;
      }
      // Only clear mode-prefixed bindings for current mode
      keysToDelete = Object.keys(this.customBindings).filter(
        key => key.startsWith(modePrefix + this.currentButton + '_')
      );
    } else {
      // Clear non-mode-prefixed bindings (but not mode-prefixed ones)
      keysToDelete = Object.keys(this.customBindings).filter(key => {
        // Check for X56 mode prefixes
        const isX56ModeKey = /^(m1|m2|s1)_/.test(key);
        // Check for X52 mode prefixes
        const isX52ModeKey = /^(mode1|mode2|mode3)_/.test(key);
        return !isX56ModeKey && !isX52ModeKey && (key === this.currentButton || key.startsWith(this.currentButton + '_'));
      });
    }

    keysToDelete.forEach(key => {
      delete this.customBindings[key];
    });

    this.saveCustomBindings();

    // Clear all dropdowns
    this.menuElement.querySelectorAll('.binding-dropdown').forEach(dd => {
      dd.value = '';
    });

    if (this.onClearBindings) {
      this.onClearBindings(this.currentButton, keysToDelete);
    }
  }

  // Set current binding values when showing menu
  setCurrentBindings(bindings) {
    if (!bindings) return;

    // Merge provided bindings into customBindings
    Object.assign(this.customBindings, bindings);

    this.menuElement.querySelectorAll('.binding-dropdown').forEach(select => {
      const buttonId = select.dataset.button;
      const dropdownId = select.dataset.dropdownId;
      // Use mode-aware key lookup
      const key = this.getBindingKey(buttonId, dropdownId);
      if (this.customBindings[key]) {
        select.value = this.customBindings[key];
      }
    });
  }

  getBindings() {
    return this.customBindings;
  }
}

// Make available globally
window.BindingContextMenu = BindingContextMenu;

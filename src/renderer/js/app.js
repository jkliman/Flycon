/**
 * FLYCON - Flight Control Mapping Software - Main Application
 */

class FlyconApp {
  constructor() {
    this.parser = new SCKeybindingParser();
    this.keyboardViz = null;
    this.gamepadViz = null;
    this.hotasViz = null;
    this.activeView = 'brand';
    this.selectedBrand = null;
    this.selectedHardware = null;
    this.manualBindings = [];
    this.mappingFolderPath = '';
    this.loadedFileName = '';

    // Game-specific configuration
    this.currentGame = null; // No game selected by default
    this.gameConfig = null;
    this.pendingGameSwitch = null; // Holds the game to switch to during confirmation
    this.joystickMappings = {}; // Maps JS1-8 to actual hardware devices

    // Default paths per game
    this.defaultMappingPaths = {
      'star-citizen': 'C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\USER\\Client\\0\\Controls\\Mappings',
      'msfs2024': ''
    };
    this.defaultMappingPath = this.defaultMappingPaths['star-citizen'];

    // Hardware configuration by brand
    this.hardwareConfig = {
      logitech: {
        name: 'Logitech',
        devices: [
          { id: 'x56-hotas', name: 'X56 HOTAS', image: '../../assets/controllers/X56 Throttle/x56-Throttle_0012_Layer-0.png' },
          { id: 'x52-hotas', name: 'X52 Pro Flight System', image: '../../assets/controllers/X52/x52pro-gallery-1.webp' },
          { id: 'flight-yoke', name: 'Flight Yoke', image: '../../assets/controllers/Flight Yoke/yoke-gallery-2_0008_Layer-1.png' },
          { id: 'flight-throttle', name: 'Flight Throttle Quadrant', image: '../../assets/controllers/Flight System Throttle/throttle-gallery-1_0003_Layer-1.png' }
        ]
      },
      moza: {
        name: 'MOZA',
        devices: [
          { id: 'ab9', name: 'AB9 Base with MH16 Stick', image: '../../assets/controllers/AB9 Buttons/AB9-flight-stick_0011_Layer-0.png' }
        ]
      },
      vkb: {
        name: 'VKB',
        devices: [
          { id: 'vkb-left', name: 'Gladiator Stick Left', image: '../../assets/controllers/vkb-left.png' },
          { id: 'vkb-right', name: 'Gladiator Stick Right', image: '../../assets/controllers/vkb-right.png' }
        ]
      }
    };

    // Connected devices tracking
    this.connectedDevices = {
      gamepad: null,
      hotas: null
    };

    this.init();
  }

  async init() {
    // Check license before initializing app
    if (window.licenseUI) {
      const isLicensed = await window.licenseUI.init();
      if (!isLicensed) {
        // License UI will show the activation modal
        // Wait for license activation before continuing
        console.log('Waiting for license activation...');
        return;
      }
    }

    // Load game configuration
    await this.loadGameConfig();

    // Load saved game preference
    this.loadCurrentGame();

    // Initialize visualizers
    this.initVisualizers();

    // Sync binding context menu with current game
    if (this.hotasViz && this.hotasViz.bindingContextMenu) {
      this.hotasViz.bindingContextMenu.setGame(this.currentGame);
    }

    // Setup event listeners
    this.setupEventListeners();

    // Setup game selector listener
    this.setupGameSelector();

    // Setup brand/hardware navigation
    this.setupNavigationListeners();

    // Setup device connection monitoring
    this.setupDeviceMonitoring();

    // Setup Star Citizen joystick mapping modal
    this.setupStarCitizenJoystickModal();

    // Load saved mapping folder path
    this.loadMappingFolderPath();

    // Load sidebar state
    this.loadSidebarState();

    // Render categories for the current game
    this.renderCategories();

    // Check for auto-detected paths for current game
    await this.checkDefaultPaths();

    this.updateStatus('Ready - Select your hardware');
  }

  async loadGameConfig() {
    try {
      const response = await fetch('../data/game-config.json');
      this.gameConfig = await response.json();
      console.log('Game configuration loaded:', Object.keys(this.gameConfig.games));
    } catch (error) {
      console.error('Failed to load game configuration:', error);
      this.gameConfig = { games: {} };
    }
  }

  loadCurrentGame() {
    try {
      const savedGame = localStorage.getItem('flycon_current_game');
      if (savedGame && this.gameConfig.games[savedGame]) {
        this.currentGame = savedGame;
        // Update the dropdown to match
        const gameSelect = document.getElementById('game-select');
        if (gameSelect) {
          gameSelect.value = savedGame;
        }
        // Update default mapping path
        this.defaultMappingPath = this.defaultMappingPaths[savedGame] || '';
        // Show SC joystick settings icon if Star Citizen is selected
        this.updateScJoystickSettingsIcon();
      }
    } catch (e) {
      console.error('Failed to load current game:', e);
    }
  }

  saveCurrentGame() {
    try {
      localStorage.setItem('flycon_current_game', this.currentGame);
    } catch (e) {
      console.error('Failed to save current game:', e);
    }
  }

  setupGameSelector() {
    const gameSelect = document.getElementById('game-select');
    if (!gameSelect) return;

    // Note: loadCurrentGame() already handles loading the saved game
    // We just need to set up the event listener here

    gameSelect.addEventListener('change', (e) => {
      const newGame = e.target.value;
      if (!newGame || newGame === this.currentGame) return;

      // Check if there are existing bindings
      const hasBindings = this.hasExistingBindings();

      if (hasBindings && this.currentGame) {
        // Store the pending game and show confirmation modal
        this.pendingGameSwitch = newGame;
        this.showGameSwitchModal();
        // Reset dropdown to current game until confirmed
        gameSelect.value = this.currentGame || '';
      } else {
        // No bindings or first time selection, handle game-specific setup
        this.handleGameSelection(newGame);
      }
    });

    // Setup game switch modal buttons
    document.getElementById('btn-confirm-switch')?.addEventListener('click', () => {
      this.hideGameSwitchModal();
      if (this.pendingGameSwitch) {
        const newGame = this.pendingGameSwitch;
        this.pendingGameSwitch = null;
        // Clear existing bindings first
        this.clearAllBindings();
        // Then handle the game selection (may show SC joystick modal)
        this.handleGameSelection(newGame);
      }
    });

    document.getElementById('btn-cancel-switch')?.addEventListener('click', () => {
      this.hideGameSwitchModal();
      this.pendingGameSwitch = null;
    });

    document.getElementById('close-game-switch-modal')?.addEventListener('click', () => {
      this.hideGameSwitchModal();
      this.pendingGameSwitch = null;
    });
  }

  hasExistingBindings() {
    // Check HOTAS custom bindings
    const hotasBindings = this.hotasViz?.customBindings || {};
    if (Object.keys(hotasBindings).length > 0) return true;

    // Check parser bindings
    const parserBindings = this.parser?.bindings || {};
    if (Object.keys(parserBindings).length > 0) return true;

    // Check manual bindings
    if (this.manualBindings.length > 0) return true;

    return false;
  }

  showGameSwitchModal() {
    const modal = document.getElementById('game-switch-modal');
    modal?.classList.add('active');
  }

  hideGameSwitchModal() {
    const modal = document.getElementById('game-switch-modal');
    modal?.classList.remove('active');
  }

  switchGame(gameId, clearBindings = false) {
    if (!this.gameConfig.games[gameId]) {
      console.error('Unknown game:', gameId);
      return;
    }

    console.log('Switching game from', this.currentGame, 'to', gameId, 'clearBindings:', clearBindings);

    // Clear existing bindings if requested
    if (clearBindings) {
      this.clearAllBindings();
    }

    // Update current game
    this.currentGame = gameId;
    this.saveCurrentGame();

    // Update dropdown (important to do this AFTER updating currentGame)
    const gameSelect = document.getElementById('game-select');
    if (gameSelect) {
      gameSelect.value = gameId;
    }

    // Update default mapping path
    this.defaultMappingPath = this.defaultMappingPaths[gameId] || '';
    this.updateMappingPathDisplay();

    // Update the binding context menu to use the new game's actions
    if (this.hotasViz && this.hotasViz.bindingContextMenu) {
      this.hotasViz.bindingContextMenu.setGame(gameId);
    }

    // Re-render categories for the new game
    this.renderCategories();

    // Refresh visualizers to clear any stale state
    this.refreshAllVisualizers();

    // Update status
    const gameName = this.gameConfig.games[gameId].name;
    this.updateStatus(`Switched to ${gameName}`);

    // Show/hide SC joystick settings icon
    this.updateScJoystickSettingsIcon();

    console.log('Switched to game:', gameId);
  }

  clearAllBindings() {
    // Clear HOTAS bindings
    if (this.hotasViz) {
      // Hide the binding context menu if it's open
      if (this.hotasViz.bindingContextMenu) {
        this.hotasViz.bindingContextMenu.hide();
        this.hotasViz.bindingContextMenu.customBindings = {};
        this.hotasViz.bindingContextMenu.saveCustomBindings();
      }

      // Clear the visualizer's bindings
      this.hotasViz.customBindings = {};
      this.hotasViz.saveCustomBindings();

      // Clear selected button state and remove selection classes
      this.hotasViz.selectedButton = null;

      // Hide all highlight images
      Object.values(this.hotasViz.highlightImages || {}).forEach(img => {
        if (img) img.style.display = 'none';
      });

      // Remove selection/bound classes from all hotspots
      this.hotasViz.container?.querySelectorAll('.hotspot').forEach(el => {
        el.classList.remove('selected', 'bound', 'hover');
      });
    }

    // Clear parser bindings (bindings is a Map, so use .clear())
    if (this.parser && this.parser.bindings) {
      this.parser.bindings.clear();
    }

    // Clear manual bindings
    this.manualBindings = [];

    // Clear localStorage bindings for HOTAS (both old and new keys)
    try {
      localStorage.removeItem('flycon_hotas_bindings');
      localStorage.removeItem('sccm_hotas_bindings');
      localStorage.removeItem('sccm_custom_bindings');
    } catch (e) {
      console.error('Failed to clear bindings from storage:', e);
    }

    console.log('All bindings cleared');
  }

  renderCategories() {
    const categoryList = document.getElementById('category-list');
    if (!categoryList) return;

    const gameData = this.gameConfig?.games?.[this.currentGame];
    if (!gameData || !gameData.categories) {
      categoryList.innerHTML = '<p class="no-categories">No categories available</p>';
      return;
    }

    const categories = gameData.categories;
    let html = '';

    // Create a sanitized ID from category name for binding containers
    const sanitizeId = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    for (const categoryName of Object.keys(categories)) {
      const categoryId = sanitizeId(categoryName);
      html += `
        <div class="category-section" data-category="${categoryName}" data-category-id="${categoryId}">
          <div class="category-item" data-category="${categoryName}">
            <span class="category-name">${categoryName}</span>
            <span class="category-count">0</span>
          </div>
          <div class="category-bindings" id="bindings-${categoryId}">
            <!-- Bindings will be populated here -->
          </div>
        </div>
      `;
    }

    categoryList.innerHTML = html;

    // Add click handlers for categories
    categoryList.querySelectorAll('.category-item').forEach(item => {
      item.addEventListener('click', (e) => {
        this.selectCategory(e.currentTarget.dataset.category);
      });
    });

    // Update the HOTAS visualizer with new category mappings if it exists
    if (this.hotasViz) {
      this.hotasViz.updateSidebarBindingsList();
    }
  }

  loadMappingFolderPath() {
    try {
      const savedPath = localStorage.getItem('sccm_mapping_folder');
      if (savedPath) {
        this.mappingFolderPath = savedPath;
      }
      // Don't set default - just show suggestion
      this.updateMappingPathDisplay();
    } catch (e) {
      console.error('Failed to load mapping folder path:', e);
      this.updateMappingPathDisplay();
    }
  }

  saveMappingFolderPath() {
    try {
      localStorage.setItem('sccm_mapping_folder', this.mappingFolderPath);
    } catch (e) {
      console.error('Failed to save mapping folder path:', e);
    }
  }

  updateMappingPathDisplay() {
    const pathEl = document.getElementById('mapping-path');
    const exportPathEl = document.getElementById('export-path');

    if (pathEl) {
      if (this.mappingFolderPath) {
        // Show just the last part of the path for compact display
        const parts = this.mappingFolderPath.split('\\');
        const shortPath = parts.length > 2 ? '..\\' + parts.slice(-2).join('\\') : this.mappingFolderPath;
        pathEl.textContent = shortPath;
        pathEl.title = this.mappingFolderPath;
      } else {
        pathEl.textContent = 'Select folder...';
        pathEl.title = 'Suggested: ' + this.defaultMappingPath;
      }
    }

    if (exportPathEl) {
      if (this.mappingFolderPath) {
        exportPathEl.textContent = this.mappingFolderPath;
      } else {
        exportPathEl.innerHTML = '<span style="color: var(--text-muted);">No folder selected</span><br><span style="font-size: 10px; color: var(--text-muted);">Suggested: ' + this.defaultMappingPath + '</span>';
      }
    }
  }

  initVisualizers() {
    const keyboardContainer = document.getElementById('keyboard-container');
    const gamepadContainer = document.getElementById('gamepad-container');
    const hotasContainer = document.getElementById('hotas-container');

    if (keyboardContainer) {
      this.keyboardViz = new KeyboardVisualizer(keyboardContainer, this.parser);
    }

    // Use image-based visualizers for gamepad and HOTAS
    if (gamepadContainer) {
      // Check if image-based visualizer is available
      if (typeof GamepadImageVisualizer !== 'undefined') {
        this.gamepadViz = new GamepadImageVisualizer(gamepadContainer, this.parser);
      } else if (typeof GamepadVisualizer !== 'undefined') {
        this.gamepadViz = new GamepadVisualizer(gamepadContainer, this.parser);
      }
    }

    if (hotasContainer) {
      // Check if image-based visualizer is available
      if (typeof HOTASImageVisualizer !== 'undefined') {
        this.hotasViz = new HOTASImageVisualizer(hotasContainer, this.parser);
      } else if (typeof HOTASVisualizer !== 'undefined') {
        this.hotasViz = new HOTASVisualizer(hotasContainer, this.parser);
      }
    }
  }

  setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchView(e.target.dataset.view);
      });
    });

    // Load file button
    document.getElementById('btn-load-file')?.addEventListener('click', () => {
      this.showFileLoadModal();
    });

    // Manual entry button
    document.getElementById('btn-manual-entry')?.addEventListener('click', () => {
      this.showManualEntryModal();
    });

    // File modal close
    document.getElementById('close-file-modal')?.addEventListener('click', () => {
      this.hideFileLoadModal();
    });

    // Manual modal close
    document.getElementById('close-manual-modal')?.addEventListener('click', () => {
      this.hideManualEntryModal();
    });

    // Browse file button
    document.getElementById('btn-browse-file')?.addEventListener('click', () => {
      this.browseForFile();
    });

    // Select mapping folder button
    document.getElementById('btn-select-folder')?.addEventListener('click', () => {
      this.selectMappingFolder();
    });

    // Export button
    document.getElementById('btn-export')?.addEventListener('click', () => {
      this.showExportModal();
    });

    // Export modal close
    document.getElementById('close-export-modal')?.addEventListener('click', () => {
      this.hideExportModal();
    });

    // Confirm export button
    document.getElementById('btn-confirm-export')?.addEventListener('click', () => {
      this.exportBindings();
    });

    // Add binding button
    document.getElementById('btn-add-binding')?.addEventListener('click', () => {
      this.addManualBinding();
    });

    // Manual key input - capture key presses
    const manualKeyInput = document.getElementById('manual-key');
    if (manualKeyInput) {
      manualKeyInput.addEventListener('keydown', (e) => {
        e.preventDefault();
        manualKeyInput.value = e.key.toUpperCase();
      });
    }

    // Search bindings
    document.getElementById('search-bindings')?.addEventListener('input', (e) => {
      this.filterBindings(e.target.value);
    });

    // Category selection
    document.querySelectorAll('.category-item').forEach(item => {
      item.addEventListener('click', (e) => {
        this.selectCategory(e.currentTarget.dataset.category);
      });
    });

    // Close modals on background click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    // Sidebar toggle
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      this.toggleSidebar();
    });

    // Device mapping modal
    document.getElementById('btn-device-mapping')?.addEventListener('click', () => {
      this.showDeviceMappingModal();
    });

    document.getElementById('close-device-mapping-modal')?.addEventListener('click', () => {
      this.hideDeviceMappingModal();
    });

    document.getElementById('btn-cancel-device-mapping')?.addEventListener('click', () => {
      this.hideDeviceMappingModal();
    });

    document.getElementById('btn-save-device-mapping')?.addEventListener('click', () => {
      this.saveDeviceMapping();
    });

    document.getElementById('btn-refresh-devices')?.addEventListener('click', () => {
      this.refreshDetectedDevices();
    });
  }

  setupNavigationListeners() {
    // Brand card clicks
    document.querySelectorAll('.brand-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectBrand(card.dataset.brand);
      });
    });

    // Back to brands button
    document.getElementById('back-to-brands')?.addEventListener('click', () => {
      this.showBrandSelection();
    });

    // Back to hardware button
    document.getElementById('back-to-hardware')?.addEventListener('click', () => {
      this.showHardwareSelection(this.selectedBrand);
    });
  }

  selectBrand(brandId) {
    this.selectedBrand = brandId;
    this.showHardwareSelection(brandId);
  }

  showBrandSelection() {
    this.selectedBrand = null;
    this.selectedHardware = null;
    this.switchView('brand');
  }

  showHardwareSelection(brandId) {
    const config = this.hardwareConfig[brandId];
    if (!config) return;

    // Update title
    const title = document.getElementById('hardware-title');
    if (title) {
      title.textContent = `Select ${config.name} Hardware`;
    }

    // Populate hardware grid
    const grid = document.getElementById('hardware-grid');
    if (grid) {
      grid.innerHTML = config.devices.map(device => `
        <div class="hardware-card" data-device="${device.id}">
          <div class="hardware-image">
            <img src="${device.image}" alt="${device.name}">
          </div>
          <div class="hardware-name">${device.name}</div>
        </div>
      `).join('');

      // Add click handlers for hardware cards
      grid.querySelectorAll('.hardware-card').forEach(card => {
        card.addEventListener('click', () => {
          this.selectHardware(card.dataset.device);
        });
      });
    }

    this.switchView('hardware');
  }

  selectHardware(deviceId) {
    this.selectedHardware = deviceId;

    // Update config title
    const title = document.getElementById('config-title');
    if (title) {
      const brandConfig = this.hardwareConfig[this.selectedBrand];
      const device = brandConfig?.devices.find(d => d.id === deviceId);
      if (device) {
        title.textContent = `Configure ${device.name}`;
      }
    }

    // Tell HOTAS visualizer which device to show
    if (this.hotasViz && this.hotasViz.setActiveDevice) {
      this.hotasViz.setActiveDevice(deviceId);
    }

    this.switchView('hotas');
  }

  setupDeviceMonitoring() {
    // Monitor gamepad connections using the browser Gamepad API
    window.addEventListener('gamepadconnected', (e) => {
      this.onDeviceConnected('gamepad', e.gamepad.id);
    });

    window.addEventListener('gamepaddisconnected', () => {
      this.onDeviceDisconnected('gamepad');
    });

    // Check for already connected gamepads
    const gamepads = navigator.getGamepads();
    for (const gamepad of gamepads) {
      if (gamepad) {
        this.onDeviceConnected('gamepad', gamepad.id);
        break;
      }
    }
  }

  onDeviceConnected(type, deviceName) {
    this.connectedDevices[type] = deviceName;
    this.updateDeviceIndicators();

    // Update SC joystick modal if it's open
    this.refreshScJoystickModalDevices();
  }

  onDeviceDisconnected(type) {
    this.connectedDevices[type] = null;
    this.updateDeviceIndicators();

    // Update SC joystick modal if it's open
    this.refreshScJoystickModalDevices();
  }

  /**
   * Refresh the device list in the SC joystick modal if it's currently open
   */
  refreshScJoystickModalDevices() {
    const modal = document.getElementById('sc-joystick-modal');
    if (!modal || !modal.classList.contains('active')) {
      return; // Modal not open, nothing to update
    }

    // Get current hardware list
    const currentHardware = this.detectCurrentHardware();
    this.currentHardwareList = currentHardware;

    // Save current selections before updating
    const currentSelections = [];
    const rows = document.querySelectorAll('.sc-mapping-row');
    rows.forEach((row, index) => {
      const jsSelect = row.querySelector('.sc-js-select');
      const deviceSelect = row.querySelector('.sc-device-select');
      currentSelections.push({
        jsValue: jsSelect?.value || '',
        deviceId: deviceSelect?.options[deviceSelect.selectedIndex]?.dataset?.deviceId || ''
      });
    });

    // Update each device dropdown with new hardware list
    rows.forEach((row, rowIndex) => {
      const deviceSelect = row.querySelector('.sc-device-select');
      if (!deviceSelect) return;

      const savedSelection = currentSelections[rowIndex];

      // Rebuild options
      let optionsHtml = '<option value="">-- Select Device --</option>';
      currentHardware.forEach(device => {
        const isSelected = savedSelection.deviceId === device.id;
        optionsHtml += `<option value="${device.index}" data-device-id="${device.id}" ${isSelected ? 'selected' : ''}>${device.name}</option>`;
      });

      deviceSelect.innerHTML = optionsHtml;
    });

    // Re-apply disabled states
    this.updateScDeviceSelects();

    // Show a status message
    this.updateStatus('Device list updated');
  }

  updateDeviceIndicators() {
    // Update gamepad indicator
    const gamepadIndicator = document.getElementById('indicator-gamepad');
    if (gamepadIndicator) {
      if (this.connectedDevices.gamepad) {
        gamepadIndicator.classList.remove('disconnected');
        gamepadIndicator.classList.add('connected');
        gamepadIndicator.title = this.connectedDevices.gamepad;
        const nameEl = gamepadIndicator.querySelector('.indicator-name');
        if (nameEl) {
          // Shorten the name if too long
          const shortName = this.connectedDevices.gamepad.split('(')[0].trim().substring(0, 15);
          nameEl.textContent = shortName || 'Gamepad';
        }
      } else {
        gamepadIndicator.classList.add('disconnected');
        gamepadIndicator.classList.remove('connected');
        gamepadIndicator.title = 'No gamepad connected';
        const nameEl = gamepadIndicator.querySelector('.indicator-name');
        if (nameEl) nameEl.textContent = 'Gamepad';
      }
    }

    // Update HOTAS indicator
    const hotasIndicator = document.getElementById('indicator-hotas');
    if (hotasIndicator) {
      if (this.connectedDevices.hotas) {
        hotasIndicator.classList.remove('disconnected');
        hotasIndicator.classList.add('connected');
        hotasIndicator.title = this.connectedDevices.hotas;
        const nameEl = hotasIndicator.querySelector('.indicator-name');
        if (nameEl) {
          const shortName = this.connectedDevices.hotas.split('(')[0].trim().substring(0, 15);
          nameEl.textContent = shortName || 'HOTAS';
        }
      } else {
        hotasIndicator.classList.add('disconnected');
        hotasIndicator.classList.remove('connected');
        hotasIndicator.title = 'No HOTAS connected';
        const nameEl = hotasIndicator.querySelector('.indicator-name');
        if (nameEl) nameEl.textContent = 'HOTAS';
      }
    }
  }

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');

    if (sidebar) {
      sidebar.classList.toggle('collapsed');

      // Update button title
      if (toggleBtn) {
        const isCollapsed = sidebar.classList.contains('collapsed');
        toggleBtn.title = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
      }

      // Save preference
      try {
        localStorage.setItem('sccm_sidebar_collapsed', sidebar.classList.contains('collapsed'));
      } catch (e) {
        console.error('Failed to save sidebar state:', e);
      }
    }
  }

  loadSidebarState() {
    try {
      const collapsed = localStorage.getItem('sccm_sidebar_collapsed') === 'true';
      const sidebar = document.getElementById('sidebar');
      const toggleBtn = document.getElementById('sidebar-toggle');

      if (collapsed && sidebar) {
        sidebar.classList.add('collapsed');
        if (toggleBtn) {
          toggleBtn.title = 'Expand sidebar';
        }
      }
    } catch (e) {
      console.error('Failed to load sidebar state:', e);
    }
  }

  switchView(view) {
    this.activeView = view;

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Update views
    document.querySelectorAll('.device-view').forEach(v => {
      v.classList.remove('active');
    });

    const viewElement = document.getElementById(`${view}-view`);
    if (viewElement) {
      viewElement.classList.add('active');
    }

    // Refresh the active visualizer
    this.refreshActiveVisualizer();
  }

  refreshActiveVisualizer() {
    switch (this.activeView) {
      case 'keyboard':
        this.keyboardViz?.refresh();
        break;
      case 'gamepad':
        this.gamepadViz?.refresh();
        break;
      case 'hotas':
        this.hotasViz?.refresh();
        break;
    }
  }

  async checkDefaultPaths() {
    try {
      const paths = await window.sccmAPI.getDefaultSCPaths();
      if (paths && paths.length > 0) {
        this.updateStatus(`Found ${paths.length} Star Citizen installation(s)`);
      }
    } catch (error) {
      console.error('Error checking default paths:', error);
    }
  }

  showFileLoadModal() {
    const modal = document.getElementById('file-load-modal');
    modal?.classList.add('active');
    this.loadDetectedPaths();
  }

  hideFileLoadModal() {
    document.getElementById('file-load-modal')?.classList.remove('active');
  }

  async loadDetectedPaths() {
    const pathsList = document.getElementById('paths-list');
    if (!pathsList) return;

    pathsList.innerHTML = '<p>Searching for Star Citizen installations...</p>';

    try {
      const paths = await window.sccmAPI.getDefaultSCPaths();

      if (paths.length === 0) {
        pathsList.innerHTML = '<p style="color: var(--text-muted);">No Star Citizen installations detected</p>';
        return;
      }

      let html = '';
      for (const pathInfo of paths) {
        const files = await window.sccmAPI.listXmlFiles(pathInfo.path);
        if (files.success && files.files.length > 0) {
          html += `
            <div class="detected-install">
              <div class="path-header">
                <span class="path-type">${pathInfo.type}</span>
                <span class="path-location">${pathInfo.path}</span>
              </div>
              <div class="path-files">
                ${files.files.map(f => `
                  <div class="path-item" data-path="${pathInfo.path}\\${f}">
                    <span>${f}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }
      }

      pathsList.innerHTML = html || '<p style="color: var(--text-muted);">No keybinding files found</p>';

      // Add click handlers for path items
      pathsList.querySelectorAll('.path-item').forEach(item => {
        item.addEventListener('click', () => {
          this.loadKeybindingFile(item.dataset.path);
        });
      });

    } catch (error) {
      console.error('Error loading paths:', error);
      pathsList.innerHTML = '<p style="color: var(--accent-danger);">Error detecting installations</p>';
    }
  }

  async browseForFile() {
    try {
      const filePath = await window.sccmAPI.openFileDialog();
      if (filePath) {
        await this.loadKeybindingFile(filePath);
      }
    } catch (error) {
      console.error('Error browsing for file:', error);
      this.updateStatus('Error opening file dialog');
    }
  }

  async loadKeybindingFile(filePath) {
    this.updateStatus('Loading keybinding file...');

    try {
      const result = await window.sccmAPI.parseKeybindingFile(filePath);

      if (!result.success) {
        this.updateStatus(`Error: ${result.error}`);
        return;
      }

      const parseResult = this.parser.parseXMLData(result.data);

      if (!parseResult.success) {
        this.updateStatus(`Parse error: ${parseResult.error}`);
        return;
      }

      // Update all visualizers
      this.refreshAllVisualizers();

      // Update category counts
      this.updateCategoryCounts();

      // Hide modal and update status
      this.hideFileLoadModal();
      this.updateStatus(`Loaded ${parseResult.bindingCount} bindings from file`);

    } catch (error) {
      console.error('Error loading file:', error);
      this.updateStatus('Error loading keybinding file');
    }
  }

  refreshAllVisualizers() {
    this.keyboardViz?.refresh();
    this.gamepadViz?.refresh();
    this.hotasViz?.refresh();
  }

  updateCategoryCounts() {
    const counts = this.parser.getCategoryCounts();

    document.querySelectorAll('.category-item').forEach(item => {
      const category = item.dataset.category;
      const countElement = item.querySelector('.category-count');
      if (countElement && counts[category] !== undefined) {
        countElement.textContent = counts[category];
      }
    });
  }

  showManualEntryModal() {
    document.getElementById('manual-entry-modal')?.classList.add('active');
    this.updateManualBindingsList();
  }

  hideManualEntryModal() {
    document.getElementById('manual-entry-modal')?.classList.remove('active');
  }

  addManualBinding() {
    const device = document.getElementById('manual-device')?.value;
    const key = document.getElementById('manual-key')?.value;
    const action = document.getElementById('manual-action')?.value;
    const category = document.getElementById('manual-category')?.value;

    if (!key || !action) {
      alert('Please enter both a key and an action');
      return;
    }

    const binding = this.parser.addManualBinding(device, key, action, category);
    this.manualBindings.push(binding);

    // Clear inputs
    document.getElementById('manual-key').value = '';
    document.getElementById('manual-action').value = '';

    // Update displays
    this.updateManualBindingsList();
    this.updateCategoryCounts();
    this.refreshAllVisualizers();

    this.updateStatus(`Added manual binding: ${key} -> ${action}`);
  }

  updateManualBindingsList() {
    const list = document.getElementById('added-bindings');
    if (!list) return;

    if (this.manualBindings.length === 0) {
      list.innerHTML = '<li style="color: var(--text-muted);">No manual bindings added</li>';
      return;
    }

    list.innerHTML = this.manualBindings.map((b, i) => `
      <li>
        <span class="binding-key">${b.key}</span>
        <span class="binding-action-name">${b.label}</span>
        <button class="remove-binding" data-index="${i}">&times;</button>
      </li>
    `).join('');

    // Add remove handlers
    list.querySelectorAll('.remove-binding').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeManualBinding(parseInt(btn.dataset.index));
      });
    });
  }

  removeManualBinding(index) {
    const binding = this.manualBindings[index];
    if (binding) {
      this.parser.removeManualBinding(binding.key, binding.action);
      this.manualBindings.splice(index, 1);
      this.updateManualBindingsList();
      this.updateCategoryCounts();
      this.refreshAllVisualizers();
    }
  }

  selectCategory(category) {
    // Update UI
    document.querySelectorAll('.category-item').forEach(item => {
      item.classList.toggle('active', item.dataset.category === category);
    });

    // Filter visualizers by category (implementation depends on visualizer support)
    this.keyboardViz?.setCategory(category);
    this.gamepadViz?.setCategory?.(category);
    this.hotasViz?.setCategory?.(category);
  }

  filterBindings(searchTerm) {
    // This would filter the displayed bindings based on search
    // Implementation depends on how you want to display filtered results
    console.log('Filtering bindings:', searchTerm);
  }

  updateStatus(message) {
    const statusText = document.getElementById('status-text');
    if (statusText) {
      statusText.textContent = message;
    }
  }

  updateStatusInfo(info) {
    const statusInfo = document.getElementById('status-info');
    if (statusInfo) {
      statusInfo.textContent = info;
    }
  }

  async selectMappingFolder() {
    try {
      const folderPath = await window.sccmAPI.openFolderDialog();
      if (folderPath) {
        this.mappingFolderPath = folderPath;
        this.saveMappingFolderPath();
        this.updateMappingPathDisplay();
        this.updateStatus(`Mapping folder set: ${folderPath}`);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      this.updateStatus('Error selecting folder');
    }
  }

  showExportModal() {
    const modal = document.getElementById('export-modal');
    const filenameInput = document.getElementById('export-filename');

    // Pre-fill with loaded filename if available
    if (filenameInput) {
      if (this.loadedFileName) {
        // Remove .xml extension if present
        const name = this.loadedFileName.replace(/\.xml$/i, '');
        filenameInput.value = name;
      } else {
        filenameInput.value = 'layout_custom_bindings';
      }
    }

    // Update export path display
    this.updateMappingPathDisplay();

    modal?.classList.add('active');
  }

  hideExportModal() {
    document.getElementById('export-modal')?.classList.remove('active');
  }

  async exportBindings() {
    const filenameInput = document.getElementById('export-filename');
    let filename = filenameInput?.value?.trim() || 'layout_custom_bindings';

    // Ensure .xml extension
    if (!filename.toLowerCase().endsWith('.xml')) {
      filename += '.xml';
    }

    if (!this.mappingFolderPath) {
      alert('Please select a mapping folder first');
      return;
    }

    // Get custom bindings from HOTAS visualizer
    const customBindings = this.hotasViz?.customBindings || {};

    if (Object.keys(customBindings).length === 0) {
      alert('No custom bindings to export');
      return;
    }

    try {
      // Generate XML content
      const xmlContent = this.generateBindingsXML(customBindings);

      // Save file
      const fullPath = this.mappingFolderPath + '\\' + filename;
      const result = await window.sccmAPI.saveFile(fullPath, xmlContent);

      if (result.success) {
        this.hideExportModal();
        this.updateStatus(`Exported bindings to: ${filename}`);
      } else {
        alert('Failed to save file: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error exporting bindings:', error);
      alert('Error exporting bindings: ' + error.message);
    }
  }

  generateBindingsXML(customBindings) {
    // Generate Star Citizen compatible XML format
    // Based on the actual SC export format from layout_kringer_exported.xml

    // Device configuration - maps our internal device prefixes to SC joystick instances
    // Users need to match these to their actual device order in SC
    const deviceConfig = this.getDeviceConfiguration();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<ActionMaps version="1" optionsVersion="2" rebindVersion="2" profileName="flycon_custom">\n';

    // CustomisationUIHeader with device declarations
    xml += ' <CustomisationUIHeader label="flycon_custom" description="Generated by Flycon - Flight Control Mapper" image="">\n';
    xml += '  <devices>\n';
    xml += '   <keyboard instance="1"/>\n';
    xml += '   <mouse instance="1"/>\n';

    // Add joystick instances based on configured devices
    const usedInstances = new Set();
    Object.values(deviceConfig).forEach(config => {
      if (!usedInstances.has(config.instance)) {
        usedInstances.add(config.instance);
      }
    });
    const sortedInstances = Array.from(usedInstances).sort((a, b) => a - b);
    sortedInstances.forEach(instance => {
      xml += `   <joystick instance="${instance}"/>\n`;
    });

    xml += '  </devices>\n';
    xml += '  <categories>\n';
    xml += '   <category label="@ui_CCSpaceFlight"/>\n';
    xml += '   <category label="@ui_CCVehicle"/>\n';
    xml += '  </categories>\n';
    xml += ' </CustomisationUIHeader>\n';

    // Device options - declare each joystick with its product name
    xml += ' <options type="keyboard" instance="1" Product="Keyboard  {6F1D2B61-D5A0-11CF-BFC7-444553540000}"/>\n';

    Object.entries(deviceConfig).forEach(([prefix, config]) => {
      xml += ` <options type="joystick" instance="${config.instance}" Product="${config.product}"/>\n`;
    });

    xml += ' <modifiers />\n';

    // SC action maps - organize bindings by their proper category
    const actionMaps = {
      'spaceship_general': [],
      'spaceship_view': [],
      'spaceship_movement': [],
      'spaceship_targeting': [],
      'spaceship_target_hailing': [],
      'spaceship_mining': [],
      'spaceship_salvage': [],
      'spaceship_missiles': [],
      'spaceship_defensive': [],
      'spaceship_power': [],
      'spaceship_radar': [],
      'spaceship_hud': [],
      'turret_main': [],
      'turret_movement': [],
      'vehicle_general': [],
      'vehicle_driver': [],
      'player_choice': [],
      'player_input_optical_tracking': []
    };

    // Process each custom binding
    for (const [key, action] of Object.entries(customBindings)) {
      if (!action) continue;

      // Strip mode prefixes if present - we don't add keyboard modifiers to XML output
      let actualKey = key;

      // Check for X56 mode prefix (m1_, m2_, s1_)
      const x56ModeMatch = key.match(/^(m1|m2|s1)_(.+)$/);
      // Check for X52 mode prefix (mode1_, mode2_, mode3_)
      const x52ModeMatch = key.match(/^(mode1|mode2|mode3)_(.+)$/);

      if (x56ModeMatch) {
        actualKey = x56ModeMatch[2];
      } else if (x52ModeMatch) {
        actualKey = x52ModeMatch[2];
      }

      // Parse the binding key to get device and button info
      const bindingInfo = this.parseBindingKey(actualKey, deviceConfig);
      if (!bindingInfo) continue;

      // Build the input string - no keyboard modifiers, just the joystick input
      let inputStr = bindingInfo.input;

      // Determine which actionmap this action belongs to
      const actionMap = this.getActionMapForAction(action);

      // Add to appropriate actionmap
      if (actionMaps[actionMap]) {
        actionMaps[actionMap].push({
          action: action,
          input: inputStr,
          activationMode: bindingInfo.activationMode
        });
      }
    }

    // Generate XML for each actionmap that has bindings
    // Group bindings by action to allow multiple inputs per action (e.g., same axis from multiple devices)
    for (const [mapName, bindings] of Object.entries(actionMaps)) {
      if (bindings.length === 0) continue;

      // Group bindings by action name
      const actionGroups = {};
      for (const binding of bindings) {
        if (!actionGroups[binding.action]) {
          actionGroups[binding.action] = [];
        }
        actionGroups[binding.action].push(binding);
      }

      xml += ` <actionmap name="${mapName}">\n`;
      for (const [actionName, actionBindings] of Object.entries(actionGroups)) {
        xml += `  <action name="${actionName}">\n`;
        // Output all rebinds for this action (supports multiple inputs from different devices)
        for (const binding of actionBindings) {
          if (binding.activationMode) {
            xml += `   <rebind input="${binding.input}" activationMode="${binding.activationMode}"/>\n`;
          } else {
            xml += `   <rebind input="${binding.input}"/>\n`;
          }
        }
        xml += `  </action>\n`;
      }
      xml += ` </actionmap>\n`;
    }

    xml += '</ActionMaps>\n';

    return xml;
  }

  /**
   * Get device configuration mapping internal prefixes to SC joystick instances
   * Loads user-configured mappings from localStorage, with defaults as fallback
   */
  getDeviceConfiguration() {
    // Load saved device mapping configuration
    const savedConfig = this.loadDeviceMappingConfig();

    // Default product names for each device type
    const productNames = {
      'x56_js': 'Saitek Pro Flight X-56 Rhino Stick  {GUID}',
      'x56_th': 'Saitek Pro Flight X-56 Rhino Throttle  {GUID}',
      'x52_js': 'Saitek X52 Pro Flight Control System  {GUID}',
      'x52_th': 'Saitek X52 Pro Flight Control System  {GUID}',
      'vkb_r': 'VKBsim Gladiator EVO R  {GUID}',
      'vkb_l': 'VKBsim Gladiator EVO L  {GUID}',
      'ab9': 'MOZA AB9 FFB Base  {GUID}',
      'yoke': 'Logitech Flight Yoke System  {GUID}',
      'throttle_quadrant': 'Logitech Flight Throttle Quadrant  {GUID}'
    };

    // Build configuration with user-set instances or defaults
    return {
      'x56_js': {
        instance: savedConfig.stickSlot || 1,
        product: savedConfig.detectedDevices?.['x56_js'] || productNames['x56_js'],
        type: 'stick'
      },
      'x56_th': {
        instance: savedConfig.throttleSlot || 2,
        product: savedConfig.detectedDevices?.['x56_th'] || productNames['x56_th'],
        type: 'throttle'
      },
      'x52_js': {
        instance: savedConfig.stickSlot || 1,
        product: savedConfig.detectedDevices?.['x52_js'] || productNames['x52_js'],
        type: 'stick'
      },
      'x52_th': {
        instance: savedConfig.throttleSlot || 2,
        product: savedConfig.detectedDevices?.['x52_th'] || productNames['x52_th'],
        type: 'throttle'
      },
      'vkb_r': {
        instance: savedConfig.vkbRSlot || 1,
        product: savedConfig.detectedDevices?.['vkb_r'] || productNames['vkb_r'],
        type: 'stick'
      },
      'vkb_l': {
        instance: savedConfig.vkbLSlot || 2,
        product: savedConfig.detectedDevices?.['vkb_l'] || productNames['vkb_l'],
        type: 'stick'
      },
      'ab9': {
        instance: savedConfig.ab9Slot || 1,
        product: savedConfig.detectedDevices?.['ab9'] || productNames['ab9'],
        type: 'stick'
      },
      'yoke': {
        instance: savedConfig.stickSlot || 1,
        product: savedConfig.detectedDevices?.['yoke'] || productNames['yoke'],
        type: 'yoke'
      },
      'throttle_quadrant': {
        instance: savedConfig.throttleSlot || 2,
        product: savedConfig.detectedDevices?.['throttle_quadrant'] || productNames['throttle_quadrant'],
        type: 'throttle'
      }
    };
  }

  /**
   * Load device mapping configuration from localStorage
   */
  loadDeviceMappingConfig() {
    try {
      const saved = localStorage.getItem('flycon_device_mapping');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load device mapping config:', e);
    }
    // Return default configuration
    return {
      stickSlot: 1,
      throttleSlot: 2,
      vkbRSlot: 1,
      vkbLSlot: 2,
      ab9Slot: 1,
      detectedDevices: {}
    };
  }

  /**
   * Save device mapping configuration to localStorage
   */
  saveDeviceMappingConfig(config) {
    try {
      localStorage.setItem('flycon_device_mapping', JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save device mapping config:', e);
    }
  }

  /**
   * Show the device mapping modal
   */
  showDeviceMappingModal() {
    const modal = document.getElementById('device-mapping-modal');
    if (!modal) return;

    // Load current configuration into the form
    const config = this.loadDeviceMappingConfig();

    // Set Flycon device slot dropdowns
    const stickSlot = document.getElementById('flycon-stick-slot');
    const throttleSlot = document.getElementById('flycon-throttle-slot');
    const vkbRSlot = document.getElementById('flycon-vkb-r-slot');
    const vkbLSlot = document.getElementById('flycon-vkb-l-slot');
    const ab9Slot = document.getElementById('flycon-ab9-slot');

    if (stickSlot) stickSlot.value = config.stickSlot || '1';
    if (throttleSlot) throttleSlot.value = config.throttleSlot || '2';
    if (vkbRSlot) vkbRSlot.value = config.vkbRSlot || '1';
    if (vkbLSlot) vkbLSlot.value = config.vkbLSlot || '2';
    if (ab9Slot) ab9Slot.value = config.ab9Slot || '1';

    // Refresh detected devices
    this.refreshDetectedDevices();

    modal.classList.add('active');
  }

  /**
   * Hide the device mapping modal
   */
  hideDeviceMappingModal() {
    document.getElementById('device-mapping-modal')?.classList.remove('active');
  }

  /**
   * Refresh the list of detected USB controllers
   */
  refreshDetectedDevices() {
    const listContainer = document.getElementById('detected-devices-list');
    if (!listContainer) return;

    // Get connected gamepads
    const gamepads = navigator.getGamepads();
    const connectedDevices = [];

    for (const gamepad of gamepads) {
      if (gamepad && gamepad.connected) {
        connectedDevices.push({
          index: gamepad.index,
          id: gamepad.id,
          buttons: gamepad.buttons.length,
          axes: gamepad.axes.length
        });
      }
    }

    if (connectedDevices.length === 0) {
      listContainer.innerHTML = '<p class="no-devices">No controllers detected. Connect a controller and press a button to detect it.</p>';
    } else {
      listContainer.innerHTML = connectedDevices.map((device, idx) => `
        <div class="detected-device-item" data-index="${device.index}">
          <div class="device-item-info">
            <span class="device-item-name">${this.getShortDeviceName(device.id)}</span>
            <span class="device-item-id">Index: ${device.index} | Buttons: ${device.buttons} | Axes: ${device.axes}</span>
          </div>
          <div class="device-item-status">
            <span class="status-dot"></span>
            <span>Connected</span>
          </div>
        </div>
      `).join('');
    }

    // Also update the slot select dropdowns with detected devices
    this.updateSlotDropdowns(connectedDevices);
  }

  /**
   * Get a shortened device name for display
   */
  getShortDeviceName(fullId) {
    // Extract the product name from gamepad id (format varies by browser)
    // e.g., "Saitek Pro Flight X-56 Rhino Throttle (Vendor: 0738 Product: 2221)"
    const match = fullId.match(/^([^(]+)/);
    return match ? match[1].trim() : fullId;
  }

  /**
   * Update the slot dropdown options with detected devices
   */
  updateSlotDropdowns(connectedDevices) {
    const slotSelects = document.querySelectorAll('.device-slot-select');

    slotSelects.forEach(select => {
      // Keep the "Not Assigned" option
      const currentValue = select.value;
      select.innerHTML = '<option value="">-- Not Assigned --</option>';

      // Add connected devices as options
      connectedDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.index;
        option.textContent = `${this.getShortDeviceName(device.id)} (Index ${device.index})`;
        select.appendChild(option);
      });

      // Restore previous selection if still valid
      if (currentValue) {
        select.value = currentValue;
      }
    });
  }

  /**
   * Save the device mapping configuration from the modal
   */
  saveDeviceMapping() {
    // Get Flycon device slot selections
    const stickSlot = parseInt(document.getElementById('flycon-stick-slot')?.value) || 1;
    const throttleSlot = parseInt(document.getElementById('flycon-throttle-slot')?.value) || 2;
    const vkbRSlot = parseInt(document.getElementById('flycon-vkb-r-slot')?.value) || 1;
    const vkbLSlot = parseInt(document.getElementById('flycon-vkb-l-slot')?.value) || 2;
    const ab9Slot = parseInt(document.getElementById('flycon-ab9-slot')?.value) || 1;

    // Get detected device assignments to slots
    const detectedDevices = {};
    for (let i = 1; i <= 4; i++) {
      const slotSelect = document.getElementById(`device-slot-${i}`);
      if (slotSelect && slotSelect.value) {
        const deviceIndex = parseInt(slotSelect.value);
        const gamepads = navigator.getGamepads();
        const gamepad = gamepads[deviceIndex];
        if (gamepad) {
          // Store the full device name for XML export
          detectedDevices[`js${i}`] = gamepad.id;
        }
      }
    }

    const config = {
      stickSlot,
      throttleSlot,
      vkbRSlot,
      vkbLSlot,
      ab9Slot,
      detectedDevices
    };

    this.saveDeviceMappingConfig(config);
    this.hideDeviceMappingModal();
    this.updateStatus('Controller configuration saved');
  }

  /**
   * Parse a binding key into device prefix, button name, and SC input format
   */
  parseBindingKey(bindingKey, deviceConfig) {
    const parts = bindingKey.split('_');
    if (parts.length < 2) return null;

    // Handle compound directions like "sw3_up", "sw1_up", etc.
    // Check if second-to-last part is a switch indicator (sw1, sw2, etc.)
    let direction;
    if (parts.length >= 2 && /^sw\d$/.test(parts[parts.length - 2]) && ['up', 'down'].includes(parts[parts.length - 1])) {
      // Compound direction: sw3_up, sw1_up, etc.
      direction = parts.slice(-2).join('_');
      parts.splice(-2);
    } else {
      // Simple direction: up, down, action, press, etc.
      direction = parts.pop();
    }

    let devicePrefix;
    let buttonName;

    // Determine device prefix based on key structure
    if (parts[0] === 'vkb' && (parts[1] === 'l' || parts[1] === 'r')) {
      devicePrefix = `vkb_${parts[1]}`;
      buttonName = parts.slice(2).join('_');
    } else if (parts[0] === 'x56' && (parts[1] === 'th' || parts[1] === 'js')) {
      devicePrefix = `x56_${parts[1]}`;
      buttonName = parts.slice(2).join('_');
    } else if (parts[0] === 'x52' && (parts[1] === 'th' || parts[1] === 'js')) {
      devicePrefix = `x52_${parts[1]}`;
      buttonName = parts.slice(2).join('_');
    } else if (parts[0] === 'ab9') {
      devicePrefix = 'ab9';
      buttonName = parts.slice(1).join('_');
    } else if (parts[0] === 'yoke') {
      devicePrefix = 'yoke';
      buttonName = parts.slice(1).join('_');
    } else if (parts[0] === 'throttle') {
      devicePrefix = 'throttle_quadrant';
      buttonName = parts.slice(1).join('_');
    } else {
      // Unknown device
      return null;
    }

    const config = deviceConfig[devicePrefix];
    if (!config) return null;

    const jsPrefix = `js${config.instance}`;

    // Map to SC input format
    const inputResult = this.mapToSCInput(buttonName, direction, devicePrefix);

    // Replace js1/js2 placeholder with actual instance
    const input = inputResult.replace(/^js\d+/, jsPrefix);

    // Determine if this needs activationMode="press"
    let activationMode = null;
    if (direction === 'press' || buttonName.includes('self_destruct') || buttonName.includes('eject')) {
      activationMode = 'press';
    }

    return { input, activationMode };
  }

  /**
   * Determine which SC actionmap an action belongs to
   */
  getActionMapForAction(action) {
    // Flight movement actions
    if (['v_pitch', 'v_yaw', 'v_roll', 'v_strafe_up', 'v_strafe_down', 'v_strafe_left', 'v_strafe_right',
         'v_strafe_forward', 'v_strafe_back', 'v_strafe_vertical', 'v_strafe_lateral', 'v_strafe_longitudinal',
         'v_strafe_longitudinal_invert', 'v_afterburner', 'v_boost', 'v_brake', 'v_toggle_landing_system',
         'v_deploy_landing_system', 'v_autoland', 'v_ifcs_toggle_gforce_safety', 'v_ifcs_toggle_esp',
         'v_ifcs_toggle_cruise_control', 'v_ifcs_toggle_vector_decoupling', 'v_speed_range_up',
         'v_speed_range_down', 'v_toggle_vtol', 'v_match_target_velocity'].includes(action)) {
      return 'spaceship_movement';
    }

    // General spaceship actions
    if (['v_flightready', 'v_self_destruct', 'v_toggle_all_doorlocks', 'v_toggle_all_doors',
         'v_lock_all_doors', 'v_unlock_all_doors', 'v_eject', 'v_lights'].includes(action)) {
      return 'spaceship_general';
    }

    // View actions
    if (action.includes('v_view_') || action.includes('headlook') || action.includes('freelook')) {
      return 'spaceship_view';
    }

    // Targeting actions
    if (action.includes('v_target')) {
      return 'spaceship_targeting';
    }

    // Mining actions
    if (action.includes('mining')) {
      return 'spaceship_mining';
    }

    // Salvage actions
    if (action.includes('salvage')) {
      return 'spaceship_salvage';
    }

    // Missile actions
    if (action.includes('missile')) {
      return 'spaceship_missiles';
    }

    // Defensive actions (countermeasures, shields)
    if (action.includes('countermeasure') || action.includes('shield')) {
      return 'spaceship_defensive';
    }

    // Power actions
    if (action.includes('power')) {
      return 'spaceship_power';
    }

    // Weapon/attack actions
    if (action.includes('attack') || action.includes('weapon')) {
      return 'spaceship_targeting'; // Weapons are often under targeting in SC
    }

    // Radar/scanning
    if (action.includes('radar') || action.includes('scan')) {
      return 'spaceship_radar';
    }

    // Vehicle actions
    if (action.startsWith('vehicle_') || action.includes('v_horn') || action.includes('v_brake')) {
      return 'vehicle_driver';
    }

    // Player/interaction actions
    if (action.includes('focus') || action.includes('interact')) {
      return 'player_choice';
    }

    // Default to spaceship_movement for unknown v_ actions
    if (action.startsWith('v_')) {
      return 'spaceship_movement';
    }

    return 'spaceship_general';
  }

  mapToSCInput(buttonName, direction, devicePrefix = '') {
    // Map button names to SC joystick input format based on device

    // VKB Left mappings (js2 - left hand stick)
    // Windows Button Mapping:
    // Button 1: Trigger Stage 1, Button 2: Trigger Stage 2
    // Button 3: A2 Top Red, Button 4: A3 Center Hat Press (Top Black)
    // Button 5: B1 Side Button, Button 6: (unused), Button 7: D1 Pinky
    // Button 12: F2 Encoder Press, Button 13: A1 Mini-stick Press
    // Hats: C1 Thumb Hat, A3 Center Hat (directions), A4 Top Hat
    if (devicePrefix === 'vkb_l') {
      const vkbLeftMap = {
        // Trigger (2-stage)
        'trigger': direction === 'stage1' ? 'js2_button1' : 'js2_button2',
        // Top buttons
        'a2_red': 'js2_button3',           // A2 Top Red Button
        'a3_center_hat': direction === 'press' ? 'js2_button4' : this.mapHatDirection('js2_hat2', direction),
        // Side buttons
        'b1_side': 'js2_button5',          // B1 Side Button
        'd1_pinky': 'js2_button7',         // D1 Pinky Button
        // Encoder
        'f2': direction === 'press' ? 'js2_button12' : (direction === 'cw' ? 'js2_button14' : 'js2_button15'),
        // Mini-stick
        'a1_ministick': direction === 'press' ? 'js2_button13' : this.mapHatDirection('js2_hat3', direction),
        // Hats
        'c1_thumb_hat': this.mapHatDirection('js2_hat1', direction),
        'a4_top_hat': this.mapHatDirection('js2_hat4', direction),
        // Base controls
        'base_switch': 'js2_button8',
        'f1': 'js2_button9',
        'f3': 'js2_button10',
        // Axes - use x/y/rotz format (not pitch/roll/yaw)
        'x_axis': 'js2_x',
        'y_axis': 'js2_y',
        'twist': 'js2_rotz',
        'pitch': 'js2_y',
        'roll': 'js2_x',
        'yaw': 'js2_rotz'
      };
      return vkbLeftMap[buttonName] || `js2_${buttonName}`;
    }

    // VKB Right mappings (js1 - right hand stick)
    // Same button mapping as left but on js1
    if (devicePrefix === 'vkb_r') {
      const vkbRightMap = {
        // Trigger (2-stage)
        'trigger': direction === 'stage1' ? 'js1_button1' : 'js1_button2',
        // Top buttons
        'a2_red': 'js1_button3',           // A2 Top Red Button
        'a3_center_hat': direction === 'press' ? 'js1_button4' : this.mapHatDirection('js1_hat2', direction),
        // Side buttons
        'b1_side': 'js1_button5',          // B1 Side Button
        'd1_pinky': 'js1_button7',         // D1 Pinky Button
        // Encoder
        'f2': direction === 'press' ? 'js1_button12' : (direction === 'cw' ? 'js1_button14' : 'js1_button15'),
        // Mini-stick
        'a1_ministick': direction === 'press' ? 'js1_button13' : this.mapHatDirection('js1_hat3', direction),
        // Hats
        'c1_thumb_hat': this.mapHatDirection('js1_hat1', direction),
        'a4_top_hat': this.mapHatDirection('js1_hat4', direction),
        // Base controls
        'base_switch': 'js1_button8',
        'f1': 'js1_button9',
        'f3': 'js1_button10',
        // Axes - use x/y/rotz format (not pitch/roll/yaw)
        'x_axis': 'js1_x',
        'y_axis': 'js1_y',
        'twist': 'js1_rotz',
        'pitch': 'js1_y',
        'roll': 'js1_x',
        'yaw': 'js1_rotz'
      };
      return vkbRightMap[buttonName] || `js1_${buttonName}`;
    }

    // X56 Throttle mappings
    // Windows button numbers (1-based) for X56 Throttle:
    // TGL1: Up=15, Down=16 | TGL2: Up=17, Down=14 | TGL3: Up=19, Down=20 | TGL4: Up=18, Down=21
    // SW1=5, SW2=6, SW3=7, SW4=8, SW5=9, SW6=10
    // Thumb button=11, Index button (H)=12, Middle button (I)=13
    // Pinky Encoder: Up=27, Down=28, Press=29 | Pinky Up=25, Pinky Down=26
    // Rear ministick: Hat directions + Press=22
    // Thumb ministick: Hat directions + Press=23
    // Thumb D-pad: Hat directions + Press=24
    if (devicePrefix === 'x56_th') {
      const x56ThrottleMap = {
        'tgl1': direction === 'up' ? 'js2_button15' : 'js2_button16',
        'tgl2': direction === 'up' ? 'js2_button17' : 'js2_button14',
        'tgl3': direction === 'up' ? 'js2_button19' : 'js2_button20',
        'tgl4': direction === 'up' ? 'js2_button18' : 'js2_button21',
        'sw1_sw2': direction === 'sw1_up' ? 'js2_button5' : 'js2_button6',
        'sw3_sw4': direction === 'sw3_up' ? 'js2_button7' : 'js2_button8',
        'sw5_sw6': direction === 'sw5_up' ? 'js2_button9' : 'js2_button10',
        'thumb_btn': 'js2_button11',
        'index_btn': 'js2_button12',
        'middle_btn': 'js2_button13',
        'pinky_up': 'js2_button25',
        'pinky_down': 'js2_button26',
        'pinky_encoder': direction === 'up' ? 'js2_button27' : (direction === 'down' ? 'js2_button28' : 'js2_button29'),
        'rear_ministick': direction === 'press' ? 'js2_button22' : this.mapHatDirection('js2_hat1', direction),
        'thumb_ministick': direction === 'press' ? 'js2_button23' : this.mapHatDirection('js2_hat2', direction),
        'thumb_dpad': direction === 'press' ? 'js2_button24' : this.mapHatDirection('js2_hat3', direction)
      };
      return x56ThrottleMap[buttonName] || `js2_${buttonName}`;
    }

    // X56 Stick mappings
    if (devicePrefix === 'x56_js') {
      const x56StickMap = {
        'trigger': direction === 'stage1' ? 'js1_button1' : 'js1_button2',
        'missile_btn': 'js1_button3',
        'thumb_hat': this.mapHatDirection('js1_hat1', direction),
        'thumb_dpad': this.mapHatDirection('js1_hat2', direction),
        'thumb_funky': this.mapHatDirection('js1_hat3', direction),
        'pinky_switch': direction === 'up' ? 'js1_button4' : 'js1_button5'
      };
      return x56StickMap[buttonName] || `js1_${buttonName}`;
    }

    // X52 Throttle mappings (js2)
    if (devicePrefix === 'x52_th') {
      const x52ThrottleMap = {
        'select': direction === 'press' ? 'js2_button1' : (direction === 'scroll_up' ? 'js2_button2' : 'js2_button3'),
        'dpad': this.mapHatDirection('js2_hat1', direction),
        'thumb': 'js2_button4',
        'front_dpad': this.mapHatDirection('js2_hat2', direction),
        'rt1': 'js2_rotz',
        'rt2': 'js2_slider',
        't1_t2': direction === 't1' ? 'js2_button5' : 'js2_button6',
        't3_t4': direction === 't3' ? 'js2_button7' : 'js2_button8',
        't5_t6': direction === 't5' ? 'js2_button9' : 'js2_button10'
      };
      return x52ThrottleMap[buttonName] || `js2_${buttonName}`;
    }

    // X52 Stick mappings (js1)
    if (devicePrefix === 'x52_js') {
      const x52StickMap = {
        'thumb_hat': this.mapHatDirection('js1_hat1', direction),
        'a_btn': 'js1_button1',
        'b_btn': 'js1_button2',
        'c_btn': 'js1_button3',
        'fire': 'js1_button4',
        'thumb_dpad': this.mapHatDirection('js1_hat2', direction),
        'scroll': direction === 'scroll_up' ? 'js1_button5' : 'js1_button6',
        'trigger': direction === 'stage1' ? 'js1_button7' : 'js1_button8',
        'pinky_switch': 'js1_button9'
      };
      return x52StickMap[buttonName] || `js1_${buttonName}`;
    }

    // AB9 Flight Stick mappings
    if (devicePrefix === 'ab9') {
      const ab9Map = {
        'trigger': 'js1_button1',
        'index_btn': 'js1_button2',
        'thumb_missile': 'js1_button3',
        'pinky_btn': 'js1_button4',
        'pinky_switch': 'js1_button5',
        'top_rocker': direction === 'forward' ? 'js1_button6' : 'js1_button7',
        'bottom_rocker': direction === 'forward' ? 'js1_button8' : 'js1_button9',
        'thumb_hat': this.mapHatDirection('js1_hat1', direction),
        'top_dpad': this.mapHatDirection('js1_hat2', direction),
        'bottom_dpad': this.mapHatDirection('js1_hat3', direction),
        'funky_knob': 'js1_rotz',
        // Axes - use x/y/rotz format (not pitch/roll/yaw)
        'x_axis': 'js1_x',
        'y_axis': 'js1_y',
        'pitch': 'js1_y',
        'roll': 'js1_x',
        'yaw': 'js1_rotz'
      };
      return ab9Map[buttonName] || `js1_${buttonName}`;
    }

    // Default/legacy mappings (for backwards compatibility)
    const buttonMap = {
      'trigger': 'js1_button1',
      'index_btn': 'js1_button2',
      'thumb_missile': 'js1_button3',
      'pinky_btn': 'js1_button4',
      'pinky_switch': 'js1_button5',
      'top_rocker': direction === 'forward' ? 'js1_button6' : 'js1_button7',
      'bottom_rocker': direction === 'forward' ? 'js1_button8' : 'js1_button9',
      'thumb_hat': this.mapHatDirection('js1_hat1', direction),
      'top_dpad': this.mapHatDirection('js1_hat2', direction),
      'bottom_dpad': this.mapHatDirection('js1_hat3', direction),
      'funky_knob': 'js1_rotz',
      'x_axis': 'js1_x',
      'y_axis': 'js1_y'
    };

    return buttonMap[buttonName] || `js1_${buttonName}`;
  }

  mapHatDirection(hatBase, direction) {
    const dirMap = {
      'up': '_up',
      'down': '_down',
      'left': '_left',
      'right': '_right',
      'diag_up_left': '_up',
      'diag_up_right': '_up',
      'diag_down_left': '_down',
      'diag_down_right': '_down',
      'action': ''
    };
    return hatBase + (dirMap[direction] || '');
  }

  // ===== Star Citizen Joystick Mapping Modal Methods =====

  /**
   * Handle game selection - show appropriate setup modal
   */
  handleGameSelection(newGame) {
    if (newGame === 'star-citizen') {
      // Check if joystick mappings are already configured
      const savedMappings = this.loadJoystickMappings();
      if (!savedMappings || Object.keys(savedMappings).length === 0) {
        // Show the Star Citizen joystick mapping modal
        this.pendingGameSwitch = newGame;
        this.showStarCitizenJoystickModal();
      } else {
        // Already configured, just switch
        this.switchGame(newGame);
      }
    } else {
      // For other games, just switch directly
      this.switchGame(newGame);
    }
  }

  /**
   * Setup Star Citizen joystick mapping modal event listeners
   */
  setupStarCitizenJoystickModal() {
    // Copy command button
    document.getElementById('btn-copy-sc-command')?.addEventListener('click', () => {
      this.copyScCommand();
    });

    // Close button
    document.getElementById('close-sc-joystick-modal')?.addEventListener('click', () => {
      this.hideStarCitizenJoystickModal();
    });

    // Skip button
    document.getElementById('btn-sc-skip')?.addEventListener('click', () => {
      this.hideStarCitizenJoystickModal();
      if (this.pendingGameSwitch) {
        this.switchGame(this.pendingGameSwitch);
        this.pendingGameSwitch = null;
      }
    });

    // Save button
    document.getElementById('btn-sc-save')?.addEventListener('click', () => {
      this.saveStarCitizenJoystickMappings();
    });

    // Settings icon button (to reopen modal for adjustments)
    document.getElementById('sc-joystick-settings-btn')?.addEventListener('click', () => {
      this.showStarCitizenJoystickModal();
    });
  }

  /**
   * Copy the i_DumpDeviceInformation command to clipboard
   */
  copyScCommand() {
    const command = 'i_DumpDeviceInformation';
    navigator.clipboard.writeText(command).then(() => {
      const btn = document.getElementById('btn-copy-sc-command');
      if (btn) {
        btn.classList.add('copied');
        btn.querySelector('.copy-text').textContent = 'Copied!';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.querySelector('.copy-text').textContent = 'Copy';
        }, 2000);
      }
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  }

  /**
   * Show the Star Citizen joystick mapping modal
   */
  showStarCitizenJoystickModal() {
    const modal = document.getElementById('sc-joystick-modal');
    if (!modal) return;

    // Populate the mapping list with connected devices
    this.populateScJoystickMappings();

    modal.classList.add('active');
  }

  /**
   * Hide the Star Citizen joystick mapping modal
   */
  hideStarCitizenJoystickModal() {
    document.getElementById('sc-joystick-modal')?.classList.remove('active');
  }

  /**
   * Populate the joystick mapping dropdowns
   */
  populateScJoystickMappings() {
    const listContainer = document.getElementById('sc-mapping-list');
    if (!listContainer) return;

    const currentHardware = this.detectCurrentHardware();
    const savedMappings = this.loadJoystickMappings();

    // Store current hardware for later use
    this.currentHardwareList = currentHardware;

    // Determine how many rows to show based on saved mappings
    const savedKeys = Object.keys(savedMappings);
    const initialRowCount = Math.max(savedKeys.length, 1); // At least 1 row
    this.scMappingRowCount = Math.min(initialRowCount, 3); // Max 3 rows

    // Build the HTML
    let html = '';

    // Add existing rows
    for (let i = 0; i < this.scMappingRowCount; i++) {
      html += this.createScMappingRowHtml(i, currentHardware, savedMappings);
    }

    listContainer.innerHTML = html;

    // Add the "Add Device" button if we have less than 3 rows
    this.updateScAddDeviceButton();

    // Add change listeners
    this.attachScMappingListeners();

    // Update selects to show which are already used
    this.updateScDeviceSelects();
  }

  /**
   * Create HTML for a single mapping row
   */
  createScMappingRowHtml(rowIndex, currentHardware, savedMappings) {
    const savedKeys = Object.keys(savedMappings);
    const savedKey = savedKeys[rowIndex]; // e.g., 'js1', 'js2'
    const savedJsNum = savedKey ? parseInt(savedKey.replace('js', '')) : '';
    const savedDeviceId = savedKey ? savedMappings[savedKey] : '';

    // Find the device index for the saved device ID
    const savedDeviceIndex = currentHardware.find(d => d.id === savedDeviceId)?.index;

    return `
      <div class="sc-mapping-row" data-row="${rowIndex}">
        <select class="sc-js-select" id="sc-js-select-${rowIndex}" data-row="${rowIndex}">
          <option value="">-- Joystick # --</option>
          ${[1,2,3,4,5,6,7,8].map(num => `
            <option value="${num}" ${savedJsNum === num ? 'selected' : ''}>Joystick ${num}</option>
          `).join('')}
        </select>
        <span class="sc-mapping-arrow">→</span>
        <select class="sc-device-select" id="sc-device-select-${rowIndex}" data-row="${rowIndex}">
          <option value="">-- Select Device --</option>
          ${currentHardware.map(device => `
            <option value="${device.index}" data-device-id="${device.id}" ${savedDeviceIndex === device.index ? 'selected' : ''}>${device.name}</option>
          `).join('')}
        </select>
        <button class="sc-remove-row-btn" data-row="${rowIndex}" title="Remove this mapping">✕</button>
      </div>
    `;
  }

  /**
   * Update the Add Device button visibility
   */
  updateScAddDeviceButton() {
    const listContainer = document.getElementById('sc-mapping-list');
    if (!listContainer) return;

    // Remove existing add button if present
    const existingBtn = document.getElementById('sc-add-device-btn');
    if (existingBtn) {
      existingBtn.remove();
    }

    // Add button if we have less than 3 rows
    if (this.scMappingRowCount < 3) {
      const addBtn = document.createElement('button');
      addBtn.id = 'sc-add-device-btn';
      addBtn.className = 'sc-add-device-btn';
      addBtn.innerHTML = '+ Add Device';
      addBtn.addEventListener('click', () => this.addScMappingRow());
      listContainer.after(addBtn);
    }
  }

  /**
   * Add a new mapping row
   */
  addScMappingRow() {
    if (this.scMappingRowCount >= 3) return;

    const listContainer = document.getElementById('sc-mapping-list');
    if (!listContainer) return;

    const newRowHtml = this.createScMappingRowHtml(
      this.scMappingRowCount,
      this.currentHardwareList || [],
      {}
    );

    listContainer.insertAdjacentHTML('beforeend', newRowHtml);
    this.scMappingRowCount++;

    // Attach listeners to the new row
    this.attachScMappingListeners();

    // Update button visibility
    this.updateScAddDeviceButton();

    // Update selects
    this.updateScDeviceSelects();
  }

  /**
   * Remove a mapping row
   */
  removeScMappingRow(rowIndex) {
    const row = document.querySelector(`.sc-mapping-row[data-row="${rowIndex}"]`);
    if (row) {
      row.remove();
      this.scMappingRowCount--;

      // Re-index remaining rows
      const rows = document.querySelectorAll('.sc-mapping-row');
      rows.forEach((r, i) => {
        r.dataset.row = i;
        const jsSelect = r.querySelector('.sc-js-select');
        const deviceSelect = r.querySelector('.sc-device-select');
        const removeBtn = r.querySelector('.sc-remove-row-btn');

        if (jsSelect) {
          jsSelect.id = `sc-js-select-${i}`;
          jsSelect.dataset.row = i;
        }
        if (deviceSelect) {
          deviceSelect.id = `sc-device-select-${i}`;
          deviceSelect.dataset.row = i;
        }
        if (removeBtn) {
          removeBtn.dataset.row = i;
        }
      });

      // Update button visibility
      this.updateScAddDeviceButton();

      // Update selects
      this.updateScDeviceSelects();
    }
  }

  /**
   * Attach event listeners to mapping rows
   */
  attachScMappingListeners() {
    // JS select listeners
    document.querySelectorAll('.sc-js-select').forEach(select => {
      select.removeEventListener('change', this.handleScJsSelectChange);
      select.addEventListener('change', () => this.updateScDeviceSelects());
    });

    // Device select listeners
    document.querySelectorAll('.sc-device-select').forEach(select => {
      select.removeEventListener('change', this.handleScDeviceSelectChange);
      select.addEventListener('change', () => this.updateScDeviceSelects());
    });

    // Remove button listeners
    document.querySelectorAll('.sc-remove-row-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        this.removeScMappingRow(parseInt(btn.dataset.row));
      };
    });
  }

  /**
   * Update device selects to disable already-used devices and joystick numbers
   */
  updateScDeviceSelects() {
    const rows = document.querySelectorAll('.sc-mapping-row');

    // Collect all selected values
    const selectedJoysticks = [];
    const selectedDevices = [];

    rows.forEach((row, rowIndex) => {
      const jsSelect = row.querySelector('.sc-js-select');
      const deviceSelect = row.querySelector('.sc-device-select');

      if (jsSelect && jsSelect.value) {
        selectedJoysticks.push({ row: rowIndex, jsNum: jsSelect.value });
      }
      if (deviceSelect && deviceSelect.value) {
        selectedDevices.push({ row: rowIndex, deviceIndex: deviceSelect.value });
      }
    });

    // Update each row's selects
    rows.forEach((row, rowIndex) => {
      const jsSelect = row.querySelector('.sc-js-select');
      const deviceSelect = row.querySelector('.sc-device-select');

      // Update joystick number options
      if (jsSelect) {
        const options = jsSelect.options;
        for (let j = 0; j < options.length; j++) {
          const option = options[j];
          if (!option.value) continue; // Skip placeholder

          const usedBy = selectedJoysticks.find(
            s => s.jsNum === option.value && s.row !== rowIndex
          );

          if (usedBy) {
            option.disabled = true;
            option.classList.add('used');
          } else {
            option.disabled = false;
            option.classList.remove('used');
          }
        }
      }

      // Update device options
      if (deviceSelect) {
        const options = deviceSelect.options;
        for (let j = 0; j < options.length; j++) {
          const option = options[j];
          if (!option.value) continue; // Skip placeholder

          const usedBy = selectedDevices.find(
            s => s.deviceIndex === option.value && s.row !== rowIndex
          );

          if (usedBy) {
            option.disabled = true;
            option.classList.add('used');
          } else {
            option.disabled = false;
            option.classList.remove('used');
          }
        }
      }
    });
  }

  /**
   * Save Star Citizen joystick mappings
   */
  saveStarCitizenJoystickMappings() {
    const mappings = {};
    const rows = document.querySelectorAll('.sc-mapping-row');

    rows.forEach(row => {
      const jsSelect = row.querySelector('.sc-js-select');
      const deviceSelect = row.querySelector('.sc-device-select');

      if (jsSelect && jsSelect.value && deviceSelect && deviceSelect.value) {
        const jsNum = jsSelect.value;
        const selectedOption = deviceSelect.options[deviceSelect.selectedIndex];
        const deviceId = selectedOption.dataset.deviceId;
        if (deviceId) {
          mappings[`js${jsNum}`] = deviceId;
        }
      }
    });

    // Save mappings
    this.saveJoystickMappings(mappings);

    // Also update the device mapping config for XML export
    const mappingConfig = this.loadDeviceMappingConfig();
    mappingConfig.scJoystickMappings = mappings;

    // Auto-detect device types based on joystick slot assignments
    Object.entries(mappings).forEach(([jsKey, deviceId]) => {
      const jsNum = parseInt(jsKey.replace('js', ''));
      const lowerDeviceId = deviceId.toLowerCase();

      if (lowerDeviceId.includes('x56') || lowerDeviceId.includes('x-56')) {
        if (lowerDeviceId.includes('throttle')) {
          mappingConfig.throttleSlot = jsNum;
        } else if (lowerDeviceId.includes('stick') || lowerDeviceId.includes('rhino')) {
          mappingConfig.stickSlot = jsNum;
        }
      } else if (lowerDeviceId.includes('x52')) {
        if (!mappingConfig.stickSlot) {
          mappingConfig.stickSlot = jsNum;
        }
      } else if (lowerDeviceId.includes('vkb') || lowerDeviceId.includes('gladiator')) {
        if (lowerDeviceId.includes('left') || lowerDeviceId.includes('evo l') || lowerDeviceId.includes(' l ')) {
          mappingConfig.vkbLSlot = jsNum;
        } else {
          mappingConfig.vkbRSlot = jsNum;
        }
      } else if (lowerDeviceId.includes('moza') || lowerDeviceId.includes('ab9')) {
        mappingConfig.ab9Slot = jsNum;
      }
    });

    this.saveDeviceMappingConfig(mappingConfig);

    // Hide modal and complete game switch
    this.hideStarCitizenJoystickModal();
    this.updateStatus('Joystick mappings saved');

    if (this.pendingGameSwitch) {
      this.switchGame(this.pendingGameSwitch);
      this.pendingGameSwitch = null;
    }
  }

  /**
   * Load saved joystick mappings from localStorage
   */
  loadJoystickMappings() {
    try {
      const saved = localStorage.getItem('flycon_sc_joystick_mappings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load joystick mappings:', e);
    }
    return {};
  }

  /**
   * Save joystick mappings to localStorage
   */
  saveJoystickMappings(mappings) {
    try {
      localStorage.setItem('flycon_sc_joystick_mappings', JSON.stringify(mappings));
      this.joystickMappings = mappings;
    } catch (e) {
      console.error('Failed to save joystick mappings:', e);
    }
  }

  /**
   * Update visibility of SC joystick settings icon based on current game
   */
  updateScJoystickSettingsIcon() {
    const icon = document.getElementById('sc-joystick-settings-btn');
    if (!icon) return;

    if (this.currentGame === 'star-citizen') {
      icon.style.display = 'flex';
    } else {
      icon.style.display = 'none';
    }
  }

  /**
   * Detect currently connected hardware using the Gamepad API
   */
  detectCurrentHardware() {
    const gamepads = navigator.getGamepads();
    const devices = [];

    for (const gamepad of gamepads) {
      if (gamepad && gamepad.connected) {
        devices.push({
          index: gamepad.index,
          id: gamepad.id,
          name: this.getShortDeviceName(gamepad.id),
          buttons: gamepad.buttons.length,
          axes: gamepad.axes.length,
          hash: this.generateDeviceHash(gamepad)
        });
      }
    }

    return devices;
  }

  /**
   * Generate a unique hash for a device to detect changes
   */
  generateDeviceHash(gamepad) {
    // Create a simple hash based on device properties
    const str = `${gamepad.id}_${gamepad.buttons.length}_${gamepad.axes.length}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new FlyconApp();
});

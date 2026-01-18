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
    this.currentGame = 'star-citizen';
    this.gameConfig = null;
    this.pendingGameSwitch = null; // Holds the game to switch to during confirmation

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
          { id: 'x56-hotas', name: 'X56 HOTAS', image: '../../assets/controllers/x56-throttle.png' },
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
      }
      // Update the dropdown to match
      const gameSelect = document.getElementById('game-select');
      if (gameSelect) {
        gameSelect.value = this.currentGame;
      }
      // Update default mapping path
      this.defaultMappingPath = this.defaultMappingPaths[this.currentGame] || '';
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

    gameSelect.addEventListener('change', (e) => {
      const newGame = e.target.value;
      if (newGame === this.currentGame) return;

      // Check if there are existing bindings
      const hasBindings = this.hasExistingBindings();

      if (hasBindings) {
        // Store the pending game and show confirmation modal
        this.pendingGameSwitch = newGame;
        this.showGameSwitchModal();
        // Reset dropdown to current game until confirmed
        gameSelect.value = this.currentGame;
      } else {
        // No bindings, switch immediately
        this.switchGame(newGame);
      }
    });

    // Setup game switch modal buttons
    document.getElementById('btn-confirm-switch')?.addEventListener('click', () => {
      this.hideGameSwitchModal();
      if (this.pendingGameSwitch) {
        this.switchGame(this.pendingGameSwitch, true); // true = clear bindings
        this.pendingGameSwitch = null;
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
  }

  onDeviceDisconnected(type) {
    this.connectedDevices[type] = null;
    this.updateDeviceIndicators();
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
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<ActionMaps version="1" optionsVersion="2" rebindVersion="2" profileName="custom_flycon">\n';
    xml += '  <CustomisationUIHeader label="Flycon Custom Bindings" description="Generated by Flycon - Flight Control Mapper" image=""/>\n';
    xml += '  <options type="keyboard">\n';
    xml += '    <flight_move_pitch exponent="1.00"/>\n';
    xml += '  </options>\n';
    xml += '  <modifiers/>\n';

    // Mode modifier mapping for X56
    const modeModifiers = {
      'm1': 'kb1_lctrl',     // X56 M1 = Ctrl
      'm2': 'kb1_lalt',      // X56 M2 = Alt
      's1': 'kb1_lshift'     // X56 S1 = Shift
    };

    // Group bindings by action category
    const actionGroups = {};

    for (const [key, action] of Object.entries(customBindings)) {
      // Check if this is a mode-prefixed binding (e.g., "m1_x56_th_tgl1_action")
      let modifier = null;
      let actualKey = key;

      const modeMatch = key.match(/^(m1|m2|s1)_(.+)$/);
      if (modeMatch) {
        modifier = modeModifiers[modeMatch[1]];
        actualKey = modeMatch[2];
      }

      // Parse key based on device type
      // VKB: "vkb_l_f1_action" or "vkb_r_thumb_dpad_up"
      // X56: "x56_th_tgl1_action" or "x56_js_trigger_stage1"
      // AB9: "ab9_btn1_press"
      const parts = actualKey.split('_');
      const direction = parts.pop();

      let buttonName;
      let devicePrefix;

      // Check for VKB devices (vkb_l_ or vkb_r_)
      if (parts[0] === 'vkb' && (parts[1] === 'l' || parts[1] === 'r')) {
        devicePrefix = `vkb_${parts[1]}`;
        buttonName = parts.slice(2).join('_');
      }
      // Check for X56 devices (x56_th_ or x56_js_)
      else if (parts[0] === 'x56' && (parts[1] === 'th' || parts[1] === 'js')) {
        devicePrefix = `x56_${parts[1]}`;
        buttonName = parts.slice(2).join('_');
      }
      // Check for X52 devices (x52_th_ or x52_js_)
      else if (parts[0] === 'x52' && (parts[1] === 'th' || parts[1] === 'js')) {
        devicePrefix = `x52_${parts[1]}`;
        buttonName = parts.slice(2).join('_');
      }
      // Default: single prefix (ab9, etc.)
      else {
        devicePrefix = parts[0];
        buttonName = parts.slice(1).join('_');
      }

      // Map to joystick input format
      let inputName = this.mapToSCInput(buttonName, direction, devicePrefix);

      // Add modifier prefix for mode bindings
      if (modifier) {
        inputName = `${modifier}+${inputName}`;
      }

      if (!actionGroups[action]) {
        actionGroups[action] = [];
      }
      actionGroups[action].push(inputName);
    }

    // Generate actionmap entries
    xml += '  <actionmap name="spaceship_movement">\n';
    for (const [action, inputs] of Object.entries(actionGroups)) {
      if (action.startsWith('v_')) {
        for (const input of inputs) {
          xml += `    <action name="${action}">\n`;
          xml += `      <rebind input="${input}"/>\n`;
          xml += '    </action>\n';
        }
      }
    }
    xml += '  </actionmap>\n';

    xml += '  <actionmap name="spaceship_targeting">\n';
    for (const [action, inputs] of Object.entries(actionGroups)) {
      if (action.startsWith('v_target')) {
        for (const input of inputs) {
          xml += `    <action name="${action}">\n`;
          xml += `      <rebind input="${input}"/>\n`;
          xml += '    </action>\n';
        }
      }
    }
    xml += '  </actionmap>\n';

    xml += '</ActionMaps>\n';

    return xml;
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
        // Axes
        'x_axis': 'js2_x',
        'y_axis': 'js2_y',
        'twist': 'js2_rotz'
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
        // Axes
        'x_axis': 'js1_x',
        'y_axis': 'js1_y',
        'twist': 'js1_rotz'
      };
      return vkbRightMap[buttonName] || `js1_${buttonName}`;
    }

    // X56 Throttle mappings
    if (devicePrefix === 'x56_th') {
      const x56ThrottleMap = {
        'tgl1': 'js2_button1',
        'tgl2': 'js2_button2',
        'tgl3': 'js2_button3',
        'tgl4': 'js2_button4',
        'sw1_sw2': direction === 'sw1_up' ? 'js2_button5' : 'js2_button6',
        'sw3_sw4': direction === 'sw3_up' ? 'js2_button7' : 'js2_button8',
        'sw5_sw6': direction === 'sw5_up' ? 'js2_button9' : 'js2_button10',
        'thumb_btn': 'js2_button11',
        'rear_ministick': this.mapHatDirection('js2_hat1', direction),
        'thumb_ministick': this.mapHatDirection('js2_hat2', direction),
        'thumb_dpad': this.mapHatDirection('js2_hat3', direction)
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
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new FlyconApp();
});

const { app, BrowserWindow, ipcMain, dialog, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');
const licenseManager = require('./license-manager');

let mainWindow;
let isLicensed = false;

// X56 HOTAS HID device identifiers
const X56_DEVICES = {
  THROTTLE: { vendorId: 0x0738, productId: 0xA221 },  // X56 Throttle
  STICK: { vendorId: 0x0738, productId: 0x2221 }       // X56 Stick
};

// Store granted HID devices for persistence
let grantedHIDDevices = [];

function createWindow() {
  const isDev = process.argv.includes('--dev');

  // Set up menu - show default menu in dev, hide in production
  if (isDev) {
    // Use default Electron menu in dev mode
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      }
    ]));
  } else {
    Menu.setApplicationMenu(null);
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'Flycon - Flight Control Mapper',
    icon: path.join(__dirname, '../../assets/icon.png'),
    autoHideMenuBar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Set up WebHID permissions for X56 HOTAS
  setupWebHIDPermissions();
  createWindow();
});

// Configure WebHID permissions to allow X56 HOTAS access
function setupWebHIDPermissions() {
  // Handle HID device permission requests
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission === 'hid') {
      // Allow HID access for our app
      return true;
    }
    return true;
  });

  // Auto-grant permission for X56 devices
  session.defaultSession.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'hid') {
      const device = details.device;
      // Check if it's an X56 device
      if (device.vendorId === X56_DEVICES.THROTTLE.vendorId) {
        if (device.productId === X56_DEVICES.THROTTLE.productId ||
            device.productId === X56_DEVICES.STICK.productId) {
          console.log('Auto-granting HID permission for X56 device:', device.productName);
          grantedHIDDevices.push(device);
          return true;
        }
      }
    }
    return false;
  });

  // Handle device selection (when user needs to pick a device)
  session.defaultSession.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();

    // Look for X56 throttle (mode switch is on throttle)
    const x56Throttle = details.deviceList.find(device =>
      device.vendorId === X56_DEVICES.THROTTLE.vendorId &&
      device.productId === X56_DEVICES.THROTTLE.productId
    );

    if (x56Throttle) {
      console.log('Auto-selecting X56 Throttle for HID access');
      callback(x56Throttle.deviceId);
    } else {
      // No X56 throttle found
      callback();
    }
  });

  // Track when HID devices are added
  session.defaultSession.on('hid-device-added', (event, device) => {
    if (device.vendorId === X56_DEVICES.THROTTLE.vendorId) {
      console.log('X56 HID device connected:', device.productName);
    }
  });

  // Track when HID devices are removed
  session.defaultSession.on('hid-device-removed', (event, device) => {
    if (device.vendorId === X56_DEVICES.THROTTLE.vendorId) {
      console.log('X56 HID device disconnected:', device.productName);
      // Remove from granted list
      grantedHIDDevices = grantedHIDDevices.filter(d => d.deviceId !== device.deviceId);
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Star Citizen Keybinding File',
    filters: [
      { name: 'XML Files', extensions: ['xml'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('parse-keybinding-file', async (event, filePath) => {
  try {
    const xmlContent = fs.readFileSync(filePath, 'utf-8');
    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
    const result = await parser.parseStringPromise(xmlContent);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-default-sc-paths', async () => {
  const possiblePaths = [];
  const userProfile = process.env.USERPROFILE || '';
  const programFiles = process.env['ProgramFiles'] || 'C:\Program Files';
  const scPaths = [
    path.join(userProfile, 'AppData', 'Local', 'Star Citizen'),
    path.join(programFiles, 'Roberts Space Industries', 'StarCitizen'),
    'C:\Program Files\Roberts Space Industries\StarCitizen',
    'D:\Program Files\Roberts Space Industries\StarCitizen',
    'D:\Games\Roberts Space Industries\StarCitizen'
  ];
  for (const scPath of scPaths) {
    if (fs.existsSync(scPath)) {
      const userMappingsPath = path.join(scPath, 'LIVE', 'USER', 'Client', '0', 'Profiles', 'default');
      const ptuMappingsPath = path.join(scPath, 'PTU', 'USER', 'Client', '0', 'Profiles', 'default');
      if (fs.existsSync(userMappingsPath)) {
        possiblePaths.push({ type: 'LIVE', path: userMappingsPath });
      }
      if (fs.existsSync(ptuMappingsPath)) {
        possiblePaths.push({ type: 'PTU', path: ptuMappingsPath });
      }
    }
  }
  return possiblePaths;
});

ipcMain.handle('list-xml-files', async (event, dirPath) => {
  try {
    const files = fs.readdirSync(dirPath);
    const xmlFiles = files.filter(f => f.endsWith('.xml'));
    return { success: true, files: xmlFiles };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Star Citizen Mappings Folder',
    defaultPath: 'C:\\Program Files\\Roberts Space Industries\\StarCitizen\\LIVE\\USER\\Client\\0\\Controls\\Mappings',
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('save-file', async (event, filePath, content) => {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ==================== LICENSE MANAGEMENT ====================

// Validate license on app start
ipcMain.handle('license-validate', async () => {
  try {
    const result = await licenseManager.validateLicense();
    isLicensed = result.valid;
    return result;
  } catch (error) {
    return { valid: false, error: error.message };
  }
});

// Activate a license key
ipcMain.handle('license-activate', async (event, licenseKey) => {
  try {
    const result = await licenseManager.activateLicense(licenseKey);
    if (result.success) {
      isLicensed = true;
    }
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Reactivate license on new hardware
ipcMain.handle('license-reactivate', async (event, licenseKey, email) => {
  try {
    const result = await licenseManager.reactivateLicense(licenseKey, email);
    if (result.success) {
      isLicensed = true;
    }
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get current license status
ipcMain.handle('license-status', async () => {
  return licenseManager.getLicenseStatus();
});

// Clear license (for testing/support)
ipcMain.handle('license-clear', async () => {
  licenseManager.clearLicense();
  isLicensed = false;
  return { success: true };
});

// Check if currently licensed (for feature gating)
ipcMain.handle('is-licensed', async () => {
  return isLicensed;
});

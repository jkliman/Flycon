const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');

let mainWindow;

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

app.whenReady().then(createWindow);

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

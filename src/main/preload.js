const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sccmAPI', {
  // File operations
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  parseKeybindingFile: (filePath) => ipcRenderer.invoke('parse-keybinding-file', filePath),
  getDefaultSCPaths: () => ipcRenderer.invoke('get-default-sc-paths'),
  listXmlFiles: (dirPath) => ipcRenderer.invoke('list-xml-files', dirPath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),

  // License management
  license: {
    validate: () => ipcRenderer.invoke('license-validate'),
    activate: (licenseKey) => ipcRenderer.invoke('license-activate', licenseKey),
    reactivate: (licenseKey, email) => ipcRenderer.invoke('license-reactivate', licenseKey, email),
    getStatus: () => ipcRenderer.invoke('license-status'),
    clear: () => ipcRenderer.invoke('license-clear'),
    isLicensed: () => ipcRenderer.invoke('is-licensed')
  }
});

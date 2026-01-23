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
  },

  // WebHID API access (for X56 mode switch)
  hid: {
    // Check if WebHID is available
    isAvailable: () => !!navigator.hid,
    // Request X56 throttle device
    requestX56Throttle: async () => {
      if (!navigator.hid) return null;
      try {
        const devices = await navigator.hid.requestDevice({
          filters: [{ vendorId: 0x0738, productId: 0xA221 }]
        });
        return devices.length > 0 ? devices[0] : null;
      } catch (err) {
        console.error('Failed to request X56 throttle:', err);
        return null;
      }
    },
    // Get already-granted X56 devices
    getX56Devices: async () => {
      if (!navigator.hid) return [];
      try {
        const devices = await navigator.hid.getDevices();
        return devices.filter(d => d.vendorId === 0x0738 &&
          (d.productId === 0xA221 || d.productId === 0x2221));
      } catch (err) {
        console.error('Failed to get X56 devices:', err);
        return [];
      }
    }
  }
});

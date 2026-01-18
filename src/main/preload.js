const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sccmAPI', {
  // File operations
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  parseKeybindingFile: (filePath) => ipcRenderer.invoke('parse-keybinding-file', filePath),
  getDefaultSCPaths: () => ipcRenderer.invoke('get-default-sc-paths'),
  listXmlFiles: (dirPath) => ipcRenderer.invoke('list-xml-files', dirPath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content)
});

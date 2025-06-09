const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');

let noteWindows = new Map(); // Store multiple note windows like main.js
let urlInputWindow;
let windowIdCounter = 1;

// Path for storing app data
const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');

// Updated settings structure to support multiple windows
const defaultSettings = {
  notes: [], // Array of note configurations
  defaultWindowBounds: {
    x: undefined,
    y: undefined,
    width: 430,
    height: 500
  },
  alwaysOnTop: true,
  // Keep backward compatibility
  lastNoteUrl: null,
  windowBounds: {
    x: undefined,
    y: undefined,
    width: 430,
    height: 500
  }
};

// Load settings from file
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      const loaded = { ...defaultSettings, ...JSON.parse(data) };
      
      // Migrate old single-window settings to new multi-window format ONLY if no notes exist
      if (loaded.lastNoteUrl && (!loaded.notes || loaded.notes.length === 0)) {
        loaded.notes = [{
          id: 1,
          url: loaded.lastNoteUrl,
          bounds: loaded.windowBounds || loaded.defaultWindowBounds,
          alwaysOnTop: loaded.alwaysOnTop
        }];
      }
      
      return loaded;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return defaultSettings;
}

// Save settings to file
function saveSettings(settings) {
  try {
    // Ensure directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Get current state of all windows
function getAllWindowStates() {
  const states = [];
  noteWindows.forEach((window, id) => {
    if (window && !window.isDestroyed()) {
      const bounds = window.getBounds();
      const currentUrl = window.webContents.getURL();
      let cleanUrl = null;

      if (currentUrl && currentUrl.includes('/embed/')) {
        cleanUrl = currentUrl.replace(/[?&]desktop=true/g, '');
      }

      states.push({
        id: id,
        url: cleanUrl,
        bounds: bounds,
        alwaysOnTop: window.isAlwaysOnTop()
      });
    }
  });
  return states;
}

// Save all window states
function saveAllWindowStates() {
  const settings = loadSettings();
  const windowStates = getAllWindowStates();
  
  // Only update if we have windows to save
  if (windowStates.length > 0) {
    settings.notes = windowStates;
    
    // Keep backward compatibility for single window - but don't overwrite multi-window data
    settings.lastNoteUrl = windowStates[0].url;
    settings.windowBounds = windowStates[0].bounds;
  }
  
  saveSettings(settings);
  console.log('Saved window states:', windowStates);
}

function createUrlInputWindow() {
  // Always close existing window first to ensure clean state
  if (urlInputWindow && !urlInputWindow.isDestroyed()) {
    urlInputWindow.close();
    urlInputWindow = null;
  }

  const settings = loadSettings();

  urlInputWindow = new BrowserWindow({
    width: 450,
    height: 150,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'url-input-preload.js')
    },
    icon: path.join(__dirname, '../attached_assets/notepadicon.png')
  });

const inputHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>SyncNote Desktop</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                background: transparent;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }

            .window {
                background: rgba(254, 243, 199, 0.95);
                border-radius: 30px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
                padding: 30px;
                width: 430px;
                position: relative;
                border: 1px solid rgba(245, 158, 11, 0.3);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                -webkit-app-region: drag;
            }

            .window-controls {
                position: absolute;
                top: 12px;
                right: 23px;
                display: flex;
                gap: 5px;
                -webkit-app-region: no-drag;
            }

            .control-btn {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: none;
                cursor: pointer;
                transition: all 0.15s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.8);
                font-weight: bold;
            }

            .control-btn:hover {
                transform: scale(1.1);
                color: white;
            }

            .control-btn.close {
                background: #ff6b6b;
            }

            .control-btn.close::before {
                content: "×";
            }

            .control-btn.minimize {
                background: #ffd93d;
                color: rgba(0, 0, 0, 0.6);
            }

            .control-btn.minimize::before {
                content: "−";
            }

            .control-btn.minimize:hover {
                color: rgba(0, 0, 0, 0.8);
            }

            .input-container {
                margin-top: 35px;
                display: flex;
                gap: 12px;
                align-items: center;
                -webkit-app-region: no-drag;
            }

            input {
                flex: 1;
                padding: 10px 16px;
                font-size: 13px;
                border: 1px solid rgba(245, 158, 11, 0.4);
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.7);
                transition: all 0.2s ease;
                outline: none;
                color: #92400e;
                font-family: inherit;
            }

            input:focus {
                border-color: rgba(245, 158, 11, 0.8);
                background: rgba(255, 255, 255, 0.9);
                box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
            }

            input::placeholder {
                color: rgba(146, 64, 14, 0.6);
            }

            .load-btn {
                padding: 10px 20px;
                font-size: 13px;
                font-weight: 600;
                border: 1px solid rgba(245, 158, 11, 0.6);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                outline: none;
                background: rgba(245, 158, 11, 0.9);
                color: white;
                white-space: nowrap;
                font-family: inherit;
            }

            .load-btn:hover {
                background: rgba(217, 119, 6, 0.9);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
            }

            .load-btn:active {
                transform: translateY(0);
            }

            .window::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-image: 
                    linear-gradient(90deg, rgba(245, 158, 11, 0.1) 1px, transparent 1px),
                    linear-gradient(rgba(245, 158, 11, 0.1) 1px, transparent 1px);
                background-size: 20px 20px;
                border-radius: 30px;
                pointer-events: none;
                opacity: 0.3;
            }
        </style>
    </head>
    <body>
        <div class="window">
            <div class="window-controls">
                <button class="control-btn minimize" onclick="window.electronAPI.minimize()"></button>
                <button class="control-btn close" onclick="window.electronAPI.cancel()"></button>
            </div>

            <div class="input-container">
                <input 
                    type="text" 
                    id="noteUrl" 
                    placeholder="Enter note URL..."
                    autocomplete="off"
                    spellcheck="false"
                />
                <button class="load-btn" onclick="loadNote()">Load Note</button>
            </div>
        </div>

        <script>
            function loadNote() {
                const url = document.getElementById('noteUrl').value.trim();
                if (!url) {
                    alert('Please enter a note URL');
                    return;
                }
                if (!url.includes('/embed/')) {
                    alert('Please enter a valid embed URL (should contain "/embed/")');
                    return;
                }
                window.electronAPI.loadNote(url);
            }

            document.getElementById('noteUrl').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    loadNote();
                }
            });

            // Focus input on load
            window.addEventListener('DOMContentLoaded', () => {
                document.getElementById('noteUrl').focus();
            });
        </script>
    </body>
    </html>
`;

  urlInputWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(inputHtml));

  // Center the URL input window
  const primaryDisplay = require('electron').screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const [urlWidth, urlHeight] = urlInputWindow.getSize();

  urlInputWindow.setPosition(
    Math.round((width - urlWidth) / 2),
    Math.round((height - urlHeight) / 2)
  );

  urlInputWindow.on('closed', () => {
    urlInputWindow = null;
  });
}

function createNoteWindow(noteUrl, windowBounds = null, windowId = null) {
  if (urlInputWindow) {
    urlInputWindow.close();
    urlInputWindow = null;
  }

  const settings = loadSettings();
  const id = windowId || windowIdCounter++;

  // Use provided bounds or default bounds with offset for new windows
  const bounds = windowBounds || {
    ...settings.defaultWindowBounds,
    x: (settings.defaultWindowBounds.x || 100) + (noteWindows.size * 30),
    y: (settings.defaultWindowBounds.y || 100) + (noteWindows.size * 30)
  };

  const noteWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: settings.alwaysOnTop,
    resizable: true,
    movable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../attached_assets/notepadicon.png')
  });

  // Store window with its ID
  noteWindows.set(id, noteWindow);

  // Add ?desktop=true to the URL for desktop-specific styling
  const desktopUrl = noteUrl + (noteUrl.includes('?') ? '&' : '?') + 'desktop=true';
  noteWindow.loadURL(desktopUrl);

  // Set up window event handlers
  const setupWindowHandlers = (windowId) => {
    const window = noteWindows.get(windowId);
    if (!window) return;

    // Save state on window changes with debouncing
    let saveTimeout;
    const saveState = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        console.log(`Saving state for window ${windowId}`);
        saveAllWindowStates();
      }, 200); // Debounce saves
    };

    window.on('moved', saveState);
    window.on('resized', saveState);

    // Save immediately when window closes
    window.on('close', () => {
      console.log(`Window ${windowId} closing, saving all states`);
      clearTimeout(saveTimeout); // Cancel any pending saves
      saveAllWindowStates(); // Save immediately
    });

    window.on('closed', () => {
      console.log(`Window ${windowId} closed, removing from map`);
      noteWindows.delete(windowId);
      // If all windows are closed, quit the app (except on macOS)
      if (noteWindows.size === 0 && process.platform !== 'darwin') {
        app.quit();
      }
    });
  };

  setupWindowHandlers(id);
  
  // Update windowIdCounter to avoid ID conflicts when restoring windows
  if (id >= windowIdCounter) {
    windowIdCounter = id + 1;
  }
  
  return noteWindow;
}

let urlInputMode = 'add'; // 'add' or 'change'
let callingWindow = null; // Store reference to window that called change-note

// IPC handlers for URL input window
ipcMain.handle('load-note', (event, url) => {
  if (url) {
    if (urlInputMode === 'add') {
      // Always create a new note window for 'add' mode
      createNoteWindow(url);
    } else if (urlInputMode === 'change' && callingWindow && !callingWindow.isDestroyed()) {
      // Replace the calling window's URL (change note)
      const newUrl = url + (url.includes('?') ? '&' : '?') + 'desktop=true';
      callingWindow.loadURL(newUrl);
    } else {
      // Fallback: create new window if calling window is gone
      createNoteWindow(url);
    }
    // Save state after creating/changing note
    setTimeout(saveAllWindowStates, 100);
  }
  
  // Reset state
  urlInputMode = 'add';
  callingWindow = null;
  
  if (urlInputWindow && !urlInputWindow.isDestroyed()) {
    urlInputWindow.close();
    urlInputWindow = null;
  }
});

ipcMain.handle('cancel-input', () => {
  // Reset state when canceling
  urlInputMode = 'add';
  callingWindow = null;
  
  if (urlInputWindow) {
    urlInputWindow.close();
  }
  
  // If no windows exist, quit the app
  if (noteWindows.size === 0) {
    app.quit();
  }
});

ipcMain.handle('url-window-minimize', () => {
  if (urlInputWindow) urlInputWindow.minimize();
});

// Handle clearing saved data
ipcMain.handle('clear-saved', () => {
  // Close all note windows
  noteWindows.forEach(window => {
    if (window && !window.isDestroyed()) {
      window.close();
    }
  });
  noteWindows.clear();

  // Reset to default settings
  saveSettings(defaultSettings);

  if (urlInputWindow) {
    urlInputWindow.close();
  }

  // Create a new single window
  setTimeout(() => {
    createUrlInputWindow();
  }, 100);
});

// Main window IPC handlers
ipcMain.handle('window-close', (event) => {
  const webContents = event.sender;
  const window = BrowserWindow.fromWebContents(webContents);
  if (window) {
    window.close();
  }
});

ipcMain.handle('window-minimize', (event) => {
  const webContents = event.sender;
  const window = BrowserWindow.fromWebContents(webContents);
  if (window) {
    window.minimize();
  }
});

ipcMain.handle('window-toggle-always-on-top', (event) => {
  const webContents = event.sender;
  const window = BrowserWindow.fromWebContents(webContents);
  if (window) {
    const isAlwaysOnTop = window.isAlwaysOnTop();
    window.setAlwaysOnTop(!isAlwaysOnTop);

    // Update settings and apply to all windows
    const settings = loadSettings();
    settings.alwaysOnTop = !isAlwaysOnTop;
    saveSettings(settings);

    noteWindows.forEach(win => {
      if (win && !win.isDestroyed()) {
        win.setAlwaysOnTop(!isAlwaysOnTop);
      }
    });

    return !isAlwaysOnTop;
  }
});

ipcMain.handle('change-note', (event) => {
  urlInputMode = 'change';
  callingWindow = BrowserWindow.fromWebContents(event.sender);
  createUrlInputWindow();
});

ipcMain.handle('add-note', () => {
  // Always set mode to 'add' and clear calling window reference
  urlInputMode = 'add';
  callingWindow = null;
  createUrlInputWindow();
});

app.whenReady().then(() => {
  const settings = loadSettings();
  console.log('Loading settings on app start:', settings);

  // Restore saved note windows
  if (settings.notes && settings.notes.length > 0) {
    console.log(`Restoring ${settings.notes.length} note windows`);
    
    settings.notes.forEach((noteConfig, index) => {
      if (noteConfig.url) {
        console.log(`Creating window ${index + 1}:`, noteConfig);
        createNoteWindow(noteConfig.url, noteConfig.bounds, noteConfig.id);
      }
    });
  } else {
    console.log('No saved notes found, opening URL input window');
    // Open URL input window if no saved notes
    createUrlInputWindow();
  }
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (noteWindows.size === 0) {
    createUrlInputWindow();
  }
});

// Handle external links
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Save state periodically as a backup
setInterval(() => {
  if (noteWindows.size > 0) {
    saveAllWindowStates();
  }
}, 30000); // Save every 30 seconds
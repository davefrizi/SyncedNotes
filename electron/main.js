const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

let noteWindows = new Map(); // Store multiple note windows
let urlInputWindow;
let windowIdCounter = 1;

// Path for storing app data
const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');

// Default settings
const defaultSettings = {
  notes: [], // Array of note configurations
  defaultWindowBounds: {
    x: undefined,
    y: undefined,
    width: 430,
    height: 500
  },
  alwaysOnTop: true
};

// Load settings from file
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return { ...defaultSettings, ...JSON.parse(data) };
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
  settings.notes = getAllWindowStates();
  saveSettings(settings);
}

function createNoteWindow(noteUrl, windowBounds = null, windowId = null) {
  // If no URL is provided, don't create a window - let the caller handle it
  if (!noteUrl) {
    return null;
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
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../client/public/favicon.png')
  });

  // Store window with its ID
  noteWindows.set(id, noteWindow);

  // Load the note card URL with desktop app parameter
  const url = noteUrl + (noteUrl.includes('?') ? '&' : '?') + 'desktop=true';
  noteWindow.loadURL(url);

  if (isDev) {
    noteWindow.webContents.openDevTools();
  }

  // Set up window event handlers
  const setupWindowHandlers = (windowId) => {
    const window = noteWindows.get(windowId);
    if (!window) return;

    // Save state on window changes
    const saveState = () => {
      setTimeout(saveAllWindowStates, 100); // Debounce saves
    };

    window.on('moved', saveState);
    window.on('resized', saveState);

    window.on('close', (e) => {
      // Save state before closing
      saveAllWindowStates();
    });

    window.on('closed', () => {
      // Remove this window from the map
      noteWindows.delete(windowId);
      
      // If all note windows are closed and no URL input window exists, quit the app (except on macOS)
      if (noteWindows.size === 0 && (!urlInputWindow || urlInputWindow.isDestroyed()) && process.platform !== 'darwin') {
        app.quit();
      }
    });
  };

  setupWindowHandlers(id);
  return noteWindow;
}

function createUrlInputWindow() {
  // Always close existing window first to ensure clean state
  if (urlInputWindow && !urlInputWindow.isDestroyed()) {
    urlInputWindow.close();
    urlInputWindow = null;
  }

  const settings = loadSettings();

  urlInputWindow = new BrowserWindow({
    width: 500,
    height: 120,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    modal: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'url-input-preload.js')
    }
  });

  // Create the HTML content for the URL input window
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: transparent;
          -webkit-app-region: drag;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          padding: 20px;
        }
        .container {
          background: #fef3c7;
          border-radius: 50px;
          padding: 15px 25px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          gap: 15px;
          width: 100%;
          max-width: 460px;
          border: 1px solid #f59e0b;
        }
        .input-wrapper {
          flex: 1;
          -webkit-app-region: no-drag;
        }
        input {
          width: 100%;
          border: none;
          background: transparent;
          font-size: 14px;
          color: #92400e;
          outline: none;
          placeholder-color: #a16207;
        }
        input::placeholder {
          color: #a16207;
          opacity: 0.7;
        }
        .controls {
          display: flex;
          gap: 8px;
          -webkit-app-region: no-drag;
        }
        button {
          width: 24px;
          height: 24px;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          transition: all 0.2s ease;
        }
        .load-btn {
          background: #f59e0b;
          color: white;
          width: auto;
          padding: 0 12px;
          border-radius: 12px;
          font-size: 11px;
        }
        .load-btn:hover {
          background: #d97706;
        }
        .clear-btn {
          background: #ef4444;
          color: white;
          width: auto;
          padding: 0 10px;
          border-radius: 12px;
          font-size: 11px;
        }
        .clear-btn:hover {
          background: #dc2626;
        }
        .minimize-btn {
          background: #fbbf24;
          color: #92400e;
        }
        .minimize-btn:hover {
          background: #f59e0b;
        }
        .close-btn {
          background: #ef4444;
          color: white;
        }
        .close-btn:hover {
          background: #dc2626;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="input-wrapper">
          <input type="text" id="urlInput" placeholder="Enter note URL..." />
        </div>
        <div class="controls">
          <button class="load-btn" onclick="loadNote()">Add Note</button>
          <button class="clear-btn" onclick="clearSaved()">Clear All</button>
          <button class="minimize-btn" onclick="minimizeWindow()">−</button>
          <button class="close-btn" onclick="closeWindow()">×</button>
        </div>
      </div>
      <script>
        const input = document.getElementById('urlInput');
        input.focus();

        // Load note function
        function loadNote() {
          const url = input.value.trim();
          if (url) {
            window.electronAPI.loadNote(url);
          }
        }

        // Clear all saved notes function
        function clearSaved() {
          if (confirm('Clear all saved notes? This will close all note windows and remove saved settings.')) {
            window.electronAPI.clearSaved();
          }
        }

        // Window controls
        function minimizeWindow() {
          window.electronAPI.minimize();
        }

        function closeWindow() {
          window.electronAPI.cancel();
        }

        // Handle Enter key
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            loadNote();
          }
        });

        // Handle Escape key
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            closeWindow();
          }
        });
      </script>
    </body>
    </html>
  `;

  urlInputWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

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
    
    // If URL input window is closed and no note windows exist, quit the app (except on macOS)
    if (noteWindows.size === 0 && process.platform !== 'darwin') {
      app.quit();
    }
  });
}

// IPC handlers

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

let urlInputMode = 'add'; // 'add' or 'change'
let callingWindow = null; // Store reference to window that called change-note

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

// URL input window handlers
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
    saveAllWindowStates();
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
  
  // If no note windows exist after closing URL input, quit the app (except on macOS)
  if (noteWindows.size === 0 && process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('url-window-minimize', () => {
  if (urlInputWindow) {
    urlInputWindow.minimize();
  }
});

ipcMain.handle('clear-saved', () => {
  // Close all note windows
  noteWindows.forEach(window => {
    if (window && !window.isDestroyed()) {
      window.close();
    }
  });
  noteWindows.clear();

  // Reset settings
  saveSettings(defaultSettings);

  if (urlInputWindow) {
    urlInputWindow.close();
  }

  // Create URL input window instead of trying to create a note window without URL
  setTimeout(() => {
    createUrlInputWindow();
  }, 100);
});

app.whenReady().then(() => {
  const settings = loadSettings();

  // Restore saved note windows
  if (settings.notes && settings.notes.length > 0) {
    let restoredWindows = 0;
    
    settings.notes.forEach(noteConfig => {
      if (noteConfig.url) {
        const window = createNoteWindow(noteConfig.url, noteConfig.bounds, noteConfig.id);
        if (window) {
          restoredWindows++;
          // Update windowIdCounter to avoid conflicts
          if (noteConfig.id >= windowIdCounter) {
            windowIdCounter = noteConfig.id + 1;
          }
        }
      }
    });
    
    // If no windows were successfully restored, open URL input window
    if (restoredWindows === 0) {
      createUrlInputWindow();
    }
  } else {
    // Open URL input window if no saved notes
    createUrlInputWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create windows when the dock icon is clicked
  if (noteWindows.size === 0 && (!urlInputWindow || urlInputWindow.isDestroyed())) {
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
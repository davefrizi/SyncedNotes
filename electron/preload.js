const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.invoke('window-close'),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('window-toggle-always-on-top'),
  changeNote: () => ipcRenderer.invoke('change-note'),
  addNote: () => ipcRenderer.invoke('add-note'),
  isDesktopApp: true
});

// Add drag functionality and plus button to the note window
window.addEventListener('DOMContentLoaded', () => {
  // Make the entire window draggable by default
  document.body.style.webkitAppRegion = 'drag';

  // Make interactive elements non-draggable
  const nonDraggableSelectors = [
    'button',
    'input',
    'textarea',
    'select',
    'a',
    '[contenteditable]',
    '.no-drag',
    '[data-no-drag]'
  ];

  // Apply no-drag to existing elements
  nonDraggableSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      el.style.webkitAppRegion = 'no-drag';
    });
  });

  // Observer to handle dynamically added elements
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if the added node matches non-draggable selectors
          nonDraggableSelectors.forEach(selector => {
            if (node.matches && node.matches(selector)) {
              node.style.webkitAppRegion = 'no-drag';
            }
            // Also check children
            const children = node.querySelectorAll && node.querySelectorAll(selector);
            if (children) {
              children.forEach(child => {
                child.style.webkitAppRegion = 'no-drag';
              });
            }
          });
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Enhanced menu management system
  function setupResponsiveMenus() {
    let currentOpenMenu = null;
    let originalWindowHeight = null;
    let isMenuExpanded = false;

    // Function to expand window for dropdown menus
    function expandWindowForMenu(menuElement) {
      if (isMenuExpanded) return;

      const { ipcRenderer } = require('electron');
      const { BrowserWindow } = require('@electron/remote');
      
      try {
        // Get current window
        const currentWindow = BrowserWindow.getFocusedWindow();
        if (!currentWindow) return;

        // Store original dimensions
        const bounds = currentWindow.getBounds();
        originalWindowHeight = bounds.height;

        // Calculate required height for dropdown
        const menuRect = menuElement.getBoundingClientRect();
        const menuHeight = menuElement.offsetHeight || 200; // Fallback height
        const windowBottom = window.innerHeight;
        const spaceBelow = windowBottom - menuRect.bottom;

        // Only expand if menu would extend beyond window
        if (spaceBelow < menuHeight) {
          const additionalHeight = menuHeight - spaceBelow + 20; // 20px padding
          currentWindow.setSize(bounds.width, bounds.height + additionalHeight);
          isMenuExpanded = true;
        }
      } catch (error) {
        console.log('Window expansion not available, using CSS fallback');
        // CSS-only fallback
        expandWithCSS(menuElement);
      }
    }

    // CSS-only fallback for window expansion
    function expandWithCSS(menuElement) {
      // Create or update dynamic background extension
      let bgExtension = document.getElementById('menu-bg-extension');
      if (!bgExtension) {
        bgExtension = document.createElement('div');
        bgExtension.id = 'menu-bg-extension';
        bgExtension.style.cssText = `
          position: fixed;
          bottom: -200px;
          left: 0;
          right: 0;
          height: 200px;
          background: transparent;
          pointer-events: none;
          z-index: -1;
          transition: all 0.2s ease;
        `;
        document.body.appendChild(bgExtension);
      }

      // Calculate required extension
      const menuRect = menuElement.getBoundingClientRect();
      const windowBottom = window.innerHeight;
      const menuBottom = menuRect.bottom + (menuElement.offsetHeight || 200);
      const extensionNeeded = Math.max(0, menuBottom - windowBottom);

      if (extensionNeeded > 0) {
        bgExtension.style.bottom = `-${extensionNeeded + 20}px`;
        bgExtension.style.height = `${extensionNeeded + 20}px`;
        bgExtension.style.background = 'rgba(0, 0, 0, 0.01)'; // Nearly transparent
        isMenuExpanded = true;
      }
    }

    // Function to restore window size
    function restoreWindowSize() {
      if (!isMenuExpanded) return;

      try {
        const { BrowserWindow } = require('@electron/remote');
        const currentWindow = BrowserWindow.getFocusedWindow();
        
        if (currentWindow && originalWindowHeight) {
          const bounds = currentWindow.getBounds();
          currentWindow.setSize(bounds.width, originalWindowHeight);
        }
      } catch (error) {
        // CSS fallback
        const bgExtension = document.getElementById('menu-bg-extension');
        if (bgExtension) {
          bgExtension.style.bottom = '-200px';
          bgExtension.style.background = 'transparent';
        }
      }

      isMenuExpanded = false;
      originalWindowHeight = null;
    }

    // Enhanced menu click handler
    function handleMenuClick(event) {
      const menuButton = event.currentTarget;
      const menuContainer = menuButton.closest('.menu-container') || menuButton.parentElement;
      
      // Find the dropdown menu
      const dropdown = menuContainer.querySelector('.dropdown-menu, .menu-dropdown, [class*="dropdown"], [class*="menu"]');
      
      if (!dropdown) return;

      // If clicking the same menu that's open, close it
      if (currentOpenMenu === dropdown) {
        closeCurrentMenu();
        return;
      }

      // Close any currently open menu first
      if (currentOpenMenu) {
        closeCurrentMenu();
      }

      // Open the new menu
      currentOpenMenu = dropdown;
      
      // Add responsive background
      setTimeout(() => {
        if (dropdown.offsetParent !== null) { // Menu is visible
          expandWindowForMenu(dropdown);
        }
      }, 50); // Small delay to ensure menu is rendered

      // Set up click-outside handler
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside, true);
      }, 10);
    }

    // Close current menu
    function closeCurrentMenu() {
      if (currentOpenMenu) {
        // Trigger close (if the menu has a close method or remove active class)
        const activeElements = document.querySelectorAll('.active, .open, .show');
        activeElements.forEach(el => {
          el.classList.remove('active', 'open', 'show');
        });

        currentOpenMenu = null;
        restoreWindowSize();
        document.removeEventListener('click', handleClickOutside, true);
      }
    }

    // Handle clicks outside the menu
    function handleClickOutside(event) {
      if (!currentOpenMenu) return;

      const menuContainer = currentOpenMenu.closest('.menu-container') || currentOpenMenu.parentElement;
      
      if (!menuContainer.contains(event.target)) {
        closeCurrentMenu();
      }
    }

    // Set up menu observers
    function observeMenus() {
      // Look for common menu button selectors
      const menuSelectors = [
        '.menu-button',
        '.dropdown-toggle',
        '[data-menu]',
        'button[aria-haspopup]',
        '.three-dots',
        '.kebab-menu',
        '.options-button'
      ];

      menuSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(button => {
          button.addEventListener('click', handleMenuClick);
          button.style.webkitAppRegion = 'no-drag';
        });
      });

      // Generic approach: look for buttons that might trigger dropdowns
      document.querySelectorAll('button').forEach(button => {
        const hasMenuIcon = button.textContent.includes('⋮') || 
                           button.textContent.includes('⋯') || 
                           button.textContent.includes('...') ||
                           button.innerHTML.includes('dots') ||
                           button.innerHTML.includes('menu');

        if (hasMenuIcon) {
          button.addEventListener('click', handleMenuClick);
          button.style.webkitAppRegion = 'no-drag';
        }
      });
    }

    // Initial setup
    observeMenus();

    // Re-observe when DOM changes
    const menuObserver = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches && (node.matches('button') || node.querySelector('button'))) {
              shouldUpdate = true;
            }
          }
        });
      });

      if (shouldUpdate) {
        setTimeout(observeMenus, 100);
      }
    });

    menuObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Close menus when window loses focus
    window.addEventListener('blur', closeCurrentMenu);
    
    // Handle escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && currentOpenMenu) {
        closeCurrentMenu();
      }
    });
  }

  // Add plus button for adding new note cards
  function addPlusButton() {
    // Check if plus button already exists
    if (document.querySelector('.desktop-plus-btn')) {
      return;
    }

    // Find the window controls container
    const windowControls = document.querySelector('.window-controls');
    if (windowControls) {
      // Get all buttons in the controls
      const buttons = windowControls.querySelectorAll('button, .control-btn');

      // Find the change note button (usually has circular arrows icon or is second from left)
      let changeNoteButton = null;

      // Look for the change note button by checking for circular arrows or by position
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const btnText = btn.textContent || btn.innerHTML;
        // Look for circular arrows, refresh icon, or assume it's the first button
        if (btnText.includes('↻') || btnText.includes('🔄') || btnText.includes('⟲') || i === 0) {
          changeNoteButton = btn;
          break;
        }
      }

      // If we can't find it specifically, use the first button
      if (!changeNoteButton && buttons.length > 0) {
        changeNoteButton = buttons[0];
      }

      if (changeNoteButton) {
        // Create plus button that matches the change note button exactly
        const plusButton = document.createElement('button');
        plusButton.className = 'desktop-plus-btn';

        // Copy the original button's classes but avoid duplicates
        const originalClasses = changeNoteButton.className.split(' ').filter(cls => cls !== 'desktop-plus-btn');
        plusButton.className = 'desktop-plus-btn ' + originalClasses.join(' ');

        plusButton.innerHTML = '+';
        plusButton.title = 'Add New Note';

        // Copy all computed styles from the change note button
        const computedStyles = window.getComputedStyle(changeNoteButton);

        // Apply the same styles but ensure proper spacing
        plusButton.style.cssText = `
          width: ${computedStyles.width};
          height: ${computedStyles.height};
          border-radius: ${computedStyles.borderRadius};
          background: ${computedStyles.backgroundColor};
          color: ${computedStyles.color};
          border: ${computedStyles.border};
          box-shadow: ${computedStyles.boxShadow};
          font-family: ${computedStyles.fontFamily};
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          display: ${computedStyles.display};
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          -webkit-app-region: no-drag;
          opacity: ${computedStyles.opacity};
          padding: ${computedStyles.padding};
          margin: ${computedStyles.margin};
          margin-right: 4px;
          position: relative;
          z-index: 1;
        `;

        // Store original styles for hover effects
        const originalBackground = computedStyles.backgroundColor;
        const originalTransform = computedStyles.transform;
        const originalOpacity = computedStyles.opacity;
        const originalBoxShadow = computedStyles.boxShadow;

        // Add hover effect that matches other buttons
        plusButton.addEventListener('mouseenter', () => {
          plusButton.style.opacity = '1';
          plusButton.style.transform = 'scale(1.05)';
          // Slightly darken the background on hover
          if (originalBackground.includes('rgb')) {
            // Darken RGB values slightly
            const rgbMatch = originalBackground.match(/\d+/g);
            if (rgbMatch && rgbMatch.length >= 3) {
              const r = Math.max(0, parseInt(rgbMatch[0]) - 20);
              const g = Math.max(0, parseInt(rgbMatch[1]) - 20);
              const b = Math.max(0, parseInt(rgbMatch[2]) - 20);
              plusButton.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
            }
          }
        });

        plusButton.addEventListener('mouseleave', () => {
          plusButton.style.backgroundColor = originalBackground;
          plusButton.style.transform = originalTransform;
          plusButton.style.opacity = originalOpacity;
          plusButton.style.boxShadow = originalBoxShadow;
        });

        // Add click handler with proper IPC call
        plusButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Plus button clicked, calling addNote...');

          // Try the IPC call and handle any errors
          try {
            if (window.electronAPI && window.electronAPI.addNote) {
              window.electronAPI.addNote();
              console.log('addNote called successfully');
            } else {
              console.error('electronAPI.addNote is not available');
            }
          } catch (error) {
            console.error('Error calling addNote:', error);
          }
        });

        // Insert the plus button as the first child (leftmost position)
        windowControls.insertBefore(plusButton, windowControls.firstChild);

        console.log('Plus button added successfully to the left of change note button');
      } else {
        console.log('No buttons found in window controls');
      }
    } else {
      console.log('Window controls container not found, no fallback button needed');
    }
  }

  // Initialize everything
  setTimeout(() => {
    setupResponsiveMenus();
    addPlusButton();
  }, 1000);

  // Also observe for changes to re-add button if needed
  const controlsObserver = new MutationObserver(() => {
    setTimeout(() => {
      addPlusButton();
      setupResponsiveMenus();
    }, 200);
  });

  controlsObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
});
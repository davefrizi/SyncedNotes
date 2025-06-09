# SyncNote Desktop - Updated Version

This package contains the latest SyncNote Desktop application with the new modern URL selection interface.

## What's New

- Beautiful modern URL selection window
- Improved gradient background matching your notes
- Clean, professional interface design
- Better typography and spacing
- Smooth animations and transitions

## Installation & Setup

### Windows
1. Extract this zip file to your desired location
2. Double-click `install-and-run.bat`
3. The installer will automatically install dependencies and launch the app

### Linux/Mac
1. Extract this zip file to your desired location
2. Open terminal in the extracted folder
3. Make the script executable: `chmod +x install-and-run.sh`
4. Run: `./install-and-run.sh`

### Manual Installation
If the automated scripts don't work:
1. Install Node.js (version 16 or higher)
2. Run: `npm install electron`
3. Start the app: `electron electron/installer-main.js`

## Usage

1. When the app starts, you'll see the new modern URL selection window
2. Enter your note's embed URL (e.g., https://your-site.com/embed/your-note-id)
3. Click "Load Note" to open your note in a floating desktop window
4. The note window can be resized, moved, and stays on top of other windows

## Requirements

- Node.js 16+ 
- Internet connection for downloading notes
- Windows 10+, macOS 10.14+, or modern Linux distribution

## Troubleshooting

- If you see SSL errors, make sure your system date/time is correct
- If the app won't start, try running `npm install electron` manually
- For permission issues on Linux/Mac, run `chmod +x install-and-run.sh`

## Support

For issues or questions, contact support or check the documentation.

---

© 2024 SyncNote Desktop Application

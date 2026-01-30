# Fleet Workflow Builder UX Enhancer

Custom userscript to enhance the web UX for Fleet problem creation and review workflows.

---

## Installation Instructions

### Step 1: Install a Userscript Manager

This script requires a userscript manager browser extension. **Tampermonkey** is recommended as this script was developed and tested with it.

**Download Tampermonkey:**
- [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- [Safari](https://apps.apple.com/app/tampermonkey/id1482490089)
- [Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### Step 2: Enable Developer Mode (If Required)

Some browsers require developer mode to be enabled and may prompt for Tampermonkey permissions. Follow the instructions for your browser:

**Chrome:**
1. Open Chrome and navigate to `chrome://extensions/`
2. Toggle **Developer mode** on (switch in the top-right corner)
3. If Tampermonkey requires permissions, grant them here

**Firefox:**
- Firefox does not require developer mode for installing extensions from the official add-on store
- If you need to install unsigned extensions, go to `about:config` and set `xpinstall.signatures.required` to `false` (not recommended for security reasons)

**Microsoft Edge:**
1. Open Edge and navigate to `edge://extensions/`
2. Toggle **Developer mode** on (switch in the left sidebar)
3. If Tampermonkey requires permissions, grant them here

**Safari:**
1. Open Safari and go to **Safari** → **Settings** (or **Preferences** on older versions)
2. Click the **Advanced** tab
3. Check the box for **Show Develop menu in menu bar**
4. Go to **Develop** → **Allow Unsigned Extensions** (if needed)
5. Note: Safari extensions must be installed from the Mac App Store or signed by a developer

### Step 3: Install the Script

**Option A: Direct Install (Recommended)**

Click the link below to install the script directly:
- [Install Fleet UX Enhancer](https://raw.githubusercontent.com/adastra1826/fleet-ux-improvements/main/fleet.user.js)

Tampermonkey will open an installation prompt. Click **Install** to add the script.

**Option B: Manual Install**

1. Open Tampermonkey in your browser and go to the **Dashboard**
2. Click the **+** tab (or "Create a new script")
3. Delete any template code
4. Copy the contents of `fleet.user.js` and paste it into the editor
5. Press `Ctrl+S` (or `Cmd+S` on Mac) to save

### Step 4: Grant Permissions

When you first visit a Fleet page with the script active, Tampermonkey may ask for additional permissions:

- **Cross-origin requests to `raw.githubusercontent.com`**: Required to load plugins from GitHub. Click **Allow** when prompted.

If the script doesn't seem to be working:
1. Click the Tampermonkey icon in your browser toolbar
2. Ensure the script is **enabled** (toggle should be on)
3. Check that the script is allowed to run on `https://fleetai.com/*`
4. Refresh the page

---

## Features

The extension uses an archetype-based plugin system that loads different features depending on which page you're on.

### Global Features (All Pages)

- **Settings UI**: Configuration panel to enable/disable individual features (accessible via the Fleet UX Enhancer menu)

### Main Dashboard

- **Progress Prompt Expand**: Hover over My Progress task items to expand truncated prompts (with optional click-to-copy)

### Tool Use Task Creation Page

- **Clear Search**: One-click clear for search inputs
- **JSON Editor Online**: In-page JSON editing for tool configuration
- **Guideline Buttons**: Quick links to guidelines below the prompt area
- **Favorites**: Star frequently-used tools for quick access (persists between sessions)
- **Remove Textarea Gradient**: Cleaner textarea appearance
- **Remember Layout Proportions**: Persists and restores the main panel split positions between sessions
- **Prompt and Notes Areas Layout**: Anchors scratchpad to bottom and makes prompt handle control both areas (with option to remember scratchpad text)
- **Execute to Current Tool**: Adds button to execute all tools from the beginning up to and including the current tool

### Tool Use Task Revision Page

- **Clear Search**: One-click clear for search inputs
- **Favorites**: Star frequently-used tools for quick access (persists between sessions)
- **Guideline Buttons**: Quick links to guidelines
- **Bug Report Expand**: Click bug reports to expand and view full content with proper whitespace rendering
- **Prompt Scratchpad**: Scratchpad for notes while revising
- **Execute to Current Tool**: Adds button to execute all tools from the beginning up to and including the current tool

### Computer Use Task Creation Page

- **Remove Textarea Gradient**: Cleaner textarea appearance
- **Hide Testing Environment Banner**: Hides the testing environment notice when not needed
- **Guideline Buttons**: Quick links to guidelines
- **Prompt Scratchpad**: Scratchpad for notes while creating tasks

### Computer Use Task Revision Page

- **Remove Textarea Gradient**: Cleaner textarea appearance
- **Hide Testing Environment Banner**: Hides the testing environment notice when not needed
- **Guideline Buttons**: Quick links to guidelines
- **Bug Report Expand**: Click bug reports to expand and view full content with proper whitespace rendering
- **Prompt Scratchpad**: Scratchpad for notes while revising

### QA Tool Use Review Page

- **Clear Search**: One-click clear for search inputs
- **Favorites**: Star frequently-used tools for quick access (persists between sessions)
- **Bug Report Expand**: Click bug reports to expand and view full content with proper whitespace rendering
- **Copy Prompt**: Copy prompt text to clipboard
- **Copy Verifier Output**: Copy verifier output to clipboard
- **JSON Editor Online**: In-page JSON editing
- **Panel Size Memory**: Remembers your preferred panel sizes between sessions
- **Remember Layout Proportions**: Persists and restores panel split positions between sessions
- **QA Scratchpad**: Adds an adjustable height scratchpad for notes between prompt quality rating and environment variables (with option to remember contents)
- **Guideline Buttons**: Quick links to guidelines below the QA scratchpad
- **Execute to Current Tool**: Adds button to execute all tools from the beginning up to and including the current tool

### QA Computer Use Review Page

- **Hide Testing Environment Banner**: Hides the testing environment notice when not needed
- **Bug Report Expand**: Click bug reports to expand and view full content with proper whitespace rendering
- **Copy Prompt**: Copy prompt text to clipboard
- **Copy Verifier Output**: Copy verifier output to clipboard
- **Guideline Buttons**: Quick links to guidelines
- **Request Revisions Improvements**: Enhanced workflow with auto-copy workflow to "What did you try?", auto-paste prompt to Task issue, and auto-paste verifier output to Grading issue
- **QA Scratchpad**: Adds an adjustable height scratchpad for notes (with option to remember contents)

---

## Configuration

Click the Tampermonkey icon and select "Fleet Workflow Builder UX Enhancer" to access the settings panel. From there you can:

- Enable or disable individual features
- Configure feature-specific options
- View debug logs (dev builds only)

---

## Updating

**Automatic Updates**: Tampermonkey will automatically check for updates and notify you when a new version is available.

**Manual Update**: Click the Tampermonkey icon → Dashboard → select the script → click "Check for updates"

---

## Troubleshooting

**Script not loading:**
- Ensure Tampermonkey is installed and enabled
- Check that the script is enabled in Tampermonkey's dashboard
- Verify the URL matches `https://fleetai.com/*`
- Try refreshing the page

**Features not appearing:**
- Some features only load on specific pages
- Check the Settings UI to ensure the feature is enabled
- Open browser DevTools (F12) and check the console for error messages

**Permission errors:**
- Grant cross-origin request permissions when Tampermonkey prompts
- In Tampermonkey settings, ensure "Allow requests to `raw.githubusercontent.com`" is permitted

---

## Development

This script uses a modular plugin architecture. Plugins are organized by page archetype:

```
plugins/
├── tool-use-task-creation/   # Tool use creation page plugins
├── comp-use-task-creation/   # Computer use creation page plugins
├── qa-tool-use/              # QA tool use review page plugins
├── qa-comp-use/              # QA computer use review page plugins
├── dashboard/                # Dashboard plugins
└── global/                   # Global plugins (all pages)
```

Plugin configuration and versions are managed in `archetypes.json`.

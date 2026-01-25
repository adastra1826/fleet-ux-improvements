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

### Step 2: Install the Script

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

### Step 3: Grant Permissions

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

### Tool Use Task Creation Page

- **Layout Manager**: Customizable multi-column layout with adjustable column widths
- **Favorites**: Star frequently-used tools for quick access (persists between sessions)
- **Expand/Collapse Buttons**: Quickly expand or collapse all workflow steps
- **Mini Execute Buttons**: Execute tools while they're collapsed
- **Duplicate to End**: Button to duplicate a tool step and place it at the end of the workflow
- **Auto-Confirm Re-execute**: Automatically confirms the "Re-execute steps and invalidate results" modal
- **Source Data Explorer**: Visual explorer for browsing source data
- **Autocorrect Disabled**: Prevents autocorrect in textareas and the tool search field
- **Remove Textarea Gradient**: Cleaner textarea appearance

### QA Tool Use Review Page

- **Bug Report Expand**: Click bug reports to expand and view full content with proper whitespace rendering
- **Source Data Explorer**: Visual explorer for browsing source data
- **Panel Size Memory**: Remembers your preferred panel sizes between sessions

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

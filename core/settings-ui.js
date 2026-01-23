
// settings-ui.js
// Core plugin that provides the settings UI - persists across navigation

const plugin = {
    id: 'settings-ui',
    name: 'Settings UI',
    description: 'Provides the settings panel for managing plugins',
    _version: '1.0',
    phase: 'core', // Special phase - loaded once, never cleaned up
    enabledByDefault: true,
    
    // Internal state (not reset on navigation)
    _buttonCreated: false,
    _modalOpen: false,
    
    init(state, context) {
        // Only create the button once
        if (!this._buttonCreated) {
            this._createSettingsButton();
            this._buttonCreated = true;
            Logger.log('✓ Settings UI initialized');
        }
    },
    
    // No destroy method - this plugin persists
    
    _createSettingsButton() {
        if (document.getElementById('wf-settings-btn')) return;
        
        const settingsBtn = document.createElement('button');
        settingsBtn.id = 'wf-settings-btn';
        settingsBtn.title = 'Fleet Enhancer Settings';
        settingsBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--background, white);
            border: 1px solid var(--border, #e5e5e5);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 9999;
            transition: all 0.2s;
        `;
        
        settingsBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;
        
        settingsBtn.addEventListener('mouseenter', () => {
            settingsBtn.style.transform = 'scale(1.1)';
            settingsBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        });
        
        settingsBtn.addEventListener('mouseleave', () => {
            settingsBtn.style.transform = 'scale(1)';
            settingsBtn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        });
        
        settingsBtn.addEventListener('click', () => this._toggleModal());
        
        document.body.appendChild(settingsBtn);
    },
    
    _toggleModal() {
        let modal = document.getElementById('wf-settings-modal');
        
        if (this._modalOpen && modal) {
            modal.style.display = 'none';
            this._modalOpen = false;
        } else {
            // Always recreate modal content when opening to get fresh plugin list
            if (modal) modal.remove();
            modal = this._createModal();
            modal.style.display = 'block';
            this._modalOpen = true;
        }
    },
    
    _closeModal() {
        const modal = document.getElementById('wf-settings-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this._modalOpen = false;
    },
    
    _createModal() {
        const modal = document.createElement('div');
        modal.id = 'wf-settings-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--background, white);
            border: 1px solid var(--border, #e5e5e5);
            border-radius: 12px;
            padding: 24px;
            width: 520px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 10000;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        `;
        
        // Get current state
        const archetype = Context.currentArchetype;
        const allPlugins = PluginManager.getAll();
        const archetypePlugins = allPlugins.filter(p => p.phase !== 'core');
        const version = Context.version || 'unknown';
        
        // Build plugin toggles HTML
        const pluginTogglesHTML = archetypePlugins.length > 0 
            ? archetypePlugins.map(plugin => this._createPluginToggleHTML(plugin)).join('')
            : '<p style="color: #666; font-size: 13px; font-style: italic;">No plugins loaded for this page.</p>';
        
        // Build outdated plugins warning HTML
        const outdatedPluginsHTML = Context.outdatedPlugins && Context.outdatedPlugins.length > 0
            ? this._createOutdatedPluginsHTML(Context.outdatedPlugins)
            : '';
        
        modal.innerHTML = `
            <div>
                <!-- Header -->
                <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px;">
                    <div>
                        <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 4px 0;">Fleet Enhancer Settings</h2>
                        <p style="font-size: 13px; color: var(--muted-foreground, #666); margin: 0;">
                            v${version} · Archetype: <strong>${archetype ? archetype.name : 'None detected'}</strong>
                        </p>
                    </div>
                    <button id="wf-settings-close" style="
                        width: 28px;
                        height: 28px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 6px;
                        border: none;
                        background: transparent;
                        cursor: pointer;
                        transition: background 0.2s;
                        color: var(--foreground, #333);
                    ">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                
                <!-- Outdated Plugins Warning -->
                ${outdatedPluginsHTML}
                
                <!-- Plugins Section -->
                <div style="margin-bottom: 20px;">
                    <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 12px 0; color: var(--foreground, #333);">
                        Plugins (${archetypePlugins.length})
                    </h3>
                    <div id="wf-plugin-list">
                        ${pluginTogglesHTML}
                    </div>
                </div>
                
                <!-- Debug Section -->
                <div style="border-top: 1px solid var(--border, #e5e5e5); padding-top: 16px; margin-bottom: 16px;">
                    <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 12px 0; color: var(--foreground, #333);">
                        Debug Options
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${this._createToggleHTML('wf-debug-enabled', 'Enable Debug Logging', Logger.isDebugEnabled())}
                        ${this._createToggleHTML('wf-verbose-enabled', 'Enable Verbose Logging', Logger.isVerboseEnabled())}
                    </div>
                </div>
                
                <!-- Message area -->
                <div id="wf-settings-message" style="
                    display: none;
                    padding: 12px;
                    background: #fef3c7;
                    border: 1px solid #f59e0b;
                    border-radius: 6px;
                    font-size: 13px;
                    text-align: center;
                    margin-bottom: 16px;
                    color: #92400e;
                ">
                    Settings changed. Refresh the page for changes to take effect.
                </div>
                
                <!-- Footer -->
                <div style="font-size: 11px; color: var(--muted-foreground, #888); text-align: center; padding-top: 12px; border-top: 1px solid var(--border, #e5e5e5);">
                    Fleet Workflow Enhancer · 
                    <a href="#" id="wf-reload-plugins" style="color: var(--brand, #4f46e5); text-decoration: none;">Reload Plugins</a>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Attach event listeners
        this._attachModalListeners(modal, archetypePlugins);
        
        return modal;
    },
    
    _createPluginToggleHTML(plugin) {
        const isEnabled = PluginManager.isEnabled(plugin.id);
        return `
            <div style="display: flex; flex-direction: column; padding: 12px; border: 1px solid var(--border, #e5e5e5); border-radius: 8px; margin-bottom: 10px; background: var(--card, #fafafa);">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <label style="font-size: 14px; font-weight: 500; cursor: pointer; color: var(--foreground, #333);" for="wf-plugin-${plugin.id}">
                        ${plugin.name || plugin.id}
                    </label>
                    ${this._createSwitchHTML(`wf-plugin-${plugin.id}`, isEnabled, plugin.id)}
                </div>
                <div style="font-size: 12px; color: var(--muted-foreground, #666); margin-top: 6px; line-height: 1.4;">
                    ${plugin.description || 'No description available'}
                </div>
            </div>
        `;
    },
    
    _createToggleHTML(id, label, isEnabled) {
        return `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px solid var(--border, #e5e5e5); border-radius: 6px; background: var(--card, #fafafa);">
                <label style="font-size: 13px; color: var(--foreground, #333);" for="${id}">${label}</label>
                ${this._createSwitchHTML(id, isEnabled)}
            </div>
        `;
    },
    
    _createSwitchHTML(id, isEnabled, pluginId = null) {
        const dataAttr = pluginId ? `data-plugin-id="${pluginId}"` : '';
        return `
            <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;">
                <input type="checkbox" id="${id}" ${dataAttr} ${isEnabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0; position: absolute;">
                <span class="wf-toggle-slider" style="
                    position: absolute;
                    cursor: pointer;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-color: ${isEnabled ? 'var(--brand, #4f46e5)' : '#ccc'};
                    transition: 0.2s;
                    border-radius: 24px;
                ">
                    <span style="
                        position: absolute;
                        height: 18px;
                        width: 18px;
                        left: ${isEnabled ? '23px' : '3px'};
                        bottom: 3px;
                        background-color: white;
                        transition: 0.2s;
                        border-radius: 50%;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                    "></span>
                </span>
            </label>
        `;
    },
    
    _attachModalListeners(modal, plugins) {
        const self = this;
        
        // Close button
        modal.querySelector('#wf-settings-close').addEventListener('click', () => {
            self._closeModal();
        });
        
        // Close on click outside
        const handleOutsideClick = (e) => {
            if (self._modalOpen && !modal.contains(e.target) && !e.target.closest('#wf-settings-btn')) {
                self._closeModal();
                document.removeEventListener('click', handleOutsideClick);
            }
        };
        // Delay adding listener to prevent immediate close
        setTimeout(() => document.addEventListener('click', handleOutsideClick), 10);
        
        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape' && self._modalOpen) {
                self._closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Plugin toggles
        plugins.forEach(plugin => {
            const checkbox = modal.querySelector(`#wf-plugin-${plugin.id}`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this._handleToggleChange(e);
                    PluginManager.setEnabled(plugin.id, e.target.checked);
                    this._showMessage();
                });
            }
        });
        
        // Debug toggle
        const debugToggle = modal.querySelector('#wf-debug-enabled');
        if (debugToggle) {
            debugToggle.addEventListener('change', (e) => {
                this._handleToggleChange(e);
                Logger.setDebugEnabled(e.target.checked);
            });
        }
        
        // Verbose toggle
        const verboseToggle = modal.querySelector('#wf-verbose-enabled');
        if (verboseToggle) {
            verboseToggle.addEventListener('change', (e) => {
                this._handleToggleChange(e);
                Logger.setVerboseEnabled(e.target.checked);
            });
        }
        
        // Reload plugins link
        const reloadLink = modal.querySelector('#wf-reload-plugins');
        if (reloadLink) {
            reloadLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.reload();
            });
        }
    },
    
    _handleToggleChange(e) {
        const slider = e.target.nextElementSibling;
        const knob = slider.querySelector('span');
        const isChecked = e.target.checked;
        
        slider.style.backgroundColor = isChecked ? 'var(--brand, #4f46e5)' : '#ccc';
        knob.style.left = isChecked ? '23px' : '3px';
    },
    
    _showMessage() {
        const msg = document.getElementById('wf-settings-message');
        if (msg) {
            msg.style.display = 'block';
        }
    },
    
    _createOutdatedPluginsHTML(outdatedPlugins) {
        const pluginsList = outdatedPlugins.map(p => {
            let versionInfo = '';
            if (p.fetchedVersion) {
                versionInfo = `cached v${p.cachedVersion || 'none'}, fetched v${p.fetchedVersion}, required v${p.requiredVersion}`;
            } else if (p.parseError) {
                versionInfo = `cached v${p.cachedVersion}, parse error during verification, required v${p.requiredVersion}`;
            } else {
                versionInfo = `cached v${p.cachedVersion || 'none'}, required v${p.requiredVersion}`;
            }
            return `<li style="margin: 4px 0;"><strong>${p.filename}</strong>: ${versionInfo}</li>`;
        }).join('');
        
        return `
            <div style="
                margin-bottom: 20px;
                padding: 12px;
                background: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 6px;
            ">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px; color: #f59e0b;">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <h3 style="font-size: 14px; font-weight: 600; margin: 0; color: #92400e;">
                        Outdated Plugins (${outdatedPlugins.length})
                    </h3>
                </div>
                <p style="font-size: 12px; color: #92400e; margin: 8px 0 0 0; line-height: 1.5;">
                    The following plugins could not be updated to the required version. 
                    This may happen if you're offline, the server is unavailable, or GitHub's CDN 
                    hasn't updated yet (can take up to 5 minutes after a change).
                </p>
                <ul style="font-size: 12px; color: #92400e; margin: 8px 0 0 0; padding-left: 20px;">
                    ${pluginsList}
                </ul>
            </div>
        `;
    }
};

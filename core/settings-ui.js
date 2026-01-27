
// settings-ui.js
// Core plugin that provides the settings UI - persists across navigation

const plugin = {
    id: 'settings-ui',
    name: 'Settings UI',
    description: 'Provides the settings panel for managing plugins',
    _version: '3.3',
    phase: 'core', // Special phase - loaded once, never cleaned up
    enabledByDefault: true,
    
    // Internal state (not reset on navigation)
    _buttonCreated: false,
    _modalOpen: false,
    _presenceInterval: null,
    _pulseInterval: null,
    
    init(state, context) {
        this._ensureSettingsButton();
        this._ensureModalPresence();
        this._startPresenceGuard();
        this._updatePulseAnimation();
    },
    
    // No destroy method - this plugin persists
    
    _ensureSettingsButton() {
        if (!document.body) return;
        let settingsBtn = document.getElementById('wf-settings-btn');
        if (!settingsBtn) {
            settingsBtn = document.createElement('button');
            settingsBtn.id = 'wf-settings-btn';
            document.body.appendChild(settingsBtn);
            if (!this._buttonCreated) {
                Logger.log('✓ Settings UI initialized');
                this._buttonCreated = true;
            }
        }
        this._applySettingsButtonBehavior(settingsBtn);
    },

    _applySettingsButtonBehavior(settingsBtn) {
        if (!settingsBtn) return;
        settingsBtn.type = 'button';
        settingsBtn.title = 'Fleet Enhancer Settings';
        
        const baseStyles = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--background, white);
            border: 1px solid #fcd34d;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 9999;
            transition: all 0.2s;
        `;
        
        settingsBtn.style.cssText = baseStyles;
        
        // Add pulsing animation if outdated or override is enabled (dev branch only)
        const shouldPulse = Context.isOutdated || (Context.isDevBranch && this._getPulseOverrideEnabled());
        if (shouldPulse) {
            settingsBtn.classList.add('wf-settings-outdated');
            this._startPulseAnimation(settingsBtn);
        } else {
            settingsBtn.classList.remove('wf-settings-outdated');
            this._stopPulseAnimation();
        }
        settingsBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;

        if (settingsBtn.dataset.wfSettingsBound === 'true') return;
        settingsBtn.dataset.wfSettingsBound = 'true';

        settingsBtn.addEventListener('mouseenter', () => {
            settingsBtn.style.transform = 'scale(1.1)';
            settingsBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        });

        settingsBtn.addEventListener('mouseleave', () => {
            settingsBtn.style.transform = 'scale(1)';
            settingsBtn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        });

        settingsBtn.addEventListener('click', () => this._toggleModal());
    },
    
    _startPulseAnimation(settingsBtn) {
        if (!settingsBtn) return;
        
        // Stop existing animation if any
        if (this._pulseInterval) {
            clearInterval(this._pulseInterval);
            this._pulseInterval = null;
        }
        
        // Ensure smooth transitions
        settingsBtn.style.transition = 'border 1s ease, box-shadow 1s ease';
        
        let isOn = false;
        this._pulseInterval = setInterval(() => {
            isOn = !isOn;
            if (isOn) {
                settingsBtn.style.border = '2px solid #dc2626';
                settingsBtn.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.4)';
            } else {
                settingsBtn.style.border = '1px solid #fcd34d';
                settingsBtn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            }
        }, 1000); // 1 second per state
    },
    
    _stopPulseAnimation() {
        if (this._pulseInterval) {
            clearInterval(this._pulseInterval);
            this._pulseInterval = null;
        }
        const settingsBtn = document.getElementById('wf-settings-btn');
        if (settingsBtn) {
            settingsBtn.style.border = '1px solid #fcd34d';
            settingsBtn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
        }
    },
    
    _updatePulseAnimation() {
        const settingsBtn = document.getElementById('wf-settings-btn');
        if (!settingsBtn) return;
        
        const shouldPulse = Context.isOutdated || (Context.isDevBranch && this._getPulseOverrideEnabled());
        if (shouldPulse) {
            this._startPulseAnimation(settingsBtn);
        } else {
            this._stopPulseAnimation();
        }
    },
    
    _toggleModal() {
        let modal = document.getElementById('wf-settings-modal');
        
        if (this._modalOpen && modal) {
            this._closeModal();
        } else {
            // Always recreate modal content when opening to get fresh plugin list
            if (modal) modal.remove();
            modal = this._createModal();
            modal.style.display = 'block';
            this._modalOpen = true;
        }
    },

    _ensureModalPresence() {
        if (!this._modalOpen) return;
        const modal = document.getElementById('wf-settings-modal');
        if (!modal) {
            const recreated = this._createModal();
            recreated.style.display = 'block';
        }
    },
    
    _closeModal() {
        const modal = document.getElementById('wf-settings-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        const msg = document.getElementById('wf-settings-message');
        if (msg) {
            msg.style.display = 'none';
        }
        this._modalOpen = false;
    },

    _startPresenceGuard() {
        if (this._presenceInterval) return;
        const guard = () => {
            this._ensureSettingsButton();
            this._ensureModalPresence();
        };
        this._presenceInterval = setInterval(guard, 1000);
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
        const archetypeId = archetype ? archetype.id : 'global';
        const allPlugins = PluginManager.getAll();
        const archetypePlugins = allPlugins.filter(p => p.phase !== 'core');
        const orderedPlugins = this._getOrderedPlugins(archetypePlugins, archetypeId);
        const version = Context.version || 'unknown';
        this._settingsArchetypeId = archetypeId;
        this._initialSettingsSnapshot = this._getSettingsSnapshot(archetypePlugins, archetypeId);
        
        // Build plugin toggles HTML
        const submoduleLoggingEnabled = Logger.isSubmoduleLoggingEnabled();
        const globalEnabled = this._getGlobalEnabled();
        const pluginTogglesHTML = orderedPlugins.length > 0 
            ? orderedPlugins.map(plugin => this._createPluginToggleHTML(plugin, submoduleLoggingEnabled, globalEnabled)).join('')
            : '<p style="color: #666; font-size: 13px; font-style: italic;">No plugins loaded for this page.</p>';
        
        // Build outdated plugins warning HTML
        const outdatedPluginsHTML = Context.outdatedPlugins && Context.outdatedPlugins.length > 0
            ? this._createOutdatedPluginsHTML(Context.outdatedPlugins)
            : '';
        
        // Build script update notification HTML
        const updateNotificationHTML = Context.isOutdated && Context.latestVersion
            ? this._createUpdateNotificationHTML()
            : '';
        
        modal.innerHTML = `
            ${updateNotificationHTML}
            <!-- Sticky Header -->
            <div style="position: sticky; top: -24px; margin: -24px -24px 20px -24px; padding: 24px 24px 16px 24px; background: var(--background, white); border-bottom: 1px solid var(--border, #e5e5e5); z-index: 1;">
                <div style="display: flex; align-items: flex-start; justify-content: space-between;">
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
            </div>
            
            <!-- Global Toggle -->
            <div style="margin-bottom: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border: 1px solid var(--border, #e5e5e5); border-radius: 8px; background: var(--card, #fafafa);">
                    <div>
                        <div style="font-size: 14px; font-weight: 600; color: var(--foreground, #333);">Enable Plugins</div>
                        <div style="font-size: 12px; color: var(--muted-foreground, #666); margin-top: 4px;">
                            Disables all plugins on refresh when turned off.
                        </div>
                    </div>
                    ${this._createSwitchHTML('wf-global-enabled', globalEnabled)}
                </div>
                <div id="wf-all-plugins-buttons" style="display: ${globalEnabled ? 'flex' : 'none'}; gap: 8px; margin-top: 10px;">
                    <button id="wf-all-plugins-on" style="
                        flex: 1;
                        padding: 8px 12px;
                        font-size: 13px;
                        font-weight: 500;
                        color: var(--foreground, #333);
                        background: var(--card, #fafafa);
                        border: 1px solid var(--border, #e5e5e5);
                        border-radius: 6px;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">All On</button>
                    <button id="wf-all-plugins-off" style="
                        flex: 1;
                        padding: 8px 12px;
                        font-size: 13px;
                        font-weight: 500;
                        color: var(--foreground, #333);
                        background: var(--card, #fafafa);
                        border: 1px solid var(--border, #e5e5e5);
                        border-radius: 6px;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">All Off</button>
                </div>
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
                    ${this._createToggleHTML('wf-submodule-logging-enabled', 'Enable Submodule Logging', submoduleLoggingEnabled)}
                    ${Context.isDevBranch ? this._createToggleHTML('wf-pulse-override-enabled', 'Override Pulse Animation (Dev)', this._getPulseOverrideEnabled()) : ''}
                </div>
            </div>
            
            <!-- Footer -->
            <div style="font-size: 11px; color: var(--muted-foreground, #888); text-align: center; padding-top: 12px; border-top: 1px solid var(--border, #e5e5e5);">
                Fleet Workflow Enhancer · 
                <a href="#" id="wf-reload-plugins" style="color: var(--brand, #4f46e5); text-decoration: none;">Reload Plugins</a>
            </div>
            
            <!-- Clear Cache Button -->
            <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border, #e5e5e5);">
                <button id="wf-clear-cache" style="
                    width: 100%;
                    padding: 10px 16px;
                    font-size: 13px;
                    font-weight: 500;
                    color: #dc2626;
                    background: transparent;
                    border: 1px solid #dc2626;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                ">Clear Cache</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        this._ensureMessageElement(modal);
        
        // Attach event listeners
        this._attachModalListeners(modal, orderedPlugins);
        this._updateSettingsMessage(modal, archetypePlugins);
        
        return modal;
    },
    
    _createPluginToggleHTML(plugin, submoduleLoggingEnabled, globalEnabled) {
        const isEnabled = PluginManager.isEnabled(plugin.id);
        const isDisabled = !globalEnabled;
        const moduleLoggingEnabled = Logger.isModuleLoggingEnabled(plugin.id);
        
        // Build sub-options HTML if plugin has them
        const subOptionsHTML = this._createSubOptionsHTML(plugin, isEnabled, isDisabled);
        
        const moduleToggleHTML = submoduleLoggingEnabled && isEnabled ? `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border, #e5e5e5);">
                    <label style="font-size: 12px; color: var(--muted-foreground, #666);" for="wf-plugin-log-${plugin.id}">
                        Module Logging
                    </label>
                    ${this._createSwitchHTML(`wf-plugin-log-${plugin.id}`, moduleLoggingEnabled, null, isDisabled)}
                </div>
        ` : '';
        return `
            <div data-plugin-id="${plugin.id}" style="display: flex; flex-direction: column; padding: 12px; border: 1px solid var(--border, #e5e5e5); border-radius: 8px; margin-bottom: 10px; background: var(--card, #fafafa);">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                        <div class="wf-drag-handle" draggable="true" data-plugin-id="${plugin.id}" title="Drag to reorder" style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: grab; color: var(--muted-foreground, #888);">
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                                <line x1="4" y1="5" x2="16" y2="5"></line>
                                <line x1="4" y1="10" x2="16" y2="10"></line>
                                <line x1="4" y1="15" x2="16" y2="15"></line>
                            </svg>
                        </div>
                        <label style="font-size: 14px; font-weight: 500; cursor: pointer; color: var(--foreground, #333); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" for="wf-plugin-${plugin.id}">
                            ${plugin.name || plugin.id}
                        </label>
                    </div>
                    ${this._createSwitchHTML(`wf-plugin-${plugin.id}`, isEnabled, plugin.id, isDisabled)}
                </div>
                <div style="font-size: 12px; color: var(--muted-foreground, #666); margin-top: 6px; line-height: 1.4;">
                    ${plugin.description || 'No description available'}
                </div>
                ${subOptionsHTML}
                ${moduleToggleHTML}
            </div>
        `;
    },
    
    _createSubOptionsHTML(plugin, pluginEnabled, globalDisabled) {
        if (!plugin.subOptions || !Array.isArray(plugin.subOptions) || plugin.subOptions.length === 0) {
            return '';
        }
        
        // Only show sub-options when the plugin is enabled
        if (!pluginEnabled) {
            return '';
        }
        
        const subOptionItems = plugin.subOptions.map(subOption => {
            const subOptionId = `wf-suboption-${plugin.id}-${subOption.id}`;
            const defaultValue = subOption.enabledByDefault !== false;
            const isSubOptionEnabled = Storage.getSubOptionEnabled(plugin.id, subOption.id, defaultValue);
            const isDisabled = globalDisabled;
            
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0;">
                    <div style="flex: 1; min-width: 0;">
                        <label style="font-size: 12px; font-weight: 500; color: var(--foreground, #333); cursor: pointer;" for="${subOptionId}">
                            ${subOption.name || subOption.id}
                        </label>
                        ${subOption.description ? `<div style="font-size: 11px; color: var(--muted-foreground, #888); margin-top: 2px;">${subOption.description}</div>` : ''}
                    </div>
                    ${this._createSwitchHTML(subOptionId, isSubOptionEnabled, null, isDisabled)}
                </div>
            `;
        }).join('');
        
        return `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border, #e5e5e5);">
                <div style="font-size: 11px; font-weight: 600; color: var(--muted-foreground, #888); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
                    Sub-options
                </div>
                ${subOptionItems}
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
    
    _createSwitchHTML(id, isEnabled, pluginId = null, isDisabled = false) {
        const dataAttr = pluginId ? `data-plugin-id="${pluginId}"` : '';
        const disabledAttr = isDisabled ? 'disabled' : '';
        const sliderBg = isDisabled ? '#d1d5db' : (isEnabled ? 'var(--brand, #4f46e5)' : '#ccc');
        const knobBg = isDisabled ? '#f3f4f6' : 'white';
        const knobShadow = isDisabled ? 'none' : '0 1px 3px rgba(0,0,0,0.2)';
        return `
            <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; ${isDisabled ? 'opacity: 0.6; cursor: not-allowed;' : ''}">
                <input type="checkbox" id="${id}" ${dataAttr} ${isEnabled ? 'checked' : ''} ${disabledAttr} style="opacity: 0; width: 0; height: 0; position: absolute;">
                <span class="wf-toggle-slider" style="
                    position: absolute;
                    cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-color: ${sliderBg};
                    transition: 0.2s;
                    border-radius: 24px;
                ">
                    <span style="
                        position: absolute;
                        height: 18px;
                        width: 18px;
                        left: ${isEnabled ? '23px' : '3px'};
                        bottom: 3px;
                        background-color: ${knobBg};
                        transition: 0.2s;
                        border-radius: 50%;
                        box-shadow: ${knobShadow};
                    "></span>
                </span>
            </label>
        `;
    },
    
    _attachModalListeners(modal, plugins) {
        const self = this;
        
        // Close button
        const closeBtn = Context.dom.query('#wf-settings-close', {
            root: modal,
            context: `${this.id}.settingsClose`
        });
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                self._closeModal();
            });
        }
        
        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape' && self._modalOpen) {
                self._closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Global toggle
        const globalToggle = Context.dom.query('#wf-global-enabled', {
            root: modal,
            context: `${this.id}.globalToggle`
        });
        if (globalToggle) {
            globalToggle.addEventListener('change', (e) => {
                this._handleToggleChange(e);
                const isEnabled = e.target.checked;
                this._setGlobalEnabled(isEnabled);
                if (!isEnabled) {
                    this._storeGlobalSnapshot(plugins);
                    plugins.forEach(plugin => {
                        PluginManager.setEnabled(plugin.id, false);
                    });
                } else {
                    this._restoreGlobalSnapshot(plugins);
                }
                this._updateAllPluginsButtonsVisibility(modal, isEnabled);
                this._renderPluginList(modal, plugins);
                this._attachPluginToggleListeners(modal, plugins);
                this._attachPluginReorderListeners(modal, plugins);
                this._updateSettingsMessage(modal, plugins);
            });
        }

        // All On / All Off buttons
        const allOnBtn = Context.dom.query('#wf-all-plugins-on', {
            root: modal,
            context: `${this.id}.allOnButton`
        });
        if (allOnBtn) {
            allOnBtn.addEventListener('click', () => {
                plugins.forEach(plugin => {
                    PluginManager.setEnabled(plugin.id, true);
                });
                this._renderPluginList(modal, plugins);
                this._attachPluginToggleListeners(modal, plugins);
                this._attachPluginReorderListeners(modal, plugins);
                this._updateSettingsMessage(modal, plugins);
            });
            allOnBtn.addEventListener('mouseenter', () => {
                allOnBtn.style.background = 'var(--hover, #f0f0f0)';
                allOnBtn.style.borderColor = 'var(--border-hover, #d1d5db)';
            });
            allOnBtn.addEventListener('mouseleave', () => {
                allOnBtn.style.background = 'var(--card, #fafafa)';
                allOnBtn.style.borderColor = 'var(--border, #e5e5e5)';
            });
        }

        const allOffBtn = Context.dom.query('#wf-all-plugins-off', {
            root: modal,
            context: `${this.id}.allOffButton`
        });
        if (allOffBtn) {
            allOffBtn.addEventListener('click', () => {
                plugins.forEach(plugin => {
                    PluginManager.setEnabled(plugin.id, false);
                });
                this._renderPluginList(modal, plugins);
                this._attachPluginToggleListeners(modal, plugins);
                this._attachPluginReorderListeners(modal, plugins);
                this._updateSettingsMessage(modal, plugins);
            });
            allOffBtn.addEventListener('mouseenter', () => {
                allOffBtn.style.background = 'var(--hover, #f0f0f0)';
                allOffBtn.style.borderColor = 'var(--border-hover, #d1d5db)';
            });
            allOffBtn.addEventListener('mouseleave', () => {
                allOffBtn.style.background = 'var(--card, #fafafa)';
                allOffBtn.style.borderColor = 'var(--border, #e5e5e5)';
            });
        }

        // Plugin toggles
        this._attachPluginToggleListeners(modal, plugins);
        this._attachPluginReorderListeners(modal, plugins);
        
        // Debug toggle
        const debugToggle = Context.dom.query('#wf-debug-enabled', {
            root: modal,
            context: `${this.id}.debugToggle`
        });
        if (debugToggle) {
            debugToggle.addEventListener('change', (e) => {
                this._handleToggleChange(e);
                Logger.setDebugEnabled(e.target.checked);
                this._updateSettingsMessage(modal, plugins);
            });
        }
        
        // Verbose toggle
        const verboseToggle = Context.dom.query('#wf-verbose-enabled', {
            root: modal,
            context: `${this.id}.verboseToggle`
        });
        if (verboseToggle) {
            verboseToggle.addEventListener('change', (e) => {
                this._handleToggleChange(e);
                Logger.setVerboseEnabled(e.target.checked);
                this._updateSettingsMessage(modal, plugins);
            });
        }

        // Submodule logging toggle
        const submoduleToggle = Context.dom.query('#wf-submodule-logging-enabled', {
            root: modal,
            context: `${this.id}.submoduleToggle`
        });
        if (submoduleToggle) {
            submoduleToggle.addEventListener('change', (e) => {
                this._handleToggleChange(e);
                Logger.setSubmoduleLoggingEnabled(e.target.checked);
                this._renderPluginList(modal, plugins);
                this._attachPluginToggleListeners(modal, plugins);
                this._attachPluginReorderListeners(modal, plugins);
                this._updateSettingsMessage(modal, plugins);
            });
        }
        
        // Pulse override toggle (dev branch only)
        if (Context.isDevBranch) {
            const pulseOverrideToggle = Context.dom.query('#wf-pulse-override-enabled', {
                root: modal,
                context: `${this.id}.pulseOverrideToggle`
            });
            if (pulseOverrideToggle) {
                pulseOverrideToggle.addEventListener('change', (e) => {
                    this._handleToggleChange(e);
                    this._setPulseOverrideEnabled(e.target.checked);
                    this._updatePulseAnimation();
                    this._updateSettingsMessage(modal, plugins);
                });
            }
        }
        
        // Reload plugins link
        const reloadLink = Context.dom.query('#wf-reload-plugins', {
            root: modal,
            context: `${this.id}.reloadLink`
        });
        if (reloadLink) {
            reloadLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.reload();
            });
        }
        
        // Clear cache button
        const clearCacheBtn = Context.dom.query('#wf-clear-cache', {
            root: modal,
            context: `${this.id}.clearCacheButton`
        });
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                const confirmed = confirm('Are you sure? This will clear *all* settings and data stored by this userscript.');
                if (confirmed) {
                    const allPlugins = PluginManager.getAll();
                    const clearedCount = Storage.clearAll(allPlugins);
                    Logger.log(`✓ Cache cleared: ${clearedCount} keys removed`);
                    alert(`Cache cleared successfully. ${clearedCount} storage keys were removed. The page will now reload.`);
                    window.location.reload();
                }
            });
            clearCacheBtn.addEventListener('mouseenter', () => {
                clearCacheBtn.style.background = '#fee2e2';
                clearCacheBtn.style.borderColor = '#b91c1c';
            });
            clearCacheBtn.addEventListener('mouseleave', () => {
                clearCacheBtn.style.background = 'transparent';
                clearCacheBtn.style.borderColor = '#dc2626';
            });
        }
    },
    
    _handleToggleChange(e) {
        const slider = e.target.nextElementSibling;
        const knob = Context.dom.query('span', {
            root: slider,
            context: `${this.id}.toggleKnob`
        });
        const isChecked = e.target.checked;
        
        slider.style.backgroundColor = isChecked ? 'var(--brand, #4f46e5)' : '#ccc';
        if (knob) {
            knob.style.left = isChecked ? '23px' : '3px';
        }
    },

    _renderPluginList(modal, plugins) {
        const container = Context.dom.query('#wf-plugin-list', {
            root: modal,
            context: `${this.id}.pluginList`
        });
        if (!container) return;
        if (!plugins || plugins.length === 0) {
            container.innerHTML = '<p style="color: #666; font-size: 13px; font-style: italic;">No plugins loaded for this page.</p>';
            return;
        }
        const submoduleLoggingEnabled = Logger.isSubmoduleLoggingEnabled();
        const globalEnabled = this._getGlobalEnabled();
        const orderedPlugins = this._getOrderedPlugins(plugins, this._settingsArchetypeId);
        container.innerHTML = orderedPlugins
            .map(plugin => this._createPluginToggleHTML(plugin, submoduleLoggingEnabled, globalEnabled))
            .join('');
    },

    _attachPluginToggleListeners(modal, plugins) {
        plugins.forEach(plugin => {
            const checkbox = Context.dom.query(`#wf-plugin-${plugin.id}`, {
                root: modal,
                context: `${this.id}.pluginToggle`
            });
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this._handleToggleChange(e);
                    PluginManager.setEnabled(plugin.id, e.target.checked);
                    this._renderPluginList(modal, plugins);
                    this._attachPluginToggleListeners(modal, plugins);
                    this._attachPluginReorderListeners(modal, plugins);
                    this._updateSettingsMessage(modal, plugins);
                });
            }
            
            // Attach sub-option toggle listeners
            if (plugin.subOptions && Array.isArray(plugin.subOptions)) {
                plugin.subOptions.forEach(subOption => {
                    const subOptionCheckbox = Context.dom.query(`#wf-suboption-${plugin.id}-${subOption.id}`, {
                        root: modal,
                        context: `${this.id}.subOptionToggle`
                    });
                    if (subOptionCheckbox) {
                        subOptionCheckbox.addEventListener('change', (e) => {
                            this._handleToggleChange(e);
                            Storage.setSubOptionEnabled(plugin.id, subOption.id, e.target.checked);
                            this._updateSettingsMessage(modal, plugins);
                        });
                    }
                });
            }
            
            const moduleCheckbox = Context.dom.query(`#wf-plugin-log-${plugin.id}`, {
                root: modal,
                context: `${this.id}.pluginLogToggle`
            });
            if (moduleCheckbox) {
                moduleCheckbox.addEventListener('change', (e) => {
                    this._handleToggleChange(e);
                    Logger.setModuleLoggingEnabled(plugin.id, e.target.checked);
                    this._updateSettingsMessage(modal, plugins);
                });
            }
        });
    },

    _attachPluginReorderListeners(modal, plugins) {
        const list = Context.dom.query('#wf-plugin-list', {
            root: modal,
            context: `${this.id}.pluginListReorder`
        });
        if (!list || list.dataset.wfReorderBound === 'true') return;
        list.dataset.wfReorderBound = 'true';

        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move';
            }
        });

        list.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetItem = Context.dom.closest(e.target, '[data-plugin-id]', {
                root: list,
                context: `${this.id}.pluginDropTarget`
            });
            if (!targetItem) return;
            const targetId = targetItem.getAttribute('data-plugin-id');
            const draggedId = this._draggingPluginId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
            if (!draggedId || draggedId === targetId) return;

            const order = this._getStoredPluginOrder(this._settingsArchetypeId, plugins);
            const fromIndex = order.indexOf(draggedId);
            const toIndex = order.indexOf(targetId);
            if (fromIndex === -1 || toIndex === -1) return;
            order.splice(fromIndex, 1);
            order.splice(toIndex, 0, draggedId);
            this._setStoredPluginOrder(this._settingsArchetypeId, order);
            this._renderPluginList(modal, plugins);
            this._attachPluginToggleListeners(modal, plugins);
            this._attachPluginReorderListeners(modal, plugins);
            this._updateSettingsMessage(modal, plugins);
        });

        list.addEventListener('dragstart', (e) => {
            const handle = Context.dom.closest(e.target, '.wf-drag-handle', {
                root: list,
                context: `${this.id}.pluginDragHandle`
            });
            if (!handle || !list.contains(handle)) return;
            const id = handle.getAttribute('data-plugin-id');
            if (!id) return;
            this._draggingPluginId = id;
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', id);
            }
            handle.style.cursor = 'grabbing';
        });

        list.addEventListener('dragend', (e) => {
            const handle = Context.dom.closest(e.target, '.wf-drag-handle', {
                root: list,
                context: `${this.id}.pluginDragHandleEnd`
            });
            if (handle) {
                handle.style.cursor = 'grab';
            }
            this._draggingPluginId = null;
        });
    },

    _getOrderedPlugins(plugins, archetypeId) {
        if (!plugins || plugins.length === 0) return [];
        const order = this._getStoredPluginOrder(archetypeId, plugins);
        const byId = new Map(plugins.map(plugin => [plugin.id, plugin]));
        return order.map(id => byId.get(id)).filter(Boolean);
    },

    _getPluginOrderKey(archetypeId) {
        return `plugin-order-${archetypeId || 'global'}`;
    },

    _setStoredPluginOrder(archetypeId, order) {
        const key = this._getPluginOrderKey(archetypeId);
        Storage.set(key, JSON.stringify(order || []));
    },

    _getStoredPluginOrder(archetypeId, plugins) {
        const ids = plugins.map(plugin => plugin.id);
        const key = this._getPluginOrderKey(archetypeId);
        const storedRaw = Storage.get(key, null);
        let stored = null;
        if (storedRaw) {
            try {
                stored = JSON.parse(storedRaw);
            } catch (e) {
                Logger.error(`Failed to parse plugin order for ${key}:`, e);
            }
        }
        if (!stored || !Array.isArray(stored)) {
            this._setStoredPluginOrder(archetypeId, ids);
            return ids;
        }
        const valid = new Set(ids);
        const filtered = stored.filter(id => valid.has(id));
        const missing = ids.filter(id => !filtered.includes(id));
        const normalized = filtered.concat(missing);
        if (JSON.stringify(stored) !== JSON.stringify(normalized)) {
            this._setStoredPluginOrder(archetypeId, normalized);
        }
        return normalized;
    },

    _getSettingsSnapshot(plugins, archetypeId) {
        const sortedPlugins = plugins
            .map(plugin => plugin)
            .sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        return {
            globalEnabled: this._getGlobalEnabled(),
            debug: Logger.isDebugEnabled(),
            verbose: Logger.isVerboseEnabled(),
            submoduleLogging: Logger.isSubmoduleLoggingEnabled(),
            pluginStates: sortedPlugins.map(plugin => {
                const state = {
                    id: plugin.id,
                    enabled: PluginManager.isEnabled(plugin.id),
                    moduleLogging: Logger.isModuleLoggingEnabled(plugin.id)
                };
                // Include sub-option states if plugin has them
                if (plugin.subOptions && Array.isArray(plugin.subOptions)) {
                    state.subOptions = plugin.subOptions.map(subOption => ({
                        id: subOption.id,
                        enabled: Storage.getSubOptionEnabled(plugin.id, subOption.id, subOption.enabledByDefault !== false)
                    }));
                }
                return state;
            }),
            pluginOrder: this._getStoredPluginOrder(archetypeId, plugins)
        };
    },

    _getGlobalEnabled() {
        return Storage.get('global-plugins-enabled', true);
    },

    _setGlobalEnabled(enabled) {
        Storage.set('global-plugins-enabled', enabled);
    },
    
    _getPulseOverrideEnabled() {
        return Storage.get('pulse-override-enabled', false);
    },
    
    _setPulseOverrideEnabled(enabled) {
        Storage.set('pulse-override-enabled', enabled);
    },

    _storeGlobalSnapshot(plugins) {
        if (!Array.isArray(plugins)) return;
        const snapshot = plugins.map(plugin => ({
            id: plugin.id,
            enabled: PluginManager.isEnabled(plugin.id)
        }));
        Storage.set('global-plugins-previous', JSON.stringify(snapshot));
    },

    _restoreGlobalSnapshot(plugins) {
        if (!Array.isArray(plugins)) return;
        const raw = Storage.get('global-plugins-previous', null);
        if (!raw) return;
        let snapshot = null;
        try {
            snapshot = JSON.parse(raw);
        } catch (e) {
            Logger.error('Failed to parse global plugins snapshot:', e);
            return;
        }
        if (!Array.isArray(snapshot)) return;
        const byId = new Map(snapshot.map(item => [item.id, item.enabled]));
        plugins.forEach(plugin => {
            if (byId.has(plugin.id)) {
                PluginManager.setEnabled(plugin.id, Boolean(byId.get(plugin.id)));
            }
        });
    },

    _ensureMessageElement(modal) {
        let msg = document.getElementById('wf-settings-message');
        if (!msg) {
            msg = document.createElement('div');
            msg.id = 'wf-settings-message';
            msg.style.cssText = `
                position: fixed;
                display: none;
                padding: 12px;
                background: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 6px;
                font-size: 13px;
                text-align: center;
                color: #92400e;
                z-index: 10001;
            `;
            msg.innerHTML = 'Settings changed. <a href="#" id="wf-settings-refresh-link" style="color: #92400e; text-decoration: underline;">Refresh</a> the page for changes to take effect.';
            document.body.appendChild(msg);
            
            // Attach click listener for the refresh link
            const refreshLink = msg.querySelector('#wf-settings-refresh-link');
            if (refreshLink) {
                refreshLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.location.reload();
                });
            }
        }
        this._positionMessage(modal, msg);
        return msg;
    },

    _positionMessage(modal, msg) {
        if (!modal || !msg) return;
        const rect = modal.getBoundingClientRect();
        msg.style.left = `${rect.left}px`;
        msg.style.top = `${rect.bottom + 8}px`;
        msg.style.width = `${rect.width}px`;
    },

    _updateSettingsMessage(modal, plugins) {
        const msg = this._ensureMessageElement(modal);
        const current = this._getSettingsSnapshot(plugins, this._settingsArchetypeId);
        const changed = JSON.stringify(current) !== JSON.stringify(this._initialSettingsSnapshot);
        msg.style.display = changed ? 'block' : 'none';
        if (changed) {
            this._positionMessage(modal, msg);
        }
    },

    _updateAllPluginsButtonsVisibility(modal, globalEnabled) {
        const buttonsContainer = Context.dom.query('#wf-all-plugins-buttons', {
            root: modal,
            context: `${this.id}.allPluginsButtonsVisibility`
        });
        
        if (buttonsContainer) {
            buttonsContainer.style.display = globalEnabled ? 'flex' : 'none';
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
    },
    
    _createUpdateNotificationHTML() {
        const currentVersion = Context.version || 'unknown';
        const latestVersion = Context.latestVersion || 'unknown';
        
        return `
            <div style="
                margin-bottom: 20px;
                padding: 14px;
                background: #fee2e2;
                border: 2px solid #dc2626;
                border-radius: 8px;
            ">
                <div style="display: flex; align-items: flex-start; margin-bottom: 10px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 10px; color: #dc2626; flex-shrink: 0; margin-top: 2px;">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <div style="flex: 1;">
                        <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 8px 0; color: #991b1b;">
                            Extension Update Available
                        </h3>
                        <p style="font-size: 13px; color: #991b1b; margin: 0 0 10px 0; line-height: 1.5;">
                            Your current version of this extension (<strong>${currentVersion}</strong>) is outdated. 
                            Please update to the newest version (<strong>${latestVersion}</strong>).
                        </p>
                        <div style="font-size: 12px; color: #991b1b; background: rgba(220, 38, 38, 0.1); padding: 10px; border-radius: 6px; line-height: 1.6;">
                            <strong>How to update:</strong>
                            <ol style="margin: 6px 0 0 0; padding-left: 20px;">
                                <li>Open your browser's extension manager (Tampermonkey/Violentmonkey)</li>
                                <li>Find this userscript in the list</li>
                                <li>Click "Check for updates" or the update button</li>
                                <li>Reload the page after the update completes</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};

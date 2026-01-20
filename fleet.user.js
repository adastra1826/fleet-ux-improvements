// ==UserScript==
// @name         [MODULAR] Fleet Workflow Builder UX Enhancer
// @namespace    http://tampermonkey.net/
// @version      x.x.x
// @description  UX improvements for workflow builder tool with archetype-based plugin loading
// @author       You
// @match        https://fleetai.com/work/problems/create*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ============= CORE CONFIGURATION =============
    const VERSION = 'x.x.1';
    const STORAGE_PREFIX = 'wf-enhancer-';
    
    // GitHub repository configuration
    const GITHUB_CONFIG = {
        owner: 'adastra1826',
        repo: 'fleet-ux-improvements',
        branch: 'v1',
        pluginsPath: 'plugins', // folder containing plugin files
        archetypesPath: 'archetypes.json' // archetypes configuration file
    };

    // ============= SHARED CONTEXT =============
    const Context = {
        source: null,
        initialized: false,
        currentArchetype: null,
        getPageWindow: () => typeof unsafeWindow !== 'undefined' ? unsafeWindow : window,
    };

    // ============= STORAGE MANAGER =============
    const Storage = {
        get(key, defaultValue) {
            return GM_getValue(STORAGE_PREFIX + key, defaultValue);
        },
        set(key, value) {
            GM_setValue(STORAGE_PREFIX + key, value);
        },
        getPluginEnabled(pluginId) {
            const plugin = PluginManager.get(pluginId);
            const defaultValue = plugin ? plugin.enabledByDefault : true;
            return this.get(`plugin-${pluginId}-enabled`, defaultValue);
        },
        setPluginEnabled(pluginId, enabled) {
            this.set(`plugin-${pluginId}-enabled`, enabled);
        }
    };

    // ============= LOGGING =============
    const Logger = {
        _debugEnabled: null,
        _verboseEnabled: null,
        
        isDebugEnabled() {
            if (this._debugEnabled === null) {
                this._debugEnabled = Storage.get('debug', true);
            }
            return this._debugEnabled;
        },
        
        isVerboseEnabled() {
            if (this._verboseEnabled === null) {
                this._verboseEnabled = Storage.get('verbose', false);
            }
            return this._verboseEnabled;
        },
        
        setDebugEnabled(enabled) {
            this._debugEnabled = enabled;
            Storage.set('debug', enabled);
        },
        
        setVerboseEnabled(enabled) {
            this._verboseEnabled = enabled;
            Storage.set('verbose', enabled);
        },
        
        log(msg, ...args) {
            if (this.isDebugEnabled()) {
                console.log(`[Fleet Enhancer] ${msg}`, ...args);
            }
        },
        
        debug(msg, ...args) {
            if (this.isVerboseEnabled()) {
                console.debug(`[Fleet Enhancer] 🔍 ${msg}`, ...args);
            }
        },
        
        warn(msg, ...args) {
            console.warn(`[Fleet Enhancer] ⚠️ ${msg}`, ...args);
        },
        
        error(msg, ...args) {
            console.error(`[Fleet Enhancer] ❌ ${msg}`, ...args);
        }
    };

    // ============= ARCHETYPE MANAGER =============
    const ArchetypeManager = {
        archetypes: [],
        currentArchetype: null,
        
        async loadArchetypes() {
            const url = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.archetypesPath}`;
            
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: function(response) {
                        if (response.status === 200) {
                            try {
                                const config = JSON.parse(response.responseText);
                                ArchetypeManager.archetypes = config.archetypes || [];
                                Logger.log(`✓ Loaded ${ArchetypeManager.archetypes.length} archetypes`);
                                resolve(config);
                            } catch (e) {
                                Logger.error('Failed to parse archetypes config:', e);
                                reject(e);
                            }
                        } else {
                            Logger.error(`Failed to load archetypes: ${response.status}`);
                            reject(new Error(`HTTP ${response.status}`));
                        }
                    },
                    onerror: function(error) {
                        Logger.error('Network error loading archetypes:', error);
                        reject(error);
                    }
                });
            });
        },
        
        detectArchetype() {
            // Wait for a reasonable time for key elements to load
            return new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 20;
                const checkInterval = 500; // Check every 500ms
                
                const checkForArchetype = () => {
                    attempts++;
                    
                    // Try to match each archetype in order
                    for (const archetype of this.archetypes) {
                        Logger.debug(`Checking archetype: ${archetype.id}`);
                        
                        // Check if all required selectors are present
                        const allSelectorsPresent = archetype.requiredSelectors.every(selector => {
                            const exists = document.querySelector(selector) !== null;
                            Logger.debug(`  Selector "${selector}": ${exists ? '✓' : '✗'}`);
                            return exists;
                        });
                        
                        if (allSelectorsPresent) {
                            Logger.log(`✓ Detected archetype: ${archetype.id} - ${archetype.name}`);
                            this.currentArchetype = archetype;
                            Context.currentArchetype = archetype;
                            resolve(archetype);
                            return;
                        }
                    }
                    
                    // If no archetype matched and we haven't exceeded max attempts, try again
                    if (attempts < maxAttempts) {
                        Logger.debug(`No archetype matched yet. Attempt ${attempts}/${maxAttempts}`);
                        setTimeout(checkForArchetype, checkInterval);
                    } else {
                        Logger.warn('No matching archetype found after maximum attempts');
                        resolve(null);
                    }
                };
                
                // Start checking
                checkForArchetype();
            });
        },
        
        getPluginsForCurrentArchetype() {
            if (!this.currentArchetype) {
                Logger.warn('No archetype detected, loading no plugins');
                return [];
            }
            
            return this.currentArchetype.plugins || [];
        }
    };

    // ============= PLUGIN LOADER =============
    const PluginLoader = {
        async loadPlugin(filename) {
            const url = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.pluginsPath}/${filename}`;
            
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: function(response) {
                        if (response.status === 200) {
                            try {
                                // Create a function that returns the plugin object
                                const pluginFactory = new Function(
                                    'PluginManager',
                                    'Storage',
                                    'Logger',
                                    'Context',
                                    response.responseText + '\n\n// Return the plugin for registration\nreturn plugin;'
                                );
                                
                                // Execute and get the plugin
                                const plugin = pluginFactory(
                                    PluginManager,
                                    Storage,
                                    Logger,
                                    Context
                                );
                                
                                resolve(plugin);
                            } catch (e) {
                                Logger.error(`Failed to parse plugin ${filename}:`, e);
                                reject(e);
                            }
                        } else {
                            Logger.error(`Failed to load plugin ${filename}: ${response.status}`);
                            reject(new Error(`HTTP ${response.status}`));
                        }
                    },
                    onerror: function(error) {
                        Logger.error(`Network error loading plugin ${filename}:`, error);
                        reject(error);
                    }
                });
            });
        },
        
        async loadPluginsForArchetype(pluginList) {
            if (!pluginList || pluginList.length === 0) {
                Logger.log('No plugins to load for this archetype');
                return;
            }
            
            Logger.log(`Loading ${pluginList.length} plugins for archetype...`);
            const loadPromises = [];
            
            for (const filename of pluginList) {
                loadPromises.push(
                    this.loadPlugin(filename)
                        .then(plugin => {
                            PluginManager.register(plugin);
                            Logger.log(`✓ Loaded plugin: ${filename}`);
                        })
                        .catch(err => {
                            Logger.error(`✗ Failed to load plugin: ${filename}`, err);
                        })
                );
            }
            
            await Promise.allSettled(loadPromises);
            Logger.log('Plugin loading complete');
        }
    };

    // ============= SETTINGS UI MANAGER =============
    const SettingsUI = {
        modalOpen: false,
        
        createModal() {
            const existingModal = document.getElementById('wf-settings-modal');
            if (existingModal) existingModal.remove();

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
                width: 500px;
                max-height: 70vh;
                overflow-y: auto;
                z-index: 10000;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                display: none;
            `;

            const plugins = PluginManager.getAll();
            const archetype = Context.currentArchetype;
            
            const pluginToggles = plugins.map(plugin => {
                const isEnabled = PluginManager.isEnabled(plugin.id);
                return `
                    <div style="display: flex; flex-direction: column; padding: 12px; border: 1px solid var(--border, #e5e5e5); border-radius: 8px; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                            <label style="font-size: 15px; font-weight: 500; flex: 1; cursor: pointer;" for="wf-plugin-${plugin.id}">
                                ${plugin.name || plugin.id}
                            </label>
                            <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                                <input type="checkbox" id="wf-plugin-${plugin.id}" data-plugin-id="${plugin.id}" ${isEnabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="wf-toggle-slider" style="
                                    position: absolute;
                                    cursor: pointer;
                                    top: 0; left: 0; right: 0; bottom: 0;
                                    background-color: ${isEnabled ? 'var(--brand, #4f46e5)' : '#ccc'};
                                    transition: 0.3s;
                                    border-radius: 24px;
                                ">
                                    <span style="
                                        position: absolute;
                                        content: '';
                                        height: 18px;
                                        width: 18px;
                                        left: ${isEnabled ? '23px' : '3px'};
                                        bottom: 3px;
                                        background-color: white;
                                        transition: 0.3s;
                                        border-radius: 50%;
                                    "></span>
                                </span>
                            </label>
                        </div>
                        <div style="font-size: 13px; color: var(--muted-foreground, #666); margin-top: 4px;">
                            ${plugin.description || 'No description available'}
                        </div>
                    </div>
                `;
            }).join('');

            const modalContent = `
                <div class="space-y-4">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 style="font-size: 18px; font-weight: 600;">WF Enhancer Settings</h2>
                            <p style="font-size: 13px; color: var(--muted-foreground, #666); margin-top: 4px;">
                                Archetype: <strong>${archetype ? archetype.name : 'Unknown'}</strong>
                            </p>
                        </div>
                        <button id="wf-settings-close" style="
                            width: 24px;
                            height: 24px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border-radius: 4px;
                            border: none;
                            background: transparent;
                            cursor: pointer;
                            transition: background 0.2s;
                        " onmouseover="this.style.background='var(--accent, #f3f4f6)'" onmouseout="this.style.background='transparent'">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>

                    <div style="border-bottom: 1px solid var(--border, #e5e5e5); margin-bottom: 16px; padding-bottom: 16px;">
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">Loaded Plugins (${plugins.length})</h3>
                        ${pluginToggles}
                    </div>

                    <div style="border-bottom: 1px solid var(--border, #e5e5e5); margin-bottom: 16px; padding-bottom: 16px;">
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">Debug Options</h3>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <label style="font-size: 14px; flex: 1;">Enable Debug Logging</label>
                                <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                                    <input type="checkbox" id="wf-debug-enabled" ${Logger.isDebugEnabled() ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                    <span class="wf-toggle-slider" style="
                                        position: absolute;
                                        cursor: pointer;
                                        top: 0; left: 0; right: 0; bottom: 0;
                                        background-color: ${Logger.isDebugEnabled() ? 'var(--brand, #4f46e5)' : '#ccc'};
                                        transition: 0.3s;
                                        border-radius: 24px;
                                    ">
                                        <span style="
                                            position: absolute;
                                            content: '';
                                            height: 18px;
                                            width: 18px;
                                            left: ${Logger.isDebugEnabled() ? '23px' : '3px'};
                                            bottom: 3px;
                                            background-color: white;
                                            transition: 0.3s;
                                            border-radius: 50%;
                                        "></span>
                                    </span>
                                </label>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <label style="font-size: 14px; flex: 1;">Enable Verbose Logging</label>
                                <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                                    <input type="checkbox" id="wf-verbose-enabled" ${Logger.isVerboseEnabled() ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                    <span class="wf-toggle-slider" style="
                                        position: absolute;
                                        cursor: pointer;
                                        top: 0; left: 0; right: 0; bottom: 0;
                                        background-color: ${Logger.isVerboseEnabled() ? 'var(--brand, #4f46e5)' : '#ccc'};
                                        transition: 0.3s;
                                        border-radius: 24px;
                                    ">
                                        <span style="
                                            position: absolute;
                                            content: '';
                                            height: 18px;
                                            width: 18px;
                                            left: ${Logger.isVerboseEnabled() ? '23px' : '3px'};
                                            bottom: 3px;
                                            background-color: white;
                                            transition: 0.3s;
                                            border-radius: 50%;
                                        "></span>
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div id="wf-settings-message" style="
                        display: none;
                        padding: 12px;
                        background: var(--accent, #f3f4f6);
                        border-radius: 6px;
                        font-size: 13px;
                        text-align: center;
                        margin-top: 16px;
                    ">
                        Settings changed. Some changes may require a page refresh to take effect.
                    </div>

                    <div style="font-size: 11px; color: var(--muted-foreground, #666); text-align: center; margin-top: 16px;">
                        WF Enhancer v${VERSION}
                    </div>
                </div>
            `;

            modal.innerHTML = modalContent;
            document.body.appendChild(modal);

            // Add event listeners for plugin toggles
            plugins.forEach(plugin => {
                const checkbox = modal.querySelector(`#wf-plugin-${plugin.id}`);
                if (checkbox) {
                    checkbox.addEventListener('change', (e) => {
                        const span = e.target.nextElementSibling;
                        const innerSpan = span.querySelector('span');
                        const isChecked = e.target.checked;

                        if (isChecked) {
                            span.style.backgroundColor = 'var(--brand, #4f46e5)';
                            innerSpan.style.left = '23px';
                        } else {
                            span.style.backgroundColor = '#ccc';
                            innerSpan.style.left = '3px';
                        }

                        PluginManager.setEnabled(plugin.id, isChecked);
                        document.getElementById('wf-settings-message').style.display = 'block';
                    });
                }
            });

            // Add debug toggle listeners
            const debugToggle = modal.querySelector('#wf-debug-enabled');
            if (debugToggle) {
                debugToggle.addEventListener('change', (e) => {
                    const span = e.target.nextElementSibling;
                    const innerSpan = span.querySelector('span');
                    const isChecked = e.target.checked;

                    if (isChecked) {
                        span.style.backgroundColor = 'var(--brand, #4f46e5)';
                        innerSpan.style.left = '23px';
                    } else {
                        span.style.backgroundColor = '#ccc';
                        innerSpan.style.left = '3px';
                    }

                    Logger.setDebugEnabled(isChecked);
                });
            }

            const verboseToggle = modal.querySelector('#wf-verbose-enabled');
            if (verboseToggle) {
                verboseToggle.addEventListener('change', (e) => {
                    const span = e.target.nextElementSibling;
                    const innerSpan = span.querySelector('span');
                    const isChecked = e.target.checked;

                    if (isChecked) {
                        span.style.backgroundColor = 'var(--brand, #4f46e5)';
                        innerSpan.style.left = '23px';
                    } else {
                        span.style.backgroundColor = '#ccc';
                        innerSpan.style.left = '3px';
                    }

                    Logger.setVerboseEnabled(isChecked);
                });
            }

            // Close button
            modal.querySelector('#wf-settings-close').addEventListener('click', () => {
                modal.style.display = 'none';
                this.modalOpen = false;
            });

            // Click outside to close
            document.addEventListener('click', (e) => {
                if (this.modalOpen && !modal.contains(e.target) && !e.target.closest('#wf-settings-btn')) {
                    modal.style.display = 'none';
                    this.modalOpen = false;
                }
            });

            return modal;
        },

        addSettingsButton() {
            if (document.getElementById('wf-settings-btn')) return false;

            const settingsBtn = document.createElement('button');
            settingsBtn.id = 'wf-settings-btn';
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
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M12 1v6m0 6v6m4.22-13.22l4.24 4.24M1.54 1.54l4.24 4.24M20.46 20.46l-4.24-4.24M1.54 20.46l4.24-4.24M21 12h-6m-6 0H3"></path>
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

            let modal = document.getElementById('wf-settings-modal');
            if (!modal) {
                modal = this.createModal();
            }

            settingsBtn.addEventListener('click', () => {
                this.modalOpen = !this.modalOpen;
                modal.style.display = this.modalOpen ? 'block' : 'none';
            });

            document.body.appendChild(settingsBtn);
            Logger.log('✓ Settings button added');
            return true;
        }
    };

    // ============= PLUGIN MANAGER =============
    const PluginManager = {
        plugins: {},
        
        register(plugin) {
            if (!plugin.id) {
                Logger.error('Plugin must have an id');
                return;
            }
            this.plugins[plugin.id] = {
                ...plugin,
                state: plugin.initialState ? { ...plugin.initialState } : {},
            };
            Logger.log(`Registered plugin: ${plugin.id}`);
        },
        
        get(id) {
            return this.plugins[id];
        },
        
        getAll() {
            return Object.values(this.plugins);
        },
        
        isEnabled(id) {
            return Storage.getPluginEnabled(id);
        },
        
        setEnabled(id, enabled) {
            Storage.setPluginEnabled(id, enabled);
        },
        
        runEarlyPlugins() {
            this.getAll()
                .filter(p => p.phase === 'early' && this.isEnabled(p.id))
                .forEach(plugin => {
                    try {
                        if (plugin.init) plugin.init(plugin.state, Context);
                        Logger.log(`✓ Early plugin initialized: ${plugin.id}`);
                    } catch (e) {
                        Logger.error(`Error in early plugin ${plugin.id}:`, e);
                    }
                });
        },
        
        runInitPlugins() {
            this.getAll()
                .filter(p => p.phase === 'init' && this.isEnabled(p.id))
                .forEach(plugin => {
                    try {
                        if (plugin.init) plugin.init(plugin.state, Context);
                        Logger.log(`✓ Init plugin initialized: ${plugin.id}`);
                    } catch (e) {
                        Logger.error(`Error in init plugin ${plugin.id}:`, e);
                    }
                });
        },
        
        runMutationPlugins() {
            this.getAll()
                .filter(p => p.phase === 'mutation' && this.isEnabled(p.id))
                .forEach(plugin => {
                    try {
                        if (plugin.onMutation) plugin.onMutation(plugin.state, Context);
                    } catch (e) {
                        Logger.error(`Error in mutation plugin ${plugin.id}:`, e);
                    }
                });
        }
    };

    // ============= MAIN INITIALIZATION =============
    async function initialize() {
        Logger.log(`Fleet Workflow Enhancer v${VERSION} starting...`);
        
        try {
            // Step 1: Load archetype definitions
            await ArchetypeManager.loadArchetypes();
            
            // Step 2: Wait for DOM to be ready enough to detect archetype
            await waitForInitialDOM();
            
            // Step 3: Detect which archetype we're on
            const archetype = await ArchetypeManager.detectArchetype();
            
            if (!archetype) {
                Logger.warn('No matching archetype found. Script will not load plugins.');
                return;
            }
            
            // Step 4: Load plugins for the detected archetype
            const pluginsToLoad = ArchetypeManager.getPluginsForCurrentArchetype();
            await PluginLoader.loadPluginsForArchetype(pluginsToLoad);
            
            // Step 5: Run early plugins immediately
            PluginManager.runEarlyPlugins();
            
            // Step 6: Set up DOM observer
            const observer = new MutationObserver(() => {
                if (Context.initialized) {
                    PluginManager.runMutationPlugins();
                }
            });
            
            // Step 7: Wait for full DOM ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', onDOMReady);
            } else {
                onDOMReady();
            }
            
            function onDOMReady() {
                Logger.log('DOM ready, initializing plugins...');
                Context.initialized = true;
                
                // Run init plugins
                PluginManager.runInitPlugins();
                
                // Start observing
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });
                
                // Run mutation plugins once for initial state
                PluginManager.runMutationPlugins();
                
                // Add settings button after plugins are loaded
                SettingsUI.addSettingsButton();
                
                Logger.log(`✓ Fleet Workflow Enhancer initialized for archetype: ${archetype.name}`);
            }
        } catch (error) {
            Logger.error('Failed to initialize:', error);
        }
    }
    
    // Helper function to wait for initial DOM elements
    function waitForInitialDOM() {
        return new Promise((resolve) => {
            if (document.body) {
                resolve();
            } else {
                const observer = new MutationObserver(() => {
                    if (document.body) {
                        observer.disconnect();
                        resolve();
                    }
                });
                observer.observe(document.documentElement, { childList: true, subtree: true });
            }
        });
    }
    
    // Start the initialization
    initialize();
})();
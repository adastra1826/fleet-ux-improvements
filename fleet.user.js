
// ==UserScript==
// @name         [MODULAR] Fleet Workflow Builder UX Enhancer
// @namespace    http://tampermonkey.net/
// @version      x.x.x
// @description  UX improvements for workflow builder tool with archetype-based plugin loading
// @author       You
// @match        https://fleetai.com/*
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
        branch: 'v2',
        pluginsPath: 'plugins',
        archetypesPath: 'archetypes.json'
    };

    // ============= SHARED CONTEXT =============
    const Context = {
        source: null,
        initialized: false,
        currentArchetype: null,
        getPageWindow: () => typeof unsafeWindow !== 'undefined' ? unsafeWindow : window,
    };

    // ============= CLEANUP REGISTRY =============
    // Tracks all resources that need cleanup on navigation
    const CleanupRegistry = {
        _items: {
            intervals: [],
            timeouts: [],
            observers: [],
            eventListeners: [],  // { target, event, handler, options }
            elements: [],        // DOM elements we've added
        },
        
        registerInterval(id) {
            this._items.intervals.push(id);
            return id;
        },
        
        registerTimeout(id) {
            this._items.timeouts.push(id);
            return id;
        },
        
        registerObserver(observer) {
            this._items.observers.push(observer);
            return observer;
        },
        
        registerEventListener(target, event, handler, options) {
            this._items.eventListeners.push({ target, event, handler, options });
            target.addEventListener(event, handler, options);
        },
        
        registerElement(element) {
            this._items.elements.push(element);
            return element;
        },
        
        cleanup() {
            Logger.debug('Running cleanup...');
            
            // Clear intervals
            this._items.intervals.forEach(id => clearInterval(id));
            this._items.intervals = [];
            
            // Clear timeouts
            this._items.timeouts.forEach(id => clearTimeout(id));
            this._items.timeouts = [];
            
            // Disconnect observers
            this._items.observers.forEach(obs => obs.disconnect());
            this._items.observers = [];
            
            // Remove event listeners
            this._items.eventListeners.forEach(({ target, event, handler, options }) => {
                target.removeEventListener(event, handler, options);
            });
            this._items.eventListeners = [];
            
            // Remove DOM elements
            this._items.elements.forEach(el => {
                if (el && el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
            this._items.elements = [];
            
            Logger.debug('Cleanup complete');
        }
    };

    // ============= NAVIGATION MANAGER =============
    const NavigationManager = {
        _lastUrl: window.location.href,
        _initialized: false,
        _onNavigateCallbacks: [],
        
        init() {
            if (this._initialized) return;
            this._initialized = true;
            
            // Store original methods
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            const self = this;
            
            // Override pushState
            history.pushState = function(state, title, url) {
                originalPushState.apply(this, arguments);
                self._handleNavigation('pushState', url);
            };
            
            // Override replaceState
            history.replaceState = function(state, title, url) {
                originalReplaceState.apply(this, arguments);
                self._handleNavigation('replaceState', url);
            };
            
            // Listen for back/forward navigation
            window.addEventListener('popstate', (event) => {
                this._handleNavigation('popstate');
            });
            
            Logger.log('✓ Navigation monitoring initialized');
        },
        
        _handleNavigation(method, url) {
            const newUrl = window.location.href;
            
            // Only trigger if URL actually changed
            if (newUrl === this._lastUrl) {
                Logger.debug(`Navigation method called (${method}) but URL unchanged`);
                return;
            }
            
            const previousUrl = this._lastUrl;
            this._lastUrl = newUrl;
            
            Logger.log(`Navigation detected [${method}]: ${previousUrl} → ${newUrl}`);
            
            // Execute all registered callbacks
            this._onNavigateCallbacks.forEach(callback => {
                try {
                    callback(newUrl, previousUrl);
                } catch (e) {
                    Logger.error('Error in navigation callback:', e);
                }
            });
        },
        
        onNavigate(callback) {
            this._onNavigateCallbacks.push(callback);
        },
        
        getCurrentUrl() {
            return this._lastUrl;
        }
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
        _archetypesLoaded: false,
        
        async loadArchetypes() {
            // Only load from GitHub once per page lifecycle
            if (this._archetypesLoaded) {
                Logger.debug('Archetypes already loaded, skipping fetch');
                return { archetypes: this.archetypes };
            }
            
            const url = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.archetypesPath}`;
            
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: (response) => {
                        if (response.status === 200) {
                            try {
                                const config = JSON.parse(response.responseText);
                                this.archetypes = config.archetypes || [];
                                this._archetypesLoaded = true;
                                Logger.log(`✓ Loaded ${this.archetypes.length} archetypes`);
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
                    onerror: (error) => {
                        Logger.error('Network error loading archetypes:', error);
                        reject(error);
                    }
                });
            });
        },
        
        detectArchetype() {
            return new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 20;
                const checkInterval = 500;
                
                const checkForArchetype = () => {
                    attempts++;
                    
                    for (const archetype of this.archetypes) {
                        Logger.debug(`Checking archetype: ${archetype.id}`);
                        
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
                    
                    if (attempts < maxAttempts) {
                        Logger.debug(`No archetype matched yet. Attempt ${attempts}/${maxAttempts}`);
                        setTimeout(checkForArchetype, checkInterval);
                    } else {
                        Logger.warn('No matching archetype found after maximum attempts');
                        this.currentArchetype = null;
                        Context.currentArchetype = null;
                        resolve(null);
                    }
                };
                
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
        _loadedPluginFiles: new Set(), // Track which files we've already fetched
        
        async loadPlugin(filename) {
            const url = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.pluginsPath}/${filename}`;
            
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: (response) => {
                        if (response.status === 200) {
                            try {
                                const pluginFactory = new Function(
                                    'PluginManager',
                                    'Storage',
                                    'Logger',
                                    'Context',
                                    'CleanupRegistry',
                                    response.responseText + '\n\n// Return the plugin for registration\nreturn plugin;'
                                );
                                
                                const plugin = pluginFactory(
                                    PluginManager,
                                    Storage,
                                    Logger,
                                    Context,
                                    CleanupRegistry
                                );
                                
                                this._loadedPluginFiles.add(filename);
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
                    onerror: (error) => {
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
                // Check if plugin is already registered (from a previous archetype)
                // If so, we can reuse it without fetching again
                const existingPlugins = PluginManager.getAll();
                const alreadyLoaded = existingPlugins.some(p => p._sourceFile === filename);
                
                if (alreadyLoaded) {
                    Logger.debug(`Plugin ${filename} already loaded, skipping fetch`);
                    continue;
                }
                
                loadPromises.push(
                    this.loadPlugin(filename)
                        .then(plugin => {
                            plugin._sourceFile = filename; // Track source for deduplication
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

            // Register for cleanup
            CleanupRegistry.registerElement(modal);

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

            modal.innerHTML = `
                <div class="space-y-4">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h2 style="font-size: 18px; font-weight: 600;">WF Enhancer Settings</h2>
                            <p style="font-size: 13px; color: var(--muted-foreground, #666); margin-top: 4px;">
                                Archetype: <strong>${archetype ? archetype.name : 'Unknown'}</strong>
                            </p>
                        </div>
                        <button id="wf-settings-close" style="
                            width: 24px; height: 24px;
                            display: flex; align-items: center; justify-content: center;
                            border-radius: 4px; border: none; background: transparent; cursor: pointer;
                        ">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    <div style="border-bottom: 1px solid var(--border, #e5e5e5); margin-bottom: 16px; padding-bottom: 16px;">
                        <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 12px;">Loaded Plugins (${plugins.length})</h3>
                        ${pluginToggles || '<p style="color: #666; font-size: 13px;">No plugins loaded for this page.</p>'}
                    </div>
                    <div style="font-size: 11px; color: var(--muted-foreground, #666); text-align: center; margin-top: 16px;">
                        WF Enhancer v${VERSION}
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Event listeners (using CleanupRegistry for document-level ones)
            modal.querySelector('#wf-settings-close').addEventListener('click', () => {
                modal.style.display = 'none';
                this.modalOpen = false;
            });

            // Close on outside click
            const outsideClickHandler = (e) => {
                if (this.modalOpen && !modal.contains(e.target) && !e.target.closest('#wf-settings-btn')) {
                    modal.style.display = 'none';
                    this.modalOpen = false;
                }
            };
            CleanupRegistry.registerEventListener(document, 'click', outsideClickHandler);

            return modal;
        },

        addSettingsButton() {
            if (document.getElementById('wf-settings-btn')) return false;

            const settingsBtn = document.createElement('button');
            settingsBtn.id = 'wf-settings-btn';
            settingsBtn.style.cssText = `
                position: fixed; bottom: 20px; left: 20px;
                width: 48px; height: 48px; border-radius: 50%;
                background: var(--background, white);
                border: 1px solid var(--border, #e5e5e5);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; z-index: 9999;
            `;
            settingsBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M12 1v6m0 6v6m4.22-13.22l4.24 4.24M1.54 1.54l4.24 4.24M20.46 20.46l-4.24-4.24M1.54 20.46l4.24-4.24M21 12h-6m-6 0H3"></path>
                </svg>
            `;

            // Register for cleanup
            CleanupRegistry.registerElement(settingsBtn);

            let modal = this.createModal();

            settingsBtn.addEventListener('click', () => {
                this.modalOpen = !this.modalOpen;
                modal.style.display = this.modalOpen ? 'block' : 'none';
            });

            document.body.appendChild(settingsBtn);
            Logger.log('✓ Settings button added');
            return true;
        },
        
        // Reset state on navigation
        reset() {
            this.modalOpen = false;
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
        
        // NEW: Run cleanup/destroy on all plugins
        cleanupAllPlugins() {
            this.getAll().forEach(plugin => {
                try {
                    if (plugin.destroy) {
                        plugin.destroy(plugin.state, Context);
                        Logger.debug(`✓ Destroyed plugin: ${plugin.id}`);
                    }
                    // Reset plugin state
                    plugin.state = plugin.initialState ? { ...plugin.initialState } : {};
                } catch (e) {
                    Logger.error(`Error destroying plugin ${plugin.id}:`, e);
                }
            });
        },
        
        // NEW: Clear all plugins (for complete re-init if needed)
        clearAllPlugins() {
            this.cleanupAllPlugins();
            this.plugins = {};
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
    let mainObserver = null; // Keep reference to disconnect on navigation
    
    async function initializeForPage() {
        Logger.log('Initializing for current page...');
        
        try {
            // Step 1: Load archetype definitions (cached after first load)
            await ArchetypeManager.loadArchetypes();
            
            // Step 2: Wait for DOM to be ready enough to detect archetype
            await waitForBody();
            
            // Step 3: Detect which archetype we're on
            const archetype = await ArchetypeManager.detectArchetype();
            
            if (!archetype) {
                Logger.warn('No matching archetype found. Script will not load plugins for this page.');
                // Still add settings button so user can see status
                SettingsUI.addSettingsButton();
                return;
            }
            
            // Step 4: Load plugins for the detected archetype
            const pluginsToLoad = ArchetypeManager.getPluginsForCurrentArchetype();
            await PluginLoader.loadPluginsForArchetype(pluginsToLoad);
            
            // Step 5: Run early plugins immediately
            PluginManager.runEarlyPlugins();
            
            // Step 6: Set up DOM observer
            mainObserver = new MutationObserver(() => {
                if (Context.initialized) {
                    PluginManager.runMutationPlugins();
                }
            });
            CleanupRegistry.registerObserver(mainObserver);
            
            // Step 7: Run init plugins and start observing
            Context.initialized = true;
            PluginManager.runInitPlugins();
            
            mainObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
            
            // Run mutation plugins once for initial state
            PluginManager.runMutationPlugins();
            
            // Add settings button
            SettingsUI.addSettingsButton();
            
            Logger.log(`✓ Fleet Workflow Enhancer initialized for archetype: ${archetype.name}`);
        } catch (error) {
            Logger.error('Failed to initialize:', error);
        }
    }
    
    async function handleNavigation(newUrl, previousUrl) {
        Logger.log('Handling navigation, reinitializing...');
        
        // Step 1: Clean up everything from previous page
        Context.initialized = false;
        
        // Run plugin destroy hooks
        PluginManager.cleanupAllPlugins();
        
        // Clean up registered resources (observers, listeners, elements, timers)
        CleanupRegistry.cleanup();
        
        // Reset UI state
        SettingsUI.reset();
        
        // Step 2: Small delay to let SPA finish its DOM updates
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Step 3: Reinitialize for the new page
        await initializeForPage();
    }
    
    function waitForBody() {
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
    
    // ============= STARTUP =============
    async function startup() {
        Logger.log(`Fleet Workflow Enhancer v${VERSION} starting...`);
        
        // Initialize navigation monitoring FIRST (before anything else)
        // This ensures we catch all navigations
        NavigationManager.init();
        
        // Register navigation handler
        NavigationManager.onNavigate(handleNavigation);
        
        // Wait for body to exist
        await waitForBody();
        
        // Initialize for the current page
        await initializeForPage();
    }
    
    // Start!
    startup();
})();

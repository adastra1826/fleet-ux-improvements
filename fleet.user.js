
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
        corePath: 'core',           // folder for core plugins
        archetypesPath: 'archetypes.json'
    };
    
    // Core plugins that load on every page (regardless of archetype)
    // These persist across navigation and are never cleaned up
    const CORE_PLUGINS = [
        'settings-ui.js'
    ];

    // ============= SHARED CONTEXT =============
    const Context = {
        version: VERSION,
        source: null,
        initialized: false,
        currentArchetype: null,
        getPageWindow: () => typeof unsafeWindow !== 'undefined' ? unsafeWindow : window,
    };

    // ============= CLEANUP REGISTRY =============
    // Tracks resources that need cleanup on navigation (NOT used for core plugins)
    const CleanupRegistry = {
        _items: {
            intervals: [],
            timeouts: [],
            observers: [],
            eventListeners: [],
            elements: [],
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
            
            this._items.intervals.forEach(id => clearInterval(id));
            this._items.intervals = [];
            
            this._items.timeouts.forEach(id => clearTimeout(id));
            this._items.timeouts = [];
            
            this._items.observers.forEach(obs => obs.disconnect());
            this._items.observers = [];
            
            this._items.eventListeners.forEach(({ target, event, handler, options }) => {
                target.removeEventListener(event, handler, options);
            });
            this._items.eventListeners = [];
            
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
            
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
            const self = this;
            
            history.pushState = function(state, title, url) {
                originalPushState.apply(this, arguments);
                self._handleNavigation('pushState', url);
            };
            
            history.replaceState = function(state, title, url) {
                originalReplaceState.apply(this, arguments);
                self._handleNavigation('replaceState', url);
            };
            
            window.addEventListener('popstate', () => {
                this._handleNavigation('popstate');
            });
            
            Logger.log('✓ Navigation monitoring initialized');
        },
        
        _handleNavigation(method, url) {
            const newUrl = window.location.href;
            
            if (newUrl === this._lastUrl) {
                Logger.debug(`Navigation method called (${method}) but URL unchanged`);
                return;
            }
            
            const previousUrl = this._lastUrl;
            this._lastUrl = newUrl;
            
            Logger.log(`Navigation detected [${method}]: ${previousUrl} → ${newUrl}`);
            
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
            const defaultValue = plugin ? (plugin.enabledByDefault !== false) : true;
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
                return [];
            }
            return this.currentArchetype.plugins || [];
        }
    };

    // ============= PLUGIN LOADER =============
    const PluginLoader = {
        _loadedPluginFiles: new Set(),
        
        async loadPluginFromUrl(url, filename) {
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
        
        async loadCorePlugin(filename) {
            const url = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.corePath}/${filename}`;
            return this.loadPluginFromUrl(url, filename);
        },
        
        async loadArchetypePlugin(filename) {
            const url = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.pluginsPath}/${filename}`;
            return this.loadPluginFromUrl(url, filename);
        },
        
        async loadCorePlugins() {
            if (CORE_PLUGINS.length === 0) {
                Logger.debug('No core plugins configured');
                return;
            }
            
            Logger.log(`Loading ${CORE_PLUGINS.length} core plugin(s)...`);
            
            for (const filename of CORE_PLUGINS) {
                try {
                    const plugin = await this.loadCorePlugin(filename);
                    plugin._sourceFile = filename;
                    plugin._isCore = true;
                    PluginManager.register(plugin);
                    Logger.log(`✓ Loaded core plugin: ${filename}`);
                } catch (err) {
                    Logger.error(`✗ Failed to load core plugin: ${filename}`, err);
                }
            }
        },
        
        async loadPluginsForArchetype(pluginList) {
            if (!pluginList || pluginList.length === 0) {
                Logger.log('No plugins to load for this archetype');
                return;
            }
            
            Logger.log(`Loading ${pluginList.length} archetype plugin(s)...`);
            const loadPromises = [];
            
            for (const filename of pluginList) {
                const existingPlugins = PluginManager.getAll();
                const alreadyLoaded = existingPlugins.some(p => p._sourceFile === filename);
                
                if (alreadyLoaded) {
                    Logger.debug(`Plugin ${filename} already loaded, skipping fetch`);
                    continue;
                }
                
                loadPromises.push(
                    this.loadArchetypePlugin(filename)
                        .then(plugin => {
                            plugin._sourceFile = filename;
                            plugin._isCore = false;
                            PluginManager.register(plugin);
                            Logger.log(`✓ Loaded plugin: ${filename}`);
                        })
                        .catch(err => {
                            Logger.error(`✗ Failed to load plugin: ${filename}`, err);
                        })
                );
            }
            
            await Promise.allSettled(loadPromises);
            Logger.log('Archetype plugin loading complete');
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
            Logger.debug(`Registered plugin: ${plugin.id}`);
        },
        
        get(id) {
            return this.plugins[id];
        },
        
        getAll() {
            return Object.values(this.plugins);
        },
        
        getCorePlugins() {
            return this.getAll().filter(p => p._isCore === true);
        },
        
        getArchetypePlugins() {
            return this.getAll().filter(p => p._isCore !== true);
        },
        
        isEnabled(id) {
            return Storage.getPluginEnabled(id);
        },
        
        setEnabled(id, enabled) {
            Storage.setPluginEnabled(id, enabled);
        },
        
        // Clean up archetype plugins only (not core)
        cleanupArchetypePlugins() {
            this.getArchetypePlugins().forEach(plugin => {
                try {
                    if (plugin.destroy) {
                        plugin.destroy(plugin.state, Context);
                        Logger.debug(`✓ Destroyed plugin: ${plugin.id}`);
                    }
                    plugin.state = plugin.initialState ? { ...plugin.initialState } : {};
                } catch (e) {
                    Logger.error(`Error destroying plugin ${plugin.id}:`, e);
                }
            });
        },
        
        // Remove archetype plugins from registry (for full reload)
        clearArchetypePlugins() {
            this.cleanupArchetypePlugins();
            const archetypePluginIds = this.getArchetypePlugins().map(p => p.id);
            archetypePluginIds.forEach(id => {
                delete this.plugins[id];
            });
        },
        
        runCorePlugins() {
            this.getCorePlugins()
                .filter(p => this.isEnabled(p.id))
                .forEach(plugin => {
                    try {
                        if (plugin.init) plugin.init(plugin.state, Context);
                        Logger.log(`✓ Core plugin initialized: ${plugin.id}`);
                    } catch (e) {
                        Logger.error(`Error in core plugin ${plugin.id}:`, e);
                    }
                });
        },
        
        runEarlyPlugins() {
            this.getArchetypePlugins()
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
            this.getArchetypePlugins()
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
            this.getArchetypePlugins()
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
    let mainObserver = null;
    let corePluginsLoaded = false;
    
    async function initializeCorePlugins() {
        if (corePluginsLoaded) {
            Logger.debug('Core plugins already loaded');
            return;
        }
        
        await PluginLoader.loadCorePlugins();
        corePluginsLoaded = true;
        
        // Wait for body before initializing core plugins that need DOM
        await waitForBody();
        PluginManager.runCorePlugins();
    }
    
    async function initializeForPage() {
        Logger.log('Initializing for current page...');
        
        try {
            // Load archetype definitions (cached after first load)
            await ArchetypeManager.loadArchetypes();
            
            // Wait for DOM
            await waitForBody();
            
            // Detect archetype
            const archetype = await ArchetypeManager.detectArchetype();
            
            if (!archetype) {
                Logger.warn('No matching archetype found. No archetype plugins will load.');
                return;
            }
            
            // Load archetype-specific plugins
            const pluginsToLoad = ArchetypeManager.getPluginsForCurrentArchetype();
            await PluginLoader.loadPluginsForArchetype(pluginsToLoad);
            
            // Run early plugins
            PluginManager.runEarlyPlugins();
            
            // Set up DOM observer
            mainObserver = new MutationObserver(() => {
                if (Context.initialized) {
                    PluginManager.runMutationPlugins();
                }
            });
            CleanupRegistry.registerObserver(mainObserver);
            
            // Run init plugins and start observing
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
            
            Logger.log(`✓ Initialized for archetype: ${archetype.name}`);
        } catch (error) {
            Logger.error('Failed to initialize:', error);
        }
    }
    
    async function handleNavigation(newUrl, previousUrl) {
        Logger.log('Handling navigation, reinitializing...');
        
        // Clean up archetype plugins and resources
        Context.initialized = false;
        PluginManager.cleanupArchetypePlugins();
        CleanupRegistry.cleanup();
        
        // Clear archetype plugins so they can be reloaded for new page
        PluginManager.clearArchetypePlugins();
        
        // Small delay to let SPA finish its DOM updates
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Reinitialize for the new page
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
        
        // Initialize navigation monitoring FIRST
        NavigationManager.init();
        NavigationManager.onNavigate(handleNavigation);
        
        // Wait for body
        await waitForBody();
        
        // Load and initialize core plugins (once, persists across navigation)
        await initializeCorePlugins();
        
        // Initialize archetype-specific plugins for current page
        await initializeForPage();
    }
    
    // Start!
    startup();
})();

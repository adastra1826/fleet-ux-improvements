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
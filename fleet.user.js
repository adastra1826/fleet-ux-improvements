// ==UserScript==
// @name         [MODULAR] Fleet Workflow Builder UX Enhancer
// @namespace    http://tampermonkey.net/
// @version      x.x.x
// @description  UX improvements for workflow builder tool with modular plugin system
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
    const VERSION = 'x.x.2';
    const STORAGE_PREFIX = 'wf-enhancer-';
    
    // GitHub repository configuration
    const GITHUB_CONFIG = {
        owner: 'adastra1826',
        repo: 'fleet-ux-improvements',
        branch: 'dev',
        pluginsPath: 'plugins' // folder containing plugin files
    };
    
    // Plugin manifest - just list the filenames
    const PLUGIN_MANIFEST = [
        'network-interception.js',
        'autocorrect-search.js',
        'autocorrect-textareas.js',
        'source-data-explorer.js',
        'favorites.js',
        'notes.js',
        'layout-manager.js',
        'settings-panel.js',
        // Add more plugin files as needed
    ];

    // ============= SHARED CONTEXT =============
    const Context = {
        source: null,
        initialized: false,
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

    // ============= SELECTORS =============
    const SELECTORS = {
        toolbar: '#\\:rb\\: > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center',
        toolsContainer: '#\\:rb\\: > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3',
        toolHeader: 'div.flex.items-center.gap-3.p-3.cursor-pointer.hover\\:bg-muted\\/30',
        promptTextareaContainer: '#\\:r7\\: > div.flex-shrink-0 > div > div.space-y-2.relative > div.relative > div',
        promptSectionParent: '#\\:r7\\: > div.flex-shrink-0 > div.p-3.border-b',
        workflowToolsIndicator: '#\\:rb\\: > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center > div:nth-child(2)',
        workflowToolsArea: '#\\:rb\\: > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3',
        mainContainer: 'body > div.group\\/sidebar-wrapper.flex.min-h-svh.w-full.has-\\[\\[data-variant\\=inset\\]\\]\\:bg-sidebar > main > div > div > div > div.w-full.h-full.bg-background.rounded-sm.relative.flex.flex-col.min-w-0.overflow-hidden.border-\\[0\\.5px\\].shadow-\\[0_0_15px_rgba\\(0\\,0\\,0\\,0\\.05\\)\\] > div > div.flex-1.flex.overflow-hidden.min-h-0 > div',
        leftColumn: '#\\:r7\\:',
        workflowColumn: '#\\:rb\\:',
        bugReportBtn: 'body > div.group\\/sidebar-wrapper.flex.min-h-svh.w-full.has-\\[\\[data-variant\\=inset\\]\\]\\:bg-sidebar > main > div > div > div > button',
    };

    // ============= STORAGE KEYS =============
    const STORAGE_KEYS = {
        notes: 'notes',
        notesHeight: 'notes-height',
        col1Width: 'col1-width',
        col2Width: 'col2-width',
        col3Width: 'col3-width',
        sectionSplitRatio: 'section-split-ratio',
        favoriteTools: 'favorite-tools'
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
                                    'SELECTORS',
                                    'STORAGE_KEYS',
                                    response.responseText + '\n\n// Return the plugin for registration\nreturn plugin;'
                                );
                                
                                // Execute and get the plugin
                                const plugin = pluginFactory(
                                    PluginManager,
                                    Storage,
                                    Logger,
                                    Context,
                                    SELECTORS,
                                    STORAGE_KEYS
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
        
        async loadAllPlugins() {
            Logger.log('Loading plugins from GitHub...');
            const loadPromises = [];
            
            for (const filename of PLUGIN_MANIFEST) {
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
            // Load all plugins from GitHub
            await PluginLoader.loadAllPlugins();
            
            // Run early plugins immediately
            PluginManager.runEarlyPlugins();
            
            // Set up DOM observer
            const observer = new MutationObserver(() => {
                if (Context.initialized) {
                    PluginManager.runMutationPlugins();
                }
            });
            
            // Wait for DOM ready
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
                
                Logger.log('✓ Fleet Workflow Enhancer initialized');
            }
        } catch (error) {
            Logger.error('Failed to initialize:', error);
        }
    }
    
    // Start the initialization
    initialize();
})();
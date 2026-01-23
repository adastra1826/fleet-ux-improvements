
// ==UserScript==
// @name         [MODULAR] Fleet Workflow Builder UX Enhancer
// @namespace    http://tampermonkey.net/
// @version      2.x.x
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
    const VERSION = '2.x.x';
    const STORAGE_PREFIX = 'wf-enhancer-';
    
    // Base URL that matches the @match pattern (without trailing wildcard)
    const BASE_URL = 'https://fleetai.com/';
    
    // GitHub repository configuration
    const GITHUB_CONFIG = {
        owner: 'adastra1826',
        repo: 'fleet-ux-improvements',
        branch: 'v1',
        pluginsPath: 'plugins',
        corePath: 'core',
        archetypesPath: 'archetypes.json'
    };
    
    // Core plugins that load on every page
    const CORE_PLUGINS = [
        'settings-ui.js'
    ];

    // ============= SHARED CONTEXT =============
    const Context = {
        version: VERSION,
        source: null,
        initialized: false,
        currentArchetype: null,
        currentPath: null,
        getPageWindow: () => typeof unsafeWindow !== 'undefined' ? unsafeWindow : window,
    };

    // ============= CLEANUP REGISTRY =============
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

    // ============= URL PATTERN MATCHER =============
    const UrlMatcher = {
        /**
         * Extract the path portion after the base URL
         * @param {string} fullUrl - The complete URL
         * @returns {string} - The path after BASE_URL
         */
        getPathFromUrl(fullUrl) {
            if (fullUrl.startsWith(BASE_URL)) {
                // Remove base URL and any query string/hash
                let path = fullUrl.slice(BASE_URL.length);
                path = path.split('?')[0].split('#')[0];
                // Remove trailing slash for consistent matching
                if (path.endsWith('/') && path.length > 1) {
                    path = path.slice(0, -1);
                }
                return path;
            }
            return '';
        },
        
        /**
         * Convert a URL pattern to a regex
         * Supports:
         *   - Exact match: "dashboard" matches only "dashboard"
         *   - Wildcard segment: "tasks/*" matches "tasks/123" but not "tasks/123/edit"
         *   - Wildcard suffix: "tasks*" matches "tasks", "tasks123", "tasks/anything"
         *   - Combined: "tasks/*\/review" matches "tasks/123/review"
         * 
         * @param {string} pattern - The URL pattern
         * @returns {RegExp} - Compiled regex
         */
        patternToRegex(pattern) {
            // Escape special regex characters except *
            let regexStr = pattern
                .replace(/[.+?^${}()|[\]\\]/g, '\\$&');
            
            // Handle wildcards:
            // /* at segment boundaries = match one segment (no slashes)
            // * at end or mid-word = match anything including slashes
            
            // First, handle /*/  (wildcard segment in middle)
            regexStr = regexStr.replace(/\/\\\*\//g, '/[^/]+/');
            
            // Handle /* at end (wildcard segment at end, must have content)
            regexStr = regexStr.replace(/\/\\\*$/g, '/[^/]+');
            
            // Handle trailing * (match anything including empty)
            regexStr = regexStr.replace(/\\\*$/g, '.*');
            
            // Handle remaining * (mid-pattern wildcards)
            regexStr = regexStr.replace(/\\\*/g, '.*');
            
            // Anchor the pattern
            return new RegExp(`^${regexStr}$`);
        },
        
        /**
         * Test if a path matches a pattern
         * @param {string} path - The current path
         * @param {string} pattern - The URL pattern to test
         * @returns {boolean}
         */
        matches(path, pattern) {
            const regex = this.patternToRegex(pattern);
            const result = regex.test(path);
            Logger.debug(`URL match test: "${path}" vs "${pattern}" (${regex}) = ${result}`);
            return result;
        },
        
        /**
         * Calculate specificity score for a pattern (more specific = higher score)
         * Used to determine which archetype takes precedence
         * @param {string} pattern - The URL pattern
         * @returns {number}
         */
        getSpecificity(pattern) {
            let score = 0;
            
            // More segments = more specific
            const segments = pattern.split('/').filter(s => s.length > 0);
            score += segments.length * 10;
            
            // Literal segments are more specific than wildcards
            segments.forEach(seg => {
                if (seg === '*') {
                    score += 1; // Wildcard segment
                } else if (seg.includes('*')) {
                    score += 3; // Partial wildcard
                } else {
                    score += 5; // Literal segment
                }
            });
            
            // Patterns ending in * are less specific
            if (pattern.endsWith('*')) {
                score -= 2;
            }
            
            return score;
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
        
        /**
         * Detect archetype based on URL pattern, with optional selector disambiguation
         */
        detectArchetype() {
            return new Promise((resolve) => {
                const currentUrl = window.location.href;
                const currentPath = UrlMatcher.getPathFromUrl(currentUrl);
                Context.currentPath = currentPath;
                
                Logger.log(`Detecting archetype for path: "${currentPath}"`);
                
                // Step 1: Find all archetypes whose URL pattern matches
                const urlMatches = this.archetypes.filter(archetype => {
                    if (!archetype.urlPattern) {
                        Logger.debug(`Archetype ${archetype.id} has no urlPattern, skipping`);
                        return false;
                    }
                    return UrlMatcher.matches(currentPath, archetype.urlPattern);
                });
                
                Logger.debug(`URL pattern matches: ${urlMatches.map(a => a.id).join(', ') || 'none'}`);
                
                if (urlMatches.length === 0) {
                    Logger.warn('No archetype matched the current URL');
                    this.currentArchetype = null;
                    Context.currentArchetype = null;
                    resolve(null);
                    return;
                }
                
                // Step 2: If only one match, use it (no disambiguation needed)
                if (urlMatches.length === 1) {
                    const archetype = urlMatches[0];
                    Logger.log(`✓ Single URL match: ${archetype.id} - ${archetype.name}`);
                    this.currentArchetype = archetype;
                    Context.currentArchetype = archetype;
                    resolve(archetype);
                    return;
                }
                
                // Step 3: Multiple matches - sort by specificity first
                urlMatches.sort((a, b) => {
                    const specA = UrlMatcher.getSpecificity(a.urlPattern);
                    const specB = UrlMatcher.getSpecificity(b.urlPattern);
                    return specB - specA; // Higher specificity first
                });
                
                Logger.debug(`Sorted by specificity: ${urlMatches.map(a => `${a.id}(${UrlMatcher.getSpecificity(a.urlPattern)})`).join(', ')}`);
                
                // Step 4: Check if disambiguation is needed
                // If highest specificity archetype has no disambiguation selectors, use it
                // Otherwise, try to disambiguate using selectors
                const needsDisambiguation = urlMatches.some(a => 
                    a.disambiguationSelectors && a.disambiguationSelectors.length > 0
                );
                
                if (!needsDisambiguation) {
                    // Use the most specific URL match
                    const archetype = urlMatches[0];
                    Logger.log(`✓ Most specific URL match: ${archetype.id} - ${archetype.name}`);
                    this.currentArchetype = archetype;
                    Context.currentArchetype = archetype;
                    resolve(archetype);
                    return;
                }
                
                // Step 5: Disambiguation needed - wait for DOM and check selectors
                Logger.debug('Multiple URL matches with disambiguation selectors, waiting for DOM...');
                this._disambiguateWithSelectors(urlMatches, resolve);
            });
        },
        
        /**
         * Disambiguate between archetypes using DOM selectors
         */
        _disambiguateWithSelectors(candidates, resolve) {
            let attempts = 0;
            const maxAttempts = 20;
            const checkInterval = 250;
            
            const checkSelectors = () => {
                attempts++;
                
                // Check each candidate's disambiguation selectors
                for (const archetype of candidates) {
                    const selectors = archetype.disambiguationSelectors || [];
                    
                    // If no selectors, this archetype can't be confirmed via DOM
                    if (selectors.length === 0) {
                        continue;
                    }
                    
                    // Check if ALL disambiguation selectors are present
                    const allPresent = selectors.every(selector => {
                        const exists = document.querySelector(selector) !== null;
                        Logger.debug(`  [${archetype.id}] Selector "${selector}": ${exists ? '✓' : '✗'}`);
                        return exists;
                    });
                    
                    if (allPresent) {
                        Logger.log(`✓ Disambiguated to: ${archetype.id} - ${archetype.name}`);
                        this.currentArchetype = archetype;
                        Context.currentArchetype = archetype;
                        resolve(archetype);
                        return;
                    }
                }
                
                // No disambiguation match yet
                if (attempts < maxAttempts) {
                    Logger.debug(`Disambiguation attempt ${attempts}/${maxAttempts}, retrying...`);
                    setTimeout(checkSelectors, checkInterval);
                } else {
                    // Fallback to most specific URL match
                    const fallback = candidates[0];
                    Logger.warn(`Disambiguation failed after ${maxAttempts} attempts, falling back to: ${fallback.id}`);
                    this.currentArchetype = fallback;
                    Context.currentArchetype = fallback;
                    resolve(fallback);
                }
            };
            
            // Start checking
            checkSelectors();
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
            
            // Detect archetype using URL + optional disambiguation
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
            
            Logger.log(`✓ Initialized for archetype: ${archetype.name} (path: "${Context.currentPath}")`);
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
        
        // Clear archetype plugins
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
        
        // Load and initialize core plugins
        await initializeCorePlugins();
        
        // Initialize archetype-specific plugins
        await initializeForPage();
    }
    
    // Start!
    startup();
})();


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

    // Exit immediately if inside an iframe.
    if (window.top != window.self) {
        console.warn("[Fleet UX Enhancer] - iframe detected. Terminating duplicate script instance. This is normal.");
        return;
    }

    // ============= CORE CONFIGURATION =============
    const VERSION = '2.x.x';
    const STORAGE_PREFIX = 'wf-enhancer-';
    const LOG_PREFIX = '[Fleet UX Enhancer]';
    const DEV_LOG_PANEL_ENABLED = true;
    
    // Base URL that matches the @match pattern (without trailing wildcard)
    const BASE_URL = 'https://fleetai.com/';
    
    // GitHub repository configuration
    const GITHUB_CONFIG = {
        owner: 'adastra1826',
        repo: 'fleet-ux-improvements',
        branch: 'dev',
        pluginsPath: 'plugins',
        corePath: 'core',
        devPath: 'dev',
        archetypesPath: 'archetypes.json'
    };
    
    // ============= SHARED CONTEXT =============
    const Context = {
        version: VERSION,
        source: null,
        initialized: false,
        currentArchetype: null,
        currentPath: null,
        outdatedPlugins: [], // Track plugins that couldn't be updated
        logPrefix: LOG_PREFIX,
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
        },
        // Plugin versioning storage
        getCachedPlugin(pluginKey) {
            const cached = this.get(`plugin-cache-${pluginKey}`, null);
            if (cached) {
                try {
                    return JSON.parse(cached);
                } catch (e) {
                    Logger.error(`Failed to parse cached plugin ${pluginKey}:`, e);
                    return null;
                }
            }
            return null;
        },
        setCachedPlugin(pluginKey, code, version) {
            const cacheData = {
                code: code,
                version: version,
                cachedAt: Date.now()
            };
            this.set(`plugin-cache-${pluginKey}`, JSON.stringify(cacheData));
        },
        getPluginKey(filename, sourcePath) {
            // Create a unique key for the plugin based on its path
            return sourcePath || filename;
        },
        getSubmoduleLoggingEnabled() {
            return this.get('submodule-logging', false);
        },
        setSubmoduleLoggingEnabled(enabled) {
            this.set('submodule-logging', enabled);
        },
        getModuleLoggingEnabled(moduleId) {
            return this.get(`module-logging-${moduleId}`, false);
        },
        setModuleLoggingEnabled(moduleId, enabled) {
            this.set(`module-logging-${moduleId}`, enabled);
        }
    };

    // ============= LOGGING =============
    const Logger = {
        _debugEnabled: null,
        _verboseEnabled: null,
        _submoduleEnabled: null,
        _moduleLogEnabled: {},
        _listeners: new Set(),
        
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

        isSubmoduleLoggingEnabled() {
            if (this._submoduleEnabled === null) {
                this._submoduleEnabled = Storage.getSubmoduleLoggingEnabled();
            }
            return this._submoduleEnabled;
        },

        isModuleLoggingEnabled(moduleId) {
            if (!moduleId) return false;
            if (typeof this._moduleLogEnabled[moduleId] === 'undefined') {
                this._moduleLogEnabled[moduleId] = Storage.getModuleLoggingEnabled(moduleId);
            }
            return this._moduleLogEnabled[moduleId];
        },
        
        setDebugEnabled(enabled) {
            this._debugEnabled = enabled;
            Storage.set('debug', enabled);
        },
        
        setVerboseEnabled(enabled) {
            this._verboseEnabled = enabled;
            Storage.set('verbose', enabled);
        },

        setSubmoduleLoggingEnabled(enabled) {
            this._submoduleEnabled = enabled;
            Storage.setSubmoduleLoggingEnabled(enabled);
        },

        setModuleLoggingEnabled(moduleId, enabled) {
            if (!moduleId) return;
            this._moduleLogEnabled[moduleId] = enabled;
            Storage.setModuleLoggingEnabled(moduleId, enabled);
        },

        onLog(listener) {
            this._listeners.add(listener);
            return () => this._listeners.delete(listener);
        },

        _emit(level, args) {
            if (!this._listeners.size) return;
            this._listeners.forEach((listener) => {
                try {
                    listener(level, args);
                } catch (e) {
                    // Ignore listener errors to keep logging stable
                }
            });
        },

        _getModulePrefix(moduleId) {
            const safeId = moduleId || 'unknown';
            return `${LOG_PREFIX} [${safeId}]`;
        },

        _shouldLogModule(moduleId) {
            return this.isSubmoduleLoggingEnabled() && this.isModuleLoggingEnabled(moduleId);
        },

        _logModule(level, msg, moduleId, ...args) {
            if (!this._shouldLogModule(moduleId)) return;
            const prefix = this._getModulePrefix(moduleId);
            let payload;
            if (level === 'debug') {
                payload = [`${prefix} 🔍 ${msg}`, ...args];
            } else if (level === 'warn') {
                payload = [`${prefix} ⚠️ ${msg}`, ...args];
            } else if (level === 'error') {
                payload = [`${prefix} ❌ ${msg}`, ...args];
            } else {
                payload = [`${prefix} ${msg}`, ...args];
            }
            console[level](...payload);
            this._emit(level, payload);
        },

        createModuleLogger(moduleIdSource) {
            const resolveModuleId = typeof moduleIdSource === 'function'
                ? moduleIdSource
                : () => moduleIdSource;
            return {
                log: (msg, ...args) => this._logModule('log', msg, resolveModuleId(), ...args),
                debug: (msg, ...args) => this._logModule('debug', msg, resolveModuleId(), ...args),
                warn: (msg, ...args) => this._logModule('warn', msg, resolveModuleId(), ...args),
                error: (msg, ...args) => this._logModule('error', msg, resolveModuleId(), ...args),
                isVerboseEnabled: () => this._shouldLogModule(resolveModuleId()),
                isDebugEnabled: () => this._shouldLogModule(resolveModuleId())
            };
        },
        
        log(msg, ...args) {
            if (this.isDebugEnabled()) {
                const payload = [`${LOG_PREFIX} ${msg}`, ...args];
                console.log(...payload);
                this._emit('log', payload);
            }
        },
        
        debug(msg, ...args) {
            if (this.isVerboseEnabled()) {
                const payload = [`${LOG_PREFIX} 🔍 ${msg}`, ...args];
                console.debug(...payload);
                this._emit('debug', payload);
            }
        },
        
        warn(msg, ...args) {
            const payload = [`${LOG_PREFIX} ⚠️ ${msg}`, ...args];
            console.warn(...payload);
            this._emit('warn', payload);
        },
        
        error(msg, ...args) {
            const payload = [`${LOG_PREFIX} ❌ ${msg}`, ...args];
            console.error(...payload);
            this._emit('error', payload);
        }
    };

    // ============= DOM SELECTORS (SAFE) =============
    const DomUtils = {
        _invalidSelectorLog: new Set(),
        
        _resolveRoot(options) {
            return (options && options.root) ? options.root : document;
        },
        
        _logInvalidSelector(selector, error, contextLabel) {
            const key = `${contextLabel || 'unknown'}::${selector}`;
            if (this._invalidSelectorLog.has(key)) return;
            this._invalidSelectorLog.add(key);
            const contextSuffix = contextLabel ? ` (${contextLabel})` : '';
            Logger.error(`Invalid selector${contextSuffix}: "${selector}"`, error);
        },
        
        query(selector, options = {}) {
            if (!selector) return null;
            const root = this._resolveRoot(options);
            if (!root || !root.querySelector) return null;
            try {
                return root.querySelector(selector);
            } catch (error) {
                this._logInvalidSelector(selector, error, options.context);
                return null;
            }
        },
        
        queryAll(selector, options = {}) {
            if (!selector) return [];
            const root = this._resolveRoot(options);
            if (!root || !root.querySelectorAll) return [];
            try {
                return Array.from(root.querySelectorAll(selector));
            } catch (error) {
                this._logInvalidSelector(selector, error, options.context);
                return [];
            }
        },
        
        closest(element, selector, options = {}) {
            if (!element || !selector || !element.closest) return null;
            try {
                return element.closest(selector);
            } catch (error) {
                this._logInvalidSelector(selector, error, options.context);
                return null;
            }
        }
    };
    
    Context.dom = DomUtils;

    // ============= ARCHETYPE MANAGER =============
    const ArchetypeManager = {
        archetypes: [],
        corePlugins: [],
        devPlugins: [],
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
                                this.corePlugins = config.corePlugins || [];
                                this.devPlugins = config.devPlugins || [];
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

        getCorePlugins() {
            return this.corePlugins || [];
        },

        getDevPlugins() {
            return this.devPlugins || [];
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
                        const exists = Context.dom.query(selector, {
                            context: `archetype:${archetype.id}`
                        }) !== null;
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
        
        /**
         * Load plugin code from URL (but don't cache yet - version verification happens first)
         * @param {string} url - URL to fetch plugin from
         * @param {string} filename - Plugin filename
         * @param {string} sourcePath - Full path for caching (e.g., "global/plugin.js")
         * @param {string} version - Expected version (for logging only - actual verification happens later)
         * @returns {Promise<{code: string, version: string}>}
         */
        async loadPluginFromUrl(url, filename, sourcePath, version) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: (response) => {
                        if (response.status === 200) {
                            const code = response.responseText;
                            // Don't cache here - version verification happens in loadPluginCode
                            // Cache will be set after verification passes
                            resolve({ code, version });
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
        
        /**
         * Cache plugin code with version (called after version verification)
         * @param {string} filename - Plugin filename
         * @param {string} sourcePath - Full path for caching
         * @param {string} code - Plugin code
         * @param {string} version - Version to cache with
         */
        cachePluginCode(filename, sourcePath, code, version) {
            const pluginKey = Storage.getPluginKey(filename, sourcePath);
            Storage.setCachedPlugin(pluginKey, code, version);
            Logger.debug(`Cached plugin ${filename} v${version}`);
        },
        
        /**
         * Load plugin code from cache or URL, with version verification
         * @param {string} filename - Plugin filename
         * @param {string} sourcePath - Full path for caching
         * @param {string} version - Required version
         * @param {string} url - URL to fetch from if not cached
         * @returns {Promise<string>} - Plugin code
         */
        async loadPluginCode(filename, sourcePath, version, url) {
            const pluginKey = Storage.getPluginKey(filename, sourcePath);
            const cached = Storage.getCachedPlugin(pluginKey);
            
            // Check if we have a cached version that matches
            if (cached && cached.version === version) {
                Logger.debug(`Using cached plugin ${filename} v${version}`);
                return cached.code;
            }
            
            // Version mismatch or not cached - try to fetch
            Logger.log(`Fetching plugin ${filename} v${version}${cached ? ` (cached: v${cached.version})` : ''}`);
            
            try {
                const result = await this.loadPluginFromUrl(url, filename, sourcePath, version);
                const fetchedCode = result.code;
                
                // Verify the fetched version by parsing the plugin
                // This protects against GitHub CDN cache delays
                try {
                    const parsedPlugin = this.parsePluginCode(fetchedCode, filename);
                    const fetchedVersion = parsedPlugin._version || parsedPlugin.version || null;
                    
                    if (fetchedVersion && fetchedVersion !== version) {
                        // Fetched version doesn't match expected - GitHub CDN might be stale
                        Logger.warn(`⚠ Fetched ${filename} has version v${fetchedVersion}, expected v${version}. GitHub CDN may be stale.`);
                        
                        // Don't cache the wrong version - use old cache if available
                        if (cached) {
                            Logger.warn(`Using cached v${cached.version} instead of stale fetched version`);
                            Context.outdatedPlugins.push({
                                filename: filename,
                                sourcePath: sourcePath,
                                cachedVersion: cached.version,
                                requiredVersion: version,
                                fetchedVersion: fetchedVersion
                            });
                            return cached.code;
                        } else {
                            // No cache available, but version is wrong - use it anyway with warning
                            Logger.warn(`No cache available, using fetched version v${fetchedVersion} (expected v${version})`);
                            Context.outdatedPlugins.push({
                                filename: filename,
                                sourcePath: sourcePath,
                                cachedVersion: null,
                                requiredVersion: version,
                                fetchedVersion: fetchedVersion
                            });
                            // Don't cache the wrong version
                            return fetchedCode;
                        }
                    }
                    
                    // Version matches (or plugin doesn't declare version) - cache it
                    this.cachePluginCode(filename, sourcePath, fetchedCode, version);
                    Logger.debug(`Verified and cached ${filename} v${version}`);
                    return fetchedCode;
                    
                } catch (parseError) {
                    // Failed to parse - this shouldn't happen, but if it does, use old cache
                    Logger.error(`Failed to parse fetched plugin ${filename} for version verification:`, parseError);
                    if (cached) {
                        Logger.warn(`Using cached v${cached.version} due to parse error`);
                        Context.outdatedPlugins.push({
                            filename: filename,
                            sourcePath: sourcePath,
                            cachedVersion: cached.version,
                            requiredVersion: version,
                            parseError: true
                        });
                        return cached.code;
                    }
                    // No cache, but can't parse - rethrow
                    throw parseError;
                }
                
            } catch (error) {
                // Fetch failed - use cached version if available (with warning)
                if (cached) {
                    Logger.warn(`⚠ Failed to fetch ${filename} v${version}, using cached v${cached.version}`);
                    Context.outdatedPlugins.push({
                        filename: filename,
                        sourcePath: sourcePath,
                        cachedVersion: cached.version,
                        requiredVersion: version
                    });
                    return cached.code;
                }
                // No cache available, rethrow error
                throw error;
            }
        },
        
        /**
         * Parse and execute plugin code
         * @param {string} code - Plugin code
         * @param {string} filename - Plugin filename
         * @returns {Object} - Plugin object
         */
        parsePluginCode(code, filename, options = {}) {
            try {
                const useModuleLogger = options.useModuleLogger === true;
                const moduleIdHint = options.moduleIdHint || filename;
                let resolvedModuleId = moduleIdHint;
                const moduleLogger = useModuleLogger
                    ? Logger.createModuleLogger(() => resolvedModuleId)
                    : Logger;
                const pluginFactory = new Function(
                    'PluginManager',
                    'Storage',
                    'Logger',
                    'Context',
                    'CleanupRegistry',
                    code + '\n\n// Return the plugin for registration\nreturn plugin;'
                );

                const plugin = pluginFactory(
                    PluginManager,
                    Storage,
                    moduleLogger,
                    Context,
                    CleanupRegistry
                );
                if (useModuleLogger && plugin && plugin.id) {
                    resolvedModuleId = plugin.id;
                }
                return plugin;
            } catch (e) {
                Logger.error(`Failed to parse plugin ${filename}:`, e);
                throw e;
            }
        },
        
        /**
         * Load a core plugin with versioning support
         * @param {string} filename - Plugin filename
         * @param {string} version - Required version
         * @returns {Promise<Object>} - Plugin object
         */
        async loadCorePlugin(filename, version) {
            const sourcePath = `core/${filename}`;
            const url = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.corePath}/${filename}`;
            
            // Load plugin code with versioning
            const code = await this.loadPluginCode(filename, sourcePath, version, url);
            const plugin = this.parsePluginCode(code, filename, { useModuleLogger: false });
            this._loadedPluginFiles.add(sourcePath);
            Logger.debug(`Loaded core plugin ${filename} v${version}`);
            return plugin;
        },

        /**
         * Load a dev plugin with versioning support
         * @param {string} filename - Plugin filename
         * @param {string} version - Required version
         * @returns {Promise<Object>} - Plugin object
         */
        async loadDevPlugin(filename, version) {
            const sourcePath = `dev/${filename}`;
            const url = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.devPath}/${filename}`;

            const code = await this.loadPluginCode(filename, sourcePath, version, url);
            const plugin = this.parsePluginCode(code, filename, { useModuleLogger: false });
            this._loadedPluginFiles.add(sourcePath);
            Logger.debug(`Loaded dev plugin ${filename} v${version}`);
            return plugin;
        },
        
        /**
         * Load an archetype plugin with versioning support
         * @param {string} filename - The plugin filename or path (e.g., "network-interception.js" or "global/network-interception.js")
         * @param {string} version - Required version (e.g., "1.0")
         * @param {string} archetypeId - The archetype ID (e.g., "k-taskCreation")
         * @returns {Promise} - Resolves with the plugin object
         */
        async loadArchetypePlugin(filename, version, archetypeId) {
            // Check if filename contains an explicit folder path (e.g., "global/plugin.js" or "shared/plugin.js")
            const pathParts = filename.split('/');
            let sourcePath, url;
            
            if (pathParts.length > 1) {
                // Explicit folder path specified, use it directly
                const folderPath = pathParts.slice(0, -1).join('/');
                const actualFilename = pathParts[pathParts.length - 1];
                sourcePath = `${folderPath}/${actualFilename}`;
                url = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.pluginsPath}/${sourcePath}`;
                
                Logger.debug(`Loading plugin from explicit path: ${sourcePath} v${version}`);
            } else {
                // No explicit path, use default resolution: check global first, then archetype folder
                const globalPath = `global/${filename}`;
                const globalUrl = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.pluginsPath}/${globalPath}`;
                
                // Try to load from global first (with versioning)
                try {
                    const code = await this.loadPluginCode(filename, globalPath, version, globalUrl);
                    const plugin = this.parsePluginCode(code, filename, { useModuleLogger: true });
                    this._loadedPluginFiles.add(globalPath);
                    Logger.debug(`Loaded ${filename} v${version} from global folder`);
                    return plugin;
                } catch (error) {
                    // If global fails (404 or other), try archetype folder
                    if (error.message && error.message.includes('404')) {
                        Logger.debug(`Plugin ${filename} not found in global, trying archetype folder: ${archetypeId}`);
                    } else {
                        Logger.warn(`Error loading ${filename} from global, trying archetype folder:`, error);
                    }
                    
                    // Fall through to archetype folder
                    sourcePath = `${archetypeId}/${filename}`;
                    url = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.pluginsPath}/${sourcePath}`;
                }
            }
            
            // Load from determined path (explicit or archetype folder)
            const code = await this.loadPluginCode(filename, sourcePath, version, url);
            const plugin = this.parsePluginCode(code, filename, { useModuleLogger: true });
            this._loadedPluginFiles.add(sourcePath);
            Logger.debug(`Loaded ${filename} v${version} from ${sourcePath}`);
            return plugin;
        },
        
        async loadPluginsFromConfig(pluginList, type) {
            if (!pluginList || pluginList.length === 0) {
                Logger.debug(`No ${type} plugins configured`);
                return;
            }

            const normalizedType = type === 'dev' ? 'dev' : 'core';
            Logger.log(`Loading ${pluginList.length} ${normalizedType} plugin(s)...`);

            const loader = normalizedType === 'dev'
                ? this.loadDevPlugin.bind(this)
                : this.loadCorePlugin.bind(this);

            for (const pluginDef of pluginList) {
                // Support both old format (string) and new format (object with name and version)
                let filename, version;
                if (typeof pluginDef === 'string') {
                    // Backward compatibility: if just a string, default to version 1.0
                    filename = pluginDef;
                    version = '1.0';
                } else if (pluginDef && pluginDef.name && pluginDef.version) {
                    filename = pluginDef.name;
                    version = pluginDef.version;
                } else {
                    Logger.error(`Invalid ${normalizedType} plugin definition:`, pluginDef);
                    continue;
                }
                
                try {
                    const plugin = await loader(filename, version);
                    const loadedVersion = plugin._version || plugin.version || version;
                    plugin._sourceFile = filename;
                    plugin._version = loadedVersion;
                    plugin._isCore = true;
                    if (normalizedType === 'dev') {
                        plugin._isDev = true;
                    }
                    PluginManager.register(plugin);
                    Logger.log(`✓ Loaded ${normalizedType} plugin: ${filename} v${loadedVersion}`);
                } catch (err) {
                    Logger.error(`✗ Failed to load ${normalizedType} plugin: ${filename} v${version}`, err);
                }
            }
        },
        
        async loadPluginsForArchetype(pluginList, archetypeId) {
            if (!pluginList || pluginList.length === 0) {
                Logger.log('No plugins to load for this archetype');
                return;
            }
            
            if (!archetypeId) {
                Logger.error('Archetype ID required to load plugins');
                return;
            }
            
            Logger.log(`Loading ${pluginList.length} archetype plugin(s) for ${archetypeId}...`);
            const loadPromises = [];
            
            for (const pluginDef of pluginList) {
                // Support both old format (string) and new format (object with name and version)
                let filename, version;
                if (typeof pluginDef === 'string') {
                    // Backward compatibility: if just a string, default to version 1.0
                    filename = pluginDef;
                    version = '1.0';
                } else if (pluginDef && pluginDef.name && pluginDef.version) {
                    filename = pluginDef.name;
                    version = pluginDef.version;
                } else {
                    Logger.error('Invalid plugin definition:', pluginDef);
                    continue;
                }
                
                // Check if already loaded
                // First check by source file (handles explicit paths like "global/plugin.js")
                const existingPlugins = PluginManager.getAll();
                const alreadyLoadedByFile = existingPlugins.some(p => p._sourceFile === filename);
                
                // Also check if the resolved path is already loaded (for implicit paths that resolved to a location)
                let alreadyLoadedByPath = false;
                if (!alreadyLoadedByFile) {
                    // Determine what path this would resolve to
                    const pathParts = filename.split('/');
                    if (pathParts.length > 1) {
                        // Explicit path - check if this exact path was loaded
                        const explicitPath = filename;
                        alreadyLoadedByPath = this._loadedPluginFiles.has(explicitPath);
                    } else {
                        // Implicit path - check both global and archetype locations
                        const globalPath = `global/${filename}`;
                        const archetypePath = `${archetypeId}/${filename}`;
                        alreadyLoadedByPath = this._loadedPluginFiles.has(globalPath) || 
                                            this._loadedPluginFiles.has(archetypePath);
                    }
                }
                
                if (alreadyLoadedByFile || alreadyLoadedByPath) {
                    Logger.debug(`Plugin ${filename} already loaded, skipping fetch`);
                    continue;
                }
                
                loadPromises.push(
                    this.loadArchetypePlugin(filename, version, archetypeId)
                        .then(plugin => {
                            const loadedVersion = plugin._version || plugin.version || version;
                            plugin._sourceFile = filename;
                            plugin._version = loadedVersion;
                            plugin._isCore = false;
                            PluginManager.register(plugin);
                            Logger.log(`✓ Loaded plugin: ${filename} v${loadedVersion}`);
                        })
                        .catch(err => {
                            Logger.error(`✗ Failed to load plugin: ${filename} v${version}`, err);
                        })
                );
            }
            
            await Promise.allSettled(loadPromises);
            
            // Log warnings about outdated plugins
            if (Context.outdatedPlugins.length > 0) {
                Logger.warn(`⚠ ${Context.outdatedPlugins.length} plugin(s) are using outdated cached versions:`);
                Context.outdatedPlugins.forEach(p => {
                    Logger.warn(`  - ${p.filename}: cached v${p.cachedVersion}, required v${p.requiredVersion}`);
                });
            }
            
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

        await ArchetypeManager.loadArchetypes();
        const corePlugins = ArchetypeManager.getCorePlugins();
        await PluginLoader.loadPluginsFromConfig(corePlugins, 'core');

        if (DEV_LOG_PANEL_ENABLED) {
            const devPlugins = ArchetypeManager.getDevPlugins();
            await PluginLoader.loadPluginsFromConfig(devPlugins, 'dev');
        }
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
            await PluginLoader.loadPluginsForArchetype(pluginsToLoad, archetype.id);
            
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
        Logger.log('Handling navigation, checking archetype match...');
        
        try {
            await ArchetypeManager.loadArchetypes();
            
            const newPath = UrlMatcher.getPathFromUrl(newUrl);
            const matchesArchetype = ArchetypeManager.archetypes.some(archetype => {
                if (!archetype.urlPattern) {
                    return false;
                }
                return UrlMatcher.matches(newPath, archetype.urlPattern);
            });
            
            if (matchesArchetype) {
                Logger.log('Navigation target matches archetype; refreshing page...');
                location.reload();
                return;
            }
        } catch (error) {
            Logger.error('Failed to check archetype match on navigation:', error);
        }
        
        Logger.log('Handling navigation, reinitializing...');
        
        // Clean up archetype plugins and resources
        Context.initialized = false;
        Context.outdatedPlugins = []; // Clear outdated plugins list on navigation
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
        Logger.log(`${LOG_PREFIX} v${VERSION} starting...`);
        
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

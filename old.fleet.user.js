// ==UserScript==
// @name         [DETATCHED] Fleet Workflow Builder UX Enhancer
// @namespace    http://tampermonkey.net/
// @version      x.x.x
// @description  UX improvements for workflow builder tool with improved layout, favorites, and fixes
// @author       You
// @match        https://fleetai.com/work/problems/create*
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ============= CORE CONFIGURATION =============
    const VERSION = 'x.x.1';
    const STORAGE_PREFIX = 'wf-enhancer-';
    
    // ============= SHARED CONTEXT =============
    // Shared state accessible by all plugins
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
        
        // Standard info logging (when debug enabled)
        log(msg, ...args) {
            if (this.isDebugEnabled()) {
                console.log(`[Fleet Enhancer] ${msg}`, ...args);
            }
        },
        
        // Verbose/trace logging (when verbose enabled)
        debug(msg, ...args) {
            if (this.isVerboseEnabled()) {
                console.debug(`[Fleet Enhancer] 🔍 ${msg}`, ...args);
            }
        },
        
        // Warnings (always shown)
        warn(msg, ...args) {
            console.warn(`[Fleet Enhancer] ⚠️ ${msg}`, ...args);
        },
        
        // Errors (always shown)
        error(msg, ...args) {
            console.error(`[Fleet Enhancer] ❌ ${msg}`, ...args);
        }
    };

    // ============= SELECTORS =============
    // Centralized selector definitions
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
        
        // Run early plugins (before DOM ready)
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
        
        // Run init plugins (after DOM ready, once)
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
        
        // Run mutation plugins (on each DOM mutation)
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

    // ============= PLUGIN DEFINITIONS =============

    // ---------- Network Interception Plugin ----------
    PluginManager.register({
        id: 'networkInterception',
        name: 'Network Interception',
        description: 'Captures MCP request URLs for the Source Data Explorer button',
        enabledByDefault: true,
        phase: 'early',
        initialState: {},
        
        init(state, context) {
            const pageWindow = context.getPageWindow();
            const originalFetch = pageWindow.fetch;

            pageWindow.fetch = function(...args) {
                const [resource, config] = args;
                let url;
                try {
                    url = new URL(resource, pageWindow.location.href);
                } catch (e) {
                    url = { href: resource, pathname: '' };
                }

                if (url.pathname === '/mcp' && config && config.method === 'POST') {
                    if (context.source === null) {
                        context.source = url.href;
                        console.log('[Fleet Enhancer] ✓ Source URL captured (fetch)');
                    }
                }
                return originalFetch.apply(this, args);
            };

            const originalXHROpen = pageWindow.XMLHttpRequest.prototype.open;
            const originalXHRSend = pageWindow.XMLHttpRequest.prototype.send;

            pageWindow.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                this._interceptedURL = url;
                this._interceptedMethod = method;
                return originalXHROpen.apply(this, [method, url, ...rest]);
            };

            pageWindow.XMLHttpRequest.prototype.send = function(body) {
                if (this._interceptedMethod === 'POST' && this._interceptedURL && this._interceptedURL.includes('/mcp')) {
                    if (context.source === null) {
                        context.source = this._interceptedURL;
                        console.log('[Fleet Enhancer] ✓ Source URL captured (XHR)');
                    }
                }
                return originalXHRSend.apply(this, [body]);
            };

            // Expose getter globally for debugging
            pageWindow.getFleetSource = () => context.source;
            
            console.log('[Fleet Enhancer] ✓ Network interception installed');
        }
    });

    // ---------- Autocorrect Search Plugin ----------
    PluginManager.register({
        id: 'autocorrectSearch',
        name: 'Disable Search Autocorrect',
        description: 'Disables autocorrect/autocomplete on the search input',
        enabledByDefault: true,
        phase: 'mutation',
        initialState: { applied: false },
        
        onMutation(state, context) {
            if (state.applied) return;

            const searchInput = document.querySelector('input[placeholder="Search tools, descriptions, parameters..."]');
            if (searchInput) {
                searchInput.setAttribute('autocomplete', 'off');
                searchInput.setAttribute('autocorrect', 'off');
                searchInput.setAttribute('autocapitalize', 'off');
                searchInput.setAttribute('spellcheck', 'false');
                searchInput.setAttribute('data-form-type', 'other');
                searchInput.setAttribute('data-lpignore', 'true');
                searchInput.setAttribute('data-1p-ignore', 'true');
                state.applied = true;
                Logger.log('✓ Autocorrect disabled on search input');
            }
        }
    });

    // ---------- Autocorrect Textareas Plugin ----------
    PluginManager.register({
        id: 'autocorrectTextareas',
        name: 'Disable Textarea Autocorrect',
        description: 'Disables autocorrect on prompt editor and notes',
        enabledByDefault: true,
        phase: 'mutation',
        initialState: { promptEditor: false, notesTextarea: false },
        
        onMutation(state, context) {
            if (!state.promptEditor) {
                const promptEditor = document.getElementById('prompt-editor');
                if (promptEditor) {
                    promptEditor.setAttribute('autocomplete', 'off');
                    promptEditor.setAttribute('autocorrect', 'off');
                    promptEditor.setAttribute('autocapitalize', 'off');
                    promptEditor.setAttribute('spellcheck', 'false');
                    state.promptEditor = true;
                    Logger.log('✓ Autocorrect disabled on prompt editor');
                }
            }

            if (!state.notesTextarea) {
                const notesTextarea = document.getElementById('wf-notes-textarea');
                if (notesTextarea) {
                    notesTextarea.setAttribute('autocomplete', 'off');
                    notesTextarea.setAttribute('autocorrect', 'off');
                    notesTextarea.setAttribute('autocapitalize', 'off');
                    notesTextarea.setAttribute('spellcheck', 'false');
                    state.notesTextarea = true;
                    Logger.log('✓ Autocorrect disabled on notes textarea');
                }
            }
        }
    });

    // ---------- Expand/Collapse Buttons Plugin ----------
    PluginManager.register({
        id: 'expandCollapseButtons',
        name: 'Expand/Collapse All',
        description: 'Adds buttons to expand or collapse all workflow tools',
        enabledByDefault: true,
        phase: 'mutation',
        initialState: { added: false },
        
        onMutation(state, context) {
            const toolbar = document.querySelector(SELECTORS.toolbar);
            if (!toolbar) return;

            const toolsIndicator = document.querySelector(SELECTORS.workflowToolsIndicator);
            const hasTools = toolsIndicator && toolsIndicator.children.length > 0;

            let container = document.getElementById('wf-expand-collapse-container');
            
            if (!container) {
                const buttonClass = 'inline-flex items-center justify-center whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 transition-colors hover:bg-accent rounded-sm h-7 px-2 text-xs text-muted-foreground hover:text-foreground';

                container = document.createElement('div');
                container.id = 'wf-expand-collapse-container';
                container.className = 'flex items-center gap-2';

                const expandBtn = document.createElement('button');
                expandBtn.id = 'wf-expand-btn';
                expandBtn.className = buttonClass;
                expandBtn.innerHTML = `<span>Expand All</span>`;
                expandBtn.addEventListener('click', () => this.setAllToolsState('open'));

                const divider = document.createElement('div');
                divider.className = 'w-px h-5 bg-border mx-1';

                const collapseBtn = document.createElement('button');
                collapseBtn.id = 'wf-collapse-btn';
                collapseBtn.className = buttonClass;
                collapseBtn.innerHTML = `<span>Collapse All</span>`;
                collapseBtn.addEventListener('click', () => this.setAllToolsState('closed'));

                const trailingDivider = document.createElement('div');
                trailingDivider.id = 'wf-expand-collapse-trailing-divider';
                trailingDivider.className = 'w-px h-5 bg-border mx-1';

                container.appendChild(expandBtn);
                container.appendChild(divider);
                container.appendChild(collapseBtn);
                container.appendChild(trailingDivider);

                toolbar.insertBefore(container, toolbar.firstChild);
                state.added = true;
                Logger.log('✓ Expand/Collapse buttons added to toolbar');
            }

            container.style.display = hasTools ? 'flex' : 'none';
        },
        
        setAllToolsState(targetState) {
            const toolsContainer = document.querySelector(SELECTORS.toolsContainer);
            if (!toolsContainer) {
                Logger.log('⚠ Tools container not found for expand/collapse');
                return;
            }

            const toolHeaders = toolsContainer.querySelectorAll(SELECTORS.toolHeader);
            let successCount = 0;

            toolHeaders.forEach((header) => {
                const currentState = header.getAttribute('data-state');
                if ((targetState === 'open' && currentState === 'closed') ||
                    (targetState === 'closed' && currentState === 'open')) {
                    header.click();
                    successCount++;
                }
            });

            Logger.log(`✓ ${targetState === 'open' ? 'Expanded' : 'Collapsed'} ${successCount} tools`);
        }
    });

    // ---------- Remove Textarea Gradient Plugin ----------
    PluginManager.register({
        id: 'removeTextareaGradient',
        name: 'Remove Textarea Gradient',
        description: 'Removes the gradient fade overlay from the prompt textarea',
        enabledByDefault: true,
        phase: 'mutation',
        initialState: { removed: false },
        
        onMutation(state, context) {
            if (state.removed) return;

            const container = document.querySelector(SELECTORS.promptTextareaContainer);
            if (!container) return;

            const gradientOverlay = container.querySelector('div.bg-gradient-to-b');
            if (gradientOverlay) {
                gradientOverlay.style.background = 'none';
                gradientOverlay.style.pointerEvents = 'none';
                state.removed = true;
                Logger.log('✓ Textarea gradient fade removed');
            }
        }
    });

    // ---------- Bug Report Expand Plugin ----------
    PluginManager.register({
        id: 'bugReportExpand',
        name: 'Bug Report Expand',
        description: 'Makes bug report cards expandable to see full text',
        enabledByDefault: true,
        phase: 'mutation',
        initialState: {},
        
        onMutation(state, context) {
            const bugReportCards = document.querySelectorAll('div.p-3.bg-muted\\/50.rounded-lg.text-sm');
            if (bugReportCards.length === 0) return;

            let modified = 0;

            bugReportCards.forEach(card => {
                if (card.hasAttribute('data-wf-expand-enabled')) return;

                const contentWrapper = card.querySelector('div.flex.items-start.justify-between.gap-2 > div.flex-1.min-w-0');
                if (!contentWrapper) return;

                const textParagraph = contentWrapper.querySelector('p.text-muted-foreground.text-xs.line-clamp-2');
                if (!textParagraph) return;

                card.setAttribute('data-wf-expand-enabled', 'true');
                contentWrapper.style.cursor = 'pointer';
                contentWrapper.setAttribute('title', 'Click to expand/collapse');

                const originalText = textParagraph.textContent;
                let isExpanded = false;

                contentWrapper.addEventListener('click', (e) => {
                    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;

                    isExpanded = !isExpanded;

                    if (isExpanded) {
                        textParagraph.classList.remove('line-clamp-2');
                        textParagraph.style.whiteSpace = 'pre-wrap';
                        const formattedText = originalText
                            .replace(/\*\*([^*]+)\*\*/g, '$1')
                            .replace(/\n\n/g, '\n');
                        textParagraph.textContent = formattedText;
                    } else {
                        textParagraph.classList.add('line-clamp-2');
                        textParagraph.style.whiteSpace = '';
                        textParagraph.textContent = originalText;
                    }
                });

                modified++;
            });

            if (modified > 0) {
                Logger.log(`✓ Bug report expand/collapse enabled for ${modified} report(s)`);
            }
        }
    });

    // ---------- Mini Execute Buttons Plugin ----------
    PluginManager.register({
        id: 'miniExecuteButtons',
        name: 'Mini Execute Buttons',
        description: 'Adds quick execute buttons to collapsed workflow tools',
        enabledByDefault: true,
        phase: 'mutation',
        initialState: {},
        
        onMutation(state, context) {
            const toolsContainer = document.querySelector(SELECTORS.workflowToolsArea);
            if (!toolsContainer) return;

            const toolCards = toolsContainer.querySelectorAll('div.rounded-lg.border.transition-colors');
            let buttonsAdded = 0;

            toolCards.forEach(card => {
                const collapsibleRoot = card.querySelector('div[data-state]');
                if (!collapsibleRoot) return;

                const header = card.querySelector(SELECTORS.toolHeader);
                if (!header) return;

                const buttonContainer = header.querySelector('div.flex.items-center.gap-1');
                if (!buttonContainer) return;

                let miniExecBtn = buttonContainer.querySelector('.wf-mini-execute-btn');
                const isCollapsed = collapsibleRoot.getAttribute('data-state') === 'closed';

                if (!miniExecBtn) {
                    miniExecBtn = document.createElement('button');
                    miniExecBtn.className = 'wf-mini-execute-btn inline-flex items-center justify-center whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-brand !text-white transition-colors hover:brightness-95 border border-brand-accent rounded-sm size-7 h-7 w-7';
                    miniExecBtn.title = 'Execute';
                    miniExecBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="fill-current size-3.5"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM11.03 8.652C10.7217 8.45933 10.3332 8.44913 10.0152 8.62536C9.69728 8.80158 9.5 9.13648 9.5 9.5V14.5C9.5 14.8635 9.69728 15.1984 10.0152 15.3746C10.3332 15.5509 10.7217 15.5407 11.03 15.348L15.03 12.848C15.3224 12.6653 15.5 12.3448 15.5 12C15.5 11.6552 15.3224 11.3347 15.03 11.152L11.03 8.652Z"></path></svg>`;
                    
                    miniExecBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        this.executeTool(card, header);
                    });

                    buttonContainer.insertBefore(miniExecBtn, buttonContainer.firstChild);
                    buttonsAdded++;
                }

                miniExecBtn.style.display = isCollapsed ? 'inline-flex' : 'none';
            });

            if (buttonsAdded > 0) {
                Logger.log(`✓ Added ${buttonsAdded} mini execute button(s)`);
            }
        },
        
        executeTool(card, header) {
            Logger.log('executeTool called');
            
            const collapsibleRoot = card.querySelector('div[data-state]');
            if (!collapsibleRoot) {
                Logger.log('No collapsible root found');
                return;
            }

            const isCollapsed = collapsibleRoot.getAttribute('data-state') === 'closed';
            
            if (isCollapsed) {
                header.click();
                
                const buttonObserver = new MutationObserver((mutations, obs) => {
                    const collapsibleContent = card.querySelector('div[data-state="open"] > div[id^="radix-"][data-state="open"]');
                    if (!collapsibleContent) return;
                    
                    const buttons = collapsibleContent.querySelectorAll('div.px-3.pb-3.space-y-3 > button');
                    let executeBtn = null;
                    buttons.forEach(btn => {
                        const btnText = btn.textContent.trim();
                        if (btnText === 'Execute' || btnText === 'Re-execute') {
                            executeBtn = btn;
                        }
                    });
                    
                    if (executeBtn) {
                        obs.disconnect();
                        executeBtn.click();
                        Logger.log('Clicked execute button for collapsed tool');
                        this.watchForToolCompletion(card, header);
                    }
                });
                
                buttonObserver.observe(card, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['hidden', 'data-state']
                });
                
                setTimeout(() => buttonObserver.disconnect(), 5000);
            } else {
                const collapsibleContent = card.querySelector('div[data-state="open"] > div[id^="radix-"][data-state="open"]');
                if (collapsibleContent) {
                    const buttons = collapsibleContent.querySelectorAll('div.px-3.pb-3.space-y-3 > button');
                    let executeBtn = null;
                    buttons.forEach(btn => {
                        const btnText = btn.textContent.trim();
                        if (btnText === 'Execute' || btnText === 'Re-execute') {
                            executeBtn = btn;
                        }
                    });
                    
                    if (executeBtn) {
                        executeBtn.click();
                        Logger.log('Clicked execute button for open tool');
                    }
                }
            }
        },
        
        watchForToolCompletion(card, header) {
            const completionObserver = new MutationObserver((mutations, obs) => {
                const hasSuccess = card.classList.contains('border-emerald-500/50');
                const hasError = card.classList.contains('border-red-500/50');
                
                if (hasSuccess || hasError) {
                    obs.disconnect();
                    Logger.log('Tool execution completed with ' + (hasSuccess ? 'SUCCESS' : 'ERROR'));
                    
                    const collapsibleRoot = card.querySelector('div[data-state]');
                    if (collapsibleRoot && collapsibleRoot.getAttribute('data-state') === 'open') {
                        header.click();
                        Logger.log('Collapsed tool after completion');
                    }
                }
            });
            
            completionObserver.observe(card, { attributes: true, attributeFilter: ['class'] });
            setTimeout(() => completionObserver.disconnect(), 5000);
        }
    });

    // ---------- Duplicate to End Plugin ----------
    PluginManager.register({
        id: 'duplicateToEnd',
        name: 'Duplicate to End',
        description: 'Adds button to duplicate a tool and move it to the end of the workflow',
        enabledByDefault: true,
        phase: 'mutation',
        initialState: {},
        
        onMutation(state, context) {
            const toolsContainer = document.querySelector(SELECTORS.workflowToolsArea);
            if (!toolsContainer) return;
            
            const toolCards = toolsContainer.querySelectorAll('div.rounded-lg.border.transition-colors');
            let buttonsAdded = 0;
            
            toolCards.forEach(card => {
                const header = card.querySelector(SELECTORS.toolHeader);
                if (!header) return;
                
                const buttonContainer = header.querySelector('div.flex.items-center.gap-1');
                if (!buttonContainer) return;
                
                if (buttonContainer.querySelector('.wf-duplicate-to-end-btn')) return;
                
                const buttons = buttonContainer.querySelectorAll('button');
                let duplicateBtn = null;
                
                buttons.forEach(btn => {
                    const svg = btn.querySelector('svg');
                    if (svg) {
                        const hasLine15 = svg.querySelector('line[x1="15"][y1="12"][y2="18"]');
                        const hasRect = svg.querySelector('rect[width="14"][height="14"]');
                        if (hasLine15 && hasRect) {
                            duplicateBtn = btn;
                        }
                    }
                });
                
                if (!duplicateBtn) return;
                
                const deleteBtn = duplicateBtn.nextElementSibling;
                if (!deleteBtn || deleteBtn.tagName !== 'BUTTON') return;
                
                const dupToEndBtn = document.createElement('button');
                dupToEndBtn.className = 'wf-duplicate-to-end-btn inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground size-7 h-7 w-7';
                dupToEndBtn.title = 'Duplicate to End of Workflow';
                dupToEndBtn.setAttribute('data-state', 'closed');
                
                dupToEndBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 text-muted-foreground hover:text-primary">
                        <rect x="9" y="2" width="10" height="10" rx="1.5" ry="1.5"></rect>
                        <path d="M5 10c-0.8 0-1.5 0.7-1.5 1.5v7c0 0.8 0.7 1.5 1.5 1.5h7c0.8 0 1.5-0.7 1.5-1.5"></path>
                        <line x1="14" y1="5" x2="14" y2="9"></line>
                        <line x1="12" y1="7" x2="16" y2="7"></line>
                        <polyline points="21 14 21 20 15 20"></polyline>
                        <path d="M21 20 L17 16"></path>
                    </svg>
                `;
                
                dupToEndBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    const currentButtons = buttonContainer.querySelectorAll('button');
                    let currentDuplicateBtn = null;
                    
                    currentButtons.forEach(btn => {
                        const svg = btn.querySelector('svg');
                        if (svg) {
                            const hasLine15 = svg.querySelector('line[x1="15"][y1="12"][y2="18"]');
                            const hasRect = svg.querySelector('rect[width="14"][height="14"]');
                            if (hasLine15 && hasRect) {
                                currentDuplicateBtn = btn;
                            }
                        }
                    });
                    
                    if (currentDuplicateBtn) {
                        this.duplicateToolToEnd(card, currentDuplicateBtn);
                    }
                });
                
                buttonContainer.insertBefore(dupToEndBtn, deleteBtn);
                buttonsAdded++;
            });
            
            if (buttonsAdded > 0) {
                Logger.log('Added ' + buttonsAdded + ' duplicate-to-end button(s)');
            }
            
            // Cleanup orphaned buttons
            this.cleanupOrphanedButtons();
        },
        
        duplicateToolToEnd(card, duplicateBtn) {
            const toolsContainer = document.querySelector(SELECTORS.workflowToolsArea);
            if (!toolsContainer) return;
            
            const toolCardsBefore = toolsContainer.querySelectorAll('div.rounded-lg.border.transition-colors');
            const countBefore = toolCardsBefore.length;
            const toolCardsArray = Array.from(toolCardsBefore);
            const currentIndex = toolCardsArray.indexOf(card.closest('div.rounded-lg.border.transition-colors') || card);
            
            duplicateBtn.click();
            
            const dupeObserver = new MutationObserver((mutations, obs) => {
                const toolCardsAfter = toolsContainer.querySelectorAll('div.rounded-lg.border.transition-colors');
                
                if (toolCardsAfter.length > countBefore) {
                    obs.disconnect();
                    
                    const duplicatedToolIndex = currentIndex + 1;
                    const duplicatedTool = toolCardsAfter[duplicatedToolIndex];
                    
                    if (!duplicatedTool || duplicatedToolIndex === toolCardsAfter.length - 1) return;
                    
                    const movesNeeded = (toolCardsAfter.length - 1) - duplicatedToolIndex;
                    this.moveToolToEndViaKeyboard(duplicatedTool, movesNeeded);
                }
            });
            
            dupeObserver.observe(toolsContainer, { childList: true, subtree: true });
            setTimeout(() => dupeObserver.disconnect(), 3000);
        },
        
        moveToolToEndViaKeyboard(toolCard, movesNeeded) {
            const dragHandle = toolCard.querySelector('div[role="button"][aria-roledescription="sortable"]');
            if (!dragHandle) return;
            
            dragHandle.focus();
            
            setTimeout(() => {
                const spaceDownEvent = new KeyboardEvent('keydown', {
                    key: ' ', code: 'Space', keyCode: 32, which: 32,
                    bubbles: true, cancelable: true
                });
                dragHandle.dispatchEvent(spaceDownEvent);
                
                let moveCount = 0;
                const moveInterval = setInterval(() => {
                    if (moveCount >= movesNeeded) {
                        clearInterval(moveInterval);
                        setTimeout(() => {
                            const spaceDropEvent = new KeyboardEvent('keydown', {
                                key: ' ', code: 'Space', keyCode: 32, which: 32,
                                bubbles: true, cancelable: true
                            });
                            dragHandle.dispatchEvent(spaceDropEvent);
                            dragHandle.blur();
                            Logger.log('Tool moved to end successfully');
                        }, 50);
                        return;
                    }
                    
                    const arrowDownEvent = new KeyboardEvent('keydown', {
                        key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40,
                        bubbles: true, cancelable: true
                    });
                    dragHandle.dispatchEvent(arrowDownEvent);
                    moveCount++;
                }, 50);
            }, 50);
        },
        
        cleanupOrphanedButtons() {
            const allDupToEndBtns = document.querySelectorAll('.wf-duplicate-to-end-btn');
            let removed = 0;
            
            allDupToEndBtns.forEach(btn => {
                const buttonContainer = btn.parentElement;
                if (!buttonContainer) {
                    btn.remove();
                    removed++;
                    return;
                }
                
                const prevSibling = btn.previousElementSibling;
                const nextSibling = btn.nextElementSibling;
                
                if (!prevSibling || !nextSibling || nextSibling.tagName !== 'BUTTON') {
                    btn.remove();
                    removed++;
                }
            });
            
            if (removed > 0) {
                Logger.log(`Cleaned up ${removed} orphaned duplicate-to-end button(s)`);
            }
        }
    });

    // ---------- Source Data Explorer Plugin ----------
    PluginManager.register({
        id: 'sourceDataExplorer',
        name: 'Source Data Explorer',
        description: 'Adds button to open the source data URL in a new tab',
        enabledByDefault: true,
        phase: 'mutation',
        initialState: { added: false },
        
        onMutation(state, context) {
            if (!context.source) return;
            if (state.added) return;
            
            const containers = document.querySelectorAll('div.flex.items-center.gap-2.mt-2');
            let targetContainer = null;
            
            for (const container of containers) {
                const recommendBtn = container.querySelector('button');
                if (recommendBtn && recommendBtn.textContent.includes('Recommend Tools')) {
                    targetContainer = container;
                    break;
                }
            }
            
            if (!targetContainer) return;
            if (targetContainer.querySelector('#wf-source-explorer-btn')) {
                state.added = true;
                return;
            }
            
            let baseUrl = context.source;
            if (baseUrl.includes('/mcp')) {
                baseUrl = baseUrl.substring(0, baseUrl.indexOf('/mcp'));
            }
            
            const sourceBtn = document.createElement('button');
            sourceBtn.id = 'wf-source-explorer-btn';
            sourceBtn.className = 'inline-flex items-center justify-center whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background transition-colors hover:bg-accent hover:text-accent-foreground h-8 rounded-sm pl-3 pr-3 text-xs gap-1.5 relative';
            sourceBtn.setAttribute('data-state', 'closed');
            
            sourceBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 text-blue-500">
                    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                    <path d="M3 5V19C3 20.6569 7.02944 22 12 22C16.9706 22 21 20.6569 21 19V5"></path>
                    <path d="M3 12C3 13.6569 7.02944 15 12 15C16.9706 15 21 13.6569 21 12"></path>
                </svg>
                Source Data Explorer
            `;
            
            sourceBtn.addEventListener('click', () => {
                window.open(baseUrl, '_blank');
                Logger.log('Opened source URL: ' + baseUrl);
            });
            
            const firstButton = targetContainer.querySelector('button');
            if (firstButton && firstButton.nextSibling) {
                targetContainer.insertBefore(sourceBtn, firstButton.nextSibling);
            } else {
                targetContainer.appendChild(sourceBtn);
            }
            
            state.added = true;
            Logger.log('✓ Source Data Explorer button added');
        }
    });

    // ---------- Auto Confirm Re-execute Plugin ----------
    PluginManager.register({
        id: 'autoConfirmReexecute',
        name: 'Auto-Confirm Re-execute',
        description: 'Automatically confirms re-execute dialogs',
        enabledByDefault: true,
        phase: 'mutation',
        initialState: {},
        
        onMutation(state, context) {
            const dialog = document.querySelector('div[role="alertdialog"][data-state="open"]');
            if (!dialog) return;
            
            const heading = dialog.querySelector('h2');
            if (!heading || !heading.textContent.includes('Re-execute this step')) return;
            
            const buttons = dialog.querySelectorAll('button');
            let confirmBtn = null;
            
            buttons.forEach(btn => {
                const btnText = btn.textContent.trim();
                if (btnText.includes('Re-execute') && btnText.includes('Invalidate')) {
                    confirmBtn = btn;
                }
            });
            
            if (confirmBtn) {
                Logger.log('Auto-confirming re-execute dialog');
                confirmBtn.click();
            }
        }
    });

    // ---------- Three Column Layout Plugin ----------
    PluginManager.register({
        id: 'threeColumnLayout',
        name: 'Three Column Layout',
        description: 'Transforms the layout into three resizable columns',
        enabledByDefault: true,
        phase: 'mutation',
        initialState: { applied: false },
        
        onMutation(state, context) {
            if (state.applied) return;

            const mainContainer = document.querySelector(SELECTORS.mainContainer);
            if (!mainContainer) return;

            if (document.getElementById('wf-three-col-layout')) {
                state.applied = true;
                return;
            }

            const leftColumn = document.querySelector(SELECTORS.leftColumn);
            const existingDivider = mainContainer.querySelector('div[data-resize-handle]');
            const workflowColumn = document.querySelector(SELECTORS.workflowColumn);

            if (!leftColumn || !workflowColumn || !existingDivider) return;

            const topSection = leftColumn.querySelector('div.flex-shrink-0');
            const bottomSection = leftColumn.querySelector('div.flex-1.min-h-0.overflow-hidden');

            if (!topSection || !bottomSection) return;

            const panelGroupId = mainContainer.getAttribute('data-panel-group-id') || ':r6:';
            
            const preservedElements = {
                leftColumn: leftColumn.parentNode.removeChild(leftColumn),
                workflowColumn: workflowColumn.parentNode.removeChild(workflowColumn),
                topSection: topSection,
                bottomSection: bottomSection
            };
            
            mainContainer.innerHTML = '';
            mainContainer.id = 'wf-three-col-layout';

            const savedCol1 = Storage.get(STORAGE_KEYS.col1Width, 25);
            const savedCol2 = Storage.get(STORAGE_KEYS.col2Width, 37.5);
            const savedCol3 = Storage.get(STORAGE_KEYS.col3Width, 37.5);

            const col1 = document.createElement('div');
            col1.className = 'flex flex-col overflow-hidden transition-opacity';
            col1.id = 'wf-col-text';
            col1.style.cssText = `flex: ${savedCol1} 1 0px; overflow: hidden;`;
            col1.setAttribute('data-panel-group-id', panelGroupId);
            col1.setAttribute('data-panel', '');
            col1.setAttribute('data-panel-id', 'wf-col-text');
            col1.setAttribute('data-panel-size', '25');
            
            const splitWrapper = document.createElement('div');
            splitWrapper.className = 'flex flex-col h-full';
            splitWrapper.id = 'wf-split-wrapper';
            
            this.reorganizeFirstColumnContent(splitWrapper, preservedElements.topSection);
            col1.appendChild(splitWrapper);

            const divider1 = this.createDivider(panelGroupId, 'wf-divider-1', 'wf-col-text', 40, 15, 25);
            
            const col2 = document.createElement('div');
            col2.className = 'flex flex-col overflow-hidden transition-opacity';
            col2.id = 'wf-col-tools';
            col2.style.cssText = `flex: ${savedCol2} 1 0px; overflow: hidden;`;
            col2.setAttribute('data-panel-group-id', panelGroupId);
            col2.setAttribute('data-panel', '');
            col2.setAttribute('data-panel-id', 'wf-col-tools');
            col2.setAttribute('data-panel-size', '37.5');
            col2.appendChild(preservedElements.bottomSection);

            const divider2 = this.createDivider(panelGroupId, 'wf-divider-2', 'wf-col-tools', 50, 20, 37.5);

            preservedElements.workflowColumn.style.flex = `${savedCol3} 1 0px`;
            preservedElements.workflowColumn.setAttribute('data-panel-size', savedCol3.toString());

            mainContainer.appendChild(col1);
            mainContainer.appendChild(divider1);
            mainContainer.appendChild(col2);
            mainContainer.appendChild(divider2);
            mainContainer.appendChild(preservedElements.workflowColumn);

            this.setupColumnResize(divider1, col1, col2);
            this.setupColumnResize(divider2, col2, preservedElements.workflowColumn);

            state.applied = true;
            Logger.log('✓ Three column layout applied');
        },
        
        createDivider(panelGroupId, id, ariaControls, max, min, current) {
            const divider = document.createElement('div');
            divider.className = 'relative w-[2px] h-[98%] my-auto hover:bg-brand transition-all duration-300 ease-in-out mx-[1px] before:absolute before:top-0 before:left-[-3px] before:right-[-3px] before:bottom-0 before:content-[""] before:cursor-col-resize';
            divider.setAttribute('role', 'separator');
            divider.style.touchAction = 'none';
            divider.setAttribute('tabindex', '0');
            divider.setAttribute('data-panel-group-direction', 'horizontal');
            divider.setAttribute('data-panel-group-id', panelGroupId);
            divider.setAttribute('data-resize-handle', '');
            divider.setAttribute('data-panel-resize-handle-enabled', 'true');
            divider.setAttribute('data-panel-resize-handle-id', id);
            divider.setAttribute('data-resize-handle-state', 'inactive');
            divider.setAttribute('aria-controls', ariaControls);
            divider.setAttribute('aria-valuemax', max.toString());
            divider.setAttribute('aria-valuemin', min.toString());
            divider.setAttribute('aria-valuenow', current.toString());
            return divider;
        },
        
        reorganizeFirstColumnContent(wrapper, topSection) {
            const savedRatio = Storage.get(STORAGE_KEYS.sectionSplitRatio, 60);
            
            const existingSection = topSection.querySelector('div.p-3.border-b');
            if (!existingSection) {
                Logger.log('⚠ Existing section not found for reorganization');
                return;
            }

            topSection.removeChild(existingSection);

            const topPanel = document.createElement('div');
            topPanel.id = 'wf-top-panel';
            topPanel.className = 'flex flex-col overflow-hidden';
            topPanel.style.flex = `${savedRatio} 1 0%`;
            topPanel.style.minHeight = '100px';
            
            existingSection.className = 'p-3 border-b flex flex-col h-full';
            
            const textareaWrapper = existingSection.querySelector('div.space-y-2.relative');
            if (textareaWrapper) {
                textareaWrapper.className = 'space-y-2 relative flex-1 flex flex-col';
                
                const relativeDiv = textareaWrapper.querySelector('div.relative');
                if (relativeDiv) {
                    relativeDiv.className = 'relative flex-1 flex flex-col';
                    
                    const textareaContainer = relativeDiv.querySelector('div.flex.flex-col');
                    if (textareaContainer) {
                        textareaContainer.style.height = '100%';
                    }
                }
            }
            
            topPanel.appendChild(existingSection);

            const resizeHandle = document.createElement('div');
            resizeHandle.id = 'wf-section-resize-handle';
            resizeHandle.className = 'relative h-[2px] w-full hover:bg-brand transition-all duration-300 ease-in-out my-[1px]';
            resizeHandle.style.backgroundColor = 'var(--border)';
            resizeHandle.style.cursor = 'grab';
            resizeHandle.setAttribute('role', 'separator');
            resizeHandle.style.touchAction = 'none';
            
            const hitArea = document.createElement('div');
            hitArea.style.cssText = 'position: absolute; top: -6px; bottom: -6px; left: 0; right: 0; cursor: grab;';
            resizeHandle.appendChild(hitArea);

            const bottomPanel = document.createElement('div');
            bottomPanel.id = 'wf-bottom-panel';
            bottomPanel.className = 'p-3 border-b overflow-y-auto';
            bottomPanel.style.flex = `${100 - savedRatio} 1 0%`;
            bottomPanel.style.minHeight = '100px';

            this.createNotesSection(bottomPanel);

            wrapper.appendChild(topPanel);
            wrapper.appendChild(resizeHandle);
            wrapper.appendChild(bottomPanel);

            this.setupSectionResize(resizeHandle, topPanel, bottomPanel);
        },
        
        createNotesSection(container) {
            const savedNotes = Storage.get(STORAGE_KEYS.notes, '');
            Logger.log(`✓ Notes loaded from storage (${savedNotes.length} chars)`);

            container.className = 'p-3 border-b overflow-hidden flex flex-col';

            const escapedNotes = savedNotes
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

            container.innerHTML = `
                <div class="flex flex-col flex-1">
                    <div class="flex items-center justify-between h-5 mb-2">
                        <div class="text-sm text-muted-foreground font-medium">Notes</div>
                    </div>
                    <div class="relative flex-1 flex flex-col">
                        <div class="flex flex-col relative rounded-md overflow-hidden border border-input bg-background shadow-sm h-full">
                            <textarea id="wf-notes-textarea" class="flex-1 w-full border-0 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none" placeholder="Add your notes here. These are not submitted with your task. They are auto-saved and persist between page loads.">${escapedNotes}</textarea>
                        </div>
                    </div>
                </div>
            `;
        },
        
        setupSectionResize(handle, topPanel, bottomPanel) {
            let isResizing = false;
            let startY = 0;
            let startTopHeight = 0;
            let startBottomHeight = 0;
            let totalHeight = 0;

            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startY = e.clientY;
                
                const wrapper = handle.parentElement;
                totalHeight = wrapper.offsetHeight;
                startTopHeight = topPanel.offsetHeight;
                startBottomHeight = bottomPanel.offsetHeight;

                document.body.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';
                handle.style.cursor = 'grabbing';
                handle.style.backgroundColor = 'var(--brand)';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;

                const deltaY = e.clientY - startY;
                const newTopHeight = startTopHeight + deltaY;
                const newBottomHeight = startBottomHeight - deltaY;

                const topPercent = (newTopHeight / totalHeight) * 100;
                const bottomPercent = (newBottomHeight / totalHeight) * 100;

                if (topPercent >= 20 && topPercent <= 80) {
                    topPanel.style.flex = `${topPercent} 1 0%`;
                    bottomPanel.style.flex = `${bottomPercent} 1 0%`;
                }
            });

            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    handle.style.backgroundColor = 'var(--border)';

                    const topFlex = parseFloat(topPanel.style.flex) || 60;
                    Storage.set(STORAGE_KEYS.sectionSplitRatio, topFlex);
                }
            });

            handle.addEventListener('mouseenter', () => {
                if (!isResizing) handle.style.backgroundColor = 'var(--brand)';
            });

            handle.addEventListener('mouseleave', () => {
                if (!isResizing) handle.style.backgroundColor = 'var(--border)';
            });
        },
        
        setupColumnResize(divider, leftCol, rightCol) {
            let isResizing = false;
            let startX = 0;
            let startLeftWidth = 0;
            let startRightWidth = 0;
            let totalWidth = 0;

            divider.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                
                const parent = divider.parentElement;
                totalWidth = parent.offsetWidth;
                
                const leftFlex = parseFloat(leftCol.style.flex) || 25;
                const rightFlex = parseFloat(rightCol.style.flex) || 37.5;
                
                startLeftWidth = (leftFlex / 100) * totalWidth;
                startRightWidth = (rightFlex / 100) * totalWidth;

                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                divider.setAttribute('data-resize-handle-state', 'active');
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;

                const deltaX = e.clientX - startX;
                const newLeftWidth = startLeftWidth + deltaX;
                const newRightWidth = startRightWidth - deltaX;

                const leftPercent = (newLeftWidth / totalWidth) * 100;
                const rightPercent = (newRightWidth / totalWidth) * 100;

                const minLeft = parseFloat(divider.getAttribute('aria-valuemin')) || 15;
                const maxLeft = parseFloat(divider.getAttribute('aria-valuemax')) || 45;

                if (leftPercent >= minLeft && leftPercent <= maxLeft && rightPercent >= 20) {
                    leftCol.style.flex = `${leftPercent} 1 0px`;
                    leftCol.setAttribute('data-panel-size', leftPercent.toString());
                    
                    rightCol.style.flex = `${rightPercent} 1 0px`;
                    rightCol.setAttribute('data-panel-size', rightPercent.toString());
                    
                    divider.setAttribute('aria-valuenow', leftPercent.toString());
                }
            });

            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    divider.setAttribute('data-resize-handle-state', 'inactive');
                    this.saveColumnWidths();
                }
            });
        },
        
        saveColumnWidths() {
            const col1 = document.getElementById('wf-col-text');
            const col2 = document.getElementById('wf-col-tools');
            const col3 = document.querySelector(SELECTORS.workflowColumn);

            if (col1) Storage.set(STORAGE_KEYS.col1Width, parseFloat(col1.style.flex) || 25);
            if (col2) Storage.set(STORAGE_KEYS.col2Width, parseFloat(col2.style.flex) || 37.5);
            if (col3) Storage.set(STORAGE_KEYS.col3Width, parseFloat(col3.style.flex) || 37.5);
        }
    });

    // ---------- Notes Auto-Save Plugin ----------
    PluginManager.register({
        id: 'notesAutoSave',
        name: 'Notes Auto-Save',
        description: 'Auto-saves notes to persist between page loads',
        enabledByDefault: true,
        phase: 'mutation',
        initialState: { setup: false, saveTimeout: null },
        
        onMutation(state, context) {
            if (state.setup) return;

            const textarea = document.getElementById('wf-notes-textarea');
            if (!textarea) return;

            state.setup = true;
            Logger.log('✓ Notes auto-save configured');

            textarea.addEventListener('input', () => {
                if (state.saveTimeout) {
                    clearTimeout(state.saveTimeout);
                }
                
                state.saveTimeout = setTimeout(() => {
                    const currentValue = textarea.value;
                    Storage.set(STORAGE_KEYS.notes, currentValue);
                    Logger.log(`✓ Notes auto-saved (${currentValue.length} chars)`);
                }, 1000);
            });
        }
    });

    // ---------- Tool Favorites Plugin ----------
    PluginManager.register({
        id: 'toolFavorites',
        name: 'Tool Favorites',
        description: 'Adds star icons to mark tools as favorites',
        enabledByDefault: true,
        phase: 'mutation',
        initialState: { initialized: false, favorites: new Set(), lastCount: 0 },
        
        onMutation(state, context) {
            // Load favorites if not initialized
            if (!state.initialized) {
                const saved = Storage.get(STORAGE_KEYS.favoriteTools, '[]');
                try {
                    state.favorites = new Set(JSON.parse(saved));
                    state.initialized = true;
                    Logger.log(`✓ Loaded ${state.favorites.size} favorite tool(s)`);
                } catch (e) {
                    Logger.error('Error loading favorites:', e);
                    state.favorites = new Set();
                }
            }

            const toolsContainer = document.querySelector('#wf-col-tools > div > div > div');
            if (!toolsContainer) return;

            const toolButtons = toolsContainer.querySelectorAll('button.group\\/tool');
            
            let starsAdded = 0;
            toolButtons.forEach(button => {
                if (this.addFavoriteButton(button, state)) {
                    starsAdded++;
                }
            });
            
            if (starsAdded > 0 && starsAdded !== state.lastCount) {
                Logger.log(`✓ Added favorite stars to ${starsAdded} tool(s)`);
                state.lastCount = starsAdded;
            }
        },
        
        addFavoriteButton(toolButton, state) {
            if (toolButton.querySelector('.wf-favorite-star')) return false;

            const nameElement = toolButton.querySelector('div.flex.flex-col.items-start span.text-xs.font-medium.text-foreground span span');
            const toolName = nameElement ? nameElement.textContent.trim() : null;
            if (!toolName) return false;

            const nameContainer = toolButton.querySelector('div.flex.flex-col.items-start span.text-xs.font-medium.text-foreground');
            if (!nameContainer) return false;

            const starContainer = document.createElement('span');
            starContainer.className = 'wf-favorite-star inline-flex items-center mr-1 cursor-pointer hover:opacity-70 transition-opacity';
            starContainer.style.cssText = 'display: inline-flex; align-items: center; margin-right: 4px;';
            
            const isFavorite = state.favorites.has(toolName);
            starContainer.appendChild(this.createStarSVG(isFavorite));
            
            starContainer.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                if (state.favorites.has(toolName)) {
                    state.favorites.delete(toolName);
                } else {
                    state.favorites.add(toolName);
                }
                Storage.set(STORAGE_KEYS.favoriteTools, JSON.stringify([...state.favorites]));
                
                starContainer.innerHTML = '';
                starContainer.appendChild(this.createStarSVG(state.favorites.has(toolName)));
            });
            
            const toolNameSpan = nameContainer.querySelector('span');
            if (toolNameSpan) {
                const wrapper = document.createElement('span');
                wrapper.style.cssText = 'display: inline-flex; align-items: center;';
                
                const nameText = toolNameSpan.cloneNode(true);
                wrapper.appendChild(starContainer);
                wrapper.appendChild(nameText);
                
                nameContainer.replaceChild(wrapper, toolNameSpan);
            }
            
            return true;
        },
        
        createStarSVG(filled) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '14');
            svg.setAttribute('height', '14');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', filled ? '#FFD700' : 'none');
            svg.setAttribute('stroke', filled ? '#FFD700' : 'currentColor');
            svg.setAttribute('stroke-width', '1');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            svg.style.cssText = 'display: inline-block; vertical-align: middle;';
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z');
            
            svg.appendChild(path);
            return svg;
        }
    });

    // ---------- Settings Modal Plugin ----------
    PluginManager.register({
        id: 'settingsModal',
        name: 'Settings Modal',
        description: 'Adds a settings button and modal to configure features',
        enabledByDefault: true,
        phase: 'mutation',
        initialState: { added: false, modalOpen: false },
        
        onMutation(state, context) {
            if (document.getElementById('wf-settings-btn')) {
                state.added = true;
                return;
            }
            
            const bugReportBtn = document.querySelector(SELECTORS.bugReportBtn);
            if (!bugReportBtn) return;
            
            const settingsBtn = document.createElement('button');
            settingsBtn.id = 'wf-settings-btn';
            settingsBtn.className = bugReportBtn.className;
            settingsBtn.style.cssText = bugReportBtn.style.cssText || '';
            settingsBtn.style.bottom = '136px';
            
            settingsBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="stroke-current size-5">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M12 1v6m0 6v6m4.22-13.22l4.24 4.24M1.54 1.54l4.24 4.24M20.46 20.46l-4.24-4.24M1.54 20.46l4.24-4.24M21 12h-6m-6 0H3"></path>
                </svg>
                <span class="sr-only">WF Enhancer Settings</span>
            `;
            
            let modal = document.getElementById('wf-settings-modal');
            if (!modal) {
                modal = this.createSettingsModal(state);
            }
            
            settingsBtn.addEventListener('click', () => {
                state.modalOpen = !state.modalOpen;
                modal.style.display = state.modalOpen ? 'block' : 'none';
            });
            
            bugReportBtn.parentNode.insertBefore(settingsBtn, bugReportBtn);
            state.added = true;
            Logger.log('✓ Settings button added');
        },
        
        createSettingsModal(state) {
            const existingModal = document.getElementById('wf-settings-modal');
            if (existingModal) existingModal.remove();
            
            const modal = document.createElement('div');
            modal.id = 'wf-settings-modal';
            modal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--background);
                border: 1px solid var(--border);
                border-radius: 12px;
                padding: 24px;
                width: 450px;
                max-height: 80vh;
                overflow-y: auto;
                z-index: 10000;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                display: none;
            `;
            
            // Get all plugins except settingsModal itself
            const plugins = PluginManager.getAll().filter(p => p.id !== 'settingsModal');
            
            const pluginToggles = plugins.map(plugin => {
                const isEnabled = PluginManager.isEnabled(plugin.id);
                return `
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border);">
                        <div style="flex: 1; margin-right: 12px;">
                            <div style="font-size: 14px; font-weight: 500;">${plugin.name}</div>
                            <div style="font-size: 12px; color: var(--muted-foreground); margin-top: 2px;">${plugin.description}</div>
                        </div>
                        <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;">
                            <input type="checkbox" data-plugin-id="${plugin.id}" ${isEnabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                            <span class="toggle-track" style="
                                position: absolute;
                                cursor: pointer;
                                top: 0; left: 0; right: 0; bottom: 0;
                                background-color: ${isEnabled ? 'var(--brand, #4f46e5)' : '#ccc'};
                                transition: 0.3s;
                                border-radius: 24px;
                            ">
                                <span class="toggle-thumb" style="
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
                `;
            }).join('');
            
            const debugEnabled = Logger.isDebugEnabled();
            
            modal.innerHTML = `
                <div class="space-y-4">
                    <div class="flex items-center justify-between mb-4">
                        <h2 style="font-size: 18px; font-weight: 600;">WF Enhancer Settings</h2>
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
                        ">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    
                    <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 2px solid var(--border);">
                        <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--muted-foreground); margin-bottom: 8px;">General</div>
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 0;">
                            <div style="flex: 1; margin-right: 12px;">
                                <div style="font-size: 14px; font-weight: 500;">Debug Logging</div>
                                <div style="font-size: 12px; color: var(--muted-foreground); margin-top: 2px;">Enable console logging for debugging</div>
                            </div>
                            <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;">
                                <input type="checkbox" id="wf-setting-debug" ${debugEnabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                                <span class="toggle-track" style="
                                    position: absolute;
                                    cursor: pointer;
                                    top: 0; left: 0; right: 0; bottom: 0;
                                    background-color: ${debugEnabled ? 'var(--brand, #4f46e5)' : '#ccc'};
                                    transition: 0.3s;
                                    border-radius: 24px;
                                ">
                                    <span class="toggle-thumb" style="
                                        position: absolute;
                                        content: '';
                                        height: 18px;
                                        width: 18px;
                                        left: ${debugEnabled ? '23px' : '3px'};
                                        bottom: 3px;
                                        background-color: white;
                                        transition: 0.3s;
                                        border-radius: 50%;
                                    "></span>
                                </span>
                            </label>
                        </div>
                    </div>
                    
                    <div>
                        <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--muted-foreground); margin-bottom: 8px;">Features</div>
                        ${pluginToggles}
                    </div>
                    
                    <div id="wf-settings-message" style="
                        display: none;
                        padding: 12px;
                        background: var(--accent);
                        border-radius: 6px;
                        font-size: 13px;
                        text-align: center;
                        margin-top: 16px;
                    ">
                        Settings changed. Please refresh the page for changes to take effect.
                    </div>
                    
                    <div style="font-size: 11px; color: var(--muted-foreground); text-align: center; margin-top: 16px;">
                        WF Enhancer v${VERSION}
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Debug toggle handler
            const debugCheckbox = modal.querySelector('#wf-setting-debug');
            if (debugCheckbox) {
                debugCheckbox.addEventListener('change', (e) => {
                    const track = e.target.nextElementSibling;
                    const thumb = track.querySelector('.toggle-thumb');
                    
                    if (e.target.checked) {
                        track.style.backgroundColor = 'var(--brand, #4f46e5)';
                        thumb.style.left = '23px';
                    } else {
                        track.style.backgroundColor = '#ccc';
                        thumb.style.left = '3px';
                    }
                    
                    Logger.setDebugEnabled(e.target.checked);
                });
            }
            
            // Plugin toggle handlers
            modal.querySelectorAll('input[data-plugin-id]').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const pluginId = e.target.getAttribute('data-plugin-id');
                    const track = e.target.nextElementSibling;
                    const thumb = track.querySelector('.toggle-thumb');
                    
                    if (e.target.checked) {
                        track.style.backgroundColor = 'var(--brand, #4f46e5)';
                        thumb.style.left = '23px';
                    } else {
                        track.style.backgroundColor = '#ccc';
                        thumb.style.left = '3px';
                    }
                    
                    PluginManager.setEnabled(pluginId, e.target.checked);
                    document.getElementById('wf-settings-message').style.display = 'block';
                });
            });
            
            // Close button
            modal.querySelector('#wf-settings-close').addEventListener('click', () => {
                modal.style.display = 'none';
                state.modalOpen = false;
            });
            
            // Click outside to close
            document.addEventListener('click', (e) => {
                if (state.modalOpen && !modal.contains(e.target) && !e.target.closest('#wf-settings-btn')) {
                    modal.style.display = 'none';
                    state.modalOpen = false;
                }
            });
            
            // Hover effects for close button
            const closeBtn = modal.querySelector('#wf-settings-close');
            closeBtn.addEventListener('mouseover', () => closeBtn.style.background = 'var(--accent)');
            closeBtn.addEventListener('mouseout', () => closeBtn.style.background = 'transparent');
            
            return modal;
        }
    });

    // ============= MUTATION OBSERVER =============
    function initObserver() {
        const observer = new MutationObserver(() => {
            PluginManager.runMutationPlugins();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        Logger.log('✓ Mutation observer initialized');
    }

    // ============= INITIALIZATION =============
    function init() {
        if (Context.initialized) {
            Logger.log('⚠ Initialization already complete, skipping duplicate call');
            return;
        }
        Context.initialized = true;

        console.log('[Fleet Enhancer] Version: ' + VERSION);
        console.log('[Fleet Enhancer] GitHub: https://github.com/adastra1826/fleet-ux-improvements');
        console.log('[Fleet Enhancer] If you have any issues, please report them to the GitHub repository. :)');

        // Run init-phase plugins
        PluginManager.runInitPlugins();
        
        // Start mutation observer
        initObserver();
        
        // Run mutation plugins once immediately
        PluginManager.runMutationPlugins();

        console.log('[Fleet Enhancer] ✓ Initialization complete');
    }

    function waitForPageReady() {
        const checkInterval = setInterval(() => {
            if (document.readyState === 'complete' || 
                (document.readyState === 'interactive' && document.body)) {
                clearInterval(checkInterval);
                init();
            }
        }, 50);
        
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!Context.initialized) {
                Logger.log('⚠ Page ready timeout reached, initializing anyway');
                init();
            }
        }, 10000);
    }

    // ============= START =============
    // Run early plugins immediately (network interception)
    PluginManager.runEarlyPlugins();
    
    // Wait for DOM then initialize
    waitForPageReady();

})();
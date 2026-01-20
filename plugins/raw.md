// ============= network-interception.js =============
const plugin = {
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
                    Logger.log('✓ Source URL captured (fetch)');
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
                    Logger.log('✓ Source URL captured (XHR)');
                }
            }
            return originalXHRSend.apply(this, [body]);
        };

        // Expose getter globally for debugging
        pageWindow.getFleetSource = () => context.source;
        
        Logger.log('✓ Network interception installed');
    }
};

// ============= autocorrect-search.js =============
const plugin = {
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
};

// ============= autocorrect-textareas.js =============
const plugin = {
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
};

// ============= favorites.js =============
const plugin = {
    id: 'favorites',
    name: 'Tool Favorites',
    description: 'Add favorite button to tools and sort favorites to top',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { initialized: false },
    
    init(state, context) {
        // Add styles for favorites
        const style = document.createElement('style');
        style.textContent = `
            .favorite-star {
                cursor: pointer;
                margin-left: auto;
                transition: all 0.2s;
                font-size: 18px;
                opacity: 0.7;
            }
            .favorite-star:hover {
                opacity: 1;
                transform: scale(1.2);
            }
            .favorite-star.favorited {
                color: gold;
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    },
    
    onMutation(state, context) {
        const toolsContainer = document.querySelector(SELECTORS.toolsContainer);
        if (!toolsContainer) return;
        
        const favoriteTools = new Set(Storage.get(STORAGE_KEYS.favoriteTools, []));
        
        // Add favorite buttons to all tools
        const toolHeaders = toolsContainer.querySelectorAll(SELECTORS.toolHeader);
        toolHeaders.forEach(header => {
            if (header.querySelector('.favorite-star')) return; // Already has star
            
            const toolName = header.querySelector('span')?.textContent;
            if (!toolName) return;
            
            const star = document.createElement('span');
            star.className = 'favorite-star';
            star.innerHTML = favoriteTools.has(toolName) ? '⭐' : '☆';
            if (favoriteTools.has(toolName)) {
                star.classList.add('favorited');
            }
            
            star.onclick = (e) => {
                e.stopPropagation();
                if (favoriteTools.has(toolName)) {
                    favoriteTools.delete(toolName);
                    star.innerHTML = '☆';
                    star.classList.remove('favorited');
                } else {
                    favoriteTools.add(toolName);
                    star.innerHTML = '⭐';
                    star.classList.add('favorited');
                }
                Storage.set(STORAGE_KEYS.favoriteTools, Array.from(favoriteTools));
                
                // Re-sort tools
                sortTools();
            };
            
            header.appendChild(star);
        });
        
        // Sort tools function
        function sortTools() {
            const tools = Array.from(toolsContainer.children);
            tools.sort((a, b) => {
                const aName = a.querySelector('span')?.textContent;
                const bName = b.querySelector('span')?.textContent;
                const aFavorited = favoriteTools.has(aName);
                const bFavorited = favoriteTools.has(bName);
                
                if (aFavorited && !bFavorited) return -1;
                if (!aFavorited && bFavorited) return 1;
                return 0;
            });
            
            tools.forEach(tool => toolsContainer.appendChild(tool));
        }
        
        // Initial sort
        if (!state.initialized) {
            sortTools();
            state.initialized = true;
        }
    }
};
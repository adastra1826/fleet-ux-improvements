// ============= favorites.js =============
// Plugin with its own selectors - completely self-contained

const plugin = {
    id: 'favorites',
    name: 'Tool Favorites',
    description: 'Add favorite button to tools and sort favorites to top',
    _version: '1.0',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { initialized: false },
    
    // Plugin-specific selectors
    selectors: {
        toolsContainer: '#\\:rb\\: > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3',
        toolHeader: 'div.flex.items-center.gap-3.p-3.cursor-pointer.hover\\:bg-muted\\/30',
        toolName: 'span'
    },
    
    // Plugin-specific storage keys
    storageKeys: {
        favoriteTools: 'favorite-tools'
    },
    
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
        Logger.log('✓ Favorites styles injected');
    },
    
    onMutation(state, context) {
        const toolsContainer = document.querySelector(this.selectors.toolsContainer);
        if (!toolsContainer) return;
        
        const favoriteTools = new Set(Storage.get(this.storageKeys.favoriteTools, []));
        
        // Add favorite buttons to all tools
        const toolHeaders = toolsContainer.querySelectorAll(this.selectors.toolHeader);
        toolHeaders.forEach(header => {
            if (header.querySelector('.favorite-star')) return; // Already has star
            
            const toolName = header.querySelector(this.selectors.toolName)?.textContent;
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
                Storage.set(this.storageKeys.favoriteTools, Array.from(favoriteTools));
                
                // Re-sort tools
                this.sortTools(toolsContainer, favoriteTools);
            };
            
            header.appendChild(star);
        });
        
        // Initial sort
        if (!state.initialized) {
            this.sortTools(toolsContainer, favoriteTools);
            state.initialized = true;
        }
    },
    
    sortTools(container, favoriteTools) {
        const tools = Array.from(container.children);
        tools.sort((a, b) => {
            const aName = a.querySelector(this.selectors.toolName)?.textContent;
            const bName = b.querySelector(this.selectors.toolName)?.textContent;
            const aFavorited = favoriteTools.has(aName);
            const bFavorited = favoriteTools.has(bName);
            
            if (aFavorited && !bFavorited) return -1;
            if (!aFavorited && bFavorited) return 1;
            return 0;
        });
        
        tools.forEach(tool => container.appendChild(tool));
        Logger.debug('Tools sorted by favorites');
    }
};
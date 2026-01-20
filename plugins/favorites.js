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
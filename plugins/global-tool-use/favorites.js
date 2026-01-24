// ============= favorites.js =============
// Plugin with its own selectors - completely self-contained

const plugin = {
    id: 'favorites',
    name: 'Tool Favorites',
    description: 'Add favorite button to tools and sort favorites to top',
    _version: '2.0',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { initialized: false, missingLogged: false },
    
    // Plugin-specific selectors
    selectors: {
        workflowToolsArea: '[id="\:re\:"] > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3',
        workflowToolName: 'div > div > div > div.flex.items-center.gap-3.p-3.cursor-pointer.hover\:bg-muted\/30 > div.flex-1.min-w-0',
        toolsContainer: '[id="\:r7\:"] > div.flex-1.min-h-0.overflow-hidden > div > div > div.flex-1.overflow-y-auto > div',
        toolHeader: 'button > span.min-w-0.flex-1.overflow-hidden.flex.gap-2.items-start',
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
            .favorite-star.inline {
                margin-left: 0;
                margin-right: 6px;
                font-size: 14px;
                display: inline-flex;
                align-items: center;
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
        const toolsContainer = Context.dom.query(this.selectors.toolsContainer, {
            context: `${this.id}.toolsContainer`
        });
        if (!toolsContainer) {
            if (!state.missingLogged) {
                Logger.debug('Tools container not found for favorites');
                state.missingLogged = true;
            }
            return;
        }
        
        const favoriteTools = new Set(Storage.get(this.storageKeys.favoriteTools, []));
        
        // Add favorite buttons to all tools
        const toolHeaders = Context.dom.queryAll(this.selectors.toolHeader, {
            root: toolsContainer,
            context: `${this.id}.toolHeaders`
        });
        toolHeaders.forEach(header => {
            if (Context.dom.query('.favorite-star', {
                root: header,
                context: `${this.id}.favoriteStar`
            })) return; // Already has star
            
            const toolName = this.getToolNameFromHeader(header);
            if (!toolName) return;
            
            const star = this.createStarElement(toolName, favoriteTools);
            
            star.onclick = (e) => {
                e.stopPropagation();
                this.toggleFavorite(toolName, favoriteTools, toolsContainer);
            };
            
            header.appendChild(star);
        });

        this.syncWorkflowStars(favoriteTools);
        
        // Initial sort
        if (!state.initialized) {
            this.sortTools(toolsContainer, favoriteTools);
            state.initialized = true;
        }
    },
    
    sortTools(container, favoriteTools) {
        const tools = Array.from(container.children);
        tools.sort((a, b) => {
            const aName = this.getToolNameFromHeader(a);
            const bName = this.getToolNameFromHeader(b);
            const aFavorited = favoriteTools.has(aName);
            const bFavorited = favoriteTools.has(bName);
            
            if (aFavorited && !bFavorited) return -1;
            if (!aFavorited && bFavorited) return 1;
            return 0;
        });
        
        tools.forEach(tool => container.appendChild(tool));
        Logger.debug('Tools sorted by favorites');
    },

    getToolNameFromHeader(header) {
        const nameSpan = Context.dom.query('span:not(.favorite-star)', {
            root: header,
            context: `${this.id}.toolName`
        });
        return nameSpan?.textContent?.trim() || null;
    },

    createStarElement(toolName, favoriteTools, { inline = false } = {}) {
        const star = document.createElement('span');
        star.className = inline ? 'favorite-star inline' : 'favorite-star';
        star.innerHTML = favoriteTools.has(toolName) ? '⭐' : '☆';
        if (favoriteTools.has(toolName)) {
            star.classList.add('favorited');
        }
        return star;
    },

    toggleFavorite(toolName, favoriteTools, toolsContainer) {
        if (favoriteTools.has(toolName)) {
            favoriteTools.delete(toolName);
            Logger.log(`Removed favorite: ${toolName}`);
        } else {
            favoriteTools.add(toolName);
            Logger.log(`Added favorite: ${toolName}`);
        }
        Storage.set(this.storageKeys.favoriteTools, Array.from(favoriteTools));
        this.sortTools(toolsContainer, favoriteTools);
        this.syncWorkflowStars(favoriteTools);
        this.syncToolListStars(toolsContainer, favoriteTools);
    },

    syncToolListStars(toolsContainer, favoriteTools) {
        const toolHeaders = Context.dom.queryAll(this.selectors.toolHeader, {
            root: toolsContainer,
            context: `${this.id}.toolHeaders`
        });
        toolHeaders.forEach(header => {
            const toolName = this.getToolNameFromHeader(header);
            const star = header.querySelector('.favorite-star');
            if (!toolName || !star) return;
            const isFavorite = favoriteTools.has(toolName);
            star.innerHTML = isFavorite ? '⭐' : '☆';
            star.classList.toggle('favorited', isFavorite);
        });
    },

    syncWorkflowStars(favoriteTools) {
        const workflowToolsArea = Context.dom.query(this.selectors.workflowToolsArea, {
            context: `${this.id}.workflowToolsArea`
        });
        if (!workflowToolsArea) return;

        const workflowToolNames = Context.dom.queryAll(this.selectors.workflowToolName, {
            root: workflowToolsArea,
            context: `${this.id}.workflowToolName`
        });

        workflowToolNames.forEach(nameContainer => {
            const toolName = nameContainer.querySelector('span')?.textContent?.trim();
            if (!toolName) return;

            const parentRow = nameContainer.parentElement;
            if (!parentRow) return;

            let starWrapper = parentRow.querySelector('.favorite-star.inline');
            if (!starWrapper) {
                starWrapper = this.createStarElement(toolName, favoriteTools, { inline: true });
                starWrapper.classList.add('workflow');
                parentRow.insertBefore(starWrapper, nameContainer);
            }

            const isFavorite = favoriteTools.has(toolName);
            starWrapper.innerHTML = isFavorite ? '⭐' : '☆';
            starWrapper.classList.toggle('favorited', isFavorite);
        });
    }
};
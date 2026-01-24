// ============= favorites.js =============
// Plugin with its own selectors - completely self-contained

const plugin = {
    id: 'favorites',
    name: 'Tool Favorites',
    description: 'Add favorite stars to tools and workflow list',
    _version: '2.2',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { missingLogged: false },
    
    // Plugin-specific selectors
    selectors: {
        workflowToolsArea: '[id="\:re\:"] > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3',
        workflowToolHeader: 'div.flex.items-center.gap-3.p-3.cursor-pointer.hover\\:bg-muted\\/30',
        workflowToolName: 'div.flex-1.min-w-0',
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
                margin-right: 6px;
                transition: all 0.2s;
                font-size: 18px;
                opacity: 0.7;
            }
            .favorite-star.inline {
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

            const nameSpan = Context.dom.query('span:not(.favorite-star)', {
                root: header,
                context: `${this.id}.toolNameSpan`
            });
            if (nameSpan?.parentElement) {
                nameSpan.parentElement.insertBefore(star, nameSpan);
            } else {
                header.appendChild(star);
            }
        });

        this.syncWorkflowStars(favoriteTools);
    },

    getToolNameFromHeader(header) {
        const nameSpan = Context.dom.query('span:not(.favorite-star)', {
            root: header,
            context: `${this.id}.toolName`
        });
        return nameSpan?.textContent?.trim() || null;
    },

    createStarElement(toolName, favoriteTools, { inline = false, tagName = 'span' } = {}) {
        const star = document.createElement(tagName);
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

        const workflowToolHeaders = Context.dom.queryAll(this.selectors.workflowToolHeader, {
            root: workflowToolsArea,
            context: `${this.id}.workflowToolHeader`
        });

        workflowToolHeaders.forEach(header => {
            const nameContainer = Context.dom.query(this.selectors.workflowToolName, {
                root: header,
                context: `${this.id}.workflowToolName`
            });
            if (!nameContainer) return;

            const toolName = nameContainer.querySelector('span')?.textContent?.trim();
            if (!toolName) return;

            const isFavorite = favoriteTools.has(toolName);
            let starWrapper = header.querySelector('.favorite-star.inline.workflow');

            if (!isFavorite) {
                if (starWrapper) {
                    starWrapper.remove();
                }
                return;
            }

            if (!starWrapper) {
                starWrapper = this.createStarElement(toolName, favoriteTools, { inline: true, tagName: 'div' });
                starWrapper.classList.add('workflow');
                header.insertBefore(starWrapper, nameContainer);
            }

            starWrapper.innerHTML = '⭐';
            starWrapper.classList.add('favorited');
        });
    }
};
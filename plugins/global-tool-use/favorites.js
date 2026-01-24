// ============= favorites.js =============
// Plugin with its own selectors - completely self-contained

const plugin = {
    id: 'favorites',
    name: 'Tool Favorites',
    description: 'Add favorite stars to tools and workflow list',
    _version: '2.4',
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
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
                opacity: 0.7;
            }
            .favorite-star.inline {
                margin-right: 6px;
                width: 14px;
                height: 14px;
                display: inline-flex;
                align-items: center;
            }
            .favorite-star svg {
                width: 100%;
                height: 100%;
                display: block;
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
        this.updateStarElement(star, favoriteTools.has(toolName));
        return star;
    },

    createStarSvg(isFavorite) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.classList.add('favorite-star-icon');
        svg.setAttribute('fill', isFavorite ? '#FFD700' : 'none');
        svg.setAttribute('stroke', isFavorite ? '#FFD700' : 'currentColor');
        svg.setAttribute('stroke-width', '1.5');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z');
        svg.appendChild(path);
        return svg;
    },

    updateStarElement(starEl, isFavorite) {
        starEl.innerHTML = '';
        starEl.appendChild(this.createStarSvg(isFavorite));
        starEl.classList.toggle('favorited', isFavorite);
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
            this.updateStarElement(star, isFavorite);
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

            this.updateStarElement(starWrapper, true);
        });
    }
};
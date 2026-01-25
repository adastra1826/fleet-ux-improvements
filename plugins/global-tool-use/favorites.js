// ============= favorites.js =============
// Plugin with its own selectors - completely self-contained

const plugin = {
    id: 'favorites',
    name: 'Tool Favorites',
    description: 'Add favorite stars to tools list',
    _version: '3.4',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { missingLogged: false },
    
    // Plugin-specific selectors
    selectors: {
        toolsContainer: '[id^="\:r"] > div.flex-1.min-h-0.overflow-hidden > div > div > div.flex-1.overflow-y-auto > div',
        toolsContainerFallback: '[id="wf-col-tools"] > div > div > div > div.flex-1.overflow-y-auto > div',
        toolHeader: 'button > span.min-w-0.flex-1.overflow-hidden.flex.gap-2.items-start',
        toolName: 'span',
        toolTitleSpan: 'div.flex.flex-col.items-start.gap-0\\.5.text-left.min-w-0.flex-1 > span.text-xs.font-medium.text-foreground'
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
                width: 14px;
                height: 14px;
                min-width: 14px;
                min-height: 14px;
                max-width: 14px;
                max-height: 14px;
                flex: 0 0 14px;
                opacity: 0.7;
            }
            .favorite-star.inline {
                margin-right: 6px;
                width: 14px;
                height: 14px;
                min-width: 14px;
                min-height: 14px;
                max-width: 14px;
                max-height: 14px;
                flex: 0 0 14px;
                display: inline-flex;
                align-items: center;
            }
            .favorite-star svg {
                width: 14px;
                height: 14px;
                min-width: 14px;
                min-height: 14px;
                max-width: 14px;
                max-height: 14px;
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
        }) || Context.dom.query(this.selectors.toolsContainerFallback, {
            context: `${this.id}.toolsContainerFallback`
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

            // First try to insert before the inner span in the title span
            const titleSpan = Context.dom.query(this.selectors.toolTitleSpan, {
                root: header,
                context: `${this.id}.toolTitleSpan`
            });
            
            if (titleSpan) {
                const innerSpan = this.getToolNameSpanFromTitle(titleSpan);
                if (innerSpan) {
                    star.style.marginRight = '6px';
                    titleSpan.insertBefore(star, innerSpan);
                    titleSpan.style.display = 'inline-flex';
                    titleSpan.style.alignItems = 'center';
                    titleSpan.style.gap = '6px';
                    return;
                }
            }
            
            // Fall back to old method if new location not found
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

    },

    getToolNameFromHeader(header) {
        const titleSpan = Context.dom.query(this.selectors.toolTitleSpan, {
            root: header,
            context: `${this.id}.toolTitleSpan`
        });
        if (titleSpan) {
            const nameSpan = this.getToolNameSpanFromTitle(titleSpan);
            const text = nameSpan?.textContent?.trim();
            if (text) return text;
        }

        const fallbackSpan = Context.dom.query('span:not(.favorite-star)', {
            root: header,
            context: `${this.id}.toolName`
        });
        return fallbackSpan?.textContent?.trim() || null;
    },

    getToolNameSpanFromTitle(titleSpan) {
        return titleSpan.querySelector('span span:nth-child(2) span')
            || titleSpan.querySelector('span span span')
            || titleSpan.querySelector('span span')
            || titleSpan.querySelector('span');
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
        svg.setAttribute('width', '14');
        svg.setAttribute('height', '14');
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
    }
};
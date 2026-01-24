// ============= duplicate-to-end.js =============
const plugin = {
    id: 'duplicateToEnd',
    name: 'Duplicate to End',
    description: 'Adds button to duplicate a tool and move it to the end of the workflow',
    _version: '1.2',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { missingLogged: false },
    
    // Plugin-specific selectors
    selectors: {
        workflowToolsArea: '#\\:rb\\: > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3',
        toolHeader: 'div.flex.items-center.gap-3.p-3.cursor-pointer.hover\\:bg-muted\\/30'
    },
    
    onMutation(state, context) {
        const toolsContainer = Context.dom.query(this.selectors.workflowToolsArea, {
            context: `${this.id}.workflowToolsArea`
        });
        if (!toolsContainer) {
            if (!state.missingLogged) {
                Logger.debug('Tools container not found for duplicate-to-end');
                state.missingLogged = true;
            }
            return;
        }
        
        const toolCards = Context.dom.queryAll('div.rounded-lg.border.transition-colors', {
            root: toolsContainer,
            context: `${this.id}.toolCards`
        });
        let buttonsAdded = 0;
        
        toolCards.forEach(card => {
            const header = Context.dom.query(this.selectors.toolHeader, {
                root: card,
                context: `${this.id}.toolHeader`
            });
            if (!header) return;
            
            const buttonContainer = Context.dom.query('div.flex.items-center.gap-1', {
                root: header,
                context: `${this.id}.buttonContainer`
            });
            if (!buttonContainer) return;
            
            if (Context.dom.query('.wf-duplicate-to-end-btn', {
                root: buttonContainer,
                context: `${this.id}.dupToEndBtn`
            })) return;
            
            const buttons = Context.dom.queryAll('button', {
                root: buttonContainer,
                context: `${this.id}.buttons`
            });
            let duplicateBtn = null;
            
            buttons.forEach(btn => {
                const svg = Context.dom.query('svg', {
                    root: btn,
                    context: `${this.id}.buttonSvg`
                });
                if (svg) {
                    const hasLine15 = Context.dom.query('line[x1="15"][y1="12"][y2="18"]', {
                        root: svg,
                        context: `${this.id}.duplicateIconLine`
                    });
                    const hasRect = Context.dom.query('rect[width="14"][height="14"]', {
                        root: svg,
                        context: `${this.id}.duplicateIconRect`
                    });
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
                
                const currentButtons = Context.dom.queryAll('button', {
                    root: buttonContainer,
                    context: `${this.id}.buttons`
                });
                let currentDuplicateBtn = null;
                
                currentButtons.forEach(btn => {
                    const svg = Context.dom.query('svg', {
                        root: btn,
                        context: `${this.id}.buttonSvg`
                    });
                    if (svg) {
                        const hasLine15 = Context.dom.query('line[x1="15"][y1="12"][y2="18"]', {
                            root: svg,
                            context: `${this.id}.duplicateIconLine`
                        });
                        const hasRect = Context.dom.query('rect[width="14"][height="14"]', {
                            root: svg,
                            context: `${this.id}.duplicateIconRect`
                        });
                        if (hasLine15 && hasRect) {
                            currentDuplicateBtn = btn;
                        }
                    }
                });
                
                if (currentDuplicateBtn) {
                    Logger.log('Duplicate-to-end action triggered');
                    this.duplicateToolToEnd(card, currentDuplicateBtn);
                } else {
                    Logger.warn('Duplicate button not found when attempting duplicate-to-end');
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
        const toolsContainer = Context.dom.query(this.selectors.workflowToolsArea, {
            context: `${this.id}.workflowToolsArea`
        });
        if (!toolsContainer) {
            Logger.warn('Tools container missing during duplicate-to-end');
            return;
        }
        
        const toolCardsBefore = Context.dom.queryAll('div.rounded-lg.border.transition-colors', {
            root: toolsContainer,
            context: `${this.id}.toolCards`
        });
        const countBefore = toolCardsBefore.length;
        const toolCardsArray = Array.from(toolCardsBefore);
        const resolvedCard = Context.dom.closest(card, 'div.rounded-lg.border.transition-colors', {
            context: `${this.id}.toolCard`
        }) || card;
        const currentIndex = toolCardsArray.indexOf(resolvedCard);
        if (currentIndex === -1) {
            Logger.warn('Unable to resolve current tool index for duplicate-to-end');
            return;
        }
        
        duplicateBtn.click();
        
        const dupeObserver = new MutationObserver((mutations, obs) => {
            const toolCardsAfter = Context.dom.queryAll('div.rounded-lg.border.transition-colors', {
                root: toolsContainer,
                context: `${this.id}.toolCards`
            });
            
            if (toolCardsAfter.length > countBefore) {
                obs.disconnect();
                
                const duplicatedToolIndex = currentIndex + 1;
                const duplicatedTool = toolCardsAfter[duplicatedToolIndex];
                
                if (!duplicatedTool) {
                    Logger.warn('Duplicated tool not found after duplication');
                    return;
                }
                if (duplicatedToolIndex === toolCardsAfter.length - 1) {
                    Logger.debug('Duplicated tool already at end');
                    return;
                }
                
                const movesNeeded = (toolCardsAfter.length - 1) - duplicatedToolIndex;
                this.moveToolToEndViaKeyboard(duplicatedTool, movesNeeded);
            }
        });
        
        dupeObserver.observe(toolsContainer, { childList: true, subtree: true });
        setTimeout(() => dupeObserver.disconnect(), 3000);
    },
    
    moveToolToEndViaKeyboard(toolCard, movesNeeded) {
        const dragHandle = Context.dom.query('div[role="button"][aria-roledescription="sortable"]', {
            root: toolCard,
            context: `${this.id}.dragHandle`
        });
        if (!dragHandle) {
            Logger.warn('Drag handle missing while moving tool to end');
            return;
        }
        
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
        const allDupToEndBtns = Context.dom.queryAll('.wf-duplicate-to-end-btn', {
            context: `${this.id}.dupToEndButtons`
        });
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
};

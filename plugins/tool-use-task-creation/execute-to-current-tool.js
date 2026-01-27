// ============= execute-to-current-tool.js =============
const plugin = {
    id: 'executeToCurrentTool',
    name: 'Execute to Current Tool',
    description: 'Adds button to execute all tools from the beginning up to and including the current tool',
    _version: '1.0',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { missingLogged: false, panelId: null },
    
    // Plugin-specific selectors
    selectors: {
        toolHeader: 'div.flex.items-center.gap-3.p-3.cursor-pointer.hover\\:bg-muted\\/30'
    },
    
    onMutation(state, context) {
        // Find workflow panel by ID (data-panel-id attribute), then semantic search
        const panel = this.findWorkflowPanel();
        if (!panel) {
            if (!state.missingLogged) {
                Logger.log('⚠ Workflow panel not found for execute-to-current-tool');
                state.missingLogged = true;
            }
            return;
        }
        
        // Track panel ID to avoid re-processing
        const currentPanelId = panel.getAttribute('data-panel-id');
        if (state.panelId === currentPanelId && !state.missingLogged) {
            // Already processed this panel, but continue to check for new tools
        } else {
            state.panelId = currentPanelId;
            state.missingLogged = false;
        }
        
        const toolsContainer = this.findToolsArea(panel);
        if (!toolsContainer) {
            if (!state.missingLogged) {
                Logger.log('⚠ Tools container not found for execute-to-current-tool');
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
            const collapsibleRoot = Context.dom.query('div[data-state]', {
                root: card,
                context: `${this.id}.collapsibleRoot`
            });
            if (!collapsibleRoot) return;

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

            let execToCurrentBtn = Context.dom.query('.wf-execute-to-current-btn', {
                root: buttonContainer,
                context: `${this.id}.execToCurrentBtn`
            });

            if (!execToCurrentBtn) {
                execToCurrentBtn = document.createElement('button');
                execToCurrentBtn.className = 'wf-execute-to-current-btn inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground size-7 h-7 w-7';
                execToCurrentBtn.title = 'Execute to current tool';
                execToCurrentBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="size-3.5 stroke-current"><circle cx="12" cy="12" r="10" stroke-width="1.5"></circle><path d="M10 8L10 16L16 12L10 8Z" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"></path><line x1="6" y1="18" x2="18" y2="18" stroke-width="1.5" stroke-linecap="round"></line></svg>`;
                
                execToCurrentBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.executeToCurrentTool(card, header, toolsContainer);
                });

                buttonsAdded++;
            }

            // Always visible, regardless of collapsed state
            execToCurrentBtn.style.display = 'inline-flex';
            
            // Ensure proper positioning: after mini execute button if it exists, otherwise at the beginning
            const miniExecBtn = Context.dom.query('.wf-mini-execute-btn', {
                root: buttonContainer,
                context: `${this.id}.miniExecBtn`
            });
            if (miniExecBtn) {
                // If mini button exists, ensure we're right after it
                if (execToCurrentBtn.previousSibling !== miniExecBtn) {
                    miniExecBtn.insertAdjacentElement('afterend', execToCurrentBtn);
                }
            } else {
                // If no mini button, ensure we're at the beginning
                if (execToCurrentBtn !== buttonContainer.firstChild) {
                    buttonContainer.insertBefore(execToCurrentBtn, buttonContainer.firstChild);
                }
            }
        });

        if (buttonsAdded > 0) {
            Logger.log(`✓ Added ${buttonsAdded} execute-to-current button(s)`);
        }
    },
    
    findWorkflowPanel() {
        // Find panels by data-panel-id attribute
        const panels = Context.dom.queryAll('[data-panel-id][data-panel]', {
            context: `${this.id}.panels`
        });
        
        // Look for panel containing "Workflow" text in toolbar
        for (const candidate of panels) {
            const toolbar = candidate.querySelector('.border-b.h-9');
            if (toolbar) {
                const workflowText = Array.from(toolbar.querySelectorAll('span')).find(
                    span => span.textContent.trim() === 'Workflow'
                );
                if (workflowText) {
                    return candidate;
                }
            }
        }
        
        return null;
    },
    
    findToolsArea(panel) {
        if (!panel) return null;
        
        // Find scrollable container
        const scrollable = panel.querySelector('.overflow-y-auto');
        if (!scrollable) return null;
        
        // Find tools container with space-y-3 class
        const toolsArea = scrollable.querySelector('.space-y-3');
        return toolsArea;
    },
    
    async executeToCurrentTool(currentCard, currentHeader, toolsContainer) {
        Logger.log('Execute to current tool triggered');
        
        // Get all tool cards in order
        const allToolCards = Context.dom.queryAll('div.rounded-lg.border.transition-colors', {
            root: toolsContainer,
            context: `${this.id}.allToolCards`
        });
        
        // Find the index of the current tool
        const currentIndex = allToolCards.indexOf(currentCard);
        if (currentIndex === -1) {
            Logger.warn('Unable to find current tool in tools list');
            return;
        }
        
        // Get all tools from the beginning up to and including the current one
        const toolsToExecute = allToolCards.slice(0, currentIndex + 1);
        Logger.log(`Executing ${toolsToExecute.length} tool(s) from beginning to current tool`);
        
        // Execute each tool sequentially
        for (let i = 0; i < toolsToExecute.length; i++) {
            const card = toolsToExecute[i];
            const header = Context.dom.query(this.selectors.toolHeader, {
                root: card,
                context: `${this.id}.toolHeaderForExec`
            });
            
            if (!header) {
                Logger.warn(`Tool ${i + 1} header not found, skipping`);
                continue;
            }
            
            Logger.log(`Executing tool ${i + 1} of ${toolsToExecute.length}`);
            
            // Execute this tool
            const success = await this.executeTool(card, header);
            
            if (!success) {
                Logger.log(`Tool ${i + 1} execution failed, stopping`);
                return;
            }
            
            Logger.log(`Tool ${i + 1} execution completed successfully`);
        }
        
        Logger.log('All tools executed successfully');
    },
    
    async executeTool(card, header) {
        return new Promise((resolve) => {
            const collapsibleRoot = Context.dom.query('div[data-state]', {
                root: card,
                context: `${this.id}.collapsibleRoot`
            });
            if (!collapsibleRoot) {
                Logger.warn('No collapsible root found for tool execution');
                resolve(false);
                return;
            }

            const isCollapsed = collapsibleRoot.getAttribute('data-state') === 'closed';
            
            // Function to find and click mini-execute button
            const findAndClickMiniExecute = () => {
                const buttonContainer = Context.dom.query('div.flex.items-center.gap-1', {
                    root: header,
                    context: `${this.id}.buttonContainerForExec`
                });
                if (!buttonContainer) return false;
                
                const miniExecBtn = Context.dom.query('.wf-mini-execute-btn', {
                    root: buttonContainer,
                    context: `${this.id}.miniExecBtnForExec`
                });
                
                if (miniExecBtn && miniExecBtn.style.display !== 'none') {
                    miniExecBtn.click();
                    Logger.log('Clicked mini-execute button');
                    return true;
                }
                return false;
            };
            
            if (!isCollapsed) {
                // Close the tool first
                header.click();
                Logger.log('Collapsed tool before execution');
            }
            
            // Wait for tool to be collapsed and mini-execute button to appear
            const buttonObserver = new MutationObserver((mutations, obs) => {
                const currentState = collapsibleRoot.getAttribute('data-state');
                if (currentState === 'closed') {
                    // Tool is now collapsed, try to find and click mini-execute button
                    if (findAndClickMiniExecute()) {
                        obs.disconnect();
                        this.watchForToolCompletion(card, header, resolve);
                    }
                }
            });
            
            buttonObserver.observe(card, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['data-state', 'style']
            });
            
            // Also check immediately in case tool is already collapsed
            if (isCollapsed) {
                if (findAndClickMiniExecute()) {
                    buttonObserver.disconnect();
                    this.watchForToolCompletion(card, header, resolve);
                } else {
                    // Wait a bit for mini-execute button to appear
                    setTimeout(() => {
                        if (findAndClickMiniExecute()) {
                            buttonObserver.disconnect();
                            this.watchForToolCompletion(card, header, resolve);
                        } else {
                            buttonObserver.disconnect();
                            Logger.warn('Mini-execute button not found');
                            resolve(false);
                        }
                    }, 500);
                }
            }
            
            // Timeout after 5 seconds
            setTimeout(() => {
                buttonObserver.disconnect();
                if (!findAndClickMiniExecute()) {
                    Logger.warn('Mini-execute button not found after waiting');
                    resolve(false);
                }
            }, 5000);
        });
    },
    
    watchForToolCompletion(card, header, resolve) {
        const completionObserver = new MutationObserver((mutations, obs) => {
            const hasSuccess = card.classList.contains('border-emerald-500/50');
            const hasError = card.classList.contains('border-red-500/50');
            
            if (hasSuccess || hasError) {
                obs.disconnect();
                const success = hasSuccess && !hasError;
                Logger.log('Tool execution completed with ' + (success ? 'SUCCESS' : 'ERROR'));
                
                // The mini-execute button's own logic will handle collapsing the tool
                // We just need to resolve the promise
                resolve(success);
            }
        });
        
        completionObserver.observe(card, { 
            attributes: true, 
            attributeFilter: ['class'] 
        });
        
        // Timeout after 60 seconds
        setTimeout(() => {
            completionObserver.disconnect();
            Logger.warn('Tool execution timeout');
            resolve(false);
        }, 60000);
    }
};

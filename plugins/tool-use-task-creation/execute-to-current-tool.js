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
                execToCurrentBtn.className = 'wf-execute-to-current-btn inline-flex items-center justify-center whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 transition-colors hover:brightness-95 border border-border rounded-sm size-7 h-7 w-7 border-b-2 text-foreground';
                execToCurrentBtn.title = 'Execute to current tool';
                execToCurrentBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="fill-current size-3.5"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM11.03 8.652C10.7217 8.45933 10.3332 8.44913 10.0152 8.62536C9.69728 8.80158 9.5 9.13648 9.5 9.5V14.5C9.5 14.8635 9.69728 15.1984 10.0152 15.3746C10.3332 15.5509 10.7217 15.5407 11.03 15.348L15.03 12.848C15.3224 12.6653 15.5 12.3448 15.5 12C15.5 11.6552 15.3224 11.3347 15.03 11.152L11.03 8.652Z"></path></svg>`;
                
                execToCurrentBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.executeToCurrentTool(card, header, toolsContainer);
                });

                buttonContainer.insertBefore(execToCurrentBtn, buttonContainer.firstChild);
                buttonsAdded++;
            }

            // Always visible, regardless of collapsed state
            execToCurrentBtn.style.display = 'inline-flex';
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
            
            // Function to find and click execute button
            const findAndClickExecute = () => {
                const collapsibleContent = Context.dom.query('div[data-state="open"] > div[id^="radix-"][data-state="open"]', {
                    root: card,
                    context: `${this.id}.collapsibleContent`
                });
                if (!collapsibleContent) return false;
                
                const buttons = Context.dom.queryAll('div.px-3.pb-3.space-y-3 > button', {
                    root: collapsibleContent,
                    context: `${this.id}.executeButtons`
                });
                let executeBtn = null;
                buttons.forEach(btn => {
                    const btnText = btn.textContent.trim();
                    if (btnText === 'Execute' || btnText === 'Re-execute') {
                        executeBtn = btn;
                    }
                });
                
                if (executeBtn) {
                    executeBtn.click();
                    Logger.log('Clicked execute button');
                    return true;
                }
                return false;
            };
            
            if (isCollapsed) {
                // Expand first
                header.click();
                
                const buttonObserver = new MutationObserver((mutations, obs) => {
                    if (findAndClickExecute()) {
                        obs.disconnect();
                        this.watchForToolCompletion(card, header, resolve);
                    }
                });
                
                buttonObserver.observe(card, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['hidden', 'data-state']
                });
                
                setTimeout(() => {
                    buttonObserver.disconnect();
                    if (!findAndClickExecute()) {
                        Logger.warn('Execute button not found after expanding');
                        resolve(false);
                    }
                }, 5000);
            } else {
                // Already open, just click execute
                if (findAndClickExecute()) {
                    this.watchForToolCompletion(card, header, resolve);
                } else {
                    Logger.warn('Execute button not found for open tool');
                    resolve(false);
                }
            }
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
                
                // Collapse if it was expanded
                const collapsibleRoot = Context.dom.query('div[data-state]', {
                    root: card,
                    context: `${this.id}.collapsibleRoot`
                });
                if (collapsibleRoot && collapsibleRoot.getAttribute('data-state') === 'open') {
                    header.click();
                    Logger.log('Collapsed tool after completion');
                }
                
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

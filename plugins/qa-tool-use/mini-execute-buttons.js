// ============= mini-execute-buttons.js =============
const plugin = {
    id: 'miniExecuteButtons',
    name: 'Mini Execute Buttons',
    description: 'Adds quick execute buttons to collapsed workflow tools',
    _version: '1.3',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { missingLogged: false },
    
    // Plugin-specific selectors
    selectors: {
        workflowToolsArea: '[id="\\:rs\\:"] > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3',
        toolHeader: 'div.flex.items-center.gap-3.p-3.cursor-pointer.hover\\:bg-muted\\/30'
    },
    
    onMutation(state, context) {
        const toolsContainer = Context.dom.query(this.selectors.workflowToolsArea, {
            context: `${this.id}.workflowToolsArea`
        });
        if (!toolsContainer) {
            if (!state.missingLogged) {
                Logger.debug('Tools container not found for mini execute buttons');
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

            let miniExecBtn = Context.dom.query('.wf-mini-execute-btn', {
                root: buttonContainer,
                context: `${this.id}.miniExecBtn`
            });
            const isCollapsed = collapsibleRoot.getAttribute('data-state') === 'closed';

            if (!miniExecBtn) {
                miniExecBtn = document.createElement('button');
                miniExecBtn.className = 'wf-mini-execute-btn inline-flex items-center justify-center whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-brand !text-white transition-colors hover:brightness-95 border border-brand-accent rounded-sm size-7 h-7 w-7';
                miniExecBtn.title = 'Execute';
                miniExecBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="fill-current size-3.5"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM11.03 8.652C10.7217 8.45933 10.3332 8.44913 10.0152 8.62536C9.69728 8.80158 9.5 9.13648 9.5 9.5V14.5C9.5 14.8635 9.69728 15.1984 10.0152 15.3746C10.3332 15.5509 10.7217 15.5407 11.03 15.348L15.03 12.848C15.3224 12.6653 15.5 12.3448 15.5 12C15.5 11.6552 15.3224 11.3347 15.03 11.152L11.03 8.652Z"></path></svg>`;
                
                miniExecBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.executeTool(card, header);
                });

                buttonContainer.insertBefore(miniExecBtn, buttonContainer.firstChild);
                buttonsAdded++;
            }

            miniExecBtn.style.display = isCollapsed ? 'inline-flex' : 'none';
        });

        if (buttonsAdded > 0) {
            Logger.log(`✓ Added ${buttonsAdded} mini execute button(s)`);
        }
    },
    
    executeTool(card, header) {
        Logger.log('Mini execute triggered');
        
        const collapsibleRoot = Context.dom.query('div[data-state]', {
            root: card,
            context: `${this.id}.collapsibleRoot`
        });
        if (!collapsibleRoot) {
            Logger.warn('No collapsible root found for mini execute');
            return;
        }

        const isCollapsed = collapsibleRoot.getAttribute('data-state') === 'closed';
        
        if (isCollapsed) {
            header.click();
            
            const buttonObserver = new MutationObserver((mutations, obs) => {
                const collapsibleContent = Context.dom.query('div[data-state="open"] > div[id^="radix-"][data-state="open"]', {
                    root: card,
                    context: `${this.id}.collapsibleContent`
                });
                if (!collapsibleContent) return;
                
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
                    obs.disconnect();
                    executeBtn.click();
                    Logger.log('Clicked execute button for collapsed tool');
                    this.watchForToolCompletion(card, header);
                }
            });
            
            buttonObserver.observe(card, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['hidden', 'data-state']
            });
            
            setTimeout(() => buttonObserver.disconnect(), 5000);
        } else {
            const collapsibleContent = Context.dom.query('div[data-state="open"] > div[id^="radix-"][data-state="open"]', {
                root: card,
                context: `${this.id}.collapsibleContent`
            });
            if (collapsibleContent) {
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
                    Logger.log('Clicked execute button for open tool');
                } else {
                    Logger.warn('Execute button not found for open tool');
                }
            } else {
                Logger.warn('Collapsed content not found for open tool');
            }
        }
    },
    
    watchForToolCompletion(card, header) {
        const completionObserver = new MutationObserver((mutations, obs) => {
            const hasSuccess = card.classList.contains('border-emerald-500/50');
            const hasError = card.classList.contains('border-red-500/50');
            
            if (hasSuccess || hasError) {
                obs.disconnect();
                Logger.log('Tool execution completed with ' + (hasSuccess ? 'SUCCESS' : 'ERROR'));
                
                const collapsibleRoot = Context.dom.query('div[data-state]', {
                    root: card,
                    context: `${this.id}.collapsibleRoot`
                });
                if (collapsibleRoot && collapsibleRoot.getAttribute('data-state') === 'open') {
                    header.click();
                    Logger.log('Collapsed tool after completion');
                }
            }
        });
        
        completionObserver.observe(card, { attributes: true, attributeFilter: ['class'] });
        setTimeout(() => completionObserver.disconnect(), 5000);
    }
};

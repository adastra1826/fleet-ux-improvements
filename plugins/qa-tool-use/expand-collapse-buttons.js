// ============= expand-collapse-buttons.js =============
const plugin = {
    id: 'expandCollapseButtons',
    name: 'Expand/Collapse All',
    description: 'Adds buttons to expand or collapse all workflow tools',
    _version: '2.0',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { added: false, missingLogged: false },
    
    // Find panel by ID pattern (data-panel-id like :r1b:)
    findPanel() {
        // Strategy 1: Find by data-panel-id attribute pattern
        const panels = document.querySelectorAll('[data-panel-id]');
        for (const panel of panels) {
            const panelId = panel.getAttribute('data-panel-id');
            // Check if ID matches pattern (starts with : and contains alphanumeric)
            if (panelId && /^:[a-zA-Z0-9]+:$/.test(panelId)) {
                // Verify it has the workflow structure by checking for "Workflow" text
                const hasWorkflowText = Array.from(panel.querySelectorAll('*')).some(el => 
                    el.textContent && el.textContent.trim() === 'Workflow'
                );
                if (hasWorkflowText) {
                    return panel;
                }
            }
        }
        
        // Strategy 2: Find by ID pattern directly
        const idPattern = /^:[a-zA-Z0-9]+:$/;
        const allElements = document.querySelectorAll('[id]');
        for (const el of allElements) {
            const id = el.getAttribute('id');
            if (id && idPattern.test(id) && el.hasAttribute('data-panel')) {
                const hasWorkflowText = Array.from(el.querySelectorAll('*')).some(inner => 
                    inner.textContent && inner.textContent.trim() === 'Workflow'
                );
                if (hasWorkflowText) {
                    return el;
                }
            }
        }
        
        return null;
    },
    
    // Find toolbar header area containing "Workflow" text and "Clear" button
    findToolbarHeader(panel) {
        if (!panel) return null;
        
        // Find the header bar with border-b and h-9 classes
        const headerBar = panel.querySelector('.border-b.h-9');
        if (!headerBar) return null;
        
        // Verify it contains both "Workflow" text and "Clear" button
        const hasWorkflow = Array.from(headerBar.querySelectorAll('*')).some(el => 
            el.textContent && el.textContent.trim() === 'Workflow'
        );
        const hasClear = Array.from(headerBar.querySelectorAll('button')).some(btn => 
            btn.textContent && btn.textContent.trim().includes('Clear')
        );
        
        if (hasWorkflow && hasClear) {
            return headerBar;
        }
        
        return null;
    },
    
    // Find insertion point between "Workflow" div and "Clear" button div
    findInsertionPoint(headerBar) {
        if (!headerBar) return null;
        
        // Find the div containing "Workflow" text
        const workflowDiv = Array.from(headerBar.querySelectorAll('div')).find(div => {
            const text = div.textContent && div.textContent.trim();
            return text && text.includes('Workflow');
        });
        
        if (!workflowDiv) return null;
        
        // Find the parent that contains both workflow div and the Clear button area
        let parent = workflowDiv.parentElement;
        while (parent && parent !== headerBar) {
            const hasClear = Array.from(parent.querySelectorAll('button')).some(btn => 
                btn.textContent && btn.textContent.trim().includes('Clear')
            );
            if (hasClear) {
                // Find the div containing the Clear button (flex items-center)
                const clearContainer = Array.from(parent.querySelectorAll('div.flex.items-center')).find(div => {
                    return Array.from(div.querySelectorAll('button')).some(btn => 
                        btn.textContent && btn.textContent.trim().includes('Clear')
                    );
                });
                
                if (clearContainer) {
                    return { parent, before: clearContainer };
                }
            }
            parent = parent.parentElement;
        }
        
        return null;
    },
    
    // Find workflow tools area (space-y-3)
    findToolsArea(panel) {
        if (!panel) return null;
        
        // Strategy 1: Find scrollable container, then space-y-3 inside it
        const scrollable = panel.querySelector('.overflow-y-auto');
        if (scrollable) {
            const toolsArea = scrollable.querySelector('.space-y-3');
            if (toolsArea) {
                return toolsArea;
            }
        }
        
        // Strategy 2: Direct search for space-y-3 within panel
        const toolsArea = panel.querySelector('.space-y-3');
        if (toolsArea && panel.contains(toolsArea)) {
            return toolsArea;
        }
        
        return null;
    },
    
    onMutation(state, context) {
        // Find panel using ID-first approach
        const panel = this.findPanel();
        if (!panel) {
            if (!state.missingLogged) {
                Logger.debug('Panel not found for expand/collapse buttons');
                state.missingLogged = true;
            }
            return;
        }

        // Find toolbar header
        const headerBar = this.findToolbarHeader(panel);
        if (!headerBar) {
            if (!state.missingLogged) {
                Logger.debug('Toolbar header not found for expand/collapse buttons');
                state.missingLogged = true;
            }
            return;
        }

        // Check if tools exist
        const toolsArea = this.findToolsArea(panel);
        const hasTools = toolsArea && toolsArea.children.length > 0;

        let container = document.getElementById('wf-expand-collapse-container');
        
        if (!container) {
            const buttonClass = 'inline-flex items-center justify-center whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 transition-colors hover:bg-accent rounded-sm h-7 px-2 text-xs text-muted-foreground hover:text-foreground';

            container = document.createElement('div');
            container.id = 'wf-expand-collapse-container';
            container.className = 'flex items-center gap-2';

            const expandBtn = document.createElement('button');
            expandBtn.id = 'wf-expand-btn';
            expandBtn.className = buttonClass;
            expandBtn.innerHTML = `<span>Expand All</span>`;
            expandBtn.addEventListener('click', () => this.setAllToolsState('open'));

            const divider = document.createElement('div');
            divider.className = 'w-px h-5 bg-border mx-1';

            const collapseBtn = document.createElement('button');
            collapseBtn.id = 'wf-collapse-btn';
            collapseBtn.className = buttonClass;
            collapseBtn.innerHTML = `<span>Collapse All</span>`;
            collapseBtn.addEventListener('click', () => this.setAllToolsState('closed'));

            const trailingDivider = document.createElement('div');
            trailingDivider.id = 'wf-expand-collapse-trailing-divider';
            trailingDivider.className = 'w-px h-5 bg-border mx-1';

            container.appendChild(expandBtn);
            container.appendChild(divider);
            container.appendChild(collapseBtn);
            container.appendChild(trailingDivider);

            // Find insertion point between "Workflow" div and "Clear" button div
            const insertionPoint = this.findInsertionPoint(headerBar);
            if (insertionPoint) {
                insertionPoint.parent.insertBefore(container, insertionPoint.before);
                state.added = true;
                Logger.log('✓ Expand/Collapse buttons added to toolbar');
            } else {
                Logger.log('⚠ Could not find insertion point for expand/collapse buttons');
            }
        }

        if (container) {
            container.style.display = hasTools ? 'flex' : 'none';
        }
    },
    
    setAllToolsState(targetState) {
        // Find panel and tools area
        const panel = this.findPanel();
        if (!panel) {
            Logger.log('⚠ Panel not found for expand/collapse');
            return;
        }

        const workflowToolsArea = this.findToolsArea(panel);
        if (!workflowToolsArea) {
            Logger.log('⚠ Workflow tools area not found for expand/collapse');
            return;
        }

        // Find tool headers (collapsible headers)
        const toolHeaders = workflowToolsArea.querySelectorAll('div.flex.items-center.gap-3.p-3.cursor-pointer');
        let successCount = 0;

        toolHeaders.forEach((header) => {
            // Check state from data-state attribute or parent
            const stateSource = header.getAttribute('data-state')
                ? header
                : Context.dom.closest(header, '[data-state]', {
                    context: `${this.id}.toolHeaderState`
                });
            const currentState = stateSource?.getAttribute('data-state');
            const ariaExpanded = header.getAttribute('aria-expanded');
            const isOpen = currentState === 'open' ? true
                : currentState === 'closed' ? false
                    : ariaExpanded === 'true' ? true
                        : ariaExpanded === 'false' ? false
                            : null;

            if (isOpen === null) return;

            if ((targetState === 'open' && !isOpen) ||
                (targetState === 'closed' && isOpen)) {
                header.click();
                successCount++;
            }
        });

        Logger.log(`✓ ${targetState === 'open' ? 'Expanded' : 'Collapsed'} ${successCount} tools`);
    }
};

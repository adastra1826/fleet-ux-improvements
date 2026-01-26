// ============= expand-collapse-buttons.js =============
const plugin = {
    id: 'expandCollapseButtons',
    name: 'Expand/Collapse All',
    description: 'Adds buttons to expand or collapse all workflow tools',
    _version: '2.10',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { buttonsAdded: false, panelId: null, missingLogged: false },
    
    onMutation(state, context) {
        // Step 1: Find workflow panel by ID (data-panel-id attribute)
        let panel = null;
        
        // Try to find panel by data-panel-id attribute
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
                    panel = candidate;
                    break;
                }
            }
        }
        
        if (!panel) {
            if (!state.missingLogged) {
                Logger.log(`⚠ Workflow panel not found. Searched ${panels.length} panels with data-panel-id.`);
                state.missingLogged = true;
            }
            return;
        }
        
        // Track panel ID
        const currentPanelId = panel.getAttribute('data-panel-id');
        
        // Step 2: Find toolbar (div with border-b, h-9, containing "Workflow" text)
        const toolbar = panel.querySelector('.border-b.h-9');
        if (!toolbar) {
            if (!state.missingLogged) {
                Logger.log('⚠ Toolbar not found in workflow panel');
                state.missingLogged = true;
            }
            return;
        }
        
        // Step 3: Find the two divs where buttons should be inserted
        // First div: contains "Workflow" text
        const workflowTitleDiv = Array.from(toolbar.querySelectorAll('div')).find(div => {
            const span = div.querySelector('span');
            return span && span.textContent.trim() === 'Workflow';
        });
        
        // Second div: contains buttons (like "Clear")
        const buttonsContainer = Array.from(toolbar.querySelectorAll('div.flex.items-center')).find(div => {
            const button = div.querySelector('button');
            return button && (button.textContent.includes('Clear') || button.querySelector('svg'));
        });
        
        if (!workflowTitleDiv || !buttonsContainer) {
            if (!state.missingLogged) {
                Logger.log('⚠ Could not find insertion point for expand/collapse buttons. Looking for div with "Workflow" text and div with buttons.');
                state.missingLogged = true;
            }
            return;
        }
        
        // Step 4: Check if buttons already exist
        let buttonContainer = document.getElementById('wf-expand-collapse-container');
        
        if (!buttonContainer) {
            // Create button container
            buttonContainer = document.createElement('div');
            buttonContainer.id = 'wf-expand-collapse-container';
            buttonContainer.className = 'flex items-center gap-2';
            
            const buttonClass = 'inline-flex items-center justify-center whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 transition-colors hover:bg-accent rounded-sm h-7 px-2 text-xs text-muted-foreground hover:text-foreground';
            
            const expandBtn = document.createElement('button');
            expandBtn.className = buttonClass;
            expandBtn.textContent = 'Expand All';
            expandBtn.addEventListener('click', () => this.setAllToolsState(panel, 'open'));
            
            const collapseBtn = document.createElement('button');
            collapseBtn.className = buttonClass;
            collapseBtn.textContent = 'Collapse All';
            collapseBtn.addEventListener('click', () => this.setAllToolsState(panel, 'closed'));
            
            buttonContainer.appendChild(expandBtn);
            buttonContainer.appendChild(collapseBtn);
            
            // Insert between the two divs
            toolbar.insertBefore(buttonContainer, buttonsContainer);
            
            Logger.log('✓ Expand/Collapse buttons added to workflow toolbar');
            
            // Update state
            state.buttonsAdded = true;
            state.panelId = currentPanelId;
        }
        
        // Step 5: Always check visibility - show/hide buttons based on whether Clear button container has children
        // The buttonsContainer always exists, but only has children (the Clear button) when there are tools
        const innerButtonsDiv = buttonsContainer.querySelector('div.flex.items-center.gap-2');
        const hasTools = innerButtonsDiv && innerButtonsDiv.children.length > 0;
        buttonContainer.style.display = hasTools ? 'flex' : 'none';
        
        // Update state
        state.panelId = currentPanelId;
        state.missingLogged = false; // Reset on success
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
    
    setAllToolsState(panel, targetState) {
        const toolsArea = this.findToolsArea(panel);
        if (!toolsArea) {
            Logger.log('⚠ Workflow tools area not found');
            return;
        }
        
        // Find all tool headers - look for elements with cursor-pointer class that have aria-expanded
        // These are the clickable headers for each tool
        const toolHeaders = Array.from(toolsArea.querySelectorAll('div.cursor-pointer[aria-expanded]'));
        
        if (toolHeaders.length === 0) {
            Logger.log('⚠ No tool headers found in workflow tools area');
            return;
        }
        
        let successCount = 0;
        
        toolHeaders.forEach((header) => {
            // Determine current state from aria-expanded
            const ariaExpanded = header.getAttribute('aria-expanded');
            const isOpen = ariaExpanded === 'true';
            const isClosed = ariaExpanded === 'false';
            
            // Only toggle if state needs to change
            if (targetState === 'open' && !isOpen) {
                header.click();
                successCount++;
            } else if (targetState === 'closed' && !isClosed) {
                header.click();
                successCount++;
            }
        });
        
        Logger.log(`✓ ${targetState === 'open' ? 'Expanded' : 'Collapsed'} ${successCount} of ${toolHeaders.length} tools`);
    }
};

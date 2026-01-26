// ============= expand-collapse-buttons.js =============
const plugin = {
    id: 'expandCollapseButtons',
    name: 'Expand/Collapse All',
    description: 'Adds buttons to expand or collapse all workflow tools',
    _version: '2.1',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { added: false, missingLogged: false },
    
    // Find panel by ID pattern (data-panel-id like :r1b:)
    findPanel() {
        // Strategy 1: Find by data-panel-id attribute pattern
        const panels = document.querySelectorAll('[data-panel-id]');
        Logger.debug(`[${this.id}] Searching for panel: found ${panels.length} elements with data-panel-id`);
        
        for (const panel of panels) {
            const panelId = panel.getAttribute('data-panel-id');
            Logger.debug(`[${this.id}] Checking panel with data-panel-id="${panelId}"`);
            
            // Check if ID matches pattern (starts with : and contains alphanumeric)
            if (panelId && /^:[a-zA-Z0-9]+:$/.test(panelId)) {
                // Verify it has the workflow structure by checking for "Workflow" text
                const hasWorkflowText = Array.from(panel.querySelectorAll('*')).some(el => 
                    el.textContent && el.textContent.trim() === 'Workflow'
                );
                if (hasWorkflowText) {
                    Logger.debug(`[${this.id}] Found panel with ID pattern and "Workflow" text: ${panelId}`);
                    return panel;
                } else {
                    Logger.debug(`[${this.id}] Panel ${panelId} matched ID pattern but lacks "Workflow" text`);
                }
            } else {
                Logger.debug(`[${this.id}] Panel ${panelId} does not match ID pattern /^:[a-zA-Z0-9]+:$/`);
            }
        }
        
        // Strategy 2: Find by ID pattern directly
        const idPattern = /^:[a-zA-Z0-9]+:$/;
        const allElements = document.querySelectorAll('[id]');
        Logger.debug(`[${this.id}] Strategy 1 failed, trying Strategy 2: checking ${allElements.length} elements with [id]`);
        
        for (const el of allElements) {
            const id = el.getAttribute('id');
            if (id && idPattern.test(id) && el.hasAttribute('data-panel')) {
                const hasWorkflowText = Array.from(el.querySelectorAll('*')).some(inner => 
                    inner.textContent && inner.textContent.trim() === 'Workflow'
                );
                if (hasWorkflowText) {
                    Logger.debug(`[${this.id}] Found panel via Strategy 2: id="${id}"`);
                    return el;
                }
            }
        }
        
        Logger.log(`⚠ [${this.id}] Panel not found: Tried ${panels.length} elements with data-panel-id, ${allElements.length} elements with [id]. None matched ID pattern with "Workflow" text.`);
        return null;
    },
    
    // Find toolbar header area containing "Workflow" text and "Clear" button
    findToolbarHeader(panel) {
        if (!panel) {
            Logger.log(`⚠ [${this.id}] findToolbarHeader called with null panel`);
            return null;
        }
        
        // Find the header bar with border-b and h-9 classes
        const headerBar = panel.querySelector('.border-b.h-9');
        if (!headerBar) {
            const borderB = panel.querySelectorAll('.border-b');
            const h9 = panel.querySelectorAll('.h-9');
            Logger.log(`⚠ [${this.id}] Toolbar header not found: Found ${borderB.length} .border-b elements, ${h9.length} .h-9 elements, but none with both classes`);
            return null;
        }
        
        // Verify it contains both "Workflow" text and "Clear" button
        const hasWorkflow = Array.from(headerBar.querySelectorAll('*')).some(el => 
            el.textContent && el.textContent.trim() === 'Workflow'
        );
        const buttons = Array.from(headerBar.querySelectorAll('button'));
        const hasClear = buttons.some(btn => 
            btn.textContent && btn.textContent.trim().includes('Clear')
        );
        
        Logger.debug(`[${this.id}] Header bar found: hasWorkflow=${hasWorkflow}, hasClear=${hasClear}, buttons=${buttons.length}`);
        
        if (hasWorkflow && hasClear) {
            return headerBar;
        }
        
        const buttonTexts = buttons.map(btn => btn.textContent.trim()).filter(t => t);
        Logger.log(`⚠ [${this.id}] Toolbar header found but validation failed: hasWorkflow=${hasWorkflow}, hasClear=${hasClear}, button texts=[${buttonTexts.join(', ')}]`);
        return null;
    },
    
    // Find insertion point between "Workflow" div and "Clear" button div
    findInsertionPoint(headerBar) {
        if (!headerBar) {
            Logger.log(`⚠ [${this.id}] findInsertionPoint called with null headerBar`);
            return null;
        }
        
        // Find the div containing "Workflow" text
        const allDivs = Array.from(headerBar.querySelectorAll('div'));
        const workflowDiv = allDivs.find(div => {
            const text = div.textContent && div.textContent.trim();
            return text && text.includes('Workflow');
        });
        
        if (!workflowDiv) {
            const divTexts = allDivs.map(d => d.textContent.trim()).filter(t => t && t.length < 50).slice(0, 5);
            Logger.log(`⚠ [${this.id}] Workflow div not found in headerBar. Checked ${allDivs.length} divs. Sample texts: [${divTexts.join(', ')}]`);
            return null;
        }
        
        Logger.debug(`[${this.id}] Found workflow div, searching for insertion point`);
        
        // Find the parent that contains both workflow div and the Clear button area
        let parent = workflowDiv.parentElement;
        let depth = 0;
        while (parent && parent !== headerBar && depth < 10) {
            const buttons = Array.from(parent.querySelectorAll('button'));
            const hasClear = buttons.some(btn => 
                btn.textContent && btn.textContent.trim().includes('Clear')
            );
            if (hasClear) {
                // Find the div containing the Clear button (flex items-center)
                const clearContainers = Array.from(parent.querySelectorAll('div.flex.items-center'));
                const clearContainer = clearContainers.find(div => {
                    return Array.from(div.querySelectorAll('button')).some(btn => 
                        btn.textContent && btn.textContent.trim().includes('Clear')
                    );
                });
                
                if (clearContainer) {
                    Logger.debug(`[${this.id}] Found insertion point at depth ${depth}`);
                    return { parent, before: clearContainer };
                } else {
                    Logger.debug(`[${this.id}] Parent has Clear button but no matching container. Found ${clearContainers.length} div.flex.items-center`);
                }
            }
            parent = parent.parentElement;
            depth++;
        }
        
        Logger.log(`⚠ [${this.id}] Insertion point not found: Workflow div found but couldn't find parent containing both Workflow and Clear button (searched ${depth} levels)`);
        return null;
    },
    
    // Find workflow tools area (space-y-3)
    findToolsArea(panel) {
        if (!panel) {
            Logger.log(`⚠ [${this.id}] findToolsArea called with null panel`);
            return null;
        }
        
        // Strategy 1: Find scrollable container, then space-y-3 inside it
        const scrollable = panel.querySelector('.overflow-y-auto');
        if (scrollable) {
            const toolsArea = scrollable.querySelector('.space-y-3');
            if (toolsArea) {
                Logger.debug(`[${this.id}] Found tools area via Strategy 1 (scrollable -> space-y-3)`);
                return toolsArea;
            } else {
                Logger.debug(`[${this.id}] Found scrollable container but no .space-y-3 inside it`);
            }
        } else {
            Logger.debug(`[${this.id}] No .overflow-y-auto found in panel`);
        }
        
        // Strategy 2: Direct search for space-y-3 within panel
        const allSpaceY3 = panel.querySelectorAll('.space-y-3');
        const toolsArea = Array.from(allSpaceY3).find(area => panel.contains(area));
        if (toolsArea) {
            Logger.debug(`[${this.id}] Found tools area via Strategy 2 (direct .space-y-3 search)`);
            return toolsArea;
        }
        
        Logger.log(`⚠ [${this.id}] Tools area not found: Found ${scrollable ? 1 : 0} .overflow-y-auto, ${allSpaceY3.length} .space-y-3 elements, but none matched criteria`);
        return null;
    },
    
    onMutation(state, context) {
        Logger.debug(`[${this.id}] onMutation called`);
        
        // Find panel using ID-first approach
        const panel = this.findPanel();
        if (!panel) {
            if (!state.missingLogged) {
                Logger.log(`⚠ [${this.id}] Plugin cannot run: Panel not found. This plugin requires a panel with data-panel-id matching pattern /^:[a-zA-Z0-9]+:$/ and containing "Workflow" text.`);
                state.missingLogged = true;
            }
            return;
        }

        // Find toolbar header
        const headerBar = this.findToolbarHeader(panel);
        if (!headerBar) {
            if (!state.missingLogged) {
                Logger.log(`⚠ [${this.id}] Plugin cannot run: Toolbar header not found. Panel found but header bar with .border-b.h-9 containing both "Workflow" text and "Clear" button is missing.`);
                state.missingLogged = true;
            }
            return;
        }

        // Check if tools exist
        const toolsArea = this.findToolsArea(panel);
        const hasTools = toolsArea && toolsArea.children.length > 0;
        Logger.debug(`[${this.id}] Tools area check: hasTools=${hasTools}, toolsArea=${!!toolsArea}, toolCount=${toolsArea ? toolsArea.children.length : 0}`);

        let container = document.getElementById('wf-expand-collapse-container');
        
        if (!container) {
            Logger.debug(`[${this.id}] Creating expand/collapse button container`);
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
                Logger.log(`✓ [${this.id}] Expand/Collapse buttons added to toolbar`);
            } else {
                Logger.log(`⚠ [${this.id}] Failed to add buttons: Could not find insertion point between "Workflow" div and "Clear" button div. Buttons created but not inserted into DOM.`);
            }
        } else {
            Logger.debug(`[${this.id}] Button container already exists`);
        }

        if (container) {
            const wasVisible = container.style.display !== 'none';
            container.style.display = hasTools ? 'flex' : 'none';
            if (wasVisible !== (container.style.display !== 'none')) {
                Logger.debug(`[${this.id}] Container visibility changed: ${wasVisible} -> ${container.style.display !== 'none'} (hasTools=${hasTools})`);
            }
        } else {
            Logger.log(`⚠ [${this.id}] Container is null after creation attempt - buttons were not added`);
        }
    },
    
    setAllToolsState(targetState) {
        Logger.debug(`[${this.id}] setAllToolsState called with targetState=${targetState}`);
        
        // Find panel and tools area
        const panel = this.findPanel();
        if (!panel) {
            Logger.log(`⚠ [${this.id}] Cannot ${targetState === 'open' ? 'expand' : 'collapse'} tools: Panel not found`);
            return;
        }

        const workflowToolsArea = this.findToolsArea(panel);
        if (!workflowToolsArea) {
            Logger.log(`⚠ [${this.id}] Cannot ${targetState === 'open' ? 'expand' : 'collapse'} tools: Workflow tools area not found`);
            return;
        }

        // Find tool headers (collapsible headers)
        const toolHeaders = workflowToolsArea.querySelectorAll('div.flex.items-center.gap-3.p-3.cursor-pointer');
        Logger.debug(`[${this.id}] Found ${toolHeaders.length} tool headers`);
        
        if (toolHeaders.length === 0) {
            Logger.log(`⚠ [${this.id}] No tool headers found in tools area. Selector: div.flex.items-center.gap-3.p-3.cursor-pointer`);
            return;
        }

        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        toolHeaders.forEach((header, index) => {
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

            if (isOpen === null) {
                Logger.debug(`[${this.id}] Tool ${index + 1}: Could not determine state (data-state="${currentState}", aria-expanded="${ariaExpanded}")`);
                skippedCount++;
                return;
            }

            const needsToggle = (targetState === 'open' && !isOpen) || (targetState === 'closed' && isOpen);
            if (needsToggle) {
                try {
                    header.click();
                    successCount++;
                    Logger.debug(`[${this.id}] Tool ${index + 1}: ${targetState === 'open' ? 'Expanded' : 'Collapsed'} (was ${isOpen ? 'open' : 'closed'})`);
                } catch (error) {
                    errorCount++;
                    Logger.log(`⚠ [${this.id}] Tool ${index + 1}: Error clicking header: ${error.message}`);
                }
            } else {
                Logger.debug(`[${this.id}] Tool ${index + 1}: Already ${targetState === 'open' ? 'open' : 'closed'}, skipping`);
            }
        });

        if (successCount > 0) {
            Logger.log(`✓ [${this.id}] ${targetState === 'open' ? 'Expanded' : 'Collapsed'} ${successCount} tool(s)${skippedCount > 0 ? `, skipped ${skippedCount} (unknown state)${errorCount > 0 ? `, ${errorCount} error(s)` : ''}` : ''}`);
        } else if (toolHeaders.length > 0) {
            Logger.log(`⚠ [${this.id}] No tools ${targetState === 'open' ? 'expanded' : 'collapsed'}: ${toolHeaders.length} tools found, but all were already ${targetState === 'open' ? 'open' : 'closed'} or had unknown state (${skippedCount} skipped, ${errorCount} errors)`);
        }
    }
};

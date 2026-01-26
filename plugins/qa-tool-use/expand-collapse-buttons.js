// ============= expand-collapse-buttons.js =============
const plugin = {
    id: 'expandCollapseButtons',
    name: 'Expand/Collapse All',
    description: 'Adds buttons to expand or collapse all workflow tools',
    _version: '2.2',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { added: false, missingLogged: false },
    
    // Find panel by ID pattern (like :rd:, :rs:, etc.)
    findPanel() {
        const idPattern = /^:[a-zA-Z0-9]+:$/;
        
        // Strategy 0: Direct ID lookup for known common IDs
        const commonIds = [':rd:', ':rs:', ':r1b:', ':rp:'];
        for (const testId of commonIds) {
            const panel = document.getElementById(testId) || document.querySelector(`[id="${testId}"]`);
            if (panel) {
                const hasWorkflowText = Array.from(panel.querySelectorAll('*')).some(el => 
                    el.textContent && el.textContent.trim() === 'Workflow'
                );
                if (hasWorkflowText) {
                    const panelId = panel.getAttribute('id');
                    const dataPanel = panel.getAttribute('data-panel');
                    const dataPanelId = panel.getAttribute('data-panel-id');
                    Logger.log(`✓ [${this.id}] Found panel via Strategy 0 (direct ID): id="${panelId}", data-panel="${dataPanel}", data-panel-id="${dataPanelId}"`);
                    return panel;
                } else {
                    Logger.debug(`[${this.id}] Panel with id="${testId}" found but lacks "Workflow" text`);
                }
            }
        }
        
        // Strategy 1: Find by data-panel attribute (matching other plugins like panel-size-memory.js)
        const panels = document.querySelectorAll('[data-panel]');
        Logger.debug(`[${this.id}] Strategy 0 failed, trying Strategy 1: found ${panels.length} elements with data-panel`);
        
        for (const panel of panels) {
            const panelId = panel.getAttribute('id');
            const dataPanel = panel.getAttribute('data-panel');
            Logger.debug(`[${this.id}] Checking panel with id="${panelId}", data-panel="${dataPanel}"`);
            
            // Check if ID matches pattern (starts with : and contains alphanumeric)
            if (panelId && idPattern.test(panelId)) {
                // Verify it has the workflow structure by checking for "Workflow" text
                const hasWorkflowText = Array.from(panel.querySelectorAll('*')).some(el => 
                    el.textContent && el.textContent.trim() === 'Workflow'
                );
                if (hasWorkflowText) {
                    const dataPanelId = panel.getAttribute('data-panel-id');
                    Logger.log(`✓ [${this.id}] Found panel via Strategy 1 (data-panel): id="${panelId}", data-panel="${dataPanel}", data-panel-id="${dataPanelId}"`);
                    return panel;
                } else {
                    Logger.debug(`[${this.id}] Panel ${panelId} matched ID pattern but lacks "Workflow" text`);
                }
            } else {
                Logger.debug(`[${this.id}] Panel id="${panelId}" does not match ID pattern /^:[a-zA-Z0-9]+:$/`);
            }
        }
        
        // Strategy 2: Find by ID pattern directly with data-panel attribute
        const allElements = document.querySelectorAll('[id]');
        Logger.debug(`[${this.id}] Strategy 1 failed, trying Strategy 2: checking ${allElements.length} elements with [id]`);
        
        for (const el of allElements) {
            const id = el.getAttribute('id');
            if (id && idPattern.test(id) && el.hasAttribute('data-panel')) {
                const hasWorkflowText = Array.from(el.querySelectorAll('*')).some(inner => 
                    inner.textContent && inner.textContent.trim() === 'Workflow'
                );
                if (hasWorkflowText) {
                    const dataPanel = el.getAttribute('data-panel');
                    Logger.log(`✓ [${this.id}] Found panel via Strategy 2 (id + data-panel): id="${id}", data-panel="${dataPanel}"`);
                    return el;
                }
            }
        }
        
        // Strategy 3: Fallback - any element with matching ID pattern that contains "Workflow" text
        Logger.debug(`[${this.id}] Strategy 2 failed, trying Strategy 3: checking all elements with matching ID pattern`);
        for (const el of allElements) {
            const id = el.getAttribute('id');
            if (id && idPattern.test(id)) {
                const hasWorkflowText = Array.from(el.querySelectorAll('*')).some(inner => 
                    inner.textContent && inner.textContent.trim() === 'Workflow'
                );
                if (hasWorkflowText) {
                    const dataPanel = el.getAttribute('data-panel');
                    const dataPanelId = el.getAttribute('data-panel-id');
                    Logger.log(`✓ [${this.id}] Found panel via Strategy 3 (fallback): id="${id}", data-panel="${dataPanel}", data-panel-id="${dataPanelId}"`);
                    return el;
                }
            }
        }
        
        Logger.log(`⚠ [${this.id}] Panel not found: Tried direct IDs (${commonIds.length}), ${panels.length} elements with data-panel, ${allElements.length} elements with [id]. None matched ID pattern with "Workflow" text.`);
        return null;
    },
    
    // Find toolbar header area containing "Workflow" text and "Clear" button
    findToolbarHeader(panel) {
        if (!panel) {
            Logger.log(`⚠ [${this.id}] findToolbarHeader called with null panel`);
            return null;
        }
        
        // Strategy 1: Find element with both border-b and h-9 classes (CSS selector)
        let headerBar = panel.querySelector('.border-b.h-9');
        if (headerBar) {
            Logger.debug(`[${this.id}] Found header bar via Strategy 1 (.border-b.h-9)`);
        } else {
            // Strategy 2: Find .border-b, then check if it has h-9 class
            const borderB = Array.from(panel.querySelectorAll('.border-b'));
            Logger.debug(`[${this.id}] Strategy 1 failed, trying Strategy 2: found ${borderB.length} .border-b elements`);
            
            for (const el of borderB) {
                if (el.classList.contains('h-9')) {
                    headerBar = el;
                    Logger.debug(`[${this.id}] Found header bar via Strategy 2 (border-b with h-9 class)`);
                    break;
                }
            }
        }
        
        if (!headerBar) {
            // Strategy 3: Find element with both classes using classList.contains() check
            const allElements = Array.from(panel.querySelectorAll('*'));
            Logger.debug(`[${this.id}] Strategy 2 failed, trying Strategy 3: checking ${allElements.length} elements`);
            
            for (const el of allElements) {
                if (el.classList.contains('border-b') && el.classList.contains('h-9')) {
                    headerBar = el;
                    Logger.debug(`[${this.id}] Found header bar via Strategy 3 (classList.contains check)`);
                    break;
                }
            }
        }
        
        if (!headerBar) {
            // Strategy 4: Find by structure - look for header bar containing "Workflow" text, then verify classes
            Logger.debug(`[${this.id}] Strategy 3 failed, trying Strategy 4: searching by structure`);
            const allElements = Array.from(panel.querySelectorAll('*'));
            for (const el of allElements) {
                const hasWorkflow = Array.from(el.querySelectorAll('*')).some(inner => 
                    inner.textContent && inner.textContent.trim() === 'Workflow'
                );
                if (hasWorkflow) {
                    // Check if this element or a parent has the right classes
                    let candidate = el;
                    let depth = 0;
                    while (candidate && candidate !== panel && depth < 5) {
                        if (candidate.classList.contains('border-b') || candidate.classList.contains('h-9')) {
                            // Check if it has both classes or is close to having both
                            const hasBorderB = candidate.classList.contains('border-b');
                            const hasH9 = candidate.classList.contains('h-9');
                            if (hasBorderB && hasH9) {
                                headerBar = candidate;
                                Logger.debug(`[${this.id}] Found header bar via Strategy 4 (structure search) at depth ${depth}`);
                                break;
                            }
                        }
                        candidate = candidate.parentElement;
                        depth++;
                    }
                    if (headerBar) break;
                }
            }
        }
        
        if (!headerBar) {
            // Log diagnostic information
            const borderB = panel.querySelectorAll('.border-b');
            const h9 = panel.querySelectorAll('.h-9');
            const borderBClasses = Array.from(borderB).slice(0, 3).map(el => {
                const classes = Array.from(el.classList).join(' ');
                return `[${classes.substring(0, 100)}]`;
            });
            const h9Classes = Array.from(h9).slice(0, 3).map(el => {
                const classes = Array.from(el.classList).join(' ');
                return `[${classes.substring(0, 100)}]`;
            });
            Logger.log(`⚠ [${this.id}] Toolbar header not found after all strategies: Found ${borderB.length} .border-b elements, ${h9.length} .h-9 elements. Sample .border-b classes: ${borderBClasses.join(', ')}. Sample .h-9 classes: ${h9Classes.join(', ')}`);
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
        
        const headerClasses = Array.from(headerBar.classList).join(' ');
        Logger.debug(`[${this.id}] Header bar found: hasWorkflow=${hasWorkflow}, hasClear=${hasClear}, buttons=${buttons.length}, classes="${headerClasses.substring(0, 150)}"`);
        
        if (hasWorkflow && hasClear) {
            return headerBar;
        }
        
        const buttonTexts = buttons.map(btn => btn.textContent.trim()).filter(t => t);
        Logger.log(`⚠ [${this.id}] Toolbar header found but validation failed: hasWorkflow=${hasWorkflow}, hasClear=${hasClear}, button texts=[${buttonTexts.join(', ')}], classes="${headerClasses.substring(0, 150)}"`);
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
                Logger.log(`⚠ [${this.id}] Plugin cannot run: Panel not found. Tried direct ID lookup, [data-panel] attribute, [id] with data-panel, and fallback pattern matching. Panel must have id matching /^:[a-zA-Z0-9]+:$/ and contain "Workflow" text.`);
                state.missingLogged = true;
            }
            return;
        }

        // Find toolbar header
        const headerBar = this.findToolbarHeader(panel);
        if (!headerBar) {
            if (!state.missingLogged) {
                Logger.log(`⚠ [${this.id}] Plugin cannot run: Toolbar header not found. Panel found (id="${panel.getAttribute('id')}") but header bar with .border-b and .h-9 classes containing both "Workflow" text and "Clear" button is missing. Check logs above for diagnostic details.`);
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

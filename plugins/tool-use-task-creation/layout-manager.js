// ============= layout-manager.js =============
const plugin = {
    id: 'layoutManager',
    name: 'Three Column Layout',
    description: 'Transforms the layout into three resizable columns with integrated notes',
    _version: '3.6',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { applied: false, missingLogged: false, structureMissingLogged: false },
    
    // No hardcoded selectors - using semantic search instead
    selectors: {},
    
    // Plugin-specific storage keys
    storageKeys: {
        col1Width: 'col1-width',
        col2Width: 'col2-width',
        col3Width: 'col3-width',
        sectionSplitRatio: 'section-split-ratio',
        notes: 'notes'
    },
    
    onMutation(state, context) {
        if (state.applied) return;

        if (document.getElementById('wf-three-col-layout')) {
            state.applied = true;
            return;
        }

        // Find main container by semantic search: look for panel group with horizontal direction
        let mainContainer = null;
        
        // Strategy 1: Find by data-panel-group attribute with horizontal direction
        const panelGroups = Array.from(document.querySelectorAll('[data-panel-group][data-panel-group-direction="horizontal"]'));
        for (const group of panelGroups) {
            // Check if it has panel children
            const panels = Array.from(group.children).filter(child => 
                child.hasAttribute('data-panel')
            );
            if (panels.length >= 2) {
                mainContainer = group;
                break;
            }
        }
        
        // Strategy 2: Find by looking for elements with data-panel-group-id that contain panels
        if (!mainContainer) {
            const candidates = Array.from(document.querySelectorAll('[data-panel-group-id]'));
            for (const candidate of candidates) {
                const panels = Array.from(candidate.children).filter(child => 
                    child.hasAttribute('data-panel')
                );
                if (panels.length >= 2 && candidate.hasAttribute('data-panel-group-direction')) {
                    mainContainer = candidate;
                    break;
                }
            }
        }
        
        // Strategy 3: Find by looking for resize handles and their parent
        if (!mainContainer) {
            const resizeHandles = Array.from(document.querySelectorAll('[data-resize-handle]'));
            for (const handle of resizeHandles) {
                const parent = handle.parentElement;
                if (parent && parent.hasAttribute('data-panel-group')) {
                    const panels = Array.from(parent.children).filter(child => 
                        child.hasAttribute('data-panel')
                    );
                    if (panels.length >= 2) {
                        mainContainer = parent;
                        break;
                    }
                }
            }
        }

        if (!mainContainer) {
            if (!state.missingLogged) {
                Logger.warn(`[${this.id}] Failed to find main container (panel group) - layout not applied`);
                state.missingLogged = true;
            }
            return;
        }

        // Find left column (first panel, typically smaller size ~30%)
        let leftColumn = null;
        
        // Strategy 1: Find by panel size (typically 25-35%)
        const allPanels = Array.from(mainContainer.children).filter(child => 
            child.hasAttribute('data-panel')
        );
        
        for (const panel of allPanels) {
            if (panel.hasAttribute('data-panel-size')) {
                const size = parseFloat(panel.getAttribute('data-panel-size'));
                if (size >= 25 && size <= 35) {
                    leftColumn = panel;
                    break;
                }
            }
        }
        
        // Strategy 2: First panel child
        if (!leftColumn && allPanels.length > 0) {
            leftColumn = allPanels[0];
        }

        if (!leftColumn) {
            if (!state.missingLogged) {
                Logger.warn(`[${this.id}] Failed to find left column panel - layout not applied`);
                state.missingLogged = true;
            }
            return;
        }

        // Verify there's a resize handle (confirms we're in the right structure)
        const existingDivider = Array.from(mainContainer.children).find(child => 
            child.hasAttribute('data-resize-handle')
        );
        if (!existingDivider) {
            if (!state.missingLogged) {
                Logger.warn(`[${this.id}] No resize handle found - layout structure may not be ready`);
                state.missingLogged = true;
            }
            return;
        }
        
        // Find workflow column (right panel, typically larger size ~70%)
        let workflowColumn = null;
        
        // Strategy 1: Find by panel size (typically 60-80%)
        for (const panel of allPanels) {
            if (panel === leftColumn) continue;
            if (panel.hasAttribute('data-panel-size')) {
                const size = parseFloat(panel.getAttribute('data-panel-size'));
                if (size >= 60 && size <= 80) {
                    workflowColumn = panel;
                    break;
                }
            }
        }
        
        // Strategy 2: Last panel child
        if (!workflowColumn && allPanels.length >= 2) {
            workflowColumn = allPanels[allPanels.length - 1];
        }

        if (!workflowColumn) {
            if (!state.structureMissingLogged) {
                Logger.warn(`[${this.id}] Failed to find workflow column panel - layout not applied`);
                state.structureMissingLogged = true;
            }
            return;
        }

        // Find inner sections within left column
        // Top section: flex-shrink-0 (Task/Notes tabs area)
        let topSection = null;
        
        // Strategy 1: Direct query for flex-shrink-0
        topSection = leftColumn.querySelector('.flex-shrink-0');
        
        // Strategy 2: Walk children looking for flex-shrink-0
        if (!topSection) {
            const walkChildren = (node) => {
                for (const child of node.children) {
                    if (child.classList.contains('flex-shrink-0')) {
                        return child;
                    }
                    const found = walkChildren(child);
                    if (found) return found;
                }
                return null;
            };
            topSection = walkChildren(leftColumn);
        }

        if (!topSection) {
            if (!state.structureMissingLogged) {
                Logger.warn(`[${this.id}] Failed to find top section (flex-shrink-0) in left column - layout not applied`);
                state.structureMissingLogged = true;
            }
            return;
        }

        // Bottom section: flex-1 min-h-0 overflow-hidden (tool search area)
        let bottomSection = null;
        
        // Strategy 1: Look for div with flex-1, min-h-0, and overflow-hidden
        const candidates = Array.from(leftColumn.querySelectorAll('div'));
        for (const candidate of candidates) {
            if (candidate.classList.contains('flex-1') && 
                candidate.classList.contains('min-h-0') && 
                candidate.classList.contains('overflow-hidden') &&
                !candidate.classList.contains('flex-shrink-0')) {
                bottomSection = candidate;
                break;
            }
        }
        
        // Strategy 2: Look for flex-1 with min-h-0 (without overflow-hidden requirement)
        if (!bottomSection) {
            for (const candidate of candidates) {
                if (candidate.classList.contains('flex-1') && 
                    candidate.classList.contains('min-h-0') &&
                    !candidate.classList.contains('flex-shrink-0')) {
                    bottomSection = candidate;
                    break;
                }
            }
        }
        
        // Strategy 3: Look for any flex-1 that's not flex-shrink-0 and contains tool-related content
        if (!bottomSection) {
            for (const candidate of candidates) {
                if (candidate.classList.contains('flex-1') && 
                    !candidate.classList.contains('flex-shrink-0')) {
                    // Check if it contains tool search or tool list indicators
                    const hasToolSearch = candidate.querySelector('input[placeholder*="Search"]') ||
                                         candidate.querySelector('input[placeholder*="search"]') ||
                                         candidate.textContent.includes('Tools');
                    if (hasToolSearch) {
                        bottomSection = candidate;
                        break;
                    }
                }
            }
        }
        
        // Strategy 4: Find sibling of topSection that's not flex-shrink-0
        if (!bottomSection && topSection.parentElement) {
            const siblings = Array.from(topSection.parentElement.children);
            for (const sibling of siblings) {
                if (sibling !== topSection && 
                    sibling.tagName === 'DIV' && 
                    !sibling.classList.contains('flex-shrink-0')) {
                    bottomSection = sibling;
                    break;
                }
            }
        }

        if (!bottomSection) {
            if (!state.structureMissingLogged) {
                Logger.warn(`[${this.id}] Failed to find bottom section (tool search area) in left column - layout not applied`);
                state.structureMissingLogged = true;
            }
            return;
        }

        // Get panel group ID from main container or panels
        let panelGroupId = mainContainer.getAttribute('data-panel-group-id');
        if (!panelGroupId && leftColumn) {
            panelGroupId = leftColumn.getAttribute('data-panel-group-id');
        }
        if (!panelGroupId && workflowColumn) {
            panelGroupId = workflowColumn.getAttribute('data-panel-group-id');
        }
        panelGroupId = panelGroupId || ':r5:';
        
        const preservedElements = {
            leftColumn: leftColumn.parentNode.removeChild(leftColumn),
            workflowColumn: workflowColumn.parentNode.removeChild(workflowColumn),
            topSection: topSection,
            bottomSection: bottomSection
        };
        
        mainContainer.innerHTML = '';
        mainContainer.id = 'wf-three-col-layout';

        const savedCol1 = Storage.get(this.storageKeys.col1Width, 25);
        const savedCol2 = Storage.get(this.storageKeys.col2Width, 37.5);
        const savedCol3 = Storage.get(this.storageKeys.col3Width, 37.5);

        const col1 = document.createElement('div');
        col1.className = 'flex flex-col overflow-hidden transition-opacity';
        col1.id = 'wf-col-text';
        col1.style.cssText = `flex: ${savedCol1} 1 0px; overflow: hidden;`;
        col1.setAttribute('data-panel-group-id', panelGroupId);
        col1.setAttribute('data-panel', '');
        col1.setAttribute('data-panel-id', 'wf-col-text');
        col1.setAttribute('data-panel-size', '25');
        
        const splitWrapper = document.createElement('div');
        splitWrapper.className = 'flex flex-col h-full';
        splitWrapper.id = 'wf-split-wrapper';
        
        this.reorganizeFirstColumnContent(splitWrapper, preservedElements.topSection);
        col1.appendChild(splitWrapper);

        const divider1 = this.createDivider(panelGroupId, 'wf-divider-1', 'wf-col-text', 40, 15, 25);
        
        const col2 = document.createElement('div');
        col2.className = 'flex flex-col overflow-hidden transition-opacity';
        col2.id = 'wf-col-tools';
        col2.style.cssText = `flex: ${savedCol2} 1 0px; overflow: hidden;`;
        col2.setAttribute('data-panel-group-id', panelGroupId);
        col2.setAttribute('data-panel', '');
        col2.setAttribute('data-panel-id', 'wf-col-tools');
        col2.setAttribute('data-panel-size', '37.5');
        col2.appendChild(preservedElements.bottomSection);

        const divider2 = this.createDivider(panelGroupId, 'wf-divider-2', 'wf-col-tools', 50, 20, 37.5);

        preservedElements.workflowColumn.style.flex = `${savedCol3} 1 0px`;
        preservedElements.workflowColumn.setAttribute('data-panel-size', savedCol3.toString());

        mainContainer.appendChild(col1);
        mainContainer.appendChild(divider1);
        mainContainer.appendChild(col2);
        mainContainer.appendChild(divider2);
        mainContainer.appendChild(preservedElements.workflowColumn);

        this.setupColumnResize(divider1, col1, col2);
        this.setupColumnResize(divider2, col2, preservedElements.workflowColumn);

        state.applied = true;
        Logger.log(`[${this.id}] ✓ Three column layout applied`);
    },
    
    createDivider(panelGroupId, id, ariaControls, max, min, current) {
        const divider = document.createElement('div');
        divider.className = 'relative w-[2px] h-[98%] my-auto hover:bg-brand transition-all duration-300 ease-in-out mx-[1px] before:absolute before:top-0 before:left-[-3px] before:right-[-3px] before:bottom-0 before:content-[""] before:cursor-col-resize';
        divider.setAttribute('role', 'separator');
        divider.style.touchAction = 'none';
        divider.setAttribute('tabindex', '0');
        divider.setAttribute('data-panel-group-direction', 'horizontal');
        divider.setAttribute('data-panel-group-id', panelGroupId);
        divider.setAttribute('data-resize-handle', '');
        divider.setAttribute('data-panel-resize-handle-enabled', 'true');
        divider.setAttribute('data-panel-resize-handle-id', id);
        divider.setAttribute('data-resize-handle-state', 'inactive');
        divider.setAttribute('aria-controls', ariaControls);
        divider.setAttribute('aria-valuemax', max.toString());
        divider.setAttribute('aria-valuemin', min.toString());
        divider.setAttribute('aria-valuenow', current.toString());
        return divider;
    },
    
    reorganizeFirstColumnContent(wrapper, topSection) {
        const savedRatio = Storage.get(this.storageKeys.sectionSplitRatio, 60);
        
        const existingSection = Context.dom.query('div.p-3.border-b', {
            root: topSection,
            context: `${this.id}.existingSection`
        });
        if (!existingSection) {
            Logger.warn(`[${this.id}] Existing section not found for reorganization`);
            return;
        }

        topSection.removeChild(existingSection);

        const topPanel = document.createElement('div');
        topPanel.id = 'wf-top-panel';
        topPanel.className = 'flex flex-col overflow-hidden';
        topPanel.style.flex = `${savedRatio} 1 0%`;
        topPanel.style.minHeight = '100px';
        
        existingSection.className = 'p-3 border-b flex flex-col h-full';
        
        const textareaWrapper = Context.dom.query('div.space-y-2.relative', {
            root: existingSection,
            context: `${this.id}.textareaWrapper`
        });
        if (textareaWrapper) {
            textareaWrapper.className = 'space-y-2 relative flex-1 flex flex-col';
            
            const relativeDiv = Context.dom.query('div.relative', {
                root: textareaWrapper,
                context: `${this.id}.relativeDiv`
            });
            if (relativeDiv) {
                relativeDiv.className = 'relative flex-1 flex flex-col';
                
                const textareaContainer = Context.dom.query('div.flex.flex-col', {
                    root: relativeDiv,
                    context: `${this.id}.textareaContainer`
                });
                if (textareaContainer) {
                    textareaContainer.style.height = '100%';
                }
            }
        }
        
        topPanel.appendChild(existingSection);

        const resizeHandle = document.createElement('div');
        resizeHandle.id = 'wf-section-resize-handle';
        resizeHandle.className = 'relative h-[2px] w-full hover:bg-brand transition-all duration-300 ease-in-out my-[1px]';
        resizeHandle.style.backgroundColor = 'var(--border)';
        resizeHandle.style.cursor = 'grab';
        resizeHandle.setAttribute('role', 'separator');
        resizeHandle.style.touchAction = 'none';
        
        const hitArea = document.createElement('div');
        hitArea.style.cssText = 'position: absolute; top: -6px; bottom: -6px; left: 0; right: 0; cursor: grab;';
        resizeHandle.appendChild(hitArea);

        const bottomPanel = document.createElement('div');
        bottomPanel.id = 'wf-bottom-panel';
        bottomPanel.className = 'p-3 border-b overflow-y-auto';
        bottomPanel.style.flex = `${100 - savedRatio} 1 0%`;
        bottomPanel.style.minHeight = '100px';

        this.createNotesSection(bottomPanel);

        wrapper.appendChild(topPanel);
        wrapper.appendChild(resizeHandle);
        wrapper.appendChild(bottomPanel);

        this.setupSectionResize(resizeHandle, topPanel, bottomPanel);
    },
    
    createNotesSection(container) {
        const savedNotes = Storage.get(this.storageKeys.notes, '');
        Logger.log(`✓ Notes loaded from storage (${savedNotes.length} chars)`);

        container.className = 'p-3 border-b overflow-hidden flex flex-col';

        const escapedNotes = savedNotes
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        container.innerHTML = `
            <div class="flex flex-col flex-1">
                <div class="flex items-center justify-between h-5 mb-2">
                    <div class="text-sm text-muted-foreground font-medium">Notes</div>
                </div>
                <div class="relative flex-1 flex flex-col">
                    <div class="flex flex-col relative rounded-md overflow-hidden border border-input bg-background shadow-sm h-full">
                        <textarea id="wf-notes-textarea" class="flex-1 w-full border-0 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none" placeholder="Add your notes here. These are not submitted with your task. They are auto-saved and persist between page loads.">${escapedNotes}</textarea>
                    </div>
                </div>
            </div>
        `;
        
        // Set up auto-save for notes
        const textarea = Context.dom.query('#wf-notes-textarea', {
            root: container,
            context: `${this.id}.notesTextarea`
        });
        if (textarea) {
            let saveTimeout = null;
            textarea.addEventListener('input', () => {
                if (saveTimeout) {
                    clearTimeout(saveTimeout);
                }
                
                saveTimeout = setTimeout(() => {
                    const currentValue = textarea.value;
                    Storage.set(this.storageKeys.notes, currentValue);
                    Logger.log(`✓ Notes auto-saved (${currentValue.length} chars)`);
                }, 1000);
            });
        }
    },
    
    setupSectionResize(handle, topPanel, bottomPanel) {
        let isResizing = false;
        let startY = 0;
        let startTopHeight = 0;
        let startBottomHeight = 0;
        let totalHeight = 0;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            
            const wrapper = handle.parentElement;
            totalHeight = wrapper.offsetHeight;
            startTopHeight = topPanel.offsetHeight;
            startBottomHeight = bottomPanel.offsetHeight;

            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
            handle.style.cursor = 'grabbing';
            handle.style.backgroundColor = 'var(--brand)';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaY = e.clientY - startY;
            const newTopHeight = startTopHeight + deltaY;
            const newBottomHeight = startBottomHeight - deltaY;

            const topPercent = (newTopHeight / totalHeight) * 100;
            const bottomPercent = (newBottomHeight / totalHeight) * 100;

            if (topPercent >= 20 && topPercent <= 80) {
                topPanel.style.flex = `${topPercent} 1 0%`;
                bottomPanel.style.flex = `${bottomPercent} 1 0%`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                handle.style.backgroundColor = 'var(--border)';

                const topFlex = parseFloat(topPanel.style.flex) || 60;
                Storage.set(this.storageKeys.sectionSplitRatio, topFlex);
            }
        });

        handle.addEventListener('mouseenter', () => {
            if (!isResizing) handle.style.backgroundColor = 'var(--brand)';
        });

        handle.addEventListener('mouseleave', () => {
            if (!isResizing) handle.style.backgroundColor = 'var(--border)';
        });
    },
    
    setupColumnResize(divider, leftCol, rightCol) {
        let isResizing = false;
        let startX = 0;
        let startLeftWidth = 0;
        let startRightWidth = 0;
        let totalWidth = 0;

        divider.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            
            const parent = divider.parentElement;
            totalWidth = parent.offsetWidth;
            
            const leftFlex = parseFloat(leftCol.style.flex) || 25;
            const rightFlex = parseFloat(rightCol.style.flex) || 37.5;
            
            startLeftWidth = (leftFlex / 100) * totalWidth;
            startRightWidth = (rightFlex / 100) * totalWidth;

            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            divider.setAttribute('data-resize-handle-state', 'active');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const newLeftWidth = startLeftWidth + deltaX;
            const newRightWidth = startRightWidth - deltaX;

            const leftPercent = (newLeftWidth / totalWidth) * 100;
            const rightPercent = (newRightWidth / totalWidth) * 100;

            const minLeft = parseFloat(divider.getAttribute('aria-valuemin')) || 15;
            const maxLeft = parseFloat(divider.getAttribute('aria-valuemax')) || 45;

            if (leftPercent >= minLeft && leftPercent <= maxLeft && rightPercent >= 20) {
                leftCol.style.flex = `${leftPercent} 1 0px`;
                leftCol.setAttribute('data-panel-size', leftPercent.toString());
                
                rightCol.style.flex = `${rightPercent} 1 0px`;
                rightCol.setAttribute('data-panel-size', rightPercent.toString());
                
                divider.setAttribute('aria-valuenow', leftPercent.toString());
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                divider.setAttribute('data-resize-handle-state', 'inactive');
                this.saveColumnWidths();
            }
        });
    },
    
    saveColumnWidths() {
        const col1 = document.getElementById('wf-col-text');
        const col2 = document.getElementById('wf-col-tools');
        
        // Find workflow column (col3) - it's the panel that's not one of our created columns
        let col3 = null;
        const mainContainer = document.getElementById('wf-three-col-layout');
        if (mainContainer) {
            const panels = Array.from(mainContainer.children).filter(child => 
                child.hasAttribute('data-panel') && 
                child.id !== 'wf-col-text' && 
                child.id !== 'wf-col-tools'
            );
            if (panels.length > 0) {
                col3 = panels[0];
            }
        }

        const col1Size = col1 ? (parseFloat(col1.style.flex) || 25) : null;
        const col2Size = col2 ? (parseFloat(col2.style.flex) || 37.5) : null;
        const col3Size = col3 ? (parseFloat(col3.style.flex) || 37.5) : null;
        if (col1Size !== null) Storage.set(this.storageKeys.col1Width, col1Size);
        if (col2Size !== null) Storage.set(this.storageKeys.col2Width, col2Size);
        if (col3Size !== null) Storage.set(this.storageKeys.col3Width, col3Size);
    }
};

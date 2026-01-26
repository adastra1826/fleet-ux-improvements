// ============= layout-manager.js =============
const plugin = {
    id: 'layoutManager',
    name: 'Three Column Layout',
    description: 'Transforms the layout into three resizable columns with integrated notes',
    _version: '2.5',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { applied: false, missingLogged: false, structureMissingLogged: false },
    
    // Plugin-specific selectors - using IDs first, with semantic fallbacks
    selectors: {
        mainContainer: 'body > div.group\\/sidebar-wrapper.flex.min-h-svh.w-full.has-\\[\\[data-variant\\=inset\\]\\]\\:bg-sidebar > main > div > div > div > div.w-full.h-full.bg-background.rounded-sm.relative.flex.flex-col.min-w-0.overflow-hidden.border-\\[0\\.5px\\].shadow-\\[0_0_15px_rgba\\(0\\,0\\,0\\,0\\.05\\)\\] > div > div.flex-1.flex.overflow-hidden.min-h-0 > div',
        leftColumn: '[id="\\:r6\\:"]',
        workflowColumn: '[id="\\:rd\\:"]'
    },
    
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

        Logger.debug(`[${this.id}] Starting layout manager mutation check`);

        const mainContainer = Context.dom.query(this.selectors.mainContainer, {
            context: `${this.id}.mainContainer`
        });
        if (!mainContainer) {
            if (!state.missingLogged) {
                Logger.warn(`[${this.id}] ❌ Main container not found for layout manager`);
                Logger.debug(`[${this.id}] Selector used: ${this.selectors.mainContainer}`);
                state.missingLogged = true;
            }
            return;
        }
        Logger.debug(`[${this.id}] ✓ Main container found`);

        if (document.getElementById('wf-three-col-layout')) {
            state.applied = true;
            Logger.debug(`[${this.id}] Three column layout already applied`);
            return;
        }

        // Try to find left column by ID first, then fallback to semantic search
        let leftColumn = Context.dom.query(this.selectors.leftColumn, {
            context: `${this.id}.leftColumn`
        });
        
        if (leftColumn) {
            Logger.debug(`[${this.id}] ✓ Left column found by ID selector: ${this.selectors.leftColumn}`);
        } else {
            Logger.debug(`[${this.id}] ⚠ Left column not found by ID, trying fallbacks...`);
        }
        
        // Fallback: Find panel with data-panel-size around 30 (left panel)
        if (!leftColumn && mainContainer) {
            const panels = Array.from(mainContainer.children).filter(child => 
                child.hasAttribute('data-panel') && child.hasAttribute('data-panel-size')
            );
            Logger.debug(`[${this.id}] Found ${panels.length} panels with data-panel-size`);
            for (const panel of panels) {
                const size = parseFloat(panel.getAttribute('data-panel-size'));
                Logger.debug(`[${this.id}] Panel size: ${size}, id: ${panel.id || 'no-id'}`);
                if (size >= 25 && size <= 35) {
                    leftColumn = panel;
                    Logger.debug(`[${this.id}] ✓ Left column found by size fallback (size: ${size})`);
                    break;
                }
            }
        }
        
        // Fallback: Find first panel in horizontal group (direct child)
        if (!leftColumn && mainContainer) {
            const firstPanel = Array.from(mainContainer.children).find(child => 
                child.hasAttribute('data-panel')
            );
            if (firstPanel) {
                leftColumn = firstPanel;
                Logger.debug(`[${this.id}] ✓ Left column found by first panel fallback`);
            }
        }
        
        if (!leftColumn) {
            Logger.warn(`[${this.id}] ❌ Left column not found after all attempts`);
            Logger.debug(`[${this.id}] Main container children: ${Array.from(mainContainer.children).map(c => `${c.tagName}#${c.id || 'no-id'}[data-panel=${c.hasAttribute('data-panel')}]`).join(', ')}`);
            if (!state.structureMissingLogged) {
                state.structureMissingLogged = true;
            }
            return;
        }
        
        const existingDivider = Context.dom.query('div[data-resize-handle]', {
            root: mainContainer,
            context: `${this.id}.existingDivider`
        });
        
        if (existingDivider) {
            Logger.debug(`[${this.id}] ✓ Existing divider found`);
        } else {
            Logger.warn(`[${this.id}] ❌ Existing divider not found`);
        }
        
        // Try to find workflow column by ID first, then fallback to semantic search
        let workflowColumn = Context.dom.query(this.selectors.workflowColumn, {
            context: `${this.id}.workflowColumn`
        });
        
        if (workflowColumn) {
            Logger.debug(`[${this.id}] ✓ Workflow column found by ID selector: ${this.selectors.workflowColumn}`);
        } else {
            Logger.debug(`[${this.id}] ⚠ Workflow column not found by ID, trying fallbacks...`);
        }
        
        // Fallback: Find panel with data-panel-size around 70 (right panel)
        if (!workflowColumn && mainContainer) {
            const panels = Array.from(mainContainer.children).filter(child => 
                child.hasAttribute('data-panel') && child.hasAttribute('data-panel-size')
            );
            for (const panel of panels) {
                const size = parseFloat(panel.getAttribute('data-panel-size'));
                if (size >= 60 && size <= 80) {
                    workflowColumn = panel;
                    Logger.debug(`[${this.id}] ✓ Workflow column found by size fallback (size: ${size})`);
                    break;
                }
            }
        }
        
        // Fallback: Find last panel in horizontal group (direct child)
        if (!workflowColumn && mainContainer) {
            const panels = Array.from(mainContainer.children).filter(child => 
                child.hasAttribute('data-panel')
            );
            if (panels.length >= 2) {
                workflowColumn = panels[panels.length - 1];
                Logger.debug(`[${this.id}] ✓ Workflow column found by last panel fallback`);
            }
        }

        if (!leftColumn || !workflowColumn || !existingDivider) {
            Logger.warn(`[${this.id}] ❌ Missing layout elements - leftColumn: ${!!leftColumn}, workflowColumn: ${!!workflowColumn}, divider: ${!!existingDivider}`);
            if (leftColumn) {
                Logger.debug(`[${this.id}] Left column ID: ${leftColumn.id}, size: ${leftColumn.getAttribute('data-panel-size')}`);
            }
            if (workflowColumn) {
                Logger.debug(`[${this.id}] Workflow column ID: ${workflowColumn.id}, size: ${workflowColumn.getAttribute('data-panel-size')}`);
            }
            if (!state.structureMissingLogged) {
                state.structureMissingLogged = true;
            }
            return;
        }

        // Find top and bottom sections within left column
        // The left column structure: :r6: > wrapper > flex-1 container > (flex-shrink-0 | flex-1 min-h-0 overflow-hidden)
        
        // First, find the inner flex container that holds both sections
        const innerFlexContainer = leftColumn.querySelector('div.flex-1.min-h-0.h-full.p-0.flex.flex-col') ||
                                   leftColumn.querySelector('div.flex-1.flex.flex-col') ||
                                   Array.from(leftColumn.querySelectorAll('div.flex.flex-col')).find(el => 
                                       el.classList.contains('flex-1') && el.classList.contains('min-h-0')
                                   );
        
        if (innerFlexContainer) {
            Logger.debug(`[${this.id}] ✓ Found inner flex container`);
        } else {
            Logger.debug(`[${this.id}] ⚠ Inner flex container not found, searching directly in left column`);
        }
        
        const searchRoot = innerFlexContainer || leftColumn;
        
        // Top section: flex-shrink-0 (contains Task/Notes tabs and Problem Description)
        const topSection = Context.dom.query('div.flex-shrink-0', {
            root: searchRoot,
            context: `${this.id}.topSection`
        });
        
        // Bottom section: flex-1 min-h-0 overflow-hidden (contains tools panel)
        // Try multiple selectors for bottom section
        let bottomSection = Context.dom.query('div.flex-1.min-h-0.overflow-hidden', {
            root: searchRoot,
            context: `${this.id}.bottomSection`
        });
        
        if (!bottomSection) {
            // Try without overflow-hidden
            bottomSection = searchRoot.querySelector('div.flex-1.min-h-0');
            if (bottomSection) {
                Logger.debug(`[${this.id}] ✓ Bottom section found with flex-1.min-h-0`);
            }
        }
        
        if (!bottomSection) {
            // Try finding by structure - look for div with flex-1 and min-h-0
            const candidates = Array.from(searchRoot.querySelectorAll('div.flex-1'));
            for (const candidate of candidates) {
                if (candidate.classList.contains('min-h-0') || candidate.classList.contains('overflow-hidden')) {
                    // Make sure it's not the top section
                    if (!candidate.classList.contains('flex-shrink-0')) {
                        bottomSection = candidate;
                        Logger.debug(`[${this.id}] ✓ Bottom section found by structure search`);
                        break;
                    }
                }
            }
        }
        
        if (!bottomSection && searchRoot) {
            // Last resort: find the second child div that's not flex-shrink-0
            const children = Array.from(searchRoot.children);
            for (const child of children) {
                if (child.tagName === 'DIV' && !child.classList.contains('flex-shrink-0') && 
                    (child.classList.contains('flex-1') || child.classList.contains('min-h-0'))) {
                    bottomSection = child;
                    Logger.debug(`[${this.id}] ✓ Bottom section found as second child`);
                    break;
                }
            }
        }

        if (!topSection) {
            Logger.warn(`[${this.id}] ❌ Top section (flex-shrink-0) not found in left column`);
            Logger.debug(`[${this.id}] Left column HTML structure: ${leftColumn.innerHTML.substring(0, 200)}...`);
        } else {
            Logger.debug(`[${this.id}] ✓ Top section found`);
        }
        
        if (!bottomSection) {
            Logger.warn(`[${this.id}] ❌ Bottom section (flex-1 min-h-0 overflow-hidden) not found in left column`);
            Logger.debug(`[${this.id}] Left column children: ${Array.from(leftColumn.children).map(c => `${c.tagName}.${Array.from(c.classList).join('.')}`).join(', ')}`);
        } else {
            Logger.debug(`[${this.id}] ✓ Bottom section found`);
        }

        if (!topSection || !bottomSection) {
            Logger.warn(`[${this.id}] ❌ Cannot proceed - missing top or bottom section`);
            if (!state.structureMissingLogged) {
                state.structureMissingLogged = true;
            }
            return;
        }

        // Get panel group ID from main container (which is the panel group itself)
        let panelGroupId = mainContainer.getAttribute('data-panel-group-id');
        if (!panelGroupId && leftColumn) {
            panelGroupId = leftColumn.getAttribute('data-panel-group-id');
        }
        if (!panelGroupId && workflowColumn) {
            panelGroupId = workflowColumn.getAttribute('data-panel-group-id');
        }
        panelGroupId = panelGroupId || ':r5:';
        Logger.debug(`[${this.id}] Using panel group ID: ${panelGroupId}`);
        
        Logger.debug(`[${this.id}] Preserving elements and clearing main container...`);
        const preservedElements = {
            leftColumn: leftColumn.parentNode.removeChild(leftColumn),
            workflowColumn: workflowColumn.parentNode.removeChild(workflowColumn),
            topSection: topSection,
            bottomSection: bottomSection
        };
        
        mainContainer.innerHTML = '';
        mainContainer.id = 'wf-three-col-layout';
        Logger.debug(`[${this.id}] Main container cleared and ID set`);

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

        Logger.debug(`[${this.id}] Setting up column resize handlers...`);
        this.setupColumnResize(divider1, col1, col2);
        this.setupColumnResize(divider2, col2, preservedElements.workflowColumn);

        state.applied = true;
        Logger.log(`[${this.id}] ✓ Three column layout applied successfully`);
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
        Logger.debug(`[${this.id}] Reorganizing first column content...`);
        const savedRatio = Storage.get(this.storageKeys.sectionSplitRatio, 60);
        
        const existingSection = Context.dom.query('div.p-3.border-b', {
            root: topSection,
            context: `${this.id}.existingSection`
        });
        if (!existingSection) {
            Logger.warn(`[${this.id}] ❌ Existing section (div.p-3.border-b) not found for reorganization`);
            Logger.debug(`[${this.id}] Top section HTML: ${topSection.innerHTML.substring(0, 300)}...`);
            return;
        }
        Logger.debug(`[${this.id}] ✓ Existing section found`);

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
        Logger.debug(`[${this.id}] ✓ First column content reorganized`);

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
                Logger.debug(`Saved section split ratio: ${topFlex.toFixed(1)}%`);
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
        const col3 = Context.dom.query(this.selectors.workflowColumn, {
            context: `${this.id}.workflowColumn`
        });

        const col1Size = col1 ? (parseFloat(col1.style.flex) || 25) : null;
        const col2Size = col2 ? (parseFloat(col2.style.flex) || 37.5) : null;
        const col3Size = col3 ? (parseFloat(col3.style.flex) || 37.5) : null;
        if (col1Size !== null) Storage.set(this.storageKeys.col1Width, col1Size);
        if (col2Size !== null) Storage.set(this.storageKeys.col2Width, col2Size);
        if (col3Size !== null) Storage.set(this.storageKeys.col3Width, col3Size);
        Logger.debug(`Saved column widths: ${col1Size ?? 'n/a'} / ${col2Size ?? 'n/a'} / ${col3Size ?? 'n/a'}`);
    }
};

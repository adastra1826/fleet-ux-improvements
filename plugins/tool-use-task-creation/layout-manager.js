// ============= layout-manager.js =============
const plugin = {
    id: 'layoutManager',
    name: 'Three Column Layout',
    description: 'Transforms the layout into three resizable columns with integrated notes',
    _version: '1.0',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { applied: false },
    
    // Plugin-specific selectors
    selectors: {
        mainContainer: 'body > div.group\\/sidebar-wrapper.flex.min-h-svh.w-full.has-\\[\\[data-variant\\=inset\\]\\]\\:bg-sidebar > main > div > div > div > div.w-full.h-full.bg-background.rounded-sm.relative.flex.flex-col.min-w-0.overflow-hidden.border-\\[0\\.5px\\].shadow-\\[0_0_15px_rgba\\(0\\,0\\,0\\,0\\.05\\)\\] > div > div.flex-1.flex.overflow-hidden.min-h-0 > div',
        leftColumn: '#\\:r7\\:',
        workflowColumn: '#\\:rb\\:'
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

        const mainContainer = document.querySelector(this.selectors.mainContainer);
        if (!mainContainer) {
            if (Logger.isVerboseEnabled()) {
                Logger.debug('layoutManager: mainContainer not found, selector:', this.selectors.mainContainer);
            }
            return;
        }

        if (document.getElementById('wf-three-col-layout')) {
            state.applied = true;
            return;
        }

        const leftColumn = document.querySelector(this.selectors.leftColumn);
        const existingDivider = mainContainer.querySelector('div[data-resize-handle]');
        const workflowColumn = document.querySelector(this.selectors.workflowColumn);

        if (!leftColumn || !workflowColumn || !existingDivider) {
            if (Logger.isVerboseEnabled()) {
                Logger.debug(`layoutManager: Missing elements - leftColumn: ${!!leftColumn}, workflowColumn: ${!!workflowColumn}, divider: ${!!existingDivider}`);
                if (!leftColumn) Logger.debug('  leftColumn selector:', this.selectors.leftColumn);
                if (!workflowColumn) Logger.debug('  workflowColumn selector:', this.selectors.workflowColumn);
            }
            return;
        }

        const topSection = leftColumn.querySelector('div.flex-shrink-0');
        const bottomSection = leftColumn.querySelector('div.flex-1.min-h-0.overflow-hidden');

        if (!topSection || !bottomSection) return;

        const panelGroupId = mainContainer.getAttribute('data-panel-group-id') || ':r6:';
        
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
        Logger.log('✓ Three column layout applied');
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
        
        const existingSection = topSection.querySelector('div.p-3.border-b');
        if (!existingSection) {
            Logger.log('⚠ Existing section not found for reorganization');
            return;
        }

        topSection.removeChild(existingSection);

        const topPanel = document.createElement('div');
        topPanel.id = 'wf-top-panel';
        topPanel.className = 'flex flex-col overflow-hidden';
        topPanel.style.flex = `${savedRatio} 1 0%`;
        topPanel.style.minHeight = '100px';
        
        existingSection.className = 'p-3 border-b flex flex-col h-full';
        
        const textareaWrapper = existingSection.querySelector('div.space-y-2.relative');
        if (textareaWrapper) {
            textareaWrapper.className = 'space-y-2 relative flex-1 flex flex-col';
            
            const relativeDiv = textareaWrapper.querySelector('div.relative');
            if (relativeDiv) {
                relativeDiv.className = 'relative flex-1 flex flex-col';
                
                const textareaContainer = relativeDiv.querySelector('div.flex.flex-col');
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
        const textarea = container.querySelector('#wf-notes-textarea');
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
        const col3 = document.querySelector(this.selectors.workflowColumn);

        if (col1) Storage.set(this.storageKeys.col1Width, parseFloat(col1.style.flex) || 25);
        if (col2) Storage.set(this.storageKeys.col2Width, parseFloat(col2.style.flex) || 37.5);
        if (col3) Storage.set(this.storageKeys.col3Width, parseFloat(col3.style.flex) || 37.5);
    }
};

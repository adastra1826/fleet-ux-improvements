// ============= expand-collapse-buttons.js =============
const plugin = {
    id: 'expandCollapseButtons',
    name: 'Expand/Collapse All',
    description: 'Adds buttons to expand or collapse all workflow tools',
    _version: '1.0',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { added: false },
    
    // Plugin-specific selectors
    selectors: {
        toolbar: '#\\:rb\\: > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center',
        toolsContainer: '#\\:rb\\: > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3',
        toolHeader: 'div.flex.items-center.gap-3.p-3.cursor-pointer.hover\\:bg-muted\\/30',
        workflowToolsIndicator: '#\\:rb\\: > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center > div:nth-child(2)'
    },
    
    onMutation(state, context) {
        const toolbar = document.querySelector(this.selectors.toolbar);
        if (!toolbar) {
            if (Logger.isVerboseEnabled()) {
                Logger.debug('expandCollapseButtons: toolbar not found, selector:', this.selectors.toolbar);
            }
            return;
        }

        const toolsIndicator = document.querySelector(this.selectors.workflowToolsIndicator);
        const hasTools = toolsIndicator && toolsIndicator.children.length > 0;

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

            toolbar.insertBefore(container, toolbar.firstChild);
            state.added = true;
            Logger.log('✓ Expand/Collapse buttons added to toolbar');
        }

        container.style.display = hasTools ? 'flex' : 'none';
    },
    
    setAllToolsState(targetState) {
        const toolsContainer = document.querySelector(this.selectors.toolsContainer);
        if (!toolsContainer) {
            Logger.log('⚠ Tools container not found for expand/collapse');
            return;
        }

        const toolHeaders = toolsContainer.querySelectorAll(this.selectors.toolHeader);
        let successCount = 0;

        toolHeaders.forEach((header) => {
            const currentState = header.getAttribute('data-state');
            if ((targetState === 'open' && currentState === 'closed') ||
                (targetState === 'closed' && currentState === 'open')) {
                header.click();
                successCount++;
            }
        });

        Logger.log(`✓ ${targetState === 'open' ? 'Expanded' : 'Collapsed'} ${successCount} tools`);
    }
};

// ============= expand-collapse-buttons.js =============
const plugin = {
    id: 'expandCollapseButtons',
    name: 'Expand/Collapse All',
    description: 'Adds buttons to expand or collapse all workflow tools',
    _version: '1.7',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { added: false, missingLogged: false },
    
    // Plugin-specific selectors
    selectors: {
        toolbar: '[id="\:re\:"] > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center',
        workflowToolsIndicator: '[id="\:re\:"] > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center > div:nth-child(2)',
        workflowToolsArea: '[id="\:re\:"] > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3',
        workflowToolHeader: 'div.flex.items-center.gap-3.p-3.cursor-pointer.hover\:bg-muted\/30'
    },
    
    onMutation(state, context) {
        const toolbar = Context.dom.query(this.selectors.toolbar, {
            context: `${this.id}.toolbar`
        });
        if (!toolbar) {
            if (!state.missingLogged) {
                Logger.debug('Toolbar not found for expand/collapse buttons');
                state.missingLogged = true;
            }
            return;
        }

        const toolsIndicator = Context.dom.query(this.selectors.workflowToolsIndicator, {
            context: `${this.id}.workflowToolsIndicator`
        });
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

            const insertBeforeTarget = toolsIndicator && toolsIndicator.parentElement === toolbar
                ? toolsIndicator.nextSibling
                : toolbar.firstChild;
            toolbar.insertBefore(container, insertBeforeTarget);
            state.added = true;
            Logger.log('✓ Expand/Collapse buttons added to toolbar');
        }

        container.style.display = hasTools ? 'flex' : 'none';
    },
    
    setAllToolsState(targetState) {
        const workflowToolsArea = Context.dom.query(this.selectors.workflowToolsArea, {
            context: `${this.id}.workflowToolsArea`
        });
        if (!workflowToolsArea) {
            Logger.log('⚠ Workflow tools area not found for expand/collapse');
            return;
        }

        const toolHeaders = Context.dom.queryAll(this.selectors.workflowToolHeader, {
            root: workflowToolsArea,
            context: `${this.id}.toolHeaders`
        });
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

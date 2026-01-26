// ============= expand-collapse-buttons.js =============
const plugin = {
    id: 'expandCollapseButtons',
    name: 'Expand/Collapse All',
    description: 'Adds buttons to expand or collapse all workflow tools',
    _version: '1.11',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { added: false, missingLogged: false },
    
    // Plugin-specific selectors
    selectors: {
        toolbar: '[id="\\:rs\\:"] > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center',
        workflowToolsIndicator: '[id="\\:rs\\:"] > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center > div',
        workflowToolsArea: '[id="\\:rs\\:"] > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3',
        workflowToolHeader: 'div.flex.items-center.gap-3.p-3.cursor-pointer.hover\\:bg-muted\\/30'
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

            // Insert at the beginning of the toolbar (before Clear button)
            toolbar.insertBefore(container, toolbar.firstChild);
            state.added = true;
            Logger.log('✓ Expand/Collapse buttons added to toolbar');
        }

        // Always check visibility - show/hide buttons based on whether the conditional container has children
        // Find the div.flex.items-center.gap-2 that conditionally has children (the one that's NOT our button container)
        const conditionalContainer = Array.from(toolbar.querySelectorAll('div.flex.items-center.gap-2')).find(
            div => div.id !== 'wf-expand-collapse-container'
        );
        const hasTools = conditionalContainer && conditionalContainer.children.length > 0;
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

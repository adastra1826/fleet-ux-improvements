// ============= panel-size-memory.js =============
// Remembers the last-used split positions for the 3 main QA Tool Use containers.
//
// Panels (from observed DOM):
// - Outer split:  [id=":re:"] (left)  <->  [id=":rh:"] (right)
// - Inner split:  [id=":rp:"] (tools) <->  [id=":rs:"] (workflow)
//
// Approach (mirrors layout-manager.js):
// 1. Apply saved sizes ONCE when panels first appear
// 2. Save sizes only when user finishes resizing (mouseup)
// 3. Never re-apply or fight React's panel library during interaction
const plugin = {
    id: 'qaPanelSizeMemory',
    name: 'QA Panel Size Memory',
    description: 'Persist and restore the main container split positions on QA Tool Use pages',
    _version: '1.3',
    enabledByDefault: true,
    phase: 'init',
    initialState: {
        installed: false,
        applied: false,
        isResizing: false
    },
    storageKeys: {
        outerLeft: 'qa-panel-outer-left',
        innerTools: 'qa-panel-inner-tools'
    },
    selectors: {
        outerLeftPanel: '[id=":re:"][data-panel]',
        outerRightPanel: '[id=":rh:"][data-panel]',
        innerToolsPanel: '[id=":rp:"][data-panel]',
        innerWorkflowPanel: '[id=":rs:"][data-panel]',
        resizeHandle: '[data-resize-handle]'
    },

    init(state, context) {
        if (state.installed) return;
        state.installed = true;

        // Track resize start - check if target or any ancestor is a resize handle
        CleanupRegistry.registerEventListener(
            document,
            'mousedown',
            (e) => {
                const target = e.target;
                // Check if target itself or an ancestor has data-resize-handle attribute
                const handle = target.closest ? target.closest('[data-resize-handle]') : null;
                if (handle) {
                    state.isResizing = true;
                    Logger.log('Panel resize started');
                }
            },
            { capture: true }
        );

        // Save sizes when resize ends
        CleanupRegistry.registerEventListener(
            document,
            'mouseup',
            () => {
                if (state.isResizing) {
                    state.isResizing = false;
                    this.saveCurrentSizes();
                    Logger.log('Panel resize ended, sizes saved');
                }
            },
            { capture: true }
        );

        // Wait for panels to appear, then apply saved sizes once
        this.waitForPanelsAndApply(state);

        Logger.log('✓ QA Panel Size Memory initialized');
    },

    waitForPanelsAndApply(state) {
        let attempts = 0;
        const maxAttempts = 50;
        const checkInterval = 100;

        const check = () => {
            attempts++;
            const panels = this.getPanels();

            if (panels.outerLeft && panels.outerRight) {
                // Panels found - apply saved sizes once
                this.applySavedSizes(panels);
                state.applied = true;
                return;
            }

            if (attempts < maxAttempts) {
                CleanupRegistry.registerTimeout(setTimeout(check, checkInterval));
            } else {
                Logger.debug('QA Panel Size Memory: panels not found after max attempts');
            }
        };

        check();
    },

    getPanels() {
        return {
            outerLeft: Context.dom.query(this.selectors.outerLeftPanel, {
                context: `${this.id}.outerLeft`
            }),
            outerRight: Context.dom.query(this.selectors.outerRightPanel, {
                context: `${this.id}.outerRight`
            }),
            innerTools: Context.dom.query(this.selectors.innerToolsPanel, {
                context: `${this.id}.innerTools`
            }),
            innerWorkflow: Context.dom.query(this.selectors.innerWorkflowPanel, {
                context: `${this.id}.innerWorkflow`
            })
        };
    },

    applySavedSizes(panels) {
        const savedOuterLeft = Storage.get(this.storageKeys.outerLeft, null);
        const savedInnerTools = Storage.get(this.storageKeys.innerTools, null);

        Logger.log(`Restoring saved sizes: outerLeft=${savedOuterLeft}, innerTools=${savedInnerTools}`);

        // Apply outer split (left panel size determines right)
        if (savedOuterLeft != null && panels.outerLeft && panels.outerRight) {
            const outerRight = 100 - savedOuterLeft;

            panels.outerLeft.style.flex = `${savedOuterLeft} 1 0px`;
            panels.outerLeft.setAttribute('data-panel-size', savedOuterLeft.toString());

            panels.outerRight.style.flex = `${outerRight} 1 0px`;
            panels.outerRight.setAttribute('data-panel-size', outerRight.toString());

            Logger.log(`✓ Applied outer split: ${savedOuterLeft} / ${outerRight}`);
        }

        // Apply inner split (tools panel size determines workflow)
        if (savedInnerTools != null && panels.innerTools && panels.innerWorkflow) {
            const innerWorkflow = 100 - savedInnerTools;

            panels.innerTools.style.flex = `${savedInnerTools} 1 0px`;
            panels.innerTools.setAttribute('data-panel-size', savedInnerTools.toString());

            panels.innerWorkflow.style.flex = `${innerWorkflow} 1 0px`;
            panels.innerWorkflow.setAttribute('data-panel-size', innerWorkflow.toString());

            Logger.log(`✓ Applied inner split: ${savedInnerTools} / ${innerWorkflow}`);
        }
    },

    saveCurrentSizes() {
        const panels = this.getPanels();
        let savedOuter = null;
        let savedInner = null;

        // Save outer left panel size
        if (panels.outerLeft) {
            const outerLeftSize = this.readPanelSize(panels.outerLeft);
            if (outerLeftSize != null) {
                Storage.set(this.storageKeys.outerLeft, outerLeftSize);
                savedOuter = outerLeftSize;
            }
        }

        // Save inner tools panel size
        if (panels.innerTools) {
            const innerToolsSize = this.readPanelSize(panels.innerTools);
            if (innerToolsSize != null) {
                Storage.set(this.storageKeys.innerTools, innerToolsSize);
                savedInner = innerToolsSize;
            }
        }

        Logger.log(`✓ Saved QA panel sizes: outerLeft=${savedOuter}, innerTools=${savedInner}`);
    },

    readPanelSize(panelEl) {
        if (!panelEl) return null;

        // Prefer data-panel-size attribute (React panel library keeps this updated)
        const attr = panelEl.getAttribute('data-panel-size');
        if (attr != null && attr !== '') {
            const parsed = parseFloat(attr);
            if (Number.isFinite(parsed)) return parsed;
        }

        // Fallback to flex style
        const flex = panelEl.style && panelEl.style.flex ? parseFloat(panelEl.style.flex) : NaN;
        return Number.isFinite(flex) ? flex : null;
    }
};

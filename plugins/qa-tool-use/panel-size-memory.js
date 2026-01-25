// ============= panel-size-memory.js =============
// Remembers the last-used split positions for the 3 main QA Tool Use containers.
//
// Panels (from observed DOM):
// - Outer split:  [id=":re:"] (left)  <->  [id=":rh:"] (right)
// - Inner split:  [id=":rp:"] (tools) <->  [id=":rs:"] (workflow)
//
// Approach:
// 1. Apply saved sizes ONCE when panels first appear
// 2. Watch panel elements for attribute changes and save (debounced)
// 3. Never re-apply after init - this avoids fighting React
const plugin = {
    id: 'qaPanelSizeMemory',
    name: 'Panel Size Memory',
    description: 'Persist and restore the main container split positions on QA Tool Use pages',
    _version: '1.6',
    enabledByDefault: true,
    phase: 'init',
    initialState: {
        installed: false,
        applied: false,
        saveTimeoutId: null
    },
    storageKeys: {
        outerLeft: 'qa-panel-outer-left',
        innerTools: 'qa-panel-inner-tools'
    },
    selectors: {
        outerLeftPanel: '[id=":re:"][data-panel]',
        outerRightPanel: '[id=":rh:"][data-panel]',
        innerToolsPanel: '[id=":rp:"][data-panel]',
        innerWorkflowPanel: '[id=":rs:"][data-panel]'
    },

    init(state, context) {
        if (state.installed) return;
        state.installed = true;

        // Wait for panels to appear, then apply saved sizes once and set up watchers
        this.waitForPanelsAndApply(state);

        Logger.log('✓ Panel Size Memory initialized');
    },

    waitForPanelsAndApply(state) {
        let attempts = 0;
        const maxAttempts = 50;
        const checkInterval = 100;

        const check = () => {
            attempts++;
            const panels = this.getPanels();

            // Need ALL panels: outer panels AND inner panels (tools/workflow)
            const hasOuter = panels.outerLeft && panels.outerRight;
            const hasInner = panels.innerTools && panels.innerWorkflow;
            
            if (hasOuter && hasInner) {
                Logger.log(`All panels found on attempt ${attempts}`);
                
                // Apply saved sizes once
                this.applySavedSizes(panels);
                state.applied = true;
                
                // Set up watchers to save when sizes change
                this.setupPanelWatchers(state, panels);
                return;
            }

            // If we have outer but not inner, keep waiting (inner panels load later)
            if (hasOuter && !hasInner && attempts < maxAttempts) {
                CleanupRegistry.registerTimeout(setTimeout(check, checkInterval));
            } else if (!hasOuter && attempts < maxAttempts) {
                CleanupRegistry.registerTimeout(setTimeout(check, checkInterval));
            } else if (attempts >= maxAttempts) {
                Logger.warn(`Panel Size Memory: missing panels after ${maxAttempts} attempts. outerLeft=${!!panels.outerLeft}, outerRight=${!!panels.outerRight}, innerTools=${!!panels.innerTools}, innerWorkflow=${!!panels.innerWorkflow}`);
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

    setupPanelWatchers(state, panels) {
        // Watch each panel for data-panel-size changes
        const watchPanel = (panel, name) => {
            if (!panel) {
                Logger.warn(`Cannot watch ${name} - panel not found`);
                return;
            }
            
            const observer = new MutationObserver(() => {
                // Debounce saves
                this.scheduleSave(state);
            });
            
            CleanupRegistry.registerObserver(observer);
            observer.observe(panel, {
                attributes: true,
                attributeFilter: ['data-panel-size']
            });
            
            Logger.log(`Watching ${name} for size changes`);
        };

        watchPanel(panels.outerLeft, 'outerLeft');
        watchPanel(panels.innerTools, 'innerTools');
        
        // Also watch innerWorkflow to catch changes there too
        if (panels.innerWorkflow) {
            watchPanel(panels.innerWorkflow, 'innerWorkflow');
        }
    },

    scheduleSave(state) {
        // Debounce: wait 500ms after last change before saving
        if (state.saveTimeoutId) {
            clearTimeout(state.saveTimeoutId);
        }
        
        state.saveTimeoutId = setTimeout(() => {
            state.saveTimeoutId = null;
            this.saveCurrentSizes();
        }, 500);
    },

    applySavedSizes(panels) {
        const savedOuterLeft = Storage.get(this.storageKeys.outerLeft, null);
        const savedInnerTools = Storage.get(this.storageKeys.innerTools, null);

        Logger.log(`Restoring: outerLeft=${savedOuterLeft}, innerTools=${savedInnerTools}`);

        // Apply outer split
        if (savedOuterLeft != null && panels.outerLeft && panels.outerRight) {
            const outerRight = 100 - savedOuterLeft;

            panels.outerLeft.style.flex = `${savedOuterLeft} 1 0px`;
            panels.outerLeft.setAttribute('data-panel-size', savedOuterLeft.toString());

            panels.outerRight.style.flex = `${outerRight} 1 0px`;
            panels.outerRight.setAttribute('data-panel-size', outerRight.toString());

            Logger.log(`✓ Applied outer: ${savedOuterLeft} / ${outerRight}`);
        }

        // Apply inner split
        if (savedInnerTools != null && panels.innerTools && panels.innerWorkflow) {
            const innerWorkflow = 100 - savedInnerTools;

            panels.innerTools.style.flex = `${savedInnerTools} 1 0px`;
            panels.innerTools.setAttribute('data-panel-size', savedInnerTools.toString());

            panels.innerWorkflow.style.flex = `${innerWorkflow} 1 0px`;
            panels.innerWorkflow.setAttribute('data-panel-size', innerWorkflow.toString());

            Logger.log(`✓ Applied inner: ${savedInnerTools} / ${innerWorkflow}`);
        }
    },

    saveCurrentSizes() {
        const panels = this.getPanels();
        
        const outerLeft = panels.outerLeft ? this.readPanelSize(panels.outerLeft) : null;
        const innerTools = panels.innerTools ? this.readPanelSize(panels.innerTools) : null;

        if (outerLeft != null) {
            Storage.set(this.storageKeys.outerLeft, outerLeft);
        }
        if (innerTools != null) {
            Storage.set(this.storageKeys.innerTools, innerTools);
        }

        Logger.log(`✓ Saved: outerLeft=${outerLeft}, innerTools=${innerTools} (panels: outerLeft=${!!panels.outerLeft}, innerTools=${!!panels.innerTools}, innerWorkflow=${!!panels.innerWorkflow})`);
    },

    readPanelSize(panelEl) {
        if (!panelEl) return null;

        const attr = panelEl.getAttribute('data-panel-size');
        if (attr != null && attr !== '') {
            const parsed = parseFloat(attr);
            if (Number.isFinite(parsed)) return parsed;
        }

        return null;
    }
};

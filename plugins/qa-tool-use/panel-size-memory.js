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
    _version: '1.7',
    enabledByDefault: true,
    phase: 'init',
    initialState: {
        installed: false,
        outerApplied: false,
        innerApplied: false,
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

            const hasOuter = panels.outerLeft && panels.outerRight;
            const hasInner = panels.innerTools && panels.innerWorkflow;
            
            // Phase 1: Apply outer split immediately when outer panels are found
            if (hasOuter && !state.outerApplied) {
                Logger.log(`Outer panels found on attempt ${attempts}`);
                this.applyOuterSplit(panels);
                this.setupPanelWatchers(state, { outerLeft: panels.outerLeft });
                state.outerApplied = true;
            }

            // Phase 2: Apply inner split when inner panels appear
            if (hasInner && !state.innerApplied) {
                Logger.log(`Inner panels found on attempt ${attempts}`);
                this.applyInnerSplit(panels);
                this.setupPanelWatchers(state, { innerTools: panels.innerTools, innerWorkflow: panels.innerWorkflow });
                state.innerApplied = true;
            }

            // Continue checking if we haven't found everything yet
            if ((!hasOuter || !state.outerApplied) || (!hasInner || !state.innerApplied)) {
                if (attempts < maxAttempts) {
                    CleanupRegistry.registerTimeout(setTimeout(check, checkInterval));
                } else {
                    Logger.warn(`Panel Size Memory: missing panels after ${maxAttempts} attempts. outerLeft=${!!panels.outerLeft}, outerRight=${!!panels.outerRight}, innerTools=${!!panels.innerTools}, innerWorkflow=${!!panels.innerWorkflow}`);
                }
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
        // Only watch panels that are provided (allows partial watching)
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

        // Watch only the panels that were provided
        if (panels.outerLeft) {
            watchPanel(panels.outerLeft, 'outerLeft');
        }
        if (panels.innerTools) {
            watchPanel(panels.innerTools, 'innerTools');
        }
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

    applyOuterSplit(panels) {
        const savedOuterLeft = Storage.get(this.storageKeys.outerLeft, null);

        if (savedOuterLeft != null && panels.outerLeft && panels.outerRight) {
            const outerRight = 100 - savedOuterLeft;

            panels.outerLeft.style.flex = `${savedOuterLeft} 1 0px`;
            panels.outerLeft.setAttribute('data-panel-size', savedOuterLeft.toString());

            panels.outerRight.style.flex = `${outerRight} 1 0px`;
            panels.outerRight.setAttribute('data-panel-size', outerRight.toString());

            Logger.log(`✓ Applied outer split: ${savedOuterLeft} / ${outerRight}`);
        } else {
            Logger.log(`No saved outer split to apply (saved=${savedOuterLeft}, panels=${!!panels.outerLeft && !!panels.outerRight})`);
        }
    },

    applyInnerSplit(panels) {
        const savedInnerTools = Storage.get(this.storageKeys.innerTools, null);

        if (savedInnerTools != null && panels.innerTools && panels.innerWorkflow) {
            const innerWorkflow = 100 - savedInnerTools;

            panels.innerTools.style.flex = `${savedInnerTools} 1 0px`;
            panels.innerTools.setAttribute('data-panel-size', savedInnerTools.toString());

            panels.innerWorkflow.style.flex = `${innerWorkflow} 1 0px`;
            panels.innerWorkflow.setAttribute('data-panel-size', innerWorkflow.toString());

            Logger.log(`✓ Applied inner split: ${savedInnerTools} / ${innerWorkflow}`);
        } else {
            Logger.log(`No saved inner split to apply (saved=${savedInnerTools}, panels=${!!panels.innerTools && !!panels.innerWorkflow})`);
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

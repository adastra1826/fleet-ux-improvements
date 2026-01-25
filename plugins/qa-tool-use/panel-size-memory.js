// ============= panel-size-memory.js =============
// Remembers the last-used split positions for the 3 main QA Tool Use containers.
//
// Panels (from observed DOM):
// - Outer split:  [id=":re:"] (left)  <->  [id=":rh:"] (right)
// - Inner split:  [id=":rp:"] (tools) <->  [id=":rs:"] (workflow)
//
// The user provided selectors (escaped for JS strings):
//   [id="\\:re\\:"], [id="\\:rh\\:"], [id="\\:rs\\:"]
// We intentionally use attribute selectors without escaping: [id=":re:"] etc.
//
// Note: This plugin only persists the split positions; it does not add UI.
const plugin = {
    id: 'qaPanelSizeMemory',
    name: 'QA Panel Size Memory',
    description: 'Persist and restore the main container split positions on QA Tool Use pages',
    _version: '1.0',
    enabledByDefault: true,
    phase: 'init',
    initialState: {
        installed: false,
        appliedAtLeastOnce: false,
        lastUserInputTs: 0,
        lastAppliedTs: 0,
        saveTimeoutId: null,
        syncQueued: false,
        panelObserversInstalled: false,
        lastSaved: { outerLeft: null, innerWorkflow: null }
    },
    storageKey: 'qa-tool-use.panel-sizes.v1',
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

        const scheduleSync = () => {
            if (state.syncQueued) return;
            state.syncQueued = true;
            requestAnimationFrame(() => {
                state.syncQueued = false;
                try {
                    this.sync(state, context);
                } catch (e) {
                    Logger.error('QA Panel Size Memory sync failed:', e);
                }
            });
        };

        // Track resize interactions so we don't fight the user's drag.
        CleanupRegistry.registerEventListener(
            document,
            'pointerdown',
            (e) => {
                const handle = Context.dom.closest(e.target, this.selectors.resizeHandle, {
                    context: `${this.id}.pointerdown.closestHandle`
                });
                if (handle) state.lastUserInputTs = Date.now();
            },
            { capture: true }
        );

        // Save after likely resize completions.
        const maybeSave = () => this.scheduleSave(state, context);
        CleanupRegistry.registerEventListener(document, 'pointerup', maybeSave, { capture: true });
        CleanupRegistry.registerEventListener(document, 'mouseup', maybeSave, { capture: true });
        CleanupRegistry.registerEventListener(
            document,
            'keyup',
            (e) => {
                // Keyboard resizing updates aria-valuenow; treat arrow keys as a "resize end" hint.
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                    maybeSave();
                }
            },
            { capture: true }
        );

        // Observe DOM remounts/attribute churn and re-apply as needed.
        const observer = new MutationObserver(() => scheduleSync());
        CleanupRegistry.registerObserver(observer);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'data-panel-size', 'data-panel-group-id', 'data-resize-handle-state']
        });

        // Kick once immediately.
        scheduleSync();

        Logger.log('✓ QA Panel Size Memory initialized');
    },

    sync(state, context) {
        const panels = this.getPanels();

        if (!panels.outerLeft || !panels.outerRight) {
            return;
        }

        // Install per-panel observers once we can see the panels.
        if (!state.panelObserversInstalled) {
            this.installPanelObservers(state, panels);
        }

        const saved = this.getSavedSizes();
        if (!saved) return;

        // Avoid overriding while the user is actively resizing.
        const now = Date.now();
        const isUserActive = (now - state.lastUserInputTs) < 1200;
        if (isUserActive) return;

        // Only (re)apply when values diverge from saved state.
        const current = this.readCurrentSizes(panels);
        const shouldApply =
            !state.appliedAtLeastOnce ||
            (saved.outerLeft != null && !this.nearlyEqual(current.outerLeft, saved.outerLeft)) ||
            (saved.innerWorkflow != null && !this.nearlyEqual(current.innerWorkflow, saved.innerWorkflow));

        if (!shouldApply) return;

        this.applySavedSizes(state, panels, saved);
        state.appliedAtLeastOnce = true;
        state.lastAppliedTs = now;
    },

    getPanels() {
        const outerLeft = Context.dom.query(this.selectors.outerLeftPanel, {
            context: `${this.id}.outerLeft`
        });
        const outerRight = Context.dom.query(this.selectors.outerRightPanel, {
            context: `${this.id}.outerRight`
        });
        const innerTools = Context.dom.query(this.selectors.innerToolsPanel, {
            context: `${this.id}.innerTools`
        });
        const innerWorkflow = Context.dom.query(this.selectors.innerWorkflowPanel, {
            context: `${this.id}.innerWorkflow`
        });

        return { outerLeft, outerRight, innerTools, innerWorkflow };
    },

    installPanelObservers(state, panels) {
        const watch = (el) => {
            if (!el) return;
            const obs = new MutationObserver(() => this.scheduleSave(state));
            CleanupRegistry.registerObserver(obs);
            obs.observe(el, {
                attributes: true,
                attributeFilter: ['style', 'data-panel-size']
            });
        };

        watch(panels.outerLeft);
        watch(panels.outerRight);
        watch(panels.innerTools);
        watch(panels.innerWorkflow);

        state.panelObserversInstalled = true;
    },

    scheduleSave(state, context) {
        // Don't immediately save the sizes we just applied.
        if (Date.now() - state.lastAppliedTs < 300) return;

        if (state.saveTimeoutId) {
            clearTimeout(state.saveTimeoutId);
        }

        state.saveTimeoutId = CleanupRegistry.registerTimeout(
            setTimeout(() => {
                state.saveTimeoutId = null;
                try {
                    this.saveCurrentSizes(state);
                } catch (e) {
                    Logger.error('QA Panel Size Memory save failed:', e);
                }
            }, 250)
        );
    },

    saveCurrentSizes(state) {
        const panels = this.getPanels();
        if (!panels.outerLeft || !panels.outerRight) return;

        const current = this.readCurrentSizes(panels);
        if (current.outerLeft == null && current.innerWorkflow == null) return;

        // Avoid redundant writes.
        const sameAsLast =
            this.nearlyEqual(state.lastSaved.outerLeft, current.outerLeft) &&
            this.nearlyEqual(state.lastSaved.innerWorkflow, current.innerWorkflow);
        if (sameAsLast) return;

        Storage.set(this.storageKey, {
            outerLeft: current.outerLeft,
            innerWorkflow: current.innerWorkflow,
            updatedAt: Date.now()
        });

        state.lastSaved = { outerLeft: current.outerLeft, innerWorkflow: current.innerWorkflow };
        Logger.debug(
            `Saved QA panel sizes: outerLeft=${current.outerLeft ?? 'n/a'}, innerWorkflow=${current.innerWorkflow ?? 'n/a'}`
        );
    },

    getSavedSizes() {
        const raw = Storage.get(this.storageKey, null);
        if (!raw) return null;

        // Tampermonkey can store objects directly, but guard against older string storage.
        if (typeof raw === 'string') {
            try {
                return JSON.parse(raw);
            } catch (e) {
                return null;
            }
        }

        return raw;
    },

    readCurrentSizes(panels) {
        const outerLeft = this.readPanelSize(panels.outerLeft);
        const innerWorkflow = panels.innerWorkflow
            ? this.readPanelSize(panels.innerWorkflow)
            : (panels.innerTools ? (100 - this.readPanelSize(panels.innerTools)) : null);

        return {
            outerLeft: this.isValidNumber(outerLeft) ? outerLeft : null,
            innerWorkflow: this.isValidNumber(innerWorkflow) ? innerWorkflow : null
        };
    },

    applySavedSizes(state, panels, saved) {
        // Outer split (constraints from aria attributes typically 10..50 for the left panel)
        if (this.isValidNumber(saved.outerLeft)) {
            const left = this.clamp(saved.outerLeft, 10, 50);
            const right = this.clamp(100 - left, 50, 90);
            this.applyPanelSize(panels.outerLeft, left);
            this.applyPanelSize(panels.outerRight, right);
        }

        // Inner split: workflow is usually the right panel; tools left is the complement.
        if (this.isValidNumber(saved.innerWorkflow)) {
            const workflow = this.clamp(saved.innerWorkflow, 55, 85);
            const tools = this.clamp(100 - workflow, 15, 45);
            if (panels.innerTools) this.applyPanelSize(panels.innerTools, tools);
            if (panels.innerWorkflow) this.applyPanelSize(panels.innerWorkflow, workflow);
        }
    },

    readPanelSize(panelEl) {
        if (!panelEl) return null;
        const attr = panelEl.getAttribute('data-panel-size');
        if (attr != null && attr !== '') return parseFloat(attr);

        const flex = panelEl.style && panelEl.style.flex ? parseFloat(panelEl.style.flex) : NaN;
        return Number.isFinite(flex) ? flex : null;
    },

    applyPanelSize(panelEl, size) {
        if (!panelEl) return;
        const normalized = this.round(size, 1);
        panelEl.style.flex = `${normalized} 1 0px`;
        panelEl.setAttribute('data-panel-size', normalized.toString());
    },

    nearlyEqual(a, b, epsilon = 0.2) {
        if (!this.isValidNumber(a) || !this.isValidNumber(b)) return false;
        return Math.abs(a - b) <= epsilon;
    },

    isValidNumber(n) {
        return typeof n === 'number' && Number.isFinite(n);
    },

    clamp(n, min, max) {
        if (!this.isValidNumber(n)) return min;
        return Math.min(max, Math.max(min, n));
    },

    round(n, decimals = 1) {
        if (!this.isValidNumber(n)) return n;
        const p = Math.pow(10, decimals);
        return Math.round(n * p) / p;
    }
};


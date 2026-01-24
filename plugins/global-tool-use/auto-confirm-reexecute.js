// ============= auto-confirm-reexecute.js =============
const plugin = {
    id: 'autoConfirmReexecute',
    name: 'Auto-Confirm Re-execute',
    description: 'Automatically confirms re-execute dialogs',
    _version: '1.3',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: {
        missingConfirmLogged: false,
        lastConfirmAt: 0,
        confirmTimer: null
    },
    
    onMutation(state, context) {
        const dialog = Context.dom.query('div[role="alertdialog"][data-state="open"]', {
            context: `${this.id}.dialog`
        });
        if (!dialog) {
            if (state.confirmTimer) {
                clearTimeout(state.confirmTimer);
                state.confirmTimer = null;
            }
            return;
        }
        
        const heading = Context.dom.query('h2', {
            root: dialog,
            context: `${this.id}.heading`
        });
        if (!heading || !heading.textContent.includes('Re-execute this step')) return;
        
        const buttons = Context.dom.queryAll('button', {
            root: dialog,
            context: `${this.id}.buttons`
        });
        let confirmBtn = null;
        
        buttons.forEach(btn => {
            const btnText = btn.textContent.trim();
            if (btnText.includes('Re-execute') && btnText.includes('Invalidate')) {
                confirmBtn = btn;
            }
        });
        
        if (!confirmBtn) {
            if (!state.missingConfirmLogged) {
                Logger.warn('Re-execute dialog detected but confirm button missing');
                state.missingConfirmLogged = true;
            }
            return;
        }

        if (state.confirmTimer) return;
        const now = Date.now();
        if (now - state.lastConfirmAt < 500) return;

        state.confirmTimer = setTimeout(() => {
            state.confirmTimer = null;
            const activeDialog = Context.dom.query('div[role="alertdialog"][data-state="open"]', {
                context: `${this.id}.dialogConfirm`
            });
            if (!activeDialog) return;

            const activeHeading = Context.dom.query('h2', {
                root: activeDialog,
                context: `${this.id}.headingConfirm`
            });
            if (!activeHeading || !activeHeading.textContent.includes('Re-execute this step')) return;

            const confirmButtons = Context.dom.queryAll('button', {
                root: activeDialog,
                context: `${this.id}.buttonsConfirm`
            });
            let activeConfirmBtn = null;
            confirmButtons.forEach(btn => {
                const btnText = btn.textContent.trim();
                if (btnText.includes('Re-execute') && btnText.includes('Invalidate')) {
                    activeConfirmBtn = btn;
                }
            });
            if (!activeConfirmBtn) return;

            Logger.log('Auto-confirming re-execute dialog');
            state.lastConfirmAt = Date.now();
            activeConfirmBtn.click();
        }, 150);
    }
};

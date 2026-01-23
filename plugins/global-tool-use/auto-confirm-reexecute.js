// ============= auto-confirm-reexecute.js =============
const plugin = {
    id: 'autoConfirmReexecute',
    name: 'Auto-Confirm Re-execute',
    description: 'Automatically confirms re-execute dialogs',
    _version: '1.0',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: {},
    
    onMutation(state, context) {
        const dialog = document.querySelector('div[role="alertdialog"][data-state="open"]');
        if (!dialog) return;
        
        const heading = dialog.querySelector('h2');
        if (!heading || !heading.textContent.includes('Re-execute this step')) return;
        
        const buttons = dialog.querySelectorAll('button');
        let confirmBtn = null;
        
        buttons.forEach(btn => {
            const btnText = btn.textContent.trim();
            if (btnText.includes('Re-execute') && btnText.includes('Invalidate')) {
                confirmBtn = btn;
            }
        });
        
        if (confirmBtn) {
            Logger.log('Auto-confirming re-execute dialog');
            confirmBtn.click();
        }
    }
};

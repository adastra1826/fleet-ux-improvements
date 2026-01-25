// ============= request-revisions.js =============
// Improvements to the Request Revisions Workflow

const plugin = {
    id: 'requestRevisions',
    name: 'Request Revisions Improvements',
    description: 'Improvements to the Request Revisions Workflow',
    _version: '1.0',
    enabledByDefault: true,
    phase: 'mutation',
    
    // ========== SUB-OPTIONS ==========
    subOptions: [
        {
            id: 'auto-copy-workflow',
            name: 'Auto-copy workflow to "What did you try?"',
            description: 'Automatically copies workflow steps to the "What did you try?" field when the modal opens',
            enabledByDefault: true
        }
    ],
    
    initialState: {
        processedModals: new Set(),
        missingLogged: false
    },
    
    onMutation(state, context) {
        // Ensure processedModals Set exists
        if (!state.processedModals || !(state.processedModals instanceof Set)) {
            state.processedModals = new Set();
        }
        
        // Look for the Request Revisions modal
        const dialogs = Context.dom.queryAll('div[role="dialog"][data-state="open"]', {
            context: `${this.id}.dialogs`
        });
        
        if (dialogs.length === 0) {
            // Reset processed set when no dialogs are open
            if (state.processedModals.size > 0) {
                state.processedModals.clear();
            }
            return;
        }
        
        // Find the Request Revisions modal by checking for the heading
        let requestRevisionsModal = null;
        for (const dialog of dialogs) {
            const heading = Context.dom.query('h2', {
                root: dialog,
                context: `${this.id}.heading`
            });
            if (heading && heading.textContent.includes('Request Revisions')) {
                requestRevisionsModal = dialog;
                break;
            }
        }
        
        if (!requestRevisionsModal) {
            if (!state.missingLogged) {
                Logger.debug('Request Revisions modal not found');
                state.missingLogged = true;
            }
            return;
        }
        
        // Reset missing log once modal is found
        state.missingLogged = false;
        
        // Get modal ID to track if we've already processed it
        const modalId = requestRevisionsModal.id;
        if (state.processedModals.has(modalId)) {
            return; // Already processed this modal instance
        }
        
        // Check if auto-copy-workflow sub-option is enabled
        const autoCopyEnabled = Storage.getSubOptionEnabled(this.id, 'auto-copy-workflow', true);
        if (!autoCopyEnabled) {
            return;
        }
        
        // Find the "Copy Workflow" button
        const copyWorkflowButton = this.findCopyWorkflowButton(requestRevisionsModal);
        if (!copyWorkflowButton) {
            // Button doesn't exist (no workflow steps), which is fine
            return;
        }
        
        // Find the "What did you try?" textarea
        const attemptedActionsTextarea = this.findAttemptedActionsTextarea(requestRevisionsModal);
        if (!attemptedActionsTextarea) {
            Logger.warn('Copy Workflow button found but "What did you try?" textarea not found');
            return;
        }
        
        // Mark this modal as processed
        state.processedModals.add(modalId);
        
        // Click the button and paste into textarea
        this.handleAutoCopy(copyWorkflowButton, attemptedActionsTextarea);
    },
    
    findCopyWorkflowButton(modal) {
        // Find button that contains "Copy Workflow" text
        const buttons = Context.dom.queryAll('button', {
            root: modal,
            context: `${this.id}.buttons`
        });
        
        for (const button of buttons) {
            const buttonText = button.textContent.trim();
            if (buttonText.includes('Copy Workflow')) {
                return button;
            }
        }
        return null;
    },
    
    findAttemptedActionsTextarea(modal) {
        // Find textarea with id starting with "attempted-actions-"
        const textareas = Context.dom.queryAll('textarea', {
            root: modal,
            context: `${this.id}.textareas`
        });
        
        for (const textarea of textareas) {
            if (textarea.id && textarea.id.startsWith('attempted-actions-')) {
                return textarea;
            }
        }
        return null;
    },
    
    async handleAutoCopy(copyButton, textarea) {
        try {
            Logger.log('Auto-copying workflow to "What did you try?" field');
            
            // Click the copy button
            copyButton.click();
            
            // Wait a bit for clipboard to be populated
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Read from clipboard
            let clipboardText = '';
            try {
                if (navigator.clipboard && navigator.clipboard.readText) {
                    clipboardText = await navigator.clipboard.readText();
                } else {
                    Logger.warn('Clipboard API not available, cannot auto-paste');
                    return;
                }
            } catch (clipboardError) {
                Logger.warn('Failed to read from clipboard:', clipboardError);
                return;
            }
            
            if (!clipboardText) {
                Logger.warn('Clipboard is empty after clicking Copy Workflow');
                return;
            }
            
            // Set the textarea value
            textarea.value = clipboardText;
            
            // Trigger input event so React/other frameworks detect the change
            const inputEvent = new Event('input', { bubbles: true });
            textarea.dispatchEvent(inputEvent);
            
            // Also trigger change event
            const changeEvent = new Event('change', { bubbles: true });
            textarea.dispatchEvent(changeEvent);
            
            Logger.log('✓ Workflow copied to "What did you try?" field');
        } catch (error) {
            Logger.error('Error during auto-copy:', error);
        }
    }
};

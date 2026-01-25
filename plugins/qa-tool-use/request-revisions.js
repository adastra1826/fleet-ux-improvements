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
        missingLogged: false,
        textareaWatchers: new Map() // Map of textarea ID -> { desiredValue, observer, interval }
    },
    
    onMutation(state, context) {
        // Ensure processedModals Set exists
        if (!state.processedModals || !(state.processedModals instanceof Set)) {
            state.processedModals = new Set();
        }
        
        // Ensure textareaWatchers Map exists
        if (!state.textareaWatchers || !(state.textareaWatchers instanceof Map)) {
            state.textareaWatchers = new Map();
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
            // Clean up watchers when modal closes
            this.cleanupWatchers(state, context);
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
        this.handleAutoCopy(state, copyWorkflowButton, attemptedActionsTextarea);
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
    
    async handleAutoCopy(state, copyButton, textarea) {
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
            
            // Apply the value using React-compatible method
            this.applyTextareaValue(textarea, clipboardText);
            
            // Set up a watcher to re-apply the value if React resets it
            this.setupTextareaWatcher(state, textarea, clipboardText);
            
            Logger.log('✓ Workflow copied to "What did you try?" field');
        } catch (error) {
            Logger.error('Error during auto-copy:', error);
        }
    },
    
    applyTextareaValue(textarea, value) {
        // Use native value setter
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
        )?.set;
        
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(textarea, value);
        } else {
            textarea.value = value;
        }
        
        // Create and dispatch InputEvent (more React-compatible than Event)
        const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: value
        });
        textarea.dispatchEvent(inputEvent);
        
        // Also trigger change event
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        textarea.dispatchEvent(changeEvent);
    },
    
    setupTextareaWatcher(state, textarea, desiredValue) {
        const textareaId = textarea.id;
        if (!textareaId) return;
        
        // Clean up existing watcher for this textarea if any
        this.cleanupWatcherForTextarea(state, textareaId);
        
        // Set up interval to check and re-apply value if it gets reset
        const interval = setInterval(() => {
            // Check if textarea still exists
            if (!document.contains(textarea)) {
                this.cleanupWatcherForTextarea(state, textareaId);
                return;
            }
            
            // If value was reset (empty or different), re-apply
            if (textarea.value !== desiredValue) {
                this.applyTextareaValue(textarea, desiredValue);
            }
        }, 100); // Check every 100ms
        
        // Store watcher info
        state.textareaWatchers.set(textareaId, {
            desiredValue,
            interval,
            textarea
        });
        
        // Clean up after 30 seconds (modal should be submitted by then)
        setTimeout(() => {
            this.cleanupWatcherForTextarea(state, textareaId);
        }, 30000);
    },
    
    cleanupWatcherForTextarea(state, textareaId) {
        const watcher = state.textareaWatchers.get(textareaId);
        if (watcher) {
            if (watcher.interval) {
                clearInterval(watcher.interval);
            }
            state.textareaWatchers.delete(textareaId);
        }
    },
    
    cleanupWatchers(state, context) {
        // Clean up all watchers
        if (state.textareaWatchers && state.textareaWatchers instanceof Map) {
            for (const [textareaId, watcher] of state.textareaWatchers.entries()) {
                if (watcher.interval) {
                    clearInterval(watcher.interval);
                }
            }
            state.textareaWatchers.clear();
        }
    }
};

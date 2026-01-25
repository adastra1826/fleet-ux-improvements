// ============= request-revisions.js =============
// Improvements to the Request Revisions Workflow

const plugin = {
    id: 'requestRevisions',
    name: 'Request Revisions Improvements',
    description: 'Improvements to the Request Revisions Workflow',
    _version: '2.3',
    enabledByDefault: true,
    phase: 'mutation',
    
    // ========== SUB-OPTIONS ==========
    subOptions: [
        {
            id: 'auto-copy-workflow',
            name: 'Auto-copy workflow to "What did you try?"',
            description: 'Automatically copies workflow steps to the "What did you try?" field when the modal opens',
            enabledByDefault: true
        },
        {
            id: 'auto-paste-prompt-to-task',
            name: 'Auto-paste prompt to Task issue',
            description: 'Saves the prompt text on page load and automatically pastes it into the Task issue box when Task is selected',
            enabledByDefault: true
        }
    ],
    
    initialState: {
        processedModals: new Set(),
        missingLogged: false,
        promptText: null,
        promptSaved: false,
        taskObservers: new Map() // Map of modalId -> { observer, taskButton }
    },
    
    onMutation(state, context) {
        // Ensure processedModals Set exists
        if (!state.processedModals || !(state.processedModals instanceof Set)) {
            state.processedModals = new Set();
        }
        
        // Ensure taskObservers Map exists
        if (!state.taskObservers || !(state.taskObservers instanceof Map)) {
            state.taskObservers = new Map();
        }
        
        // Save prompt text if not already saved and the feature is enabled
        const autoPastePromptEnabled = Storage.getSubOptionEnabled(this.id, 'auto-paste-prompt-to-task', true);
        if (autoPastePromptEnabled && !state.promptSaved) {
            this.savePromptText(state);
        }
        
        // Look for the Request Revisions modal
        const dialogs = Context.dom.queryAll('div[role="dialog"][data-state="open"]', {
            context: `${this.id}.dialogs`
        });
        
        if (dialogs.length === 0) {
            // Clean up observers when no dialogs are open
            this.cleanupTaskObservers(state);
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
        
        // Handle workflow copy (only once per modal)
        if (!state.processedModals.has(modalId)) {
            const autoCopyEnabled = Storage.getSubOptionEnabled(this.id, 'auto-copy-workflow', true);
            if (autoCopyEnabled) {
                // Find the "Copy Workflow" button
                const copyWorkflowButton = this.findCopyWorkflowButton(requestRevisionsModal);
                if (copyWorkflowButton) {
                    // Find the "What did you try?" textarea
                    const attemptedActionsTextarea = this.findAttemptedActionsTextarea(requestRevisionsModal);
                    if (attemptedActionsTextarea) {
                        // Mark this modal as processed for workflow copy
                        state.processedModals.add(modalId);
                        
                        // Click the button and paste into textarea
                        this.handleAutoCopy(state, copyWorkflowButton, attemptedActionsTextarea);
                    }
                }
            } else {
                // Mark as processed even if feature is disabled, to avoid repeated checks
                state.processedModals.add(modalId);
            }
        }
        
        // Set up Task button observer if not already set up and feature is enabled
        if (autoPastePromptEnabled && state.promptText && !state.taskObservers.has(modalId)) {
            this.setupTaskButtonObserver(state, requestRevisionsModal, modalId);
        }
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
            
            Logger.log('✓ Workflow copied to "What did you try?" field');
        } catch (error) {
            Logger.error('Error during auto-copy:', error);
        }
    },
    
    applyTextareaValue(textarea, value) {
        // Try to find React's onChange handler and call it directly
        // This is the proper way to work with React controlled components
        const reactFiber = this.getReactFiber(textarea);
        if (reactFiber) {
            const props = reactFiber.memoizedProps || reactFiber.pendingProps;
            if (props && props.onChange) {
                // Create a synthetic event object that React expects
                const syntheticEvent = {
                    target: textarea,
                    currentTarget: textarea,
                    bubbles: true,
                    cancelable: true,
                    defaultPrevented: false,
                    eventPhase: 2, // AT_TARGET
                    isTrusted: false,
                    nativeEvent: new Event('input', { bubbles: true }),
                    preventDefault: () => {},
                    stopPropagation: () => {},
                    timeStamp: Date.now(),
                    type: 'change'
                };
                
                // Set the value using native setter first
                const nativeValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype,
                    'value'
                )?.set;
                
                if (nativeValueSetter) {
                    nativeValueSetter.call(textarea, value);
                } else {
                    textarea.value = value;
                }
                
                // Call React's onChange handler directly
                try {
                    props.onChange(syntheticEvent);
                    Logger.debug('Called React onChange handler directly');
                    return;
                } catch (error) {
                    Logger.warn('Error calling React onChange:', error);
                    // Fall through to event dispatch method
                }
            }
        }
        
        // Fallback: Use native value setter and dispatch events
        // This should work for most React versions
        const nativeValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value'
        )?.set;
        
        if (nativeValueSetter) {
            nativeValueSetter.call(textarea, value);
        } else {
            textarea.value = value;
        }
        
        // Focus the textarea first (React sometimes needs this)
        textarea.focus();
        
        // Dispatch input event (React listens to this)
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        textarea.dispatchEvent(inputEvent);
        
        // Also dispatch change event
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        textarea.dispatchEvent(changeEvent);
        
        // Blur and refocus to ensure React processes the change
        textarea.blur();
        textarea.focus();
    },
    
    savePromptText(state) {
        // Find the prompt text element
        const promptElement = Context.dom.query('[id="\\:re\\:"] > div > div.flex-1.flex.flex-col.min-h-0.w-full.h-full.p-3 > div > div > div:nth-child(2) > div.text-sm.whitespace-pre-wrap', {
            context: `${this.id}.promptElement`
        });
        
        if (promptElement) {
            state.promptText = promptElement.textContent.trim();
            state.promptSaved = true;
            Logger.log(`✓ Prompt text saved (${state.promptText.length} chars)`);
        }
    },
    
    setupTaskButtonObserver(state, modal, modalId) {
        // Find the Task button
        const taskButton = this.findTaskIssueButton(modal);
        if (!taskButton) {
            Logger.debug('Task button not found, will retry on next mutation');
            return;
        }
        
        // Check if already processed (button is already clicked)
        if (this.isTaskButtonSelected(taskButton)) {
            // Button is already selected, wait a bit for textarea to appear, then paste
            setTimeout(() => {
                this.handleTaskIssuePaste(state, modal, modalId);
            }, 100);
            // Mark as having observer (even though we won't set one up) to prevent retries
            state.taskObservers.set(modalId, { observer: null, taskButton });
            return;
        }
        
        // Set up MutationObserver to watch for class changes on the Task button
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (this.isTaskButtonSelected(taskButton)) {
                        // Task button was clicked, wait a bit for textarea to appear, then paste
                        setTimeout(() => {
                            this.handleTaskIssuePaste(state, modal, modalId);
                        }, 100);
                        // Disconnect observer after detecting click
                        observer.disconnect();
                        state.taskObservers.delete(modalId);
                        break;
                    }
                }
            }
        });
        
        // Observe class attribute changes on the Task button
        observer.observe(taskButton, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        // Store observer info
        state.taskObservers.set(modalId, { observer, taskButton });
        
        Logger.debug('Task button observer set up');
    },
    
    isTaskButtonSelected(button) {
        // Check if button has the selected state classes
        return button.classList.contains('border-brand') || 
               button.classList.contains('bg-brand') ||
               button.querySelector('.border-brand') !== null ||
               button.querySelector('.bg-brand') !== null;
    },
    
    findTaskIssueButton(modal) {
        // Find button with "Task" text in the issues section
        const buttons = Context.dom.queryAll('button', {
            root: modal,
            context: `${this.id}.issueButtons`
        });
        
        for (const button of buttons) {
            const buttonText = button.textContent.trim();
            if (buttonText === 'Task') {
                // Verify it's in the issues section
                const parent = button.closest('div');
                if (parent) {
                    const parentText = parent.textContent || '';
                    if (parentText.includes('Where are the issues')) {
                        return button;
                    }
                }
            }
        }
        return null;
    },
    
    handleTaskIssuePaste(state, modal, modalId) {
        // Find the Task feedback textarea - it only exists when Task is selected
        const taskFeedbackTextarea = Context.dom.query('textarea#feedback-Task', {
            root: modal,
            context: `${this.id}.taskFeedbackTextarea`
        });
        
        if (!taskFeedbackTextarea) {
            Logger.debug('Task feedback textarea not found yet, waiting...');
            return; // Textarea doesn't exist yet (might appear slightly after button click)
        }
        
        // Check if textarea already has content (trim to handle whitespace-only content)
        const currentValue = taskFeedbackTextarea.value ? taskFeedbackTextarea.value.trim() : '';
        if (currentValue.length > 0) {
            Logger.debug(`Task issue textarea already has content (${currentValue.length} chars), skipping paste`);
            return; // Don't overwrite existing content
        }
        
        if (!state.promptText) {
            Logger.warn('Prompt text not available for pasting');
            return;
        }
        
        // Format the prompt text
        const formattedPrompt = `---\n${state.promptText}\n---`;
        
        Logger.log(`Pasting prompt text to Task issue box (${formattedPrompt.length} chars)`);
        
        // Apply the value using the same method that worked for workflow copy
        this.applyTextareaValue(taskFeedbackTextarea, formattedPrompt);
        
        Logger.log('✓ Prompt text pasted to Task issue box');
    },
    
    cleanupTaskObservers(state) {
        // Clean up all Task button observers
        for (const [modalId, observerInfo] of state.taskObservers.entries()) {
            if (observerInfo.observer) {
                observerInfo.observer.disconnect();
            }
        }
        state.taskObservers.clear();
    },
    
    getReactFiber(element) {
        // Try different React internal property names
        // React 16+: __reactInternalInstance or __reactFiber
        // React 17+: __reactFiber$<random>
        // React 18+: __reactFiber$<random> or __reactInternalInstance$<random>
        const keys = Object.keys(element);
        for (const key of keys) {
            if (key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')) {
                return element[key];
            }
        }
        
        // Also check for React 18's alternate fiber
        for (const key of keys) {
            if (key.includes('reactFiber') || key.includes('reactInternalInstance')) {
                const fiber = element[key];
                if (fiber && (fiber.memoizedProps || fiber.pendingProps)) {
                    return fiber;
                }
            }
        }
        
        return null;
    }
};

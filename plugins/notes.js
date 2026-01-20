// ============= notes.js =============
// Another self-contained plugin

const plugin = {
    id: 'notes',
    name: 'Workflow Notes',
    description: 'Add a persistent notes section to the workflow builder',
    enabledByDefault: true,
    phase: 'init',
    initialState: {},
    
    // Plugin-specific selectors
    selectors: {
        leftColumn: '#\\:r7\\:',
        promptSectionParent: '#\\:r7\\: > div.flex-shrink-0 > div.p-3.border-b'
    },
    
    // Plugin-specific storage keys
    storageKeys: {
        notes: 'notes',
        notesHeight: 'notes-height'
    },
    
    init(state, context) {
        // Wait for the left column to exist
        const waitForColumn = setInterval(() => {
            const leftColumn = document.querySelector(this.selectors.leftColumn);
            if (leftColumn) {
                clearInterval(waitForColumn);
                this.createNotesSection(leftColumn);
            }
        }, 100);
    },
    
    createNotesSection(leftColumn) {
        const promptSection = document.querySelector(this.selectors.promptSectionParent);
        if (!promptSection) {
            Logger.warn('Could not find prompt section parent');
            return;
        }
        
        // Create notes container
        const notesContainer = document.createElement('div');
        notesContainer.className = 'p-3 border-b';
        notesContainer.innerHTML = `
            <div class="space-y-2">
                <label class="text-sm font-medium">Notes</label>
                <textarea 
                    id="wf-notes-textarea"
                    class="w-full min-h-[100px] p-2 text-sm border rounded-md resize-y"
                    placeholder="Add your workflow notes here..."
                    style="height: ${Storage.get(this.storageKeys.notesHeight, '150px')}"
                >${Storage.get(this.storageKeys.notes, '')}</textarea>
            </div>
        `;
        
        // Insert after prompt section
        promptSection.parentNode.insertBefore(notesContainer, promptSection.nextSibling);
        
        // Set up auto-save
        const textarea = document.getElementById('wf-notes-textarea');
        if (textarea) {
            // Save notes on change
            textarea.addEventListener('input', () => {
                Storage.set(this.storageKeys.notes, textarea.value);
            });
            
            // Save height on resize
            const resizeObserver = new ResizeObserver(() => {
                Storage.set(this.storageKeys.notesHeight, textarea.style.height);
            });
            resizeObserver.observe(textarea);
            
            Logger.log('✓ Notes section created');
        }
    }
};
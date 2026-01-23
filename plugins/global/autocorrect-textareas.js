// ============= autocorrect-textareas.js =============
const plugin = {
    id: 'autocorrectTextareas',
    name: 'Disable Textarea Autocorrect',
    description: 'Disables autocorrect on prompt editor and notes',
    _version: '1.0',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { promptEditor: false, notesTextarea: false },
    
    onMutation(state, context) {
        if (!state.promptEditor) {
            const promptEditor = document.getElementById('prompt-editor');
            if (promptEditor) {
                promptEditor.setAttribute('autocomplete', 'off');
                promptEditor.setAttribute('autocorrect', 'off');
                promptEditor.setAttribute('autocapitalize', 'off');
                promptEditor.setAttribute('spellcheck', 'false');
                state.promptEditor = true;
                Logger.log('✓ Autocorrect disabled on prompt editor');
            }
        }

        if (!state.notesTextarea) {
            const notesTextarea = document.getElementById('wf-notes-textarea');
            if (notesTextarea) {
                notesTextarea.setAttribute('autocomplete', 'off');
                notesTextarea.setAttribute('autocorrect', 'off');
                notesTextarea.setAttribute('autocapitalize', 'off');
                notesTextarea.setAttribute('spellcheck', 'false');
                state.notesTextarea = true;
                Logger.log('✓ Autocorrect disabled on notes textarea');
            }
        }
    }
};
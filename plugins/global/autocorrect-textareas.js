// ============= autocorrect-textareas.js =============
const plugin = {
    id: 'autocorrectTextareas',
    name: 'Disable Prompt Text Area Autocorrect',
    description: 'Disables autocorrect on the prompt editor',
    _version: '1.2',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: {
        promptEditor: false,
        promptMissingLogged: false
    },
    
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
            } else if (!state.promptMissingLogged) {
                Logger.debug('Prompt editor not found for autocorrect disable');
                state.promptMissingLogged = true;
            }
        }
    }
};
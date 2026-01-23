// ============= autocorrect-search.js =============
const plugin = {
    id: 'autocorrectSearch',
    name: 'Disable Search Autocorrect',
    description: 'Disables autocorrect/autocomplete on the search input',
    _version: '1.0',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { applied: false },
    
    onMutation(state, context) {
        if (state.applied) return;

        const searchInput = document.querySelector('input[placeholder="Search tools, descriptions, parameters..."]');
        if (searchInput) {
            searchInput.setAttribute('autocomplete', 'off');
            searchInput.setAttribute('autocorrect', 'off');
            searchInput.setAttribute('autocapitalize', 'off');
            searchInput.setAttribute('spellcheck', 'false');
            searchInput.setAttribute('data-form-type', 'other');
            searchInput.setAttribute('data-lpignore', 'true');
            searchInput.setAttribute('data-1p-ignore', 'true');
            state.applied = true;
            Logger.log('✓ Autocorrect disabled on search input');
        }
    }
};
// ============= autocorrect-search.js =============
const plugin = {
    id: 'autocorrectSearch',
    name: 'Disable Search Autocorrect',
    description: 'Disables autocorrect/autocomplete on the search input',
    _version: '1.2',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { applied: false, missingLogged: false },
    
    onMutation(state, context) {
        if (state.applied) return;

        const searchInput = Context.dom.query('input[placeholder="Search tools, descriptions, parameters..."]', {
            context: `${this.id}.searchInput`
        });
        if (!searchInput) {
            if (!state.missingLogged) {
                Logger.debug('Search input not found for autocorrect disable');
                state.missingLogged = true;
            }
            return;
        }

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
};
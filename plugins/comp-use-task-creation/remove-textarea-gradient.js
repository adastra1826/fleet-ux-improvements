
// ============= remove-textarea-gradient.js =============
const plugin = {
    id: 'removeTextareaGradient',
    name: 'Remove Textarea Gradient',
    description: 'Removes the gradient fade overlay from the prompt textarea',
    _version: '1.2',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { removed: false, missingLogged: false, overlayMissingLogged: false },
    
    // Plugin-specific selectors
    selectors: {
        promptTextareaContainer: '#\\:r7\\: > div.flex-shrink-0 > div > div.space-y-2.relative > div.relative > div'
    },
    
    onMutation(state, context) {
        if (state.removed) return;

        const container = Context.dom.query(this.selectors.promptTextareaContainer, {
            context: `${this.id}.promptTextareaContainer`
        });
        if (!container) {
            if (!state.missingLogged) {
                Logger.debug('Prompt textarea container not found for gradient removal');
                state.missingLogged = true;
            }
            return;
        }

        const gradientOverlay = Context.dom.query('div.bg-gradient-to-b', {
            root: container,
            context: `${this.id}.gradientOverlay`
        });
        if (gradientOverlay) {
            gradientOverlay.style.background = 'none';
            gradientOverlay.style.pointerEvents = 'none';
            state.removed = true;
            Logger.log('✓ Textarea gradient fade removed');
        } else if (!state.overlayMissingLogged) {
            Logger.debug('Gradient overlay not found in prompt textarea');
            state.overlayMissingLogged = true;
        }
    }
};


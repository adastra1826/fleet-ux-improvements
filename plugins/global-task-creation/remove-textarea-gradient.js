// ============= remove-textarea-gradient.js =============
const plugin = {
    id: 'removeTextareaGradient',
    name: 'Remove Textarea Gradient',
    description: 'Removes the gradient fade overlay from the prompt textarea',
    _version: '1.0',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { removed: false },
    
    // Plugin-specific selectors
    selectors: {
        promptTextareaContainer: '#\\:r7\\: > div.flex-shrink-0 > div > div.space-y-2.relative > div.relative > div'
    },
    
    onMutation(state, context) {
        if (state.removed) return;

        const container = document.querySelector(this.selectors.promptTextareaContainer);
        if (!container) return;

        const gradientOverlay = container.querySelector('div.bg-gradient-to-b');
        if (gradientOverlay) {
            gradientOverlay.style.background = 'none';
            gradientOverlay.style.pointerEvents = 'none';
            state.removed = true;
            Logger.log('✓ Textarea gradient fade removed');
        }
    }
};

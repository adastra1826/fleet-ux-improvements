// ============= source-data-explorer.js =============
// Plugin that uses context data from other plugins

const plugin = {
    id: 'sourceDataExplorer',
    name: 'Source Data Explorer',
    description: 'Add button to open source data in new tab',
    _version: '1.1',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { buttonAdded: false, missingLogged: false },
    
    // Plugin-specific selectors
    selectors: {
        toolbar: '#\\:rb\\: > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center',
        workflowIndicator: '#\\:rb\\: > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center > div:nth-child(2)'
    },
    
    onMutation(state, context) {
        if (state.buttonAdded) return;
        
        const toolbar = document.querySelector(this.selectors.toolbar);
        const workflowIndicator = document.querySelector(this.selectors.workflowIndicator);
        
        if (!toolbar || !workflowIndicator) {
            if (!state.missingLogged) {
                Logger.debug('Toolbar or workflow indicator not found for Source Data Explorer');
                state.missingLogged = true;
            }
            return;
        }

        if (workflowIndicator.textContent.includes('Workflow')) {
            this.addSourceButton(toolbar, context);
            state.buttonAdded = true;
        }
    },
    
    addSourceButton(toolbar, context) {
        const button = document.createElement('button');
        button.className = 'ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors';
        button.textContent = '📊 Source Data';
        button.title = 'Open source data in new tab';
        
        button.onclick = () => {
            if (context.source) {
                window.open(context.source, '_blank');
                Logger.log('Opening source data:', context.source);
            } else {
                alert('Source data URL not captured yet. Try refreshing the page and creating a workflow.');
                Logger.warn('Source URL not available');
            }
        };
        
        toolbar.appendChild(button);
        Logger.log('✓ Source Data Explorer button added');
    }
};
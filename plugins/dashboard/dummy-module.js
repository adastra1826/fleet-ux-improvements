
// dummy-module.js
// A bare-bones plugin template for testing purposes

const plugin = {
    // ========== REQUIRED ==========
    id: 'dummy-module',
    _version: '1.1',
    
    // ========== RECOMMENDED ==========
    name: 'Dummy Module',
    description: 'A minimal test plugin that logs its lifecycle events',
    phase: 'init',  // 'early', 'init', or 'mutation'
    enabledByDefault: true,
    
    // ========== OPTIONAL ==========
    // Initial state that gets reset on navigation
    initialState: {
        initCount: 0
    },
    
    /**
     * Called when the plugin is initialized
     * @param {Object} state - Plugin's state object (persists until cleanup)
     * @param {Object} context - Shared context with currentArchetype, version, etc.
     */
    init(state, context) {
        state.initCount++;
        
        Logger.log('✓ Initialized');
        Logger.log(`Archetype: ${context.currentArchetype?.name || 'None'}`);
        Logger.log(`Version: ${context.version}`);
        Logger.log(`Init count: ${state.initCount}`);
        
        // Example: Register a cleanup item if you create intervals/elements
        // const myInterval = CleanupRegistry.registerInterval(
        //     setInterval(() => console.log('tick'), 5000)
        // );
        
        // Example: Add a DOM element
        // const myElement = document.createElement('div');
        // myElement.id = 'dummy-module-indicator';
        // myElement.textContent = 'Dummy Module Active';
        // document.body.appendChild(myElement);
        // CleanupRegistry.registerElement(myElement);
    },
    
    /**
     * Called on DOM mutations (only if phase is 'mutation')
     * @param {Object} state - Plugin's state object
     * @param {Object} context - Shared context
     */
    // onMutation(state, context) {
    //     Logger.debug('[Dummy Module] DOM mutation detected');
    // },
    
    /**
     * Called when navigating away / cleaning up
     * @param {Object} state - Plugin's state object
     * @param {Object} context - Shared context
     */
    destroy(state, context) {
        Logger.log(`🧹 Destroyed after ${state.initCount} init(s)`);
        // Perform any custom cleanup here
        // Note: Items registered with CleanupRegistry are automatically cleaned up
    }
};


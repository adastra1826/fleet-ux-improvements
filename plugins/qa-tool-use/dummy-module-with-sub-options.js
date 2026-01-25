
// dummy-module-with-sub-options.js
// A test plugin demonstrating sub-options functionality

const plugin = {
    // ========== REQUIRED ==========
    id: 'dummy-module-with-sub-options',
    _version: '1.0',
    
    // ========== RECOMMENDED ==========
    name: 'Dummy Module (Sub-Options)',
    description: 'A test plugin demonstrating sub-options that can be individually toggled',
    phase: 'init',
    enabledByDefault: true,
    
    // ========== SUB-OPTIONS ==========
    // Each sub-option can be toggled independently in the settings modal
    subOptions: [
        {
            id: 'feature-alpha',
            name: 'Feature Alpha',
            description: 'Logs a message when this feature is enabled',
            enabledByDefault: true
        },
        {
            id: 'feature-beta',
            name: 'Feature Beta',
            description: 'Logs a different message when this feature is enabled',
            enabledByDefault: false
        }
    ],
    
    // ========== OPTIONAL ==========
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
        Logger.log(`Init count: ${state.initCount}`);
        
        // Check each sub-option and log if enabled
        const featureAlphaEnabled = Storage.getSubOptionEnabled(this.id, 'feature-alpha', true);
        const featureBetaEnabled = Storage.getSubOptionEnabled(this.id, 'feature-beta', false);
        
        if (featureAlphaEnabled) {
            Logger.log('🅰️ Feature Alpha is ACTIVE - This sub-option is enabled!');
        } else {
            Logger.log('Feature Alpha is disabled');
        }
        
        if (featureBetaEnabled) {
            Logger.log('🅱️ Feature Beta is ACTIVE - This sub-option is enabled!');
        } else {
            Logger.log('Feature Beta is disabled');
        }
    },
    
    /**
     * Called when navigating away / cleaning up
     * @param {Object} state - Plugin's state object
     * @param {Object} context - Shared context
     */
    destroy(state, context) {
        Logger.log(`🧹 Destroyed after ${state.initCount} init(s)`);
    }
};

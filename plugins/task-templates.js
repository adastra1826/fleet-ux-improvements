// ============= task-templates.js =============
// Example plugin for m-taskCreation archetype

const plugin = {
    id: 'taskTemplates',
    name: 'Task Templates',
    description: 'Quick templates for common task types',
    enabledByDefault: true,
    phase: 'init',
    initialState: {},
    
    // Plugin-specific selectors
    selectors: {
        taskDescription: 'textarea.task-description',
        createButton: 'button.create-task'
    },
    
    templates: [
        { name: 'Bug Fix', template: 'Fix bug in [component]\n\nSteps to reproduce:\n1. \n2. \n\nExpected behavior:\n\nActual behavior:' },
        { name: 'Feature Request', template: 'Implement [feature name]\n\nDescription:\n\nAcceptance Criteria:\n- [ ] \n- [ ] ' },
        { name: 'Documentation', template: 'Document [component/feature]\n\nSections to cover:\n- Overview\n- Usage\n- Examples\n- API Reference' }
    ],
    
    init(state, context) {
        const waitForElements = setInterval(() => {
            const taskDescription = document.querySelector(this.selectors.taskDescription);
            const createButton = document.querySelector(this.selectors.createButton);
            
            if (taskDescription && createButton) {
                clearInterval(waitForElements);
                this.addTemplateSelector(taskDescription);
            }
        }, 100);
    },
    
    addTemplateSelector(taskDescription) {
        const selector = document.createElement('select');
        selector.className = 'mb-2 p-2 border rounded';
        selector.innerHTML = '<option value="">-- Select Template --</option>';
        
        this.templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.template;
            option.textContent = template.name;
            selector.appendChild(option);
        });
        
        selector.onchange = () => {
            if (selector.value) {
                taskDescription.value = selector.value;
                selector.value = '';
            }
        };
        
        taskDescription.parentNode.insertBefore(selector, taskDescription);
        Logger.log('✓ Task templates selector added');
    }
};
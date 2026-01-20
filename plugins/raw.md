// ============= favorites.js =============
// Plugin with its own selectors - completely self-contained

const plugin = {
    id: 'favorites',
    name: 'Tool Favorites',
    description: 'Add favorite button to tools and sort favorites to top',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { initialized: false },
    
    // Plugin-specific selectors
    selectors: {
        toolsContainer: '#\\:rb\\: > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3',
        toolHeader: 'div.flex.items-center.gap-3.p-3.cursor-pointer.hover\\:bg-muted\\/30',
        toolName: 'span'
    },
    
    // Plugin-specific storage keys
    storageKeys: {
        favoriteTools: 'favorite-tools'
    },
    
    init(state, context) {
        // Add styles for favorites
        const style = document.createElement('style');
        style.textContent = `
            .favorite-star {
                cursor: pointer;
                margin-left: auto;
                transition: all 0.2s;
                font-size: 18px;
                opacity: 0.7;
            }
            .favorite-star:hover {
                opacity: 1;
                transform: scale(1.2);
            }
            .favorite-star.favorited {
                color: gold;
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
        Logger.log('✓ Favorites styles injected');
    },
    
    onMutation(state, context) {
        const toolsContainer = document.querySelector(this.selectors.toolsContainer);
        if (!toolsContainer) return;
        
        const favoriteTools = new Set(Storage.get(this.storageKeys.favoriteTools, []));
        
        // Add favorite buttons to all tools
        const toolHeaders = toolsContainer.querySelectorAll(this.selectors.toolHeader);
        toolHeaders.forEach(header => {
            if (header.querySelector('.favorite-star')) return; // Already has star
            
            const toolName = header.querySelector(this.selectors.toolName)?.textContent;
            if (!toolName) return;
            
            const star = document.createElement('span');
            star.className = 'favorite-star';
            star.innerHTML = favoriteTools.has(toolName) ? '⭐' : '☆';
            if (favoriteTools.has(toolName)) {
                star.classList.add('favorited');
            }
            
            star.onclick = (e) => {
                e.stopPropagation();
                if (favoriteTools.has(toolName)) {
                    favoriteTools.delete(toolName);
                    star.innerHTML = '☆';
                    star.classList.remove('favorited');
                } else {
                    favoriteTools.add(toolName);
                    star.innerHTML = '⭐';
                    star.classList.add('favorited');
                }
                Storage.set(this.storageKeys.favoriteTools, Array.from(favoriteTools));
                
                // Re-sort tools
                this.sortTools(toolsContainer, favoriteTools);
            };
            
            header.appendChild(star);
        });
        
        // Initial sort
        if (!state.initialized) {
            this.sortTools(toolsContainer, favoriteTools);
            state.initialized = true;
        }
    },
    
    sortTools(container, favoriteTools) {
        const tools = Array.from(container.children);
        tools.sort((a, b) => {
            const aName = a.querySelector(this.selectors.toolName)?.textContent;
            const bName = b.querySelector(this.selectors.toolName)?.textContent;
            const aFavorited = favoriteTools.has(aName);
            const bFavorited = favoriteTools.has(bName);
            
            if (aFavorited && !bFavorited) return -1;
            if (!aFavorited && bFavorited) return 1;
            return 0;
        });
        
        tools.forEach(tool => container.appendChild(tool));
        Logger.debug('Tools sorted by favorites');
    }
};

// ============= notes.js =============
// Another self-contained plugin

const plugin = {
    id: 'notes',
    name: 'Workflow Notes',
    description: 'Add a persistent notes section to the workflow builder',
    enabledByDefault: true,
    phase: 'init',
    initialState: {},
    
    // Plugin-specific selectors
    selectors: {
        leftColumn: '#\\:r7\\:',
        promptSectionParent: '#\\:r7\\: > div.flex-shrink-0 > div.p-3.border-b'
    },
    
    // Plugin-specific storage keys
    storageKeys: {
        notes: 'notes',
        notesHeight: 'notes-height'
    },
    
    init(state, context) {
        // Wait for the left column to exist
        const waitForColumn = setInterval(() => {
            const leftColumn = document.querySelector(this.selectors.leftColumn);
            if (leftColumn) {
                clearInterval(waitForColumn);
                this.createNotesSection(leftColumn);
            }
        }, 100);
    },
    
    createNotesSection(leftColumn) {
        const promptSection = document.querySelector(this.selectors.promptSectionParent);
        if (!promptSection) {
            Logger.warn('Could not find prompt section parent');
            return;
        }
        
        // Create notes container
        const notesContainer = document.createElement('div');
        notesContainer.className = 'p-3 border-b';
        notesContainer.innerHTML = `
            <div class="space-y-2">
                <label class="text-sm font-medium">Notes</label>
                <textarea 
                    id="wf-notes-textarea"
                    class="w-full min-h-[100px] p-2 text-sm border rounded-md resize-y"
                    placeholder="Add your workflow notes here..."
                    style="height: ${Storage.get(this.storageKeys.notesHeight, '150px')}"
                >${Storage.get(this.storageKeys.notes, '')}</textarea>
            </div>
        `;
        
        // Insert after prompt section
        promptSection.parentNode.insertBefore(notesContainer, promptSection.nextSibling);
        
        // Set up auto-save
        const textarea = document.getElementById('wf-notes-textarea');
        if (textarea) {
            // Save notes on change
            textarea.addEventListener('input', () => {
                Storage.set(this.storageKeys.notes, textarea.value);
            });
            
            // Save height on resize
            const resizeObserver = new ResizeObserver(() => {
                Storage.set(this.storageKeys.notesHeight, textarea.style.height);
            });
            resizeObserver.observe(textarea);
            
            Logger.log('✓ Notes section created');
        }
    }
};

// ============= source-data-explorer.js =============
// Plugin that uses context data from other plugins

const plugin = {
    id: 'sourceDataExplorer',
    name: 'Source Data Explorer',
    description: 'Add button to open source data in new tab',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { buttonAdded: false },
    
    // Plugin-specific selectors
    selectors: {
        toolbar: '#\\:rb\\: > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center',
        workflowIndicator: '#\\:rb\\: > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center > div:nth-child(2)'
    },
    
    onMutation(state, context) {
        if (state.buttonAdded) return;
        
        const toolbar = document.querySelector(this.selectors.toolbar);
        const workflowIndicator = document.querySelector(this.selectors.workflowIndicator);
        
        if (toolbar && workflowIndicator && workflowIndicator.textContent.includes('Workflow')) {
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
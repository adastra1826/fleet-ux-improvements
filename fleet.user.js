// ==UserScript==
// @name         Fleet Workflow Builder UX Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  UX improvements for workflow builder tool with improved layout, favorites, and fixes
// @author       Nicholas Doherty
// @match        https://fleetai.com/work/problems/*
// @icon         https://fleetai.com/favicon.ico
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @downloadURL  https://cdn.jsdelivr.net/gh/adastra1826/fleet-ux-improvements@v1/fleet.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/adastra1826/fleet-ux-improvements@v1/fleet.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ============= CONFIGURATION =============
    const CONFIG = {
        DEBUG: true, // Set to true for console logging
        DEBUG_NOTES: true, // Set to true for detailed notes logging
    };

    // ============= STATE TRACKING =============
    const STATE = {
        searchInputDisabled: false,
        promptEditorDisabled: false,
        notesTextareaDisabled: false,
        expandCollapseButtonsAdded: false,
        textareaFadeRemoved: false,
        threeColumnLayoutApplied: false,
        notesAutoSaveSetup: false,
        favoritesInitialized: false,
        lastStarsCount: 0,
        retryCounters: {
            searchInput: 0,
            promptEditor: 0,
            notesTextarea: 0,
            toolbar: 0,
            textareaFade: 0,
            threeColumnLayout: 0,
            notesAutoSave: 0,
            favoriteButtons: 0
        }
    };

    // Helper function for logging
    const log = (msg, ...args) => {
        if (CONFIG.DEBUG) console.log(`[WF Enhancer] ${msg}`, ...args);
    };

    // ============= DISABLE AUTOCORRECT ON SEARCH INPUT =============
    function disableAutocorrectOnSearchInput() {
        if (STATE.searchInputDisabled) return false;

        const searchInput = document.querySelector('input[placeholder="Search tools, descriptions, parameters..."]');

        if (searchInput) {
            searchInput.setAttribute('autocomplete', 'off');
            searchInput.setAttribute('autocorrect', 'off');
            searchInput.setAttribute('autocapitalize', 'off');
            searchInput.setAttribute('spellcheck', 'false');
            searchInput.setAttribute('data-form-type', 'other');
            searchInput.setAttribute('data-lpignore', 'true');
            searchInput.setAttribute('data-1p-ignore', 'true');

            STATE.searchInputDisabled = true;
            log('✓ Autocorrect disabled on search input');
            return true;
        }
        
        STATE.retryCounters.searchInput++;
        return false;
    }

    // ============= DISABLE AUTOCORRECT ON TEXTAREAS =============
    function disableAutocorrectOnTextareas() {
        let changesMade = false;

        // Prompt editor
        if (!STATE.promptEditorDisabled) {
            const promptEditor = document.getElementById('prompt-editor');
            if (promptEditor) {
                promptEditor.setAttribute('autocomplete', 'off');
                promptEditor.setAttribute('autocorrect', 'off');
                promptEditor.setAttribute('autocapitalize', 'off');
                promptEditor.setAttribute('spellcheck', 'false');
                STATE.promptEditorDisabled = true;
                log('✓ Autocorrect disabled on prompt editor');
                changesMade = true;
            } else {
                STATE.retryCounters.promptEditor++;
            }
        }

        // Notes textarea
        if (!STATE.notesTextareaDisabled) {
            const notesTextarea = document.getElementById('wf-notes-textarea');
            if (notesTextarea) {
                notesTextarea.setAttribute('autocomplete', 'off');
                notesTextarea.setAttribute('autocorrect', 'off');
                notesTextarea.setAttribute('autocapitalize', 'off');
                notesTextarea.setAttribute('spellcheck', 'false');
                STATE.notesTextareaDisabled = true;
                log('✓ Autocorrect disabled on notes textarea');
                changesMade = true;
            } else {
                STATE.retryCounters.notesTextarea++;
            }
        }

        return changesMade;
    }

    // ============= EXPAND/COLLAPSE ALL TOOLS =============
    // Selectors for the tools panel
    const SELECTORS = {
        toolbar: '#\\:rb\\: > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center',
        toolsContainer: '#\\:rb\\: > div > div.size-full.bg-background-extra.overflow-y-auto > div > div.space-y-3',
        toolHeader: 'div.flex.items-center.gap-3.p-3.cursor-pointer.hover\\:bg-muted\\/30',
        promptTextareaContainer: '#\\:r7\\: > div.flex-shrink-0 > div > div.space-y-2.relative > div.relative > div',
        promptSectionParent: '#\\:r7\\: > div.flex-shrink-0 > div.p-3.border-b',
        workflowToolsIndicator: '#\\:rb\\: > div > div.bg-background.w-full.flex.items-center.justify-between.border-b.h-9.min-h-9.max-h-9.px-1 > div.flex.items-center > div:nth-child(2)'
    };

    // Storage keys
    const STORAGE_KEYS = {
        notes: 'wf-enhancer-notes',
        notesHeight: 'wf-enhancer-notes-height',
        col1Width: 'wf-enhancer-col1-width',
        col2Width: 'wf-enhancer-col2-width',
        col3Width: 'wf-enhancer-col3-width',
        sectionSplitRatio: 'wf-enhancer-section-split-ratio',
        favoriteTools: 'wf-enhancer-favorite-tools'
    };

    function addExpandCollapseButtons() {
        if (STATE.expandCollapseButtonsAdded) return false;

        const toolbar = document.querySelector(SELECTORS.toolbar);
        if (!toolbar) {
            STATE.retryCounters.toolbar++;
            return false;
        }

        const toolsIndicator = document.querySelector(SELECTORS.workflowToolsIndicator);
        const hasTools = toolsIndicator && toolsIndicator.children.length > 0;

        let container = document.getElementById('wf-expand-collapse-container');
        
        if (!container) {
            const buttonClass = 'inline-flex items-center justify-center whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 transition-colors hover:bg-accent rounded-sm h-7 px-2 text-xs text-muted-foreground hover:text-foreground';

            container = document.createElement('div');
            container.id = 'wf-expand-collapse-container';
            container.className = 'flex items-center gap-2';

            const expandBtn = document.createElement('button');
            expandBtn.id = 'wf-expand-btn';
            expandBtn.className = buttonClass;
            expandBtn.innerHTML = `<span>Expand All</span>`;
            expandBtn.addEventListener('click', () => setAllToolsState('open'));

            const divider = document.createElement('div');
            divider.className = 'w-px h-5 bg-border mx-1';

            const collapseBtn = document.createElement('button');
            collapseBtn.id = 'wf-collapse-btn';
            collapseBtn.className = buttonClass;
            collapseBtn.innerHTML = `<span>Collapse All</span>`;
            collapseBtn.addEventListener('click', () => setAllToolsState('closed'));

            const trailingDivider = document.createElement('div');
            trailingDivider.id = 'wf-expand-collapse-trailing-divider';
            trailingDivider.className = 'w-px h-5 bg-border mx-1';

            container.appendChild(expandBtn);
            container.appendChild(divider);
            container.appendChild(collapseBtn);
            container.appendChild(trailingDivider);

            toolbar.insertBefore(container, toolbar.firstChild);
            STATE.expandCollapseButtonsAdded = true;
            log('✓ Expand/Collapse buttons added to toolbar');
        }

        container.style.display = hasTools ? 'flex' : 'none';
        return true;
    }

    function setAllToolsState(targetState) {
        const toolsContainer = document.querySelector(SELECTORS.toolsContainer);
        if (!toolsContainer) {
            log('⚠ Tools container not found for expand/collapse');
            return;
        }

        const toolHeaders = toolsContainer.querySelectorAll(SELECTORS.toolHeader);
        let successCount = 0;

        toolHeaders.forEach((header) => {
            const currentState = header.getAttribute('data-state');
            if ((targetState === 'open' && currentState === 'closed') ||
                (targetState === 'closed' && currentState === 'open')) {
                header.click();
                successCount++;
            }
        });

        log(`✓ ${targetState === 'open' ? 'Expanded' : 'Collapsed'} ${successCount} tools`);
    }

    // ============= REMOVE TEXTAREA GRADIENT FADE =============
    function removeTextareaGradientFade() {
        if (STATE.textareaFadeRemoved) return false;

        const container = document.querySelector(SELECTORS.promptTextareaContainer);
        if (!container) {
            STATE.retryCounters.textareaFade++;
            return false;
        }

        const gradientOverlay = container.querySelector('div.bg-gradient-to-b');
        if (gradientOverlay) {
            gradientOverlay.style.background = 'none';
            gradientOverlay.style.pointerEvents = 'none';
            STATE.textareaFadeRemoved = true;
            log('✓ Textarea gradient fade removed');
            return true;
        }

        STATE.retryCounters.textareaFade++;
        return false;
    }

    // ============= THREE COLUMN LAYOUT WITH IMPROVED FIRST COLUMN =============
    function createThreeColumnLayout() {
        if (STATE.threeColumnLayoutApplied) return false;

        const mainContainer = document.querySelector('body > div.group\\/sidebar-wrapper.flex.min-h-svh.w-full.has-\\[\\[data-variant\\=inset\\]\\]\\:bg-sidebar > main > div > div > div > div.w-full.h-full.bg-background.rounded-sm.relative.flex.flex-col.min-w-0.overflow-hidden.border-\\[0\\.5px\\].shadow-\\[0_0_15px_rgba\\(0\\,0\\,0\\,0\\.05\\)\\] > div > div.flex-1.flex.overflow-hidden.min-h-0 > div');
        
        if (!mainContainer) {
            STATE.retryCounters.threeColumnLayout++;
            return false;
        }

        if (document.getElementById('wf-three-col-layout')) {
            return false;
        }

        const leftColumn = document.querySelector('#\\:r7\\:');
        const existingDivider = mainContainer.querySelector('div[data-resize-handle]');
        const workflowColumn = document.querySelector('#\\:rb\\:');

        if (!leftColumn || !workflowColumn || !existingDivider) {
            STATE.retryCounters.threeColumnLayout++;
            return false;
        }

        const topSection = leftColumn.querySelector('div.flex-shrink-0');
        const bottomSection = leftColumn.querySelector('div.flex-1.min-h-0.overflow-hidden');

        if (!topSection || !bottomSection) {
            STATE.retryCounters.threeColumnLayout++;
            return false;
        }

        const panelGroupId = mainContainer.getAttribute('data-panel-group-id') || ':r6:';
        mainContainer.innerHTML = '';
        mainContainer.id = 'wf-three-col-layout';

        const savedCol1 = GM_getValue(STORAGE_KEYS.col1Width, 25);
        const savedCol2 = GM_getValue(STORAGE_KEYS.col2Width, 37.5);
        const savedCol3 = GM_getValue(STORAGE_KEYS.col3Width, 37.5);

        const col1 = document.createElement('div');
        col1.className = 'flex flex-col overflow-hidden transition-opacity';
        col1.id = 'wf-col-text';
        col1.style.cssText = `flex: ${savedCol1} 1 0px; overflow: hidden;`;
        col1.setAttribute('data-panel-group-id', panelGroupId);
        col1.setAttribute('data-panel', '');
        col1.setAttribute('data-panel-id', 'wf-col-text');
        col1.setAttribute('data-panel-size', '25');
        
        const splitWrapper = document.createElement('div');
        splitWrapper.className = 'flex flex-col h-full';
        splitWrapper.id = 'wf-split-wrapper';
        
        reorganizeFirstColumnContent(splitWrapper, topSection);
        col1.appendChild(splitWrapper);

        const divider1 = document.createElement('div');
        divider1.className = 'relative w-[2px] h-[98%] my-auto hover:bg-brand transition-all duration-300 ease-in-out mx-[1px] before:absolute before:top-0 before:left-[-3px] before:right-[-3px] before:bottom-0 before:content-[""] before:cursor-col-resize';
        divider1.setAttribute('role', 'separator');
        divider1.style.touchAction = 'none';
        divider1.setAttribute('tabindex', '0');
        divider1.setAttribute('data-panel-group-direction', 'horizontal');
        divider1.setAttribute('data-panel-group-id', panelGroupId);
        divider1.setAttribute('data-resize-handle', '');
        divider1.setAttribute('data-panel-resize-handle-enabled', 'true');
        divider1.setAttribute('data-panel-resize-handle-id', 'wf-divider-1');
        divider1.setAttribute('data-resize-handle-state', 'inactive');
        divider1.setAttribute('aria-controls', 'wf-col-text');
        divider1.setAttribute('aria-valuemax', '40');
        divider1.setAttribute('aria-valuemin', '15');
        divider1.setAttribute('aria-valuenow', '25');

        const col2 = document.createElement('div');
        col2.className = 'flex flex-col overflow-hidden transition-opacity';
        col2.id = 'wf-col-tools';
        col2.style.cssText = `flex: ${savedCol2} 1 0px; overflow: hidden;`;
        col2.setAttribute('data-panel-group-id', panelGroupId);
        col2.setAttribute('data-panel', '');
        col2.setAttribute('data-panel-id', 'wf-col-tools');
        col2.setAttribute('data-panel-size', '37.5');
        col2.appendChild(bottomSection);

        const divider2 = document.createElement('div');
        divider2.className = 'relative w-[2px] h-[98%] my-auto hover:bg-brand transition-all duration-300 ease-in-out mx-[1px] before:absolute before:top-0 before:left-[-3px] before:right-[-3px] before:bottom-0 before:content-[""] before:cursor-col-resize';
        divider2.setAttribute('role', 'separator');
        divider2.style.touchAction = 'none';
        divider2.setAttribute('tabindex', '0');
        divider2.setAttribute('data-panel-group-direction', 'horizontal');
        divider2.setAttribute('data-panel-group-id', panelGroupId);
        divider2.setAttribute('data-resize-handle', '');
        divider2.setAttribute('data-panel-resize-handle-enabled', 'true');
        divider2.setAttribute('data-panel-resize-handle-id', 'wf-divider-2');
        divider2.setAttribute('data-resize-handle-state', 'inactive');
        divider2.setAttribute('aria-controls', 'wf-col-tools');
        divider2.setAttribute('aria-valuemax', '50');
        divider2.setAttribute('aria-valuemin', '20');
        divider2.setAttribute('aria-valuenow', '37.5');

        workflowColumn.style.flex = `${savedCol3} 1 0px`;
        workflowColumn.setAttribute('data-panel-size', savedCol3.toString());

        mainContainer.appendChild(col1);
        mainContainer.appendChild(divider1);
        mainContainer.appendChild(col2);
        mainContainer.appendChild(divider2);
        mainContainer.appendChild(workflowColumn);

        setupColumnResize(divider1, col1, col2);
        setupColumnResize(divider2, col2, workflowColumn);

        STATE.threeColumnLayoutApplied = true;
        log('✓ Three column layout applied');
        
        setTimeout(() => {
            setupNotesAutoSave();
        }, 100);
        
        return true;
    }

    function reorganizeFirstColumnContent(wrapper, topSection) {
        const savedRatio = GM_getValue(STORAGE_KEYS.sectionSplitRatio, 60);
        
        const existingSection = topSection.querySelector('div.p-3.border-b');
        if (!existingSection) {
            log('⚠ Existing section not found for reorganization');
            return;
        }

        const existingNotesContainer = existingSection.querySelector('#wf-notes-container');
        if (existingNotesContainer) {
            existingNotesContainer.remove();
        }

        const topPanel = document.createElement('div');
        topPanel.id = 'wf-top-panel';
        topPanel.className = 'flex flex-col overflow-hidden';
        topPanel.style.flex = `${savedRatio} 1 0%`;
        topPanel.style.minHeight = '100px';
        
        const topContent = existingSection.cloneNode(true);
        topContent.className = 'p-3 border-b flex flex-col h-full';
        
        const textareaWrapper = topContent.querySelector('div.space-y-2.relative');
        if (textareaWrapper) {
            textareaWrapper.className = 'space-y-2 relative flex-1 flex flex-col';
            
            const relativeDiv = textareaWrapper.querySelector('div.relative');
            if (relativeDiv) {
                relativeDiv.className = 'relative flex-1 flex flex-col';
                
                const textareaContainer = relativeDiv.querySelector('div.flex.flex-col');
                if (textareaContainer) {
                    textareaContainer.style.height = '100%';
                }
            }
        }
        
        topPanel.appendChild(topContent);

        const resizeHandle = document.createElement('div');
        resizeHandle.id = 'wf-section-resize-handle';
        resizeHandle.className = 'relative h-[2px] w-full hover:bg-brand transition-all duration-300 ease-in-out my-[1px]';
        resizeHandle.style.backgroundColor = 'var(--border)';
        resizeHandle.style.cursor = 'grab';
        resizeHandle.setAttribute('role', 'separator');
        resizeHandle.style.touchAction = 'none';
        
        const hitArea = document.createElement('div');
        hitArea.style.cssText = 'position: absolute; top: -6px; bottom: -6px; left: 0; right: 0; cursor: grab;';
        resizeHandle.appendChild(hitArea);

        const bottomPanel = document.createElement('div');
        bottomPanel.id = 'wf-bottom-panel';
        bottomPanel.className = 'p-3 border-b overflow-y-auto';
        bottomPanel.style.flex = `${100 - savedRatio} 1 0%`;
        bottomPanel.style.minHeight = '100px';

        createNotesSection(bottomPanel);

        wrapper.appendChild(topPanel);
        wrapper.appendChild(resizeHandle);
        wrapper.appendChild(bottomPanel);

        setupSectionResize(resizeHandle, topPanel, bottomPanel);
    }

    function createNotesSection(container) {
        const savedNotes = GM_getValue(STORAGE_KEYS.notes, '');
        if (CONFIG.DEBUG_NOTES) {
            log(`✓ Notes loaded from storage (${savedNotes.length} chars)`);
        }

        container.className = 'p-3 border-b overflow-hidden flex flex-col';

        const escapedNotes = savedNotes
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        const notesHTML = `
            <div class="flex flex-col flex-1">
                <div class="flex items-center justify-between h-5 mb-2">
                    <div class="text-sm text-muted-foreground font-medium">Notes</div>
                </div>
                <div class="relative flex-1 flex flex-col">
                    <div class="flex flex-col relative rounded-md overflow-hidden border border-input bg-background shadow-sm h-full">
                        <textarea id="wf-notes-textarea" class="flex-1 w-full border-0 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 resize-none" placeholder="Add your notes here. These are not submitted with your task. They are auto-saved and persist between page loads.">${escapedNotes}</textarea>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = notesHTML;
    }

    function setupSectionResize(handle, topPanel, bottomPanel) {
        let isResizing = false;
        let startY = 0;
        let startTopHeight = 0;
        let startBottomHeight = 0;
        let totalHeight = 0;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            
            const wrapper = handle.parentElement;
            totalHeight = wrapper.offsetHeight;
            startTopHeight = topPanel.offsetHeight;
            startBottomHeight = bottomPanel.offsetHeight;

            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
            handle.style.cursor = 'grabbing';
            handle.style.backgroundColor = 'var(--brand)';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaY = e.clientY - startY;
            const newTopHeight = startTopHeight + deltaY;
            const newBottomHeight = startBottomHeight - deltaY;

            const topPercent = (newTopHeight / totalHeight) * 100;
            const bottomPercent = (newBottomHeight / totalHeight) * 100;

            if (topPercent >= 20 && topPercent <= 80) {
                topPanel.style.flex = `${topPercent} 1 0%`;
                bottomPanel.style.flex = `${bottomPercent} 1 0%`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                handle.style.backgroundColor = 'var(--border)';

                const topFlex = parseFloat(topPanel.style.flex) || 60;
                GM_setValue(STORAGE_KEYS.sectionSplitRatio, topFlex);
            }
        });

        handle.addEventListener('mouseenter', () => {
            if (!isResizing) {
                handle.style.backgroundColor = 'var(--brand)';
            }
        });

        handle.addEventListener('mouseleave', () => {
            if (!isResizing) {
                handle.style.backgroundColor = 'var(--border)';
            }
        });
    }

    function setupColumnResize(divider, leftCol, rightCol) {
        let isResizing = false;
        let startX = 0;
        let startLeftWidth = 0;
        let startRightWidth = 0;
        let totalWidth = 0;

        divider.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            
            const parent = divider.parentElement;
            totalWidth = parent.offsetWidth;
            
            const leftFlex = parseFloat(leftCol.style.flex) || 25;
            const rightFlex = parseFloat(rightCol.style.flex) || 37.5;
            
            startLeftWidth = (leftFlex / 100) * totalWidth;
            startRightWidth = (rightFlex / 100) * totalWidth;

            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            divider.setAttribute('data-resize-handle-state', 'active');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const newLeftWidth = startLeftWidth + deltaX;
            const newRightWidth = startRightWidth - deltaX;

            const leftPercent = (newLeftWidth / totalWidth) * 100;
            const rightPercent = (newRightWidth / totalWidth) * 100;

            const minLeft = parseFloat(divider.getAttribute('aria-valuemin')) || 15;
            const maxLeft = parseFloat(divider.getAttribute('aria-valuemax')) || 45;

            if (leftPercent >= minLeft && leftPercent <= maxLeft && rightPercent >= 20) {
                leftCol.style.flex = `${leftPercent} 1 0px`;
                leftCol.setAttribute('data-panel-size', leftPercent.toString());
                
                rightCol.style.flex = `${rightPercent} 1 0px`;
                rightCol.setAttribute('data-panel-size', rightPercent.toString());
                
                divider.setAttribute('aria-valuenow', leftPercent.toString());
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                divider.setAttribute('data-resize-handle-state', 'inactive');
                saveColumnWidths();
            }
        });
    }

    function saveColumnWidths() {
        const col1 = document.getElementById('wf-col-text');
        const col2 = document.getElementById('wf-col-tools');
        const col3 = document.querySelector('#\\:rb\\:');

        if (col1) GM_setValue(STORAGE_KEYS.col1Width, parseFloat(col1.style.flex) || 25);
        if (col2) GM_setValue(STORAGE_KEYS.col2Width, parseFloat(col2.style.flex) || 37.5);
        if (col3) GM_setValue(STORAGE_KEYS.col3Width, parseFloat(col3.style.flex) || 37.5);
    }

    // ============= NOTES AUTO-SAVE =============
    let notesSaveTimeout = null;
    let notesObserver = null;

    function setupNotesAutoSave() {
        if (STATE.notesAutoSaveSetup) return false;

        const textarea = document.getElementById('wf-notes-textarea');
        
        if (!textarea) {
            STATE.retryCounters.notesAutoSave++;
            return false;
        }

        STATE.notesAutoSaveSetup = true;
        log('✓ Notes auto-save configured');

        textarea.addEventListener('input', () => {
            if (notesSaveTimeout) {
                clearTimeout(notesSaveTimeout);
            }
            
            notesSaveTimeout = setTimeout(() => {
                const currentValue = textarea.value;
                GM_setValue(STORAGE_KEYS.notes, currentValue);
                if (CONFIG.DEBUG_NOTES) {
                    log(`✓ Notes auto-saved (${currentValue.length} chars)`);
                }
            }, 1000);
        });

        if (!notesObserver) {
            notesObserver = new MutationObserver(() => {
                const currentTextarea = document.getElementById('wf-notes-textarea');
                if (currentTextarea && !STATE.notesAutoSaveSetup) {
                    STATE.notesAutoSaveSetup = false;
                    setupNotesAutoSave();
                }
            });

            const bottomPanel = document.getElementById('wf-bottom-panel');
            if (bottomPanel) {
                notesObserver.observe(bottomPanel, {
                    childList: true,
                    subtree: true
                });
            }
        }

        return true;
    }

    // ============= TOOL FAVORITES SYSTEM =============
    let favoriteTools = new Set();

    function loadFavorites() {
        if (STATE.favoritesInitialized) return;
        
        const saved = GM_getValue(STORAGE_KEYS.favoriteTools, '[]');
        try {
            favoriteTools = new Set(JSON.parse(saved));
            STATE.favoritesInitialized = true;
            log(`✓ Loaded ${favoriteTools.size} favorite tool(s)`);
        } catch (e) {
            log('⚠ Error loading favorites:', e);
            favoriteTools = new Set();
        }
    }

    function saveFavorites() {
        GM_setValue(STORAGE_KEYS.favoriteTools, JSON.stringify([...favoriteTools]));
    }

    function toggleFavorite(toolName) {
        if (favoriteTools.has(toolName)) {
            favoriteTools.delete(toolName);
        } else {
            favoriteTools.add(toolName);
        }
        saveFavorites();
    }

    function getToolName(toolButton) {
        const nameElement = toolButton.querySelector('div.flex.flex-col.items-start span.text-xs.font-medium.text-foreground span span');
        return nameElement ? nameElement.textContent.trim() : null;
    }

    function createStarSVG(filled = false) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '14');
        svg.setAttribute('height', '14');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', filled ? '#FFD700' : 'none');
        svg.setAttribute('stroke', filled ? '#FFD700' : 'currentColor');
        svg.setAttribute('stroke-width', filled ? '2' : '1');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.style.cssText = 'display: inline-block; vertical-align: middle;';
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z');
        
        svg.appendChild(path);
        return svg;
    }

    function addFavoriteButton(toolButton) {
        if (toolButton.querySelector('.wf-favorite-star')) {
            return false;
        }

        const toolName = getToolName(toolButton);
        if (!toolName) return false;

        const nameContainer = toolButton.querySelector('div.flex.flex-col.items-start span.text-xs.font-medium.text-foreground');
        if (!nameContainer) return false;

        const starContainer = document.createElement('span');
        starContainer.className = 'wf-favorite-star inline-flex items-center mr-1 cursor-pointer hover:opacity-70 transition-opacity';
        starContainer.style.cssText = 'display: inline-flex; align-items: center; margin-right: 4px;';
        
        const isFavorite = favoriteTools.has(toolName);
        starContainer.appendChild(createStarSVG(isFavorite));
        
        starContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleFavorite(toolName);
            
            starContainer.innerHTML = '';
            starContainer.appendChild(createStarSVG(favoriteTools.has(toolName)));
        });
        
        const toolNameSpan = nameContainer.querySelector('span');
        if (toolNameSpan) {
            const wrapper = document.createElement('span');
            wrapper.style.cssText = 'display: inline-flex; align-items: center;';
            
            const nameText = toolNameSpan.cloneNode(true);
            wrapper.appendChild(starContainer);
            wrapper.appendChild(nameText);
            
            nameContainer.replaceChild(wrapper, toolNameSpan);
        }
        
        return true;
    }

    function addFavoriteButtons() {
        loadFavorites();

        const toolsContainer = document.querySelector('#wf-col-tools > div > div > div');
        if (!toolsContainer) {
            STATE.retryCounters.favoriteButtons++;
            return false;
        }

        const toolButtons = toolsContainer.querySelectorAll('button.group\\/tool');
        
        let starsAdded = 0;
        toolButtons.forEach(button => {
            if (addFavoriteButton(button)) {
                starsAdded++;
            }
        });
        
        if (starsAdded > 0 && starsAdded !== STATE.lastStarsCount) {
            log(`✓ Added favorite stars to ${starsAdded} tool(s)`);
            STATE.lastStarsCount = starsAdded;
        }
        
        return starsAdded > 0;
    }


    // ============= MUTATION OBSERVER =============
    function initObserver() {
        const observer = new MutationObserver(() => {
            disableAutocorrectOnSearchInput();
            disableAutocorrectOnTextareas();
            addExpandCollapseButtons();
            removeTextareaGradientFade();
            createThreeColumnLayout();
            addFavoriteButtons();
            setupNotesAutoSave();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        log('✓ Mutation observer initialized');
    }

    // ============= INITIALIZATION =============
    let initialized = false;

    function init() {
        // Prevent double initialization
        if (initialized) {
            log('⚠ Initialization already complete, skipping duplicate call');
            return;
        }
        initialized = true;

        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('Workflow Builder UX Enhancer v2.0');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        disableAutocorrectOnSearchInput();
        disableAutocorrectOnTextareas();
        initObserver();

        log('✓ Initialization complete');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // Only run once, when document is idle (specified by @run-at)
    init();

})();
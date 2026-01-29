// ============= progress-prompt-expand.js =============
const plugin = {
    id: 'progressPromptExpand',
    name: 'Progress Prompt Expand',
    description: 'Hover over My Progress task items to expand truncated prompts with a smooth animation',
    _version: '1.0',
    enabledByDefault: true,
    phase: 'mutation',
    initialState: { missingLogged: false },

    onMutation(state, context) {
        const main = Context.dom.query('main', { context: `${this.id}.main` });
        if (!main) {
            if (!state.missingLogged) {
                Logger.debug('progress-prompt-expand: main not found');
                state.missingLogged = true;
            }
            return;
        }

        const tables = main.querySelectorAll('table');
        const taskCells = [];
        for (const table of tables) {
            const secondHeader = table.querySelector('thead th:nth-child(2)');
            if (!secondHeader || secondHeader.textContent.trim() !== 'Task') continue;
            const rows = table.querySelectorAll('tbody tr');
            for (const row of rows) {
                const cell = row.querySelector('td:nth-child(2)');
                if (!cell || !cell.classList.contains('truncate')) continue;
                taskCells.push({ row, cell });
            }
        }

        if (taskCells.length === 0) {
            if (!state.missingLogged) {
                Logger.debug('progress-prompt-expand: no Task column cells found');
                state.missingLogged = true;
            }
            return;
        }

        state.missingLogged = false;
        let modified = 0;

        for (const { row, cell } of taskCells) {
            if (cell.hasAttribute('data-wf-progress-expand')) continue;

            const fragment = document.createDocumentFragment();
            const wrapper = document.createElement('div');
            wrapper.className = 'fleet-progress-prompt-inner';
            wrapper.style.cssText = 'max-height: 1.5em; overflow: hidden; transition: max-height 0.25s ease-out; white-space: normal;';
            while (cell.firstChild) wrapper.appendChild(cell.firstChild);
            cell.appendChild(wrapper);
            cell.classList.remove('truncate');

            cell.setAttribute('data-wf-progress-expand', 'true');

            const collapse = () => {
                wrapper.style.maxHeight = '1.5em';
                row.style.overflow = '';
            };

            const expand = () => {
                wrapper.style.maxHeight = '2000px';
                const fullHeight = wrapper.scrollHeight;
                wrapper.style.maxHeight = fullHeight + 'px';
                row.style.overflow = 'visible';
            };

            row.addEventListener('mouseenter', expand);
            row.addEventListener('mouseleave', collapse);

            modified++;
        }

        if (modified > 0) {
            Logger.log(`Progress prompt hover-expand enabled for ${modified} row(s)`);
        }
    }
};

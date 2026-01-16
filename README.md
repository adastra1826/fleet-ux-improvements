Custom userscript to enhance the web UX for Fleet problem creation.

#### Features:
- Space efficient 3 column layout
- All column widths are adjustable
- Additional custom notes area that saves content and persists it between page loads
- Prompt/note area heights are adjustable
- Ability to star favorite tools (persists throughout page loads)
- Autocorrect disabled in the tool search field to prevent search destruction when unfocusing the search field to select a tool
- Collapse All/Expand All buttons to make interacting with the steps in the workflow easier
- Show entire bug report instead of just two lines in the bug report modal with proper whitespace rendering (click the report to toggle expand to full version)
- Auto-confirm "Re-execute steps and invalidate results" modal (this behavior can currently be toggled in the CONFIG section of the userscript)
- Added "Duplicate to End of Workflow" button (duplicates the current tool and puts it all the way at the end)
- Added mini tool execution button (allows tool execution while collapsed)
- Added source data explorer button. Use this to visually explore the source data. (Not guaranteed to work)

#### Planned Features:
- JSON explorer
- Putting the starred tools in their own spot
- UX improvements to the tools in the current workflow
- Config UI for this extension
- Save specific notes per environment
- Ability to collapse a tool but still show the output (ie, hide all input parameters)
- Display current environment name/codename in the task creation page
- Add "Execute to this step" button (execute all steps up to the current one)
- Repository of all submitted prompts with custom notes area for each one

#### Known Bugs
- Script does not activate on task page unless the page is refreshed
- Duplicate to end button icon makes no sense
- Autocorrect is disabled in the prompt field, which may not be desirable for all (will add a toggle for this)
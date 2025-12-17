/**
 * Shared UI Components for Admin Panel
 */

/**
 * Renders a standardized action button group (Edit + Delete + Extras)
 * @param {string} editOnClick - The JS code to execute on edit click (e.g. "editService(1)")
 * @param {string} deleteOnClick - The JS code to execute on delete click (e.g. "removeService(1)")
 * @param {object} options - Optional settings
 * @param {string} options.extraHtml - HTML to prepend before the buttons (e.g. arrows)
 * @param {string} options.editLabel - Label for edit button (default: "MODIFIER")
 * @param {string} options.deleteLabel - Label for delete button (default: "&times;")
 * @param {string} options.editTitle - Title tooltip for edit button
 * @param {string} options.deleteTitle - Title tooltip for delete button
 * @returns {string} HTML string for the button group
 */
export function renderActionButtons(editOnClick, deleteOnClick, options = {}) {
    const {
        extraHtml = '',
        editLabel = 'MODIFIER',
        deleteLabel = '&times;',
        editTitle = 'Modifier',
        deleteTitle = 'Supprimer'
    } = options;

    return `
        <div style="display:flex; align-items:center; gap:12px;">
            ${extraHtml ? `<div style="display:flex; align-items:center; gap:12px;">${extraHtml}</div>` : ''}
            ${extraHtml ? '<span class="vertical-sep"></span>' : ''}
            ${editOnClick ? `<button class="btn-gold" onclick="${editOnClick}" title="${editTitle}">${editLabel}</button>` : ''}
            ${deleteOnClick ? `<button class="btn-x" onclick="${deleteOnClick}" title="${deleteTitle}">${deleteLabel}</button>` : ''}
        </div>
    `;
}

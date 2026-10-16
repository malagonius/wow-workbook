export function formatRichText(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\r\n?|\n/g, '<br>');
}

export function initializeRichTextEditors(root = document) {
  root.querySelectorAll('textarea[data-rich-text]').forEach(textarea => {
    if (textarea.dataset.richTextReady) return;
    textarea.dataset.richTextReady = 'true';

    const toolbar = document.createElement('div');
    toolbar.className = 'rich-text-toolbar';
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Description formatting');

    const boldButton = document.createElement('button');
    boldButton.type = 'button';
    boldButton.className = 'rich-text-bold';
    boldButton.textContent = 'B';
    boldButton.title = 'Bold selected text';
    boldButton.setAttribute('aria-label', 'Bold selected text');
    boldButton.addEventListener('click', () => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.slice(start, end);
      const insertion = selected ? `**${selected}**` : '****';
      textarea.setRangeText(insertion, start, end);
      textarea.setSelectionRange(start + 2, start + 2 + selected.length);
      textarea.focus();
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    toolbar.appendChild(boldButton);
    textarea.before(toolbar);

    const help = document.createElement('small');
    help.className = 'rich-text-help';
    help.textContent = 'Use Bold for emphasis; line breaks are preserved.';
    textarea.after(help);
  });
}

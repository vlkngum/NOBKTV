(async () => {
  // Load emoji mapping. If chrome.runtime is not available (testing in a normal page),
  // fall back to relative path.
  async function loadEmojiMap() {
    const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL("emoji.json")
      : "emoji.json";
    const res = await fetch(url);
    return res.json();
  }

  const emojiMap = await loadEmojiMap();
  // Expose map and initial enabled flag for easier debugging from page console
  try {
    window.__emojiMap = emojiMap;
    window.__emojiReplacerEnabled = localStorage.getItem('emojiReplacerEnabled') !== 'false';
  } catch (e) {}

  // Helper: belli bir selector ile öğe gelene kadar bekle
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
        return;
      }
      const observer = new MutationObserver((mutations, obs) => {
        const el2 = document.querySelector(selector);
        if (el2) {
          obs.disconnect();
          resolve(el2);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        reject(new Error("Element not found: " + selector));
      }, timeout);
    });
  }

  let chatContainer;
  try {
    chatContainer = await waitForElement(".messageList_1GRn-");
  } catch (e) {
    console.error("Chat container bulunamadı:", e);
    return;
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      // If nodes were added, process any .ce-msg inside them
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          // Delay slightly so framework-rendered inner structure settles
          setTimeout(() => {
            node.querySelectorAll(".ce-msg").forEach(msg => replaceEmojis(msg));
            if (node.matches && node.matches(".ce-msg")) {
              replaceEmojis(node);
            }
          }, 40);
        }
      }
      // If text content changed (characterData), handle the parent element if it's a message
      if (mutation.type === 'characterData') {
        const parentEl = mutation.target.parentElement;
        if (parentEl) {
          const msgEl = parentEl.closest && parentEl.closest('.ce-msg');
          if (msgEl) replaceEmojis(msgEl);
        }
      }
    }
  });

  // Observe also characterData to catch inline text updates
  observer.observe(chatContainer, { childList: true, subtree: true, characterData: true });

  // Başlangıçta halihazırdaki mesajlarda uygula
  document.querySelectorAll(".ce-msg").forEach(msg => replaceEmojis(msg));

  // Escape regex special characters in a string
  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Create a case-insensitive map of patterns to image URLs
  const patterns = Object.keys(emojiMap).map(key => ({
    key,
    regex: new RegExp(`\\b${escapeRegex(key)}\\b`, 'i'),
    url: (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL(emojiMap[key])
      : emojiMap[key]
  }));
  console.debug('emojiMap loaded', emojiMap);
  console.debug('patterns', patterns.map(p => p.regex));
  try { window.__emojiPatterns = patterns; } catch (e) {}

  // Walk text nodes and replace matches with <img> nodes safely
  function replaceEmojis(root) {
    // Respect the toggle: if disabled, do nothing
    try {
      const enabled = window.__emojiReplacerEnabled === undefined
        ? (localStorage.getItem('emojiReplacerEnabled') !== 'false')
        : !!window.__emojiReplacerEnabled;
      if (!enabled) return;
    } catch (e) {}
    // root can be an element container or the element itself
    try {
      // Debug: indicate we're processing this root
      // eslint-disable-next-line no-console
      console.debug('replaceEmojis called for', root);
    } catch (e) {}
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        // Skip empty or whitespace-only text nodes
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        // Skip nodes inside script, style, textarea, input, or code blocks
        const parentTag = node.parentElement && node.parentElement.tagName;
        if (!parentTag) return NodeFilter.FILTER_REJECT;
        const skipTags = ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE'];
        if (skipTags.includes(parentTag)) return NodeFilter.FILTER_REJECT;
        // Skip editable areas
        if (node.parentElement.isContentEditable) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);

    const toReplace = [];
    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      for (const p of patterns) {
        if (p.regex.test(textNode.nodeValue)) {
          toReplace.push({ textNode, pattern: p });
          break; // only first match per text node handled in this pass
        }
      }
    }

    toReplace.forEach(({ textNode, pattern }) => {
      const parent = textNode.parentNode;
      // Debug: log a replacement is about to happen
      try { console.debug('Replacing', JSON.stringify(textNode.nodeValue), 'with', pattern.key); } catch (e) {}
      const parts = textNode.nodeValue.split(new RegExp(`(${pattern.regex.source})`, 'i'));
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        if (i % 2 === 1) {
          // matched part -> insert image
          const img = document.createElement('img');
          img.src = pattern.url;
          img.style.height = '32px';
          img.style.verticalAlign = 'middle';
          parent.insertBefore(img, textNode);
        } else {
          parent.insertBefore(document.createTextNode(part), textNode);
        }
      }
      parent.removeChild(textNode);
    });
  }

  // Remove old toggle UI and add a 'Show Emojis' panel button
  function ensureEmojiPanel() {
    if (document.querySelector('#emoji-panel-button')) return;

    // Button (dex.png)
    const btn = document.createElement('button');
    btn.id = 'emoji-panel-button';
    btn.style.position = 'fixed';
    btn.style.right = '12px';
    btn.style.bottom = '12px';
    btn.style.zIndex = '999999';
    btn.style.padding = '0';
    btn.style.borderRadius = '50%';
    btn.style.background = 'none';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.width = '30px';
    btn.style.height = '30px';
    // Resim ekle
    const btnImg = document.createElement('img');
    btnImg.src = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('emoji/dex.png')
      : 'emoji/dex.png';
    btnImg.alt = 'Show Emojis';
    btnImg.style.width = '100%';
    btnImg.style.height = '100%';
    btnImg.style.objectFit = 'contain';
    btnImg.style.display = 'block';
    btn.appendChild(btnImg);

    // Panel
    const panel = document.createElement('div');
    panel.id = 'emoji-panel';
    Object.assign(panel.style, {
      position: 'fixed',
      right: '12px',
      bottom: '56px',
      zIndex: 999999,
      width: '360px',
      maxHeight: '60vh',
      overflow: 'auto',
      background: '#111',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '8px',
      padding: '8px',
      boxShadow: '0 6px 18px rgba(0,0,0,0.6)'
    });
    panel.style.display = 'none';

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Search emojis...';
    Object.assign(search.style, {
      width: '100%',
      padding: '6px 8px',
      marginBottom: '8px',
      borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.06)',
      background: '#222',
      color: '#fff'
    });

    const grid = document.createElement('div');
    grid.id = 'emoji-grid';
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '8px'
    });

    panel.appendChild(search);
    panel.appendChild(grid);
    document.body.appendChild(panel);
    document.body.appendChild(btn);

    function populate(filter) {
      grid.innerHTML = '';
      const map = window.__emojiMap || {};
      const patternsLocal = window.__emojiPatterns || Object.keys(map).map(k => ({ key: k, url: map[k] }));
      patternsLocal.forEach(p => {
        const name = (p.key || '').toLowerCase();
        if (filter && !name.includes(filter.toLowerCase())) return;
        const card = document.createElement('div');
        card.style.textAlign = 'center';
        const img = document.createElement('img');
        img.src = p.url;
        img.style.maxWidth = '100%';
        img.style.height = '56px';
        img.style.objectFit = 'contain';
        img.title = p.key;
        img.style.cursor = 'pointer';
        // Sadece click event ekleniyor, hiçbir resim veya kart silinmiyor
        img.addEventListener('click', function() {
          insertToComposer(p.key + ' ');
          // Paneli kapat
          const panelEl = document.getElementById('emoji-panel');
          if (panelEl) panelEl.style.display = 'none';
        });
        const label = document.createElement('div');
        label.textContent = name;
        label.style.fontSize = '11px';
        label.style.marginTop = '4px';
        card.appendChild(img);
        card.appendChild(label);
        grid.appendChild(card);
      });
    }

    btn.addEventListener('click', () => {
      if (panel.style.display === 'none') {
        panel.style.display = 'block';
        populate('');
      } else {
        panel.style.display = 'none';
      }
    });

    search.addEventListener('input', (e) => populate(e.target.value));
  }

  // Expose a manual helper for debugging
  window.replaceEmojisAll = function() {
    document.querySelectorAll('.ce-msg').forEach(m => replaceEmojis(m));
  };

  // Insert text into the composer. Supports textarea or contenteditable composer.
  function insertToComposer(text) {
    // Try textarea first
    const ta = document.querySelector('.ce-textarea');
    if (ta && ta.tagName === 'TEXTAREA') {
      ta.focus();
      try {
        const start = (typeof ta.selectionStart === 'number') ? ta.selectionStart : ta.value.length;
        const end = (typeof ta.selectionEnd === 'number') ? ta.selectionEnd : start;
        const val = ta.value;
        ta.value = val.slice(0, start) + text + val.slice(end);
        ta.selectionStart = ta.selectionEnd = start + text.length;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      } catch (e) {
        ta.value += text;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
    }

    // Fallback: contenteditable composer
    const ce = document.querySelector('.ce-msgbox.richTextArea_2hdAB[contenteditable="true"], .richTextArea_2hdAB[contenteditable="true"], .ce-msgbox[contenteditable="true"]');
    if (ce) {
      ce.focus();
      // First try execCommand insertText which some apps handle like real typing
      try {
        if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
          const ok = document.execCommand('insertText', false, text);
          if (ok) {
            try { ce.dispatchEvent(new InputEvent('input', { bubbles: true })); } catch (e) {}
            return;
          }
        }
      } catch (e) {}

      const sel = window.getSelection();
      try {
        let didInsert = false;
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          // If the selection is inside the composer, insert at selection
          if (ce.contains(range.startContainer)) {
            range.deleteContents();
            const node = document.createTextNode(text);
            range.insertNode(node);
            // move caret after inserted node
            range.setStartAfter(node);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            didInsert = true;
          }
        }
        if (!didInsert) {
          // append at the end
          const node = document.createTextNode(text);
          ce.appendChild(node);
          // move caret to end
          const range2 = document.createRange();
          range2.selectNodeContents(ce);
          range2.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range2);
        }
      } catch (e) {
        // last resort: append
        ce.innerText = (ce.innerText || '') + text;
      }
      // dispatch input and key events for robustness
      try { ce.dispatchEvent(new InputEvent('input', { bubbles: true })); } catch (e) {}
      try { ce.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    }
  }

  // Install panel when chatContainer is ready
  try { ensureEmojiPanel(); } catch (e) {}
  try { makePostedEmojisClickable(); } catch (e) {}

  // Make posted emojis clickable: when an <img> from our emojis appears, add pointer cursor and click handler
  function makePostedEmojisClickable() {
    document.querySelectorAll('.ce-msg img').forEach(img => {
      // avoid changing unrelated images
      try {
        const src = img.src || '';
        const patternsLocal = window.__emojiPatterns || [];
        const match = patternsLocal.find(p => (p.url && src.indexOf(p.url) !== -1) || src.indexOf('/' + (p.url || '')) !== -1);
        if (match) {
          img.style.cursor = 'pointer';
          if (!img.dataset.emojiClick) {
            img.dataset.emojiClick = '1';
            img.addEventListener('click', () => {
              const name = match.key + ' ';
              insertToComposer(name);
            });
          }
        }
      } catch (e) {}
    });
  }

  // Observe mutations to attach click handlers to new posted emojis
  const postedObserver = new MutationObserver(() => {
    makePostedEmojisClickable();
    try { installInputButton(); } catch (e) {}
  });
  postedObserver.observe(document.documentElement, { childList: true, subtree: true });

  // Add click event listener to emoji images
  const emojiImages = document.querySelectorAll('#emoji-panel img');
  emojiImages.forEach(img => {
      img.addEventListener('click', function() {
          const emojiName = this.src.split('/').pop(); // Get the image name
          console.log('Emoji clicked:', emojiName); // Debugging log
          const inputField = document.querySelector('#your-input-field-id'); // Replace with your input field ID
          if (inputField) {
              inputField.value += emojiName; // Append emoji name to input field
          }
      });
  });
})();

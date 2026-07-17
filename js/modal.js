const overlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalComposer = document.getElementById('modal-composer');
const modalBack = document.getElementById('modal-back');
const commentMenu = document.getElementById('comment-menu');

let longPressTimer = null;
let suppressNextClick = false;

function syncModalViewport() {
  if (!window.visualViewport) return;
  const vv = window.visualViewport;
  const keyboardOpen = vv.height < window.innerHeight - 100;

  if (keyboardOpen) {
    overlay.style.height = `${vv.height}px`;
    overlay.style.top = `${vv.offsetTop}px`;
  } else {
    overlay.style.height = '';
    overlay.style.top = '';
  }
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncModalViewport);
  window.visualViewport.addEventListener('scroll', syncModalViewport);
}

function openModal() {
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  syncModalViewport();
}

function closeModal() {
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  overlay.style.height = '';
  overlay.style.top = '';
  modalContent.innerHTML = '';
  modalComposer.innerHTML = '';
  commentMenu.classList.add('hidden');
  openThreadPostId = null;
}

modalBack.addEventListener('click', closeModal);

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

document.getElementById('comment-menu-delete').addEventListener('click', async () => {
  const commentId = commentMenu.dataset.commentId;
  commentMenu.classList.add('hidden');
  if (!commentId) return;

  try {
    await deleteComment(commentId);
    removeCommentFromThread(commentId);
  } catch (err) {
    alert(err.message);
  }
});

document.addEventListener('click', (e) => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  if (!commentMenu.classList.contains('hidden') && !commentMenu.contains(e.target)) {
    commentMenu.classList.add('hidden');
  }
});

function showError(container, message) {
  let errorEl = container.querySelector('.error-message');
  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.className = 'error-message';
    container.appendChild(errorEl);
  }
  errorEl.textContent = message;
}

function autoResizeComposerInput(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function openPostModal(cellNumber) {
  modalContent.innerHTML = '';
  modalComposer.innerHTML = `
    <form class="composer" id="post-form">
      <textarea name="text" class="composer-input" rows="1" required maxlength="500" autocomplete="off"></textarea>
      <button type="submit" class="composer-send" aria-label="投稿する">↑</button>
    </form>
  `;

  const form = document.getElementById('post-form');

  form.text.addEventListener('input', () => autoResizeComposerInput(form.text));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = form.text.value;
    if (!text.trim()) return;

    const submitBtn = form.querySelector('.composer-send');
    submitBtn.disabled = true;

    try {
      const post = await createPost(cellNumber, text);
      upsertPost(post);
      closeModal();
    } catch (err) {
      showError(modalContent, err.message);
      submitBtn.disabled = false;
    }
  });

  openModal();
  form.text.focus();
}

async function openThreadModal(post) {
  openThreadPostId = post.id;

  modalContent.innerHTML = `
    <p class="thread-headline">${escapeHtml(post.text)}</p>
    <ul class="comments" id="comments-list"></ul>
  `;

  modalComposer.innerHTML = `
    <form class="composer" id="comment-form">
      <textarea name="text" class="composer-input" rows="1" required maxlength="500" autocomplete="off"></textarea>
      <button type="submit" class="composer-send" aria-label="コメントする">↑</button>
    </form>
  `;

  const commentsList = document.getElementById('comments-list');
  const form = document.getElementById('comment-form');

  attachLongPress(commentsList);

  try {
    const comments = await fetchComments(post.id);
    renderComments(commentsList, comments);
  } catch (err) {
    commentsList.innerHTML = `<li class="error-message">${escapeHtml(err.message)}</li>`;
  }

  form.text.addEventListener('input', () => autoResizeComposerInput(form.text));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = form.text.value;
    if (!text.trim()) return;

    const submitBtn = form.querySelector('.composer-send');
    submitBtn.disabled = true;

    try {
      const comment = await createComment(post.id, text);
      appendCommentToThread(comment);
      form.reset();
      autoResizeComposerInput(form.text);
      submitBtn.disabled = false;
    } catch (err) {
      showError(modalContent, err.message);
      submitBtn.disabled = false;
    }
  });

  openModal();
}

function bubbleMarkup(authorName, text) {
  const isOwn = authorName === getNickname();
  return {
    isOwn,
    html: `
      <span class="avatar"></span>
      <div class="bubble">${escapeHtml(text)}</div>
    `,
  };
}

function renderComments(listEl, comments) {
  listEl.innerHTML = comments.map(renderCommentItem).join('');
}

function renderCommentItem(comment) {
  const { isOwn, html } = bubbleMarkup(comment.author_name, comment.text);
  return `<li class="message-row ${isOwn ? 'own' : ''}" data-comment-id="${comment.id}">${html}</li>`;
}

function appendCommentToThread(comment) {
  const listEl = document.getElementById('comments-list');
  if (!listEl) return;

  if (listEl.querySelector(`[data-comment-id="${comment.id}"]`)) return;

  const { isOwn, html } = bubbleMarkup(comment.author_name, comment.text);
  const li = document.createElement('li');
  li.className = `message-row ${isOwn ? 'own' : ''}`;
  li.dataset.commentId = comment.id;
  li.innerHTML = html;
  listEl.appendChild(li);
}

function removeCommentFromThread(commentId) {
  const li = document.querySelector(`#comments-list [data-comment-id="${commentId}"]`);
  if (li) li.remove();
}

function attachLongPress(listEl) {
  listEl.addEventListener('pointerdown', (e) => {
    const li = e.target.closest('li[data-comment-id]');
    if (!li) return;

    longPressTimer = setTimeout(() => {
      showCommentMenu(li, li.dataset.commentId);
    }, 550);
  });

  listEl.addEventListener('pointerup', cancelLongPress);
  listEl.addEventListener('pointerleave', cancelLongPress);
  listEl.addEventListener('pointercancel', cancelLongPress);
}

function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function showCommentMenu(li, commentId) {
  const rect = li.getBoundingClientRect();
  commentMenu.style.top = `${rect.top}px`;
  commentMenu.style.left = `${rect.left + rect.width / 2}px`;
  commentMenu.dataset.commentId = commentId;
  commentMenu.classList.remove('hidden');
  suppressNextClick = true;
}

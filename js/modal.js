const overlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalComposer = document.getElementById('modal-composer');
const modalTitle = document.getElementById('modal-title');
const modalBack = document.getElementById('modal-back');
const modalMenu = document.getElementById('modal-menu');
const modalMenuDropdown = document.getElementById('modal-menu-dropdown');
const commentMenu = document.getElementById('comment-menu');

let currentThreadPost = null;
let longPressTimer = null;
let suppressNextClick = false;

function openModal() {
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  modalContent.innerHTML = '';
  modalComposer.innerHTML = '';
  modalTitle.textContent = '';
  modalMenu.classList.add('hidden');
  modalMenuDropdown.classList.add('hidden');
  commentMenu.classList.add('hidden');
  openThreadPostId = null;
  currentThreadPost = null;
}

modalBack.addEventListener('click', closeModal);

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

modalMenu.addEventListener('click', () => {
  modalMenuDropdown.classList.toggle('hidden');
});

document.getElementById('menu-delete-chat').addEventListener('click', async () => {
  modalMenuDropdown.classList.add('hidden');
  if (!currentThreadPost) return;
  if (!confirm('この投稿を削除しますか？')) return;

  try {
    await deletePost(currentThreadPost.id);
    removePost(currentThreadPost);
    closeModal();
  } catch (err) {
    showError(modalContent, err.message);
  }
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
  if (!modalMenuDropdown.classList.contains('hidden') && !modalMenuDropdown.contains(e.target) && e.target !== modalMenu) {
    modalMenuDropdown.classList.add('hidden');
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

function openPostModal(cellNumber) {
  modalTitle.textContent = '';
  modalMenu.classList.add('hidden');
  modalContent.innerHTML = '';
  modalComposer.innerHTML = `
    <form class="composer" id="post-form">
      <button type="button" class="composer-plus" aria-label="閉じる">＋</button>
      <input type="text" name="text" class="composer-input" required maxlength="500" autocomplete="off">
      <button type="submit" class="composer-send" aria-label="投稿する">↑</button>
    </form>
  `;

  const form = document.getElementById('post-form');

  form.querySelector('.composer-plus').addEventListener('click', closeModal);

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
  currentThreadPost = post;

  modalTitle.textContent = truncateText(post.text);
  modalMenu.classList.remove('hidden');

  modalContent.innerHTML = `
    <div class="thread-post">
      <p class="author-name">${escapeHtml(post.author_name || '名無し')}</p>
      <p class="post-text">${escapeHtml(post.text)}</p>
    </div>
    <ul class="comments" id="comments-list"></ul>
  `;

  modalComposer.innerHTML = `
    <button type="button" id="comment-fab" class="fab" aria-label="コメントを追加">＋</button>
    <form class="composer comment-form hidden" id="comment-form">
      <button type="button" class="composer-plus" aria-label="閉じる">＋</button>
      <input type="text" name="text" class="composer-input" required maxlength="500" autocomplete="off">
      <button type="submit" class="composer-send" aria-label="コメントする">↑</button>
    </form>
  `;

  const commentsList = document.getElementById('comments-list');
  const form = document.getElementById('comment-form');
  const fab = document.getElementById('comment-fab');

  attachLongPress(commentsList);

  try {
    const comments = await fetchComments(post.id);
    renderComments(commentsList, comments);
  } catch (err) {
    commentsList.innerHTML = `<li class="error-message">${escapeHtml(err.message)}</li>`;
  }

  fab.addEventListener('click', () => {
    form.classList.remove('hidden');
    fab.classList.add('hidden');
    form.text.focus();
  });

  form.querySelector('.composer-plus').addEventListener('click', () => {
    form.reset();
    form.classList.add('hidden');
    fab.classList.remove('hidden');
  });

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
      form.classList.add('hidden');
      fab.classList.remove('hidden');
      submitBtn.disabled = false;
    } catch (err) {
      showError(modalContent, err.message);
      submitBtn.disabled = false;
    }
  });

  openModal();
}

function renderComments(listEl, comments) {
  listEl.innerHTML = comments.map(renderCommentItem).join('');
}

function renderCommentItem(comment) {
  return `
    <li data-comment-id="${comment.id}">
      <p class="author-name">${escapeHtml(comment.author_name || '名無し')}</p>
      <p class="comment-text">${escapeHtml(comment.text)}</p>
    </li>
  `;
}

function appendCommentToThread(comment) {
  const listEl = document.getElementById('comments-list');
  if (!listEl) return;

  if (listEl.querySelector(`[data-comment-id="${comment.id}"]`)) return;

  const li = document.createElement('li');
  li.dataset.commentId = comment.id;
  li.innerHTML = `
    <p class="author-name">${escapeHtml(comment.author_name || '名無し')}</p>
    <p class="comment-text">${escapeHtml(comment.text)}</p>
  `;
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

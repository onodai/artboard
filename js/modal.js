const overlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalClose = document.getElementById('modal-close');

function openModal() {
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  modalContent.innerHTML = '';
  openThreadPostId = null;
}

modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
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
  modalContent.innerHTML = `
    <form class="modal-form" id="post-form">
      <textarea name="text" required maxlength="500"></textarea>
      <button type="submit" aria-label="投稿する">✓</button>
    </form>
  `;

  const form = document.getElementById('post-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = form.text.value;
    if (!text.trim()) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const post = await createPost(cellNumber, text);
      upsertPost(post);
      closeModal();
    } catch (err) {
      showError(form, err.message);
      submitBtn.disabled = false;
    }
  });

  openModal();
  form.text.focus();
}

async function openThreadModal(post) {
  openThreadPostId = post.id;

  modalContent.innerHTML = `
    <div class="thread-post">
      <p class="author-name">${escapeHtml(post.author_name || '名無し')}</p>
      <p class="post-text">${escapeHtml(post.text)}</p>
    </div>
    <ul class="comments" id="comments-list"></ul>
    <div class="thread-actions">
      <button type="button" id="delete-post" aria-label="投稿を削除">🗑</button>
    </div>
    <button type="button" id="comment-fab" class="fab" aria-label="コメントを追加">＋</button>
    <form class="modal-form comment-form hidden" id="comment-form">
      <textarea name="text" required maxlength="500"></textarea>
      <button type="submit" aria-label="コメントする">✓</button>
    </form>
  `;

  const commentsList = document.getElementById('comments-list');
  const form = document.getElementById('comment-form');
  const fab = document.getElementById('comment-fab');

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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = form.text.value;
    if (!text.trim()) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const comment = await createComment(post.id, text);
      appendCommentToThread(comment);
      form.reset();
      form.classList.add('hidden');
      fab.classList.remove('hidden');
      submitBtn.disabled = false;
    } catch (err) {
      showError(form, err.message);
      submitBtn.disabled = false;
    }
  });

  document.getElementById('delete-post').addEventListener('click', async () => {
    if (!confirm('この投稿を削除しますか？')) return;

    try {
      await deletePost(post.id);
      removePost(post);
      closeModal();
    } catch (err) {
      showError(modalContent, err.message);
    }
  });

  openModal();
}

function renderComments(listEl, comments) {
  listEl.innerHTML = comments.map(renderCommentItem).join('');
}

function renderCommentItem(comment) {
  return `
    <li>
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

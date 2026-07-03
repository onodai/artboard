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
    <h2>投稿（マス ${cellNumber}）</h2>
    <form class="modal-form" id="post-form">
      <textarea name="text" placeholder="本文を入力" required maxlength="500"></textarea>
      <button type="submit">投稿する</button>
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
    <div class="thread-post">${escapeHtml(post.text)}</div>
    <p class="thread-meta">投稿: ${formatDateTime(post.created_at)}</p>
    <h2>コメント</h2>
    <ul class="comments" id="comments-list"></ul>
    <form class="modal-form" id="comment-form">
      <textarea name="text" placeholder="コメントを入力" required maxlength="500"></textarea>
      <button type="submit">コメントする</button>
    </form>
    <div class="thread-actions">
      <button type="button" id="delete-post">投稿を削除</button>
    </div>
  `;

  const commentsList = document.getElementById('comments-list');
  const form = document.getElementById('comment-form');

  try {
    const comments = await fetchComments(post.id);
    renderComments(commentsList, comments);
  } catch (err) {
    commentsList.innerHTML = `<li class="error-message">${escapeHtml(err.message)}</li>`;
  }

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
  if (comments.length === 0) {
    listEl.innerHTML = '<li class="comments-empty">コメントはまだありません</li>';
    return;
  }

  listEl.innerHTML = comments.map(renderCommentItem).join('');
}

function renderCommentItem(comment) {
  return `
    <li>
      ${escapeHtml(comment.text)}
      <time>${formatDateTime(comment.created_at)}</time>
    </li>
  `;
}

function appendCommentToThread(comment) {
  const listEl = document.getElementById('comments-list');
  if (!listEl) return;

  const empty = listEl.querySelector('.comments-empty');
  if (empty) empty.remove();

  if (listEl.querySelector(`[data-comment-id="${comment.id}"]`)) return;

  const li = document.createElement('li');
  li.dataset.commentId = comment.id;
  li.innerHTML = `
    ${escapeHtml(comment.text)}
    <time>${formatDateTime(comment.created_at)}</time>
  `;
  listEl.appendChild(li);
}

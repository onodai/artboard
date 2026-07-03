const CELL_COUNT = 25;
const postsByCell = new Map();
let openThreadPostId = null;

function renderBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';

  for (let i = 0; i < CELL_COUNT; i++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.cell = i;

    const post = postsByCell.get(i);
    if (post) {
      cell.innerHTML = `<span class="cell-text">${escapeHtml(truncateText(post.text))}</span>`;
      cell.addEventListener('click', () => openThreadModal(post));
    } else {
      cell.classList.add('cell-empty');
      cell.textContent = '＋';
      cell.addEventListener('click', () => openPostModal(i));
    }

    board.appendChild(cell);
  }
}

function upsertPost(post) {
  postsByCell.set(post.cell_number, post);
  renderBoard();
}

function removePost(post) {
  postsByCell.delete(post.cell_number);
  renderBoard();

  if (openThreadPostId === post.id) {
    closeModal();
    openThreadPostId = null;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function initBoard() {
  getUserId();

  try {
    const posts = await fetchPosts();
    posts.forEach((post) => postsByCell.set(post.cell_number, post));
    renderBoard();

    subscribeToPosts(
      (post) => upsertPost(post),
      (post) => removePost(post)
    );

    subscribeToComments((comment) => {
      if (openThreadPostId === comment.post_id) {
        appendCommentToThread(comment);
      }
    });
  } catch (err) {
    document.getElementById('board').innerHTML =
      `<p class="error-message">${escapeHtml(err.message)}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', initBoard);

const CELL_COUNT = 24;
const postsByCell = new Map();
let openThreadPostId = null;

const boardDeleteOverlay = document.getElementById('board-delete-overlay');
const boardDeleteConfirm = document.getElementById('board-delete-confirm');
let boardDeleteTarget = null;
let boardLongPressTimer = null;
let suppressNextCellClick = false;

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
  let cellToRemove = null;
  for (const [cellNumber, existing] of postsByCell) {
    if (existing.id === post.id) {
      cellToRemove = cellNumber;
      break;
    }
  }

  if (cellToRemove !== null) {
    postsByCell.delete(cellToRemove);
    renderBoard();
  }

  if (openThreadPostId === post.id) {
    closeModal();
    openThreadPostId = null;
  }
}

function attachBoardLongPress() {
  const board = document.getElementById('board');

  board.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.cell:not(.cell-empty)');
    if (!cell) return;

    const post = postsByCell.get(Number(cell.dataset.cell));
    if (!post) return;

    boardLongPressTimer = setTimeout(() => {
      boardLongPressTimer = null;
      suppressNextCellClick = true;
      showBoardDeleteOverlay(post);
    }, 550);
  });

  board.addEventListener('pointerup', cancelBoardLongPress);
  board.addEventListener('pointerleave', cancelBoardLongPress);
  board.addEventListener('pointercancel', cancelBoardLongPress);

  board.addEventListener(
    'click',
    (e) => {
      if (suppressNextCellClick) {
        suppressNextCellClick = false;
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    },
    true
  );
}

function cancelBoardLongPress() {
  if (boardLongPressTimer) {
    clearTimeout(boardLongPressTimer);
    boardLongPressTimer = null;
  }
}

function showBoardDeleteOverlay(post) {
  boardDeleteTarget = post;
  boardDeleteOverlay.classList.remove('hidden');
}

function hideBoardDeleteOverlay() {
  boardDeleteOverlay.classList.add('hidden');
  boardDeleteTarget = null;
}

boardDeleteOverlay.addEventListener('click', (e) => {
  if (e.target === boardDeleteOverlay) hideBoardDeleteOverlay();
});

boardDeleteConfirm.addEventListener('click', async () => {
  if (!boardDeleteTarget) return;
  const post = boardDeleteTarget;
  hideBoardDeleteOverlay();

  try {
    await deletePost(post.id);
    removePost(post);
  } catch (err) {
    alert(err.message);
  }
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function ensureNickname() {
  return new Promise((resolve) => {
    const existing = getNickname();
    if (existing) {
      resolve(existing);
      return;
    }

    const gate = document.getElementById('nickname-gate');
    const form = document.getElementById('nickname-form');
    gate.classList.remove('hidden');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.nickname.value.trim();
      if (!name) return;

      setNickname(name);
      gate.classList.add('hidden');
      resolve(name);
    });
  });
}

async function initBoard() {
  getUserId();
  await ensureNickname();
  attachBoardLongPress();

  try {
    const posts = await fetchPosts();
    posts.forEach((post) => postsByCell.set(post.cell_number, post));
    renderBoard();

    subscribeToPosts(
      (post) => upsertPost(post),
      (post) => removePost(post)
    );

    subscribeToComments(
      (comment) => {
        if (openThreadPostId === comment.post_id) {
          appendCommentToThread(comment);
        }
      },
      (comment) => {
        removeCommentFromThread(comment.id);
      }
    );
  } catch (err) {
    document.getElementById('board').innerHTML =
      `<p class="error-message">${escapeHtml(err.message)}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', initBoard);

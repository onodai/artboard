const USER_ID_KEY = 'artboard_user_id';
const PREVIEW_LENGTH = 12;

let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient) {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
      throw new Error('js/config.js に Supabase の URL と anon key を設定してください');
    }
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

function getUserId() {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

function truncateText(text, maxLength = PREVIEW_LENGTH) {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength) + '…';
}

async function fetchPosts() {
  const { data, error } = await getSupabase()
    .from('posts')
    .select('*')
    .order('cell_number');

  if (error) throw error;
  return data;
}

async function createPost(cellNumber, text) {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from('posts')
    .insert({
      cell_number: cellNumber,
      text: text.trim(),
      updated_at: now,
      last_activity_at: now,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function deletePost(postId) {
  const { error } = await getSupabase()
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) throw error;
}

async function fetchComments(postId) {
  const { data, error } = await getSupabase()
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at');

  if (error) throw error;
  return data;
}

async function createComment(postId, text) {
  const now = new Date().toISOString();

  const { data: comment, error: commentError } = await getSupabase()
    .from('comments')
    .insert({
      post_id: postId,
      text: text.trim(),
    })
    .select()
    .single();

  if (commentError) throw commentError;

  const { error: postError } = await getSupabase()
    .from('posts')
    .update({ last_activity_at: now })
    .eq('id', postId);

  if (postError) throw postError;

  return comment;
}

function subscribeToPosts(onInsert, onDelete) {
  const channel = getSupabase()
    .channel('posts-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'posts' },
      (payload) => onInsert(payload.new)
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'posts' },
      (payload) => onDelete(payload.old)
    )
    .subscribe();

  return channel;
}

function subscribeToComments(onInsert) {
  const channel = getSupabase()
    .channel('comments-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comments' },
      (payload) => onInsert(payload.new)
    )
    .subscribe();

  return channel;
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString('ja-JP');
}

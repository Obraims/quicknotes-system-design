// API Configuration
const API_URL = 'https://jsonplaceholder.typicode.com/posts';

// DOM Element Selections
const loadBtn = document.getElementById('load-btn');
const statusEl = document.getElementById('status');
const noteForm = document.getElementById('note-form');
const titleInput = document.getElementById('title-input');
const bodyInput = document.getElementById('body-input');
const submitBtn = document.getElementById('submit-btn');
const notesList = document.getElementById('notes-list');

// Module-level State
let notes = [];

/**
 * Updates the status element text and applies corresponding status styling classes.
 * @param {string} message - The text message to display.
 * @param {'loading'|'success'|'error'} [type] - Status category for styling.
 */
function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = '';
  if (type) {
    statusEl.classList.add(`status-${type}`);
  }
}

/**
 * Reusable async HTTP request wrapper for fetch API calls.
 * @param {string} url - Target endpoint URL.
 * @param {RequestInit} [options={}] - Standard fetch configuration options.
 * @returns {Promise<{ data: any, status: number }>} Response payload and status code.
 */
async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  let data = null;

  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  }

  return { data, status: response.status };
}

/**
 * Renders the notes array into #notes-list using secure DOM creation methods.
 */
function renderNotes() {
  notesList.replaceChildren();

  if (notes.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'empty-state';
    emptyLi.textContent = "No notes loaded yet. Click 'Load notes' or create one above.";
    notesList.appendChild(emptyLi);
    return;
  }

  notes.forEach((note) => {
    const li = document.createElement('li');

    const titleEl = document.createElement('h3');
    titleEl.textContent = note.title;

    const bodyEl = document.createElement('p');
    bodyEl.textContent = note.body || '';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteNote(note.id, deleteBtn));

    li.appendChild(titleEl);
    li.appendChild(bodyEl);
    li.appendChild(deleteBtn);
    notesList.appendChild(li);
  });
}

/**
 * Fetches 10 notes from the backend API via GET request.
 */
async function loadNotes() {
  try {
    loadBtn.disabled = true;
    setStatus('Loading notes...', 'loading');

    const { data } = await request(`${API_URL}?_limit=10`);
    notes = data || [];
    renderNotes();
    setStatus('Loaded 10 notes from the server.', 'success');
  } catch (error) {
    setStatus(`Failed to load notes: ${error.message}`, 'error');
  } finally {
    loadBtn.disabled = false;
  }
}

/**
 * Handles creation of a new note via POST request with input validation.
 * @param {SubmitEvent} event - The form submission event.
 */
async function createNote(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  // Input Validation Rules
  if (!title) {
    setStatus('Validation error: Title is required.', 'error');
    return;
  }

  if (title.length > 100) {
    setStatus('Validation error: Title must be 100 characters or fewer.', 'error');
    return;
  }

  try {
    submitBtn.disabled = true;
    setStatus('Creating note...', 'loading');

    const { data, status } = await request(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        userId: 1,
      }),
    });

    const createdNote = {
      id: data.id,
      title: data.title || title,
      body: data.body || body,
      userId: data.userId || 1,
    };

    notes.unshift(createdNote);
    renderNotes();
    noteForm.reset();
    setStatus(`Note created (status ${status}, id ${data.id}).`, 'success');
  } catch (error) {
    setStatus(`Failed to create note: ${error.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

/**
 * Deletes a note by ID via DELETE request and updates local state.
 * @param {number|string} id - The unique ID of the note to delete.
 * @param {HTMLButtonElement} buttonEl - The clicked delete button reference.
 */
async function deleteNote(id, buttonEl) {
  // Note: JSONPlaceholder fakes POST creations (returning id 101+) without persisting them on the server. Sending DELETE /posts/{id} returns 200 OK for standard posts, and even if a fake id > 100 were rejected by a real server, we handle removal cleanly in local state after the request or fallback gracefully.
  try {
    buttonEl.disabled = true;
    setStatus('Deleting note...', 'loading');

    await request(`${API_URL}/${id}`, {
      method: 'DELETE',
    });

    notes = notes.filter((n) => n.id !== id);
    renderNotes();
    setStatus('Note deleted successfully.', 'success');
  } catch (error) {
    setStatus(`Failed to delete note: ${error.message}`, 'error');
    buttonEl.disabled = false;
  }
}

// Event Listeners
loadBtn.addEventListener('click', loadNotes);
noteForm.addEventListener('submit', createNote);

// Initial Render
renderNotes();

# QuickNotes — API Client & System Design

A complete frontend REST API client interface and backend system architecture design for **QuickNotes**—a high-scale cloud note-taking service engineered to support 1,000,000 active users with low latency, high availability, and data durability.

---

## 1. Project Overview

QuickNotes bridges client-side web applications with distributed cloud infrastructure. This repository contains both parts of the engineering specification:
1. **Frontend REST API Client:** An interactive browser interface built with vanilla HTML5, CSS3, and JavaScript (`api.js`) communicating asynchronously with a backend API (JSONPlaceholder practice backend) supporting `GET`, `POST`, and `DELETE` HTTP methods, input validation, and dynamic UI state handling.
2. **System Design & Backend Documentation:** Comprehensive system architecture, database schema, and REST API specification documents designed to scale the service to 1,000,000 users.

---

## 2. Repository Structure

```text
quicknotes-system-design/
├── index.html            # Main HTML5 application layout
├── style.css             # Responsive card-based design & status styling
├── api.js                # Async REST API client (GET, POST, DELETE & state management)
├── README.md             # Project documentation & summary
└── docs/
    ├── api-design.md     # Production RESTful API specification & status codes
    ├── data-model.md     # Relational database schema, ERD, SQL queries & indexes
    └── architecture.md   # Distributed system architecture diagram, load math & trade-offs
```

---

## 3. How to Run the API Client

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/Obraims/quicknotes-system-design.git
   cd quicknotes-system-design
   ```

2. **Open in Browser:**
   - Option A: Open `index.html` directly in any standard web browser (Chrome, Firefox, Edge, Safari).
   - Option B: Serve using VS Code **Live Server** extension or Python's built-in HTTP server:
     ```bash
     npx serve .
     # or
     python -m http.server 8000
     ```

3. **Test API Features:**
   - **Load Notes (GET):** Click **Load notes** to fetch 10 notes asynchronously from the backend API.
   - **Create Note (POST):** Fill in the **Title** (required, max 100 characters) and **Body** (optional), then submit the form to create a note and prepend it to the list.
   - **Delete Note (DELETE):** Click the **Delete** button on any note card to trigger a `DELETE` HTTP request and remove the note from local display.

---

## 4. System Design Documentation Links

Explore the detailed architecture and engineering specifications for the QuickNotes production backend:

- 📖 **[API Design Document](docs/api-design.md):** Complete REST API specification with 8 endpoints, request/response JSON schemas, authentication header requirements, and standardized HTTP error status codes (`400`, `401`, `403`, `404`, `500`).
- 🗄️ **[Data Model Document](docs/data-model.md):** Relational entity definitions (`users`, `notes`, `tags`, `note_tags`), composite B-tree index optimizations, `CREATE TABLE` SQL DDL, and relational vs. NoSQL architectural rationale.
- 🏗️ **[System Architecture Document](docs/architecture.md):** High-availability cloud system diagram, 1M user load estimates (writes/sec, reads/sec, annual storage), component breakdowns, request flow sequences, and SPOF redundancy strategies.

---

## 5. What I Learned

During the development of QuickNotes, key software engineering concepts were mastered:

- **Asynchronous REST API Integration & Clean State Management:** Built a reusable `request()` wrapper function around the `fetch` API, employing `try / catch / finally` blocks to handle network failures, HTTP error status codes, and button state management (`disabled`) while maintaining UI responsiveness.
- **Secure DOM Manipulation & XSS Prevention:** Applied defensive DOM manipulation patterns using `document.createElement()` and `textContent` rather than `innerHTML` to ensure user inputs are safely rendered without risking cross-site scripting vulnerabilities.
- **RESTful API Design & Status Code Standards:** Designed a production-grade API specification following REST principles, leveraging distinct HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) and standard HTTP status codes (`200 OK`, `201 Created`, `204 No Content`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `500 Internal Server Error`).
- **Relational Database Design & Index Tuning:** Modeled one-to-many (`1:N`) and many-to-many (`M:N`) relationships using junction tables (`note_tags`), cascading foreign keys, and composite B-tree indexes (`idx_notes_user_created`) to prevent `Filesort` operations and guarantee sub-millisecond query execution.
- **Distributed System Scaling & Capacity Planning:** Performed back-of-the-envelope capacity estimations for 1,000,000 users, designing a horizontally scalable, fault-tolerant architecture featuring DNS, CDN asset caching, Load Balancers, stateless App Servers, Redis caching, Primary/Read-Replica DB separation, and async Message Queues for background indexing.

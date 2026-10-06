# QuickNotes REST API Design Document

## 1. Overview & Authentication

This document specifies the production-grade RESTful API specification for **QuickNotes**—a scalable cloud note-taking service designed to serve 1,000,000 users.

- **Base URL:** `https://api.quicknotes.app/v1`
- **Protocol:** HTTPS (TLS 1.3 enforced)
- **Data Format:** `application/json` for all request bodies and response payloads.
- **Authentication Scheme:** JSON Web Token (JWT) Bearer Authentication. Client applications must supply a valid JWT token in the HTTP `Authorization` request header:
  ```http
  Authorization: Bearer <eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...>
  ```

---

## 2. API Endpoints Summary Table

| Method | Endpoint Path | Description | Success Status |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Authenticate user credentials and return JWT token | `200 OK` |
| `GET` | `/notes` | List authenticated user's notes with pagination, search, and tag filtering | `200 OK` |
| `GET` | `/notes/:id` | Retrieve detailed note record by ID | `200 OK` |
| `POST` | `/notes` | Create a new note with title, optional body, and tags | `201 Created` |
| `PUT` | `/notes/:id` | Replace/update all fields of an existing note | `200 OK` |
| `PATCH` | `/notes/:id` | Partially update specific note fields (e.g., title or pinned status) | `200 OK` |
| `DELETE` | `/notes/:id` | Permanently delete a note by ID | `204 No Content` |
| `GET` | `/tags` | List all unique tags associated with the authenticated user's notes | `200 OK` |

---

## 3. Detailed Endpoint Breakdown

### 3.1 `POST /auth/login`
- **Description:** Validates user credentials (`email` and `password`) and issues a signed JWT token valid for 24 hours.
- **Access Level:** Public

### 3.2 `GET /notes`
- **Description:** Retrieves a paginated list of notes belonging to the authenticated user.
- **Query Parameters:**
  - `page` (integer, default: `1`): Page number.
  - `limit` (integer, default: `10`, max: `100`): Items per page.
  - `tag` (string, optional): Filter notes by tag name (e.g., `?tag=work`).
  - `q` (string, optional): Search term matching title or body (e.g., `?q=meeting`).
- **Access Level:** Authenticated User (`Bearer Token`)

### 3.3 `GET /notes/:id`
- **Description:** Returns full details of a specific note owned by the user.
- **Access Level:** Authenticated User (`Bearer Token`)

### 3.4 `POST /notes`
- **Description:** Creates a new note record.
- **Validation Rules:**
  - `title`: Required string, 1 to 100 characters.
  - `body`: Optional string, up to 10,000 characters.
  - `tags`: Optional array of tag strings (max 10 tags per note).
- **Access Level:** Authenticated User (`Bearer Token`)

### 3.5 `PUT /notes/:id`
- **Description:** Replaces an existing note's `title`, `body`, and `tags`.
- **Access Level:** Authenticated User (`Bearer Token`)

### 3.6 `PATCH /notes/:id`
- **Description:** Modifies specified properties without replacing the entire note payload.
- **Access Level:** Authenticated User (`Bearer Token`)

### 3.7 `DELETE /notes/:id`
- **Description:** Removes a note record and disassociates its tag relationships.
- **Access Level:** Authenticated User (`Bearer Token`)

### 3.8 `GET /tags`
- **Description:** Fetches all distinct tags created by the logged-in user along with note counts.
- **Access Level:** Authenticated User (`Bearer Token`)

---

## 4. Request & Response JSON Examples

### 4.1 Creating a Note (`POST /notes`)

#### Request
```http
POST /v1/notes HTTP/1.1
Host: api.quicknotes.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "title": "Quarterly Architecture Review",
  "body": "Discuss database indexing strategy and Redis cache invalidation rules.",
  "tags": ["architecture", "work", "q4"]
}
```

#### Response (`201 Created`)
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": 10524,
  "userId": 42,
  "title": "Quarterly Architecture Review",
  "body": "Discuss database indexing strategy and Redis cache invalidation rules.",
  "tags": ["architecture", "work", "q4"],
  "createdAt": "2026-10-06T10:00:00Z",
  "updatedAt": "2026-10-06T10:00:00Z"
}
```

---

### 4.2 Listing Notes (`GET /notes?page=1&limit=10`)

#### Request
```http
GET /v1/notes?page=1&limit=10 HTTP/1.1
Host: api.quicknotes.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

#### Response (`200 OK`)
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": [
    {
      "id": 10524,
      "userId": 42,
      "title": "Quarterly Architecture Review",
      "body": "Discuss database indexing strategy and Redis cache invalidation rules.",
      "tags": ["architecture", "work", "q4"],
      "createdAt": "2026-10-06T10:00:00Z",
      "updatedAt": "2026-10-06T10:00:00Z"
    },
    {
      "id": 10519,
      "userId": 42,
      "title": "Grocery List",
      "body": "Milk, eggs, coffee beans, sourdough bread.",
      "tags": ["personal"],
      "createdAt": "2026-10-05T18:30:00Z",
      "updatedAt": "2026-10-05T18:30:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

## 5. Error Status Codes & Standard Error Response Body

The API uses standard HTTP response status codes to communicate request outcomes.

### 5.1 Status Codes Table

| HTTP Status Code | Description & Trigger Conditions |
| :--- | :--- |
| `400 Bad Request` | Missing required `title` field, `title` exceeds 100 characters, or malformed JSON payload. |
| `401 Unauthorized` | Missing, expired, or invalid `Authorization: Bearer <token>` header. |
| `403 Forbidden` | Authenticated user attempting to access, edit, or delete a note belonging to another user. |
| `404 Not Found` | Requested note ID or endpoint URL does not exist. |
| `500 Internal Server Error` | Unhandled server exception, database connection failure, or downstream service timeout. |

### 5.2 Standard Error Response JSON Format

All error responses adhere to a consistent JSON structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation error: Title is required and must be 100 characters or fewer.",
    "details": [
      {
        "field": "title",
        "issue": "Title cannot be empty."
      }
    ],
    "timestamp": "2026-10-06T10:30:00Z"
  }
}
```

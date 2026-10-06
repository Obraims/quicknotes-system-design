# QuickNotes Data Model Document

## 1. Entities & Schema Definitions

The QuickNotes backend utilizes a relational database schema designed for strict data integrity, high query throughput, and efficient multi-table joins.

### 1.1 `users` Table
Stores user account profiles and authentication credentials.

| Column | Type | Constraints | Primary Key | Foreign Key |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | `GENERATED ALWAYS AS IDENTITY` | **PK** | — |
| `name` | `VARCHAR(100)` | `NOT NULL` | — | — |
| `email` | `VARCHAR(255)` | `NOT NULL, UNIQUE` | — | — |
| `password_hash` | `TEXT` | `NOT NULL` | — | — |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | — | — |

---

### 1.2 `notes` Table
Stores user-created note content and metadata.

| Column | Type | Constraints | Primary Key | Foreign Key |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | `GENERATED ALWAYS AS IDENTITY` | **PK** | — |
| `user_id` | `BIGINT` | `NOT NULL` | — | **FK** -> `users(id)` |
| `title` | `VARCHAR(100)` | `NOT NULL` | — | — |
| `body` | `TEXT` | `NULL` | — | — |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | — | — |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | — | — |

---

### 1.3 `tags` Table
Stores unique categorisation labels owned by users.

| Column | Type | Constraints | Primary Key | Foreign Key |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | `GENERATED ALWAYS AS IDENTITY` | **PK** | — |
| `user_id` | `BIGINT` | `NOT NULL` | — | **FK** -> `users(id)` |
| `name` | `VARCHAR(50)` | `NOT NULL` | — | — |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | — | — |

---

### 1.4 `note_tags` Junction Table
Resolves the many-to-many relationship between notes and tags.

| Column | Type | Constraints | Primary Key | Foreign Key |
| :--- | :--- | :--- | :--- | :--- |
| `note_id` | `BIGINT` | `NOT NULL` | **Composite PK** | **FK** -> `notes(id)` |
| `tag_id` | `BIGINT` | `NOT NULL` | **Composite PK** | **FK** -> `tags(id)` |

---

## 2. Relationships Explanation

### 2.1 One-to-Many (`1:N`) Relationships
- **`users` -> `notes` (`1:N`):** A single user can author multiple notes. Each note is strictly owned by exactly one user via `notes.user_id = users.id`. Deleting a user automatically deletes all associated notes via `ON DELETE CASCADE`.
- **`users` -> `tags` (`1:N`):** A user can define custom tags for organizing notes. Each tag is tied to its owner via `tags.user_id = users.id`.

### 2.2 Many-to-Many (`M:N`) Relationship
- **`notes` <-> `tags` (`M:N`):** A note can have multiple tags assigned (e.g., `#architecture`, `#work`), and a single tag can be attached to multiple notes.
- **Junction Table Resolution:** The `note_tags` table decomposes the `M:N` relationship into two clean `1:N` relationships (`notes` 1:N `note_tags` and `tags` 1:N `note_tags`). The composite primary key `(note_id, tag_id)` guarantees that a tag cannot be linked to the same note twice.

---

## 3. SQL `CREATE TABLE` Statements

```sql
-- Enable UUID extension if required
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Users Table
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Create Notes Table
CREATE TABLE notes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    body TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 3. Create Tags Table
CREATE TABLE tags (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_user_tag_name UNIQUE (user_id, name)
);

-- 4. Create Note_Tags Junction Table
CREATE TABLE note_tags (
    note_id BIGINT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);
```

---

## 4. Example SQL Queries

### Query 1: Fetch 20 Most Recent Notes for a Specific User
```sql
SELECT id, title, body, created_at, updated_at
FROM notes
WHERE user_id = 42
ORDER BY created_at DESC
LIMIT 20;
```

### Query 2: Fetch All Notes for a User Filtered by Tag (`JOIN`)
```sql
SELECT n.id, n.title, n.body, n.created_at, t.name AS tag_name
FROM notes n
JOIN note_tags nt ON n.id = nt.note_id
JOIN tags t ON nt.tag_id = t.id
WHERE n.user_id = 42 AND t.name = 'work'
ORDER BY n.created_at DESC;
```

### Query 3: List All Tags for a User with Note Counts (`LEFT JOIN` + `GROUP BY`)
```sql
SELECT t.id, t.name, COUNT(nt.note_id) AS note_count
FROM tags t
LEFT JOIN note_tags nt ON t.id = nt.tag_id
WHERE t.user_id = 42
GROUP BY t.id, t.name
ORDER BY note_count DESC;
```

### Query 4: Insert a New Note and Link It to a Tag
```sql
-- Step A: Insert Note
INSERT INTO notes (user_id, title, body)
VALUES (42, 'Quarterly Architecture Review', 'Discuss database indexing and caching.')
RETURNING id;

-- Step B: Attach Tag (Assuming tag_id = 7 exists)
INSERT INTO note_tags (note_id, tag_id)
VALUES (10524, 7);
```

---

## 5. Indexes & Performance Reasoning

To support high query volume across 1,000,000 users, we define the following composite B-tree indexes:

```sql
-- Composite index for user note feeds sorted by timestamp
CREATE INDEX idx_notes_user_created ON notes(user_id, created_at DESC);

-- Index on junction table foreign key for reverse tag lookups
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
```

### Performance Rationale
- **`idx_notes_user_created`:** When querying `WHERE user_id = 42 ORDER BY created_at DESC`, a standard single-column index on `user_id` forces the database engine to fetch all of user 42's notes into memory and perform a costly CPU sort (`Filesort`). The composite index `(user_id, created_at DESC)` allows PostgreSQL to perform an **Index Scan** directly to user 42's subset already pre-sorted in reverse chronological order, executing in under 1ms even when the `notes` table scales to tens of millions of rows.
- **`idx_note_tags_tag_id`:** The composite primary key on `note_tags(note_id, tag_id)` automatically indexes `note_id`. Adding an explicit index on `tag_id` ensures reverse lookups (finding all notes assigned to a specific tag) run efficiently without full table scans on the junction table.

---

## 6. SQL vs. NoSQL Justification

A relational **SQL** database (specifically **PostgreSQL**) is chosen over a NoSQL document database (such as MongoDB) for QuickNotes for the following architectural reasons:

1. **Relational Integrity & Cascading Deletes:** QuickNotes relies heavily on relational constraints across `users`, `notes`, `tags`, and `note_tags`. SQL foreign key constraints with `ON DELETE CASCADE` guarantee that deleting a user or note cleanly purges orphaned records across junction tables automatically, preventing data corruption.
2. **Multi-Table JOIN Efficiency:** Filtering notes by user tags requires joining `notes`, `note_tags`, and `tags`. Relational engines are highly optimized for join operations and indexing across junction tables, whereas document databases require complex aggregation pipelines or duplicate embedded arrays.
3. **ACID Transactions:** Financial, security, and tagging operations require strict ACID (Atomicity, Consistency, Isolation, Durability) compliance. SQL guarantees atomic writes when creating notes and linking multiple tag IDs simultaneously.
4. **Structured Schema Validation:** Strict column data types (e.g., `VARCHAR(100)` for titles) enforce validation at the database level, serving as a reliable line of defense against malformed data.

# QuickNotes System Architecture Document

## 1. System Requirements

### 1.1 Functional Requirements
1. **User Authentication:** Users can register, log in, and securely access their private notes via JWT authentication.
2. **Note Management:** Users can create notes (with title, optional body, and custom tags), list/load their notes, update existing notes, and delete notes.
3. **Search & Filtering:** Users can filter notes by tag (e.g., `?tag=work`) or perform full-text search across titles and bodies (e.g., `?q=meeting`).
4. **Cross-Device Sync:** Changes made on one client (web browser or mobile app) synchronize instantly across all devices.

### 1.2 Non-Functional Requirements
1. **High Availability:** 99.9%+ service availability (less than 8.76 hours of downtime per year).
2. **Low Latency:** Sub-200ms p95 latency for read queries (`GET /notes`) and sub-300ms p95 latency for write operations (`POST /notes`).
3. **Scalability:** System architecture engineered to support **1,000,000 registered users** and peak traffic bursts gracefully.
4. **Data Consistency & Durability:** Zero data loss guarantee for created notes; strict database durability with multi-AZ replication and automated daily backups.
5. **Security:** TLS 1.3 encryption in transit, bcrypt/Argon2 password hashing at rest, JWT signature verification, input validation, and parameterized SQL queries to prevent XSS and SQL injection attacks.

---

## 2. Back-of-the-Envelope Load Estimates (1 Million Users)

### 2.1 Core Assumptions
- **Total Registered Users:** 1,000,000 users.
- **Daily Active Users (DAU):** 100% active load model = **1,000,000 DAU** (25% baseline DAU = 250,000 users).
- **Feed Views & Reads per Active User:** 20 reads/day (loading feeds, viewing notes, tag filtering).
- **Note Creations & Writes per Active User:** 2 writes/day (creating new notes, editing, deleting).
- **Total Daily Read Operations:** 1,000,000 active users × 20 reads/day = **20,000,000 reads/day**.
- **Total Daily Write Operations:** 1,000,000 active users × 2 writes/day = **2,000,000 writes/day**.
- **Average Note Payload Size:** 2 KB (2,000 bytes) including title, body, tags, and JSON metadata.
- **Time Conversions:** 1 day = 86,400 seconds (exact math) $\approx$ 100,000 seconds (back-of-the-envelope approximation).
- **Peak Traffic Multiplier:** **5x** average traffic.

---

### 2.2 Throughput Calculations

#### A. Read Throughput (GET /notes)
- **Average Reads per Second:**
  - Exact calculation: $\frac{20,000,000 \text{ reads}}{86,400 \text{ seconds}} = \mathbf{231.48 \text{ reads/sec}}$
  - Approximation: $\frac{20,000,000 \text{ reads}}{100,000 \text{ seconds}} = \mathbf{200 \text{ reads/sec}}$
- **Peak Reads per Second (5x Multiplier):**
  - $231.48 \text{ reads/sec} \times 5 = \mathbf{1,157.40 \text{ reads/sec}}$

#### B. Write Throughput (POST /notes, DELETE /notes)
- **Average Writes per Second:**
  - Exact calculation: $\frac{2,000,000 \text{ writes}}{86,400 \text{ seconds}} = \mathbf{23.15 \text{ writes/sec}}$
  - Approximation: $\frac{2,000,000 \text{ writes}}{100,000 \text{ seconds}} = \mathbf{20 \text{ writes/sec}}$
- **Peak Writes per Second (5x Multiplier):**
  - $23.15 \text{ writes/sec} \times 5 = \mathbf{115.74 \text{ writes/sec}}$

#### C. Read-to-Write Ratio
- $\text{Read-to-Write Ratio} = \frac{20,000,000 \text{ reads}}{2,000,000 \text{ writes}} = \mathbf{10:1 \text{ (Read-Heavy Platform)}}$
- *Architectural Implication:* A 10:1 read-to-write ratio justifies heavy caching layers (Redis) and database read replicas to offload read pressure from the primary write database.

---

### 2.3 Storage Growth Estimates
- **Daily Raw Data Ingestion:**
  $$2,000,000 \text{ writes/day} \times 2 \text{ KB} = 4,000,000 \text{ KB/day} = \mathbf{4 \text{ GB/day}}$$
- **Annual Storage Growth (Raw Data):**
  $$4 \text{ GB/day} \times 365 \text{ days} = \mathbf{1.46 \text{ TB/year}}$$
- **Total Storage (Including Indexes, Logs, and Backups +25%):**
  $$1.46 \text{ TB} \times 1.25 = \mathbf{1.83 \text{ TB/year}}$$

---

## 3. System Architecture Diagram

```text
                              +--------------------------+
                              | Client (Browser / App)   |
                              +------------+-------------+
                                    |            |
                     Static Assets  |            | API Requests (HTTPS / JWT)
                     (HTML/CSS/JS)  v            v
                        +---------------+    +---------------+
                        |      DNS      |    | Load Balancer |
                        +-------+-------+    +-------+-------+
                                |                    |
                                v                    v
                        +---------------+    +-----------------------------+
                        |      CDN      |    | Stateless App Servers Fleet |
                        +---------------+    | (App Server 1 & Server 2)   |
                                             +----+-------+-----------+----+
                                                  |       |           |
                                                  |       |           v
                                                  |       |   +---------------+
                                                  |       |   | Cache (Redis) |
                                                  |       |   +---------------+
                                                  v       v
                                          +---------------+   +----------------------+
                                          | Primary DB    |   | Read Replica DB      |
                                          | (Writes)      |   | (Reads)              |
                                          +---------------+   +----------------------+
                                                  |
                                                  v
                                      +-----------------------+      +----------------------+
                                      | Message Queue         |----->| Background Worker    |
                                      | (RabbitMQ / Kafka)    |      | (Search Indexer)     |
                                      +-----------------------+      +----------------------+
```

---

## 4. Component Explanations (One Sentence Per Component)

- **Client (Browser / Mobile App):** Provides the interactive frontend interface for users to create, view, edit, search, and delete their notes.
- **DNS (Domain Name System):** Resolves human-readable domain names (`api.quicknotes.app`) to the IP address of the Load Balancer with ultra-fast latency.
- **CDN (Content Delivery Network):** Caches and delivers static web application assets (HTML, CSS, JavaScript) from edge locations worldwide to minimize initial page load times.
- **Load Balancer:** Distributes incoming HTTPS API traffic evenly across multiple stateless app servers to prevent server overload and ensure high availability.
- **Stateless App Servers (App Server 1, App Server 2, App Server N):** Executes application logic, validates JWT tokens, handles business rules, and coordinates database and cache operations without storing session state locally.
- **Cache (Redis):** Stores hot user note feeds, session payloads, and frequent query results in memory to deliver sub-millisecond read responses and shield the database from read traffic spikes.
- **Primary Database (Writes):** Manages relational data storage as the single authoritative source of truth for write transactions, enforcing relational integrity and schema constraints.
- **Read Replica Database (Reads):** Asynchronously replicates data from the Primary Database to serve read queries at scale without degrading write performance.
- **Message Queue (RabbitMQ / Kafka):** Holds asynchronous background processing jobs in a durable buffer so heavy long-running tasks do not block client HTTP request execution.
- **Background Worker:** Consumes background jobs from the message queue to execute full-text search indexing, audit logging, and export generation asynchronously.

---

## 5. Step-by-Step Request Flows

### 5.1 Read Path Flow (`GET /notes`)
```text
Client ---> Load Balancer ---> App Server ---> Redis Cache (Hit?) ---> Return 200 OK
                                                   | (Miss)
                                                   v
                                          Read Replica DB ---> Set Redis ---> Return 200 OK
```
1. **Client Request:** The user opens QuickNotes; the browser sends an HTTP `GET /v1/notes?page=1&limit=10` request with header `Authorization: Bearer <token>`.
2. **Routing & Load Balancing:** **DNS** directs the request to the **Load Balancer**, which forwards it to an available **App Server** node.
3. **Authentication & Cache Check:** The **App Server** validates the JWT signature, extracts `userId = 42`, and checks the **Redis Cache** for key `user:42:notes:page1`.
4. **Cache Hit Path (Fast Path):** If data exists in **Redis**, the **App Server** returns the cached JSON list immediately with `200 OK` in < 20ms.
5. **Cache Miss Path (Fallback Path):** If data is missing from **Redis**, the **App Server** queries the **Read Replica Database** using `idx_notes_user_created`, stores the resulting JSON array into **Redis** with a 5-minute TTL, and returns the response with `200 OK`.

---

### 5.2 Write Path Flow (`POST /notes`)
```text
Client ---> Load Balancer ---> App Server ---> Primary DB (INSERT) ---> Replication ---> Read Replica DB
                                                    |
                                                    +---> Invalidate Redis Cache
                                                    |
                                                    +---> Message Queue ---> Background Worker ---> Search Index
                                                    |
                                                    v
                                             Return 201 Created
```
1. **Client Request:** The user submits the note creation form; the client sends `POST /v1/notes` with JSON payload `{ "title": "Review", "body": "Notes..." }`.
2. **Validation & App Server Processing:** The **Load Balancer** routes the request to an **App Server**, which validates input length (title required, max 100 chars).
3. **Database Write:** The **App Server** executes `INSERT INTO notes (user_id, title, body) VALUES (42, 'Review', 'Notes...')` on the **Primary Database**, returning the newly generated `id = 10524`.
4. **Asynchronous Replication:** The **Primary Database** streams the write transaction to the **Read Replica Database** via streaming replication.
5. **Cache Invalidation:** The **App Server** invalidates user 42's cached note list keys (`user:42:notes:*`) in **Redis Cache**.
6. **Async Job Enqueueing:** The **App Server** publishes an `index_note` job to the **Message Queue** for the **Background Worker** to update Elasticsearch/Solr full-text search indexes.
7. **Client Response:** The **App Server** immediately returns `201 Created` with the new note payload `{ "id": 10524, "status": 201, ... }` to the client in < 100ms.

---

## 6. Architectural Trade-offs & Single Points of Failure (SPOF)

### 6.1 Architectural Trade-offs

1. **Caching & Read Replicas (Low Latency vs. Eventual Consistency & Invalidation Complexity):**
   - *Trade-off:* Caching note feeds in Redis and querying Read Replicas enables QuickNotes to handle ~1,150 peak reads/sec with sub-20ms latency. The trade-off is replication lag (typically 5–50ms) and cache invalidation complexity, where a user updating a note on one device might see stale cached data for a few milliseconds if cache invalidation experiences a delay.

2. **Asynchronous Message Queue + Worker (Fast Write Latency vs. Search Index Consistency):**
   - *Trade-off:* Offloading full-text search indexing to a background worker via a message queue allows `POST /notes` to respond instantly in milliseconds. The trade-off is eventual consistency for search results: a newly created note might take 1–2 seconds to appear in complex keyword search results (`GET /notes?q=keyword`).

3. **Horizontal Stateless App Fleet (High Availability vs. Operational & Infrastructure Cost):**
   - *Trade-off:* Running multiple stateless app servers behind a load balancer guarantees that no single node crash impacts overall service availability. The trade-off is higher infrastructure cost and operational overhead in managing container orchestration (Kubernetes / ECS).

---

### 6.2 Eliminating Single Points of Failure (SPOF)

| Architecture Layer | SPOF Protection Strategy |
| :--- | :--- |
| **DNS / CDN** | Multi-region edge deployment with automatic failover managed by Cloudflare / AWS Route 53. |
| **Load Balancer** | Active-Passive Dual Load Balancer pair with floating virtual IP (VIP) across multiple Availability Zones (AZs). |
| **App Servers** | Fleet of 2+ stateless App Servers managed by Auto Scaling Groups with health-check automatic replacement. |
| **Cache (Redis)** | Redis Sentinel cluster with multi-node automatic failover; if Redis goes down completely, app servers fall back gracefully to querying database read replicas directly. |
| **Primary Database** | PostgreSQL Multi-AZ deployment with synchronous standby replica and automated failover in under 30 seconds. |
| **Message Queue** | Clustered RabbitMQ/Kafka nodes with persistent disk storage and automatic message retry queues. |

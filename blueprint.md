# Local Workflow Runner for Excel Inventory Updates
*A blueprint for a local, free, browser-based app that lets a non-dev user define “workflows” (like Sales → Deduct from Inventory), preview proposed changes, approve, and export updated files. Designed to later add Google Drive/Sheets as input/output sources.*

---

## 0) Goals and constraints

### Goals
- Run **locally** as a service on a PC/Mac.
- UI in the **browser** (localhost).
- User can **create/edit workflows** (mapping columns + rules).
- User can **run** a workflow by drag & drop / file picker.
- App shows **proposed changes** (diff) + warnings.
- User **approves** → app exports:
  - updated inventory as **Excel**
  - optional **PDF summary**
- Store workflow definitions + run history locally (audit trail).
- No paid dependencies.

### Non-goals (v1)
- No Google OAuth / Drive integration in v1 (but keep architecture ready).
- No complex node-graph editor (wizard-style editor first).
- No multi-user / cloud hosting.

---

## 1) High-level architecture

### Components
1) **Local API + Engine (Python)**
   - Reads input files, infers schemas, executes workflows, generates diffs, exports results.
2) **Local Web UI (React)**
   - Workflow builder + run screen + preview diffs + export actions.
3) **Local storage (SQLite)**
   - Workflows, mappings, run history, file fingerprints, audit events.

### Runtime flow
- User opens app → browser UI at `http://127.0.0.1:<port>`
- User creates workflow → stored as JSON in SQLite
- User runs workflow → uploads files (or selects)
- Engine executes → returns **RunResult** (diff + outputs preview)
- User approves → engine generates output Excel/PDF and returns a download link/path

### Data flow diagram (conceptual)
```mermaid
flowchart LR
  UI[Browser UI] -->|HTTP| API[Local API]
  API -->|read/parse| Files[Uploaded Excel files]
  API --> Engine[Workflow Engine]
  Engine -->|diff + preview| API
  API --> UI
  Engine -->|write| Out[Output Excel/PDF]
  API -->|download| UI
  API <--> DB[(SQLite)]
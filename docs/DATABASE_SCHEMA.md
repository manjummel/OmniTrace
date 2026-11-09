# Blast Radius Live — Database Schema & Local Storage Specification

## 1. Storage Strategy: Local-First with Optional Cloud Sync

To maintain strict source code privacy:
1. **Primary State**: Kept in-memory and persisted in local disk cache (`.blast-radius/state.json`).
2. **Cloud State (Optional Firebase Firestore)**: Stores **only** project metadata, team sharing configurations, finding statistics (anonymized without secret content or proprietary code snippets), and user preferences.

---

## 2. Cloud Firestore Schema (Optional Sync)

### 2.1 Collection: `users/{userId}`
Stores user identity and profile settings.
```json
{
  "id": "usr_99812",
  "email": "developer@company.com",
  "displayName": "Jane Doe",
  "createdAt": "2026-11-01T10:00:00Z",
  "settings": {
    "defaultTheme": "dark",
    "soundAlerts": false,
    "claudeHookPolicy": "warn_and_block_critical"
  }
}
```

### 2.2 Collection: `projects/{projectId}`
Stores project configuration and aggregate metrics.
```json
{
  "id": "proj_a7b8c9",
  "ownerId": "usr_99812",
  "name": "payment-gateway-service",
  "repoIdentifier": "github.com/company/payment-gateway-service",
  "createdAt": "2026-11-05T12:00:00Z",
  "updatedAt": "2026-11-09T08:30:00Z",
  "policy": {
    "blockOnCritical": true,
    "allowUnusedExports": false,
    "ignorePaths": ["**/node_modules/**", "**/dist/**", "**/*.min.js"]
  },
  "metrics": {
    "totalNodes": 342,
    "totalEdges": 718,
    "activeFindingsCount": 4,
    "riskIndex": 42
  }
}
```

### 2.3 Collection: `projects/{projectId}/findings_history/{findingId}`
Stores audit records of detected issues and their resolution status (with strict secret redaction).
```json
{
  "id": "fnd_8829102",
  "agent": "Reality Check",
  "severity": "CRITICAL",
  "confidence": 0.95,
  "category": "MISSING_EXPORT",
  "filePath": "src/services/billing.ts",
  "line": 18,
  "title": "Module has no exported member 'calculateVat'",
  "redactedEvidence": "import { calculateVat } from './taxEngine';",
  "status": "DISMISSED",
  "dismissalReason": "Refactoring in next commit",
  "detectedAt": "2026-11-09T08:15:00Z",
  "resolvedAt": "2026-11-09T08:20:00Z"
}
```

---

## 3. Local In-Memory & File Cache Schema (`.blast-radius/state.json`)

```typescript
export interface LocalProjectState {
  version: '1.0.0';
  projectRoot: string;
  lastScanned: number;
  graph: {
    nodes: Array<{
      id: string;
      label: string;
      kind: 'file' | 'function' | 'class' | 'interface' | 'variable';
      filePath: string;
      line: number;
      column: number;
      isExported: boolean;
      incomingCallsCount: number;
      outgoingCallsCount: number;
      blastRadiusScore: number;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      type: 'imports' | 'calls' | 'instantiates' | 'inherits';
      confidence: 'exact' | 'uncertain';
    }>;
  };
  findings: Array<{
    id: string;
    agent: 'Reality Check' | 'Hardcode Hunter' | 'Scope Guard' | 'Test Guardian' | 'Impact Analyst';
    filePath: string;
    line: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    confidence: number;
    title: string;
    evidence: string;
    explanation: string;
    suggestedFix?: string;
    timestamp: number;
    status: 'ACTIVE' | 'DISMISSED' | 'FIXED';
    dismissalReason?: string;
  }>;
  policies: {
    blockOnCritical: boolean;
    quarantineScopeViolations: boolean;
    failOnHardcodedSecrets: boolean;
  };
}
```

---

## 4. Firestore Security Rules (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function
    function isAuthenticated() {
      return request.auth != null;
    }
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    match /users/{userId} {
      allow read, write: if isOwner(userId);
    }

    match /projects/{projectId} {
      allow read, write: if isAuthenticated() && (resource == null || resource.data.ownerId == request.auth.uid);
      
      match /findings_history/{findingId} {
        allow read, write: if isAuthenticated() && get(/databases/$(database)/documents/projects/$(projectId)).data.ownerId == request.auth.uid;
      }
    }
  }
}
```


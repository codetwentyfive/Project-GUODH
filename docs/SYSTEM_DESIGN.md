# CareCall System Design Documentation

## System Architecture Overview

```
+-------------------+      +---------------------+      +---------------------+
| Caretaker Web UI  | <--> |  Backend API (Node.js) | <--> | PostgreSQL Database |
| (React/Next.js)   |      |  (Express.js, Prisma)  |      | (Patient Data,     |
+-------------------+      +---------------------+      |  Keywords, Logs,    |
       ^                               |                  |  Recording Settings) |
       |                               |                  +---------------------+
       |  API Requests                 |                        ^
       +-------------------------------+------------------------| Recording Storage
                                             |
                                             |      +-------------------+
                                             |----->|  Twilio Platform  |
                                             |      | (Telephony, STT,   |
                                             |      |  SMS, Recording)  |
                                             +-------------------+
                                                     ^
                                                     | Voice Call, Transcribed Text
                                                     |
                                             +-------------------+
                                             | Dementia Patient  |
                                             | (Receives Call)   |
                                             +-------------------+
```

## Core Components

### 1. Frontend (Caretaker Web UI)
- **Technology**: Next.js 14 (App Router), TypeScript, Shadcn UI, Tailwind CSS
- **Key Features**:
  - Patient management dashboard
  - Call scheduling interface
  - Recording management
  - Keyword configuration
  - Call logs and transcripts viewer
  - Real-time notifications

### 2. Backend API
- **Technology**: Node.js, Express.js, Prisma ORM
- **Key Features**:
  - RESTful API endpoints
  - Authentication & authorization
  - Call orchestration
  - Keyword detection
  - Recording management
  - Notification system

### 3. Database
- **Technology**: PostgreSQL
- **Key Tables**:
  - Users (Caretakers)
  - Patients
  - Keywords
  - CallLogs
  - RecordingMetadata

### 4. External Services
- **Twilio Integration**:
  - Voice calls
  - Speech-to-Text
  - Call recording
  - SMS notifications

## Key Features & Implementation

### Call Recording System
1. **Opt-in Configuration**:
   - Boolean flag in Patient table
   - UI toggle in patient settings
   - Privacy-first approach (default: disabled)

2. **Recording Storage**:
   - Cloud storage (AWS S3/Google Cloud Storage)
   - Encrypted at rest
   - Secure access controls
   - Retention policy enforcement

3. **Recording Metadata**:
   - URL to recording
   - Duration
   - Format
   - Associated call log ID

### Privacy & Security Considerations

1. **Data Protection**:
   - End-to-end encryption
   - HIPAA compliance measures
   - Secure data transmission
   - Access control and audit logging

2. **Consent Management**:
   - Explicit opt-in for recording
   - Caretaker authorization
   - Clear privacy policies
   - Data retention controls

3. **Regulatory Compliance**:
   - HIPAA (US healthcare)
   - GDPR (EU data protection)
   - CCPA (California privacy)
   - Regional telecom regulations

## Scalability Considerations

1. **Infrastructure**:
   - Containerized deployment
   - Load balancing
   - Horizontal scaling
   - Caching strategies

2. **Performance**:
   - Database indexing
   - Query optimization
   - Connection pooling
   - Asset optimization

3. **Monitoring**:
   - System health metrics
   - Error tracking
   - Performance monitoring
   - Usage analytics

## Development Phases

### Phase 1: MVP (4-6 weeks)
- Basic call functionality
- Simple keyword detection
- Essential UI features
- Core security measures

### Phase 2: Enhancement (6-8 weeks)
- Advanced voice analysis
- Improved UI/UX
- Extended features
- Performance optimization

### Phase 3: Scale (8-10 weeks)
- Advanced analytics
- Integration capabilities
- Enhanced security
- Production readiness

## Future Considerations

1. **AI Integration**:
   - Sentiment analysis
   - Conversation context
   - Behavioral patterns
   - Predictive analytics

2. **Platform Extension**:
   - Mobile application
   - Care facility integration
   - Family portal
   - API marketplace

3. **Business Growth**:
   - Multi-tenant architecture
   - White-label solutions
   - API monetization
   - Enterprise features 
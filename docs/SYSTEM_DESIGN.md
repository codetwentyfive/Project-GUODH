# CareCall System Design Documentation

## System Architecture Overview

    +-------------------+      +---------------------+      +---------------------+
    | Caretaker Web UI  | <--> |  Backend API        | <--> | PostgreSQL Database |
    | (React/Next.js)   |      | (Node.js, Express,  |      | (Patient Data,      |
    +-------------------+      |  Prisma, TypeScript)|      |  Keywords, Logs,    |
           ^                   +---------------------+       |  Recording Settings)|
           |                              ^                  +---------------------+
           |         API Requests         |
           +------------------------------+------------------------+
                                          |
                                          |     +--------------------------------+
                                          |---->| Web Voice & STT Service        |
                                          |     | (e.g., WebRTC, Speech-to-Text, |
                                          +-----+  Recording)                    +
                                                ^
                                                | Web-based Voice Call & Transcribed Text
                                                |
                                       +-------------------+
                                       | Dementia Patient  |
                                       | (Receives Call)   |
                                       +-------------------+

## Core Components

### 1. Frontend (Caretaker Web UI)
- **Technology**: Next.js 14 (App Router), TypeScript, Shadcn UI, Tailwind CSS  
- **Key Features**:
  - Patient management dashboard  
  - Call scheduling/initiating interface (using a web-based solution)  
  - Recording management  
  - Keyword configuration  
  - Call logs and transcripts viewer  
  - Real-time or near-real-time notifications (e.g., email or web push)

### 2. Backend API
- **Technology**: Node.js, Express.js, Prisma ORM, TypeScript  
- **Key Features**:
  - RESTful API endpoints  
  - Authentication & authorization  
  - Web-based call orchestration (e.g., coordinating WebRTC sessions)  
  - Keyword detection  
  - Recording management  
  - Notification system (email, push, etc.)

### 3. Database
- **Technology**: PostgreSQL  
- **Key Tables**:
  - **Users** (Caretakers)  
  - **Patients**  
  - **Keywords**  
  - **CallLogs**  
  - **RecordingMetadata**  

### 4. External Services
- **Web Voice & STT Integration**:
  - Voice calls over the internet (e.g., WebRTC)  
  - Speech-to-Text using a third-party API (e.g.,opensource/whisper) or self-hosted engine  
  - Recording (if supported by the platform or via a custom server-side solution)  
  - Notifications (e.g., email, push) in place of SMS

---

## Key Features & Implementation

### Call Recording System

1. **Opt-in Configuration**  
   - Boolean flag in the Patient table (e.g., `recordCalls: boolean`)  
   - UI toggle in patient settings  
   - Privacy-first approach (default: disabled)

2. **Recording Storage**  
   - Store recordings in a secure storage solution (e.g., AWS S3/Google Cloud)  
   - Encrypted at rest  
   - Secure access controls  
   - Retention policy enforcement

3. **Recording Metadata**  
   - URL or identifier of the recording  
   - Duration (if available)  
   - Audio format  
   - Associated call log ID

---

### Privacy & Security Considerations

1. **Data Protection**  
   - Encrypted data transmission (HTTPS/WebRTC secure channels)  
   - Basic HIPAA compliance measures  
   - Secure data storage and retrieval  
   - Strict access control and audit logging

2. **Consent Management**  
   - Explicit opt-in for recording  
   - Caretaker authorization  
   - Clear privacy policies  
   - Data retention controls

3. **Regulatory Compliance**  
   - HIPAA (US healthcare)  
   - GDPR (EU data protection)  
   - CCPA (California privacy)  
   - Potential regional communication regulations (as applicable to internet-based voice services)

---

## Scalability Considerations

1. **Infrastructure**  
   - Containerized deployments (e.g., Docker, Kubernetes)  
   - Load balancing for backend services  
   - Horizontal scaling of the backend and STT service  
   - Caching strategies (e.g., Redis)

2. **Performance**  
   - Database indexing for efficient queries  
   - Query optimization and connection pooling  
   - Efficient handling of audio data  
   - Client-side performance optimization (e.g., asset bundling, code splitting)

3. **Monitoring**  
   - System health metrics and logging  
   - Error tracking (e.g., Sentry)  
   - Performance monitoring (APM tools)  
   - Usage analytics (call usage, concurrency)

---

## Development Phases

### Phase 1: MVP (4–6 weeks)
- Basic web-based call functionality  
- Simple keyword detection  
- Essential UI features  
- Core security measures (authentication, protected endpoints)

### Phase 2: Enhancement (6–8 weeks)
- Advanced voice analysis (improved STT, real-time transcription)  
- Improved UI/UX  
- Extended notification options (push, email templates)  
- Performance tuning & minor feature expansions

### Phase 3: Scale (8–10 weeks)
- Advanced analytics & reporting  
- Broader integration (3rd-party EHRs, multiple STT engines)  
- Enhanced security & compliance  
- Production readiness (load/stress testing)

---

## Future Considerations

1. **AI Integration**  
   - Sentiment analysis  
   - Conversation context (NLP)  
   - Behavioral patterns (predictive flags)  
   - Real-time suggestions for caretakers

2. **Platform Extension**  
   - Dedicated mobile application for remote caretakers  
   - Care facility integration for group management  
   - Family portal for shared visibility  
   - API marketplace for third-party expansions

3. **Business Growth**  
   - Multi-tenant architecture for enterprise solutions  
   - White-label offerings for care organizations  
   - API monetization strategy  
   - Advanced features (e.g., concurrency-based pricing)

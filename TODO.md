# Family Tree - TODO

## High Priority
- [x] **Image cropping UI** — Upload large image, zoom/resize to focus on face. Circular crop for round avatars.
- [x] **Avatar upload button** — Replace text input in edit form with proper file upload button
- [x] **Mobile-friendly date picker** — Birthday field needs a touch-friendly date selector

## Medium Priority
- [ ] **Sync with server changes** — Detect when another user made changes and update the UI accordingly (polling or WebSocket)
- [ ] **Delete orphaned images** — Clean up images when person is deleted (need to handle back button revert scenario)
- [ ] **Docker containerization** — Create Dockerfile for production deployment
- [ ] **Error handling UI** — Show user-friendly errors when API calls fail
- [ ] **Loading states** — Show spinner while fetching/saving tree data
- [x] **Death date** - Add a death date to the UI.
- [ ] **Translate** - Translate the UI to German.

## Low Priority
- [ ] **Two people editing** - make a lock so only one person can edit at the same time.
- [ ] **Export tree** — Export family tree as JSON or image
- [ ] **Tree name editing** — Allow editing the tree name (stored in DB but not exposed in UI)

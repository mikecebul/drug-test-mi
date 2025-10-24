# TODO List - Drug Test MI Application

This file tracks incomplete features and future enhancements that need to be implemented.

## ✅ Recently Completed
- **Dashboard Migration**: Successfully migrated all core dashboard pages from TanStack Query to server components + Payload local API pattern
- **Profile Page**: Full implementation with view/edit modes, tabs, form validation, and TanStack Form integration
- **Medications Management**: Complete CRUD operations with status tracking (active/discontinued), 7-day edit windows, and server actions
- **Results Page**: Drug test results display with advanced filtering (date range, result status, test type), chain of custody visualization
- **Main Dashboard**: Stats display and recent test overview with proper data fetching
- **Schedule Page**: Cal.com booking integration with pre-filled user data

## Profile Page Features
- [ ] **Security Section Buttons**: Implement functionality for Change Password, Download My Data, and Privacy Settings buttons in the profile page security section
  - *Currently commented out with placeholder text*
- [ ] **Account Settings**: Create account settings page and implement proper navigation

## Dashboard Features
- [ ] **Appointments Page**: Implement recurring appointments management page
  - *Currently shows "Coming Soon" placeholder*
  - Replace placeholder with real appointment data and management features
  - Consider integration with Cal.com bookings
- [ ] **Settings Page**: Create settings page with user preferences and configuration options
  - Email preferences
  - Notification settings
  - Display preferences
- [ ] **Get Help Page**: Create help/support page with documentation and contact information
  - FAQs
  - Contact form
  - Support resources

## Navigation & UI
- [ ] **UserNav Menu Items**: Implement functionality for Account, Billing, and Notifications buttons in the user navigation dropdown (logout currently works)
  - *Currently commented out in nav-user.tsx*
- [ ] **Secondary Sidebar Links**: Complete Settings and Get Help navigation links
  - *Currently commented out in app-sidebar.tsx*

## Drug Test Reporting System
- [ ] **Automatic Email Notifications**: Create system to automatically email referrals (probation officers, employers, etc.) when drug test reports are added
  - Should trigger when test results are uploaded/finalized
  - Different email templates for different client types (probation vs employment vs self-pay)
  - Include test results summary and next steps

- [ ] **Initial Screening Report Field**: Add report field for initial screening results to drug tests
  - Upload capability for PDF reports
  - Secure storage in PrivateMedia collection
  - Proper access control based on user/admin permissions

- [ ] **Confirmation Test Report Field**: Add optional confirmation test report field for cases requiring confirmation testing
  - Only shows when initial test requires confirmation
  - Additional upload field for confirmation report
  - Clear indication of which report is which

- [ ] **Results Table Documents Enhancement**:
  - Rename "Actions" column to "Documents" in results table
  - Implement file viewing for screening reports (1-2 files per test)
  - **Decision needed**: separate files vs. combined report format
  - Ensure proper document access control based on user type
  - Consider PDF viewer integration or secure download links

## Email System Enhancement
- [ ] **Email Templates**: Expand email templates for different notification types
  - ✅ Client registration notifications (implemented)
  - ✅ Form submission notifications (implemented)
  - 🔲 Probation officer notifications for test results
  - 🔲 Employer notifications for test results
  - 🔲 Self-pay client result notifications
  - 🔲 Admin notifications for test completions

- [ ] **Email Queue System**: Implement reliable email delivery system with retry logic
- [ ] **Email Preferences**: Allow users to configure which notifications they receive

## Authentication & User Management
- [ ] **Password Change Functionality**: Implement secure password change process
- [ ] **Data Export**: Create user data export functionality for GDPR compliance
- [ ] **Privacy Settings**: Build privacy preferences management

## File Management
- [ ] **Document Storage**: Implement secure document upload and storage for test reports
- [ ] **File Access Control**: Ensure proper permissions for viewing test documents
- [ ] **Document Versioning**: Handle multiple reports per test (initial + confirmation)

## Future Enhancements
- [ ] **Mobile Responsiveness**: Ensure all pages work well on mobile devices
- [ ] **Accessibility**: Improve accessibility compliance across the application
- [ ] **Performance Optimization**: Optimize loading times and implement proper caching
- [ ] **Analytics Dashboard**: Create admin analytics for test volumes, completion rates, etc.

---

## Notes

### Dashboard Architecture
All core dashboard pages have been successfully migrated to the new server component pattern:
- Uses `export const dynamic = 'force-dynamic'` for fresh data
- Server actions with `overrideAccess: true` for mutations
- TanStack Query removed to eliminate hydration issues
- Pattern documented in CLAUDE.md

### Email System Status
Basic email functionality is working:
- Client registration triggers admin notification
- Form submissions send emails with template support
- Uses Payload's `sendEmail()` with dynamic field substitution

*Last Updated: January 2025*
*Priority: High priority items should be tackled first*
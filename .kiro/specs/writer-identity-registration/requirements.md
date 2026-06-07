# Requirements Document

## Introduction

This feature implements a two-step identity registration workflow. In Step 1, any visitor can create a standard reader account using only their full name, email, and password — no writer-specific data is required. In Step 2, an authenticated reader who wants to become a writer/journalist navigates to their profile and submits a separate "Writer Application" form, providing writer-specific public identity data (display name/pen name, profile photo, short bio, phone number, and city). Upon submission the user's role is updated from `user` to `poster`, enabling article publishing. Admin and dev accounts cannot be created via self-registration.

## Glossary

- **Registration_Form**: The sign-up UI displayed when no user is authenticated, collecting only full name, email, password, and password confirmation.
- **AuthProvider**: The React context provider in `AuthProvider.tsx` that wraps `supabase.auth.signUp` and manages session state.
- **Profile**: A row in the `public.profiles` Supabase table, keyed by the user's UUID.
- **Reader**: A user with role `user`, representing a standard account with read-only access to published articles.
- **Poster**: A user with role `poster`, representing a journalist or content contributor who can publish articles.
- **Writer_Application_Form**: A separate form accessible from the authenticated user's profile page that collects writer-specific identity data and upgrades the user's role to `poster`.
- **Supabase_Trigger**: The `handle_new_user` PostgreSQL trigger function that inserts a row into `profiles` after a new auth user is created.
- **user_metadata**: The JSON blob stored in `auth.users.raw_user_meta_data`, passed via `supabase.auth.signUp` options.
- **pen_name**: The public-facing display name or byline shown on published articles; if set it takes precedence over `full_name`.
- **bio**: A short public biography (2–3 sentences) describing the poster's background, displayed on the writer's public profile.
- **profile_photo**: A URL or base64-encoded image used as the poster's public avatar and displayed alongside their byline.
- **full_name**: The user's real name, collected at registration and pre-fillable in the Writer Application.
- **phone_number**: The poster's contact phone number, stored in `profiles` and used for editor communication.
- **city**: The poster's city or general location, stored in `profiles`.

---

## Requirements

### Requirement 1: Simple Account Creation (Step 1)

**User Story:** As a visitor, I want to create an account with just my name, email, and password, so that I can start reading without providing writer-specific information.

#### Acceptance Criteria

1. WHEN a visitor navigates to the Registration_Form, THE Registration_Form SHALL display exactly four input fields: Full Name, Email, Password, and Confirm Password.
2. THE Registration_Form SHALL NOT display any writer-specific fields (pen name, bio, profile photo, phone number, city) during Step 1 account creation.
3. THE Registration_Form SHALL NOT allow selection of account type during Step 1; all self-registered accounts SHALL receive the `user` (reader) role by default.
4. WHEN a user submits the Registration_Form with all four fields valid, THE AuthProvider SHALL call `supabase.auth.signUp` with the provided email, password, and `full_name` in `user_metadata`.
5. WHEN the `supabase.auth.signUp` call succeeds, THE Supabase_Trigger SHALL create a `profiles` row with `role = 'user'` and store `full_name` from `user_metadata`.
6. WHEN the account is successfully created, THE System SHALL transition the user to the authenticated reader view without requiring any additional data entry.

---

### Requirement 2: Registration Input Validation

**User Story:** As a system operator, I want Step 1 registration inputs validated before submission, so that accounts are created with clean, minimal identity data.

#### Acceptance Criteria

1. WHEN a user submits the Registration_Form with an empty Full Name field or a value containing only whitespace, THE Registration_Form SHALL prevent submission and display a validation message indicating that full name is required.
2. WHEN a user submits the Registration_Form with a Full Name longer than 120 characters, THE Registration_Form SHALL prevent submission and display a validation message indicating the maximum length.
3. WHEN a user submits the Registration_Form with a Password shorter than 6 characters, THE Registration_Form SHALL prevent submission and display a validation message indicating the minimum length.
4. WHEN a user submits the Registration_Form with a Confirm Password value that does not match the Password field, THE Registration_Form SHALL prevent submission and display a validation message indicating the mismatch.
5. WHEN a user submits the Registration_Form with an invalid email format, THE Registration_Form SHALL prevent submission and display a validation message indicating an invalid email address.
6. THE Registration_Form SHALL NOT allow the values `admin` or `dev` to be set as the account role through any client-side mechanism.

---

### Requirement 3: Writer Application Form Access (Step 2 Entry Point)

**User Story:** As an authenticated reader, I want to find a "Become a Writer" option in my profile, so that I can start the process of applying to become a journalist.

#### Acceptance Criteria

1. WHEN an authenticated user with role `user` views their profile page, THE Profile_Page SHALL display a "Become a Writer" or "Writer Application" button or section.
2. WHEN an authenticated user with role `poster`, `admin`, or `dev` views their profile page, THE Profile_Page SHALL NOT display the "Become a Writer" entry point.
3. WHEN an authenticated `user` clicks the "Become a Writer" entry point, THE System SHALL navigate to or display the Writer_Application_Form.
4. WHEN an unauthenticated visitor attempts to access the Writer_Application_Form URL directly, THE System SHALL redirect to the login view.

---

### Requirement 4: Writer Application Form Fields

**User Story:** As an authenticated reader applying to become a writer, I want to fill out my public identity details in a dedicated form, so that editors and readers can identify me as the article author.

#### Acceptance Criteria

1. WHEN a `user` accesses the Writer_Application_Form, THE Writer_Application_Form SHALL display the following sections and fields:
   - **Identitas Dasar**: Full Name (pre-filled from `profiles.full_name`, editable), Email (pre-filled from `auth.users.email`, read-only).
   - **Profil Publik**: Display Name / Pen Name (text input, optional), Profile Photo (file upload or URL input, optional), Short Bio (textarea, optional, 2–3 sentences guidance).
   - **Kontak & Verifikasi**: Phone Number (text input, required), City / Location (text input, required).
2. WHEN the Writer_Application_Form is loaded, THE Writer_Application_Form SHALL pre-fill the Full Name field with the value stored in `profiles.full_name` for the authenticated user.
3. WHEN the Writer_Application_Form is loaded, THE Writer_Application_Form SHALL pre-fill the Email field with the authenticated user's email address and render it as read-only.
4. WHEN a user submits the Writer_Application_Form without a Phone Number, THE Writer_Application_Form SHALL prevent submission and display a validation message indicating that phone number is required.
5. WHEN a user submits the Writer_Application_Form without a City value, THE Writer_Application_Form SHALL prevent submission and display a validation message indicating that city is required.

---

### Requirement 5: Writer Application Form Validation

**User Story:** As a system operator, I want writer application inputs validated before submission, so that profile data meets minimum quality standards.

#### Acceptance Criteria

1. WHEN a user submits the Writer_Application_Form with a Full Name containing only whitespace, THE Writer_Application_Form SHALL prevent submission and display a validation message indicating that full name is required.
2. WHEN a user submits the Writer_Application_Form with a Full Name longer than 120 characters, THE Writer_Application_Form SHALL prevent submission and display a validation message indicating the maximum length.
3. WHEN a user submits the Writer_Application_Form with a Pen Name longer than 120 characters, THE Writer_Application_Form SHALL prevent submission and display a validation message indicating the maximum length.
4. WHEN a user submits the Writer_Application_Form with a Bio longer than 500 characters, THE Writer_Application_Form SHALL prevent submission and display a validation message indicating the maximum length.
5. WHEN a user submits the Writer_Application_Form with a Phone Number that does not match a valid Indonesian phone format (e.g., `+62812...` or `08xx...`), THE Writer_Application_Form SHALL prevent submission and display a validation message indicating the expected format.
6. WHEN a user submits the Writer_Application_Form with a City value containing only whitespace, THE Writer_Application_Form SHALL prevent submission and display a validation message indicating that city is required.

---

### Requirement 6: Profile Photo Handling

**User Story:** As a writer applicant, I want to upload a profile photo or provide a photo URL, so that my public profile has a recognisable image alongside my articles.

#### Acceptance Criteria

1. WHEN a user provides a profile photo via file upload in the Writer_Application_Form, THE Writer_Application_Form SHALL read the file as a base64 data URL and store it as the `profile_photo` value.
2. WHEN a user provides a profile photo via a URL input in the Writer_Application_Form, THE Writer_Application_Form SHALL accept the value as a string URL for the `profile_photo` field.
3. WHEN a user submits the Writer_Application_Form without providing a profile photo, THE System SHALL accept the submission and store `profile_photo` as null in the `profiles` table.
4. WHEN a valid profile photo value (base64 or URL) is stored in `profiles`, THE System SHALL make it available for display in the article byline and public writer profile.

---

### Requirement 7: Role Upgrade on Writer Application Submission

**User Story:** As a reader who has completed the writer application, I want my role to be upgraded to `poster` automatically upon submission, so that I can immediately start creating and publishing articles.

#### Acceptance Criteria

1. WHEN a user submits a valid Writer_Application_Form, THE System SHALL update the `profiles` row for the authenticated user, setting `role = 'poster'` and storing `full_name`, `pen_name`, `profile_photo`, `bio`, `phone_number`, and `city` in the corresponding columns.
2. WHEN the `profiles` update succeeds, THE AuthProvider SHALL reflect the new `poster` role in the active session without requiring the user to log out and log back in.
3. WHEN the role upgrade completes, THE System SHALL redirect the user to the journalist dashboard or display a success message indicating that writer access has been granted.
4. IF the `profiles` update fails due to a database error, THEN THE System SHALL display an error message and preserve the user's existing `user` role without partial data corruption.
5. THE System SHALL NOT require admin approval before granting the `poster` role; the role upgrade SHALL be applied immediately upon valid form submission by default.

---

### Requirement 8: Persist Writer Identity Fields in the Profiles Table

**User Story:** As a system operator, I want all writer identity fields collected in the Writer Application to be durably stored in the profiles table, so that they are available for article bylines and profile pages.

#### Acceptance Criteria

1. THE profiles table SHALL contain columns: `full_name` (text, nullable), `pen_name` (text, nullable), `profile_photo` (text, nullable), `bio` (text, nullable), `phone_number` (text, nullable), and `city` (text, nullable), in addition to the existing columns `id`, `email`, `role`, `quota`, and `createdAt`.
2. WHEN a writer application is submitted successfully, THE System SHALL write all provided writer identity fields into the corresponding `profiles` columns for the authenticated user's UUID.
3. WHEN a writer identity field is left blank or omitted in the Writer_Application_Form, THE System SHALL store `null` for that column rather than an empty string.
4. WHEN the `profiles` row is updated, THE System SHALL make all writer identity fields retrievable via a `SELECT` query on `profiles` filtered by the user's UUID.

---

### Requirement 9: Article Author Byline from Writer Profile

**User Story:** As an editor or reader, I want articles published by a journalist to display their registered byline, so that authorship is accurate and consistent with the journalist's writer profile.

#### Acceptance Criteria

1. WHEN a `poster` creates a new article and `profiles.pen_name` is a non-empty string, THE System SHALL set the article's `author` field to the `pen_name` value.
2. WHEN a `poster` creates a new article and `profiles.pen_name` is null or empty, THE System SHALL set the article's `author` field to the `full_name` value from `profiles`.
3. WHEN an article's `author` field is set from the writer profile, THE System SHALL also set `author_id` to the poster's UUID.
4. WHEN a poster's `pen_name` or `full_name` is updated in `profiles` after publication, THE System SHALL NOT retroactively modify the `author` field on previously published articles.

---

### Requirement 10: Admin and Dev Account Restrictions

**User Story:** As a system operator, I want admin and dev accounts to be excluded from the self-registration flow, so that privileged access can only be granted by authorised personnel.

#### Acceptance Criteria

1. THE Registration_Form SHALL NOT display a role selector or any mechanism that allows a registering user to request the `admin` or `dev` role.
2. WHEN a `supabase.auth.signUp` call is made via the AuthProvider, THE AuthProvider SHALL only allow `user` as the assigned role for self-registration, regardless of any client-side data passed.
3. WHEN a user's email matches a hardcoded privileged address (e.g., `admin@admin.com` or `dev@dev.com`), THE Supabase_Trigger SHALL override the role to `admin` or `dev` respectively, regardless of the value in `user_metadata`.
4. THE Writer_Application_Form SHALL NOT be accessible to users with role `admin` or `dev`.

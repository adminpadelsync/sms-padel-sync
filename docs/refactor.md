Project Audit & Cleanup Pass

You are performing a comprehensive code audit and cleanup on this SwiftUI + Supabase iOS application. Go through the entire codebase systematically and complete the following:

1. Code Quality Review

Identify and refactor any duplicated logic into shared utilities or extensions
Ensure consistent naming conventions across all files (Swift API Design Guidelines)
Remove dead code, unused imports, and commented-out blocks
Simplify overly complex functions (break down anything over ~40 lines)
Ensure proper use of access control (private, fileprivate, internal, public)

2. Swift/SwiftUI Standards

Verify proper use of @State, @Binding, @StateObject, @ObservedObject, @EnvironmentObject
Ensure Views are lightweight and logic lives in ViewModels
Check for proper async/await patterns and MainActor usage
Validate error handling is consistent (no force unwraps in production code, proper do/catch blocks)
Confirm Codable models match current Supabase schema

3. Supabase Integration

Audit all database calls for proper error handling
Verify RLS policies are referenced correctly in code comments
Check for any N+1 query patterns that should be optimized
Ensure auth state is handled consistently throughout the app

4. Requirements Documentation

Review the current requirements doc
Add documentation for any implemented features not yet captured
Flag any documented features that don't match current implementation
Update status (planned/in-progress/complete) for all items

5. Migration Scripts

List all existing migration files in order
Consolidate any migrations that can be safely combined (same logical feature, no production data between them)
Ensure migration naming follows a consistent pattern
Verify migrations match current schema state

6. Technical Debt Inventory
Create a prioritized list of any remaining issues found, categorized as:

Critical: Bugs or security issues
High: Performance problems or architectural concerns
Medium: Code smell or maintainability issues
Low: Style inconsistencies or minor improvements

After each section, summarize changes made and flag anything requiring my decision before proceeding.
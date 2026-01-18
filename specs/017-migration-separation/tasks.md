# Tasks: Schema/Seed Migration Separation

**Feature Branch**: `017-migration-separation`  
**Created**: 2026-01-17  
**Status**: Ready for Dev  
**Approach**: TDD (Red-Green-Refactor), Coverage Target 90%

---

## Task 1: Config Extension (TDD)

**Goal**: Extend `migratecmd.Config` to support `SeedDir` configuration.

**Test File**: `plugins/migratecmd/migratecmd_test.go`

**Red Tests**:
- [ ] 1.1 `TestConfigSeedDirDefault` - Default SeedDir is `pb_data/../pb_seeds` (JS) or `seeds` (Go)
- [ ] 1.2 `TestConfigSeedDirCustom` - Custom SeedDir is respected
- [ ] 1.3 `TestConfigSeedDirEmpty` - Empty SeedDir disables seed migrations
- [ ] 1.4 `TestConfigSeedDirAbsolute` - Absolute path works correctly

**Green Implementation**:
- [ ] 1.5 Add `SeedDir` field to `Config` struct
- [ ] 1.6 Set default SeedDir in `Register()` function
- [ ] 1.7 Handle empty SeedDir case (disable feature)

**Acceptance**: `go test -v -run TestConfig ./plugins/migratecmd/` passes

---

## Task 2: Migration Loading (TDD)

**Goal**: Load migrations from both directories with correct ordering.

**Test File**: `plugins/migratecmd/loader_test.go` (new file)

**Red Tests**:
- [ ] 2.1 `TestLoadMigrationsSchemaOnly` - Load from schema dir only
- [ ] 2.2 `TestLoadMigrationsSeedOnly` - Load from seed dir only
- [ ] 2.3 `TestLoadMigrationsBothDirs` - Load from both dirs
- [ ] 2.4 `TestLoadMigrationsOrder` - Schema migrations before seed migrations
- [ ] 2.5 `TestLoadMigrationsNoSeedDir` - Works when seed dir doesn't exist
- [ ] 2.6 `TestLoadMigrationsEmptySeedDir` - Works with empty seed dir

**Green Implementation**:
- [ ] 2.7 Create `loadMigrations()` helper function
- [ ] 2.8 Scan schema directory first
- [ ] 2.9 Scan seed directory second
- [ ] 2.10 Merge and sort by execution order (schema first, then seed)

**Acceptance**: `go test -v -run TestLoadMigrations ./plugins/migratecmd/` passes

---

## Task 3: Migration File Prefix (TDD)

**Goal**: Prefix seed migration files in `_migrations` table to distinguish source.

**Test File**: `plugins/migratecmd/migratecmd_test.go`

**Red Tests**:
- [ ] 3.1 `TestMigrationFilePrefixSchema` - Schema migrations have no prefix
- [ ] 3.2 `TestMigrationFilePrefixSeed` - Seed migrations have `seed/` prefix
- [ ] 3.3 `TestMigrationFilePrefixParsing` - Correctly parse prefix from file field
- [ ] 3.4 `TestMigrationFilePrefixBackwardCompat` - Old records without prefix work

**Green Implementation**:
- [ ] 3.5 Add `seedMigrationPrefix` constant (`"seed/"`)
- [ ] 3.6 Prefix seed migration files when inserting to `_migrations`
- [ ] 3.7 Handle prefix when reading from `_migrations`

**Acceptance**: `go test -v -run TestMigrationFilePrefix ./plugins/migratecmd/` passes

---

## Task 4: Execute Order (TDD)

**Goal**: Ensure correct execution order: System → Schema → Seed → App.

**Test File**: `core/migrations_runner_test.go`

**Red Tests**:
- [ ] 4.1 `TestMigrationsRunnerOrderUp` - Up executes in correct order
- [ ] 4.2 `TestMigrationsRunnerOrderDown` - Down executes in reverse order
- [ ] 4.3 `TestMigrationsRunnerSchemaThenSeed` - Schema completes before seed starts
- [ ] 4.4 `TestMigrationsRunnerDownSeedThenSchema` - Down: seed first, then schema

**Green Implementation**:
- [ ] 4.5 Modify `MigrationsRunner.Run()` to accept ordered lists
- [ ] 4.6 Ensure schema list executes completely before seed list
- [ ] 4.7 Reverse order for down migrations

**Acceptance**: `go test -v -run TestMigrationsRunnerOrder ./core/` passes

---

## Task 5: Create Command Extension (TDD)

**Goal**: Add `--seed` flag to `migrate create` command.

**Test File**: `plugins/migratecmd/migratecmd_test.go`

**Red Tests**:
- [ ] 5.1 `TestCreateCommandDefault` - Default creates in schema dir
- [ ] 5.2 `TestCreateCommandWithSeedFlag` - `--seed` creates in seed dir
- [ ] 5.3 `TestCreateCommandSeedDirCreated` - Auto-creates seed dir if not exists
- [ ] 5.4 `TestCreateCommandSeedTemplate` - Seed migration has correct template

**Green Implementation**:
- [ ] 5.5 Add `--seed` flag to create subcommand
- [ ] 5.6 Route to correct directory based on flag
- [ ] 5.7 Create seed directory if needed

**Acceptance**: `go test -v -run TestCreateCommand ./plugins/migratecmd/` passes

---

## Task 6: History Sync Extension (TDD)

**Goal**: Extend `history-sync` to check both directories.

**Test File**: `plugins/migratecmd/migratecmd_test.go`

**Red Tests**:
- [ ] 6.1 `TestHistorySyncSchemaDir` - Cleans orphaned schema records
- [ ] 6.2 `TestHistorySyncSeedDir` - Cleans orphaned seed records
- [ ] 6.3 `TestHistorySyncBothDirs` - Cleans orphaned records from both dirs
- [ ] 6.4 `TestHistorySyncPrefixHandling` - Correctly handles `seed/` prefix

**Green Implementation**:
- [ ] 6.5 Modify sync logic to check both directories
- [ ] 6.6 Handle `seed/` prefix when matching files
- [ ] 6.7 Report which directory each orphan was from

**Acceptance**: `go test -v -run TestHistorySync ./plugins/migratecmd/` passes

---

## Task 7: Collections Command Isolation (TDD)

**Goal**: Ensure `migrate collections` only affects schema directory.

**Test File**: `plugins/migratecmd/migratecmd_test.go`

**Red Tests**:
- [ ] 7.1 `TestCollectionsCommandSchemaDir` - Creates snapshot in schema dir
- [ ] 7.2 `TestCollectionsCommandIgnoresSeedDir` - Does not touch seed dir
- [ ] 7.3 `TestCollectionsCommandWithSeedMigrations` - Seed migrations unaffected

**Green Implementation**:
- [ ] 7.4 Verify `migrateCollectionsHandler` uses schema dir only
- [ ] 7.5 Add comment documenting intentional isolation

**Acceptance**: `go test -v -run TestCollectionsCommand ./plugins/migratecmd/` passes

---

## Task 8: Backward Compatibility (TDD)

**Goal**: Ensure existing single-directory projects work without changes.

**Test File**: `plugins/migratecmd/compat_test.go` (new file)

**Red Tests**:
- [ ] 8.1 `TestBackwardCompatNoSeedDir` - Works without seed dir
- [ ] 8.2 `TestBackwardCompatMixedMigrations` - Old mixed migrations work
- [ ] 8.3 `TestBackwardCompatOldRecords` - Old `_migrations` records work
- [ ] 8.4 `TestBackwardCompatUpgrade` - Smooth upgrade path

**Green Implementation**:
- [ ] 8.5 Check if seed dir exists before using
- [ ] 8.6 Handle old records without prefix
- [ ] 8.7 No breaking changes to existing behavior

**Acceptance**: `go test -v -run TestBackwardCompat ./plugins/migratecmd/` passes

---

## Task 9: JS/Go Template for Seed Migrations (TDD)

**Goal**: Provide appropriate template for seed migrations.

**Test File**: `plugins/migratecmd/templates_test.go`

**Red Tests**:
- [ ] 9.1 `TestJsSeedMigrationTemplate` - Template includes idempotency hint
- [ ] 9.2 `TestGoSeedMigrationTemplate` - Go template includes idempotency hint

**Green Implementation**:
- [ ] 9.3 Create `jsSeedBlankTemplate()` with idempotency example
- [ ] 9.4 Create `goSeedBlankTemplate()` with idempotency example
- [ ] 9.5 Use seed template when `--seed` flag is set

**Acceptance**: `go test -v -run TestSeedMigrationTemplate ./plugins/migratecmd/` passes

---

## Task 10: Documentation Update

**Goal**: Update migration documentation with new dual-directory feature.

**Files**:
- [ ] 10.1 Update `site/references/js/migrations.md` - Add seed migrations section
- [ ] 10.2 Update `site/references/go/migrations.md` - Add seed migrations section
- [ ] 10.3 Add migration best practices section

**Content**:
- [ ] 10.4 Explain schema vs seed migrations
- [ ] 10.5 Document `--seed` flag
- [ ] 10.6 Provide squash workflow example
- [ ] 10.7 Add idempotency best practices

---

## Task 11: Integration Tests

**Goal**: End-to-end tests for the complete workflow.

**Test File**: `plugins/migratecmd/integration_test.go` (new file)

**Tests**:
- [ ] 11.1 `TestIntegrationFullWorkflow` - Create schema → Create seed → Run → Squash → Run again
- [ ] 11.2 `TestIntegrationNewProject` - Fresh project with dual directories
- [ ] 11.3 `TestIntegrationUpgradeProject` - Existing project upgrade
- [ ] 11.4 `TestIntegrationRollback` - Full rollback scenario

**Acceptance**: `go test -v -run TestIntegration ./plugins/migratecmd/` passes

---

## Verification Checklist

Before marking complete:

- [ ] All tests pass: `go test ./plugins/migratecmd/...`
- [ ] Coverage > 90%: `go test -cover ./plugins/migratecmd/...`
- [ ] No lint errors: `golangci-lint run ./plugins/migratecmd/...`
- [ ] Documentation updated
- [ ] Backward compatibility verified with existing projects
- [ ] Manual testing with JS and Go migrations

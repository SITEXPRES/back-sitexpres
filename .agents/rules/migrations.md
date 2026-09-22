# Database Migrations Rule

## Context
When working with the database in this project, it is essential to maintain a record of schema changes to avoid losing the database structure and to make local setups easier.

## Rule
- Always create a SQL migration file whenever creating a new table, modifying an existing table, or dropping a table.
- Do not rely solely on manual SQL queries sent directly to production. Ensure that every schema change is documented in version control so it can be re-run locally or in a new environment.
- When generating schemas, store the SQL files in a dedicated `database/` folder in the project.

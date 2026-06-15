<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Composite indexes for the hot list endpoints.
 *
 * Laravel's foreignId()->constrained() already creates single-column indexes on
 * FK columns, and the finance tables (customer_invoices, expenses, supplier_invoices,
 * finance_transactions) already carry the (status, date) composites their dashboards
 * need. The gaps addressed here are the filter+sort combinations those single-column
 * indexes don't cover:
 *
 *  - orders / tasks lists filter by owner/status then ORDER BY updated_at DESC.
 *    Without a matching composite the DB filters on the FK index then does a
 *    filesort on updated_at — fine now, a full sort as the tables grow.
 *  - messages threads are read by (sender, receiver) pair ordered by time, in both
 *    directions; the single-column FK indexes can't serve the ordered pair lookup.
 */
return new class extends Migration {
    /** Names of existing indexes on a table — portable across MySQL/SQLite/Postgres. */
    private function indexNames(string $table): array
    {
        // Schema::getIndexListing() uses the driver's own schema introspection,
        // unlike the raw "SHOW INDEX" (MySQL-only) this previously relied on, which
        // errored on the SQLite database used for local dev.
        return array_map('strtolower', Schema::getIndexListing($table));
    }

    /** Add an index only if a same-named one doesn't already exist (safe re-runs). */
    private function addIndex(string $table, array $columns, string $name): void
    {
        if (! in_array(strtolower($name), $this->indexNames($table), true)) {
            Schema::table($table, fn (Blueprint $t) => $t->index($columns, $name));
        }
    }

    public function up(): void
    {
        $this->addIndex('orders', ['supervisor_id', 'updated_at'], 'orders_supervisor_updated_idx');
        $this->addIndex('orders', ['creator_id', 'updated_at'], 'orders_creator_updated_idx');
        $this->addIndex('orders', ['status', 'updated_at'], 'orders_status_updated_idx');

        $this->addIndex('tasks', ['supervisor_id', 'updated_at'], 'tasks_supervisor_updated_idx');
        $this->addIndex('tasks', ['status', 'updated_at'], 'tasks_status_updated_idx');

        $this->addIndex('messages', ['sender_id', 'receiver_id', 'created_at'], 'messages_sender_receiver_idx');
        $this->addIndex('messages', ['receiver_id', 'sender_id', 'created_at'], 'messages_receiver_sender_idx');
    }

    /** Drop an index only if it exists. */
    private function dropIndex(string $table, string $name): void
    {
        if (in_array(strtolower($name), $this->indexNames($table), true)) {
            Schema::table($table, fn (Blueprint $t) => $t->dropIndex($name));
        }
    }

    public function down(): void
    {
        $this->dropIndex('orders', 'orders_supervisor_updated_idx');
        $this->dropIndex('orders', 'orders_creator_updated_idx');
        $this->dropIndex('orders', 'orders_status_updated_idx');

        $this->dropIndex('tasks', 'tasks_supervisor_updated_idx');
        $this->dropIndex('tasks', 'tasks_status_updated_idx');

        $this->dropIndex('messages', 'messages_sender_receiver_idx');
        $this->dropIndex('messages', 'messages_receiver_sender_idx');
    }
};

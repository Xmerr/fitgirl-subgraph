import { Database } from "bun:sqlite";
import type { ILogger } from "@xmer/consumer-shared";
import { DatabaseError } from "../errors/index.js";

export interface DatabaseManagerOptions {
	path: string;
	logger: ILogger;
}

export interface IDatabaseManager {
	initialize(): Promise<void>;
	getDb(): Database;
	close(): void;
}

export class DatabaseManager implements IDatabaseManager {
	private readonly path: string;
	private readonly logger: ILogger;
	private db: Database | null = null;

	constructor(options: DatabaseManagerOptions) {
		this.path = options.path;
		this.logger = options.logger.child({ component: "DatabaseManager" });
	}

	async initialize(): Promise<void> {
		try {
			// Open with write access for mutations
			this.db = new Database(this.path, { create: false });
			this.db.exec("PRAGMA journal_mode = WAL");
			this.db.exec("PRAGMA foreign_keys = ON");

			this.logger.info("Database initialized", { path: this.path });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new DatabaseError(
				`Failed to initialize database: ${message}`,
				"initialize",
				{ path: this.path },
			);
		}
	}

	getDb(): Database {
		if (!this.db) {
			throw new DatabaseError(
				"Database not initialized. Call initialize() first.",
				"getDb",
			);
		}
		return this.db;
	}

	close(): void {
		if (this.db) {
			this.db.close();
			this.db = null;
			this.logger.info("Database closed");
		}
	}
}

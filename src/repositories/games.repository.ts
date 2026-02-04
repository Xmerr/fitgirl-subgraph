import type { Database } from "bun:sqlite";
import type { ILogger } from "@xmer/consumer-shared";
import type {
	DownloadStatus,
	GameFilter,
	GameRecord,
	GamesConnection,
	GamesRepositoryOptions,
	IGamesRepository,
	PaginationInput,
	RatingType,
} from "../types/index.js";

export class GamesRepository implements IGamesRepository {
	private readonly db: Database;
	private readonly logger: ILogger;

	constructor(options: GamesRepositoryOptions) {
		this.db = options.db;
		this.logger = options.logger.child({ component: "GamesRepository" });
	}

	async findAll(
		filter?: GameFilter,
		pagination?: PaginationInput,
	): Promise<GamesConnection> {
		const offset = pagination?.offset ?? 0;
		const limit = pagination?.limit ?? 20;

		let whereClause = "1=1";
		const params: (string | number)[] = [];

		if (filter?.search) {
			whereClause +=
				" AND (game_name LIKE ? OR title_raw LIKE ? OR steam_name LIKE ? OR corrected_name LIKE ?)";
			const searchPattern = `%${filter.search}%`;
			params.push(searchPattern, searchPattern, searchPattern, searchPattern);
		}

		if (filter?.downloadStatus) {
			const statusCondition = this.getDownloadStatusCondition(
				filter.downloadStatus,
			);
			whereClause += ` AND ${statusCondition}`;
		}

		// Count total
		const countSql = `SELECT COUNT(*) as count FROM games WHERE ${whereClause}`;
		const countStmt = this.db.prepare(countSql);
		const countResult = countStmt.get(...params) as { count: number };
		const totalCount = countResult.count;

		// Fetch items sorted by pub_date descending
		const sql = `
			SELECT * FROM games
			WHERE ${whereClause}
			ORDER BY pub_date DESC
			LIMIT ? OFFSET ?
		`;
		const stmt = this.db.prepare(sql);
		const items = stmt.all(...params, limit, offset) as GameRecord[];

		return {
			items,
			totalCount,
			hasMore: offset + items.length < totalCount,
		};
	}

	async findById(id: number): Promise<GameRecord | null> {
		const sql = "SELECT * FROM games WHERE id = ?";
		const stmt = this.db.prepare(sql);
		return stmt.get(id) as GameRecord | null;
	}

	async findByGuid(guid: string): Promise<GameRecord | null> {
		const sql = "SELECT * FROM games WHERE guid = ?";
		const stmt = this.db.prepare(sql);
		return stmt.get(guid) as GameRecord | null;
	}

	async findActiveDownloads(): Promise<GameRecord[]> {
		const sql = `
			SELECT * FROM games
			WHERE download_started_at IS NOT NULL
			AND download_completed_at IS NULL
			ORDER BY download_started_at DESC
		`;
		const stmt = this.db.prepare(sql);
		return stmt.all() as GameRecord[];
	}

	async findRecent(limit: number): Promise<GameRecord[]> {
		const sql = `
			SELECT * FROM games
			ORDER BY pub_date DESC
			LIMIT ?
		`;
		const stmt = this.db.prepare(sql);
		return stmt.all(limit) as GameRecord[];
	}

	async updateRating(
		id: number,
		rating: RatingType | null,
	): Promise<GameRecord | null> {
		const sql = `
			UPDATE games
			SET rating = ?, updated_at = datetime('now')
			WHERE id = ?
			RETURNING *
		`;
		const stmt = this.db.prepare(sql);
		const result = stmt.get(rating, id) as GameRecord | null;

		if (result) {
			this.logger.debug("Rating updated", { id, rating });
		}

		return result;
	}

	async updateCorrectedName(
		id: number,
		correctedName: string,
	): Promise<GameRecord | null> {
		const sql = `
			UPDATE games
			SET corrected_name = ?, updated_at = datetime('now')
			WHERE id = ?
			RETURNING *
		`;
		const stmt = this.db.prepare(sql);
		const result = stmt.get(correctedName, id) as GameRecord | null;

		if (result) {
			this.logger.debug("Corrected name updated", { id, correctedName });
		}

		return result;
	}

	async updateDownloadStarted(guid: string): Promise<void> {
		const sql = `
			UPDATE games
			SET download_started_at = datetime('now'), updated_at = datetime('now')
			WHERE guid = ?
		`;
		const stmt = this.db.prepare(sql);
		stmt.run(guid);
		this.logger.debug("Download started", { guid });
	}

	private getDownloadStatusCondition(status: DownloadStatus): string {
		switch (status) {
			case "AVAILABLE":
				return "magnet_link IS NOT NULL AND download_started_at IS NULL";
			case "DOWNLOADING":
				return "download_started_at IS NOT NULL AND download_completed_at IS NULL";
			case "COMPLETED":
				return "download_completed_at IS NOT NULL";
			case "UNAVAILABLE":
				return "magnet_link IS NULL";
		}
	}
}

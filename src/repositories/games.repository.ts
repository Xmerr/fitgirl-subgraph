import type { ILogger } from "@xmer/consumer-shared";
import type { Sql } from "postgres";
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
	private readonly sql: Sql;
	private readonly logger: ILogger;

	constructor(options: GamesRepositoryOptions) {
		this.sql = options.sql;
		this.logger = options.logger.child({ component: "GamesRepository" });
	}

	async findAll(
		filter?: GameFilter,
		pagination?: PaginationInput,
	): Promise<GamesConnection> {
		const offset = pagination?.offset ?? 0;
		const limit = pagination?.limit ?? 20;

		// Build dynamic query conditions
		const conditions: string[] = ["1=1"];
		const params: (string | number)[] = [];
		let paramIndex = 1;

		if (filter?.search) {
			const searchPattern = `%${filter.search}%`;
			conditions.push(
				`(game_name ILIKE $${paramIndex} OR title_raw ILIKE $${paramIndex + 1} OR steam_name ILIKE $${paramIndex + 2} OR corrected_name ILIKE $${paramIndex + 3})`,
			);
			params.push(searchPattern, searchPattern, searchPattern, searchPattern);
			paramIndex += 4;
		}

		if (filter?.downloadStatus) {
			const statusCondition = this.getDownloadStatusCondition(
				filter.downloadStatus,
			);
			conditions.push(statusCondition);
		}

		const whereClause = conditions.join(" AND ");

		// Count total
		const countResult = await this.sql.unsafe<[{ count: string }]>(
			`SELECT COUNT(*) as count FROM games WHERE ${whereClause}`,
			params,
		);
		const totalCount = Number(countResult[0].count);

		// Fetch items sorted by pub_date descending
		const items = await this.sql.unsafe<GameRecord[]>(
			`SELECT * FROM games WHERE ${whereClause} ORDER BY pub_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
			[...params, limit, offset],
		);

		return {
			items,
			totalCount,
			hasMore: offset + items.length < totalCount,
		};
	}

	async findById(id: number): Promise<GameRecord | null> {
		const [result] = await this.sql<GameRecord[]>`
			SELECT * FROM games WHERE id = ${id}
		`;
		return result ?? null;
	}

	async findByGuid(guid: string): Promise<GameRecord | null> {
		const [result] = await this.sql<GameRecord[]>`
			SELECT * FROM games WHERE guid = ${guid}
		`;
		return result ?? null;
	}

	async findActiveDownloads(): Promise<GameRecord[]> {
		return this.sql<GameRecord[]>`
			SELECT * FROM games
			WHERE download_started_at IS NOT NULL
			AND download_completed_at IS NULL
			ORDER BY download_started_at DESC
		`;
	}

	async findRecent(limit: number): Promise<GameRecord[]> {
		return this.sql<GameRecord[]>`
			SELECT * FROM games
			ORDER BY pub_date DESC
			LIMIT ${limit}
		`;
	}

	async updateRating(
		id: number,
		rating: RatingType | null,
	): Promise<GameRecord | null> {
		const [result] = await this.sql<GameRecord[]>`
			UPDATE games
			SET rating = ${rating}, updated_at = NOW()
			WHERE id = ${id}
			RETURNING *
		`;

		if (result) {
			this.logger.debug("Rating updated", { id, rating });
		}

		return result ?? null;
	}

	async updateCorrectedName(
		id: number,
		correctedName: string,
	): Promise<GameRecord | null> {
		const [result] = await this.sql<GameRecord[]>`
			UPDATE games
			SET corrected_name = ${correctedName}, updated_at = NOW()
			WHERE id = ${id}
			RETURNING *
		`;

		if (result) {
			this.logger.debug("Corrected name updated", { id, correctedName });
		}

		return result ?? null;
	}

	async updateDownloadStarted(guid: string): Promise<void> {
		await this.sql`
			UPDATE games
			SET download_started_at = NOW(), updated_at = NOW()
			WHERE guid = ${guid}
		`;
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

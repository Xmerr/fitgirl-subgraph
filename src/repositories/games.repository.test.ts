import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import type { ILogger } from "@xmer/consumer-shared";
import { GamesRepository } from "./games.repository.js";

const TEST_DB_PATH = "/tmp/test-fitgirl-subgraph-games.db";

const mockLogger: ILogger = {
	debug: mock(() => {}),
	info: mock(() => {}),
	warn: mock(() => {}),
	error: mock(() => {}),
	child: mock(() => mockLogger),
};

const createTestSchema = (db: Database) => {
	db.exec(`
		CREATE TABLE IF NOT EXISTS games (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			guid TEXT NOT NULL UNIQUE,
			game_name TEXT NOT NULL,
			title_raw TEXT NOT NULL,
			corrected_name TEXT,
			fitgirl_url TEXT NOT NULL,
			steam_app_id INTEGER,
			steam_url TEXT,
			steam_name TEXT,
			magnet_link TEXT,
			torrent_hash TEXT,
			discord_message_id TEXT,
			discord_channel_id TEXT,
			size_original TEXT NOT NULL,
			size_repack TEXT NOT NULL,
			pub_date TEXT NOT NULL,
			download_started_at TEXT,
			download_completed_at TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now')),
			steam_header_image TEXT,
			steam_price TEXT,
			steam_categories TEXT,
			steam_review_score TEXT,
			steam_review_desc TEXT,
			steam_total_positive INTEGER,
			steam_total_negative INTEGER,
			rating TEXT CHECK (rating IN ('upvote', 'downvote'))
		)
	`);
};

const insertTestGame = (
	db: Database,
	overrides: Record<string, unknown> = {},
) => {
	const defaults = {
		guid: `test-guid-${Date.now()}`,
		game_name: "Test Game",
		title_raw: "Test Game - v1.0",
		fitgirl_url: "https://fitgirl-repacks.site/test-game/",
		size_original: "45 GB",
		size_repack: "22 GB",
		pub_date: "2024-01-15T12:00:00.000Z",
		steam_app_id: 12345,
		steam_url: "https://store.steampowered.com/app/12345",
		steam_name: "Test Game",
		magnet_link: "magnet:?xt=urn:btih:abc123",
		steam_header_image: "https://cdn.steam.com/header.jpg",
		steam_categories: '["Single-player"]',
	};

	const data = { ...defaults, ...overrides };

	const sql = `
		INSERT INTO games (
			guid, game_name, title_raw, fitgirl_url, size_original, size_repack,
			pub_date, steam_app_id, steam_url, steam_name, magnet_link,
			steam_header_image, steam_categories
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		RETURNING id
	`;

	const stmt = db.prepare(sql);
	const result = stmt.get(
		data.guid,
		data.game_name,
		data.title_raw,
		data.fitgirl_url,
		data.size_original,
		data.size_repack,
		data.pub_date,
		data.steam_app_id,
		data.steam_url,
		data.steam_name,
		data.magnet_link,
		data.steam_header_image,
		data.steam_categories,
	) as { id: number };

	return result.id;
};

describe("GamesRepository", () => {
	let db: Database;
	let repository: GamesRepository;

	beforeEach(() => {
		if (existsSync(TEST_DB_PATH)) {
			unlinkSync(TEST_DB_PATH);
		}

		db = new Database(TEST_DB_PATH, { create: true });
		createTestSchema(db);
		repository = new GamesRepository({ db, logger: mockLogger });
	});

	afterEach(() => {
		db.close();
		if (existsSync(TEST_DB_PATH)) {
			unlinkSync(TEST_DB_PATH);
		}
	});

	describe("findAll", () => {
		it("should return empty connection when no games", async () => {
			const result = await repository.findAll();

			expect(result.items).toHaveLength(0);
			expect(result.totalCount).toBe(0);
			expect(result.hasMore).toBe(false);
		});

		it("should return all games sorted by pub_date descending", async () => {
			insertTestGame(db, { guid: "game-1", pub_date: "2024-01-01T00:00:00Z" });
			insertTestGame(db, { guid: "game-2", pub_date: "2024-01-03T00:00:00Z" });
			insertTestGame(db, { guid: "game-3", pub_date: "2024-01-02T00:00:00Z" });

			const result = await repository.findAll();

			expect(result.items).toHaveLength(3);
			expect(result.items[0].guid).toBe("game-2"); // Newest first
			expect(result.items[1].guid).toBe("game-3");
			expect(result.items[2].guid).toBe("game-1");
		});

		it("should filter by search term", async () => {
			insertTestGame(db, { guid: "game-1", game_name: "Cyberpunk 2077" });
			insertTestGame(db, { guid: "game-2", game_name: "The Witcher 3" });

			const result = await repository.findAll({ search: "Cyber" });

			expect(result.items).toHaveLength(1);
			expect(result.items[0].guid).toBe("game-1");
		});

		it("should filter by download status AVAILABLE", async () => {
			insertTestGame(db, { guid: "game-1", magnet_link: "magnet:?xt=..." });
			insertTestGame(db, { guid: "game-2", magnet_link: null });

			const result = await repository.findAll({ downloadStatus: "AVAILABLE" });

			expect(result.items).toHaveLength(1);
			expect(result.items[0].guid).toBe("game-1");
		});

		it("should paginate results", async () => {
			for (let i = 0; i < 5; i++) {
				insertTestGame(db, { guid: `game-${i}` });
			}

			const result = await repository.findAll(undefined, {
				offset: 2,
				limit: 2,
			});

			expect(result.items).toHaveLength(2);
			expect(result.totalCount).toBe(5);
			expect(result.hasMore).toBe(true);
		});
	});

	describe("findById", () => {
		it("should find game by id", async () => {
			const id = insertTestGame(db, { guid: "find-by-id-test" });

			const result = await repository.findById(id);

			expect(result).not.toBeNull();
			expect(result?.guid).toBe("find-by-id-test");
		});

		it("should return null for non-existent id", async () => {
			const result = await repository.findById(9999);

			expect(result).toBeNull();
		});
	});

	describe("findByGuid", () => {
		it("should find game by guid", async () => {
			insertTestGame(db, { guid: "unique-guid-123" });

			const result = await repository.findByGuid("unique-guid-123");

			expect(result).not.toBeNull();
			expect(result?.guid).toBe("unique-guid-123");
		});

		it("should return null for non-existent guid", async () => {
			const result = await repository.findByGuid("non-existent");

			expect(result).toBeNull();
		});
	});

	describe("findActiveDownloads", () => {
		it("should return games that are downloading", async () => {
			insertTestGame(db, { guid: "game-1" });
			insertTestGame(db, { guid: "game-2" });

			db.exec(`
				UPDATE games SET download_started_at = datetime('now')
				WHERE guid = 'game-1'
			`);

			const result = await repository.findActiveDownloads();

			expect(result).toHaveLength(1);
			expect(result[0].guid).toBe("game-1");
		});

		it("should exclude completed downloads", async () => {
			insertTestGame(db, { guid: "completed-game" });
			db.exec(`
				UPDATE games
				SET download_started_at = datetime('now'),
					download_completed_at = datetime('now')
				WHERE guid = 'completed-game'
			`);

			const result = await repository.findActiveDownloads();

			expect(result).toHaveLength(0);
		});
	});

	describe("findRecent", () => {
		it("should return most recent games", async () => {
			insertTestGame(db, {
				guid: "old-game",
				pub_date: "2024-01-01T00:00:00Z",
			});
			insertTestGame(db, {
				guid: "new-game",
				pub_date: "2024-01-10T00:00:00Z",
			});

			const result = await repository.findRecent(1);

			expect(result).toHaveLength(1);
			expect(result[0].guid).toBe("new-game");
		});
	});

	describe("updateRating", () => {
		it("should update rating to upvote", async () => {
			const id = insertTestGame(db, { guid: "rating-test" });

			const result = await repository.updateRating(id, "upvote");

			expect(result).not.toBeNull();
			expect(result?.rating).toBe("upvote");
		});

		it("should update rating to downvote", async () => {
			const id = insertTestGame(db, { guid: "rating-test-2" });

			const result = await repository.updateRating(id, "downvote");

			expect(result).not.toBeNull();
			expect(result?.rating).toBe("downvote");
		});

		it("should clear rating when set to null", async () => {
			const id = insertTestGame(db, { guid: "clear-rating-test" });
			await repository.updateRating(id, "upvote");

			const result = await repository.updateRating(id, null);

			expect(result).not.toBeNull();
			expect(result?.rating).toBeNull();
		});

		it("should return null for non-existent game", async () => {
			const result = await repository.updateRating(9999, "upvote");

			expect(result).toBeNull();
		});
	});

	describe("updateCorrectedName", () => {
		it("should update corrected name", async () => {
			const id = insertTestGame(db, { guid: "name-test" });

			const result = await repository.updateCorrectedName(id, "Corrected Name");

			expect(result).not.toBeNull();
			expect(result?.corrected_name).toBe("Corrected Name");
		});

		it("should return null for non-existent game", async () => {
			const result = await repository.updateCorrectedName(9999, "Test");

			expect(result).toBeNull();
		});
	});

	describe("updateDownloadStarted", () => {
		it("should set download_started_at timestamp", async () => {
			insertTestGame(db, { guid: "download-test" });

			await repository.updateDownloadStarted("download-test");

			const game = await repository.findByGuid("download-test");
			expect(game?.download_started_at).not.toBeNull();
		});
	});
});

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ILogger } from "@xmer/consumer-shared";
import type { GameRecord } from "../types/index.js";
import { GamesRepository } from "./games.repository.js";

const mockLogger: ILogger = {
	debug: mock(() => {}),
	info: mock(() => {}),
	warn: mock(() => {}),
	error: mock(() => {}),
	child: mock(() => mockLogger),
};

const createMockGame = (overrides: Partial<GameRecord> = {}): GameRecord => ({
	id: 1,
	guid: `test-guid-${Date.now()}`,
	game_name: "Test Game",
	title_raw: "Test Game - v1.0",
	corrected_name: null,
	fitgirl_url: "https://fitgirl-repacks.site/test-game/",
	steam_app_id: 12345,
	steam_url: "https://store.steampowered.com/app/12345",
	steam_name: "Test Game",
	magnet_link: "magnet:?xt=urn:btih:abc123",
	torrent_hash: null,
	discord_message_id: null,
	discord_channel_id: null,
	size_original: "45 GB",
	size_repack: "22 GB",
	pub_date: "2024-01-15T12:00:00.000Z",
	download_started_at: null,
	download_completed_at: null,
	created_at: "2024-01-15T12:00:00.000Z",
	updated_at: "2024-01-15T12:00:00.000Z",
	steam_header_image: "https://cdn.steam.com/header.jpg",
	steam_price: null,
	steam_categories: '["Single-player"]',
	steam_review_score: null,
	steam_review_desc: null,
	steam_total_positive: null,
	steam_total_negative: null,
	rating: null,
	...overrides,
});

// Create a mock sql template tag function
const createMockSql = () => {
	const mockSqlFn = mock(
		(_strings: TemplateStringsArray, ..._values: unknown[]) => {
			return Promise.resolve([]);
		},
	);

	// Add unsafe method for dynamic queries
	(mockSqlFn as unknown as { unsafe: typeof mock }).unsafe = mock(
		(_query: string, _params?: unknown[]) => {
			return Promise.resolve([]);
		},
	);

	return mockSqlFn as unknown as ReturnType<typeof mock> & {
		unsafe: ReturnType<typeof mock>;
	};
};

describe("GamesRepository", () => {
	let mockSql: ReturnType<typeof createMockSql>;
	let repository: GamesRepository;

	beforeEach(() => {
		mockSql = createMockSql();
		repository = new GamesRepository({
			sql: mockSql as unknown as Parameters<
				typeof GamesRepository.prototype.constructor
			>[0]["sql"],
			logger: mockLogger,
		});
	});

	describe("findAll", () => {
		it("should return empty connection when no games", async () => {
			// Arrange
			mockSql.unsafe.mockResolvedValueOnce([{ count: "0" }]);
			mockSql.unsafe.mockResolvedValueOnce([]);

			// Act
			const result = await repository.findAll();

			// Assert
			expect(result.items).toHaveLength(0);
			expect(result.totalCount).toBe(0);
			expect(result.hasMore).toBe(false);
		});

		it("should return all games sorted by pub_date descending", async () => {
			// Arrange
			const games = [
				createMockGame({ id: 2, guid: "game-2", pub_date: "2024-01-03T00:00:00Z" }),
				createMockGame({ id: 3, guid: "game-3", pub_date: "2024-01-02T00:00:00Z" }),
				createMockGame({ id: 1, guid: "game-1", pub_date: "2024-01-01T00:00:00Z" }),
			];
			mockSql.unsafe.mockResolvedValueOnce([{ count: "3" }]);
			mockSql.unsafe.mockResolvedValueOnce(games);

			// Act
			const result = await repository.findAll();

			// Assert
			expect(result.items).toHaveLength(3);
			expect(result.items[0].guid).toBe("game-2");
			expect(result.items[1].guid).toBe("game-3");
			expect(result.items[2].guid).toBe("game-1");
		});

		it("should filter by search term", async () => {
			// Arrange
			const games = [createMockGame({ id: 1, guid: "game-1", game_name: "Cyberpunk 2077" })];
			mockSql.unsafe.mockResolvedValueOnce([{ count: "1" }]);
			mockSql.unsafe.mockResolvedValueOnce(games);

			// Act
			const result = await repository.findAll({ search: "Cyber" });

			// Assert
			expect(result.items).toHaveLength(1);
			expect(result.items[0].guid).toBe("game-1");
			expect(mockSql.unsafe).toHaveBeenCalledTimes(2);
		});

		it("should filter by download status AVAILABLE", async () => {
			// Arrange
			const games = [createMockGame({ id: 1, guid: "game-1", magnet_link: "magnet:?xt=..." })];
			mockSql.unsafe.mockResolvedValueOnce([{ count: "1" }]);
			mockSql.unsafe.mockResolvedValueOnce(games);

			// Act
			const result = await repository.findAll({ downloadStatus: "AVAILABLE" });

			// Assert
			expect(result.items).toHaveLength(1);
			expect(result.items[0].guid).toBe("game-1");
		});

		it("should paginate results", async () => {
			// Arrange
			const games = [
				createMockGame({ id: 3, guid: "game-2" }),
				createMockGame({ id: 4, guid: "game-3" }),
			];
			mockSql.unsafe.mockResolvedValueOnce([{ count: "5" }]);
			mockSql.unsafe.mockResolvedValueOnce(games);

			// Act
			const result = await repository.findAll(undefined, {
				offset: 2,
				limit: 2,
			});

			// Assert
			expect(result.items).toHaveLength(2);
			expect(result.totalCount).toBe(5);
			expect(result.hasMore).toBe(true);
		});
	});

	describe("findById", () => {
		it("should find game by id", async () => {
			// Arrange
			const game = createMockGame({ id: 1, guid: "find-by-id-test" });
			mockSql.mockResolvedValueOnce([game]);

			// Act
			const result = await repository.findById(1);

			// Assert
			expect(result).not.toBeNull();
			expect(result?.guid).toBe("find-by-id-test");
		});

		it("should return null for non-existent id", async () => {
			// Arrange
			mockSql.mockResolvedValueOnce([]);

			// Act
			const result = await repository.findById(9999);

			// Assert
			expect(result).toBeNull();
		});
	});

	describe("findByGuid", () => {
		it("should find game by guid", async () => {
			// Arrange
			const game = createMockGame({ guid: "unique-guid-123" });
			mockSql.mockResolvedValueOnce([game]);

			// Act
			const result = await repository.findByGuid("unique-guid-123");

			// Assert
			expect(result).not.toBeNull();
			expect(result?.guid).toBe("unique-guid-123");
		});

		it("should return null for non-existent guid", async () => {
			// Arrange
			mockSql.mockResolvedValueOnce([]);

			// Act
			const result = await repository.findByGuid("non-existent");

			// Assert
			expect(result).toBeNull();
		});
	});

	describe("findActiveDownloads", () => {
		it("should return games that are downloading", async () => {
			// Arrange
			const games = [
				createMockGame({
					id: 1,
					guid: "game-1",
					download_started_at: "2024-01-15T12:00:00.000Z",
				}),
			];
			mockSql.mockResolvedValueOnce(games);

			// Act
			const result = await repository.findActiveDownloads();

			// Assert
			expect(result).toHaveLength(1);
			expect(result[0].guid).toBe("game-1");
		});

		it("should exclude completed downloads", async () => {
			// Arrange
			mockSql.mockResolvedValueOnce([]);

			// Act
			const result = await repository.findActiveDownloads();

			// Assert
			expect(result).toHaveLength(0);
		});
	});

	describe("findRecent", () => {
		it("should return most recent games", async () => {
			// Arrange
			const games = [createMockGame({ guid: "new-game", pub_date: "2024-01-10T00:00:00Z" })];
			mockSql.mockResolvedValueOnce(games);

			// Act
			const result = await repository.findRecent(1);

			// Assert
			expect(result).toHaveLength(1);
			expect(result[0].guid).toBe("new-game");
		});
	});

	describe("updateRating", () => {
		it("should update rating to upvote", async () => {
			// Arrange
			const game = createMockGame({ id: 1, guid: "rating-test", rating: "upvote" });
			mockSql.mockResolvedValueOnce([game]);

			// Act
			const result = await repository.updateRating(1, "upvote");

			// Assert
			expect(result).not.toBeNull();
			expect(result?.rating).toBe("upvote");
		});

		it("should update rating to downvote", async () => {
			// Arrange
			const game = createMockGame({ id: 2, guid: "rating-test-2", rating: "downvote" });
			mockSql.mockResolvedValueOnce([game]);

			// Act
			const result = await repository.updateRating(2, "downvote");

			// Assert
			expect(result).not.toBeNull();
			expect(result?.rating).toBe("downvote");
		});

		it("should clear rating when set to null", async () => {
			// Arrange
			const game = createMockGame({ id: 1, guid: "clear-rating-test", rating: null });
			mockSql.mockResolvedValueOnce([game]);

			// Act
			const result = await repository.updateRating(1, null);

			// Assert
			expect(result).not.toBeNull();
			expect(result?.rating).toBeNull();
		});

		it("should return null for non-existent game", async () => {
			// Arrange
			mockSql.mockResolvedValueOnce([]);

			// Act
			const result = await repository.updateRating(9999, "upvote");

			// Assert
			expect(result).toBeNull();
		});
	});

	describe("updateCorrectedName", () => {
		it("should update corrected name", async () => {
			// Arrange
			const game = createMockGame({
				id: 1,
				guid: "name-test",
				corrected_name: "Corrected Name",
			});
			mockSql.mockResolvedValueOnce([game]);

			// Act
			const result = await repository.updateCorrectedName(1, "Corrected Name");

			// Assert
			expect(result).not.toBeNull();
			expect(result?.corrected_name).toBe("Corrected Name");
		});

		it("should return null for non-existent game", async () => {
			// Arrange
			mockSql.mockResolvedValueOnce([]);

			// Act
			const result = await repository.updateCorrectedName(9999, "Test");

			// Assert
			expect(result).toBeNull();
		});
	});

	describe("updateDownloadStarted", () => {
		it("should set download_started_at timestamp", async () => {
			// Arrange
			mockSql.mockResolvedValueOnce([]);

			// Act
			await repository.updateDownloadStarted("download-test");

			// Assert
			expect(mockSql).toHaveBeenCalled();
		});
	});
});

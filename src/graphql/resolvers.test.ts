import { beforeEach, describe, expect, it, mock } from "bun:test";
import type {
	GameRecord,
	GamesConnection,
	IFitGirlPublisher,
	IGamesRepository,
	IQbittorrentPublisher,
} from "../types/index.js";
import { resolvers } from "./resolvers.js";

const createMockGame = (overrides: Partial<GameRecord> = {}): GameRecord => ({
	id: 1,
	guid: "test-guid-123",
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
	discord_channel_id: "channel-123",
	size_original: "45 GB",
	size_repack: "22 GB",
	pub_date: "2024-01-15T12:00:00.000Z",
	download_started_at: null,
	download_completed_at: null,
	created_at: "2024-01-15T12:00:00.000Z",
	updated_at: "2024-01-15T12:00:00.000Z",
	steam_header_image: "https://cdn.steam.com/header.jpg",
	steam_price: "$59.99",
	steam_categories: '["Single-player", "Multiplayer"]',
	steam_review_score: null,
	steam_review_desc: "Very Positive",
	steam_total_positive: 1000,
	steam_total_negative: 100,
	rating: null,
	steam_refreshed_at: null,
	...overrides,
});

describe("resolvers", () => {
	let mockGamesRepository: IGamesRepository;
	let mockQbittorrentPublisher: IQbittorrentPublisher;
	let mockFitgirlPublisher: IFitGirlPublisher;

	beforeEach(() => {
		mockGamesRepository = {
			findAll: mock(() =>
				Promise.resolve({
					items: [createMockGame()],
					totalCount: 1,
					hasMore: false,
				} as GamesConnection),
			),
			findById: mock(() => Promise.resolve(createMockGame())),
			findByGuid: mock(() => Promise.resolve(createMockGame())),
			findActiveDownloads: mock(() => Promise.resolve([createMockGame()])),
			findRecent: mock(() => Promise.resolve([createMockGame()])),
			updateRating: mock(() =>
				Promise.resolve(createMockGame({ rating: "upvote" })),
			),
			updateCorrectedName: mock(() =>
				Promise.resolve(createMockGame({ corrected_name: "Corrected" })),
			),
			updateDownloadStarted: mock(() => Promise.resolve()),
		};

		mockQbittorrentPublisher = {
			initialize: mock(() => Promise.resolve()),
			shutdown: mock(() => Promise.resolve()),
			addDownload: mock(() => Promise.resolve()),
		};

		mockFitgirlPublisher = {
			initialize: mock(() => Promise.resolve()),
			shutdown: mock(() => Promise.resolve()),
			resetPipeline: mock(() => Promise.resolve()),
			refreshSteam: mock(() => Promise.resolve()),
		};
	});

	const context = () => ({
		gamesRepository: mockGamesRepository,
		qbittorrentPublisher: mockQbittorrentPublisher,
		fitgirlPublisher: mockFitgirlPublisher,
	});

	describe("Query.games", () => {
		it("should return games connection", async () => {
			const result = await resolvers.Query.games(
				null,
				{ filter: undefined, pagination: undefined },
				context(),
			);

			expect(result.items).toHaveLength(1);
			expect(result.totalCount).toBe(1);
			expect(result.hasMore).toBe(false);
			expect(mockGamesRepository.findAll).toHaveBeenCalledTimes(1);
		});

		it("should map game fields correctly", async () => {
			const result = await resolvers.Query.games(null, {}, context());

			const game = result.items[0];
			expect(game.id).toBe("1");
			expect(game.guid).toBe("test-guid-123");
			expect(game.gameName).toBe("Test Game");
			expect(game.downloadStatus).toBe("AVAILABLE");
			expect(game.steam?.appId).toBe(12345);
			expect(game.steam?.categories).toEqual(["Single-player", "Multiplayer"]);
		});
	});

	describe("Query.game", () => {
		it("should find game by id", async () => {
			const result = await resolvers.Query.game(null, { id: "1" }, context());

			expect(result).not.toBeNull();
			expect(result?.id).toBe("1");
			expect(mockGamesRepository.findById).toHaveBeenCalledWith(1);
		});

		it("should find game by guid", async () => {
			const result = await resolvers.Query.game(
				null,
				{ guid: "test-guid-123" },
				context(),
			);

			expect(result).not.toBeNull();
			expect(mockGamesRepository.findByGuid).toHaveBeenCalledWith(
				"test-guid-123",
			);
		});

		it("should return null for non-existent game", async () => {
			(
				mockGamesRepository.findById as ReturnType<typeof mock>
			).mockResolvedValue(null);

			const result = await resolvers.Query.game(null, { id: "999" }, context());

			expect(result).toBeNull();
		});
	});

	describe("Query.activeDownloads", () => {
		it("should return active downloads", async () => {
			const result = await resolvers.Query.activeDownloads(null, {}, context());

			expect(result).toHaveLength(1);
			expect(mockGamesRepository.findActiveDownloads).toHaveBeenCalledTimes(1);
		});
	});

	describe("Query.recentGames", () => {
		it("should return recent games with default limit", async () => {
			const result = await resolvers.Query.recentGames(null, {}, context());

			expect(result).toHaveLength(1);
			expect(mockGamesRepository.findRecent).toHaveBeenCalledWith(10);
		});

		it("should return recent games with custom limit", async () => {
			const result = await resolvers.Query.recentGames(
				null,
				{ limit: 5 },
				context(),
			);

			expect(mockGamesRepository.findRecent).toHaveBeenCalledWith(5);
		});
	});

	describe("Mutation.startDownload", () => {
		it("should start download successfully", async () => {
			const result = await resolvers.Mutation.startDownload(
				null,
				{ gameId: "1" },
				context(),
			);

			expect(result.success).toBe(true);
			expect(result.message).toBe("Download started");
			expect(mockQbittorrentPublisher.addDownload).toHaveBeenCalledWith(
				"test-guid-123",
				"magnet:?xt=urn:btih:abc123",
			);
			expect(mockGamesRepository.updateDownloadStarted).toHaveBeenCalledWith(
				"test-guid-123",
			);
		});

		it("should fail if game not found", async () => {
			(
				mockGamesRepository.findById as ReturnType<typeof mock>
			).mockResolvedValue(null);

			const result = await resolvers.Mutation.startDownload(
				null,
				{ gameId: "999" },
				context(),
			);

			expect(result.success).toBe(false);
			expect(result.message).toBe("Game not found");
		});

		it("should fail if no magnet link", async () => {
			(
				mockGamesRepository.findById as ReturnType<typeof mock>
			).mockResolvedValue(createMockGame({ magnet_link: null }));

			const result = await resolvers.Mutation.startDownload(
				null,
				{ gameId: "1" },
				context(),
			);

			expect(result.success).toBe(false);
			expect(result.message).toBe("No magnet link available for this game");
		});
	});

	describe("Mutation.setRating", () => {
		it("should set rating to upvote", async () => {
			const result = await resolvers.Mutation.setRating(
				null,
				{ gameId: "1", rating: "UPVOTE" },
				context(),
			);

			expect(result.success).toBe(true);
			expect(mockGamesRepository.updateRating).toHaveBeenCalledWith(
				1,
				"upvote",
			);
		});

		it("should set rating to downvote", async () => {
			const result = await resolvers.Mutation.setRating(
				null,
				{ gameId: "1", rating: "DOWNVOTE" },
				context(),
			);

			expect(mockGamesRepository.updateRating).toHaveBeenCalledWith(
				1,
				"downvote",
			);
		});

		it("should clear rating when null", async () => {
			const result = await resolvers.Mutation.setRating(
				null,
				{ gameId: "1", rating: null },
				context(),
			);

			expect(mockGamesRepository.updateRating).toHaveBeenCalledWith(1, null);
		});

		it("should throw if game not found", async () => {
			(
				mockGamesRepository.updateRating as ReturnType<typeof mock>
			).mockResolvedValue(null);

			await expect(
				resolvers.Mutation.setRating(
					null,
					{ gameId: "999", rating: "UPVOTE" },
					context(),
				),
			).rejects.toThrow("Game not found: 999");
		});
	});

	describe("Mutation.updateGameName", () => {
		it("should update corrected name", async () => {
			const result = await resolvers.Mutation.updateGameName(
				null,
				{ gameId: "1", correctedName: "New Name" },
				context(),
			);

			expect(result.correctedName).toBe("Corrected");
			expect(mockGamesRepository.updateCorrectedName).toHaveBeenCalledWith(
				1,
				"New Name",
			);
		});

		it("should throw if game not found", async () => {
			(
				mockGamesRepository.updateCorrectedName as ReturnType<typeof mock>
			).mockResolvedValue(null);

			await expect(
				resolvers.Mutation.updateGameName(
					null,
					{ gameId: "999", correctedName: "Test" },
					context(),
				),
			).rejects.toThrow("Game not found: 999");
		});
	});

	describe("Mutation.refreshSteam", () => {
		it("should publish refresh message with corrected name", async () => {
			(
				mockGamesRepository.findById as ReturnType<typeof mock>
			).mockResolvedValue(
				createMockGame({ corrected_name: "Corrected Game" }),
			);

			const result = await resolvers.Mutation.refreshSteam(
				null,
				{ gameId: "1" },
				context(),
			);

			expect(result.success).toBe(true);
			expect(result.message).toBe("Steam refresh initiated");
			expect(mockFitgirlPublisher.refreshSteam).toHaveBeenCalledWith(
				1,
				"Corrected Game",
			);
		});

		it("should fall back to steam name when no corrected name", async () => {
			(
				mockGamesRepository.findById as ReturnType<typeof mock>
			).mockResolvedValue(
				createMockGame({ corrected_name: null, steam_name: "Steam Name" }),
			);

			await resolvers.Mutation.refreshSteam(
				null,
				{ gameId: "1" },
				context(),
			);

			expect(mockFitgirlPublisher.refreshSteam).toHaveBeenCalledWith(
				1,
				"Steam Name",
			);
		});

		it("should fall back to game name when no corrected or steam name", async () => {
			(
				mockGamesRepository.findById as ReturnType<typeof mock>
			).mockResolvedValue(
				createMockGame({ corrected_name: null, steam_name: null }),
			);

			await resolvers.Mutation.refreshSteam(
				null,
				{ gameId: "1" },
				context(),
			);

			expect(mockFitgirlPublisher.refreshSteam).toHaveBeenCalledWith(
				1,
				"Test Game",
			);
		});

		it("should throw if game not found", async () => {
			(
				mockGamesRepository.findById as ReturnType<typeof mock>
			).mockResolvedValue(null);

			await expect(
				resolvers.Mutation.refreshSteam(
					null,
					{ gameId: "999" },
					context(),
				),
			).rejects.toThrow("Game not found: 999");
		});
	});

	describe("Mutation.resetPipeline", () => {
		it("should publish reset message and return success", async () => {
			const result = await resolvers.Mutation.resetPipeline(
				null,
				{ reason: "Manual reset" },
				context(),
			);

			expect(result.success).toBe(true);
			expect(result.message).toBe("Pipeline reset initiated");
			expect(mockFitgirlPublisher.resetPipeline).toHaveBeenCalledWith(
				"dashboard",
				"Manual reset",
			);
		});

		it("should publish reset message without reason", async () => {
			const result = await resolvers.Mutation.resetPipeline(
				null,
				{},
				context(),
			);

			expect(result.success).toBe(true);
			expect(mockFitgirlPublisher.resetPipeline).toHaveBeenCalledWith(
				"dashboard",
				undefined,
			);
		});
	});

	describe("Download status mapping", () => {
		it("should return COMPLETED when download_completed_at is set", async () => {
			(
				mockGamesRepository.findAll as ReturnType<typeof mock>
			).mockResolvedValue({
				items: [
					createMockGame({
						download_started_at: "2024-01-15T12:00:00.000Z",
						download_completed_at: "2024-01-15T14:00:00.000Z",
					}),
				],
				totalCount: 1,
				hasMore: false,
			});

			const result = await resolvers.Query.games(null, {}, context());
			expect(result.items[0].downloadStatus).toBe("COMPLETED");
		});

		it("should return DOWNLOADING when only download_started_at is set", async () => {
			(
				mockGamesRepository.findAll as ReturnType<typeof mock>
			).mockResolvedValue({
				items: [
					createMockGame({
						download_started_at: "2024-01-15T12:00:00.000Z",
						download_completed_at: null,
					}),
				],
				totalCount: 1,
				hasMore: false,
			});

			const result = await resolvers.Query.games(null, {}, context());
			expect(result.items[0].downloadStatus).toBe("DOWNLOADING");
		});

		it("should return UNAVAILABLE when no magnet_link", async () => {
			(
				mockGamesRepository.findAll as ReturnType<typeof mock>
			).mockResolvedValue({
				items: [createMockGame({ magnet_link: null })],
				totalCount: 1,
				hasMore: false,
			});

			const result = await resolvers.Query.games(null, {}, context());
			expect(result.items[0].downloadStatus).toBe("UNAVAILABLE");
		});
	});
});

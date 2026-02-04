import { withFilter } from "graphql-subscriptions";
import { GameNotFoundError, NoMagnetLinkError } from "../errors/index.js";
import type {
	DownloadProgressMessage,
	DownloadStatus,
	GameFilter,
	GameRecord,
	IGamesRepository,
	IQbittorrentPublisher,
	PaginationInput,
	RatingType,
} from "../types/index.js";
import { EVENTS, pubsub } from "./pubsub.js";

export interface GraphQLContext {
	gamesRepository: IGamesRepository;
	qbittorrentPublisher: IQbittorrentPublisher;
}

function getDownloadStatus(game: GameRecord): DownloadStatus {
	if (game.download_completed_at) return "COMPLETED";
	if (game.download_started_at) return "DOWNLOADING";
	if (game.magnet_link) return "AVAILABLE";
	return "UNAVAILABLE";
}

function mapGameToGraphQL(game: GameRecord) {
	const categories = game.steam_categories
		? JSON.parse(game.steam_categories)
		: null;

	return {
		id: String(game.id),
		guid: game.guid,
		gameName: game.game_name,
		titleRaw: game.title_raw,
		correctedName: game.corrected_name,
		fitgirlUrl: game.fitgirl_url,
		pubDate: game.pub_date,
		sizeOriginal: game.size_original,
		sizeRepack: game.size_repack,
		createdAt: game.created_at,
		updatedAt: game.updated_at,
		magnetLink: game.magnet_link,
		downloadStartedAt: game.download_started_at,
		downloadCompletedAt: game.download_completed_at,
		downloadStatus: getDownloadStatus(game),
		rating: game.rating ? game.rating.toUpperCase() : null,
		steam: game.steam_app_id
			? {
					appId: game.steam_app_id,
					name: game.steam_name,
					url: game.steam_url,
					headerImage: game.steam_header_image,
					price: game.steam_price,
					categories,
					reviewScore: game.steam_review_score,
					reviewDesc: game.steam_review_desc,
					totalPositive: game.steam_total_positive,
					totalNegative: game.steam_total_negative,
				}
			: null,
	};
}

export const resolvers = {
	Query: {
		games: async (
			_parent: unknown,
			args: { filter?: GameFilter; pagination?: PaginationInput },
			context: GraphQLContext,
		) => {
			const result = await context.gamesRepository.findAll(
				args.filter,
				args.pagination,
			);
			return {
				items: result.items.map(mapGameToGraphQL),
				totalCount: result.totalCount,
				hasMore: result.hasMore,
			};
		},

		game: async (
			_parent: unknown,
			args: { id?: string; guid?: string },
			context: GraphQLContext,
		) => {
			let game: GameRecord | null = null;

			if (args.id) {
				game = await context.gamesRepository.findById(
					Number.parseInt(args.id, 10),
				);
			} else if (args.guid) {
				game = await context.gamesRepository.findByGuid(args.guid);
			}

			return game ? mapGameToGraphQL(game) : null;
		},

		activeDownloads: async (
			_parent: unknown,
			_args: unknown,
			context: GraphQLContext,
		) => {
			const games = await context.gamesRepository.findActiveDownloads();
			return games.map(mapGameToGraphQL);
		},

		recentGames: async (
			_parent: unknown,
			args: { limit?: number },
			context: GraphQLContext,
		) => {
			const games = await context.gamesRepository.findRecent(args.limit ?? 10);
			return games.map(mapGameToGraphQL);
		},
	},

	Mutation: {
		startDownload: async (
			_parent: unknown,
			args: { gameId: string },
			context: GraphQLContext,
		) => {
			const game = await context.gamesRepository.findById(
				Number.parseInt(args.gameId, 10),
			);

			if (!game) {
				return {
					success: false,
					message: "Game not found",
					game: null,
				};
			}

			if (!game.magnet_link) {
				return {
					success: false,
					message: "No magnet link available for this game",
					game: mapGameToGraphQL(game),
				};
			}

			await context.qbittorrentPublisher.addDownload(
				game.guid,
				game.magnet_link,
			);
			await context.gamesRepository.updateDownloadStarted(game.guid);

			const updatedGame = await context.gamesRepository.findById(game.id);

			return {
				success: true,
				message: "Download started",
				game: updatedGame ? mapGameToGraphQL(updatedGame) : null,
			};
		},

		setRating: async (
			_parent: unknown,
			args: { gameId: string; rating?: RatingType | null },
			context: GraphQLContext,
		) => {
			const ratingValue = args.rating
				? (args.rating.toLowerCase() as RatingType)
				: null;
			const game = await context.gamesRepository.updateRating(
				Number.parseInt(args.gameId, 10),
				ratingValue,
			);

			if (!game) {
				throw new GameNotFoundError(args.gameId);
			}

			return {
				success: true,
				game: mapGameToGraphQL(game),
			};
		},

		updateGameName: async (
			_parent: unknown,
			args: { gameId: string; correctedName: string },
			context: GraphQLContext,
		) => {
			const game = await context.gamesRepository.updateCorrectedName(
				Number.parseInt(args.gameId, 10),
				args.correctedName,
			);

			if (!game) {
				throw new GameNotFoundError(args.gameId);
			}

			return mapGameToGraphQL(game);
		},
	},

	Subscription: {
		downloadProgress: {
			subscribe: withFilter(
				() => pubsub.asyncIterator(EVENTS.DOWNLOAD_PROGRESS),
				(
					payload: { downloadProgress: { gameId: string } },
					variables: { gameId?: string },
				) => {
					if (!variables.gameId) return true;
					return payload.downloadProgress.gameId === variables.gameId;
				},
			),
		},

		newRelease: {
			subscribe: () => pubsub.asyncIterator(EVENTS.NEW_RELEASE),
		},
	},

	Game: {
		__resolveReference: async (
			reference: { id: string },
			context: GraphQLContext,
		) => {
			const game = await context.gamesRepository.findById(
				Number.parseInt(reference.id, 10),
			);
			return game ? mapGameToGraphQL(game) : null;
		},
	},
};

export function publishDownloadProgress(
	gameId: string,
	progress: DownloadProgressMessage,
): void {
	pubsub.publish(EVENTS.DOWNLOAD_PROGRESS, {
		downloadProgress: {
			gameId,
			progress: progress.progress,
			downloadSpeed: progress.download_speed,
			eta: progress.eta,
			state: progress.state,
		},
	});
}

export function publishNewRelease(game: GameRecord): void {
	pubsub.publish(EVENTS.NEW_RELEASE, {
		newRelease: mapGameToGraphQL(game),
	});
}

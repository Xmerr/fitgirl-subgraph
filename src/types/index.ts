import type { ILogger, IPublisher } from "@xmer/consumer-shared";
import type { Channel } from "amqplib";
import type { Sql } from "postgres";

export interface GameRecord {
	id: number;
	guid: string;
	game_name: string;
	title_raw: string;
	corrected_name: string | null;
	fitgirl_url: string;
	steam_app_id: number | null;
	steam_url: string | null;
	steam_name: string | null;
	magnet_link: string | null;
	torrent_hash: string | null;
	discord_message_id: string | null;
	discord_channel_id: string | null;
	size_original: string;
	size_repack: string;
	pub_date: string;
	download_started_at: string | null;
	download_completed_at: string | null;
	created_at: string;
	updated_at: string;
	steam_header_image: string | null;
	steam_price: string | null;
	steam_categories: string | null;
	steam_review_score: string | null;
	steam_review_desc: string | null;
	steam_total_positive: number | null;
	steam_total_negative: number | null;
	rating: "upvote" | "downvote" | null;
	steam_refreshed_at: string | null;
}

export type DownloadStatus =
	| "AVAILABLE"
	| "DOWNLOADING"
	| "COMPLETED"
	| "UNAVAILABLE";

export type RatingType = "upvote" | "downvote";

export interface GameFilter {
	search?: string;
	downloadStatus?: DownloadStatus;
}

export interface PaginationInput {
	offset?: number;
	limit?: number;
}

export interface GamesConnection {
	items: GameRecord[];
	totalCount: number;
	hasMore: boolean;
}

export interface IGamesRepository {
	findAll(
		filter?: GameFilter,
		pagination?: PaginationInput,
	): Promise<GamesConnection>;
	findById(id: number): Promise<GameRecord | null>;
	findByGuid(guid: string): Promise<GameRecord | null>;
	findActiveDownloads(): Promise<GameRecord[]>;
	findRecent(limit: number): Promise<GameRecord[]>;
	updateRating(
		id: number,
		rating: RatingType | null,
	): Promise<GameRecord | null>;
	updateCorrectedName(
		id: number,
		correctedName: string,
	): Promise<GameRecord | null>;
	updateDownloadStarted(guid: string): Promise<void>;
}

export interface IQbittorrentPublisher extends IPublisher {
	addDownload(id: string, magnetLink: string): Promise<void>;
}

export interface GamesRepositoryOptions {
	sql: Sql;
	logger: ILogger;
}

export interface QbittorrentPublisherOptions {
	channel: Channel;
	exchange: string;
	logger: ILogger;
}

export interface QbittorrentAddDownload {
	id: string;
	magnetLink: string;
	category: "games";
}

export interface IFitGirlPublisher extends IPublisher {
	resetPipeline(source: string, reason?: string): Promise<void>;
	refreshSteam(gameId: number, correctedName: string): Promise<void>;
}

export interface FitGirlPublisherOptions {
	channel: Channel;
	exchange: string;
	logger: ILogger;
}

export interface SteamRefreshMessage {
	gameId: number;
	correctedName: string;
	timestamp: string;
}

export interface ResetMessage {
	source: string;
	timestamp: string;
	target: "all";
	reason?: string;
}

export interface DownloadProgressMessage {
	hash: string;
	name: string;
	progress: number;
	download_speed: number;
	eta: number;
	state: string;
	category?: string;
}

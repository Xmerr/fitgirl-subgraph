import { gql } from "graphql-tag";

export const typeDefs = gql`
	extend schema
		@link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

	type Query {
		"""
		Games sorted by pub_date descending (newest first)
		"""
		games(filter: GameFilter, pagination: PaginationInput): GamesConnection!

		"""
		Get a single game by ID or GUID
		"""
		game(id: ID, guid: String): Game

		"""
		Get games currently downloading
		"""
		activeDownloads: [Game!]!

		"""
		Get most recent games
		"""
		recentGames(limit: Int = 10): [Game!]!
	}

	type Mutation {
		"""
		Start downloading a game via qBittorrent
		"""
		startDownload(gameId: ID!): DownloadResult!

		"""
		Set game rating (single rating per game, not per user)
		"""
		setRating(gameId: ID!, rating: RatingType): RatingResult!

		"""
		Update corrected name for a game
		"""
		updateGameName(gameId: ID!, correctedName: String!): Game!

		"""
		Refresh Steam data for a game using its corrected name
		"""
		refreshSteam(gameId: ID!): RefreshSteamResult!

		"""
		Reset the FitGirl pipeline (clears all games and re-fetches from RSS)
		"""
		resetPipeline(reason: String): ResetResult!
	}

	type Subscription {
		"""
		Subscribe to download progress events
		"""
		downloadProgress(gameId: ID): DownloadProgressEvent!

		"""
		Subscribe to new game releases
		"""
		newRelease: Game!
	}

	"""
	A FitGirl game release
	"""
	type Game @key(fields: "id") {
		id: ID!
		guid: String!
		"""
		Parsed name from fitgirl title
		"""
		gameName: String!
		"""
		Original fitgirl post title
		"""
		titleRaw: String!
		"""
		User-editable corrected name
		"""
		correctedName: String
		fitgirlUrl: String!
		pubDate: String!
		sizeOriginal: String!
		sizeRepack: String!
		createdAt: String!
		updatedAt: String!
		magnetLink: String
		downloadStartedAt: String
		downloadCompletedAt: String
		downloadStatus: DownloadStatus!
		"""
		Single rating for the game (not per user)
		"""
		rating: RatingType
		steam: SteamData
	}

	"""
	Steam enrichment data
	"""
	type SteamData {
		appId: Int!
		"""
		Steam name (auto-filled if enrichment worked, null otherwise)
		"""
		name: String
		url: String!
		headerImage: String
		price: String
		categories: [String!]
		reviewScore: String
		reviewDesc: String
		totalPositive: Int
		totalNegative: Int
		steamRefreshedAt: String
	}

	"""
	Download status enumeration
	"""
	enum DownloadStatus {
		AVAILABLE
		DOWNLOADING
		COMPLETED
		UNAVAILABLE
	}

	"""
	Rating type enumeration
	"""
	enum RatingType {
		UPVOTE
		DOWNVOTE
	}

	"""
	Filter options for games query
	"""
	input GameFilter {
		search: String
		downloadStatus: DownloadStatus
	}

	"""
	Pagination options
	"""
	input PaginationInput {
		offset: Int = 0
		limit: Int = 20
	}

	"""
	Paginated games response
	"""
	type GamesConnection {
		items: [Game!]!
		totalCount: Int!
		hasMore: Boolean!
	}

	"""
	Result of starting a download
	"""
	type DownloadResult {
		success: Boolean!
		message: String
		game: Game
	}

	"""
	Result of setting a rating
	"""
	type RatingResult {
		success: Boolean!
		game: Game!
	}

	"""
	Download progress event
	"""
	type DownloadProgressEvent {
		gameId: ID!
		progress: Float!
		downloadSpeed: Float!
		eta: Int!
		state: String!
	}

	"""
	Result of refreshing Steam data
	"""
	type RefreshSteamResult {
		success: Boolean!
		message: String
	}

	"""
	Result of resetting the pipeline
	"""
	type ResetResult {
		success: Boolean!
		message: String
	}
`;

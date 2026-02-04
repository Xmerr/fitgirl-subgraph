export class GameNotFoundError extends Error {
	readonly code = "GAME_NOT_FOUND";

	constructor(identifier: string | number) {
		super(`Game not found: ${identifier}`);
		this.name = "GameNotFoundError";
	}
}

export class DatabaseError extends Error {
	readonly code = "DATABASE_ERROR";

	constructor(
		message: string,
		readonly operation: string,
		readonly context?: Record<string, unknown>,
	) {
		super(message);
		this.name = "DatabaseError";
	}
}

export class NoMagnetLinkError extends Error {
	readonly code = "NO_MAGNET_LINK";

	constructor(gameId: number | string) {
		super(`Game ${gameId} has no magnet link available`);
		this.name = "NoMagnetLinkError";
	}
}

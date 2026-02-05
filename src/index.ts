import { type LogLevel, createLogger } from "@xmer/consumer-shared";
import { connect } from "amqplib";
import { loadConfig } from "./config/config.js";
import { DatabaseManager } from "./database/database.js";
import { createGraphQLServer } from "./graphql/index.js";
import { QbittorrentPublisher } from "./publishers/qbittorrent.publisher.js";
import { GamesRepository } from "./repositories/games.repository.js";

const QBITTORRENT_EXCHANGE = "qbittorrent";

async function main(): Promise<void> {
	const config = loadConfig();

	const logger = createLogger({
		level: config.logLevel as LogLevel,
		loki: config.lokiHost ? { host: config.lokiHost } : undefined,
		job: "fitgirl-subgraph",
		environment: process.env.NODE_ENV || "development",
	});

	logger.info("Starting fitgirl-subgraph service");

	// Initialize database
	const databaseManager = new DatabaseManager({
		connectionString: config.postgresUrl,
		logger,
	});
	await databaseManager.initialize();

	// Connect to RabbitMQ
	const connection = await connect(config.rabbitmqUrl);
	const channel = await connection.createChannel();

	// Assert qbittorrent exchange
	await channel.assertExchange(QBITTORRENT_EXCHANGE, "topic", {
		durable: true,
	});

	// Create repositories and publishers
	const gamesRepository = new GamesRepository({
		sql: databaseManager.getSql(),
		logger,
	});

	const qbittorrentPublisher = new QbittorrentPublisher({
		channel,
		exchange: QBITTORRENT_EXCHANGE,
		logger,
	});

	// Create and start GraphQL server
	const graphqlServer = createGraphQLServer({
		port: config.graphqlPort,
		wsPort: config.graphqlWsPort,
		gamesRepository,
		qbittorrentPublisher,
		logger,
	});

	await graphqlServer.start();

	// Graceful shutdown
	const shutdown = async (signal: string) => {
		logger.info(`Received ${signal}, shutting down`);

		await graphqlServer.stop();
		await channel.close();
		await connection.close();
		await databaseManager.close();

		logger.info("Shutdown complete");
		process.exit(0);
	};

	process.on("SIGTERM", () => shutdown("SIGTERM"));
	process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});

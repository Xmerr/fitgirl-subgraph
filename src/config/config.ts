export interface Config {
	databasePath: string;
	rabbitmqUrl: string;
	graphqlPort: number;
	graphqlWsPort: number;
	lokiHost: string | null;
	logLevel: string;
}

export function loadConfig(): Config {
	const databasePath = process.env.DATABASE_PATH;
	const rabbitmqUrl = process.env.RABBITMQ_URL;

	if (!databasePath) {
		throw new Error("DATABASE_PATH environment variable is required");
	}

	if (!rabbitmqUrl) {
		throw new Error("RABBITMQ_URL environment variable is required");
	}

	return {
		databasePath,
		rabbitmqUrl,
		graphqlPort: Number.parseInt(process.env.GRAPHQL_PORT || "4004", 10),
		graphqlWsPort: Number.parseInt(process.env.GRAPHQL_WS_PORT || "4005", 10),
		lokiHost: process.env.LOKI_HOST || null,
		logLevel: process.env.LOG_LEVEL || "info",
	};
}

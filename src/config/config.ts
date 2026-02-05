export interface Config {
	postgresUrl: string;
	rabbitmqUrl: string;
	graphqlPort: number;
	graphqlWsPort: number;
	lokiHost: string | null;
	logLevel: string;
}

export function loadConfig(): Config {
	const postgresUrl = process.env.POSTGRES_URL;
	const rabbitmqUrl = process.env.RABBITMQ_URL;

	if (!postgresUrl) {
		throw new Error("POSTGRES_URL environment variable is required");
	}

	if (!rabbitmqUrl) {
		throw new Error("RABBITMQ_URL environment variable is required");
	}

	return {
		postgresUrl,
		rabbitmqUrl,
		graphqlPort: Number.parseInt(process.env.GRAPHQL_PORT || "4004", 10),
		graphqlWsPort: Number.parseInt(process.env.GRAPHQL_WS_PORT || "4005", 10),
		lokiHost: process.env.LOKI_HOST || null,
		logLevel: process.env.LOG_LEVEL || "info",
	};
}

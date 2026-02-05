import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	it("should throw if POSTGRES_URL is not set", () => {
		process.env.POSTGRES_URL = undefined;
		process.env.RABBITMQ_URL = "amqp://localhost";

		expect(() => loadConfig()).toThrow(
			"POSTGRES_URL environment variable is required",
		);
	});

	it("should throw if RABBITMQ_URL is not set", () => {
		process.env.POSTGRES_URL = "postgres://localhost/fitgirl";
		process.env.RABBITMQ_URL = undefined;

		expect(() => loadConfig()).toThrow(
			"RABBITMQ_URL environment variable is required",
		);
	});

	it("should load config with default values", () => {
		process.env.POSTGRES_URL = "postgres://localhost/fitgirl";
		process.env.RABBITMQ_URL = "amqp://localhost";

		const config = loadConfig();

		expect(config.postgresUrl).toBe("postgres://localhost/fitgirl");
		expect(config.rabbitmqUrl).toBe("amqp://localhost");
		expect(config.graphqlPort).toBe(4004);
		expect(config.graphqlWsPort).toBe(4005);
		expect(config.lokiHost).toBeNull();
		expect(config.logLevel).toBe("info");
	});

	it("should load config with custom values", () => {
		process.env.POSTGRES_URL = "postgres://custom:5432/fitgirl";
		process.env.RABBITMQ_URL = "amqp://custom:5672";
		process.env.GRAPHQL_PORT = "5000";
		process.env.GRAPHQL_WS_PORT = "5001";
		process.env.LOKI_HOST = "http://loki:3100";
		process.env.LOG_LEVEL = "debug";

		const config = loadConfig();

		expect(config.postgresUrl).toBe("postgres://custom:5432/fitgirl");
		expect(config.rabbitmqUrl).toBe("amqp://custom:5672");
		expect(config.graphqlPort).toBe(5000);
		expect(config.graphqlWsPort).toBe(5001);
		expect(config.lokiHost).toBe("http://loki:3100");
		expect(config.logLevel).toBe("debug");
	});
});

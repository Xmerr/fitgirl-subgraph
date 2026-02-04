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

	it("should throw if DATABASE_PATH is not set", () => {
		process.env.DATABASE_PATH = undefined;
		process.env.RABBITMQ_URL = "amqp://localhost";

		expect(() => loadConfig()).toThrow(
			"DATABASE_PATH environment variable is required",
		);
	});

	it("should throw if RABBITMQ_URL is not set", () => {
		process.env.DATABASE_PATH = "/app/data/fitgirl.db";
		process.env.RABBITMQ_URL = undefined;

		expect(() => loadConfig()).toThrow(
			"RABBITMQ_URL environment variable is required",
		);
	});

	it("should load config with default values", () => {
		process.env.DATABASE_PATH = "/app/data/fitgirl.db";
		process.env.RABBITMQ_URL = "amqp://localhost";

		const config = loadConfig();

		expect(config.databasePath).toBe("/app/data/fitgirl.db");
		expect(config.rabbitmqUrl).toBe("amqp://localhost");
		expect(config.graphqlPort).toBe(4004);
		expect(config.graphqlWsPort).toBe(4005);
		expect(config.lokiHost).toBeNull();
		expect(config.logLevel).toBe("info");
	});

	it("should load config with custom values", () => {
		process.env.DATABASE_PATH = "/custom/path.db";
		process.env.RABBITMQ_URL = "amqp://custom:5672";
		process.env.GRAPHQL_PORT = "5000";
		process.env.GRAPHQL_WS_PORT = "5001";
		process.env.LOKI_HOST = "http://loki:3100";
		process.env.LOG_LEVEL = "debug";

		const config = loadConfig();

		expect(config.databasePath).toBe("/custom/path.db");
		expect(config.rabbitmqUrl).toBe("amqp://custom:5672");
		expect(config.graphqlPort).toBe(5000);
		expect(config.graphqlWsPort).toBe(5001);
		expect(config.lokiHost).toBe("http://loki:3100");
		expect(config.logLevel).toBe("debug");
	});
});

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ILogger } from "@xmer/consumer-shared";
import type { Channel } from "amqplib";
import { FitGirlPublisher } from "./fitgirl.publisher.js";

const mockLogger: ILogger = {
	debug: mock(() => {}),
	info: mock(() => {}),
	warn: mock(() => {}),
	error: mock(() => {}),
	child: mock(() => mockLogger),
};

describe("FitGirlPublisher", () => {
	let mockChannel: Partial<Channel>;
	let publisher: FitGirlPublisher;

	beforeEach(() => {
		mockChannel = {
			publish: mock(() => true),
			assertExchange: mock(() => Promise.resolve({ exchange: "fitgirl" })),
		};

		publisher = new FitGirlPublisher({
			channel: mockChannel as Channel,
			exchange: "fitgirl",
			logger: mockLogger,
		});
	});

	describe("resetPipeline", () => {
		it("should publish reset message to fitgirl exchange", async () => {
			await publisher.resetPipeline("dashboard", "Manual reset");

			expect(mockChannel.publish).toHaveBeenCalledTimes(1);
			const [exchange, routingKey, content] = (
				mockChannel.publish as ReturnType<typeof mock>
			).mock.calls[0];

			expect(exchange).toBe("fitgirl");
			expect(routingKey).toBe("reset");

			const message = JSON.parse(content.toString());
			expect(message.source).toBe("dashboard");
			expect(message.target).toBe("all");
			expect(message.reason).toBe("Manual reset");
			expect(message.timestamp).toBeDefined();
		});

		it("should publish reset message without reason", async () => {
			await publisher.resetPipeline("dashboard");

			const [, , content] = (mockChannel.publish as ReturnType<typeof mock>)
				.mock.calls[0];

			const message = JSON.parse(content.toString());
			expect(message.source).toBe("dashboard");
			expect(message.reason).toBeUndefined();
		});
	});

	describe("refreshSteam", () => {
		it("should publish steam refresh message to fitgirl exchange", async () => {
			await publisher.refreshSteam(42, "Corrected Game Name");

			expect(mockChannel.publish).toHaveBeenCalledTimes(1);
			const [exchange, routingKey, content] = (
				mockChannel.publish as ReturnType<typeof mock>
			).mock.calls[0];

			expect(exchange).toBe("fitgirl");
			expect(routingKey).toBe("steam.refresh");

			const message = JSON.parse(content.toString());
			expect(message.gameId).toBe(42);
			expect(message.correctedName).toBe("Corrected Game Name");
			expect(message.timestamp).toBeDefined();
		});
	});
});

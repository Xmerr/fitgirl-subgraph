import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { ILogger } from "@xmer/consumer-shared";
import type { Channel } from "amqplib";
import { QbittorrentPublisher } from "./qbittorrent.publisher.js";

const mockLogger: ILogger = {
	debug: mock(() => {}),
	info: mock(() => {}),
	warn: mock(() => {}),
	error: mock(() => {}),
	child: mock(() => mockLogger),
};

describe("QbittorrentPublisher", () => {
	let mockChannel: Partial<Channel>;
	let publisher: QbittorrentPublisher;

	beforeEach(() => {
		mockChannel = {
			publish: mock(() => true),
			assertExchange: mock(() => Promise.resolve({ exchange: "qbittorrent" })),
		};

		publisher = new QbittorrentPublisher({
			channel: mockChannel as Channel,
			exchange: "qbittorrent",
			logger: mockLogger,
		});
	});

	describe("addDownload", () => {
		it("should publish download message to qbittorrent exchange", async () => {
			await publisher.addDownload(
				"game-guid-123",
				"magnet:?xt=urn:btih:abc123",
			);

			expect(mockChannel.publish).toHaveBeenCalledTimes(1);
			const [exchange, routingKey, content] = (
				mockChannel.publish as ReturnType<typeof mock>
			).mock.calls[0];

			expect(exchange).toBe("qbittorrent");
			expect(routingKey).toBe("downloads.add");

			const message = JSON.parse(content.toString());
			expect(message.id).toBe("game-guid-123");
			expect(message.magnetLink).toBe("magnet:?xt=urn:btih:abc123");
			expect(message.category).toBe("games");
		});
	});
});

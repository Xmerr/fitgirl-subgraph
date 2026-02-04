import { BasePublisher } from "@xmer/consumer-shared";
import type {
	IQbittorrentPublisher,
	QbittorrentAddDownload,
	QbittorrentPublisherOptions,
} from "../types/index.js";

const ROUTING_KEY = "downloads.add";

export class QbittorrentPublisher
	extends BasePublisher
	implements IQbittorrentPublisher
{
	constructor(options: QbittorrentPublisherOptions) {
		super({
			channel: options.channel,
			exchange: options.exchange,
			logger: options.logger,
		});
	}

	async addDownload(id: string, magnetLink: string): Promise<void> {
		const message: QbittorrentAddDownload = {
			id,
			magnetLink,
			category: "games",
		};

		await this.publish(ROUTING_KEY, message);
		this.logger.info("Download request published", { id });
	}
}

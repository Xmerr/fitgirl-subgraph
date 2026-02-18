import { BasePublisher } from "@xmer/consumer-shared";
import type {
	FitGirlPublisherOptions,
	IFitGirlPublisher,
	ResetMessage,
	SteamRefreshMessage,
} from "../types/index.js";

const ROUTING_KEY_RESET = "reset";
const ROUTING_KEY_STEAM_REFRESH = "steam.refresh";

export class FitGirlPublisher
	extends BasePublisher
	implements IFitGirlPublisher
{
	constructor(options: FitGirlPublisherOptions) {
		super({
			channel: options.channel,
			exchange: options.exchange,
			logger: options.logger,
		});
	}

	async resetPipeline(source: string, reason?: string): Promise<void> {
		const message: ResetMessage = {
			source,
			timestamp: new Date().toISOString(),
			target: "all",
			reason,
		};

		await this.publish(
			ROUTING_KEY_RESET,
			message as unknown as Record<string, unknown>,
		);
	}

	async refreshSteam(gameId: number, correctedName: string): Promise<void> {
		const message: SteamRefreshMessage = {
			gameId,
			correctedName,
			timestamp: new Date().toISOString(),
		};

		await this.publish(
			ROUTING_KEY_STEAM_REFRESH,
			message as unknown as Record<string, unknown>,
		);
	}
}

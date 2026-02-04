import { PubSub } from "graphql-subscriptions";

export const pubsub = new PubSub();

export const EVENTS = {
	DOWNLOAD_PROGRESS: "DOWNLOAD_PROGRESS",
	NEW_RELEASE: "NEW_RELEASE",
} as const;

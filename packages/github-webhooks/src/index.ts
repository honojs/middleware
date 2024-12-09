import { Webhooks } from "@octokit/webhooks";
import { env } from "hono/adapter";
import { createMiddleware } from "hono/factory";

// Octokit isn't exporting this particular type, so we extract it from the
// `verifyAndReceive` method.
export type WebhookEventName = Parameters<
	InstanceType<typeof Webhooks>["verifyAndReceive"]
>[number]["name"];

let webhooks: Webhooks | undefined;
function getWebhooksInstance(secret: string) {
	if (!webhooks) {
		webhooks = new Webhooks({ secret });
	}

	return webhooks;
}

/**
 * Middleware to verify and handle Github Webhook requests. It exposes the
 * `webhooks` object on the context.
 */
export const githubWebhooksMiddleware = () =>
	createMiddleware(async (c, next) => {
		const { GITHUB_WEBHOOK_SECRET } = env<{ GITHUB_WEBHOOK_SECRET: string }>(c);
		const webhooks = getWebhooksInstance(GITHUB_WEBHOOK_SECRET);

		c.set("webhooks", webhooks);

		await next();

		const id = c.req.header("x-github-delivery");
		const signature = c.req.header("x-hub-signature-256");
		const name = c.req.header("x-github-event") as WebhookEventName;
		if (!(id && name && signature)) {
			return c.text("Invalid webhook request", 403);
		}

		const payload = await c.req.text();

		try {
			await webhooks.verifyAndReceive({
				id,
				name,
				signature,
				payload,
			});
			return c.text("Webhook received & verified", 201);
		} catch (error) {
			return c.text(`Failed to verify Github Webhook request: ${error}`, 400);
		}
	});

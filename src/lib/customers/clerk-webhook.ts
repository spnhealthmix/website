/**
 * Clerk User Webhook Decommissioned Stub
 * Application-managed authentication is now active; Clerk webhook synchronization is no longer required.
 */

export async function handleClerkWebhook(_req: Request, _deps?: any): Promise<Response> {
  return new Response(
    JSON.stringify({ message: "Clerk webhooks have been decommissioned. Custom authentication is active." }),
    { status: 410, headers: { "Content-Type": "application/json" } }
  );
}

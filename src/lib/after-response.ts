import { after } from "next/server";

/**
 * Runs slow side effects (sending e-mail) after the HTTP response has been sent, so the response time
 * does not reveal whether an e-mail address belongs to an account.
 * Outside a Next.js request scope (unit/integration tests, scripts) `after()` throws, so the task
 * simply runs inline instead.
 */
export async function runAfterResponse(task: () => Promise<void>) {
  const safeTask = async () => {
    try {
      await task();
    } catch {
      // Delivery problems are logged by the e-mail layer; they must never surface to the caller.
    }
  };
  try {
    after(safeTask);
  } catch {
    await safeTask();
  }
}

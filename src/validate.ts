import { COVAL_TRACES_ENDPOINT } from './constants.js';

/** Send a minimal OTLP test span to verify API connectivity. */
export async function sendTestSpan(apiKey: string): Promise<boolean> {
  const now = Date.now();
  const traceId = now.toString(16).padStart(32, '0');
  const spanId = now.toString(16).padStart(16, '0').slice(-16);
  const startNs = BigInt(now) * 1_000_000n;
  const endNs = startNs + 1_000_000n;

  const payload = {
    resourceSpans: [
      {
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: 'coval-wizard-test' } }],
        },
        scopeSpans: [
          {
            scope: { name: 'coval.wizard' },
            spans: [
              {
                traceId,
                spanId,
                name: 'wizard-validation-span',
                kind: 1,
                startTimeUnixNano: startNs.toString(),
                endTimeUnixNano: endNs.toString(),
                attributes: [{ key: 'coval.wizard.validation', value: { boolValue: true } }],
                status: { code: 1 },
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(COVAL_TRACES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'X-Simulation-Id': 'wizard-test',
      },
      body: JSON.stringify(payload),
    });
    // 200 = accepted, 404 = sim not found but auth succeeded — both OK
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

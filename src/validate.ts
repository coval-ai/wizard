export async function sendTestSpan(apiKey: string): Promise<boolean> {
  // Generate trace/span IDs
  const now = Date.now();
  const traceId = now.toString(16).padStart(32, "0");
  const spanId = now.toString(16).padStart(16, "0").slice(-16);
  const startNs = BigInt(now) * 1_000_000n;
  const endNs = startNs + 1_000_000n; // 1ms span

  // Minimal OTLP JSON payload
  const payload = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            {
              key: "service.name",
              value: { stringValue: "coval-wizard-test" },
            },
          ],
        },
        scopeSpans: [
          {
            scope: { name: "coval.wizard" },
            spans: [
              {
                traceId,
                spanId,
                name: "wizard-validation-span",
                kind: 1, // INTERNAL
                startTimeUnixNano: startNs.toString(),
                endTimeUnixNano: endNs.toString(),
                attributes: [
                  {
                    key: "coval.wizard.validation",
                    value: { boolValue: true },
                  },
                ],
                status: { code: 1 }, // OK
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch("https://api.coval.dev/v1/traces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "X-Simulation-Id": "wizard-test",
      },
      body: JSON.stringify(payload),
    });

    // 200 = accepted, 404 = sim not found but auth succeeded (both are OK)
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

process.env.SUPABASE_AUTH_ENABLED = "false";

const { requestedOemId } = require("../backend/src/services/oem-registry-service.js");
const handler = require("../api/reference.js");

function runTest(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`✓ ${name}`))
    .catch((err) => {
      console.error(`✗ ${name}:`, err);
      process.exitCode = 1;
    });
}

function mockRequest({ url, method = "POST", headers = {}, body = {} }) {
  const payload = Buffer.from(JSON.stringify(body));
  const req = Readable.from([payload]);
  req.url = url;
  req.method = method;
  req.headers = {
    "content-type": "application/json",
    ...headers
  };
  return req;
}

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this.headers[key.toLowerCase()] = val;
      return this;
    },
    send(content) {
      this.body = content;
      return this;
    },
    json(content) {
      this.body = typeof content === "string" ? content : JSON.stringify(content);
      return this;
    },
    end(content) {
      if (content) this.body = content;
      return this;
    }
  };
}

async function run() {
  await runTest("requestedOemId parses headers and internal props", () => {
    assert.equal(requestedOemId({ headers: { "x-oem-id": "sparkmeter" } }), "sparkmeter");
    assert.equal(requestedOemId({ headers: { "X-Oem-Id": "Miyaji" } }), "miyaji");
    assert.equal(requestedOemId({ __oemId: "calinmeter" }), "calinmeter");
  });

  await runTest("Dashboard readPanelGroup returns Sparkmeter metrics when x-oem-id is sparkmeter", async () => {
    const req = mockRequest({
      url: "/api/dashboard/readPanelGroup",
      headers: { "x-oem-id": "sparkmeter" },
      body: {}
    });
    const res = mockResponse();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.code, 0);
    assert.equal(parsed.data.totalAccountCount, 3074);
    assert.equal(parsed.data.activeGridSites, 8);
    assert.equal(parsed.data.vendingStrategy, "direct_credit");
    assert.ok(parsed.data.totalPurchaseTimes >= 18420);
    assert.equal(parsed.data.totalPurchaseUnit, 142580.4);
    assert.equal(parsed.data.totalPurchaseMoney, 52750000.00);
    assert.equal(parsed.data.allTimeInception, true);
    assert.equal(parsed.data.billingPeriod, "all_time_since_inception");
  });

  await runTest("Dashboard readLineChart returns Sparkmeter series for types 0..3", async () => {
    for (const activeType of [0, 1, 2, 3]) {
      const req = mockRequest({
        url: "/api/dashboard/readLineChart",
        headers: { "x-oem-id": "sparkmeter" },
        body: { type: activeType }
      });
      const res = mockResponse();
      await handler(req, res);

      assert.equal(res.statusCode, 200);
      const parsed = JSON.parse(res.body);
      assert.equal(parsed.code, 0);
      assert.ok(Array.isArray(parsed.data.labels));
      assert.ok(Array.isArray(parsed.data.values));
      assert.equal(parsed.data.labels.length, parsed.data.values.length);
      assert.ok(parsed.data.labels.length > 0);
    }
  });

  console.log("All dashboard OEM recognition tests passed!");
}

run();

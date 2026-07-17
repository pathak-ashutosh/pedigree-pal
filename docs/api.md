# API

Create a read-only key under **Developer**. The raw credential is shown once and stored only as a hash.

```bash
curl --request GET \
  --header "Authorization: Bearer pp_live_REPLACE" \
  "https://app.example.com/api/v1/dogs?search=June&limit=50"
```

Current scope: `dogs:read`. Limits: 1–100 results and 120 requests per organization per minute. `429` includes `Retry-After`. Every response is uncached and carries `x-request-id`.

The machine-readable contract is `/openapi.yaml`.

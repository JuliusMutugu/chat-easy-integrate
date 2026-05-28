# SMS Profit Calculator (Kenya) - Sell at KES 0.30

Assumption: resale rate is fixed at **KES 0.30 per SMS unit**.

## Formula

- Profit per SMS = `0.30 - upstream_cost`
- Margin % = `((0.30 - upstream_cost) / 0.30) * 100`
- Total profit = `profit_per_sms * sms_units`

## Margin Table

| Upstream cost (KES) | Profit/SMS (KES) | Margin % |
| --- | ---: | ---: |
| 0.10 | 0.20 | 66.67% |
| 0.12 | 0.18 | 60.00% |
| 0.14 | 0.16 | 53.33% |
| 0.16 | 0.14 | 46.67% |
| 0.18 | 0.12 | 40.00% |
| 0.20 | 0.10 | 33.33% |
| 0.22 | 0.08 | 26.67% |
| 0.24 | 0.06 | 20.00% |
| 0.26 | 0.04 | 13.33% |
| 0.28 | 0.02 | 6.67% |
| 0.30 | 0.00 | 0.00% |

## Monthly Profit Examples

| SMS units/month | Upstream 0.16 | Upstream 0.20 | Upstream 0.24 |
| ---: | ---: | ---: | ---: |
| 50,000 | 7,000 | 5,000 | 3,000 |
| 100,000 | 14,000 | 10,000 | 6,000 |
| 250,000 | 35,000 | 25,000 | 15,000 |
| 500,000 | 70,000 | 50,000 | 30,000 |
| 1,000,000 | 140,000 | 100,000 | 60,000 |

Values above are in KES and represent gross margin before overheads.

## Cheapest Safe Strategy

1. Target upstream route cost at or below **KES 0.20**
2. Start clients on prepaid wallet only
3. Enforce sender ID approval before production traffic
4. Reserve at least 5-10% margin for delivery failures/retries/operations
5. Avoid any route where effective delivered cost reaches 0.28+

## What to Add in `.env`

```env
SMS_SELL_RATE_KES=0.30
SMS_GATEWAY_URL=http://127.0.0.1:8080/sms/send
SMS_GATEWAY_API_KEY=replace-if-required
SMS_GATEWAY_METHOD=POST
```
